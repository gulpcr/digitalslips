# app/schemas/transaction.py
"""
Transaction-related Pydantic schemas
"""
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
import re


class TransactionBase(BaseModel):
    """Base transaction schema"""
    transaction_type: str
    customer_cnic: str
    customer_account: str
    amount: Decimal
    currency: str = "PKR"
    narration: Optional[str] = None


class TransactionCreate(TransactionBase):
    """Schema for creating a transaction"""
    depositor_cnic: Optional[str] = None
    depositor_name: Optional[str] = None
    depositor_phone: Optional[str] = None
    channel: str = "WEB"

    # Type-specific data stored in extra_data JSONB column
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

    @field_validator('customer_cnic', 'depositor_cnic')
    @classmethod
    def validate_cnic(cls, v):
        if v and not re.match(r'^\d{5}-\d{7}-\d{1}$', v):
            raise ValueError('CNIC must be in format: XXXXX-XXXXXXX-X')
        return v

    @model_validator(mode='after')
    def validate_type_specific_fields(self):
        """Validate type-specific required fields"""
        txn_type = self.transaction_type
        data = self.additional_data or {}

        if txn_type == 'CASH_DEPOSIT':
            # Depositor fields required for cash deposit
            if not self.depositor_name:
                raise ValueError('Depositor name is required for cash deposit')
            if not self.depositor_cnic:
                raise ValueError('Depositor CNIC is required for cash deposit')
            if not self.depositor_phone:
                raise ValueError('Depositor phone is required for cash deposit')

        elif txn_type == 'CHEQUE_DEPOSIT':
            if not data.get('cheque_number'):
                raise ValueError('Cheque number is required')
            if not data.get('cheque_date'):
                raise ValueError('Cheque date is required')
            if not data.get('cheque_bank'):
                raise ValueError('Cheque bank name is required')
            # Validate cheque number format (6-10 digits)
            cheque_num = data.get('cheque_number', '')
            if not re.match(r'^\d{6,10}$', str(cheque_num)):
                raise ValueError('Cheque number must be 6-10 digits')

        elif txn_type == 'PAY_ORDER':
            if not data.get('payee_name'):
                raise ValueError('Payee name is required')
            if not data.get('payee_cnic'):
                raise ValueError('Payee CNIC is required')
            # Validate payee CNIC format
            payee_cnic = data.get('payee_cnic', '')
            if payee_cnic and not re.match(r'^\d{5}-\d{7}-\d{1}$', payee_cnic):
                raise ValueError('Payee CNIC must be in format: XXXXX-XXXXXXX-X')

        elif txn_type == 'BILL_PAYMENT':
            if not data.get('bill_type'):
                raise ValueError('Bill type is required')
            if not data.get('consumer_number'):
                raise ValueError('Consumer number is required')
            if not data.get('biller_name'):
                raise ValueError('Biller name is required')

        elif txn_type == 'FUND_TRANSFER':
            if not data.get('beneficiary_name'):
                raise ValueError('Beneficiary name is required')
            if not data.get('beneficiary_account'):
                raise ValueError('Beneficiary account number is required')
            if not data.get('beneficiary_bank'):
                raise ValueError('Beneficiary bank is required')
            # Cannot transfer to same account
            if data.get('beneficiary_account') == self.customer_account:
                raise ValueError('Cannot transfer to the same account')
            # IBAN required for inter-bank transfers
            if data.get('beneficiary_bank') != 'Meezan Bank' and not data.get('beneficiary_iban'):
                raise ValueError('IBAN is required for inter-bank transfers')
            # Validate IBAN format if provided
            iban = data.get('beneficiary_iban', '')
            if iban and not re.match(r'^PK\d{2}[A-Z]{4}\d{16}$', iban):
                raise ValueError('IBAN must be in format: PK + 2 digits + 4 letters + 16 digits')

        return self


class TransactionUpdate(BaseModel):
    """Schema for updating a transaction"""
    status: Optional[str] = None
    narration: Optional[str] = None


class TransactionResponse(BaseModel):
    """Transaction response schema"""
    id: str
    reference_number: str
    transaction_type: str
    transaction_category: str
    customer_id: str
    customer_cnic: str
    customer_name: str
    customer_account: str
    depositor_cnic: Optional[str] = None
    depositor_name: Optional[str] = None
    depositor_phone: Optional[str] = None
    amount: Decimal
    currency: str
    fee: Decimal
    tax: Decimal
    total_amount: Decimal
    status: str
    channel: str
    narration: Optional[str] = None
    branch_id: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    additional_data: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class TransactionListResponse(BaseModel):
    """Transaction list response"""
    success: bool = True
    data: List[TransactionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class TransactionFilterParams(BaseModel):
    """Transaction filter parameters"""
    status: Optional[str] = None
    transaction_type: Optional[str] = None
    customer_cnic: Optional[str] = None
    branch_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None


class TransactionStats(BaseModel):
    """Transaction statistics"""
    total_count: int
    total_amount: Decimal
    completed_count: int
    pending_count: int
    failed_count: int
    by_type: Dict[str, int]
    by_status: Dict[str, int]
