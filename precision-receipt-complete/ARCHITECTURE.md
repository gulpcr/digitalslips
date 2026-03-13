# Precision Receipt System — Architecture Document
**Meezan Bank — Digital Slip-less Deposit Framework**
*Version 1.0 · March 2026 · Confidential*

---

## 1. Business Purpose

Meezan Bank customers currently fill out paper deposit slips at the branch counter. This system eliminates the paper form. A customer generates a **Digital Reference ID (DRID)** from their phone before arriving at the branch — via WhatsApp, SMS, or the web portal. When they reach a teller, the teller scans or types the DRID, all fields are pre-filled, and the transaction is completed with one click.

**Business outcomes:**
- Teller transaction time reduced from ~4 minutes to under 60 seconds
- Customer queue time reduced — deposit details captured before arrival
- Fully digital audit trail replacing paper slips
- AML and CTR checks run automatically on every transaction
- Digitally signed receipts delivered to customer via WhatsApp/SMS

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CUSTOMER CHANNELS                        │
├──────────────┬──────────────────────┬───────────────────────────┤
│   WhatsApp   │         SMS          │       Web / Mobile        │
│  (Twilio)    │      (Twilio)        │      (React SPA)          │
└──────┬───────┴──────────┬───────────┴────────────┬──────────────┘
       │                  │                         │
       ▼                  ▼                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                    nginx  (Port 80 / 3080)                       │
