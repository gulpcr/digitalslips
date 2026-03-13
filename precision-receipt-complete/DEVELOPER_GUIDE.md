# Precision Receipt System - Developer Guide

**Version:** 1.0 | **Last Updated:** March 9, 2026
**Repository:** https://github.com/gulpcr/digitalslips.git

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Getting Started](#3-getting-started)
4. [Project Structure](#4-project-structure)
5. [Backend - Core Framework](#5-backend---core-framework)
6. [Database Models & Schema](#6-database-models--schema)
7. [API Reference](#7-api-reference)
8. [Service Layer](#8-service-layer)
9. [WhatsApp & SMS Adapters](#9-whatsapp--sms-adapters)
10. [Frontend Architecture](#10-frontend-architecture)
11. [Authentication & Authorization](#11-authentication--authorization)
12. [Configuration Reference](#12-configuration-reference)
13. [Docker & Deployment](#13-docker--deployment)
14. [Testing](#14-testing)
15. [Known Gaps & TODO](#15-known-gaps--todo)
16. [Coding Conventions](#16-coding-conventions)

---

## 1. Project Overview

### What is this?

The **Precision Receipt System** (Digital Deposit Slip - DDS) is a banking application for **Meezan Bank** that eliminates paper deposit slips. Customers generate a **DRID** (Digital Reference ID) via WhatsApp, SMS, or Web, then present it at a branch where a teller completes the transaction digitally.

### Core Business Flow

```
CUSTOMER                           TELLER (Branch)
────────                           ───────────────
1. Opens WhatsApp/SMS/Web
2. Selects deposit type
3. Enters CNIC + account
4. Enters amount
5. Gets DRID + QR code
6. Goes to bank branch        →   7. Scans QR / enters DRID
                                   8. Retrieves pre-filled slip
                                   9. Verifies identity + amount
                                  10. Completes transaction
                              ←   11. AML checks run automatically
                              ←   12. Digital receipt generated (RSA-2048 signed)
13. Receives receipt via          13. Receipt sent via WhatsApp/SMS/Email
    WhatsApp/SMS/Email
```

### DRID Lifecycle (State Machine)

```
INITIATED ──→ RETRIEVED ──→ VERIFIED ──→ PROCESSING ──→ COMPLETED
    │              │             │             │
    ├──→ EXPIRED   ├──→ CANCELLED├──→ REJECTED ├──→ FAILED
    └──→ CANCELLED └──→ REJECTED └──→ CANCELLED
```

| State | Trigger | Who |
|-------|---------|-----|
| `INITIATED` | Customer creates DRID | Customer (WhatsApp/SMS/Web) |
| `RETRIEVED` | Teller scans/enters DRID | Teller |
| `VERIFIED` | Teller confirms amount + identity | Teller |
| `PROCESSING` | System creates transaction | System |
| `COMPLETED` | AML passed, receipt generated | System |
| `EXPIRED` | 60-minute validity exceeded | System (background) |
| `CANCELLED` | Customer or teller cancels | Customer / Teller |
| `REJECTED` | Teller rejects (invalid docs) | Teller |

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend API | FastAPI + Uvicorn | 0.109.0 |
| Database | PostgreSQL | 15 (Alpine) |
| ORM | SQLAlchemy | 2.0.25 |
| Cache | Redis | 7 (Alpine) |
| Frontend | React + TypeScript | 18.2 + 5.3 |
| Build Tool | Vite | 5.0.10 |
| CSS | Tailwind CSS | 3.4.1 |
| State Mgmt | Zustand + React Query | 4.4.7 + 5.17.9 |
| Messaging | Twilio (WhatsApp + SMS) | 9.0.0 |
| OCR | OpenAI GPT-4o Vision | via HTTP API |
| Digital Signing | RSA-2048 / SHA-256 | cryptography 42.0 |
| Containerization | Docker Compose | 3.9 |

---

## 2. Architecture

### System Diagram

```
┌── CUSTOMER CHANNELS ──────────────────────────────────────┐
│  WhatsApp (Twilio)    SMS (Twilio)    Web Browser         │
└────────┬──────────────────┬───────────────┬───────────────┘
         │                  │               │
         │    ┌─────────────▼───────────────▼─────┐
         │    │        Nginx (port 3080)           │
         │    │   Reverse Proxy + Static Files     │
         │    │   /api/*    → backend:8000         │
         │    │   /         → React SPA (dist/)    │
         │    └──────────────┬────────────────────-┘
         │                   │
┌────────▼────────┐  ┌──────▼──────────┐
│  WhatsApp/SMS   │  │  Backend API    │
│  Server         │  │  FastAPI        │
│  (port 9001)    │  │  (port 8001)    │
│                 │  │                 │
│  Webhooks:      │  │  REST API:      │
│  POST /whatsapp │  │  /api/v1/*      │
│  POST /sms      │  │                 │
│  GET  /verify   │  │  11 Routers     │
└────────┬────────┘  └──────┬──────────┘
         │                   │
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐     ┌──────────────┐
         │   PostgreSQL      │     │    Redis      │
         │   (port 5434)     │     │   (port 6380) │
         │   11 tables       │     │   Sessions    │
         │   15 enums        │     │   Rate limit  │
         └───────────────────┘     └──────────────┘
```

### Service Dependencies

```
deposit_slips.py (API)
    └──→ DRIDService
            ├──→ QRService (QR code generation)
            ├──→ AMLService (fraud scoring)
            ├──→ ReceiptService
            │       ├──→ QRService
            │       └──→ SignatureService (RSA-2048)
            └──→ NotificationService
                    └──→ Twilio API (WhatsApp/SMS/Email)

whatsapp_adapter.py
    ├──→ DRIDService (DRID creation)
    ├──→ ChequeOCRService (OpenAI Vision)
    └──→ DB (Customer/Account lookup)
```

---

## 3. Getting Started

### Prerequisites

- Docker & Docker Compose
- Git
- (Optional) Python 3.11, Node.js 20 for local dev
- (Optional) ngrok for WhatsApp webhook testing

### Quick Start

```bash
# Clone
git clone https://github.com/gulpcr/digitalslips.git
cd digitalslips/precision-receipt-complete

# Create .env file (see Section 12 for all variables)
cp .env.example .env
# Edit .env with your Twilio/OpenAI keys

# Start all services
docker compose up -d

# Check health
curl http://localhost:8001/health    # Backend API
curl http://localhost:3080           # Frontend
curl http://localhost:9001/health    # WhatsApp server

# Seed demo data
curl -X POST http://localhost:8001/api/v1/demo/seed

# Open browser
# Frontend:  http://localhost:3080
# API Docs:  http://localhost:8001/api/docs
```

### Demo Credentials (after seeding)

| Username | Password | Role | Branch |
|----------|----------|------|--------|
| `admin` | `Admin@123456` | ADMIN | All |
| `manager.khi` | `Manager@123` | MANAGER | KHI001 |
| `teller.khi1` | `Teller@123` | TELLER | KHI001 |
| `teller.lhr1` | `Teller@123` | TELLER | LHR001 |

### Local Development (without Docker)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Set env vars
export DATABASE_URL=postgresql://precision:precision123@localhost:5434/precision_receipt
export JWT_SECRET=your-secret-key
export ENCRYPTION_KEY=your-encryption-key

# Run API server
uvicorn app.main:app --reload --port 8000

# Run WhatsApp server (separate terminal)
python -m app.whatsapp.whatsapp_server
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev   # Starts on http://localhost:5173
```

### WhatsApp Testing with ngrok

```bash
# Start ngrok tunnel to WhatsApp server
ngrok http 9001

# Configure Twilio Sandbox:
# 1. Go to https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
# 2. Set webhook URL: https://<ngrok-id>.ngrok-free.app/whatsapp/webhook
# 3. Send "join receive-greatest" to +1 415 523 8886
# 4. Send "HI" to start conversation
```

---

## 4. Project Structure

```
precision-receipt-complete/
├── docker-compose.yml              # 5 services: postgres, redis, backend, frontend, whatsapp
├── .env                            # Environment variables (not committed)
├── ARCHITECTURE.md                 # High-level architecture doc
├── DEVELOPMENT_PLAN.md             # 28-task roadmap
├── GAP_ANALYSIS.md                 # BRD gap analysis
├── HARDWARE_SIZING.md              # Production hardware sizing
│
├── backend/
│   ├── Dockerfile                  # Python 3.11 image
│   ├── requirements.txt            # 48 Python packages
│   ├── keys/                       # RSA keys (generated at startup, gitignored)
│   ├── uploads/                    # File uploads (QR codes, cheque images)
│   ├── logs/                       # Application logs (JSON format)
│   └── app/
│       ├── main.py                 # FastAPI app, middleware, routers, lifespan
│       ├── core/
│       │   ├── config.py           # Settings (BaseSettings, 60+ vars)
│       │   ├── database.py         # SQLAlchemy engine, session factory
│       │   └── security.py         # JWT tokens, password hashing
│       ├── middleware/
│       │   └── auth.py             # Auth dependencies, RBAC decorators
│       ├── models/
│       │   └── __init__.py         # 11 SQLAlchemy models, 15 enums
│       ├── schemas/
│       │   ├── common.py           # ResponseBase, PaginatedResponse, etc.
│       │   ├── user.py             # Login/User schemas
│       │   ├── customer.py         # Customer/Account schemas
│       │   ├── transaction.py      # Transaction schemas with validators
│       │   ├── deposit_slip.py     # DRID schemas
│       │   ├── receipt.py          # Receipt + signature schemas
│       │   └── report.py           # Report schemas
│       ├── api/v1/
│       │   ├── auth.py             # POST /login, /logout, /me, /change-password, /refresh
│       │   ├── deposit_slips.py    # DRID lifecycle (initiate→retrieve→verify→complete)
│       │   ├── transactions.py     # Transaction CRUD + stats
│       │   ├── receipts.py         # Receipt generation, verification, signatures, QR
│       │   ├── customers.py        # Customer lookup by CNIC/phone/name
│       │   ├── users.py            # User CRUD (Admin only)
│       │   ├── branches.py         # Branch CRUD
│       │   ├── reports.py          # 7 reports + CSV export
│       │   ├── cheque_ocr.py       # Cheque image scanning
│       │   └── demo.py             # Demo data seeding
│       ├── services/
│       │   ├── drid_service.py     # DRID state machine & lifecycle
│       │   ├── aml_service.py      # 8-rule AML fraud scoring
│       │   ├── notification_service.py  # WhatsApp/SMS/Email sending
│       │   ├── receipt_service.py  # Receipt generation + signatures
│       │   ├── report_service.py   # Report aggregation + CSV export
│       │   ├── auth_service.py     # Authentication logic
│       │   ├── cheque_ocr_service.py # OpenAI GPT-4o Vision OCR
│       │   ├── qr_service.py       # QR code generation/verification
│       │   ├── otp_service.py      # OTP generation/verification (in-memory)
│       │   └── signature_service.py # RSA-2048 digital signing
│       ├── whatsapp/
│       │   ├── whatsapp_server.py  # FastAPI server (port 9001), webhooks
│       │   ├── whatsapp_adapter.py # Conversation state machine (30+ states)
│       │   └── whatsapp_messages.py # Message templates
│       ├── sms/
│       │   ├── sms_adapter.py      # SMS state machine (parallel to WhatsApp)
│       │   └── sms_messages.py     # SMS message templates
│       └── database/
│           └── seed.py             # Demo data (branches, users, customers)
│
└── frontend/
    ├── Dockerfile                  # Node 20 build → Nginx Alpine runtime
    ├── nginx.conf                  # Reverse proxy + SPA routing
    ├── package.json                # React + Vite + dependencies
    ├── vite.config.ts              # Dev server, proxy, path aliases
    ├── tsconfig.json               # Strict mode, path aliases
    ├── tailwind.config.js          # Custom theme
    └── src/
        ├── App.tsx                 # Routes + auth guard + query provider
        ├── main.tsx                # Entry point
        ├── pages/
        │   ├── Login.tsx           # JWT login form
        │   ├── Dashboard.tsx       # Main teller dashboard
        │   ├── CustomerDeposit.tsx # Customer DRID creation (42 KB)
        │   ├── MobileDemo.tsx      # Mobile phone simulation (38 KB)
        │   ├── DemoSetup.tsx       # Demo data seeding
        │   ├── UserManagement.tsx  # User CRUD (Admin)
        │   ├── BranchManagement.tsx # Branch CRUD (Admin)
        │   ├── Reports.tsx         # 6 report types
        │   └── ReceiptVerification.tsx # Public receipt verification
        ├── components/
        │   ├── ui/                 # Button, Card, Input, Table
        │   ├── layout/            # AdminLayout (sidebar nav)
        │   ├── reports/           # Charts, tables, filters
        │   ├── DRIDLookupModal.tsx # Teller DRID workflow (39 KB)
        │   ├── NewTransactionModal.tsx # New transaction form (39 KB)
        │   ├── ReceiptModal.tsx   # Receipt display + share
        │   ├── TransactionDetailModal.tsx
        │   ├── ChequeScannerModal.tsx # Camera OCR
        │   ├── CreateUserModal.tsx
        │   └── EditUserModal.tsx
        ├── services/              # API client layer (axios)
        │   ├── api.ts             # Axios instance + interceptors
        │   ├── auth.service.ts
        │   ├── transaction.service.ts
        │   ├── depositSlip.service.ts
        │   ├── receipt.service.ts
        │   ├── report.service.ts
        │   ├── customer.service.ts
        │   ├── user.service.ts
        │   ├── branch.service.ts
        │   └── chequeOcr.service.ts
        ├── store/
        │   └── authStore.ts       # Zustand auth state (persisted)
        ├── types/
        │   ├── index.ts           # Core type definitions
        │   └── report.ts          # Report type definitions
        └── theme/
            └── index.ts           # Color palette, typography, spacing
```

---

## 5. Backend - Core Framework

### 5.1 Application Entry Point (`main.py`)

```python
# Key components:
app = FastAPI(
    title=settings.APP_NAME,
    docs_url="/api/docs",          # Swagger UI
    openapi_url="/api/openapi.json",
    lifespan=lifespan              # Startup/shutdown hooks
)

# Middleware stack (order matters):
1. CORSMiddleware          # CORS headers
2. GZipMiddleware          # Response compression (>1000 bytes)
3. add_process_time_header # X-Request-ID + X-Process-Time headers

# Startup:
- Creates DB tables (dev mode only)
- Initializes SignatureService (generates RSA keys if missing)

# Routers registered:
/api/v1/auth           → auth.router
/api/v1/transactions   → transactions.router
/api/v1/receipts       → receipts.router
/api/v1/customers      → customers.router
/api/v1/users          → users.router
/api/v1/branches       → branches.router
/api/v1/deposit-slips  → deposit_slips.router
/api/v1/demo           → demo.router
/api/v1/reports        → reports.router
/api/v1/cheque-ocr     → cheque_ocr.router
```

### 5.2 Database Setup (`core/database.py`)

```python
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,     # Default: 20
    max_overflow=settings.DB_MAX_OVERFLOW, # Default: 0
    pool_pre_ping=True,                   # Connection health check
    echo=settings.DB_ECHO                 # SQL logging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """FastAPI dependency - yields DB session, auto-closes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 5.3 Security (`core/security.py`)

```python
# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
verify_password(plain, hashed) → bool
hash_password(password) → str

# JWT Tokens
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE = 60 minutes
REFRESH_TOKEN_EXPIRE = 7 days

create_access_token(data, expires_delta) → str   # Adds type="access"
create_refresh_token(data, expires_delta) → str   # Adds type="refresh"
decode_token(token) → TokenData | None
create_tokens(user_id, username, role, branch_id) → TokenResponse

# Token payload structure:
{
    "sub": user_id,
    "username": username,
    "role": role,
    "branch_id": branch_id,
    "type": "access" | "refresh",
    "exp": expiration_timestamp
}
```

### 5.4 Auth Middleware (`middleware/auth.py`)

```python
# FastAPI dependencies for route protection:

get_current_user(credentials, db)        → Optional[User]  # Returns None if no token
get_current_active_user(credentials, db) → User            # Raises 401/403
require_roles(allowed_roles)             → Callable        # Factory for role check
require_admin()                          → User            # ADMIN only
require_manager_or_above()               → User            # ADMIN, MANAGER
require_teller_or_above()                → User            # ADMIN, MANAGER, TELLER

# Usage in endpoints:
@router.get("/")
async def get_data(user: User = Depends(get_current_active_user)):
    ...

@router.post("/")
async def admin_action(user: User = Depends(require_admin)):
    ...
```

---

## 6. Database Models & Schema

### 6.1 Enums

```python
class UserRole(str, Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    TELLER = "TELLER"
    AUDITOR = "AUDITOR"

class TransactionType(str, Enum):
    CASH_DEPOSIT = "CASH_DEPOSIT"
    CHEQUE_DEPOSIT = "CHEQUE_DEPOSIT"
    PAY_ORDER = "PAY_ORDER"
    BILL_PAYMENT = "BILL_PAYMENT"
    FUND_TRANSFER = "FUND_TRANSFER"

class TransactionStatus(str, Enum):
    INITIATED = "INITIATED"
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    REVERSED = "REVERSED"

class DepositSlipStatus(str, Enum):
    INITIATED = "INITIATED"
    RETRIEVED = "RETRIEVED"
    VERIFIED = "VERIFIED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"

class Channel(str, Enum):
    WHATSAPP = "WHATSAPP"
    SMS = "SMS"
    WEB = "WEB"
    MOBILE = "MOBILE"
    USSD = "USSD"
    BRANCH = "BRANCH"

# Also: BranchType, Gender, KycStatus, AccountType, AccountStatus,
#        TransactionCategory, ReceiptType, NotificationType,
#        NotificationChannel, NotificationStatus, Priority, Severity
```

### 6.2 Entity Relationship Diagram

```
┌──────────┐     ┌───────────┐     ┌──────────────┐
│  Branch   │←────│   User    │     │   Customer   │
│           │     │           │     │              │
│ branch_   │     │ username  │     │ cnic (unique)│
│ code      │     │ role      │     │ full_name    │
│ city      │     │ branch_id │     │ phone        │
└─────┬─────┘     └─────┬─────┘     └──────┬───────┘
      │                 │                   │
      │                 │           ┌───────▼───────┐
      │                 │           │   Account     │
      │                 │           │               │
      │                 │           │ account_number│
      │                 │           │ balance       │
      │                 │           │ daily_limit   │
      │                 │           └───────┬───────┘
      │                 │                   │
      │           ┌─────▼───────────────────▼─────┐
      ├───────────│      Transaction               │
      │           │                                │
      │           │ reference_number (unique)      │
      │           │ transaction_type               │
      │           │ amount, currency               │
      │           │ status                         │
      │           │ fraud_score, fraud_flags (JSONB)│
      │           │ t24_transaction_id             │
      │           │ extra_data (JSONB)             │
      │           └──┬──────────┬──────────────────┘
      │              │          │
      │     ┌────────▼──┐  ┌───▼──────────┐
      │     │  Receipt   │  │ Notification │
      │     │            │  │              │
      │     │ receipt_   │  │ channel      │
      │     │  number    │  │ status       │
      │     │ digital_   │  │ recipient    │
      │     │  signature │  │ external_id  │
      │     │ signature_ │  └──────────────┘
      │     │  hash      │
      │     └────────────┘
      │
┌─────▼──────────────────────┐     ┌──────────────┐
│  DigitalDepositSlip (DRID) │     │  AuditLog    │
│                            │     │              │
│ drid (unique)              │     │ action       │
│ status                     │     │ entity_type  │
│ expires_at                 │     │ old_data     │
│ transaction_type           │     │ new_data     │
│ amount                     │     │ severity     │
│ extra_data (JSONB)         │     └──────────────┘
│ qr_code_data               │
│ retrieved_by → User        │     ┌──────────────┐
│ verified_by → User         │     │SystemSettings│
│ completed_by → User        │     │              │
│ transaction_id → Transaction│     │ key (PK)     │
└────────────────────────────┘     │ value        │
                                   └──────────────┘
┌──────────────┐
│   Session    │
│              │
│ session_id   │
│ user_id      │
│ expires_at   │
└──────────────┘
```

### 6.3 Key Tables - Column Reference

**DigitalDepositSlip** (the central entity):
```
id                  UUID PK
drid                String UNIQUE   "DRID-YYYYMMDD-XXXXXX"
status              Enum            INITIATED → ... → COMPLETED
expires_at          DateTime        created_at + 60 minutes
validity_minutes    Integer         Default: 60
transaction_type    Enum            CASH_DEPOSIT, CHEQUE_DEPOSIT, etc.
customer_cnic       String          Pakistani CNIC
customer_account    String          Bank account number
amount              Decimal(15,2)   Deposit amount
currency            String          "PKR"
narration           Text            Optional description
depositor_name      String          Third-party depositor (if different)
depositor_cnic      String          Third-party CNIC
depositor_phone     String          For OTP/notifications
depositor_relationship String       Self, Family, Agent, etc.
channel             Enum            WHATSAPP, SMS, WEB
customer_id         FK → Customer
account_id          FK → Account
branch_id           FK → Branch
qr_code_data        Text            Base64 QR code PNG
extra_data          JSONB           Type-specific: {cheque_number, bill_type, ...}
retrieved_at/by     DateTime/FK     Teller retrieval timestamp
verified_at/by      DateTime/FK     Teller verification timestamp
completed_at/by     DateTime/FK     Completion timestamp
transaction_id      FK → Transaction (set on completion)
validation_attempts Integer         Counter for DRID lookups
```

**Transaction**:
```
id                  UUID PK
reference_number    String UNIQUE   "TXN-YYYYMMDD-XXXXXXXX"
transaction_type    Enum
transaction_category Enum           DEPOSIT, WITHDRAWAL, etc.
customer_id/cnic/name/account       Customer info (denormalized)
depositor_cnic/name/phone           Third-party depositor
amount              Decimal(15,2)
currency            String          "PKR"
fee/tax/total_amount Decimal        Calculated fields
status              Enum            INITIATED → COMPLETED
channel             Enum
extra_data          JSONB           {cheque_number, bill_type, beneficiary_bank, ...}
narration           Text
fraud_score         Float           0.0 - 1.0 (from AML)
fraud_flags         JSONB           ["CTR_REQUIRED", "HIGH_AMOUNT", ...]
is_suspicious       Boolean         fraud_score >= 0.75
t24_transaction_id  String          Core banking reference (future)
t24_posting_date    Date            Core banking posting date (future)
branch_id           FK → Branch
processed_by        FK → User       Teller who processed
completed_at        DateTime
failure_reason      Text            If FAILED
```

**Receipt**:
```
id                  UUID PK
transaction_id      FK → Transaction
receipt_number      String UNIQUE   "RCP-YYYYMMDD-XXXXXXXX"
receipt_type        Enum            DIGITAL, PRINTED, EMAIL
digital_signature   Text            Base64 RSA-2048 signature
signature_hash      String          SHA-256 of signing payload
signature_timestamp DateTime        ISO format with Z suffix
signature_algorithm String          "RSA-SHA256"
is_signature_valid  Boolean         Cached validation flag
verification_qr_data Text           QR code data (JSON)
verification_url    String          Public verification URL
is_verified         Boolean
verified_count      Integer         How many times verified
```

### 6.4 JSONB Field Structures

**Transaction.extra_data** (varies by type):
```json
// CHEQUE_DEPOSIT
{"cheque_number": "123456", "cheque_date": "2026-03-09", "cheque_bank": "HBL",
 "clearing_type": "same_city", "payee_name": "John"}

// BILL_PAYMENT
{"bill_type": "electricity", "consumer_number": "1234567890", "biller_name": "K-Electric"}

// FUND_TRANSFER
{"beneficiary_name": "Ali", "beneficiary_account": "PK36MEZN0001234567890",
 "beneficiary_bank": "HBL"}

// PAY_ORDER
{"payee_name": "Company Ltd", "payee_cnic": "42101-1234567-1"}
```

**AuditLog.changes** (before/after snapshot):
```json
{
  "before": {"status": "VERIFIED", "fraud_score": null},
  "after": {"status": "COMPLETED", "fraud_score": 0.4, "fraud_flags": ["CTR_REQUIRED"]}
}
```

---

## 7. API Reference

### 7.1 Authentication (`/api/v1/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/login` | No | Login, returns JWT tokens |
| `POST` | `/logout` | Yes | Logout (invalidate session) |
| `GET` | `/me` | Yes | Get current user info |
| `POST` | `/change-password` | Yes | Change password |
| `POST` | `/refresh` | Yes | Refresh JWT tokens |

**POST /login**
```json
// Request
{"username": "teller.khi1", "password": "Teller@123"}

// Response 200
{
  "success": true,
  "user": {
    "id": "uuid", "username": "teller.khi1", "role": "TELLER",
    "branch_id": "uuid", "full_name": "Teller Karachi 1"
  },
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### 7.2 Deposit Slips / DRID (`/api/v1/deposit-slips`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `POST` | `/initiate` | No | -- | Customer creates DRID |
| `GET` | `/status/{drid}` | No | -- | Check DRID validity |
| `POST` | `/{drid}/cancel` | No | -- | Customer cancels DRID |
| `GET` | `/retrieve/{drid}` | Yes | Teller+ | Teller retrieves slip |
| `POST` | `/{drid}/verify` | Yes | Teller+ | Teller verifies slip |
| `POST` | `/{drid}/send-otp` | Yes | Teller+ | Send OTP to depositor |
| `POST` | `/{drid}/verify-otp` | Yes | Teller+ | Verify depositor OTP |
| `POST` | `/{drid}/complete` | Yes | Teller+ | Complete transaction |
| `POST` | `/{drid}/reject` | Yes | Teller+ | Reject slip |
| `GET` | `/` | Yes | Any | List all slips (paginated) |
| `GET` | `/pending` | Yes | Any | List pending slips |
| `GET` | `/{drid}` | Yes | Any | Get slip by DRID |

**POST /initiate** (Customer creates DRID - no auth required)
```json
// Request
{
  "transaction_type": "CASH_DEPOSIT",
  "customer_cnic": "42101-1234567-1",
  "customer_account": "0123456789",
  "amount": 50000,
  "currency": "PKR",
  "depositor_name": "Hassan Raza",
  "depositor_cnic": "42101-1234567-1",
  "depositor_phone": "+923001234567",
  "channel": "WHATSAPP"
}

// Response 201
{
  "success": true,
  "message": "Deposit slip created",
  "drid": "DRID-20260309-A1B2C3",
  "expires_at": "2026-03-09T11:00:00Z",
  "validity_minutes": 60,
  "qr_code_data": "data:image/png;base64,...",
  "instructions": "Present this DRID or QR code at any Meezan Bank branch"
}
```

**POST /{drid}/complete** (Teller completes - creates transaction + receipt)
```json
// Request
{
  "authorization_captured": true,
  "teller_notes": "Cash counted and verified"
}

// Response 200
{
  "success": true,
  "message": "Transaction completed",
  "drid": "DRID-20260309-A1B2C3",
  "transaction_id": "uuid",
  "transaction_reference": "TXN-20260309-ABCD1234",
  "receipt_number": "RCP-20260309-EFGH5678",
  "aml_result": {
    "fraud_score": 0.4,
    "fraud_flags": ["CTR_REQUIRED"],
    "is_suspicious": false,
    "risk_level": "MEDIUM",
    "requires_ctr": true
  },
  "aml_warning": "CTR filing required for cash deposit >= PKR 250,000"
}
```

### 7.3 Transactions (`/api/v1/transactions`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | Yes | List transactions (paginated, filterable) |
| `GET` | `/stats` | Yes | Transaction statistics |
| `GET` | `/{id}` | Yes | Get single transaction |
| `POST` | `/` | Yes | Create transaction directly (bypasses DRID) |
| `GET` | `/{id}/notifications` | Yes | Get notification status |

**GET /** Query Parameters:
- `page` (int, default 1)
- `page_size` (int, default 20, max 100)
- `status` (string, optional)
- `transaction_type` (string, optional)
- `customer_cnic` (string, optional)
- `search` (string, optional - searches reference_number, customer_name)
- `start_date`, `end_date` (datetime, optional)

### 7.4 Receipts (`/api/v1/receipts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/signature/public-key` | No | Get RSA public key (PEM) |
| `GET` | `/signature/info` | No | Get signature algorithm info |
| `POST` | `/verify-signature` | No | Cryptographically verify receipt |
| `GET` | `/{transaction_id}` | Yes | Get/create receipt for transaction |
| `GET` | `/by-number/{number}` | No | Get receipt by number (public) |
| `POST` | `/{transaction_id}/verify` | No | Mark receipt as verified |
| `POST` | `/verify-by-number` | No | Verify by receipt number |
| `GET` | `/{transaction_id}/qr-code` | Yes | Get QR code (base64/svg) |
| `GET` | `/qr-image/{number}.png` | No | Get QR as PNG image |
| `GET` | `/{transaction_id}/download` | Yes | Download receipt (json/html) |
| `POST` | `/{transaction_id}/send` | Yes | Send to specific channel |
| `POST` | `/{transaction_id}/send-all` | Yes | Send to all channels |
| `GET` | `/{transaction_id}/notification-status` | Yes | Delivery status |

**POST /verify-signature** (Public - cryptographic verification)
```json
// Request
{"receipt_number": "RCP-20260309-EFGH5678"}

// Response 200
{
  "success": true,
  "is_authentic": true,
  "message": "Receipt signature is valid and authentic",
  "receipt_number": "RCP-20260309-EFGH5678",
  "signature_algorithm": "RSA-SHA256",
  "signature_timestamp": "2026-03-09T10:30:00Z",
  "signed_fields": {
    "receipt_number": "RCP-20260309-EFGH5678",
    "transaction_reference": "TXN-20260309-ABCD1234",
    "amount": "50000.00",
    "customer_name": "Hassan Raza"
  },
  "issuer": "Meezan Bank Limited - Digital Receipt System"
}
```

### 7.5 Customers (`/api/v1/customers`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `GET` | `/` | Yes | Teller+ | List customers |
| `GET` | `/search` | Yes | Teller+ | Search by cnic/phone/name |
| `GET` | `/by-cnic/{cnic}` | Yes | Teller+ | Get customer + accounts |
| `GET` | `/{id}` | Yes | Teller+ | Get customer + accounts |

### 7.6 Users (`/api/v1/users`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `GET` | `/` | Yes | Manager+ | List users (filtered by branch for Manager) |
| `GET` | `/{id}` | Yes | Manager+ | Get user |
| `POST` | `/` | Yes | Admin | Create user |
| `PATCH` | `/{id}` | Yes | Admin | Update user |
| `POST` | `/{id}/unlock` | Yes | Admin | Unlock locked account |

**POST /** (Create user - Admin only)
```json
// Request
{
  "username": "teller.khi3",
  "email": "teller3@meezan.com",
  "password": "Teller@123",   // Min 8 chars, 1 upper, 1 lower, 1 digit
  "full_name": "Teller Karachi 3",
  "phone": "+923001234567",
  "role": "TELLER",
  "branch_id": "uuid-of-khi001"
}
```

### 7.7 Branches (`/api/v1/branches`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `GET` | `/` | Yes | Any | List branches |
| `GET` | `/{id}` | Yes | Any | Get branch |
| `GET` | `/code/{code}` | Yes | Any | Get branch by code |
| `POST` | `/` | Yes | Admin | Create branch |
| `PUT` | `/{id}` | Yes | Admin | Update branch |
| `DELETE` | `/{id}` | Yes | Admin | Soft-delete (deactivate) |
| `POST` | `/{id}/activate` | Yes | Admin | Reactivate branch |

### 7.8 Reports (`/api/v1/reports`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `GET` | `/summary` | Yes | Any | Transaction summary stats |
| `GET` | `/user-activity` | Yes | Manager+ | User performance report |
| `GET` | `/my-activity` | Yes | Any | Own activity summary |
| `GET` | `/trends` | Yes | Any | Transaction trends (daily/weekly/monthly) |
| `GET` | `/branch-comparison` | Yes | Admin | Branch performance comparison |
| `GET` | `/failed-transactions` | Yes | Manager+ | Failed/cancelled transactions |
| `GET` | `/audit-trail` | Yes | Admin/Auditor | Audit log entries |
| `POST` | `/export` | Yes | Any | Export report as CSV |

**Report Role-Based Filtering:**
- **ADMIN**: Sees all branches, all users
- **AUDITOR**: Sees all (read-only)
- **MANAGER**: Sees only own branch
- **TELLER**: Sees only own transactions

### 7.9 Cheque OCR (`/api/v1/cheque-ocr`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/scan` | No | Upload cheque image (file) |
| `POST` | `/scan-base64` | No | Submit cheque as base64 |

**POST /scan** Response:
```json
{
  "success": true,
  "data": {
    "cheque_number": "123456",
    "cheque_date": "2026-03-09",
    "bank_name": "Habib Bank Limited",
    "amount_in_figures": 50000.0,
    "amount_in_words": "Fifty Thousand Only",
    "payee_name": "Hassan Raza",
    "account_number": "1234567890",
    "micr_code": "001234",
    "signature_status": "present",
    "confidence_score": 0.92,
    "language_detected": "mixed"
  }
}
```

### 7.10 Demo (`/api/v1/demo`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/seed` | No | Seed branches + users + customers |
| `POST` | `/create-customer` | No | Create single demo customer |
| `GET` | `/customers` | No | List demo customers |
| `DELETE` | `/reset` | No | Clear all deposit slips |
| `POST` | `/unlock-admin` | No | Reset admin account |

---

## 8. Service Layer

### 8.1 DRIDService (`services/drid_service.py`)

The central service managing the deposit slip lifecycle.

```python
class DRIDService:
    DEFAULT_VALIDITY_MINUTES = 60
    DRID_PREFIX = "DRID"

    @staticmethod
    def generate_drid() -> str
        # Returns: "DRID-YYYYMMDD-XXXXXX"

    @staticmethod
    def generate_qr_code_for_drid(drid, amount, customer_name) -> str
        # Returns: base64-encoded QR code PNG

    @staticmethod
    def create_deposit_slip(
        db, transaction_type, customer_cnic, customer_account,
        amount, currency="PKR", narration=None,
        depositor_name=None, depositor_cnic=None, depositor_phone=None,
        depositor_relationship=None, channel="WEB",
        device_info=None, ip_address=None,
        validity_minutes=60, additional_data=None
    ) -> Tuple[Optional[DigitalDepositSlip], Optional[str]]
        # Validates customer/account, checks for existing active slip
        # Generates DRID + QR code, creates record with INITIATED status
        # Returns: (slip, error_message)

    @staticmethod
    def validate_drid(db, drid) -> DRIDValidationResult
        # Checks existence, expiry, status
        # Returns: DRIDValidationResult dataclass

    @staticmethod
    def retrieve_deposit_slip(db, drid, teller_id) -> Tuple[Optional[DigitalDepositSlip], Optional[str]]
        # INITIATED → RETRIEVED, records teller_id

    @staticmethod
    def verify_deposit_slip(
        db, drid, teller_id,
        amount_confirmed, depositor_verified,
        instrument_verified=None, notes=None
    ) -> Tuple[Optional[DigitalDepositSlip], Optional[str]]
        # RETRIEVED → VERIFIED
        # Requires amount_confirmed=True, depositor_verified=True
        # For CHEQUE/PAY_ORDER: requires instrument_verified=True

    @staticmethod
    def complete_deposit_slip(
        db, drid, teller_id,
        authorization_captured, teller_notes=None
    ) -> Tuple[Optional[DigitalDepositSlip], Optional[Transaction], Optional[str], Optional[AMLCheckResult]]
        # VERIFIED → PROCESSING → COMPLETED
        # Creates Transaction, runs AML checks, creates Receipt
        # Returns: (slip, transaction, error, aml_result)

    @staticmethod
    def cancel_deposit_slip(db, drid, cancelled_by, reason) -> Tuple[...]

    @staticmethod
    def expire_old_slips(db) -> int
        # Marks expired INITIATED slips as EXPIRED
```

### 8.2 AMLService (`services/aml_service.py`)

Rule-based anti-money laundering checks.

```python
@dataclass
class AMLCheckResult:
    fraud_score: float        # 0.0 - 1.0
    fraud_flags: List[str]    # ["CTR_REQUIRED", "HIGH_AMOUNT", ...]
    is_suspicious: bool       # fraud_score >= 0.75
    needs_review: bool
    requires_ctr: bool        # Cash Transaction Report needed
    risk_level: str           # LOW, MEDIUM, HIGH, CRITICAL
    check_details: Dict
    checked_at: datetime

class AMLService:
    @staticmethod
    def run_checks(db, transaction, customer) -> AMLCheckResult
```

**8 AML Rules:**

| # | Rule | Trigger | Score |
|---|------|---------|-------|
| 1 | `BLOCKED_CUSTOMER` | Customer is_blocked=True | 1.0 (hard block) |
| 2 | `CTR_REQUIRED` | Cash >= PKR 250,000 | +0.4 |
| 3 | `HIGH_AMOUNT` | Any type >= PKR 500,000 | +0.2 |
| 4 | `UNVERIFIED_HIGH_AMOUNT` | KYC not verified + >= PKR 100,000 | +0.3 |
| 5 | `THIRD_PARTY_HIGH_AMOUNT` | Different depositor CNIC + >= PKR 200,000 | +0.2 |
| 6 | `HIGH_FREQUENCY` | 3+ deposits same day (same CNIC) | +0.3 |
| 7 | `HIGH_DAILY_VOLUME` | Daily total >= PKR 500,000 | +0.3 |
| 8 | `HIGH_MONTHLY_VOLUME` | Monthly total >= PKR 2,000,000 | +0.2 |

**Risk Levels:** CRITICAL (>=1.0), HIGH (>=0.75), MEDIUM (>=0.40), LOW (<0.40)

### 8.3 NotificationService (`services/notification_service.py`)

Multi-channel notification delivery.

```python
class NotificationService:
    @staticmethod
    def create_notification(db, transaction, notification_type, channel, recipient, receipt=None, priority=NORMAL) -> Notification

    @staticmethod
    async def send_notification(db, notification) -> bool
        # Routes to: _send_whatsapp(), _send_sms(), _send_email()

    @staticmethod
    async def send_transaction_notifications(db, transaction, receipt, customer, send_whatsapp=True, send_sms=True, send_email=True) -> List[Notification]
        # Sends completion notifications on all enabled channels

    @staticmethod
    async def send_receipt_to_channel(db, transaction, receipt, channel, recipient) -> Tuple[bool, str]

    @staticmethod
    def get_notification_status(db, transaction_id) -> List[Dict]
```

**Channel implementations:**
- **WhatsApp**: Twilio API, phone normalization (+92), `whatsapp:` prefix
- **SMS**: Twilio API, uses TWILIO_SMS_PHONE_NUMBER
- **Email**: aiosmtplib, MIME multipart (text + HTML)
- **Demo mode**: Returns success if credentials not configured

### 8.4 ReceiptService (`services/receipt_service.py`)

Digital receipt generation with RSA signatures.

```python
class ReceiptService:
    @staticmethod
    def generate_receipt_number() -> str
        # "RCP-YYYYMMDD-XXXXXXXX"

    @staticmethod
    def create_receipt(db, transaction, receipt_type="DIGITAL") -> Receipt
        # Generates QR code, signs with RSA-2048, persists

    @staticmethod
    def verify_receipt(db, receipt_number) -> Tuple[Optional[Receipt], bool, str]
        # Increments verified_count, returns validity

    @staticmethod
    def verify_receipt_signature(db, receipt_number) -> Tuple[bool, str, Optional[Receipt]]
        # Cryptographic signature verification using RSA public key

    @staticmethod
    def get_receipt_detail(db, receipt_id) -> Optional[ReceiptDetailResponse]
        # Joins Receipt + Transaction + Branch
```

### 8.5 SignatureService (`services/signature_service.py`)

RSA-2048 digital signing for receipt non-repudiation.

```python
class SignatureService:
    # Key files: ./keys/receipt_signing_private.pem (encrypted)
    #            ./keys/receipt_signing_public.pem

    @classmethod
    def initialize() -> bool
        # Loads or generates RSA-2048 key pair

    @classmethod
    def sign_receipt(receipt_data: Dict) -> Tuple[Optional[str], Optional[str], Optional[str]]
        # Returns: (signature_base64, payload_hash_sha256, timestamp_iso)
        # Signing payload (pipe-separated):
        # receipt_number|transaction_reference|amount|currency|customer_name|
        # customer_account|transaction_type|transaction_date|branch_id|teller_id|timestamp

    @classmethod
    def verify_signature(receipt_data, signature_b64, signing_timestamp) -> Tuple[bool, str]
        # Recreates payload, verifies RSA signature

    @classmethod
    def get_public_key_pem() -> Optional[str]
        # Returns PEM-encoded public key for external verification
```

### 8.6 ChequeOCRService (`services/cheque_ocr_service.py`)

Cheque image extraction using OpenAI Vision.

```python
@dataclass
class ChequeData:
    cheque_number: Optional[str]
    cheque_date: Optional[str]       # YYYY-MM-DD
    bank_name: Optional[str]
    amount_in_figures: Optional[float]
    amount_in_words: Optional[str]
    payee_name: Optional[str]
    account_number: Optional[str]
    micr_code: Optional[str]
    signature_status: Optional[str]  # present, missing, unclear
    confidence_score: float          # 0.0 - 1.0
    language_detected: Optional[str] # english, urdu, mixed

class ChequeOCRService:
    PAKISTANI_BANKS = [...]  # 20 recognized banks

    @staticmethod
    async def extract_cheque_data(image_bytes, filename=None) -> Tuple[Optional[ChequeData], Optional[str]]
        # Auto-rotates image, calls OpenAI GPT-4o Vision
        # Extracts: amount, date, payee, bank, cheque number, signature
        # Supports English and Urdu cheques
        # Returns: (ChequeData, error_message)
        # Demo mode: returns mock data if no OPENAI_API_KEY
```

### 8.7 Other Services

**ReportService** (`services/report_service.py`):
```python
class ReportService:
    get_transaction_summary(db, user, filters) -> TransactionSummary
    get_user_activity_report(db, user, filters) -> UserActivityReport
    get_my_activity(db, user, filters) -> UserActivitySummary
    get_transaction_trends(db, user, filters, granularity) -> TransactionTrendReport
    get_branch_comparison(db, user, filters) -> BranchComparisonReport
    get_failed_transactions(db, user, filters, page, page_size) -> FailedTransactionsReport
    get_audit_trail(db, user, filters, action, entity_type, page, page_size) -> AuditTrailReport
    export_to_csv(report_type, data) -> str  # CSV string
    # All methods apply role-based filtering via _apply_role_filter()
```

**OTPService** (`services/otp_service.py`):
```python
class OTPService:
    OTP_LENGTH = 5
    OTP_EXPIRY_MINUTES = 5
    MAX_ATTEMPTS = 3
    _otp_store = {}  # In-memory! (needs Redis migration)

    send_otp(phone_number, drid) -> Tuple[bool, str]
    verify_otp(phone_number, drid, otp) -> Tuple[bool, str]
    cleanup_expired() -> int
```

**QRService** (`services/qr_service.py`):
```python
class QRService:
    generate_qr_data(receipt_number, reference_number, amount, currency, customer_name, date) -> dict
    generate_qr_code_base64(data) -> str       # "data:image/png;base64,..."
    generate_qr_code_svg(data) -> str          # SVG string
    verify_receipt_hash(receipt_number, reference_number, amount, customer_name, date, hash) -> bool
```

**AuthService** (`services/auth_service.py`):
```python
class AuthService:
    authenticate_user(db, username, password) -> Tuple[Optional[User], Optional[str]]
        # Checks locked/active status, verifies bcrypt hash
        # 5 failed attempts → account locked

    create_user_tokens(user) -> TokenResponse
    change_password(db, user, current_password, new_password) -> Tuple[bool, str]
    create_user_session(db, user, session_id, device_info, ip_address, user_agent) -> Session
```

---

## 9. WhatsApp & SMS Adapters

### 9.1 WhatsApp Server (`whatsapp/whatsapp_server.py`)

Separate FastAPI app running on port 9001, handling Twilio webhooks.

**Endpoints:**
```
GET  /                              → Service info
GET  /health                        → Health check
GET  /verify/{receipt_number}       → Public receipt/DRID verification (HTML page)
GET  /whatsapp/webhook              → Twilio verification (returns "OK")
POST /whatsapp/webhook              → Incoming WhatsApp messages
POST /whatsapp/status               → Delivery status callbacks
GET  /whatsapp/sessions             → Active session count
DELETE /whatsapp/sessions/{phone}   → Clear specific session
POST /whatsapp/notify/transaction-complete → Trigger completion notification
POST /sms/webhook                   → Incoming SMS messages
```

**Twilio Webhook Processing:**
```python
@router.post("/whatsapp/webhook")
async def whatsapp_webhook(
    Body: str = Form(""),         # Message text
    From: str = Form(""),         # "whatsapp:+923001234567"
    To: str = Form(""),
    MessageSid: str = Form(""),   # Twilio message ID
    NumMedia: str = Form("0"),
    MediaUrl0: str = Form(""),    # Cheque image URL (if attached)
    MediaContentType0: str = Form("")
):
    adapter = WhatsAppAdapter(db, session_manager)
    response = adapter.process_message(phone, message, media_url)
    return Response(build_twiml_response(response), media_type="text/xml")
```

### 9.2 Conversation State Machine

The WhatsApp/SMS adapters implement a finite state machine with 30+ states.

**Main Flow:**
```
MAIN_MENU
  ├── "1" (Deposit) → DEPOSIT_TYPE
  │     ├── "1" (Cash) → CUSTOMER_TYPE
  │     │     ├── "1" (Own Account) → lookup by CNIC → ACCOUNT_SELECTION → AMOUNT_INPUT → CONFIRMATION
  │     │     └── "2" (Walk-in) → WALKIN_CNIC → WALKIN_NAME → WALKIN_PHONE → WALKIN_TARGET_ACCOUNT → AMOUNT_INPUT
  │     ├── "2" (Cheque) → CUSTOMER_TYPE → ... → CHEQUE_IMAGE → OCR → CHEQUE_CONFIRMATION
  │     ├── "3" (Pay Order) → CUSTOMER_TYPE → ... → PAYORDER_PAYEE_NAME → PAYORDER_PAYEE_CNIC → CONFIRMATION
  │     ├── "4" (Bill Payment) → ... → AMOUNT_INPUT → CONFIRMATION
  │     └── "5" (Fund Transfer) → ... → AMOUNT_INPUT → CONFIRMATION
  ├── "2" (Balance) → (not implemented)
  ├── "3" (Cheque Status) → (not implemented)
  └── "4" (Branch Finder) → (not implemented)

CONFIRMATION
  ├── "1" (Confirm) → DRIDService.create_deposit_slip() → QR code sent → MAIN_MENU
  └── "2" (Cancel) → MAIN_MENU
```

**Session Management:**
```python
class SessionManager:
    _sessions: Dict[str, UserSession]  # phone → session

    def get_session(phone_number) -> UserSession
        # Returns existing or creates new
        # Auto-resets expired sessions (30-min timeout)

    def clear_session(phone_number)
    def cleanup_expired_sessions() -> int
```

**Key Difference - SMS vs WhatsApp:**
- SMS: No image support → manual cheque entry (CHEQUE_NUMBER → CHEQUE_DATE → CHEQUE_BANK → CHEQUE_PAYEE states)
- WhatsApp: Supports image upload → OpenAI OCR (CHEQUE_IMAGE state)

### 9.3 Adding a New WhatsApp/SMS Flow

To add a new conversation state:

```python
# 1. Add state to SessionState enum (whatsapp_adapter.py)
class SessionState(Enum):
    MY_NEW_STATE = "MY_NEW_STATE"

# 2. Add handler method
def handle_my_new_state(self, session: UserSession, message: str) -> str:
    if message == "1":
        session.state = SessionState.NEXT_STATE
        return "Next prompt message"
    elif message == "2":
        session.state = SessionState.MAIN_MENU
        return WhatsAppMessages.main_menu()
    else:
        return "Invalid option. Please try again."

# 3. Register in process_message() dispatcher
def process_message(self, phone_number, message_text, media_url=None):
    ...
    elif session.state == SessionState.MY_NEW_STATE:
        return self.handle_my_new_state(session, message)
```

---

## 10. Frontend Architecture

### 10.1 Routes

```typescript
// App.tsx
<Routes>
  {/* Public */}
  <Route path="/login" element={<Login />} />
  <Route path="/deposit" element={<CustomerDeposit />} />
  <Route path="/customer/deposit" element={<CustomerDeposit />} />
  <Route path="/demo" element={<DemoSetup />} />
  <Route path="/demo/mobile" element={<MobileDemo />} />
  <Route path="/verify/:receiptNumber" element={<ReceiptVerification />} />

  {/* Protected (requires JWT) */}
  <Route path="/" element={<AdminLayout><Dashboard /></AdminLayout>} />
  <Route path="/dashboard" element={<AdminLayout><Dashboard /></AdminLayout>} />
  <Route path="/admin/users" element={<AdminLayout><UserManagement /></AdminLayout>} />
  <Route path="/admin/branches" element={<AdminLayout><BranchManagement /></AdminLayout>} />
  <Route path="/reports" element={<AdminLayout><Reports /></AdminLayout>} />
</Routes>
```

### 10.2 State Management

```
┌─────────────────────┐
│   Zustand Store     │  authStore.ts
│   (persisted to     │  - user, accessToken, refreshToken
│    localStorage)    │  - isAuthenticated, isLoading
│                     │  - setAuth(), clearAuth()
└─────────────────────┘

┌─────────────────────┐
│   React Query       │  Server state caching
│   (5-min stale)     │  - useQuery() for GET requests
│                     │  - useMutation() for POST/PUT
└─────────────────────┘

┌─────────────────────┐
│   Local State       │  React useState
│   (component)       │  - Modal open/close
│                     │  - Form data, filters, pagination
└─────────────────────┘
```

### 10.3 API Client (`services/api.ts`)

```typescript
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/v1`,
  timeout: 30000,
});

// Request interceptor: adds Bearer token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: handles 401 (redirect to login), 403, 500
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isPublicPage()) {
      authStore.clearAuth();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 10.4 Service Layer Pattern

Each entity has a service file that wraps API calls:

```typescript
// services/depositSlip.service.ts
export const depositSlipService = {
  initiate: (data: DepositSlipCreate) =>
    api.post('/deposit-slips/initiate', data).then(r => r.data),

  retrieve: (drid: string) =>
    api.get(`/deposit-slips/retrieve/${drid}`).then(r => r.data),

  complete: (drid: string, data: CompleteRequest) =>
    api.post(`/deposit-slips/${drid}/complete`, data).then(r => r.data),
  // ...
};
```

### 10.5 Key Page Components

**Dashboard.tsx** - Main teller interface:
- Transaction list with search (500ms debounce) and pagination
- Stats cards (total, amount, completion rate)
- Modals: DRIDLookupModal, NewTransactionModal, ReceiptModal, TransactionDetailModal
- Refresh button, status filters

**CustomerDeposit.tsx** - Customer-facing DRID creation (42 KB):
- 5 transaction types with dynamic form fields
- CNIC → Customer lookup → Account selection
- Type-specific fields (cheque details, bill info, transfer details)
- Cheque scanner integration (ChequeScannerModal)
- DRID result display with QR code, copy, and countdown

**DRIDLookupModal.tsx** - Teller DRID workflow (39 KB):
- DRID input with scan mode
- Step-by-step: Retrieve → Verify → OTP → Complete
- Amount confirmation, identity verification checkboxes
- AML result display with risk level badges
- Keyboard shortcuts for scan mode

### 10.6 Theme

```typescript
// theme/index.ts
colors: {
  primary: '#5F2585',    // Deep Purple (Meezan brand)
  accent: '#2A7A5F',     // Green-Teal
  gold: '#D4AF37',       // Premium accent
  background: '#F6F6F6',
  surface: '#FFFFFF',
}
// Typography: Open Sans (body), Merriweather (headings)
// Tailwind CSS for styling
```

### 10.7 Adding a New Page

```typescript
// 1. Create page component: src/pages/MyNewPage.tsx
export default function MyNewPage() {
  const user = useAuthStore(state => state.user);
  return <div>...</div>;
}

// 2. Add route in App.tsx
<Route path="/my-page" element={<AdminLayout><MyNewPage /></AdminLayout>} />

// 3. Add nav item in components/layout/AdminLayout.tsx
const navItems = [
  ...existingItems,
  { path: '/my-page', label: 'My Page', icon: FiStar, roles: ['ADMIN', 'MANAGER'] },
];

// 4. Create service if needed: src/services/myEntity.service.ts
export const myEntityService = {
  getAll: () => api.get('/my-entity').then(r => r.data),
};
```

---

## 11. Authentication & Authorization

### 11.1 Auth Flow

```
Client                    Backend                      Database
──────                    ───────                      ────────
POST /api/v1/auth/login
  {username, password} ──→ AuthService.authenticate()
                           ├─ Find user by username ──→ SELECT * FROM users
                           ├─ Check is_locked          WHERE username = ?
                           ├─ Check is_active
                           ├─ bcrypt.verify(password)
                           ├─ Reset failed_attempts ──→ UPDATE users SET ...
                           └─ Create JWT tokens
                      ←── {access_token, refresh_token, user}

GET /api/v1/transactions
  Authorization: Bearer <token>
                       ──→ get_current_active_user()
                           ├─ decode_token(token)
                           ├─ Validate expiry
                           ├─ Find user by ID ────────→ SELECT * FROM users
                           ├─ Check is_active
                           └─ Check is_locked
                      ←── User object (injected as dependency)
```

### 11.2 Role Hierarchy

```
ADMIN ──→ Can do everything (all branches, all data)
  │
MANAGER ──→ Can manage own branch (users, transactions, reports)
  │
TELLER ──→ Can process transactions (own transactions only in reports)
  │
AUDITOR ──→ Read-only access to all data (audit trails, reports)
```

### 11.3 Password Policy

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- Hashed with bcrypt (12 rounds)
- Account locks after 5 failed attempts (30-minute cooldown)

---

## 12. Configuration Reference

All settings in `backend/app/core/config.py` via Pydantic BaseSettings (loaded from `.env`):

### Application
| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | "Precision Receipt System" | Application name |
| `APP_VERSION` | "1.0.0" | Version string |
| `NODE_ENV` | "development" | Environment (development/production) |
| `PORT` | 8000 | API server port |
| `DEBUG` | True | Debug mode |

### Database
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | -- | Full PostgreSQL connection string |
| `DB_POOL_SIZE` | 20 | Connection pool size |
| `DB_MAX_OVERFLOW` | 0 | Max overflow connections |
| `DB_ECHO` | False | Log SQL queries |

### Authentication
| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | -- | **Required.** Secret key for JWT signing |
| `JWT_ALGORITHM` | "HS256" | JWT algorithm |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | 60 | Access token TTL |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | 7 | Refresh token TTL |
| `BCRYPT_ROUNDS` | 12 | Password hashing rounds |
| `ENCRYPTION_KEY` | -- | **Required.** Key for RSA private key encryption |
| `MAX_LOGIN_ATTEMPTS` | 3 | Before account lockout |
| `LOCKOUT_DURATION_SECONDS` | 1800 | 30-minute lockout |

### Twilio (WhatsApp + SMS)
| Variable | Default | Description |
|----------|---------|-------------|
| `TWILIO_ACCOUNT_SID` | -- | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | -- | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | -- | WhatsApp sender number |
| `TWILIO_SMS_PHONE_NUMBER` | -- | SMS sender number |
| `WHATSAPP_ENABLED` | True | Enable WhatsApp channel |
| `SMS_ENABLED` | True | Enable SMS channel |

### OpenAI (Cheque OCR)
| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | -- | OpenAI API key (optional, demo mode if empty) |
| `OPENAI_VISION_MODEL` | "gpt-4o" | Vision model for OCR |

### Email
| Variable | Default | Description |
|----------|---------|-------------|
| `EMAIL_ENABLED` | True | Enable email notifications |
| `SMTP_HOST` | -- | SMTP server hostname |
| `SMTP_PORT` | 587 | SMTP port |
| `SMTP_USER` | -- | SMTP username |
| `SMTP_PASSWORD` | -- | SMTP password |

### AML / Fraud Detection
| Variable | Default | Description |
|----------|---------|-------------|
| `FRAUD_DETECTION_ENABLED` | True | Enable AML checks |
| `FRAUD_THRESHOLD_SCORE` | 0.75 | Score threshold for suspicious flag |
| `CTR_THRESHOLD_PKR` | 250000.00 | Cash Transaction Report threshold |
| `AML_MONTHLY_VOLUME_THRESHOLD_PKR` | 2000000.00 | Monthly volume alert |
| `AML_DAILY_FREQUENCY_THRESHOLD` | 3 | Daily deposit count alert |

### T24 Core Banking (Future)
| Variable | Default | Description |
|----------|---------|-------------|
| `T24_ENABLED` | False | Enable T24 integration |
| `T24_API_URL` | -- | T24 API endpoint |
| `T24_API_KEY` | -- | T24 authentication key |
| `T24_TIMEOUT_SECONDS` | 30 | T24 request timeout |

### Public URL
| Variable | Default | Description |
|----------|---------|-------------|
| `PUBLIC_URL` | -- | Public-facing URL (for QR codes, verification links) |

### Redis
| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | "localhost" | Redis hostname |
| `REDIS_PORT` | 6379 | Redis port |
| `REDIS_PASSWORD` | -- | Redis password |
| `REDIS_ENABLED` | True | Enable Redis |

### Feature Flags
| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_SWAGGER_DOCS` | True | Show /api/docs |
| `ENABLE_AUDIT_LOGS` | True | Write audit log entries |
| `ENABLE_NOTIFICATIONS` | True | Send notifications |
| `ENABLE_QR_CODES` | True | Generate QR codes |

---

## 13. Docker & Deployment

### 13.1 Services

```yaml
# docker-compose.yml - 5 services
services:
  postgres:     # PostgreSQL 15 Alpine - port 5434:5432
  redis:        # Redis 7 Alpine - port 6380:6379
  backend:      # FastAPI API - port 8001:8000
  frontend:     # Nginx + React SPA - port 3080:80
  whatsapp:     # WhatsApp/SMS webhooks - port 9001:8000
```

### 13.2 Port Map

| Service | Container Port | Host Port | Purpose |
|---------|---------------|-----------|---------|
| Frontend (Nginx) | 80 | 3080 | Web UI + reverse proxy |
| Backend API | 8000 | 8001 | REST API |
| WhatsApp Server | 8000 | 9001 | Twilio webhooks |
| PostgreSQL | 5432 | 5434 | Database |
| Redis | 6379 | 6380 | Cache/sessions |

### 13.3 Volumes

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `postgres_data` | /var/lib/postgresql/data | Database persistence |
| `redis_data` | /data | Redis AOF persistence |
| `backend_uploads` | /app/uploads | QR codes, cheque images |
| `backend_logs` | /app/logs | Application logs |
| `./frontend/dist` | /app/frontend_dist (ro) | SPA files for WhatsApp server |

### 13.4 Nginx Config

```nginx
# frontend/nginx.conf
location /whatsapp/  { proxy_pass http://whatsapp:8000/whatsapp/; }
location /sms/       { proxy_pass http://whatsapp:8000/sms/; }
location /api/       { proxy_pass http://backend:8000/api/; }
location /health     { proxy_pass http://backend:8000/health; }
location /           { try_files $uri $uri/ /index.html; }  # SPA fallback

# Static assets: 30-day immutable cache
location ~* \.(js|css|png|jpg|svg|woff2)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### 13.5 Common Docker Commands

```bash
# Start all services
docker compose up -d

# Rebuild after code changes
docker compose up -d --build

# View logs
docker compose logs -f backend
docker compose logs -f whatsapp

# Access database
docker exec -it precision-receipt-db psql -U precision -d precision_receipt

# Access Redis
docker exec -it precision-receipt-redis redis-cli

# Restart single service
docker compose restart backend

# Stop everything
docker compose down

# Stop and remove volumes (WARNING: destroys data)
docker compose down -v
```

---

## 14. Testing

### 14.1 Backend Tests

```bash
cd backend
pip install pytest pytest-asyncio faker httpx

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_auth.py
```

**Test dependencies** (from requirements.txt):
- `pytest==7.4.4`
- `pytest-asyncio==0.23.3`
- `faker==22.0.0`
- `httpx==0.26.0` (for async test client)

### 14.2 Manual API Testing

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"teller.khi1","password":"Teller@123"}' | jq -r '.access_token')

# Create DRID (no auth needed)
curl -X POST http://localhost:8001/api/v1/deposit-slips/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_type": "CASH_DEPOSIT",
    "customer_cnic": "42101-1234567-1",
    "customer_account": "0123456789",
    "amount": 50000,
    "depositor_name": "Hassan Raza",
    "depositor_cnic": "42101-1234567-1",
    "depositor_phone": "+923001234567",
    "channel": "WEB"
  }'

# Retrieve DRID (teller auth required)
curl http://localhost:8001/api/v1/deposit-slips/retrieve/DRID-20260309-XXXXXX \
  -H "Authorization: Bearer $TOKEN"

# Complete DRID
curl -X POST http://localhost:8001/api/v1/deposit-slips/DRID-20260309-XXXXXX/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"authorization_captured": true}'

# Verify receipt signature
curl -X POST http://localhost:8001/api/v1/receipts/verify-signature \
  -H "Content-Type: application/json" \
  -d '{"receipt_number": "RCP-20260309-XXXXXXXX"}'
```

### 14.3 WhatsApp Testing

```bash
# Start ngrok
ngrok http 9001

# Configure Twilio sandbox webhook:
# https://<ngrok-id>.ngrok-free.app/whatsapp/webhook

# Send "join receive-greatest" to +1 415 523 8886
# Then send "HI" to start conversation

# Check active sessions
curl http://localhost:9001/whatsapp/sessions
```

---

## 15. Known Gaps & TODO

### Critical (Must fix for production)

| # | Gap | File(s) | Description |
|---|-----|---------|-------------|
| 1 | DRID format | `drid_service.py` | Change `DRID-` prefix to `MZ-` per BRD |
| 2 | CNIC encryption | `models/__init__.py` | Encrypt CNIC at rest (AES-256), add hash-based lookup |
| 3 | Session timeout | `middleware/auth.py` | Implement 15-min inactivity timeout (BRD requirement) |
| 4 | T24 integration | New: `t24_service.py` | Implement core banking transaction posting |
| 5 | OTP in-memory | `otp_service.py` | Migrate `_otp_store` from dict to Redis |
| 6 | WhatsApp sessions | `whatsapp_adapter.py` | Migrate `SessionManager._sessions` to Redis |
| 7 | On-prem OCR | `cheque_ocr_service.py` | Replace OpenAI with Tesseract/PaddleOCR (SBP compliance) |

### High Priority

| # | Gap | Description |
|---|-----|-------------|
| 8 | Redis integration | Actually use Redis (configured but client not wired up) |
| 9 | Rate limiting | Enforce rate limits in middleware (configured but not active) |
| 10 | DRID PDF download | Add PDF generation endpoint for DRID confirmation |
| 11 | PDF/Excel reports | Only CSV export exists, BRD requires PDF/Excel |
| 12 | Background scheduler | Add APScheduler/Celery for `expire_old_slips()` auto-run |
| 13 | CORS lockdown | Change from `"*"` to specific allowed origins |
| 14 | Sentry integration | Enable Sentry error tracking (SENTRY_DSN configured but empty) |

### Medium Priority

| # | Gap | Description |
|---|-----|-------------|
| 15 | Missing transaction types | Add: INTERCITY_CHEQUE, CREDIT_CARD, CHARITY, LOAN, OWN_TRANSFER |
| 16 | USSD channel | Implement `*321#` USSD flow |
| 17 | Branch kiosk | Touch-screen UI with Urdu support |
| 18 | NADRA VERIS | CNIC verification against national database |
| 19 | STR filing | Suspicious Transaction Report workflow for FMU/goAML |
| 20 | Audit archival | 7-year retention policy with partition-based archiving |
| 21 | LDAP/SSO | Active Directory integration for teller authentication |

---

## 16. Coding Conventions

### Backend (Python)

- **Framework**: FastAPI with type hints everywhere
- **ORM**: SQLAlchemy 2.0 style (imperative mapping in `models/__init__.py`)
- **Services**: Static methods on service classes (`DRIDService.create_deposit_slip(...)`)
- **Return pattern**: `Tuple[Optional[Result], Optional[str]]` where second element is error message
- **DB sessions**: Passed as first argument `db: Session` to service methods
- **Async**: Only for notification sending and OCR (external HTTP calls)
- **Error handling**: Return error strings, don't raise exceptions in services
- **Audit logging**: Create `AuditLog` entries for significant actions

### Frontend (TypeScript)

- **Components**: Functional components with hooks
- **Naming**: PascalCase for components, camelCase for functions/variables
- **Services**: Object exports with methods (`depositSlipService.initiate(...)`)
- **State**: Zustand for auth, React Query for server state, useState for local
- **Styling**: Tailwind CSS utility classes (inline)
- **Types**: Defined in `types/index.ts` and `types/report.ts`
- **API calls**: Always through service layer, never direct axios calls in components

### Git

- Branch from `main`
- Commit messages: descriptive, imperative mood
- No secrets in commits (use `.env`)

---

## Appendix A: Pydantic Schema Quick Reference

### Request Schemas

```python
# Login
LoginRequest(username: str, password: str)

# Deposit Slip Creation
DepositSlipCreate(
    transaction_type: str,          # CASH_DEPOSIT | CHEQUE_DEPOSIT | PAY_ORDER | BILL_PAYMENT | FUND_TRANSFER
    customer_cnic: str,             # XXXXX-XXXXXXX-X
    customer_account: str,
    amount: Decimal,                # > 0, < 10,000,000
    currency: str = "PKR",
    narration: Optional[str],
    depositor_name: Optional[str],
    depositor_cnic: Optional[str],
    depositor_phone: Optional[str],
    depositor_relationship: Optional[str],
    channel: str = "WEB",
    additional_data: Optional[Dict]  # Type-specific fields
)

# Verify Slip
DepositSlipVerifyRequest(
    amount_confirmed: bool,           # Must be True
    depositor_identity_verified: bool, # Must be True
    instrument_verified: Optional[bool], # Required for cheque/pay_order
    notes: Optional[str]
)

# Complete Slip
DepositSlipCompleteRequest(
    authorization_captured: bool,     # Must be True
    teller_notes: Optional[str]
)

# Transaction (direct creation, bypasses DRID)
TransactionCreate(
    transaction_type: str,
    customer_cnic: str,
    customer_account: str,
    amount: Decimal,
    currency: str = "PKR",
    narration: Optional[str],
    depositor_cnic: Optional[str],
    depositor_name: Optional[str],
    depositor_phone: Optional[str],
    channel: str = "WEB",
    additional_data: Optional[Dict]
    # Validators enforce type-specific required fields:
    #   CASH_DEPOSIT: depositor_name, _cnic, _phone
    #   CHEQUE_DEPOSIT: cheque_number (6-10 digits), cheque_date, cheque_bank
    #   PAY_ORDER: payee_name, payee_cnic
    #   BILL_PAYMENT: bill_type, consumer_number, biller_name
    #   FUND_TRANSFER: beneficiary_name, _account, _bank, IBAN validation
)

# User Creation
UserCreate(
    username: str,
    email: EmailStr,
    password: str,   # 8+ chars, 1 upper, 1 lower, 1 digit
    full_name: str,
    phone: Optional[str],
    role: str,       # ADMIN | MANAGER | TELLER | AUDITOR
    branch_id: Optional[str]
)
```

### Response Schemas

```python
# DRID Creation
DepositSlipCreateResponse(
    success: bool,
    message: str,
    drid: str,                    # "DRID-YYYYMMDD-XXXXXX"
    expires_at: datetime,
    validity_minutes: int,
    qr_code_data: Optional[str],  # Base64 PNG
    instructions: str
)

# DRID Completion
DepositSlipCompleteResponse(
    success: bool,
    message: str,
    drid: str,
    transaction_id: str,
    transaction_reference: str,   # "TXN-YYYYMMDD-XXXXXXXX"
    receipt_number: Optional[str], # "RCP-YYYYMMDD-XXXXXXXX"
    aml_result: Optional[AMLResultSchema],
    aml_warning: Optional[str]
)

# Receipt Detail
ReceiptDetailResponse(
    id: str,
    transaction_id: str,
    receipt_number: str,
    receipt_type: str,
    reference_number: str,
    transaction_type: str,
    customer_name: str,
    customer_cnic: str,
    customer_account: str,
    amount: Decimal,
    currency: str,
    fee: Decimal,
    total_amount: Decimal,
    transaction_status: str,
    transaction_date: datetime,
    branch_name: Optional[str],
    depositor_name: Optional[str],
    narration: Optional[str],
    extra_data: Optional[Dict],
    digital_signature: Optional[str],
    signature_hash: Optional[str],
    signature_timestamp: Optional[datetime],
    signature_algorithm: Optional[str],
    is_signature_valid: Optional[bool]
)
```

---

## Appendix B: Database Seed Data

After running `POST /api/v1/demo/seed`:

**Branches:**
| Code | Name | City | Type |
|------|------|------|------|
| KHI001 | Main Branch Karachi | Karachi | MAIN |
| KHI002 | Gulshan Branch Karachi | Karachi | SUB |
| LHR001 | Main Branch Lahore | Lahore | MAIN |
| ISB001 | Main Branch Islamabad | Islamabad | MAIN |
| FSD001 | Main Branch Faisalabad | Faisalabad | MAIN |

**Users:**
| Username | Role | Branch | Password |
|----------|------|--------|----------|
| admin | ADMIN | -- | Admin@123456 |
| manager.khi | MANAGER | KHI001 | Manager@123 |
| manager.lhr | MANAGER | LHR001 | Manager@123 |
| manager.isb | MANAGER | ISB001 | Manager@123 |
| teller.khi1 | TELLER | KHI001 | Teller@123 |
| teller.khi2 | TELLER | KHI002 | Teller@123 |
| teller.lhr1 | TELLER | LHR001 | Teller@123 |
| teller.isb1 | TELLER | ISB001 | Teller@123 |

---

*End of Developer Guide*
