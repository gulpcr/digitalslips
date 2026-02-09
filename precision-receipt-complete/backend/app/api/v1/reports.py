# app/api/v1/reports.py
"""
Reports API Endpoints
"""
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import io

from app.core.database import get_db
from app.middleware.auth import (
    get_current_active_user,
    require_admin,
    require_manager_or_above,
    require_roles
)
from app.models import User
from app.schemas.report import (
    ReportFilters,
    TransactionSummaryResponse,
    UserActivityResponse,
    UserActivitySummary,
    TransactionTrendResponse,
    BranchComparisonResponse,
    FailedTransactionsResponse,
    AuditTrailResponse,
    ExportRequest
)
from app.services.report_service import ReportService

router = APIRouter()


# ============================================
# SUMMARY ENDPOINTS
# ============================================

@router.get("/summary", response_model=TransactionSummaryResponse)
async def get_transaction_summary(
    start_date: Optional[datetime] = Query(None, description="Start date for report period"),
    end_date: Optional[datetime] = Query(None, description="End date for report period"),
    transaction_type: Optional[str] = Query(None, description="Filter by transaction type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    branch_id: Optional[str] = Query(None, description="Filter by branch (Admin only)"),
    user_id: Optional[str] = Query(None, description="Filter by user (Admin/Manager only)"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get transaction summary report.
    - ADMIN: System-wide or filter by branch
    - MANAGER: Branch-level only
    - TELLER: Personal transactions only
    - AUDITOR: System-wide (read-only)
    """
    filters = ReportFilters(
        start_date=start_date,
        end_date=end_date,
        transaction_type=transaction_type,
        status=status,
        branch_id=branch_id,
        user_id=user_id
    )

    summary = ReportService.get_transaction_summary(db, current_user, filters)
    return TransactionSummaryResponse(success=True, data=summary)


# ============================================
# USER ACTIVITY ENDPOINTS
# ============================================

@router.get("/user-activity", response_model=UserActivityResponse)
async def get_user_activity(
    start_date: Optional[datetime] = Query(None, description="Start date for report period"),
    end_date: Optional[datetime] = Query(None, description="End date for report period"),
    branch_id: Optional[str] = Query(None, description="Filter by branch (Admin only)"),
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    """
    Get user activity report (Manager or Admin only).
    - ADMIN: All users or filter by branch
    - MANAGER: Users in their branch only
    """
    filters = ReportFilters(
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id
    )

    report = ReportService.get_user_activity_report(db, current_user, filters)
    return UserActivityResponse(success=True, data=report)


@router.get("/my-activity", response_model=UserActivitySummary)
async def get_my_activity(
    start_date: Optional[datetime] = Query(None, description="Start date for report period"),
    end_date: Optional[datetime] = Query(None, description="End date for report period"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's own activity summary (all roles)"""
    filters = ReportFilters(
        start_date=start_date,
        end_date=end_date
    )

    return ReportService.get_my_activity(db, current_user, filters)


# ============================================
# TREND ENDPOINTS
# ============================================

@router.get("/trends", response_model=TransactionTrendResponse)
async def get_transaction_trends(
    start_date: Optional[datetime] = Query(None, description="Start date for report period"),
    end_date: Optional[datetime] = Query(None, description="End date for report period"),
    granularity: str = Query("daily", regex="^(daily|weekly|monthly)$", description="Time granularity"),
    transaction_type: Optional[str] = Query(None, description="Filter by transaction type"),
    branch_id: Optional[str] = Query(None, description="Filter by branch (Admin only)"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get transaction volume trends.
    Role-based filtering applied.
    """
    filters = ReportFilters(
        start_date=start_date,
        end_date=end_date,
        transaction_type=transaction_type,
        branch_id=branch_id
    )

    report = ReportService.get_transaction_trends(db, current_user, filters, granularity)
    return TransactionTrendResponse(success=True, data=report)


# ============================================
# BRANCH COMPARISON (ADMIN ONLY)
# ============================================

@router.get("/branch-comparison", response_model=BranchComparisonResponse)
async def get_branch_comparison(
    start_date: Optional[datetime] = Query(None, description="Start date for report period"),
    end_date: Optional[datetime] = Query(None, description="End date for report period"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get branch performance comparison (Admin only)"""
    filters = ReportFilters(
        start_date=start_date,
        end_date=end_date
    )

    report = ReportService.get_branch_comparison(db, current_user, filters)
    return BranchComparisonResponse(success=True, data=report)


# ============================================
# FAILED TRANSACTIONS
# ============================================

@router.get("/failed-transactions", response_model=FailedTransactionsResponse)
async def get_failed_transactions(
    start_date: Optional[datetime] = Query(None, description="Start date for report period"),
    end_date: Optional[datetime] = Query(None, description="End date for report period"),
    branch_id: Optional[str] = Query(None, description="Filter by branch (Admin only)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    """Get failed transactions report (Manager or Admin)"""
    filters = ReportFilters(
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id
    )

    report = ReportService.get_failed_transactions(db, current_user, filters, page, page_size)
    return FailedTransactionsResponse(success=True, data=report)


# ============================================
# AUDIT TRAIL (AUDITOR/ADMIN)
# ============================================

@router.get("/audit-trail", response_model=AuditTrailResponse)
async def get_audit_trail(
    start_date: Optional[datetime] = Query(None, description="Start date for report period"),
    end_date: Optional[datetime] = Query(None, description="End date for report period"),
    user_id: Optional[str] = Query(None, description="Filter by user"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    current_user: User = Depends(require_roles(["ADMIN", "AUDITOR"])),
    db: Session = Depends(get_db)
):
    """Get audit trail (Auditor or Admin only)"""
    filters = ReportFilters(
        start_date=start_date,
        end_date=end_date,
        user_id=user_id
    )

    report = ReportService.get_audit_trail(db, current_user, filters, action, entity_type, page, page_size)
    return AuditTrailResponse(success=True, data=report)


# ============================================
# EXPORT ENDPOINTS
# ============================================

@router.post("/export")
async def export_report(
    export_request: ExportRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export report to CSV"""
    filters = export_request.filters or ReportFilters()
    report_type = export_request.report_type

    # Get report data based on type
    if report_type == 'summary':
        data = ReportService.get_transaction_summary(db, current_user, filters)
    elif report_type == 'user_activity':
        # Check permission for user activity report
        if current_user.role.value not in ['ADMIN', 'MANAGER']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User activity report requires Manager or Admin access"
            )
        data = ReportService.get_user_activity_report(db, current_user, filters)
    elif report_type == 'trends':
        data = ReportService.get_transaction_trends(db, current_user, filters)
    elif report_type == 'branch_comparison':
        # Check permission for branch comparison
        if current_user.role.value != 'ADMIN':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Branch comparison report requires Admin access"
            )
        data = ReportService.get_branch_comparison(db, current_user, filters)
    elif report_type == 'failed':
        # Check permission for failed transactions
        if current_user.role.value not in ['ADMIN', 'MANAGER', 'AUDITOR']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Failed transactions report requires Manager or Admin access"
            )
        data = ReportService.get_failed_transactions(db, current_user, filters)
    elif report_type == 'audit':
        # Check permission for audit trail
        if current_user.role.value not in ['ADMIN', 'AUDITOR']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Audit trail report requires Admin or Auditor access"
            )
        data = ReportService.get_audit_trail(db, current_user, filters)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown report type: {report_type}"
        )

    # Generate CSV
    csv_content = ReportService.export_to_csv(report_type, data)

    # Create filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"report_{report_type}_{timestamp}.csv"

    # Return as streaming response
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
