# app/api/v1/transactions.py
"""
Transaction API Endpoints - Full Implementation
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import datetime, timedelta
from decimal import Decimal
import uuid

from app.core.database import get_db
from app.middleware.auth import get_current_active_user, get_current_user, require_teller_or_above
from app.models import (
    Transaction, Customer, Account, User, Receipt,
    TransactionStatus, TransactionType, TransactionCategory, Channel
)
from app.services.receipt_service import ReceiptService
from app.services.notification_service import NotificationService
from app.schemas.transaction import (
    TransactionCreate, TransactionResponse, TransactionListResponse,
    TransactionFilterParams, TransactionStats
)

router = APIRouter()


def transaction_to_response(txn: Transaction) -> TransactionResponse:
    """Convert Transaction model to response schema"""
    return TransactionResponse(
        id=str(txn.id),
        reference_number=txn.reference_number,
        transaction_type=txn.transaction_type.value,
        transaction_category=txn.transaction_category.value if txn.transaction_category else "DEPOSIT",
        customer_id=str(txn.customer_id),
        customer_cnic=txn.customer_cnic,
        customer_name=txn.customer_name,
        customer_account=txn.customer_account,
        depositor_cnic=txn.depositor_cnic,
        depositor_name=txn.depositor_name,
        depositor_phone=txn.depositor_phone,
        amount=txn.amount,
        currency=txn.currency,
        fee=txn.fee,
        tax=txn.tax,
        total_amount=txn.total_amount,
        status=txn.status.value,
        channel=txn.channel.value if txn.channel else "WEB",
        narration=txn.narration,
        branch_id=str(txn.branch_id),
        created_at=txn.created_at,
        completed_at=txn.completed_at,
        additional_data=txn.extra_data
    )


@router.get("/", response_model=TransactionListResponse)
async def get_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    transaction_type: Optional[str] = None,
    customer_cnic: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all transactions with pagination and filtering"""
    query = db.query(Transaction)

    # Apply filters
    if status:
        query = query.filter(Transaction.status == TransactionStatus[status])

    if transaction_type:
        query = query.filter(Transaction.transaction_type == TransactionType[transaction_type])

    if customer_cnic:
        query = query.filter(Transaction.customer_cnic == customer_cnic)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Transaction.reference_number.ilike(search_term)) |
            (Transaction.customer_name.ilike(search_term)) |
            (Transaction.customer_cnic.ilike(search_term))
        )

    if start_date:
        query = query.filter(Transaction.created_at >= start_date)

    if end_date:
        query = query.filter(Transaction.created_at <= end_date)

    # Get total count
    total = query.count()

    # Calculate pagination
    skip = (page - 1) * page_size
    total_pages = (total + page_size - 1) // page_size

    # Get paginated results
    transactions = query.order_by(Transaction.created_at.desc()).offset(skip).limit(page_size).all()

    return TransactionListResponse(
        success=True,
        data=[transaction_to_response(txn) for txn in transactions],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/stats", response_model=TransactionStats)
async def get_transaction_stats(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transaction statistics"""
    query = db.query(Transaction)

    # Default to last 30 days
    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=30)
    if not end_date:
        end_date = datetime.utcnow()

    query = query.filter(
        and_(
            Transaction.created_at >= start_date,
            Transaction.created_at <= end_date
        )
    )

    transactions = query.all()

    # Calculate stats
    total_count = len(transactions)
    total_amount = sum(t.amount for t in transactions)
    completed_count = sum(1 for t in transactions if t.status == TransactionStatus.COMPLETED)
    pending_count = sum(1 for t in transactions if t.status in [TransactionStatus.PENDING, TransactionStatus.PROCESSING, TransactionStatus.INITIATED])
    failed_count = sum(1 for t in transactions if t.status in [TransactionStatus.FAILED, TransactionStatus.CANCELLED])

    # Group by type
    by_type = {}
    for t in transactions:
        type_name = t.transaction_type.value
        by_type[type_name] = by_type.get(type_name, 0) + 1

    # Group by status
    by_status = {}
    for t in transactions:
        status_name = t.status.value
        by_status[status_name] = by_status.get(status_name, 0) + 1

    return TransactionStats(
        total_count=total_count,
        total_amount=total_amount,
        completed_count=completed_count,
        pending_count=pending_count,
        failed_count=failed_count,
        by_type=by_type,
        by_status=by_status
    )


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get single transaction by ID"""
    txn = db.query(Transaction).filter(Transaction.id == transaction_id).first()

    if not txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    return transaction_to_response(txn)


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction: TransactionCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new transaction with receipt and notifications"""

    # Find customer by CNIC
    customer = db.query(Customer).filter(Customer.cnic == transaction.customer_cnic).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with CNIC {transaction.customer_cnic} not found"
        )

    # Find account
    account = db.query(Account).filter(Account.account_number == transaction.customer_account).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account {transaction.customer_account} not found"
        )

    # Verify account belongs to customer
    if account.customer_id != customer.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account does not belong to the specified customer"
        )

    # Generate reference number
    ref_number = f"TXN-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

    # Determine transaction category
    category_map = {
        "CASH_DEPOSIT": TransactionCategory.DEPOSIT,
        "CHEQUE_DEPOSIT": TransactionCategory.DEPOSIT,
        "PAY_ORDER": TransactionCategory.PAYMENT,
        "BILL_PAYMENT": TransactionCategory.PAYMENT,
        "FUND_TRANSFER": TransactionCategory.TRANSFER
    }
    category = category_map.get(transaction.transaction_type, TransactionCategory.DEPOSIT)

    # Calculate fees (simplified)
    fee = Decimal("0")
    tax = Decimal("0")
    total_amount = transaction.amount + fee + tax

    # Get processor ID
    processor_id = current_user.id if current_user else None

    # Create transaction
    new_txn = Transaction(
        reference_number=ref_number,
        transaction_type=TransactionType[transaction.transaction_type],
        transaction_category=category,
        customer_id=customer.id,
        customer_cnic=customer.cnic,
        customer_name=customer.full_name,
        customer_account=account.account_number,
        depositor_cnic=transaction.depositor_cnic,
        depositor_name=transaction.depositor_name,
        depositor_phone=transaction.depositor_phone,
        amount=transaction.amount,
        currency=transaction.currency,
        exchange_rate=Decimal("1.0"),
        amount_in_base_currency=transaction.amount,
        fee=fee,
        tax=tax,
        total_amount=total_amount,
        status=TransactionStatus.COMPLETED,
        channel=Channel[transaction.channel] if hasattr(transaction, 'channel') else Channel.WEB,
        narration=transaction.narration,
        branch_id=account.branch_id,
        processed_by=processor_id,
        completed_at=datetime.utcnow(),
        extra_data=transaction.additional_data  # Store type-specific fields
    )

    db.add(new_txn)
    db.commit()
    db.refresh(new_txn)

    # Create receipt with QR code
    receipt = ReceiptService.create_receipt(db, new_txn, "DIGITAL")

    # Send notifications in background
    async def send_notifications():
        await NotificationService.send_transaction_notifications(
            db=db,
            transaction=new_txn,
            receipt=receipt,
            customer=customer
        )

    background_tasks.add_task(send_notifications)

    return transaction_to_response(new_txn)


@router.get("/{transaction_id}/notifications")
async def get_transaction_notifications(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get notifications for a transaction"""
    txn = db.query(Transaction).filter(Transaction.id == transaction_id).first()

    if not txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    notifications = NotificationService.get_notification_status(db, transaction_id)

    return {
        "success": True,
        "transaction_id": transaction_id,
        "notifications": notifications
    }
