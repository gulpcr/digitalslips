# app/api/v1/transactions.py
"""
Transaction API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid

from app.core.database import get_db
from app.models import Transaction, Customer, Account, User, TransactionStatus, TransactionType

router = APIRouter()


# Pydantic schemas for request/response
from pydantic import BaseModel

class TransactionCreate(BaseModel):
    transaction_type: str
    customer_cnic: str
    customer_account: str
    amount: float
    currency: str = "PKR"
    narration: Optional[str] = None
    depositor_cnic: Optional[str] = None
    depositor_name: Optional[str] = None
    depositor_phone: Optional[str] = None

class TransactionResponse(BaseModel):
    id: str
    reference_number: str
    transaction_type: str
    customer_name: str
    customer_cnic: str
    customer_account: str
    amount: float
    currency: str
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


@router.get("/", response_model=List[TransactionResponse])
async def get_transactions(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all transactions with pagination"""
    query = db.query(Transaction)
    
    if status:
        query = query.filter(Transaction.status == status)
    
    transactions = query.order_by(Transaction.created_at.desc()).offset(skip).limit(limit).all()
    
    return [
        TransactionResponse(
            id=str(txn.id),
            reference_number=txn.reference_number,
            transaction_type=txn.transaction_type.value,
            customer_name=txn.customer_name,
            customer_cnic=txn.customer_cnic,
            customer_account=txn.customer_account,
            amount=float(txn.amount),
            currency=txn.currency,
            status=txn.status.value,
            created_at=txn.created_at
        )
        for txn in transactions
    ]


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: str,
    db: Session = Depends(get_db)
):
    """Get single transaction by ID"""
    txn = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    
    if not txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    return TransactionResponse(
        id=str(txn.id),
        reference_number=txn.reference_number,
        transaction_type=txn.transaction_type.value,
        customer_name=txn.customer_name,
        customer_cnic=txn.customer_cnic,
        customer_account=txn.customer_account,
        amount=float(txn.amount),
        currency=txn.currency,
        status=txn.status.value,
        created_at=txn.created_at
    )


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction: TransactionCreate,
    db: Session = Depends(get_db)
):
    """Create a new transaction"""
    
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
    
    # Generate reference number
    ref_number = f"TXN-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
    
    # Create transaction
    new_txn = Transaction(
        reference_number=ref_number,
        transaction_type=TransactionType[transaction.transaction_type],
        transaction_category="DEPOSIT",  # Simplified for now
        customer_id=customer.id,
        customer_cnic=customer.cnic,
        customer_name=customer.full_name,
        customer_account=account.account_number,
        depositor_cnic=transaction.depositor_cnic,
        depositor_name=transaction.depositor_name,
        depositor_phone=transaction.depositor_phone,
        amount=transaction.amount,
        currency=transaction.currency,
        exchange_rate=1.0,
        amount_in_base_currency=transaction.amount,
        fee=0,
        tax=0,
        total_amount=transaction.amount,
        status=TransactionStatus.COMPLETED,
        channel="WEB",
        narration=transaction.narration,
        branch_id=account.branch_id,
        processed_by=None,  # TODO: Get from auth
        completed_at=datetime.utcnow()
    )
    
    db.add(new_txn)
    db.commit()
    db.refresh(new_txn)
    
    return TransactionResponse(
        id=str(new_txn.id),
        reference_number=new_txn.reference_number,
        transaction_type=new_txn.transaction_type.value,
        customer_name=new_txn.customer_name,
        customer_cnic=new_txn.customer_cnic,
        customer_account=new_txn.customer_account,
        amount=float(new_txn.amount),
        currency=new_txn.currency,
        status=new_txn.status.value,
        created_at=new_txn.created_at
    )
