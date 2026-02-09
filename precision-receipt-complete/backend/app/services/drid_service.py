# app/services/drid_service.py
"""
DRID (Digital Reference ID) Service
Handles generation, validation, and lifecycle management of Digital Deposit Slips
"""
from datetime import datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from decimal import Decimal
import uuid
import hashlib
import json

from app.models import (
    DigitalDepositSlip, Customer, Account, Branch, Transaction, Receipt,
    DepositSlipStatus, TransactionType, TransactionCategory, TransactionStatus,
    Channel, ReceiptType
)
from app.services.qr_service import QRService
from app.services.receipt_service import ReceiptService
from app.schemas.deposit_slip import DRIDValidationResult


class DRIDService:
    """Service for managing Digital Reference IDs and Deposit Slips"""

    # Default validity period in minutes
    DEFAULT_VALIDITY_MINUTES = 60

    # DRID format: DRID-YYYYMMDD-XXXXXX (6 char unique suffix)
    DRID_PREFIX = "DRID"

    @staticmethod
    def generate_drid() -> str:
        """Generate a unique Digital Reference ID"""
        date_part = datetime.utcnow().strftime("%Y%m%d")
        unique_part = str(uuid.uuid4())[:6].upper()
        return f"{DRIDService.DRID_PREFIX}-{date_part}-{unique_part}"

    @staticmethod
    def generate_qr_code_for_drid(drid: str, amount: Decimal, customer_name: str) -> str:
        """Generate QR code data for branch retrieval"""
        qr_data = {
            "type": "DRID",
            "drid": drid,
            "amount": str(amount),
            "customer": customer_name,
            "generated_at": datetime.utcnow().isoformat(),
        }
        return QRService.generate_qr_code_base64(qr_data)

    @staticmethod
    def create_deposit_slip(
        db: Session,
        transaction_type: str,
        customer_cnic: str,
        customer_account: str,
        amount: Decimal,
        currency: str = "PKR",
        narration: Optional[str] = None,
        depositor_name: Optional[str] = None,
        depositor_cnic: Optional[str] = None,
        depositor_phone: Optional[str] = None,
        depositor_relationship: Optional[str] = "SELF",
        channel: str = "WEB",
        device_info: Optional[dict] = None,
        ip_address: Optional[str] = None,
        validity_minutes: int = None,
        additional_data: Optional[dict] = None
    ) -> Tuple[Optional[DigitalDepositSlip], Optional[str]]:
        """
        Create a new Digital Deposit Slip with DRID

        Returns:
            Tuple of (DigitalDepositSlip, error_message)
        """
        validity = validity_minutes or DRIDService.DEFAULT_VALIDITY_MINUTES

        # Validate customer exists
        customer = db.query(Customer).filter(Customer.cnic == customer_cnic).first()
        if not customer:
            return None, f"Customer with CNIC {customer_cnic} not found"

        # Validate account exists
        account = db.query(Account).filter(Account.account_number == customer_account).first()
        if not account:
            return None, f"Account {customer_account} not found"

        # Verify account belongs to customer
        if account.customer_id != customer.id:
            return None, "Account does not belong to the specified customer"

        # Check for existing active deposit slip for same customer/account
        existing = db.query(DigitalDepositSlip).filter(
            DigitalDepositSlip.customer_cnic == customer_cnic,
            DigitalDepositSlip.customer_account == customer_account,
            DigitalDepositSlip.status.in_([DepositSlipStatus.INITIATED, DepositSlipStatus.RETRIEVED, DepositSlipStatus.VERIFIED]),
            DigitalDepositSlip.expires_at > datetime.utcnow()
        ).first()

        if existing:
            # Return special error code that can be handled by caller
            return None, f"EXISTING_SLIP:{existing.drid}"

        # Generate unique DRID
        drid = DRIDService.generate_drid()

        # Ensure DRID is unique
        while db.query(DigitalDepositSlip).filter(DigitalDepositSlip.drid == drid).first():
            drid = DRIDService.generate_drid()

        # Calculate expiry
        expires_at = datetime.utcnow() + timedelta(minutes=validity)

        # Generate QR code
        qr_code_data = DRIDService.generate_qr_code_for_drid(drid, amount, customer.full_name)

        # Create deposit slip
        deposit_slip = DigitalDepositSlip(
            drid=drid,
            status=DepositSlipStatus.INITIATED,
            expires_at=expires_at,
            validity_minutes=validity,
            transaction_type=TransactionType[transaction_type],
            customer_cnic=customer_cnic,
            customer_account=customer_account,
            amount=amount,
            currency=currency,
            narration=narration,
            depositor_name=depositor_name or customer.full_name,
            depositor_cnic=depositor_cnic,
            depositor_phone=depositor_phone or customer.phone,
            depositor_relationship=depositor_relationship,
            channel=Channel[channel],
            device_info=device_info,
            ip_address=ip_address,
            customer_id=customer.id,
            customer_name=customer.full_name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            account_id=account.id,
            branch_id=account.branch_id,
            qr_code_data=qr_code_data,
            extra_data=additional_data  # Store type-specific data (cheque, bill payment, etc.)
        )

        db.add(deposit_slip)
        db.commit()
        db.refresh(deposit_slip)

        return deposit_slip, None

    @staticmethod
    def validate_drid(db: Session, drid: str) -> DRIDValidationResult:
        """
        Validate a DRID for use

        Checks:
        1. DRID exists
        2. DRID is not expired
        3. DRID is not already used/completed
        4. DRID is not cancelled
        """
        slip = db.query(DigitalDepositSlip).filter(DigitalDepositSlip.drid == drid).first()

        if not slip:
            return DRIDValidationResult(
                is_valid=False,
                is_expired=False,
                is_used=False,
                is_cancelled=False,
                status="NOT_FOUND",
                message="DRID not found"
            )

        # Update validation tracking
        slip.validation_attempts += 1
        slip.last_validation_at = datetime.utcnow()
        db.commit()

        now = datetime.utcnow()
        is_expired = now > slip.expires_at
        time_remaining = max(0, int((slip.expires_at - now).total_seconds())) if not is_expired else 0

        # Check if expired
        if is_expired and slip.status == DepositSlipStatus.INITIATED:
            slip.status = DepositSlipStatus.EXPIRED
            db.commit()
            return DRIDValidationResult(
                is_valid=False,
                is_expired=True,
                is_used=False,
                is_cancelled=False,
                status=DepositSlipStatus.EXPIRED.value,
                message="DRID has expired",
                time_remaining_seconds=0
            )

        # Check if already used/completed
        if slip.status in [DepositSlipStatus.COMPLETED, DepositSlipStatus.PROCESSING]:
            return DRIDValidationResult(
                is_valid=False,
                is_expired=False,
                is_used=True,
                is_cancelled=False,
                status=slip.status.value,
                message="DRID has already been used",
                time_remaining_seconds=time_remaining
            )

        # Check if cancelled
        if slip.status in [DepositSlipStatus.CANCELLED, DepositSlipStatus.REJECTED]:
            return DRIDValidationResult(
                is_valid=False,
                is_expired=False,
                is_used=False,
                is_cancelled=True,
                status=slip.status.value,
                message=f"DRID has been {slip.status.value.lower()}",
                time_remaining_seconds=time_remaining
            )

        # Valid DRID
        return DRIDValidationResult(
            is_valid=True,
            is_expired=False,
            is_used=False,
            is_cancelled=False,
            status=slip.status.value,
            message="DRID is valid",
            time_remaining_seconds=time_remaining
        )

    @staticmethod
    def retrieve_deposit_slip(
        db: Session,
        drid: str,
        teller_id: str
    ) -> Tuple[Optional[DigitalDepositSlip], Optional[str]]:
        """
        Teller retrieves deposit slip by DRID

        - Validates DRID
        - Marks as RETRIEVED
        - Records teller info
        """
        # Validate DRID first
        validation = DRIDService.validate_drid(db, drid)

        if not validation.is_valid:
            return None, validation.message

        slip = db.query(DigitalDepositSlip).filter(DigitalDepositSlip.drid == drid).first()

        # Allow retrieval if status is INITIATED, RETRIEVED, or VERIFIED (in-progress states)
        if slip.status not in [DepositSlipStatus.INITIATED, DepositSlipStatus.RETRIEVED, DepositSlipStatus.VERIFIED]:
            return None, f"Cannot retrieve: current status is {slip.status.value}"

        # Mark as retrieved (only if INITIATED)
        if slip.status == DepositSlipStatus.INITIATED:
            slip.status = DepositSlipStatus.RETRIEVED
            slip.retrieved_at = datetime.utcnow()
            slip.retrieved_by = teller_id

        db.commit()
        db.refresh(slip)

        return slip, None

    @staticmethod
    def verify_deposit_slip(
        db: Session,
        drid: str,
        teller_id: str,
        amount_confirmed: bool,
        depositor_verified: bool,
        instrument_verified: Optional[bool] = None,
        notes: Optional[str] = None
    ) -> Tuple[Optional[DigitalDepositSlip], Optional[str]]:
        """
        Teller verifies deposit slip details

        - Confirms amount
        - Verifies depositor identity
        - Verifies instrument (for cheque/pay order)
        """
        slip = db.query(DigitalDepositSlip).filter(DigitalDepositSlip.drid == drid).first()

        if not slip:
            return None, "DRID not found"

        # Must be in RETRIEVED status
        if slip.status != DepositSlipStatus.RETRIEVED:
            return None, f"Cannot verify: current status is {slip.status.value}"

        # Check if expired
        if datetime.utcnow() > slip.expires_at:
            slip.status = DepositSlipStatus.EXPIRED
            db.commit()
            return None, "DRID has expired"

        # Validation checks
        if not amount_confirmed:
            return None, "Amount must be confirmed"

        if not depositor_verified:
            return None, "Depositor identity must be verified"

        # For cheque/pay order, instrument must be verified
        if slip.transaction_type in [TransactionType.CHEQUE_DEPOSIT, TransactionType.PAY_ORDER]:
            if instrument_verified is None or not instrument_verified:
                return None, "Instrument must be verified for cheque/pay order transactions"

        # Mark as verified
        slip.status = DepositSlipStatus.VERIFIED
        slip.verified_at = datetime.utcnow()
        slip.verified_by = teller_id

        db.commit()
        db.refresh(slip)

        return slip, None

    @staticmethod
    def complete_deposit_slip(
        db: Session,
        drid: str,
        teller_id: str,
        authorization_captured: bool,
        teller_notes: Optional[str] = None
    ) -> Tuple[Optional[DigitalDepositSlip], Optional[Transaction], Optional[str]]:
        """
        Complete deposit slip and create actual transaction

        - Creates Transaction record
        - Creates Receipt
        - Links to deposit slip
        - Marks as COMPLETED
        """
        slip = db.query(DigitalDepositSlip).filter(DigitalDepositSlip.drid == drid).first()

        if not slip:
            return None, None, "DRID not found"

        # Must be in VERIFIED status
        if slip.status != DepositSlipStatus.VERIFIED:
            return None, None, f"Cannot complete: current status is {slip.status.value}"

        # Check if expired
        if datetime.utcnow() > slip.expires_at:
            slip.status = DepositSlipStatus.EXPIRED
            db.commit()
            return None, None, "DRID has expired"

        if not authorization_captured:
            return None, None, "Customer authorization must be captured"

        # Mark as processing
        slip.status = DepositSlipStatus.PROCESSING
        db.commit()

        try:
            # Generate transaction reference
            ref_number = f"TXN-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

            # Determine transaction category
            category_map = {
                TransactionType.CASH_DEPOSIT: TransactionCategory.DEPOSIT,
                TransactionType.CHEQUE_DEPOSIT: TransactionCategory.DEPOSIT,
                TransactionType.PAY_ORDER: TransactionCategory.PAYMENT,
                TransactionType.BILL_PAYMENT: TransactionCategory.PAYMENT,
                TransactionType.FUND_TRANSFER: TransactionCategory.TRANSFER
            }
            category = category_map.get(slip.transaction_type, TransactionCategory.DEPOSIT)

            # Create transaction
            transaction = Transaction(
                reference_number=ref_number,
                transaction_type=slip.transaction_type,
                transaction_category=category,
                customer_id=slip.customer_id,
                customer_cnic=slip.customer_cnic,
                customer_name=slip.customer_name,
                customer_account=slip.customer_account,
                depositor_cnic=slip.depositor_cnic,
                depositor_name=slip.depositor_name,
                depositor_phone=slip.depositor_phone,
                amount=slip.amount,
                currency=slip.currency,
                exchange_rate=Decimal("1.0"),
                amount_in_base_currency=slip.amount,
                fee=Decimal("0"),
                tax=Decimal("0"),
                total_amount=slip.amount,
                status=TransactionStatus.COMPLETED,
                channel=slip.channel,
                narration=slip.narration or f"Deposit via DRID: {drid}",
                branch_id=slip.branch_id,
                processed_by=teller_id,
                completed_at=datetime.utcnow(),
                extra_data=slip.extra_data  # Copy type-specific data (cheque, bill payment, etc.)
            )

            db.add(transaction)
            db.commit()
            db.refresh(transaction)

            # Create receipt
            ReceiptService.create_receipt(db, transaction, "DIGITAL")

            # Update deposit slip
            slip.status = DepositSlipStatus.COMPLETED
            slip.completed_at = datetime.utcnow()
            slip.completed_by = teller_id
            slip.transaction_id = transaction.id

            db.commit()
            db.refresh(slip)

            return slip, transaction, None

        except Exception as e:
            # Rollback on error
            slip.status = DepositSlipStatus.VERIFIED  # Revert to verified
            db.commit()
            return None, None, f"Error creating transaction: {str(e)}"

    @staticmethod
    def cancel_deposit_slip(
        db: Session,
        drid: str,
        cancelled_by: Optional[str],
        reason: str
    ) -> Tuple[Optional[DigitalDepositSlip], Optional[str]]:
        """Cancel a deposit slip"""
        slip = db.query(DigitalDepositSlip).filter(DigitalDepositSlip.drid == drid).first()

        if not slip:
            return None, "DRID not found"

        # Cannot cancel if already completed or expired
        if slip.status in [DepositSlipStatus.COMPLETED, DepositSlipStatus.EXPIRED]:
            return None, f"Cannot cancel: current status is {slip.status.value}"

        slip.status = DepositSlipStatus.CANCELLED
        slip.cancelled_at = datetime.utcnow()
        # cancelled_by can be a UUID (user) or None (customer cancellation)
        if cancelled_by and cancelled_by != "CUSTOMER":
            try:
                slip.cancelled_by = cancelled_by
            except:
                slip.cancelled_by = None
        else:
            slip.cancelled_by = None
        slip.cancellation_reason = reason

        db.commit()
        db.refresh(slip)

        return slip, None

    @staticmethod
    def get_deposit_slip_by_drid(db: Session, drid: str) -> Optional[DigitalDepositSlip]:
        """Get deposit slip by DRID"""
        return db.query(DigitalDepositSlip).filter(DigitalDepositSlip.drid == drid).first()

    @staticmethod
    def get_customer_active_slips(db: Session, customer_cnic: str) -> list:
        """Get all active deposit slips for a customer"""
        return db.query(DigitalDepositSlip).filter(
            DigitalDepositSlip.customer_cnic == customer_cnic,
            DigitalDepositSlip.status.in_([
                DepositSlipStatus.INITIATED,
                DepositSlipStatus.RETRIEVED,
                DepositSlipStatus.VERIFIED
            ]),
            DigitalDepositSlip.expires_at > datetime.utcnow()
        ).all()

    @staticmethod
    def expire_old_slips(db: Session) -> int:
        """
        Background job to expire old deposit slips
        Returns count of expired slips
        """
        expired = db.query(DigitalDepositSlip).filter(
            DigitalDepositSlip.status == DepositSlipStatus.INITIATED,
            DigitalDepositSlip.expires_at < datetime.utcnow()
        ).all()

        count = 0
        for slip in expired:
            slip.status = DepositSlipStatus.EXPIRED
            count += 1

        if count > 0:
            db.commit()

        return count
