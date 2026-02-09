# app/models/__init__.py
"""
Precision Receipt - SQLAlchemy Database Models
Meezan Bank Pakistan - Digital Transaction Receipt System
"""
import enum
from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    Boolean, Column, DateTime, Decimal as SQLDecimal, Enum, Float,
    ForeignKey, Integer, String, Text, JSON, Date, Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, declarative_base
import uuid

Base = declarative_base()


# ============================================
# ENUMS
# ============================================

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    TELLER = "TELLER"
    AUDITOR = "AUDITOR"


class BranchType(str, enum.Enum):
    MAIN = "MAIN"
    SUB = "SUB"
    REGIONAL = "REGIONAL"


class Gender(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class KycStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class AccountType(str, enum.Enum):
    SAVINGS = "SAVINGS"
    CURRENT = "CURRENT"
    FIXED_DEPOSIT = "FIXED_DEPOSIT"
    FOREIGN_CURRENCY = "FOREIGN_CURRENCY"


class AccountStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    DORMANT = "DORMANT"
    FROZEN = "FROZEN"
    CLOSED = "CLOSED"


class TransactionType(str, enum.Enum):
    CASH_DEPOSIT = "CASH_DEPOSIT"
    CHEQUE_DEPOSIT = "CHEQUE_DEPOSIT"
    PAY_ORDER = "PAY_ORDER"
    BILL_PAYMENT = "BILL_PAYMENT"
    FUND_TRANSFER = "FUND_TRANSFER"


class TransactionCategory(str, enum.Enum):
    DEPOSIT = "DEPOSIT"
    WITHDRAWAL = "WITHDRAWAL"
    TRANSFER = "TRANSFER"
    PAYMENT = "PAYMENT"


class TransactionStatus(str, enum.Enum):
    INITIATED = "INITIATED"
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    REVERSED = "REVERSED"


class Channel(str, enum.Enum):
    WHATSAPP = "WHATSAPP"
    WEB = "WEB"
    MOBILE = "MOBILE"
    USSD = "USSD"
    BRANCH = "BRANCH"


class ReceiptType(str, enum.Enum):
    DIGITAL = "DIGITAL"
    PRINTED = "PRINTED"
    EMAIL = "EMAIL"


class NotificationType(str, enum.Enum):
    TRANSACTION_INITIATED = "TRANSACTION_INITIATED"
    TRANSACTION_COMPLETED = "TRANSACTION_COMPLETED"
    RECEIPT_READY = "RECEIPT_READY"
    ALERT = "ALERT"
    REMINDER = "REMINDER"


class NotificationChannel(str, enum.Enum):
    WHATSAPP = "WHATSAPP"
    SMS = "SMS"
    EMAIL = "EMAIL"
    PUSH = "PUSH"


class NotificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENDING = "SENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    BOUNCED = "BOUNCED"


class Priority(str, enum.Enum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


class Severity(str, enum.Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


# ============================================
# MODELS
# ============================================

class User(Base):
    """User accounts for system access"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True, index=True)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    last_login_at = Column(DateTime, nullable=True)
    password_changed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    branch = relationship("Branch", back_populates="users")
    processed_transactions = relationship("Transaction", foreign_keys="Transaction.processed_by", back_populates="processor")
    reviewed_transactions = relationship("Transaction", foreign_keys="Transaction.reviewed_by", back_populates="reviewer")
    audit_logs = relationship("AuditLog", back_populates="user")
    sessions = relationship("Session", back_populates="user")
    updated_settings = relationship("SystemSettings", back_populates="updater")


class Branch(Base):
    """Bank branch locations"""
    __tablename__ = "branches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_code = Column(String(20), unique=True, nullable=False, index=True)
    branch_name = Column(String(255), nullable=False)
    branch_type = Column(Enum(BranchType), nullable=False)
    region = Column(String(100), nullable=True)
    address = Column(Text, nullable=False)
    city = Column(String(100), nullable=False, index=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), default="Pakistan", nullable=False)
    phone = Column(String(20), nullable=False)
    email = Column(String(255), nullable=True)
    latitude = Column(SQLDecimal(10, 8), nullable=True)
    longitude = Column(SQLDecimal(11, 8), nullable=True)
    working_hours = Column(JSONB, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    opened_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    users = relationship("User", back_populates="branch")
    accounts = relationship("Account", back_populates="branch")
    transactions = relationship("Transaction", back_populates="branch")


class Customer(Base):
    """Customer information"""
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cnic = Column(String(15), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    father_name = Column(String(255), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(Enum(Gender), nullable=True)
    phone = Column(String(20), nullable=False, index=True)
    alternate_phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=False)
    city = Column(String(100), nullable=False)
    province = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), default="Pakistan", nullable=False)
    occupation = Column(String(255), nullable=True)
    monthly_income = Column(SQLDecimal(15, 2), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    verified_by = Column(UUID(as_uuid=True), nullable=True)
    kyc_status = Column(Enum(KycStatus), default=KycStatus.PENDING, nullable=False)
    risk_score = Column(Float, nullable=True)
    is_blocked = Column(Boolean, default=False, nullable=False)
    blocked_reason = Column(Text, nullable=True)
    blocked_at = Column(DateTime, nullable=True)
    blocked_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    accounts = relationship("Account", back_populates="customer")
    transactions = relationship("Transaction", back_populates="customer")


class Account(Base):
    """Customer bank accounts"""
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_number = Column(String(20), unique=True, nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, index=True)
    account_type = Column(Enum(AccountType), nullable=False)
    account_title = Column(String(255), nullable=False)
    account_status = Column(Enum(AccountStatus), default=AccountStatus.ACTIVE, nullable=False)
    currency = Column(String(3), default="PKR", nullable=False)
    balance = Column(SQLDecimal(15, 2), default=0, nullable=False)
    available_balance = Column(SQLDecimal(15, 2), default=0, nullable=False)
    daily_limit = Column(SQLDecimal(15, 2), nullable=True)
    monthly_limit = Column(SQLDecimal(15, 2), nullable=True)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False, index=True)
    interest_rate = Column(SQLDecimal(5, 2), nullable=True)
    opened_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    closed_at = Column(DateTime, nullable=True)
    last_transaction_at = Column(DateTime, nullable=True)
    is_joint_account = Column(Boolean, default=False, nullable=False)
    joint_holders = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="accounts")
    branch = relationship("Branch", back_populates="accounts")


class Transaction(Base):
    """Financial transactions"""
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference_number = Column(String(50), unique=True, nullable=False, index=True)
    transaction_type = Column(Enum(TransactionType), nullable=False)
    transaction_category = Column(Enum(TransactionCategory), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, index=True)
    customer_cnic = Column(String(15), nullable=False, index=True)
    customer_name = Column(String(255), nullable=False)
    customer_account = Column(String(20), nullable=False)
    depositor_cnic = Column(String(15), nullable=True)
    depositor_name = Column(String(255), nullable=True)
    depositor_phone = Column(String(20), nullable=True)
    amount = Column(SQLDecimal(15, 2), nullable=False)
    currency = Column(String(3), default="PKR", nullable=False)
    exchange_rate = Column(SQLDecimal(10, 4), default=1, nullable=False)
    amount_in_base_currency = Column(SQLDecimal(15, 2), nullable=False)
    fee = Column(SQLDecimal(10, 2), default=0, nullable=False)
    tax = Column(SQLDecimal(10, 2), default=0, nullable=False)
    total_amount = Column(SQLDecimal(15, 2), nullable=False)
    status = Column(Enum(TransactionStatus), default=TransactionStatus.INITIATED, nullable=False, index=True)
    qr_code_data = Column(Text, nullable=True)
    qr_code_url = Column(String(500), nullable=True)
    qr_code_expiry = Column(DateTime, nullable=True)
    channel = Column(Enum(Channel), nullable=False)
    device_info = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
    location = Column(JSONB, nullable=True)
    metadata = Column(JSONB, nullable=True)
    narration = Column(Text, nullable=True)
    t24_transaction_id = Column(String(50), nullable=True)
    t24_posting_date = Column(Date, nullable=True)
    t24_value_date = Column(Date, nullable=True)
    t24_response = Column(JSONB, nullable=True)
    fraud_score = Column(Float, nullable=True)
    fraud_flags = Column(JSONB, nullable=True)
    is_suspicious = Column(Boolean, default=False, nullable=False)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False, index=True)
    processed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    processed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    failure_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="transactions")
    branch = relationship("Branch", back_populates="transactions")
    processor = relationship("User", foreign_keys=[processed_by], back_populates="processed_transactions")
    reviewer = relationship("User", foreign_keys=[reviewed_by], back_populates="reviewed_transactions")
    receipts = relationship("Receipt", back_populates="transaction")
    notifications = relationship("Notification", back_populates="transaction")


class Receipt(Base):
    """Digital transaction receipts"""
    __tablename__ = "receipts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=False, index=True)
    receipt_number = Column(String(50), unique=True, nullable=False, index=True)
    receipt_type = Column(Enum(ReceiptType), nullable=False)
    pdf_url = Column(String(500), nullable=True)
    pdf_hash = Column(String(64), nullable=True)
    image_url = Column(String(500), nullable=True)
    html_content = Column(Text, nullable=True)
    blockchain_hash = Column(String(66), nullable=True)
    blockchain_network = Column(String(50), nullable=True)
    blockchain_timestamp = Column(DateTime, nullable=True)
    verification_qr_data = Column(Text, nullable=True)
    verification_url = Column(String(500), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verified_count = Column(Integer, default=0, nullable=False)
    last_verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    transaction = relationship("Transaction", back_populates="receipts")


class Notification(Base):
    """Transaction notifications"""
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=False, index=True)
    notification_type = Column(Enum(NotificationType), nullable=False)
    channel = Column(Enum(NotificationChannel), nullable=False)
    recipient = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=True)
    message = Column(Text, nullable=False)
    template_id = Column(String(100), nullable=True)
    template_vars = Column(JSONB, nullable=True)
    status = Column(Enum(NotificationStatus), default=NotificationStatus.PENDING, nullable=False)
    external_id = Column(String(255), nullable=True)
    provider = Column(String(100), nullable=True)
    priority = Column(Enum(Priority), default=Priority.NORMAL, nullable=False)
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    scheduled_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    failure_reason = Column(Text, nullable=True)
    cost = Column(SQLDecimal(10, 4), nullable=True)
    metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    transaction = relationship("Transaction", back_populates="notifications")


class AuditLog(Base):
    """System audit trail"""
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(255), nullable=True)
    old_data = Column(JSONB, nullable=True)
    new_data = Column(JSONB, nullable=True)
    changes = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    session_id = Column(String(255), nullable=True)
    request_id = Column(String(255), nullable=True)
    severity = Column(Enum(Severity), default=Severity.INFO, nullable=False)
    success = Column(Boolean, default=True, nullable=False)
    error_message = Column(Text, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="audit_logs")


class SystemSettings(Base):
    """System configuration settings"""
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
    value_type = Column(String(50), nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_encrypted = Column(Boolean, default=False, nullable=False)
    is_sensitive = Column(Boolean, default=False, nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    updater = relationship("User", back_populates="updated_settings")


class Session(Base):
    """User authentication sessions"""
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    device_info = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    last_activity_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="sessions")


# Export all models
__all__ = [
    "Base",
    "User", "Branch", "Customer", "Account", "Transaction",
    "Receipt", "Notification", "AuditLog", "SystemSettings", "Session",
    "UserRole", "BranchType", "Gender", "KycStatus", "AccountType",
    "AccountStatus", "TransactionType", "TransactionCategory",
    "TransactionStatus", "Channel", "ReceiptType", "NotificationType",
    "NotificationChannel", "NotificationStatus", "Priority", "Severity"
]
