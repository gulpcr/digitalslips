# app/api/v1/demo.py
"""
Demo Setup API - For demonstration purposes
Allows quick creation of customers and accounts
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal
import uuid

from app.core.database import get_db
from app.core.security import hash_password
from app.models import (
    Customer, Account, Branch, User, UserRole,
    Gender, KycStatus, AccountType, AccountStatus
)

router = APIRouter()


class CustomerCreateDemo(BaseModel):
    """Demo customer creation schema"""
    cnic: str
    full_name: str
    phone: str
    email: Optional[str] = None
    address: str = "Demo Address, Karachi"
    city: str = "Karachi"
    initial_balance: Decimal = Decimal("100000.00")


class CustomerAccountResponse(BaseModel):
    """Response with customer and account details"""
    success: bool
    message: str
    customer: dict
    account: dict


@router.post("/create-customer", response_model=CustomerAccountResponse)
async def create_demo_customer(
    data: CustomerCreateDemo,
    db: Session = Depends(get_db)
):
    """
    Create a demo customer with an account

    This endpoint is for demonstration purposes.
    Creates a customer and a savings account in one step.
    """

    # Check if customer already exists
    existing = db.query(Customer).filter(Customer.cnic == data.cnic).first()
    if existing:
        # Get their account
        account = db.query(Account).filter(Account.customer_id == existing.id).first()
        return CustomerAccountResponse(
            success=True,
            message="Customer already exists",
            customer={
                "id": str(existing.id),
                "cnic": existing.cnic,
                "full_name": existing.full_name,
                "phone": existing.phone,
                "email": existing.email,
            },
            account={
                "id": str(account.id) if account else None,
                "account_number": account.account_number if account else None,
                "balance": str(account.balance) if account else "0",
            }
        )

    # Get default branch (Karachi Main)
    branch = db.query(Branch).filter(Branch.branch_code == "KHI001").first()
    if not branch:
        branch = db.query(Branch).first()

    if not branch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No branch found. Please run the seed script first."
        )

    # Create customer
    customer = Customer(
        cnic=data.cnic,
        full_name=data.full_name,
        phone=data.phone,
        email=data.email,
        address=data.address,
        city=data.city,
        province="Sindh",
        gender=Gender.MALE,
        is_verified=True,
        verified_at=datetime.utcnow(),
        kyc_status=KycStatus.VERIFIED
    )

    db.add(customer)
    db.commit()
    db.refresh(customer)

    # Generate account number (format: 01 + 11 digits)
    account_number = f"01{str(uuid.uuid4().int)[:11]}"

    # Create savings account
    account = Account(
        account_number=account_number,
        customer_id=customer.id,
        account_type=AccountType.SAVINGS,
        account_title=f"{data.full_name} - Savings",
        account_status=AccountStatus.ACTIVE,
        currency="PKR",
        balance=data.initial_balance,
        available_balance=data.initial_balance,
        daily_limit=Decimal("500000.00"),
        monthly_limit=Decimal("5000000.00"),
        branch_id=branch.id
    )

    db.add(account)
    db.commit()
    db.refresh(account)

    return CustomerAccountResponse(
        success=True,
        message="Customer and account created successfully",
        customer={
            "id": str(customer.id),
            "cnic": customer.cnic,
            "full_name": customer.full_name,
            "phone": customer.phone,
            "email": customer.email,
        },
        account={
            "id": str(account.id),
            "account_number": account.account_number,
            "balance": str(account.balance),
        }
    )


@router.get("/customers")
async def list_demo_customers(
    db: Session = Depends(get_db)
):
    """List all customers with their accounts (for demo)"""
    customers = db.query(Customer).order_by(Customer.created_at.desc()).limit(20).all()

    result = []
    for c in customers:
        accounts = db.query(Account).filter(Account.customer_id == c.id).all()
        result.append({
            "id": str(c.id),
            "cnic": c.cnic,
            "full_name": c.full_name,
            "phone": c.phone,
            "accounts": [
                {
                    "account_number": a.account_number,
                    "balance": str(a.balance),
                    "type": a.account_type.value
                }
                for a in accounts
            ]
        })

    return {
        "success": True,
        "count": len(result),
        "customers": result
    }


@router.delete("/reset")
async def reset_demo_data(
    db: Session = Depends(get_db)
):
    """
    Reset demo data - clears all deposit slips
    Use with caution!
    """
    from app.models import DigitalDepositSlip

    # Delete all deposit slips
    deleted = db.query(DigitalDepositSlip).delete()
    db.commit()

    return {
        "success": True,
        "message": f"Deleted {deleted} deposit slips"
    }


@router.post("/seed")
async def seed_database(
    db: Session = Depends(get_db)
):
    """
    Seed the database with initial data (branches, admin user)
    Safe to call multiple times - skips existing data
    """
    created = []

    # Create default branch if not exists
    branch = db.query(Branch).filter(Branch.branch_code == "KHI001").first()
    if not branch:
        branch = Branch(
            branch_code="KHI001",
            branch_name="Karachi Main Branch",
            address="I.I. Chundrigar Road, Karachi",
            city="Karachi",
            province="Sindh",
            phone="+92-21-32419181",
            is_active=True,
            is_head_office=True
        )
        db.add(branch)
        db.commit()
        db.refresh(branch)
        created.append("Karachi Main Branch")

    # Create Lahore branch if not exists
    lahore_branch = db.query(Branch).filter(Branch.branch_code == "LHR001").first()
    if not lahore_branch:
        lahore_branch = Branch(
            branch_code="LHR001",
            branch_name="Lahore Main Branch",
            address="Mall Road, Lahore",
            city="Lahore",
            province="Punjab",
            phone="+92-42-35761234",
            is_active=True,
            is_head_office=False
        )
        db.add(lahore_branch)
        db.commit()
        created.append("Lahore Main Branch")

    # Create admin user if not exists
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        admin = User(
            username="admin",
            email="admin@meezanbank.com",
            password_hash=hash_password("Admin@123456"),
            full_name="System Administrator",
            role=UserRole.ADMIN,
            branch_id=branch.id,
            is_active=True,
            is_locked=False,
            failed_login_attempts=0,
            password_changed_at=datetime.utcnow()
        )
        db.add(admin)
        db.commit()
        created.append("Admin user (admin / Admin@123456)")
    else:
        # Reset admin password and unlock if locked
        admin.password_hash = hash_password("Admin@123456")
        admin.is_locked = False
        admin.is_active = True
        admin.failed_login_attempts = 0
        db.commit()
        created.append("Admin user reset (admin / Admin@123456)")

    # Create teller user if not exists
    teller = db.query(User).filter(User.username == "teller").first()
    if not teller:
        teller = User(
            username="teller",
            email="teller@meezanbank.com",
            password_hash=hash_password("Teller@123"),
            full_name="Demo Teller",
            role=UserRole.TELLER,
            branch_id=branch.id,
            is_active=True,
            is_locked=False,
            failed_login_attempts=0,
            password_changed_at=datetime.utcnow()
        )
        db.add(teller)
        db.commit()
        created.append("Teller user (teller / Teller@123)")
    else:
        # Reset teller password and unlock if locked
        teller.password_hash = hash_password("Teller@123")
        teller.is_locked = False
        teller.is_active = True
        teller.failed_login_attempts = 0
        db.commit()
        created.append("Teller user reset (teller / Teller@123)")

    return {
        "success": True,
        "message": "Database seeded successfully",
        "created": created,
        "credentials": {
            "admin": {"username": "admin", "password": "Admin@123456"},
            "teller": {"username": "teller", "password": "Teller@123"}
        }
    }


@router.post("/unlock-admin")
async def unlock_admin(
    db: Session = Depends(get_db)
):
    """
    Unlock and reset the admin account
    Use if admin account is locked due to failed login attempts
    """
    admin = db.query(User).filter(User.username == "admin").first()

    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin user not found. Run /seed first."
        )

    # Unlock and reset
    admin.is_locked = False
    admin.is_active = True
    admin.failed_login_attempts = 0
    admin.password_hash = hash_password("Admin@123456")
    db.commit()

    return {
        "success": True,
        "message": "Admin account unlocked and password reset",
        "credentials": {"username": "admin", "password": "Admin@123456"}
    }
