# app/schemas/receipt.py
"""
Receipt-related Pydantic schemas
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from decimal import Decimal


class ReceiptBase(BaseModel):
    """Base receipt schema"""
    transaction_id: str
    receipt_type: str = "DIGITAL"


class ReceiptCreate(ReceiptBase):
    """Schema for creating a receipt"""
    pass


class ReceiptResponse(BaseModel):
    """Receipt response schema"""
    id: str
    transaction_id: str
    receipt_number: str
    receipt_type: str
    pdf_url: Optional[str] = None
    image_url: Optional[str] = None
    verification_url: Optional[str] = None
    verification_qr_data: Optional[str] = None
    is_verified: bool
    verified_count: int
    last_verified_at: Optional[datetime] = None
    created_at: datetime
    # Digital signature fields
    digital_signature: Optional[str] = None
    signature_hash: Optional[str] = None
    signature_timestamp: Optional[datetime] = None
    signature_algorithm: Optional[str] = None
    is_signature_valid: Optional[bool] = None

    class Config:
        from_attributes = True


class ReceiptDetailResponse(ReceiptResponse):
    """Detailed receipt with transaction info"""
    # Transaction details
    reference_number: str
    transaction_type: str
    customer_name: str
    customer_cnic: str
    customer_account: str
    amount: Decimal
    currency: str
    fee: Decimal
    tax: Decimal
    total_amount: Decimal
    transaction_status: str
    transaction_date: datetime
    branch_name: Optional[str] = None
    depositor_name: Optional[str] = None
    depositor_cnic: Optional[str] = None
    narration: Optional[str] = None
    # Type-specific extra data (cheque details, bill payment info, etc.)
    extra_data: Optional[Dict[str, Any]] = None


class ReceiptVerifyRequest(BaseModel):
    """Receipt verification request"""
    receipt_number: str


class ReceiptVerifyResponse(BaseModel):
    """Receipt verification response"""
    success: bool
    is_valid: bool
    message: str
    receipt: Optional[ReceiptDetailResponse] = None
    verified_count: int = 0
    # Digital signature verification
    signature_valid: Optional[bool] = None
    signature_message: Optional[str] = None
    signature_timestamp: Optional[datetime] = None


class SignatureVerifyRequest(BaseModel):
    """Request to verify receipt digital signature"""
    receipt_number: str


class SignatureVerifyResponse(BaseModel):
    """Digital signature verification response"""
    success: bool
    is_authentic: bool
    message: str
    receipt_number: str
    signature_algorithm: Optional[str] = None
    signature_timestamp: Optional[datetime] = None
    signed_fields: Optional[Dict[str, Any]] = None
    issuer: str = "Meezan Bank - Precision Receipt System"


class PublicKeyResponse(BaseModel):
    """Public key for external verification"""
    public_key_pem: str
    algorithm: str
    issuer: str
    key_id: Optional[str] = None


class QRCodeData(BaseModel):
    """QR code data structure"""
    receipt_number: str
    reference_number: str
    amount: Decimal
    currency: str
    customer_name: str
    transaction_date: str
    verification_url: str
    hash: str
