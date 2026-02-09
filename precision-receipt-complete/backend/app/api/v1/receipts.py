# app/api/v1/receipts.py
"""
Receipt API Endpoints - Full Implementation with QR Codes and Notifications
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr
import uuid
import base64

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models import Receipt, Transaction, User, ReceiptType, Customer
from app.services.receipt_service import ReceiptService
from app.services.qr_service import QRService
from app.services.notification_service import NotificationService
from app.services.signature_service import SignatureService
from app.schemas.receipt import (
    ReceiptResponse, ReceiptDetailResponse,
    ReceiptVerifyRequest, ReceiptVerifyResponse,
    SignatureVerifyRequest, SignatureVerifyResponse, PublicKeyResponse
)


class SendReceiptRequest(BaseModel):
    """Request model for sending receipt to WhatsApp or Email"""
    channel: str  # 'whatsapp' or 'email'
    recipient: str  # Phone number or email address


class SendReceiptResponse(BaseModel):
    """Response model for send receipt"""
    success: bool
    message: str
    channel: str
    recipient: str

router = APIRouter()


# ============================================
# DIGITAL SIGNATURE ENDPOINTS (Must be before parameterized routes)
# (SBP Compliance - Non-repudiation)
# ============================================

@router.get("/signature/public-key", response_model=PublicKeyResponse)
async def get_signing_public_key():
    """
    Get the bank's public key for external signature verification

    External systems can use this public key to independently verify
    receipt signatures without calling the bank's API.

    The key is in PEM format and uses RSA-2048 with SHA-256.
    """
    public_key_pem = SignatureService.get_public_key_pem()

    if not public_key_pem:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Signature service not available"
        )

    return PublicKeyResponse(
        public_key_pem=public_key_pem,
        algorithm="RSA-2048 with SHA-256 (PKCS1v15 padding)",
        issuer="Meezan Bank - Precision Receipt System",
        key_id="MBL-RECEIPT-SIGNING-KEY-001"
    )


@router.get("/signature/info")
async def get_signature_info():
    """
    Get information about the digital signature configuration

    Returns details about the signing algorithm, compliance standards,
    and service status.
    """
    info = SignatureService.get_signature_info()
    return {
        "success": True,
        **info
    }


@router.post("/verify-signature", response_model=SignatureVerifyResponse)
async def verify_receipt_signature_endpoint(
    request: SignatureVerifyRequest,
    db: Session = Depends(get_db)
):
    """
    Verify the digital signature of a receipt (Public Endpoint)

    This endpoint verifies the cryptographic signature on a receipt to ensure:
    - The receipt was issued by Meezan Bank
    - The receipt data has not been tampered with
    - Non-repudiation for SBP compliance

    No authentication required - this is a public verification service.
    """
    is_valid, message, receipt = ReceiptService.verify_receipt_signature(
        db=db,
        receipt_number=request.receipt_number
    )

    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=message
        )

    # Get transaction for signed fields display
    transaction = db.query(Transaction).filter(
        Transaction.id == receipt.transaction_id
    ).first()

    signed_fields = None
    if transaction:
        signed_fields = {
            "receipt_number": receipt.receipt_number,
            "reference_number": transaction.reference_number,
            "amount": str(transaction.amount),
            "currency": transaction.currency,
            "customer_name": transaction.customer_name,
            "customer_account": transaction.customer_account[-4:].rjust(len(transaction.customer_account), '*'),
            "transaction_type": transaction.transaction_type.value if transaction.transaction_type else None,
            "transaction_date": transaction.created_at.isoformat() if transaction.created_at else None
        }

    return SignatureVerifyResponse(
        success=True,
        is_authentic=is_valid,
        message=message,
        receipt_number=receipt.receipt_number,
        signature_algorithm=receipt.signature_algorithm,
        signature_timestamp=receipt.signature_timestamp,
        signed_fields=signed_fields,
        issuer="Meezan Bank - Precision Receipt System"
    )


# ============================================
# RECEIPT CRUD ENDPOINTS
# ============================================

@router.get("/{transaction_id}", response_model=ReceiptDetailResponse)
async def get_receipt(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get receipt for a transaction (creates one if doesn't exist)"""

    # Get or create receipt
    receipt, error = ReceiptService.get_or_create_receipt(db, transaction_id)

    if error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error
        )

    # Get detailed receipt
    receipt_detail = ReceiptService.get_receipt_detail(db, str(receipt.id))

    if not receipt_detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt details not found"
        )

    return receipt_detail


@router.get("/by-number/{receipt_number}", response_model=ReceiptDetailResponse)
async def get_receipt_by_number(
    receipt_number: str,
    db: Session = Depends(get_db)
):
    """Get receipt by receipt number (public endpoint for verification)"""

    receipt = db.query(Receipt).filter(Receipt.receipt_number == receipt_number).first()

    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )

    receipt_detail = ReceiptService.get_receipt_detail(db, str(receipt.id))

    if not receipt_detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt details not found"
        )

    return receipt_detail


