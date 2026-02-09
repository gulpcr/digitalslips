# app/services/receipt_service.py
"""
Receipt Service - Generates and manages digital receipts
With digital signature support for SBP compliance
"""
from datetime import datetime
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from decimal import Decimal
import uuid
import logging

from app.models import Receipt, Transaction, Branch, ReceiptType
from app.services.qr_service import QRService
from app.services.signature_service import SignatureService
from app.schemas.receipt import ReceiptResponse, ReceiptDetailResponse

logger = logging.getLogger(__name__)


class ReceiptService:
    """Receipt generation and management service"""

    @staticmethod
    def generate_receipt_number() -> str:
        """Generate a unique receipt number"""
        date_part = datetime.now().strftime('%Y%m%d')
        unique_part = str(uuid.uuid4())[:8].upper()
        return f"RCP-{date_part}-{unique_part}"

    @staticmethod
    def create_receipt(
        db: Session,
        transaction: Transaction,
        receipt_type: str = "DIGITAL"
    ) -> Receipt:
        """Create a new receipt for a transaction with digital signature"""
        # Generate receipt number
        receipt_number = ReceiptService.generate_receipt_number()

        # Generate QR code data
        qr_data = QRService.generate_qr_data(
            receipt_number=receipt_number,
            reference_number=transaction.reference_number,
            amount=transaction.amount,
            currency=transaction.currency,
            customer_name=transaction.customer_name,
            transaction_date=transaction.created_at
        )

        # Generate QR code image
        qr_code_base64 = QRService.generate_qr_code_base64(qr_data)

        # Build verification URL
        verification_url = qr_data.get('url', '')

        # Prepare receipt data for signing
        receipt_data = {
            'receipt_number': receipt_number,
            'reference_number': transaction.reference_number,
            'amount': str(transaction.amount),
            'currency': transaction.currency,
            'customer_name': transaction.customer_name,
            'customer_account': transaction.customer_account,
            'transaction_type': transaction.transaction_type.value if transaction.transaction_type else '',
            'transaction_date': transaction.created_at.isoformat() if transaction.created_at else '',
            'branch_id': str(transaction.branch_id) if transaction.branch_id else '',
            'processed_by': str(transaction.processed_by) if transaction.processed_by else '',
        }

        # Sign the receipt
        signature, signature_hash, signature_timestamp = SignatureService.sign_receipt(receipt_data)

        # Parse timestamp for storage
        sig_timestamp_dt = None
        if signature_timestamp:
            try:
                sig_timestamp_dt = datetime.fromisoformat(signature_timestamp.replace('Z', '+00:00'))
            except:
                sig_timestamp_dt = datetime.utcnow()

        # Create receipt with digital signature
        receipt = Receipt(
            transaction_id=transaction.id,
            receipt_number=receipt_number,
            receipt_type=ReceiptType[receipt_type] if isinstance(receipt_type, str) else receipt_type,
            verification_qr_data=qr_code_base64,
            verification_url=verification_url,
            is_verified=False,
            verified_count=0,
            # Digital signature fields
            digital_signature=signature,
            signature_hash=signature_hash,
            signature_timestamp=sig_timestamp_dt,
            signature_algorithm="RSA-SHA256",
            is_signature_valid=signature is not None
        )

        db.add(receipt)
        db.commit()
        db.refresh(receipt)

        if signature:
            logger.info(f"Created signed receipt {receipt_number} for transaction {transaction.reference_number}")
        else:
            logger.warning(f"Created unsigned receipt {receipt_number} - signature service unavailable")

        return receipt

    @staticmethod
    def get_or_create_receipt(
        db: Session,
        transaction_id: str
    ) -> Tuple[Optional[Receipt], Optional[str]]:
        """Get existing receipt or create new one"""
        # Get transaction
        transaction = db.query(Transaction).filter(
            Transaction.id == transaction_id
        ).first()

        if not transaction:
            return None, "Transaction not found"

        # Check for existing receipt
        receipt = db.query(Receipt).filter(
            Receipt.transaction_id == transaction_id
        ).first()

        if receipt:
            return receipt, None

        # Create new receipt
        receipt = ReceiptService.create_receipt(db, transaction)
        return receipt, None

    @staticmethod
    def verify_receipt(
        db: Session,
        receipt_number: str
    ) -> Tuple[Optional[Receipt], bool, str]:
        """
        Verify a receipt by its number
        Returns: (receipt, is_valid, message)
        """
        receipt = db.query(Receipt).filter(
            Receipt.receipt_number == receipt_number
        ).first()

        if not receipt:
            return None, False, "Receipt not found"

        # Update verification count
        receipt.verified_count += 1
        receipt.last_verified_at = datetime.utcnow()
        receipt.is_verified = True

        db.commit()
        db.refresh(receipt)

        return receipt, True, "Receipt verified successfully"

    @staticmethod
    def get_receipt_detail(
        db: Session,
        receipt_id: str
    ) -> Optional[ReceiptDetailResponse]:
        """Get detailed receipt information including transaction details"""
        receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()

        if not receipt:
            return None

        transaction = db.query(Transaction).filter(
            Transaction.id == receipt.transaction_id
        ).first()

        if not transaction:
            return None

        # Get branch name
        branch = db.query(Branch).filter(Branch.id == transaction.branch_id).first()
        branch_name = branch.branch_name if branch else None

        return ReceiptDetailResponse(
            id=str(receipt.id),
            transaction_id=str(receipt.transaction_id),
            receipt_number=receipt.receipt_number,
            receipt_type=receipt.receipt_type.value,
            pdf_url=receipt.pdf_url,
            image_url=receipt.image_url,
            verification_url=receipt.verification_url,
            verification_qr_data=receipt.verification_qr_data,
            is_verified=receipt.is_verified,
            verified_count=receipt.verified_count,
            last_verified_at=receipt.last_verified_at,
            created_at=receipt.created_at,
            # Transaction details
            reference_number=transaction.reference_number,
            transaction_type=transaction.transaction_type.value,
            customer_name=transaction.customer_name,
            customer_cnic=transaction.customer_cnic,
            customer_account=transaction.customer_account,
            amount=transaction.amount,
            currency=transaction.currency,
            fee=transaction.fee,
            tax=transaction.tax,
            total_amount=transaction.total_amount,
            transaction_status=transaction.status.value,
            transaction_date=transaction.created_at,
            branch_name=branch_name,
            depositor_name=transaction.depositor_name,
            depositor_cnic=transaction.depositor_cnic,
            narration=transaction.narration,
            # Type-specific extra data
            extra_data=transaction.extra_data
        )

    @staticmethod
    def receipt_to_response(receipt: Receipt) -> ReceiptResponse:
        """Convert Receipt model to ReceiptResponse schema"""
        return ReceiptResponse(
            id=str(receipt.id),
            transaction_id=str(receipt.transaction_id),
            receipt_number=receipt.receipt_number,
            receipt_type=receipt.receipt_type.value,
            pdf_url=receipt.pdf_url,
            image_url=receipt.image_url,
            verification_url=receipt.verification_url,
            verification_qr_data=receipt.verification_qr_data,
            is_verified=receipt.is_verified,
            verified_count=receipt.verified_count,
            last_verified_at=receipt.last_verified_at,
            created_at=receipt.created_at,
            # Digital signature fields
            digital_signature=receipt.digital_signature,
            signature_hash=receipt.signature_hash,
            signature_timestamp=receipt.signature_timestamp,
            signature_algorithm=receipt.signature_algorithm,
            is_signature_valid=receipt.is_signature_valid
        )

    @staticmethod
    def verify_receipt_signature(
        db: Session,
        receipt_number: str
    ) -> Tuple[bool, str, Optional[Receipt]]:
        """
        Verify the digital signature of a receipt

        Returns:
            Tuple of (is_valid, message, receipt)
        """
        # Get receipt
        receipt = db.query(Receipt).filter(
            Receipt.receipt_number == receipt_number
        ).first()

        if not receipt:
            return False, "Receipt not found", None

        # Check if signature exists
        if not receipt.digital_signature:
            return False, "Receipt was not digitally signed", receipt

        # Get transaction for verification data
        transaction = db.query(Transaction).filter(
            Transaction.id == receipt.transaction_id
        ).first()

        if not transaction:
            return False, "Transaction data not found", receipt

        # Prepare receipt data for verification
        receipt_data = {
            'receipt_number': receipt.receipt_number,
            'reference_number': transaction.reference_number,
            'amount': str(transaction.amount),
            'currency': transaction.currency,
            'customer_name': transaction.customer_name,
            'customer_account': transaction.customer_account,
            'transaction_type': transaction.transaction_type.value if transaction.transaction_type else '',
            'transaction_date': transaction.created_at.isoformat() if transaction.created_at else '',
            'branch_id': str(transaction.branch_id) if transaction.branch_id else '',
            'processed_by': str(transaction.processed_by) if transaction.processed_by else '',
        }

        # Get timestamp in ISO format
        signing_timestamp = receipt.signature_timestamp.isoformat() + "Z" if receipt.signature_timestamp else None

        if not signing_timestamp:
            return False, "Signature timestamp missing", receipt

        # Verify signature
        is_valid, message = SignatureService.verify_signature(
            receipt_data,
            receipt.digital_signature,
            signing_timestamp
        )

        # Update cached validation result
        if receipt.is_signature_valid != is_valid:
            receipt.is_signature_valid = is_valid
            db.commit()

        return is_valid, message, receipt