│         TLS termination · Reverse proxy · Static files          │
└────────┬──────────────────────────────────────┬─────────────────┘
         │  /api/*  /health                     │  /whatsapp/*  /sms/*
         ▼                                      ▼
┌────────────────────┐              ┌─────────────────────────────┐
│   Backend API      │              │   WhatsApp / SMS Server     │
│   FastAPI · 8000   │              │   FastAPI · 8000            │
│                    │              │                             │
│  Auth  · DRID      │◄────────────►│  Session state machine      │
│  AML   · Reports   │  shared DB   │  Twilio TwiML responses     │
│  Receipts · Users  │              │  OpenAI cheque OCR          │
└────────┬───────────┘              └─────────────────────────────┘
         │
         ▼
┌────────────────────┐    ┌────────────────────┐
│   PostgreSQL       │    │      Redis          │
│   Port 5432        │    │      Port 6379      │
│                    │    │                     │
│  All persistent    │    │  Session cache      │
│  data (11 tables)  │    │  Rate limiting      │
└────────────────────┘    └────────────────────┘
         │
         ▼  (planned — not live)
┌────────────────────┐
│   T24 Core Banking │
│   OFS / REST API   │
│   (Temenos Transact│
└────────────────────┘
```

---

## 3. Infrastructure

| Component | Technology | Exposed Port | Purpose |
|---|---|---|---|
| Frontend | React + TypeScript + nginx | 3080 (prod: 80) | Teller web portal + customer mobile demo |
| Backend API | FastAPI (Python 3.11) | 8002 (internal 8000) | All business logic, REST API |
| WhatsApp/SMS Server | FastAPI (Python 3.11) | 9001 (internal 8000) | Twilio webhook receiver, conversation engine |
| Database | PostgreSQL 15 | 5433 (internal 5432) | All persistent data |
| Cache | Redis 7 | 6380 (internal 6379) | Session cache, rate limiting |

All components run as Docker containers in a single Compose stack on one host, connected via an internal Docker network (`precision-network`). Production domain: `rcpt-demo.edimensionz.com`. TLS terminates at the hosting layer before reaching the nginx container.

---

## 4. Transaction Lifecycle (DRID State Machine)

```
Customer generates DRID
        │
        ▼
  ┌─────────────┐
  │  INITIATED  │  DRID created, QR code generated, sent to customer
  └──────┬──────┘
         │  Teller scans QR or types DRID
         ▼
  ┌─────────────┐
  │  RETRIEVED  │  Teller sees all pre-filled fields
  └──────┬──────┘
         │  Teller verifies depositor identity + amount + instrument
         ▼
  ┌─────────────┐
  │  VERIFIED   │  Depositor identity confirmed
  └──────┬──────┘
         │  Teller clicks Complete
         ▼
  ┌─────────────┐
  │  PROCESSING │  Transaction being created
  └──────┬──────┘
         │  AML checks run → Transaction record written → Receipt generated
         ▼
  ┌─────────────┐
  │  COMPLETED  │  Receipt sent to customer via WhatsApp/SMS
  └─────────────┘

  Parallel exit states:
  EXPIRED   — 60 minutes elapsed without teller action
  CANCELLED — customer or teller cancelled
  REJECTED  — teller rejected (verification failed)
  FAILED    — system error during completion
```

**DRID format:** `DRID-YYYYMMDD-XXXXXX` (6-character alphanumeric suffix, ~2.1 billion combinations)

---

## 5. Customer Channel Flows

### WhatsApp (via Twilio Sandbox)
```
Customer sends "HI"
  → Main Menu (Deposit / Balance / Cheque Status / Branch)
    → Deposit Type (Cash / Cheque / Pay Order / Bill / Transfer)
      → Customer Type (Account Holder / Walk-in)
        → Account lookup by CNIC from local DB
          → Amount entry
            → Confirmation
              → DRID + QR code sent back
```
Cheque deposits: customer photographs cheque and sends image → OpenAI GPT-4o extracts amount, cheque number, drawee bank, date automatically.

### SMS (via Twilio)
Same state machine as WhatsApp but text-only. Cheque details entered manually (no image). DRID sent as plain text — no QR code. Messages kept under 160 characters per SMS.

### Web Portal (Teller Interface)
React SPA at `rcpt-demo.edimensionz.com`. Tellers log in with username/password (JWT issued). Teller scans QR code or types DRID → auto-retrieves slip → verify → complete. Managers see branch dashboard and reports. Admin manages users and branches.

---

## 6. Core Business Components

### DRID Service (`app/services/drid_service.py`)
Owns the full deposit slip lifecycle. Creates DRIDs, validates expiry, manages state transitions (retrieve → verify → complete → cancel). Called by both the REST API and indirectly by the WhatsApp/SMS adapters.

### AML Service (`app/services/aml_service.py`)
Runs 8 rule-based checks on every completed transaction, producing a `fraud_score` (0.0–1.0):

| Rule | Trigger | Score |
|---|---|---|
| BLOCKED_CUSTOMER | Customer is blocked | 1.0 (hard block) |
| CTR_REQUIRED | Cash deposit ≥ PKR 250,000 | +0.4 |
| HIGH_AMOUNT | Any type ≥ PKR 500,000 | +0.2 |
| UNVERIFIED_HIGH_AMOUNT | KYC not verified + amount ≥ PKR 100,000 | +0.3 |
| THIRD_PARTY_HIGH_AMOUNT | Depositor CNIC ≠ account CNIC + amount ≥ PKR 200,000 | +0.2 |
| HIGH_FREQUENCY | 3+ completed deposits today (same CNIC) | +0.3 |
| HIGH_DAILY_VOLUME | Daily sum ≥ PKR 500,000 | +0.3 |
| HIGH_MONTHLY_VOLUME | Monthly sum ≥ PKR 2,000,000 | +0.2 |

Score ≥ 0.75 → `is_suspicious = true`. All results stored on the Transaction record and in `audit_logs`.

### Receipt Service (`app/services/receipt_service.py`)
Generates a digitally signed receipt after each completed transaction. Receipt PDF signed with RSA-2048 private key. Signature embedded in the PDF and verifiable independently. Receipt sent to customer via the notification service (WhatsApp / SMS / email).

### Report Service (`app/services/report_service.py`)
Seven built-in reports: transaction summary, user activity, trends, branch comparison, failed transactions, audit trail, fraud alerts. All reports are role-scoped — tellers see only their transactions, managers see their branch, admin sees all.

---

## 7. Data Model (Key Tables)

```
customers          — CNIC, name, KYC status, is_blocked
  └── accounts     — account number, type, status, branch_id

digital_deposit_slips — DRID, status, expires_at, all slip fields
  └── transactions     — reference_number, type, amount, AML fields,
        └── receipts   — PDF data, signature, delivery status

users              — teller/manager/admin accounts, branch_id, role
branches           — branch code, name, city, region

audit_logs         — every action: who, what, before/after (JSONB)
system_settings    — configurable key-value pairs (thresholds etc.)
notifications      — delivery tracking for WhatsApp/SMS/email messages
```

**Transaction types:** CASH_DEPOSIT · CHEQUE_DEPOSIT · PAY_ORDER · BILL_PAYMENT · FUND_TRANSFER

**User roles:** ADMIN · MANAGER · TELLER · AUDITOR

---

## 8. Security Architecture

| Layer | Control |
|---|---|
| Network | TLS at hosting layer; internal Docker network isolated |
| Authentication | JWT (HS256, 60-min expiry) + bcrypt password hashing (12 rounds) |
| Authorisation | Role-based access control on every API endpoint via FastAPI dependency injection |
| Account protection | 3-attempt lockout, 30-minute cooldown |
| Data signing | RSA-2048 signs every receipt — tamper-evident |
| Audit trail | Immutable `audit_logs` table, every state change recorded with user ID and timestamp |
| AML | Automated scoring on every transaction, CTR flagging at PKR 250,000 |
| Secrets | `.env` file excluded from Git; not committed to version control |

**Known gaps (pre-production):** CNIC stored in plain text (needs encryption), no nginx rate limiting, cheque images sent to OpenAI (needs DPA), no NADRA VERIS CNIC verification.

---

## 9. External Integrations

| System | Status | Purpose | Interface |
|---|---|---|---|
| Twilio WhatsApp | **Live** | Customer channel — WhatsApp DRID flow | Twilio Webhook + TwiML |
| Twilio SMS | **Live** | Customer channel — SMS DRID flow | Twilio Webhook + TwiML |
| OpenAI GPT-4o | **Live** | Cheque image OCR | REST API (Vision) |
| T24 / Temenos Transact | **Planned** | Post transactions to core banking | OFS or REST API |
| NADRA VERIS | **Not built** | CNIC verification for walk-in customers | REST API |
| FMU goAML | **Not built** | Suspicious Transaction Report filing | XML upload / API |
| Meta WhatsApp Business | **Not built** | Direct WhatsApp (no Twilio intermediary) | Meta Cloud API |

---

## 10. Current State vs Full Vision

| Capability | Current | Full Vision |
|---|---|---|
| DRID generation via WhatsApp | Yes | Yes |
| DRID generation via SMS | Yes | Yes |
| DRID generation via Web | Yes | Yes |
| Teller portal — retrieve & complete | Yes | Yes |
| AML checks | Yes (rule-based) | Yes + ML scoring |
| Digitally signed receipts | Yes | Yes |
| Transaction posting to T24 | No — manual re-entry | Automated via T24 API |
| CNIC verification (NADRA) | No — manual check | Automated VERIS lookup |
| Straight-through processing (STP) | No | Low-risk transactions auto-post |
| STR filing with FMU | No — manual | Semi-automated goAML integration |
| Mobile app (customer) | Demo only | Full iOS/Android app |
| Kiosk (self-service branch terminal) | Not built | Touch-screen kiosk mode |
| Own WhatsApp Business number | No — Twilio sandbox | Dedicated bank-branded number via Meta |

---

## 11. Deployment

```
Production:  rcpt-demo.edimensionz.com
Repository:  github.com/gulpcr/digitalslips (private)
Stack:       Docker Compose (single host)
Deploy:      docker compose build && docker compose up -d
Logs:        docker compose logs -f [service]
```

Environment variables managed via `.env` file. No CI/CD pipeline currently — manual deployment. No automated backups — PostgreSQL data volume on host filesystem only.

---

*Document maintained by Engineering Team — eDimensionz*
*Contact: Precision Receipt System Project*