@router.post("/{transaction_id}/verify", response_model=ReceiptVerifyResponse)
async def verify_receipt(
    transaction_id: str,
    db: Session = Depends(get_db)
):
    """Verify a receipt and increment verification count"""

    # Get receipt
    receipt = db.query(Receipt).filter(Receipt.transaction_id == transaction_id).first()

    if not receipt:
        return ReceiptVerifyResponse(
            success=False,
            is_valid=False,
            message="Receipt not found",
            receipt=None,
            verified_count=0
        )

    # Update verification
    receipt.is_verified = True
    receipt.verified_count += 1
    receipt.last_verified_at = datetime.utcnow()
    db.commit()
    db.refresh(receipt)

    # Get detailed receipt
    receipt_detail = ReceiptService.get_receipt_detail(db, str(receipt.id))

    return ReceiptVerifyResponse(
        success=True,
        is_valid=True,
        message="Receipt verified successfully",
        receipt=receipt_detail,
        verified_count=receipt.verified_count
    )


@router.post("/verify-by-number", response_model=ReceiptVerifyResponse)
async def verify_receipt_by_number(
    request: ReceiptVerifyRequest,
    db: Session = Depends(get_db)
):
    """Verify a receipt by receipt number (public endpoint)"""

    receipt, is_valid, message = ReceiptService.verify_receipt(
        db=db,
        receipt_number=request.receipt_number
    )

    if not is_valid:
        return ReceiptVerifyResponse(
            success=False,
            is_valid=False,
            message=message,
            receipt=None,
            verified_count=0
        )

    # Get detailed receipt
    receipt_detail = ReceiptService.get_receipt_detail(db, str(receipt.id))

    return ReceiptVerifyResponse(
        success=True,
        is_valid=True,
        message=message,
        receipt=receipt_detail,
        verified_count=receipt.verified_count
    )


