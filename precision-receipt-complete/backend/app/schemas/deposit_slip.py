# app/schemas/deposit_slip.py
"""
Digital Deposit Slip (DRID) Pydantic schemas
"""
from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


class DepositSlipCreate(BaseModel):
    """Schema for customer creating a deposit slip"""
    transaction_type: str
    customer_cnic: str
    customer_account: str
    amount: Decimal
    currency: str = "PKR"
    narration: Optional[str] = None

    # Depositor details (person visiting branch)
    depositor_name: Optional[str] = None
    depositor_cnic: Optional[str] = None
    depositor_phone: Optional[str] = None
    depositor_relationship: Optional[str] = "SELF"  # SELF, FAMILY, AGENT, OTHER

    # Channel info
    channel: str = "WEB"  # WEB, MOBILE, WHATSAPP, KIOSK

    # Type-specific additional data (cheque details, bill payment info, etc.)
    additional_data: Optional[Dict[str, Any]] = None

    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError('Amount must be greater than 0')
        if v > 10000000:  # 10 million PKR limit
            raise ValueError('Amount exceeds maximum limit')
        return v

    @field_validator('transaction_type')
    @classmethod
    def validate_type(cls, v):
        valid_types = ['CASH_DEPOSIT', 'CHEQUE_DEPOSIT', 'PAY_ORDER', 'BILL_PAYMENT', 'FUND_TRANSFER']
        if v not in valid_types:
            raise ValueError(f'Invalid transaction type. Must be one of: {valid_types}')
        return v

    @field_validator('customer_cnic')
    @classmethod
    def validate_cnic(cls, v):
        # Basic CNIC format validation (XXXXX-XXXXXXX-X)
        if not v or len(v) < 13:
            raise ValueError('Invalid CNIC format')
        return v


class DepositSlipResponse(BaseModel):
    """Response schema for deposit slip"""
    id: str
    drid: str
    status: str
    expires_at: datetime
    validity_minutes: int
    time_remaining_seconds: Optional[int] = None

    # Transaction details
    transaction_type: str
    customer_cnic: str
    customer_account: str
    customer_name: Optional[str] = None
    amount: Decimal
    currency: str
    narration: Optional[str] = None

    # Depositor details
    depositor_name: Optional[str] = None
    depositor_cnic: Optional[str] = None
    depositor_phone: Optional[str] = None
    depositor_relationship: Optional[str] = None

    # Channel
    channel: str

    # Branch info
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None

    # Type-specific additional data
    additional_data: Optional[Dict[str, Any]] = None

    # Timestamps
    created_at: datetime
    retrieved_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Result
    transaction_id: Optional[str] = None
    transaction_reference: Optional[str] = None

    # QR Code for branch
    qr_code_data: Optional[str] = None

    class Config:
        from_attributes = True


class DepositSlipCreateResponse(BaseModel):
    """Response when deposit slip is created"""
    success: bool
    message: str
    drid: str
    expires_at: datetime
    validity_minutes: int
    qr_code_data: Optional[str] = None
    instructions: str


class DepositSlipStatusResponse(BaseModel):
    """Response for checking DRID status"""
    success: bool
    drid: str
    status: str
    is_valid: bool
    is_expired: bool
    message: str
    time_remaining_seconds: Optional[int] = None
    can_be_used: bool


class DepositSlipRetrieveResponse(BaseModel):
    """Response when teller retrieves deposit slip"""
    success: bool
    message: str
    deposit_slip: Optional[DepositSlipResponse] = None
    validation_result: Optional[dict] = None


class DepositSlipVerifyRequest(BaseModel):
    """Request for teller verification"""
    amount_confirmed: bool
    depositor_identity_verified: bool
    instrument_verified: Optional[bool] = None  # For cheque/pay order
    notes: Optional[str] = None


class DepositSlipCompleteRequest(BaseModel):
    """Request to complete deposit slip and create transaction"""
    authorization_captured: bool
    teller_notes: Optional[str] = None


class DepositSlipCompleteResponse(BaseModel):
    """Response when deposit slip is completed"""
    success: bool
    message: str
    drid: str
    transaction_id: str
    transaction_reference: str
    receipt_number: Optional[str] = None


class DepositSlipCancelRequest(BaseModel):
    """Request to cancel deposit slip"""
    reason: str


class DepositSlipListResponse(BaseModel):
    """List of deposit slips"""
    success: bool = True
    data: List[DepositSlipResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class DRIDValidationResult(BaseModel):
    """Result of DRID validation"""
    is_valid: bool
    is_expired: bool
    is_used: bool
    is_cancelled: bool
    status: str
    message: str
    time_remaining_seconds: Optional[int] = None
