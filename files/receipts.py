# app/api/v1/receipts.py
"""
Receipt API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import uuid

from app.core.database import get_db
from app.models import Receipt, Transaction, ReceiptType

router = APIRouter()

from pydantic import BaseModel

class ReceiptResponse(BaseModel):
    id: str
    transaction_id: str
    receipt_number: str
    receipt_type: str
    verification_url: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


@router.get("/{transaction_id}", response_model=ReceiptResponse)
async def get_receipt(
    transaction_id: str,
    db: Session = Depends(get_db)
):
    """Get receipt for a transaction"""
    
    # Check if transaction exists
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    # Check if receipt already exists
    receipt = db.query(Receipt).filter(Receipt.transaction_id == transaction_id).first()
    
    # If no receipt, create one
    if not receipt:
        receipt_number = f"RCP-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        verification_url = f"https://verify.meezanbank.com/receipt/{receipt_number}"
        
        receipt = Receipt(
            transaction_id=transaction.id,
            receipt_number=receipt_number,
            receipt_type=ReceiptType.DIGITAL,
            verification_url=verification_url,
            is_verified=False,
            verified_count=0
        )
        
        db.add(receipt)
        db.commit()
        db.refresh(receipt)
    
    return ReceiptResponse(
        id=str(receipt.id),
        transaction_id=str(receipt.transaction_id),
        receipt_number=receipt.receipt_number,
        receipt_type=receipt.receipt_type.value,
        verification_url=receipt.verification_url,
        created_at=receipt.created_at
    )


@router.post("/{transaction_id}/verify")
async def verify_receipt(
    transaction_id: str,
    db: Session = Depends(get_db)
):
    """Verify a receipt"""
    
    receipt = db.query(Receipt).filter(Receipt.transaction_id == transaction_id).first()
    
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )
    
    # Update verification
    receipt.is_verified = True
    receipt.verified_count += 1
    receipt.last_verified_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "success": True,
        "message": "Receipt verified successfully",
        "verified_count": receipt.verified_count
    }
