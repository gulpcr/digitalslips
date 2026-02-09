# app/schemas/report.py
"""
Report-related Pydantic schemas
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


class ReportFilters(BaseModel):
    """Common filter parameters for all reports"""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    transaction_type: Optional[str] = None
    status: Optional[str] = None
    branch_id: Optional[str] = None
    user_id: Optional[str] = None


# ============================================
# TRANSACTION SUMMARY SCHEMAS
# ============================================

class TypeBreakdown(BaseModel):
    """Breakdown by transaction type"""
    count: int
    amount: Decimal


class StatusBreakdown(BaseModel):
    """Breakdown by status"""
    count: int
    amount: Decimal


class TransactionSummary(BaseModel):
    """Transaction summary statistics"""
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    total_count: int
    total_amount: Decimal
    completed_count: int
    completed_amount: Decimal
    pending_count: int
    pending_amount: Decimal
    failed_count: int
    failed_amount: Decimal
    cancelled_count: int
    cancelled_amount: Decimal
    average_amount: Decimal
    by_type: Dict[str, TypeBreakdown]
    by_status: Dict[str, StatusBreakdown]


class TransactionSummaryResponse(BaseModel):
    """Transaction summary API response"""
    success: bool = True
    data: TransactionSummary


# ============================================
# USER ACTIVITY SCHEMAS
# ============================================

class UserActivitySummary(BaseModel):
    """Individual user activity summary"""
    user_id: str
    username: str
    full_name: str
    role: str
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    total_transactions: int
    total_amount: Decimal
    completed_count: int
    completed_amount: Decimal
    failed_count: int
    failed_amount: Decimal
    success_rate: float
    first_transaction_at: Optional[datetime] = None
    last_transaction_at: Optional[datetime] = None


class UserActivityReport(BaseModel):
    """User activity report"""
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    users: List[UserActivitySummary]
    total_users_active: int


class UserActivityResponse(BaseModel):
    """User activity API response"""
    success: bool = True
    data: UserActivityReport


# ============================================
# TREND SCHEMAS
# ============================================

class TrendDataPoint(BaseModel):
    """Single data point for trends"""
    period: str
    period_label: str
    transaction_count: int
    total_amount: Decimal
    completed_count: int
    completed_amount: Decimal
    failed_count: int
    pending_count: int


class TransactionTrendReport(BaseModel):
    """Transaction volume trends"""
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    granularity: str
    data_points: List[TrendDataPoint]
    total_transactions: int
    total_amount: Decimal


class TransactionTrendResponse(BaseModel):
    """Transaction trend API response"""
    success: bool = True
    data: TransactionTrendReport


# ============================================
# BRANCH COMPARISON SCHEMAS
# ============================================

class BranchSummary(BaseModel):
    """Branch-level summary"""
    branch_id: str
    branch_code: str
    branch_name: str
    total_transactions: int
    total_amount: Decimal
    completed_count: int
    completed_amount: Decimal
    failed_count: int
    success_rate: float
    active_tellers: int


class BranchComparisonReport(BaseModel):
    """Branch comparison report"""
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    branches: List[BranchSummary]
    total_system_transactions: int
    total_system_amount: Decimal


class BranchComparisonResponse(BaseModel):
    """Branch comparison API response"""
    success: bool = True
    data: BranchComparisonReport


# ============================================
# FAILED TRANSACTIONS SCHEMAS
# ============================================

class FailedTransactionDetail(BaseModel):
    """Failed transaction detail"""
    id: str
    reference_number: str
    transaction_type: str
    customer_name: str
    customer_cnic: str
    amount: Decimal
    currency: str
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    processed_by: Optional[str] = None
    processor_name: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: datetime
    failed_at: Optional[datetime] = None


class FailedTransactionsReport(BaseModel):
    """Failed transactions report"""
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    total_failed: int
    total_failed_amount: Decimal
    transactions: List[FailedTransactionDetail]
    page: int
    page_size: int
    total_pages: int


class FailedTransactionsResponse(BaseModel):
    """Failed transactions API response"""
    success: bool = True
    data: FailedTransactionsReport


# ============================================
# AUDIT TRAIL SCHEMAS
# ============================================

class AuditTrailEntry(BaseModel):
    """Audit trail entry"""
    id: str
    user_id: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: datetime


class AuditTrailReport(BaseModel):
    """Audit trail report"""
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    total_entries: int
    entries: List[AuditTrailEntry]
    page: int
    page_size: int
    total_pages: int


class AuditTrailResponse(BaseModel):
    """Audit trail API response"""
    success: bool = True
    data: AuditTrailReport


# ============================================
# EXPORT SCHEMAS
# ============================================

class ExportRequest(BaseModel):
    """Export request parameters"""
    report_type: str  # 'summary', 'user_activity', 'trends', 'failed', 'audit'
    format: str = 'csv'  # 'csv' or 'pdf'
    filters: Optional[ReportFilters] = None


class ExportResponse(BaseModel):
    """Export response"""
    success: bool = True
    file_name: str
    content_type: str
    message: Optional[str] = None
