# app/services/report_service.py
"""
Report generation service with role-based data access
"""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, Dict, List, Any
from sqlalchemy import func, case, and_, or_
from sqlalchemy.orm import Session
import csv
import io

from app.models import (
    Transaction, TransactionStatus, TransactionType,
    User, UserRole, Branch, AuditLog
)
from app.schemas.report import (
    ReportFilters, TransactionSummary, TypeBreakdown, StatusBreakdown,
    UserActivitySummary, UserActivityReport,
    TrendDataPoint, TransactionTrendReport,
    BranchSummary, BranchComparisonReport,
    FailedTransactionDetail, FailedTransactionsReport,
    AuditTrailEntry, AuditTrailReport
)


class ReportService:
    """Service for generating various reports with role-based access control"""

    @staticmethod
    def _apply_role_filter(query, current_user: User, db: Session):
        """Apply role-based filtering to transaction query"""
        if current_user.role == UserRole.ADMIN:
            # Admin sees everything
            return query
        elif current_user.role == UserRole.AUDITOR:
            # Auditor sees everything (read-only)
            return query
        elif current_user.role == UserRole.MANAGER:
            # Manager sees only their branch
            return query.filter(Transaction.branch_id == current_user.branch_id)
        else:  # TELLER
            # Teller sees only their own transactions
            return query.filter(Transaction.processed_by == current_user.id)

    @staticmethod
    def _apply_date_filter(query, filters: ReportFilters):
        """Apply date range filter"""
        if filters.start_date:
            query = query.filter(Transaction.created_at >= filters.start_date)
        if filters.end_date:
            query = query.filter(Transaction.created_at <= filters.end_date)
        return query

    @staticmethod
    def _apply_common_filters(query, filters: ReportFilters):
        """Apply common filters (type, status, branch, user)"""
        if filters.transaction_type:
            query = query.filter(Transaction.transaction_type == TransactionType[filters.transaction_type])
        if filters.status:
            query = query.filter(Transaction.status == TransactionStatus[filters.status])
        if filters.branch_id:
            query = query.filter(Transaction.branch_id == filters.branch_id)
        if filters.user_id:
            query = query.filter(Transaction.processed_by == filters.user_id)
        return query

    @staticmethod
    def get_transaction_summary(
        db: Session,
        current_user: User,
        filters: ReportFilters
    ) -> TransactionSummary:
        """Get transaction summary with role-based filtering"""
        # Build base query
        query = db.query(Transaction)

        # Apply role-based filter
        query = ReportService._apply_role_filter(query, current_user, db)

        # Apply date filter
        query = ReportService._apply_date_filter(query, filters)

        # Apply common filters (except branch for non-admin already filtered)
        if filters.transaction_type:
            query = query.filter(Transaction.transaction_type == TransactionType[filters.transaction_type])
        if filters.status:
            query = query.filter(Transaction.status == TransactionStatus[filters.status])
        if filters.branch_id and current_user.role in [UserRole.ADMIN, UserRole.AUDITOR]:
            query = query.filter(Transaction.branch_id == filters.branch_id)
        if filters.user_id and current_user.role in [UserRole.ADMIN, UserRole.AUDITOR, UserRole.MANAGER]:
            query = query.filter(Transaction.processed_by == filters.user_id)

        # Get filtered transaction IDs
        filtered_ids = [t.id for t in query.all()]

        if not filtered_ids:
            # No transactions found
            return TransactionSummary(
                period_start=filters.start_date,
                period_end=filters.end_date,
                total_count=0,
                total_amount=Decimal(0),
                completed_count=0,
                completed_amount=Decimal(0),
                pending_count=0,
                pending_amount=Decimal(0),
                failed_count=0,
                failed_amount=Decimal(0),
                cancelled_count=0,
                cancelled_amount=Decimal(0),
                average_amount=Decimal(0),
                by_type={},
                by_status={}
            )

        # Calculate aggregates using filtered IDs
        result = db.query(
            func.count(Transaction.id).label('total_count'),
            func.coalesce(func.sum(Transaction.amount), 0).label('total_amount'),
            func.count(case((Transaction.status == TransactionStatus.COMPLETED, 1))).label('completed_count'),
            func.coalesce(func.sum(case((Transaction.status == TransactionStatus.COMPLETED, Transaction.amount))), 0).label('completed_amount'),
            func.count(case((Transaction.status == TransactionStatus.PENDING, 1))).label('pending_count'),
            func.coalesce(func.sum(case((Transaction.status == TransactionStatus.PENDING, Transaction.amount))), 0).label('pending_amount'),
            func.count(case((Transaction.status == TransactionStatus.FAILED, 1))).label('failed_count'),
            func.coalesce(func.sum(case((Transaction.status == TransactionStatus.FAILED, Transaction.amount))), 0).label('failed_amount'),
            func.count(case((Transaction.status == TransactionStatus.CANCELLED, 1))).label('cancelled_count'),
            func.coalesce(func.sum(case((Transaction.status == TransactionStatus.CANCELLED, Transaction.amount))), 0).label('cancelled_amount'),
        ).filter(Transaction.id.in_(filtered_ids)).first()

        # Calculate by type
        type_results = db.query(
            Transaction.transaction_type,
            func.count(Transaction.id).label('count'),
            func.coalesce(func.sum(Transaction.amount), 0).label('amount')
        ).filter(Transaction.id.in_(filtered_ids)).group_by(Transaction.transaction_type).all()

        by_type = {}
        for row in type_results:
            if row.transaction_type:
                by_type[row.transaction_type.value] = TypeBreakdown(
                    count=row.count,
                    amount=row.amount or Decimal(0)
                )

        # Calculate by status
        status_results = db.query(
            Transaction.status,
            func.count(Transaction.id).label('count'),
            func.coalesce(func.sum(Transaction.amount), 0).label('amount')
        ).filter(Transaction.id.in_(filtered_ids)).group_by(Transaction.status).all()

        by_status = {}
        for row in status_results:
            if row.status:
                by_status[row.status.value] = StatusBreakdown(
                    count=row.count,
                    amount=row.amount or Decimal(0)
                )

        total_count = result.total_count or 0
        total_amount = result.total_amount or Decimal(0)

        return TransactionSummary(
            period_start=filters.start_date,
            period_end=filters.end_date,
            total_count=total_count,
            total_amount=total_amount,
            completed_count=result.completed_count or 0,
            completed_amount=result.completed_amount or Decimal(0),
            pending_count=result.pending_count or 0,
            pending_amount=result.pending_amount or Decimal(0),
            failed_count=result.failed_count or 0,
            failed_amount=result.failed_amount or Decimal(0),
            cancelled_count=result.cancelled_count or 0,
            cancelled_amount=result.cancelled_amount or Decimal(0),
            average_amount=total_amount / total_count if total_count > 0 else Decimal(0),
            by_type=by_type,
            by_status=by_status
        )

    @staticmethod
    def get_user_activity_report(
        db: Session,
        current_user: User,
        filters: ReportFilters
    ) -> UserActivityReport:
        """Get user activity report (Admin/Manager only)"""
        # Build user query based on role
        user_query = db.query(User).filter(User.is_active == True)

        if current_user.role == UserRole.MANAGER:
            # Manager sees only their branch users
            user_query = user_query.filter(User.branch_id == current_user.branch_id)
        elif current_user.role in [UserRole.ADMIN, UserRole.AUDITOR]:
            # Admin/Auditor can filter by branch if specified
            if filters.branch_id:
                user_query = user_query.filter(User.branch_id == filters.branch_id)

        users = user_query.all()
        user_summaries = []

        for user in users:
            # Get transaction stats for this user
            txn_query = db.query(Transaction).filter(Transaction.processed_by == user.id)

            # Apply date filter
            if filters.start_date:
                txn_query = txn_query.filter(Transaction.created_at >= filters.start_date)
            if filters.end_date:
                txn_query = txn_query.filter(Transaction.created_at <= filters.end_date)

            stats = db.query(
                func.count(Transaction.id).label('total'),
                func.coalesce(func.sum(Transaction.amount), 0).label('amount'),
                func.count(case((Transaction.status == TransactionStatus.COMPLETED, 1))).label('completed'),
                func.coalesce(func.sum(case((Transaction.status == TransactionStatus.COMPLETED, Transaction.amount))), 0).label('completed_amount'),
                func.count(case((Transaction.status == TransactionStatus.FAILED, 1))).label('failed'),
                func.coalesce(func.sum(case((Transaction.status == TransactionStatus.FAILED, Transaction.amount))), 0).label('failed_amount'),
                func.min(Transaction.created_at).label('first_txn'),
                func.max(Transaction.created_at).label('last_txn')
            ).filter(Transaction.processed_by == user.id)

            if filters.start_date:
                stats = stats.filter(Transaction.created_at >= filters.start_date)
            if filters.end_date:
                stats = stats.filter(Transaction.created_at <= filters.end_date)

            result = stats.first()

            # Get branch name
            branch_name = None
            if user.branch_id:
                branch = db.query(Branch).filter(Branch.id == user.branch_id).first()
                if branch:
                    branch_name = branch.branch_name

            total = result.total or 0
            completed = result.completed or 0
            success_rate = (completed / total * 100) if total > 0 else 0

            user_summaries.append(UserActivitySummary(
                user_id=str(user.id),
                username=user.username,
                full_name=user.full_name,
                role=user.role.value,
                branch_id=str(user.branch_id) if user.branch_id else None,
                branch_name=branch_name,
                total_transactions=total,
                total_amount=result.amount or Decimal(0),
                completed_count=completed,
                completed_amount=result.completed_amount or Decimal(0),
                failed_count=result.failed or 0,
                failed_amount=result.failed_amount or Decimal(0),
                success_rate=round(success_rate, 2),
                first_transaction_at=result.first_txn,
                last_transaction_at=result.last_txn
            ))

        # Sort by total transactions descending
        user_summaries.sort(key=lambda x: x.total_transactions, reverse=True)

        return UserActivityReport(
            period_start=filters.start_date,
            period_end=filters.end_date,
            users=user_summaries,
            total_users_active=len([u for u in user_summaries if u.total_transactions > 0])
        )

    @staticmethod
    def get_my_activity(
        db: Session,
        current_user: User,
        filters: ReportFilters
    ) -> UserActivitySummary:
        """Get current user's own activity summary"""
        # Get transaction stats for current user
        stats_query = db.query(
            func.count(Transaction.id).label('total'),
            func.coalesce(func.sum(Transaction.amount), 0).label('amount'),
            func.count(case((Transaction.status == TransactionStatus.COMPLETED, 1))).label('completed'),
            func.coalesce(func.sum(case((Transaction.status == TransactionStatus.COMPLETED, Transaction.amount))), 0).label('completed_amount'),
            func.count(case((Transaction.status == TransactionStatus.FAILED, 1))).label('failed'),
            func.coalesce(func.sum(case((Transaction.status == TransactionStatus.FAILED, Transaction.amount))), 0).label('failed_amount'),
            func.min(Transaction.created_at).label('first_txn'),
            func.max(Transaction.created_at).label('last_txn')
        ).filter(Transaction.processed_by == current_user.id)

        if filters.start_date:
            stats_query = stats_query.filter(Transaction.created_at >= filters.start_date)
        if filters.end_date:
            stats_query = stats_query.filter(Transaction.created_at <= filters.end_date)

        result = stats_query.first()

        # Get branch name
        branch_name = None
        if current_user.branch_id:
            branch = db.query(Branch).filter(Branch.id == current_user.branch_id).first()
            if branch:
                branch_name = branch.branch_name

        total = result.total or 0
        completed = result.completed or 0
        success_rate = (completed / total * 100) if total > 0 else 0

        return UserActivitySummary(
            user_id=str(current_user.id),
            username=current_user.username,
            full_name=current_user.full_name,
            role=current_user.role.value,
            branch_id=str(current_user.branch_id) if current_user.branch_id else None,
            branch_name=branch_name,
            total_transactions=total,
            total_amount=result.amount or Decimal(0),
            completed_count=completed,
            completed_amount=result.completed_amount or Decimal(0),
            failed_count=result.failed or 0,
            failed_amount=result.failed_amount or Decimal(0),
            success_rate=round(success_rate, 2),
            first_transaction_at=result.first_txn,
            last_transaction_at=result.last_txn
        )

    @staticmethod
    def get_transaction_trends(
        db: Session,
        current_user: User,
        filters: ReportFilters,
        granularity: str = 'daily'
    ) -> TransactionTrendReport:
        """Get transaction volume trends"""
        # Build base query
        query = db.query(Transaction)

        # Apply role-based filter
        query = ReportService._apply_role_filter(query, current_user, db)

        # Apply date filter
        query = ReportService._apply_date_filter(query, filters)

        # Apply common filters
        if filters.transaction_type:
            query = query.filter(Transaction.transaction_type == TransactionType[filters.transaction_type])
        if filters.branch_id and current_user.role in [UserRole.ADMIN, UserRole.AUDITOR]:
            query = query.filter(Transaction.branch_id == filters.branch_id)

        # Get filtered transaction IDs
        filtered_ids = [t.id for t in query.all()]

        if not filtered_ids:
            return TransactionTrendReport(
                period_start=filters.start_date,
                period_end=filters.end_date,
                granularity=granularity,
                data_points=[],
                total_transactions=0,
                total_amount=Decimal(0)
            )

        # Determine grouping function based on granularity
        if granularity == 'daily':
            date_trunc = func.date_trunc('day', Transaction.created_at)
            date_format = '%Y-%m-%d'
        elif granularity == 'weekly':
            date_trunc = func.date_trunc('week', Transaction.created_at)
            date_format = '%Y-W%W'
        else:  # monthly
            date_trunc = func.date_trunc('month', Transaction.created_at)
            date_format = '%Y-%m'

        # Get aggregated data
        trend_data = db.query(
            date_trunc.label('period'),
            func.count(Transaction.id).label('count'),
            func.coalesce(func.sum(Transaction.amount), 0).label('amount'),
            func.count(case((Transaction.status == TransactionStatus.COMPLETED, 1))).label('completed'),
            func.coalesce(func.sum(case((Transaction.status == TransactionStatus.COMPLETED, Transaction.amount))), 0).label('completed_amount'),
            func.count(case((Transaction.status == TransactionStatus.FAILED, 1))).label('failed'),
            func.count(case((Transaction.status == TransactionStatus.PENDING, 1))).label('pending')
        ).filter(
            Transaction.id.in_(filtered_ids)
        ).group_by(date_trunc).order_by(date_trunc).all()

        data_points = []
        total_transactions = 0
        total_amount = Decimal(0)

        for row in trend_data:
            if row.period:
                period_str = row.period.strftime(date_format)
                if granularity == 'daily':
                    period_label = row.period.strftime('%b %d')
                elif granularity == 'weekly':
                    period_label = f"Week {row.period.strftime('%W')}"
                else:
                    period_label = row.period.strftime('%b %Y')

                data_points.append(TrendDataPoint(
                    period=period_str,
                    period_label=period_label,
                    transaction_count=row.count or 0,
                    total_amount=row.amount or Decimal(0),
                    completed_count=row.completed or 0,
                    completed_amount=row.completed_amount or Decimal(0),
                    failed_count=row.failed or 0,
                    pending_count=row.pending or 0
                ))
                total_transactions += row.count or 0
                total_amount += row.amount or Decimal(0)

        return TransactionTrendReport(
            period_start=filters.start_date,
            period_end=filters.end_date,
            granularity=granularity,
            data_points=data_points,
            total_transactions=total_transactions,
            total_amount=total_amount
        )

    @staticmethod
    def get_branch_comparison(
        db: Session,
        current_user: User,
        filters: ReportFilters
    ) -> BranchComparisonReport:
        """Get branch performance comparison (Admin only)"""
        branches = db.query(Branch).filter(Branch.is_active == True).all()
        branch_summaries = []
        total_system_transactions = 0
        total_system_amount = Decimal(0)

        for branch in branches:
            # Get transaction stats for this branch
            txn_query = db.query(Transaction).filter(Transaction.branch_id == branch.id)

            if filters.start_date:
                txn_query = txn_query.filter(Transaction.created_at >= filters.start_date)
            if filters.end_date:
                txn_query = txn_query.filter(Transaction.created_at <= filters.end_date)

            stats = db.query(
                func.count(Transaction.id).label('total'),
                func.coalesce(func.sum(Transaction.amount), 0).label('amount'),
                func.count(case((Transaction.status == TransactionStatus.COMPLETED, 1))).label('completed'),
                func.coalesce(func.sum(case((Transaction.status == TransactionStatus.COMPLETED, Transaction.amount))), 0).label('completed_amount'),
                func.count(case((Transaction.status == TransactionStatus.FAILED, 1))).label('failed')
            ).filter(Transaction.branch_id == branch.id)

            if filters.start_date:
                stats = stats.filter(Transaction.created_at >= filters.start_date)
            if filters.end_date:
                stats = stats.filter(Transaction.created_at <= filters.end_date)

            result = stats.first()

            # Count active tellers in branch
            active_tellers = db.query(User).filter(
                User.branch_id == branch.id,
                User.is_active == True,
                User.role == UserRole.TELLER
            ).count()

            total = result.total or 0
            completed = result.completed or 0
            success_rate = (completed / total * 100) if total > 0 else 0

            branch_summaries.append(BranchSummary(
                branch_id=str(branch.id),
                branch_code=branch.branch_code,
                branch_name=branch.branch_name,
                total_transactions=total,
                total_amount=result.amount or Decimal(0),
                completed_count=completed,
                completed_amount=result.completed_amount or Decimal(0),
                failed_count=result.failed or 0,
                success_rate=round(success_rate, 2),
                active_tellers=active_tellers
            ))

            total_system_transactions += total
            total_system_amount += result.amount or Decimal(0)

        # Sort by total transactions descending
        branch_summaries.sort(key=lambda x: x.total_transactions, reverse=True)

        return BranchComparisonReport(
            period_start=filters.start_date,
            period_end=filters.end_date,
            branches=branch_summaries,
            total_system_transactions=total_system_transactions,
            total_system_amount=total_system_amount
        )

    @staticmethod
    def get_failed_transactions(
        db: Session,
        current_user: User,
        filters: ReportFilters,
        page: int = 1,
        page_size: int = 20
    ) -> FailedTransactionsReport:
        """Get failed transactions report"""
        # Build base query for failed transactions
        query = db.query(Transaction).filter(
            Transaction.status.in_([TransactionStatus.FAILED, TransactionStatus.CANCELLED])
        )

        # Apply role-based filter
        query = ReportService._apply_role_filter(query, current_user, db)

        # Apply date filter
        query = ReportService._apply_date_filter(query, filters)

        # Apply branch filter for admin
        if filters.branch_id and current_user.role in [UserRole.ADMIN, UserRole.AUDITOR]:
            query = query.filter(Transaction.branch_id == filters.branch_id)

        # Get totals
        total_failed = query.count()
        total_failed_amount = db.query(
            func.coalesce(func.sum(Transaction.amount), 0)
        ).filter(
            Transaction.id.in_([t.id for t in query.all()])
        ).scalar() or Decimal(0) if total_failed > 0 else Decimal(0)

        # Paginate
        total_pages = (total_failed + page_size - 1) // page_size if total_failed > 0 else 1
        offset = (page - 1) * page_size
        transactions = query.order_by(Transaction.created_at.desc()).offset(offset).limit(page_size).all()

        # Build response
        failed_transactions = []
        for txn in transactions:
            # Get branch name
            branch_name = None
            if txn.branch_id:
                branch = db.query(Branch).filter(Branch.id == txn.branch_id).first()
                if branch:
                    branch_name = branch.branch_name

            # Get processor name
            processor_name = None
            if txn.processed_by:
                processor = db.query(User).filter(User.id == txn.processed_by).first()
                if processor:
                    processor_name = processor.full_name

            failed_transactions.append(FailedTransactionDetail(
                id=str(txn.id),
                reference_number=txn.reference_number,
                transaction_type=txn.transaction_type.value,
                customer_name=txn.customer_name,
                customer_cnic=txn.customer_cnic,
                amount=txn.amount,
                currency=txn.currency,
                branch_id=str(txn.branch_id) if txn.branch_id else None,
                branch_name=branch_name,
                processed_by=str(txn.processed_by) if txn.processed_by else None,
                processor_name=processor_name,
                failure_reason=txn.failure_reason,
                created_at=txn.created_at,
                failed_at=txn.failed_at
            ))

        return FailedTransactionsReport(
            period_start=filters.start_date,
            period_end=filters.end_date,
            total_failed=total_failed,
            total_failed_amount=total_failed_amount,
            transactions=failed_transactions,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )

    @staticmethod
    def get_audit_trail(
        db: Session,
        current_user: User,
        filters: ReportFilters,
        action: Optional[str] = None,
        entity_type: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> AuditTrailReport:
        """Get audit trail (Admin/Auditor only)"""
        query = db.query(AuditLog)

        # Apply date filter
        if filters.start_date:
            query = query.filter(AuditLog.created_at >= filters.start_date)
        if filters.end_date:
            query = query.filter(AuditLog.created_at <= filters.end_date)

        # Apply action filter
        if action:
            query = query.filter(AuditLog.action == action)

        # Apply entity_type filter
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)

        # Apply user filter
        if filters.user_id:
            query = query.filter(AuditLog.user_id == filters.user_id)

        # Get total count
        total_entries = query.count()

        # Paginate
        total_pages = (total_entries + page_size - 1) // page_size if total_entries > 0 else 1
        offset = (page - 1) * page_size
        logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size).all()

        # Build response
        entries = []
        for log in logs:
            # Get user info
            username = None
            full_name = None
            if log.user_id:
                user = db.query(User).filter(User.id == log.user_id).first()
                if user:
                    username = user.username
                    full_name = user.full_name

            entries.append(AuditTrailEntry(
                id=str(log.id),
                user_id=str(log.user_id) if log.user_id else None,
                username=username,
                full_name=full_name,
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                details=log.changes,
                ip_address=log.ip_address,
                created_at=log.created_at
            ))

        return AuditTrailReport(
            period_start=filters.start_date,
            period_end=filters.end_date,
            total_entries=total_entries,
            entries=entries,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )

    @staticmethod
    def export_to_csv(
        report_type: str,
        data: Any
    ) -> str:
        """Export report data to CSV format"""
        output = io.StringIO()
        writer = csv.writer(output)

        if report_type == 'summary':
            writer.writerow(['Metric', 'Count', 'Amount (PKR)'])
            writer.writerow(['Total', data.total_count, str(data.total_amount)])
            writer.writerow(['Completed', data.completed_count, str(data.completed_amount)])
            writer.writerow(['Pending', data.pending_count, str(data.pending_amount)])
            writer.writerow(['Failed', data.failed_count, str(data.failed_amount)])
            writer.writerow(['Cancelled', data.cancelled_count, str(data.cancelled_amount)])
            writer.writerow([])
            writer.writerow(['By Type', 'Count', 'Amount (PKR)'])
            for type_name, breakdown in data.by_type.items():
                writer.writerow([type_name, breakdown.count, str(breakdown.amount)])

        elif report_type == 'user_activity':
            writer.writerow([
                'Username', 'Full Name', 'Role', 'Branch',
                'Total Transactions', 'Total Amount', 'Completed', 'Failed', 'Success Rate'
            ])
            for user in data.users:
                writer.writerow([
                    user.username, user.full_name, user.role, user.branch_name or 'N/A',
                    user.total_transactions, str(user.total_amount),
                    user.completed_count, user.failed_count, f"{user.success_rate}%"
                ])

        elif report_type == 'trends':
            writer.writerow([
                'Period', 'Transactions', 'Amount (PKR)', 'Completed', 'Failed', 'Pending'
            ])
            for point in data.data_points:
                writer.writerow([
                    point.period_label, point.transaction_count, str(point.total_amount),
                    point.completed_count, point.failed_count, point.pending_count
                ])

        elif report_type == 'branch_comparison':
            writer.writerow([
                'Branch Code', 'Branch Name', 'Transactions', 'Amount (PKR)',
                'Completed', 'Failed', 'Success Rate', 'Active Tellers'
            ])
            for branch in data.branches:
                writer.writerow([
                    branch.branch_code, branch.branch_name, branch.total_transactions,
                    str(branch.total_amount), branch.completed_count, branch.failed_count,
                    f"{branch.success_rate}%", branch.active_tellers
                ])

        elif report_type == 'failed':
            writer.writerow([
                'Reference', 'Type', 'Customer', 'CNIC', 'Amount', 'Branch',
                'Processor', 'Failure Reason', 'Date'
            ])
            for txn in data.transactions:
                writer.writerow([
                    txn.reference_number, txn.transaction_type, txn.customer_name,
                    txn.customer_cnic, str(txn.amount), txn.branch_name or 'N/A',
                    txn.processor_name or 'N/A', txn.failure_reason or 'N/A',
                    txn.created_at.strftime('%Y-%m-%d %H:%M')
                ])

        elif report_type == 'audit':
            writer.writerow([
                'Date/Time', 'User', 'Action', 'Entity Type', 'Entity ID', 'IP Address'
            ])
            for entry in data.entries:
                writer.writerow([
                    entry.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    entry.username or 'System', entry.action, entry.entity_type,
                    entry.entity_id or 'N/A', entry.ip_address or 'N/A'
                ])

        return output.getvalue()
