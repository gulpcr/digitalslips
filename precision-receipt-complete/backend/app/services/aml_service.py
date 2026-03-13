"""
AML (Anti-Money Laundering) Service
Rule-based AML checks per SBP / Meezan Bank compliance requirements.
Runs after transaction creation, before receipt generation.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy import func, and_
from sqlalchemy.orm import Session
import logging

from app.models import (
    Transaction, Customer, AuditLog,
    TransactionType, TransactionStatus, KycStatus,
    Severity,
)
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class AMLCheckResult:
    """Result returned by AMLService.run_checks()."""
    fraud_score: float
    fraud_flags: List[str]
    is_suspicious: bool
    needs_review: bool
    requires_ctr: bool
    risk_level: str          # LOW | MEDIUM | HIGH | CRITICAL
    check_details: Dict[str, Any]
    checked_at: datetime = field(default_factory=datetime.utcnow)


class AMLService:
    """Rule-based AML checks. All methods are static."""

    # ------------------------------------------------------------------ #
    # Public entry point                                                    #
    # ------------------------------------------------------------------ #

    @staticmethod
    def run_checks(
        db: Session,
        transaction: Transaction,
        customer: Optional[Customer],
    ) -> AMLCheckResult:
        """
        Run all AML checks for a completed transaction.

        Call this immediately after the Transaction is committed and before
        ReceiptService.create_receipt() is called.

        Mutates transaction.fraud_score / fraud_flags / is_suspicious and
        commits those fields. Writes one AuditLog entry. Never raises.
        """
        if not settings.FRAUD_DETECTION_ENABLED:
            return AMLCheckResult(
                fraud_score=0.0,
                fraud_flags=[],
                is_suspicious=False,
                needs_review=False,
                requires_ctr=False,
                risk_level="LOW",
                check_details={"skipped": "FRAUD_DETECTION_ENABLED is False"},
            )

        if customer is None:
            logger.error(
                f"AML: customer not found for txn {transaction.reference_number}"
            )
            result = AMLCheckResult(
                fraud_score=0.5,
                fraud_flags=["CUSTOMER_LOOKUP_FAILED"],
                is_suspicious=False,
                needs_review=True,
                requires_ctr=False,
                risk_level="MEDIUM",
                check_details={"error": "Customer record not found"},
            )
            AMLService._persist_to_transaction(db, transaction, result)
            AMLService._write_audit_log(db, transaction, None, result)
            return result

        score: float = 0.0
        flags: List[str] = []
        details: Dict[str, Any] = {}

        try:
            amount = Decimal(str(transaction.amount))

            # ---- Rule 1: Blocked customer (hard ceiling) ----------------
            if customer.is_blocked:
                flags.append("BLOCKED_CUSTOMER")
                details["BLOCKED_CUSTOMER"] = {
                    "reason": customer.blocked_reason,
                    "blocked_at": str(customer.blocked_at),
                }
                score = 1.0

            # ---- Rule 2: CTR threshold (PKR 250,000+ cash/cheque/payorder)
            ctr_threshold = Decimal(str(settings.CTR_THRESHOLD_PKR))
            if (
                transaction.transaction_type in (
                    TransactionType.CASH_DEPOSIT,
                    TransactionType.CHEQUE_DEPOSIT,
                    TransactionType.PAY_ORDER,
                )
                and amount >= ctr_threshold
            ):
                flags.append("CTR_REQUIRED")
                details["CTR_REQUIRED"] = {
                    "amount": float(amount),
                    "threshold": float(ctr_threshold),
                }
                score = min(1.0, score + 0.4)

            # ---- Rule 3: High amount (any type >= 500,000) --------------
            if amount >= Decimal("500000.00"):
                flags.append("HIGH_AMOUNT")
                details["HIGH_AMOUNT"] = {
                    "amount": float(amount),
                    "threshold": 500000.0,
                }
                score = min(1.0, score + 0.2)

            # ---- Rule 4: Unverified customer + high amount (>= 100,000) -
            if (
                customer.kyc_status != KycStatus.VERIFIED
                and amount >= Decimal("100000.00")
            ):
                flags.append("UNVERIFIED_HIGH_AMOUNT")
                details["UNVERIFIED_HIGH_AMOUNT"] = {
                    "kyc_status": customer.kyc_status.value,
                    "amount": float(amount),
                    "threshold": 100000.0,
                }
                score = min(1.0, score + 0.3)

            # ---- Rule 5: Third-party depositor + high amount (>= 200,000)
            if (
                transaction.depositor_cnic
                and transaction.customer_cnic
                and transaction.depositor_cnic.strip() != transaction.customer_cnic.strip()
                and amount >= Decimal("200000.00")
            ):
                flags.append("THIRD_PARTY_HIGH_AMOUNT")
                details["THIRD_PARTY_HIGH_AMOUNT"] = {
                    "depositor_cnic": transaction.depositor_cnic,
                    "customer_cnic": transaction.customer_cnic,
                    "amount": float(amount),
                    "threshold": 200000.0,
                }
                score = min(1.0, score + 0.2)

            # ---- Rule 6: Daily frequency (> threshold deposits today) ---
            daily_count = AMLService._count_daily_deposits(
                db, transaction.customer_cnic, transaction.id
            )
            freq_threshold = settings.AML_DAILY_FREQUENCY_THRESHOLD
            if daily_count >= freq_threshold:
                flags.append("HIGH_FREQUENCY")
                details["HIGH_FREQUENCY"] = {
                    "deposits_today": daily_count + 1,
                    "threshold": freq_threshold,
                }
                score = min(1.0, score + 0.3)

            # ---- Rule 7: Daily cumulative volume (>= DEFAULT_DAILY_LIMIT)
            daily_sum = AMLService._sum_daily_amount(
                db, transaction.customer_cnic, transaction.id
            )
            daily_total = daily_sum + amount
            daily_limit = Decimal(str(settings.DEFAULT_DAILY_LIMIT))
            if daily_total >= daily_limit:
                flags.append("HIGH_DAILY_VOLUME")
                details["HIGH_DAILY_VOLUME"] = {
                    "prior_daily_amount": float(daily_sum),
                    "this_amount": float(amount),
                    "daily_total": float(daily_total),
                    "threshold": float(daily_limit),
                }
                score = min(1.0, score + 0.3)

            # ---- Rule 8: Monthly cumulative volume ------------------
            monthly_sum = AMLService._sum_monthly_amount(
                db, transaction.customer_cnic, transaction.id
            )
            monthly_total = monthly_sum + amount
            monthly_limit = Decimal(str(settings.AML_MONTHLY_VOLUME_THRESHOLD_PKR))
            if monthly_total >= monthly_limit:
                flags.append("HIGH_MONTHLY_VOLUME")
                details["HIGH_MONTHLY_VOLUME"] = {
                    "prior_monthly_amount": float(monthly_sum),
                    "this_amount": float(amount),
                    "monthly_total": float(monthly_total),
                    "threshold": float(monthly_limit),
                }
                score = min(1.0, score + 0.2)

        except Exception as exc:
            logger.error(
                f"AML check exception for txn {transaction.reference_number}: {exc}"
            )
            details["error"] = str(exc)

        is_suspicious = score >= settings.FRAUD_THRESHOLD_SCORE
        requires_ctr = "CTR_REQUIRED" in flags
        needs_review = is_suspicious or requires_ctr

        result = AMLCheckResult(
            fraud_score=round(score, 4),
            fraud_flags=flags,
            is_suspicious=is_suspicious,
            needs_review=needs_review,
            requires_ctr=requires_ctr,
            risk_level=AMLService._risk_level(score),
            check_details=details,
        )

        AMLService._persist_to_transaction(db, transaction, result)
        AMLService._write_audit_log(db, transaction, customer, result)

        return result

    # ------------------------------------------------------------------ #
    # Velocity query helpers                                                #
    # ------------------------------------------------------------------ #

    # Statuses to include in velocity calculations
    _VELOCITY_STATUSES = (
        TransactionStatus.COMPLETED,
        TransactionStatus.PENDING,
        TransactionStatus.PROCESSING,
    )

    @staticmethod
    def _count_daily_deposits(
        db: Session, customer_cnic: str, exclude_txn_id
    ) -> int:
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        return (
            db.query(func.count(Transaction.id))
            .filter(
                and_(
                    Transaction.customer_cnic == customer_cnic,
                    Transaction.status.in_(AMLService._VELOCITY_STATUSES),
                    Transaction.created_at >= today_start,
                    Transaction.id != exclude_txn_id,
                )
            )
            .scalar()
            or 0
        )

    @staticmethod
    def _sum_daily_amount(
        db: Session, customer_cnic: str, exclude_txn_id
    ) -> Decimal:
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        result = (
            db.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(
                and_(
                    Transaction.customer_cnic == customer_cnic,
                    Transaction.status.in_(AMLService._VELOCITY_STATUSES),
                    Transaction.created_at >= today_start,
                    Transaction.id != exclude_txn_id,
                )
            )
            .scalar()
        )
        return Decimal(str(result))

    @staticmethod
    def _sum_monthly_amount(
        db: Session, customer_cnic: str, exclude_txn_id
    ) -> Decimal:
        now = datetime.now(timezone.utc)
        month_start = now.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        result = (
            db.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(
                and_(
                    Transaction.customer_cnic == customer_cnic,
                    Transaction.status.in_(AMLService._VELOCITY_STATUSES),
                    Transaction.created_at >= month_start,
                    Transaction.id != exclude_txn_id,
                )
            )
            .scalar()
        )
        return Decimal(str(result))

    # ------------------------------------------------------------------ #
    # Persist & audit                                                       #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _persist_to_transaction(
        db: Session, transaction: Transaction, result: AMLCheckResult
    ) -> None:
        try:
            transaction.fraud_score = result.fraud_score
            transaction.fraud_flags = {
                "flags": result.fraud_flags,
                "risk_level": result.risk_level,
                "details": result.check_details,
                "checked_at": result.checked_at.isoformat(),
            }
            transaction.is_suspicious = result.is_suspicious
            db.commit()
            db.refresh(transaction)
        except Exception as exc:
            logger.error(f"Failed to persist AML results to transaction: {exc}")
            db.rollback()

    @staticmethod
    def _write_audit_log(
        db: Session,
        transaction: Transaction,
        customer: Optional[Customer],
        result: AMLCheckResult,
    ) -> None:
        try:
            if result.is_suspicious:
                action = "AML_SUSPICIOUS_TRANSACTION"
            elif result.requires_ctr:
                action = "AML_CTR_REQUIRED"
            else:
                action = "AML_CHECK_COMPLETED"

            severity = Severity.WARNING if result.needs_review else Severity.INFO

            audit = AuditLog(
                user_id=None,
                action=action,
                entity_type="TRANSACTION",
                entity_id=str(transaction.reference_number),
                new_data={
                    "transaction_id": str(transaction.id),
                    "customer_cnic": transaction.customer_cnic,
                    "amount": float(transaction.amount),
                    "fraud_score": result.fraud_score,
                    "fraud_flags": result.fraud_flags,
                    "is_suspicious": result.is_suspicious,
                    "requires_ctr": result.requires_ctr,
                    "risk_level": result.risk_level,
                    "check_details": result.check_details,
                },
                severity=severity,
                success=True,
            )
            db.add(audit)
            db.commit()
        except Exception as exc:
            logger.error(f"Failed to write AML audit log: {exc}")

    # ------------------------------------------------------------------ #
    # Helpers                                                               #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _risk_level(score: float) -> str:
        if score >= 1.0:
            return "CRITICAL"
        elif score >= 0.75:
            return "HIGH"
        elif score >= 0.40:
            return "MEDIUM"
        return "LOW"
