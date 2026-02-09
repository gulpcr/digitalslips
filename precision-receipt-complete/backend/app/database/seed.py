# app/database/seed.py
"""
Seed database with initial Pakistani banking data
"""
import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from passlib.context import CryptContext
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import (
    Base, User, Branch, Customer, Account, SystemSettings,
    UserRole, BranchType, Gender, KycStatus, AccountType, AccountStatus
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://precision:precision123@localhost:5432/precision_receipt")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_admin_user(db, admin_branch_id):
    """Create admin user"""
    admin = User(
        username="admin",
        email="admin@meezanbank.com",
        password_hash=pwd_context.hash("Admin@123456"),
        full_name="System Administrator",
        role=UserRole.ADMIN,
        branch_id=admin_branch_id,
        phone="+92-300-1234567",
        is_active=True,
        password_changed_at=datetime.utcnow()
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


def create_branches(db):
    """Create bank branches"""
    branches_data = [
        {
            "branch_code": "KHI001",
            "branch_name": "Main Branch Karachi",
            "branch_type": BranchType.MAIN,
            "region": "South",
            "address": "I.I. Chundrigar Road, Karachi",
            "city": "Karachi",
            "state": "Sindh",
            "postal_code": "74000",
            "phone": "+92-21-32456789",
            "email": "khi001@meezanbank.com",
            "latitude": Decimal("24.8607"),
            "longitude": Decimal("67.0011"),
            "working_hours": {
                "monday": "09:00-17:00",
                "tuesday": "09:00-17:00",
                "wednesday": "09:00-17:00",
                "thursday": "09:00-17:00",
                "friday": "09:00-12:00",
                "saturday": "CLOSED",
                "sunday": "CLOSED"
            },
            "opened_at": datetime(2010, 1, 15)
        },
        {
            "branch_code": "KHI002",
            "branch_name": "Gulshan Branch",
            "branch_type": BranchType.SUB,
            "region": "South",
            "address": "Gulshan-e-Iqbal Block 13-D, Karachi",
            "city": "Karachi",
            "state": "Sindh",
            "postal_code": "75300",
            "phone": "+92-21-34987654",
            "email": "khi002@meezanbank.com",
            "latitude": Decimal("24.9207"),
            "longitude": Decimal("67.0934"),
            "working_hours": {
                "monday": "09:00-17:00",
                "tuesday": "09:00-17:00",
                "wednesday": "09:00-17:00",
                "thursday": "09:00-17:00",
                "friday": "09:00-12:00",
                "saturday": "CLOSED",
                "sunday": "CLOSED"
            },
            "opened_at": datetime(2015, 6, 1)
        },
        {
            "branch_code": "LHR001",
            "branch_name": "Main Branch Lahore",
            "branch_type": BranchType.MAIN,
            "region": "Central",
            "address": "Main Boulevard Gulberg, Lahore",
            "city": "Lahore",
            "state": "Punjab",
            "postal_code": "54000",
            "phone": "+92-42-35714567",
            "email": "lhr001@meezanbank.com",
            "latitude": Decimal("31.5204"),
            "longitude": Decimal("74.3587"),
            "working_hours": {
                "monday": "09:00-17:00",
                "tuesday": "09:00-17:00",
                "wednesday": "09:00-17:00",
                "thursday": "09:00-17:00",
                "friday": "09:00-12:00",
                "saturday": "CLOSED",
                "sunday": "CLOSED"
            },
            "opened_at": datetime(2012, 3, 20)
        },
        {
            "branch_code": "ISB001",
            "branch_name": "Main Branch Islamabad",
            "branch_type": BranchType.MAIN,
            "region": "North",
            "address": "Blue Area, Jinnah Avenue, Islamabad",
            "city": "Islamabad",
            "state": "Islamabad Capital Territory",
            "postal_code": "44000",
            "phone": "+92-51-2345678",
            "email": "isb001@meezanbank.com",
            "latitude": Decimal("33.7077"),
            "longitude": Decimal("73.0514"),
            "working_hours": {
                "monday": "09:00-17:00",
                "tuesday": "09:00-17:00",
                "wednesday": "09:00-17:00",
                "thursday": "09:00-17:00",
                "friday": "09:00-12:00",
                "saturday": "CLOSED",
                "sunday": "CLOSED"
            },
            "opened_at": datetime(2014, 8, 10)
        },
        {
            "branch_code": "FSD001",
            "branch_name": "Main Branch Faisalabad",
            "branch_type": BranchType.MAIN,
            "region": "Central",
            "address": "Civil Lines, Faisalabad",
            "city": "Faisalabad",
            "state": "Punjab",
            "postal_code": "38000",
            "phone": "+92-41-2654321",
            "email": "fsd001@meezanbank.com",
            "latitude": Decimal("31.4180"),
            "longitude": Decimal("73.0790"),
            "working_hours": {
                "monday": "09:00-17:00",
                "tuesday": "09:00-17:00",
                "wednesday": "09:00-17:00",
                "thursday": "09:00-17:00",
                "friday": "09:00-12:00",
                "saturday": "CLOSED",
                "sunday": "CLOSED"
            },
            "opened_at": datetime(2016, 11, 5)
        }
    ]

    branches = []
    for data in branches_data:
        branch = Branch(**data)
        db.add(branch)
        branches.append(branch)
    
    db.commit()
    for branch in branches:
        db.refresh(branch)
    
    return branches


def create_managers_and_tellers(db, branches):
    """Create branch managers and tellers"""
    users = []
    
    # Branch Managers
    managers_data = [
        {
            "username": "manager.khi",
            "email": "manager.khi@meezanbank.com",
            "full_name": "Ahmed Hassan",
            "branch": branches[0],  # Karachi Main
            "phone": "+92-300-2345678"
        },
        {
            "username": "manager.lhr",
            "email": "manager.lhr@meezanbank.com",
            "full_name": "Fatima Khan",
            "branch": branches[2],  # Lahore Main
            "phone": "+92-301-3456789"
        },
        {
            "username": "manager.isb",
            "email": "manager.isb@meezanbank.com",
            "full_name": "Muhammad Ali",
            "branch": branches[3],  # Islamabad Main
            "phone": "+92-302-4567890"
        }
    ]
    
    for data in managers_data:
        branch = data.pop("branch")
        manager = User(
            **data,
            password_hash=pwd_context.hash("Manager@123"),
            role=UserRole.MANAGER,
            branch_id=branch.id,
            is_active=True
        )
        db.add(manager)
        users.append(manager)
    
    # Tellers
    tellers_data = [
        {
            "username": "teller.khi1",
            "email": "teller.khi1@meezanbank.com",
            "full_name": "Sara Ahmed",
            "branch": branches[0],  # Karachi Main
            "phone": "+92-303-5678901"
        },
        {
            "username": "teller.khi2",
            "email": "teller.khi2@meezanbank.com",
            "full_name": "Zainab Malik",
            "branch": branches[1],  # Karachi Gulshan
            "phone": "+92-304-6789012"
        },
        {
            "username": "teller.lhr1",
            "email": "teller.lhr1@meezanbank.com",
            "full_name": "Usman Tariq",
            "branch": branches[2],  # Lahore
            "phone": "+92-305-7890123"
        },
        {
            "username": "teller.isb1",
            "email": "teller.isb1@meezanbank.com",
            "full_name": "Ayesha Siddiqui",
            "branch": branches[3],  # Islamabad
            "phone": "+92-306-8901234"
        }
    ]
    
    for data in tellers_data:
        branch = data.pop("branch")
        teller = User(
            **data,
            password_hash=pwd_context.hash("Teller@123"),
            role=UserRole.TELLER,
            branch_id=branch.id,
            is_active=True
        )
        db.add(teller)
        users.append(teller)
    
    db.commit()
    for user in users:
        db.refresh(user)
    
    return users


def create_customers(db):
    """Create sample customers"""
    customers_data = [
        {
            "cnic": "42101-1234567-1",
            "full_name": "Hassan Raza",
            "father_name": "Raza Ali",
            "date_of_birth": datetime(1985, 5, 15).date(),
            "gender": Gender.MALE,
            "phone": "+92-321-1111111",
            "alternate_phone": "+92-21-34567890",
            "email": "hassan.raza@email.com",
            "address": "House 123, Block 5, Clifton, Karachi",
            "city": "Karachi",
            "province": "Sindh",
            "postal_code": "75600",
            "occupation": "Business Owner",
            "monthly_income": Decimal("250000.00"),
            "is_verified": True,
            "verified_at": datetime.utcnow(),
            "kyc_status": KycStatus.VERIFIED
        },
        {
            "cnic": "42201-2345678-2",
            "full_name": "Aisha Tariq",
            "father_name": "Tariq Mahmood",
            "date_of_birth": datetime(1990, 8, 22).date(),
            "gender": Gender.FEMALE,
            "phone": "+92-321-2222222",
            "email": "aisha.tariq@email.com",
            "address": "Flat 45, DHA Phase 6, Karachi",
            "city": "Karachi",
            "province": "Sindh",
            "postal_code": "75500",
            "occupation": "Software Engineer",
            "monthly_income": Decimal("180000.00"),
            "is_verified": True,
            "verified_at": datetime.utcnow(),
            "kyc_status": KycStatus.VERIFIED
        },
        {
            "cnic": "35202-3456789-3",
            "full_name": "Bilal Ahmed",
            "father_name": "Ahmed Khan",
            "date_of_birth": datetime(1988, 3, 10).date(),
            "gender": Gender.MALE,
            "phone": "+92-321-3333333",
            "email": "bilal.ahmed@email.com",
            "address": "House 67, Model Town, Lahore",
            "city": "Lahore",
            "province": "Punjab",
            "postal_code": "54700",
            "occupation": "Doctor",
            "monthly_income": Decimal("300000.00"),
            "is_verified": True,
            "verified_at": datetime.utcnow(),
            "kyc_status": KycStatus.VERIFIED
        },
        {
            "cnic": "61101-4567890-4",
            "full_name": "Sana Malik",
            "father_name": "Malik Shahid",
            "date_of_birth": datetime(1992, 12, 5).date(),
            "gender": Gender.FEMALE,
            "phone": "+92-321-4444444",
            "email": "sana.malik@email.com",
            "address": "House 234, F-7, Islamabad",
            "city": "Islamabad",
            "province": "Islamabad Capital Territory",
            "postal_code": "44000",
            "occupation": "Banker",
            "monthly_income": Decimal("150000.00"),
            "is_verified": True,
            "verified_at": datetime.utcnow(),
            "kyc_status": KycStatus.VERIFIED
        },
        {
            "cnic": "42301-5678901-5",
            "full_name": "Imran Siddiqui",
            "father_name": "Siddiqui Nasir",
            "date_of_birth": datetime(1987, 7, 18).date(),
            "gender": Gender.MALE,
            "phone": "+92-321-5555555",
            "email": "imran.siddiqui@email.com",
            "address": "House 89, Peoples Colony, Faisalabad",
            "city": "Faisalabad",
            "province": "Punjab",
            "postal_code": "38000",
            "occupation": "Teacher",
            "monthly_income": Decimal("80000.00"),
            "is_verified": True,
            "verified_at": datetime.utcnow(),
            "kyc_status": KycStatus.VERIFIED
        }
    ]
    
    customers = []
    for data in customers_data:
        customer = Customer(**data)
        db.add(customer)
        customers.append(customer)
    
    db.commit()
    for customer in customers:
        db.refresh(customer)
    
    return customers


def create_accounts(db, customers, branches):
    """Create customer accounts"""
    accounts_data = [
        {
            "account_number": "0101234567890",
            "customer": customers[0],
            "account_type": AccountType.SAVINGS,
            "account_title": "Hassan Raza - Savings",
            "branch": branches[0],  # Karachi Main
            "balance": Decimal("500000.00"),
            "available_balance": Decimal("500000.00"),
            "daily_limit": Decimal("100000.00"),
            "monthly_limit": Decimal("1000000.00")
        },
        {
            "account_number": "0101234567891",
            "customer": customers[1],
            "account_type": AccountType.CURRENT,
            "account_title": "Aisha Tariq - Current",
            "branch": branches[0],  # Karachi Main
            "balance": Decimal("350000.00"),
            "available_balance": Decimal("350000.00"),
            "daily_limit": Decimal("150000.00"),
            "monthly_limit": Decimal("2000000.00")
        },
        {
            "account_number": "0301234567892",
            "customer": customers[2],
            "account_type": AccountType.SAVINGS,
            "account_title": "Bilal Ahmed - Savings",
            "branch": branches[2],  # Lahore
            "balance": Decimal("750000.00"),
            "available_balance": Decimal("750000.00"),
            "daily_limit": Decimal("200000.00"),
            "monthly_limit": Decimal("3000000.00")
        },
        {
            "account_number": "0401234567893",
            "customer": customers[3],
            "account_type": AccountType.CURRENT,
            "account_title": "Sana Malik - Current",
            "branch": branches[3],  # Islamabad
            "balance": Decimal("250000.00"),
            "available_balance": Decimal("250000.00"),
            "daily_limit": Decimal("100000.00"),
            "monthly_limit": Decimal("1500000.00")
        },
        {
            "account_number": "0501234567894",
            "customer": customers[4],
            "account_type": AccountType.SAVINGS,
            "account_title": "Imran Siddiqui - Savings",
            "branch": branches[4],  # Faisalabad
            "balance": Decimal("120000.00"),
            "available_balance": Decimal("120000.00"),
            "daily_limit": Decimal("50000.00"),
            "monthly_limit": Decimal("500000.00")
        }
    ]
    
    accounts = []
    for data in accounts_data:
        customer = data.pop("customer")
        branch = data.pop("branch")
        account = Account(
            **data,
            customer_id=customer.id,
            branch_id=branch.id,
            account_status=AccountStatus.ACTIVE
        )
        db.add(account)
        accounts.append(account)
    
    db.commit()
    for account in accounts:
        db.refresh(account)
    
    return accounts


def create_system_settings(db, admin_user):
    """Create system configuration settings"""
    settings_data = [
        # WhatsApp Configuration
        {"key": "whatsapp.enabled", "value": "true", "value_type": "boolean", "category": "whatsapp", "description": "Enable WhatsApp notifications"},
        {"key": "whatsapp.api_url", "value": "https://api.whatsapp.com/v1", "value_type": "string", "category": "whatsapp", "description": "WhatsApp API endpoint"},
        {"key": "whatsapp.api_key", "value": "YOUR_API_KEY", "value_type": "string", "category": "whatsapp", "description": "WhatsApp API key", "is_encrypted": True, "is_sensitive": True},
        
        # SMS Configuration
        {"key": "sms.enabled", "value": "true", "value_type": "boolean", "category": "sms", "description": "Enable SMS notifications"},
        {"key": "sms.provider", "value": "twilio", "value_type": "string", "category": "sms", "description": "SMS provider"},
        {"key": "sms.api_key", "value": "YOUR_TWILIO_KEY", "value_type": "string", "category": "sms", "description": "SMS API key", "is_encrypted": True, "is_sensitive": True},
        
        # Email Configuration
        {"key": "email.enabled", "value": "true", "value_type": "boolean", "category": "email", "description": "Enable email notifications"},
        {"key": "email.smtp_host", "value": "smtp.gmail.com", "value_type": "string", "category": "email", "description": "SMTP server host"},
        {"key": "email.smtp_port", "value": "587", "value_type": "integer", "category": "email", "description": "SMTP server port"},
        {"key": "email.from", "value": "noreply@meezanbank.com", "value_type": "string", "category": "email", "description": "From email address"},
        
        # Transaction Limits
        {"key": "transaction.daily_limit", "value": "500000.00", "value_type": "decimal", "category": "transaction", "description": "Default daily transaction limit"},
        {"key": "transaction.monthly_limit", "value": "5000000.00", "value_type": "decimal", "category": "transaction", "description": "Default monthly transaction limit"},
        {"key": "transaction.fee_percentage", "value": "0.01", "value_type": "decimal", "category": "transaction", "description": "Transaction fee percentage"},
        {"key": "transaction.min_fee", "value": "10.00", "value_type": "decimal", "category": "transaction", "description": "Minimum transaction fee"},
        
        # Security
        {"key": "security.session_timeout", "value": "3600", "value_type": "integer", "category": "security", "description": "Session timeout in seconds"},
        {"key": "security.max_login_attempts", "value": "3", "value_type": "integer", "category": "security", "description": "Maximum failed login attempts"},
        {"key": "security.lockout_duration", "value": "1800", "value_type": "integer", "category": "security", "description": "Account lockout duration in seconds"},
        
        # Receipt
        {"key": "receipt.qr_expiry_hours", "value": "24", "value_type": "integer", "category": "receipt", "description": "QR code expiry in hours"},
        {"key": "receipt.blockchain_enabled", "value": "true", "value_type": "boolean", "category": "receipt", "description": "Enable blockchain verification"},
        {"key": "receipt.blockchain_network", "value": "ethereum", "value_type": "string", "category": "receipt", "description": "Blockchain network"},
    ]
    
    for data in settings_data:
        setting = SystemSettings(**data, updated_by=admin_user.id)
        db.add(setting)
    
    db.commit()
    print("✅ Created system settings")


def seed_database():
    """Main seed function"""
    print("🌱 Starting database seeding...")
    
    # Create tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("✅ Created database tables")
    
    db = SessionLocal()
    
    try:
        # Create branches
        branches = create_branches(db)
        print(f"✅ Created {len(branches)} branches")
        
        # Create admin user
        admin = create_admin_user(db, branches[0].id)
        print("✅ Created admin user")
        
        # Create managers and tellers
        users = create_managers_and_tellers(db, branches)
        print(f"✅ Created {len(users)} users (managers and tellers)")
        
        # Create customers
        customers = create_customers(db)
        print(f"✅ Created {len(customers)} customers")
        
        # Create accounts
        accounts = create_accounts(db, customers, branches)
        print(f"✅ Created {len(accounts)} accounts")
        
        # Create system settings
        create_system_settings(db, admin)
        
        print("\n✅ Database seeding completed successfully!")
        print("\n📝 Default Credentials:")
        print("=" * 50)
        print(f"Admin: username='admin', password='Admin@123456'")
        print(f"Managers: password='Manager@123'")
        print(f"Tellers: password='Teller@123'")
        print("=" * 50)
        
    except Exception as e:
        print(f"❌ Error during seeding: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
