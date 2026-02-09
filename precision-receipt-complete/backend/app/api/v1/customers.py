# app/api/v1/customers.py
"""
Customer API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from app.core.database import get_db
from app.middleware.auth import get_current_active_user, require_teller_or_above
from app.models import Customer, Account, User
from app.schemas.customer import (
    CustomerResponse, CustomerSearchRequest, CustomerWithAccountsResponse,
    AccountResponse
)

router = APIRouter()


@router.get("/", response_model=List[CustomerResponse])
async def get_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    city: Optional[str] = None,
    current_user: User = Depends(require_teller_or_above),
    db: Session = Depends(get_db)
):
    """
    Get all customers with optional search and filtering
    """
    query = db.query(Customer)

    # Search by CNIC, name, or phone
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Customer.cnic.ilike(search_term),
                Customer.full_name.ilike(search_term),
                Customer.phone.ilike(search_term)
            )
        )

    # Filter by city
    if city:
        query = query.filter(Customer.city.ilike(f"%{city}%"))

    # Order and paginate
    customers = query.order_by(Customer.full_name).offset(skip).limit(limit).all()

    return [
        CustomerResponse(
            id=str(c.id),
            cnic=c.cnic,
            full_name=c.full_name,
            father_name=c.father_name,
            date_of_birth=c.date_of_birth,
            gender=c.gender.value if c.gender else None,
            phone=c.phone,
            alternate_phone=c.alternate_phone,
            email=c.email,
            address=c.address,
            city=c.city,
            province=c.province,
            postal_code=c.postal_code,
            occupation=c.occupation,
            monthly_income=c.monthly_income,
            is_verified=c.is_verified,
            kyc_status=c.kyc_status.value,
            is_blocked=c.is_blocked,
            created_at=c.created_at
        )
        for c in customers
    ]


@router.get("/search", response_model=List[CustomerResponse])
async def search_customers(
    cnic: Optional[str] = None,
    phone: Optional[str] = None,
    name: Optional[str] = None,
    current_user: User = Depends(require_teller_or_above),
    db: Session = Depends(get_db)
):
    """
    Search customers by CNIC, phone, or name
    """
    query = db.query(Customer)

    if cnic:
        query = query.filter(Customer.cnic == cnic)
    elif phone:
        query = query.filter(Customer.phone.ilike(f"%{phone}%"))
    elif name:
        query = query.filter(Customer.full_name.ilike(f"%{name}%"))
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one search parameter is required"
        )

    customers = query.limit(20).all()

    return [
        CustomerResponse(
            id=str(c.id),
            cnic=c.cnic,
            full_name=c.full_name,
            father_name=c.father_name,
            date_of_birth=c.date_of_birth,
            gender=c.gender.value if c.gender else None,
            phone=c.phone,
            alternate_phone=c.alternate_phone,
            email=c.email,
            address=c.address,
            city=c.city,
            province=c.province,
            postal_code=c.postal_code,
            occupation=c.occupation,
            monthly_income=c.monthly_income,
            is_verified=c.is_verified,
            kyc_status=c.kyc_status.value,
            is_blocked=c.is_blocked,
            created_at=c.created_at
        )
        for c in customers
    ]


@router.get("/by-cnic/{cnic}", response_model=CustomerWithAccountsResponse)
async def get_customer_by_cnic(
    cnic: str,
    current_user: User = Depends(require_teller_or_above),
    db: Session = Depends(get_db)
):
    """
    Get customer by CNIC with their accounts
    """
    customer = db.query(Customer).filter(Customer.cnic == cnic).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with CNIC {cnic} not found"
        )

    # Get accounts
    accounts = db.query(Account).filter(Account.customer_id == customer.id).all()

    account_responses = [
        AccountResponse(
            id=str(a.id),
            account_number=a.account_number,
            account_type=a.account_type.value,
            account_title=a.account_title,
            account_status=a.account_status.value,
            currency=a.currency,
            balance=a.balance,
            available_balance=a.available_balance,
            branch_id=str(a.branch_id),
            created_at=a.created_at
        )
        for a in accounts
    ]

    return CustomerWithAccountsResponse(
        id=str(customer.id),
        cnic=customer.cnic,
        full_name=customer.full_name,
        father_name=customer.father_name,
        date_of_birth=customer.date_of_birth,
        gender=customer.gender.value if customer.gender else None,
        phone=customer.phone,
        alternate_phone=customer.alternate_phone,
        email=customer.email,
        address=customer.address,
        city=customer.city,
        province=customer.province,
        postal_code=customer.postal_code,
        occupation=customer.occupation,
        monthly_income=customer.monthly_income,
        is_verified=customer.is_verified,
        kyc_status=customer.kyc_status.value,
        is_blocked=customer.is_blocked,
        created_at=customer.created_at,
        accounts=account_responses
    )


@router.get("/{customer_id}", response_model=CustomerWithAccountsResponse)
async def get_customer(
    customer_id: str,
    current_user: User = Depends(require_teller_or_above),
    db: Session = Depends(get_db)
):
    """
    Get customer by ID with their accounts
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    # Get accounts
    accounts = db.query(Account).filter(Account.customer_id == customer.id).all()

    account_responses = [
        AccountResponse(
            id=str(a.id),
            account_number=a.account_number,
            account_type=a.account_type.value,
            account_title=a.account_title,
            account_status=a.account_status.value,
            currency=a.currency,
            balance=a.balance,
            available_balance=a.available_balance,
            branch_id=str(a.branch_id),
            created_at=a.created_at
        )
        for a in accounts
    ]

    return CustomerWithAccountsResponse(
        id=str(customer.id),
        cnic=customer.cnic,
        full_name=customer.full_name,
        father_name=customer.father_name,
        date_of_birth=customer.date_of_birth,
        gender=customer.gender.value if customer.gender else None,
        phone=customer.phone,
        alternate_phone=customer.alternate_phone,
        email=customer.email,
        address=customer.address,
        city=customer.city,
        province=customer.province,
        postal_code=customer.postal_code,
        occupation=customer.occupation,
        monthly_income=customer.monthly_income,
        is_verified=customer.is_verified,
        kyc_status=customer.kyc_status.value,
        is_blocked=customer.is_blocked,
        created_at=customer.created_at,
        accounts=account_responses
    )