@router.get("/{transaction_id}/qr-code")
async def get_receipt_qr_code(
    transaction_id: str,
    format: str = "base64",  # base64 or svg
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get QR code for a receipt"""

    # Get receipt
    receipt, error = ReceiptService.get_or_create_receipt(db, transaction_id)

    if error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error
        )

    # Get transaction for QR data
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    # Generate QR data
    qr_data = QRService.generate_qr_data(
        receipt_number=receipt.receipt_number,
        reference_number=transaction.reference_number,
        amount=transaction.amount,
        currency=transaction.currency,
        customer_name=transaction.customer_name,
        transaction_date=transaction.created_at
    )

    # Generate QR code in requested format
    if format == "svg":
        qr_code = QRService.generate_qr_code_svg(qr_data)
        content_type = "image/svg+xml"
    else:
        qr_code = QRService.generate_qr_code_base64(qr_data)
        content_type = "text/plain"

    return {
        "success": True,
        "receipt_number": receipt.receipt_number,
        "verification_url": receipt.verification_url,
        "qr_code": qr_code,
        "qr_data": qr_data,
        "format": format
    }


@router.get("/qr-image/{receipt_number}.png")
async def get_receipt_qr_image(
    receipt_number: str,
    db: Session = Depends(get_db)
):
    """
    Public endpoint to get QR code as PNG image.
    Used for WhatsApp media attachments.
    No authentication required.
    """
    # Get receipt by number
    receipt = db.query(Receipt).filter(Receipt.receipt_number == receipt_number).first()

    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )

    # Get transaction
    transaction = db.query(Transaction).filter(Transaction.id == receipt.transaction_id).first()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    # Generate QR data
    qr_data = QRService.generate_qr_data(
        receipt_number=receipt.receipt_number,
        reference_number=transaction.reference_number,
        amount=transaction.amount,
        currency=transaction.currency,
        customer_name=transaction.customer_name,
        transaction_date=transaction.created_at
    )

    # Generate QR code as base64
    qr_base64 = QRService.generate_qr_code_base64(qr_data)

    # Remove data URL prefix if present
    if qr_base64.startswith('data:image/png;base64,'):
        qr_base64 = qr_base64.replace('data:image/png;base64,', '')

    # Decode base64 to bytes
    qr_bytes = base64.b64decode(qr_base64)

    return Response(content=qr_bytes, media_type="image/png")


@router.get("/{transaction_id}/download")
async def download_receipt(
    transaction_id: str,
    format: str = "json",  # json, html
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download receipt in specified format"""

    receipt_detail = ReceiptService.get_receipt_detail(db, transaction_id)

    if not receipt_detail:
        # Try to get/create receipt first
        receipt, error = ReceiptService.get_or_create_receipt(db, transaction_id)
        if error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error
            )
        receipt_detail = ReceiptService.get_receipt_detail(db, str(receipt.id))

    if format == "html":
        # Generate HTML receipt
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Receipt - {receipt_detail.receipt_number}</title>
            <style>
                body {{ font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ text-align: center; border-bottom: 2px solid #0B1F3B; padding-bottom: 20px; }}
                .logo {{ color: #0B1F3B; font-size: 24px; font-weight: bold; }}
                .details {{ margin: 20px 0; }}
                .row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }}
                .label {{ color: #666; }}
                .value {{ font-weight: bold; }}
                .amount {{ font-size: 24px; color: #0B1F3B; text-align: center; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 12px; }}
                .verify {{ background: #00A7FF; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo">MEEZAN BANK</div>
                <div>Digital Transaction Receipt</div>
            </div>

            <div class="amount">
                {receipt_detail.currency} {receipt_detail.amount:,.2f}
            </div>

            <div class="details">
                <div class="row">
                    <span class="label">Receipt Number</span>
                    <span class="value">{receipt_detail.receipt_number}</span>
                </div>
                <div class="row">
                    <span class="label">Reference Number</span>
                    <span class="value">{receipt_detail.reference_number}</span>
                </div>
                <div class="row">
                    <span class="label">Transaction Type</span>
                    <span class="value">{receipt_detail.transaction_type.replace('_', ' ').title()}</span>
                </div>
                <div class="row">
                    <span class="label">Customer Name</span>
                    <span class="value">{receipt_detail.customer_name}</span>
                </div>
                <div class="row">
                    <span class="label">Account Number</span>
                    <span class="value">{receipt_detail.customer_account}</span>
                </div>
                <div class="row">
                    <span class="label">Date & Time</span>
                    <span class="value">{receipt_detail.transaction_date.strftime('%Y-%m-%d %H:%M:%S')}</span>
                </div>
                <div class="row">
                    <span class="label">Status</span>
                    <span class="value">{receipt_detail.transaction_status}</span>
                </div>
            </div>

            <div style="text-align: center;">
                <a href="{receipt_detail.verification_url}" class="verify">Verify Receipt</a>
            </div>

            <div class="footer">
                <p>This is a digitally generated receipt.</p>
                <p>Verification URL: {receipt_detail.verification_url}</p>
                <p>Thank you for banking with Meezan Bank</p>
            </div>
        </body>
        </html>
        """
        return {
            "success": True,
            "format": "html",
            "content": html_content,
            "filename": f"receipt_{receipt_detail.receipt_number}.html"
        }

    # Default JSON format
    return {
        "success": True,
        "format": "json",
        "receipt": receipt_detail.model_dump()
    }


@router.post("/{transaction_id}/send", response_model=SendReceiptResponse)
async def send_receipt(
    transaction_id: str,
    request: SendReceiptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send receipt to customer via WhatsApp or Email

    - **channel**: 'whatsapp' or 'email'
    - **recipient**: Phone number (for WhatsApp) or email address (for email)
    """

    # Validate channel
    channel = request.channel.lower()
    if channel not in ['whatsapp', 'email', 'sms']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid channel. Must be 'whatsapp', 'email', or 'sms'"
        )

    # Get transaction
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    # Get or create receipt
    receipt, error = ReceiptService.get_or_create_receipt(db, transaction_id)
    if error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error
        )

    # Send notification
    success, message = await NotificationService.send_receipt_to_channel(
        db=db,
        transaction=transaction,
        receipt=receipt,
        channel=channel,
        recipient=request.recipient
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message
        )

    return SendReceiptResponse(
        success=True,
        message=message,
        channel=channel,
        recipient=request.recipient
    )


@router.post("/{transaction_id}/send-all")
async def send_receipt_to_customer(
    transaction_id: str,
    send_whatsapp: bool = True,
    send_email: bool = True,
    send_sms: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send receipt to customer's registered WhatsApp and Email

    Uses customer's registered phone and email from their profile.
    """

    # Get transaction
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    # Get customer
    customer = db.query(Customer).filter(Customer.id == transaction.customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    # Get or create receipt
    receipt, error = ReceiptService.get_or_create_receipt(db, transaction_id)
    if error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error
        )

    # Send notifications
    notifications = await NotificationService.send_transaction_notifications(
        db=db,
        transaction=transaction,
        receipt=receipt,
        customer=customer,
        send_whatsapp=send_whatsapp,
        send_sms=send_sms,
        send_email=send_email
    )

    # Prepare response
    results = []
    for notif in notifications:
        results.append({
            "channel": notif.channel.value,
            "recipient": notif.recipient,
            "status": notif.status.value,
            "sent_at": notif.sent_at.isoformat() if notif.sent_at else None
        })

    return {
        "success": True,
        "message": f"Receipt sent via {len(notifications)} channel(s)",
        "notifications": results,
        "receipt_number": receipt.receipt_number
    }


@router.get("/{transaction_id}/notification-status")
async def get_receipt_notification_status(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get notification delivery status for a receipt"""

    # Verify transaction exists
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    # Get notification status
    notifications = NotificationService.get_notification_status(db, transaction_id)

    return {
        "success": True,
        "transaction_id": transaction_id,
        "reference_number": transaction.reference_number,
        "notifications": notifications
    }
