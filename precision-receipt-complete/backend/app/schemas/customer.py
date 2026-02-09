# app/schemas/customer.py
"""
Customer-related Pydantic schemas
"""
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
import re


class CustomerBase(BaseModel):
    """Base customer schema"""
    cnic: str
    full_name: str
    father_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone: str
    alternate_phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: str
    city: str
    province: Optional[str] = None
    postal_code: Optional[str] = None
    occupation: Optional[str] = None
    monthly_income: Optional[Decimal] = None

    @field_validator('cnic')
    @classmethod
    def validate_cnic(cls, v):
        # Pakistani CNIC format: XXXXX-XXXXXXX-X
        pattern = r'^\d{5}-\d{7}-\d{1}$'
        if not re.match(pattern, v):
            raise ValueError('CNIC must be in format: XXXXX-XXXXXXX-X')
        return v

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        # Basic phone validation
        cleaned = re.sub(r'[\s\-\(\)]', '', v)
        if not re.match(r'^\+?\d{10,15}$', cleaned):
            raise ValueError('Invalid phone number format')
        return v


class CustomerCreate(CustomerBase):
    """Schema for creating a customer"""
    pass


class CustomerUpdate(BaseModel):
    """Schema for updating a customer"""
    full_name: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    occupation: Optional[str] = None
    monthly_income: Optional[Decimal] = None


class CustomerResponse(CustomerBase):
    """Customer response schema"""
    id: str
    is_verified: bool
    kyc_status: str
    is_blocked: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerSearchRequest(BaseModel):
    """Customer search request"""
    cnic: Optional[str] = None
    phone: Optional[str] = None
    name: Optional[str] = None


class AccountResponse(BaseModel):
    """Account response schema"""
    id: str
    account_number: str
    account_type: str
    account_title: str
    account_status: str
    currency: str
    balance: Decimal
    available_balance: Decimal
    branch_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerWithAccountsResponse(CustomerResponse):
    """Customer with accounts response"""
    accounts: List[AccountResponse] = []
