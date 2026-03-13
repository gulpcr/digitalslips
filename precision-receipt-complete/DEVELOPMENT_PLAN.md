# Development Plan — BRD Gap Closure
**Precision Receipt System — Meezan Bank Digital Deposit Slip Framework**
*Tasks for Claude to implement sequentially · March 2026*

Legend: **NEW** = create file · **EDIT** = modify existing file · **MIGRATE** = run SQL migration

---

## Phase 1 — Pilot Go-Live Blockers

---

### TASK-01 — Change DRID Format to MZ- Prefix

**Priority:** CRITICAL | **BRD Ref:** FR-001 | **Effort:** Small

**Description:**
BRD specifies `MZ-YYYYMMDD-XXXXXXXX` (e.g. `MZ-20260305-AB123456`). System generates `DRID-YYYYMMDD-XXXXXX`. Customer-visible value — must match bank branding.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/services/drid_service.py` | `generate_drid()` — change prefix from `DRID` to `MZ`, suffix from 6 to 8 chars |
| EDIT | `backend/app/database/seed.py` | Update any hardcoded `DRID-` example values |
| EDIT | `backend/app/whatsapp/whatsapp_messages.py` | Update any message text referencing "DRID" to "Ref ID" |
| EDIT | `backend/app/sms/sms_messages.py` | Same — update "DRID" to "Ref ID" in SMS text |
| EDIT | `frontend/src/components/DRIDLookupModal.tsx` | Input label: "Enter DRID" → "Enter Ref ID" |
| EDIT | `frontend/src/pages/CustomerDeposit.tsx` | Display label update: "Your DRID" → "Your Reference ID" |
| EDIT | `frontend/src/pages/Dashboard.tsx` | Any column headers referencing "DRID" |

---

### TASK-02 — CNIC Encryption at Rest (AES-256)

**Priority:** CRITICAL | **BRD Ref:** NFR-006, NFR-008 | **Effort:** Medium

**Description:**
BRD requires CNIC stored AES-256 encrypted and displayed masked (`42201-XXXXX30-9`). Currently stored as plain text in three tables.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/core/security.py` | Add `encrypt_cnic(v)`, `decrypt_cnic(v)`, `mask_cnic(v)`, `hash_cnic(v)` functions using `ENCRYPTION_KEY` from config with AES-256-GCM |
| EDIT | `backend/app/models/__init__.py` | Add `cnic_hash VARCHAR(64)` column to `Customer` model; add index on `cnic_hash` for fast lookups |
| EDIT | `backend/app/services/drid_service.py` | Use `encrypt_cnic()` when writing; `decrypt_cnic()` when reading for business logic; query by `cnic_hash` instead of raw `cnic` |
| EDIT | `backend/app/services/aml_service.py` | All velocity queries use `cnic_hash` for filter; `decrypt_cnic()` only when building audit log content |
| EDIT | `backend/app/api/v1/customers.py` | Response serialisation uses `mask_cnic()` — never return raw CNIC |
| EDIT | `backend/app/api/v1/deposit_slips.py` | Same masking in all DRID responses |
| EDIT | `backend/app/api/v1/transactions.py` | Same masking in transaction list/detail responses |
| EDIT | `backend/app/schemas/customer.py` | `cnic` field in response schema is masked string, not raw |
| EDIT | `backend/app/schemas/deposit_slip.py` | `customer_cnic` and `depositor_cnic` fields masked |
| EDIT | `backend/app/schemas/transaction.py` | `customer_cnic` and `depositor_cnic` fields masked |
| NEW | `backend/app/database/migrations/add_cnic_hash.sql` | `ALTER TABLE customers ADD COLUMN cnic_hash VARCHAR(64); CREATE INDEX idx_customers_cnic_hash ON customers(cnic_hash);` |
| NEW | `backend/app/database/migrations/encrypt_existing_cnics.py` | One-time migration script: read each Customer row, encrypt the cnic, write cnic_hash, save encrypted cnic back |

---

### TASK-03 — Session Inactivity Timeout (15 Minutes)

**Priority:** CRITICAL | **BRD Ref:** NFR-007 | **Effort:** Small

**Description:**
BRD requires teller/admin portal session to expire after 15 minutes of inactivity. System issues 60-min JWT with no inactivity tracking.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/core/config.py` | Change `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` default from `60` to `15`; add `SESSION_INACTIVITY_MINUTES: int = 15` |
| EDIT | `backend/app/models/__init__.py` | Add `last_activity_at = Column(DateTime, nullable=True)` to `Session` model |
| EDIT | `backend/app/middleware/auth.py` | After JWT validation, query `sessions` table by token; if `last_activity_at` is older than `SESSION_INACTIVITY_MINUTES`, reject with HTTP 401 `"Session expired due to inactivity"`; otherwise update `last_activity_at = utcnow()` |
| NEW | `backend/app/database/migrations/add_last_activity_at.sql` | `ALTER TABLE sessions ADD COLUMN last_activity_at TIMESTAMP;` |
| EDIT | `frontend/src/App.tsx` | Add Axios response interceptor: if HTTP 401 with `"inactivity"` message, clear token and redirect to `/login` with toast "You were logged out due to inactivity" |

---

### TASK-04 — T24 Account Validation Before DRID Creation

**Priority:** CRITICAL | **BRD Ref:** FR-007 | **Effort:** Medium | **Depends on:** TASK-01

**Description:**
BRD requires live CBS account validation before DRID generation. System checks its own local DB only. `T24_ENABLED`, `T24_API_URL`, `T24_API_KEY`, `T24_TIMEOUT_SECONDS` already exist in config — just need the service layer.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| NEW | `backend/app/services/t24_service.py` | Create `T24Service` class with: `validate_account(account_number)`, `get_customer_by_cnic(cnic)`, `upsert_customer_from_t24(db, t24_data)` — handles timeout, T24 error codes (frozen, dormant, closed) |
| EDIT | `backend/app/services/drid_service.py` | In `create_deposit_slip()`: if `T24_ENABLED`, call `T24Service.validate_account()` before local query; on T24 rejection return specific error; on timeout fall back to local DB with warning logged |
| EDIT | `backend/app/core/config.py` | No new settings needed — `T24_ENABLED`, `T24_API_URL`, `T24_API_KEY`, `T24_TIMEOUT_SECONDS` already exist |

---

### TASK-05 — OTP Flow Wired into Teller Completion UI

**Priority:** HIGH | **BRD Ref:** FR-032 | **Effort:** Medium

**Description:**
`otp_service.py` exists but OTP is not connected to the DRID completion flow. Teller has no UI to trigger OTP or enter the code the customer reads out.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/models/__init__.py` | Add `otp_hash VARCHAR(255)`, `otp_expires_at TIMESTAMP` columns to `DigitalDepositSlip` model |
| NEW | `backend/app/database/migrations/add_otp_fields.sql` | `ALTER TABLE digital_deposit_slips ADD COLUMN otp_hash VARCHAR(255), ADD COLUMN otp_expires_at TIMESTAMP;` |
| EDIT | `backend/app/api/v1/deposit_slips.py` | Add `POST /{drid}/send-otp` endpoint (dispatches OTP via `OTPService`, stores hash+expiry on slip); add `POST /{drid}/verify-otp` endpoint (validates submitted OTP against hash) |
| EDIT | `backend/app/services/drid_service.py` | In `complete_deposit_slip()`: if `OTP_ENABLED` setting is True, check that `otp_hash` on slip matches a verified state before allowing completion |
| EDIT | `backend/app/core/config.py` | Add `OTP_ENABLED: bool = False` — allows toggling per environment |
| EDIT | `frontend/src/components/DRIDLookupModal.tsx` | After verification checklist, if OTP enabled: show "Send OTP to Customer" button; after click show OTP input field; disable "Complete Transaction" until OTP verified |

---

### TASK-06 — DRID Confirmation PDF Download

**Priority:** HIGH | **BRD Ref:** FR-014 | **Effort:** Small

**Description:**
Customer must be able to download/print DRID confirmation as a PDF to bring to branch. No PDF currently generated for the DRID slip itself (only for receipts post-transaction).

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/api/v1/deposit_slips.py` | Add `GET /{drid}/confirmation-pdf` endpoint (no auth required — DRID is public); uses ReportLab to generate and stream PDF with: Ref ID in large font, embedded QR code, masked account/name/amount, 60-min validity instruction, generation + expiry timestamps |
| EDIT | `frontend/src/pages/CustomerDeposit.tsx` | Add "Download PDF" and "Print" buttons to the DRID confirmation screen; call `/api/v1/deposit-slips/{drid}/confirmation-pdf` and trigger browser download |

---

### TASK-07 — Countdown Timer on DRID Confirmation Page

**Priority:** MEDIUM | **BRD Ref:** FR-013 | **Effort:** Small | **Depends on:** TASK-01

**Description:**
Real-time MM:SS countdown showing remaining DRID validity. `expires_at` is already returned in the API response — frontend-only change.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `frontend/src/pages/CustomerDeposit.tsx` | Add countdown component: calculates `expires_at - now()`, renders MM:SS, green→amber→red colour transition, shows "Expired" at 0:00 |
| EDIT | `frontend/src/components/DRIDLookupModal.tsx` | Add same countdown in the teller DRID detail view so teller can see time pressure |

---

### TASK-08 — Teller "New Transaction" Button

**Priority:** HIGH | **BRD Ref:** FR-035 | **Effort:** Small

**Description:**
Tellers must be able to initiate a deposit at the counter for walk-in customers who have no pre-generated DRID. Note: `NewTransactionModal.tsx` already exists in the frontend — verify if it's wired correctly to the backend, or if it only works with pre-existing DRIDs.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `frontend/src/components/NewTransactionModal.tsx` | Ensure form submits to `POST /api/v1/deposit-slips` with `channel: "BRANCH"`; after successful creation, auto-call `POST /api/v1/deposit-slips/{drid}/retrieve` with the teller's ID so it advances directly to verification — skipping the customer pick-up step |
| EDIT | `frontend/src/pages/Dashboard.tsx` | Verify "New Transaction" button is visible and opens `NewTransactionModal` |
| EDIT | `backend/app/services/drid_service.py` | In `create_deposit_slip()`: if `channel == BRANCH`, immediately call `retrieve_deposit_slip()` in the same transaction — returns slip already in RETRIEVED state |

---

### TASK-09 — PDF and Excel Report Export

**Priority:** MEDIUM | **BRD Ref:** FR-040 | **Effort:** Small

**Description:**
BRD requires PDF and Excel export alongside existing CSV. `ExportButton.tsx` exists in the frontend already.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/requirements.txt` | Add `openpyxl>=3.1.0` |
| EDIT | `backend/app/services/report_service.py` | Add `export_to_excel(data, columns) -> bytes` using openpyxl in-memory workbook; add `export_to_pdf(data, title, columns) -> bytes` using ReportLab (already installed) |
| EDIT | `backend/app/api/v1/reports.py` | Each report endpoint already handles `?export=csv` — add `?export=excel` (returns `.xlsx`) and `?export=pdf` (returns `.pdf`) with correct `Content-Type` and `Content-Disposition` headers |
| EDIT | `frontend/src/components/reports/ExportButton.tsx` | Add Excel and PDF buttons alongside existing CSV button |

---

### TASK-10 — Audit Log Retention Policy and Archival

**Priority:** MEDIUM | **BRD Ref:** NFR-009 | **Effort:** Small

**Description:**
BRD requires 7-year tamper-proof audit log retention. Currently no archival or retention enforcement exists.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/models/__init__.py` | Add `archived_at = Column(DateTime, nullable=True)` to `AuditLog` model |
| NEW | `backend/app/database/migrations/add_archived_at.sql` | `ALTER TABLE audit_logs ADD COLUMN archived_at TIMESTAMP;` — also add PostgreSQL rule preventing DELETE on rows younger than 7 years |
| NEW | `backend/app/services/archival_service.py` | `ArchivalService.archive_old_logs(db)` — serialises logs older than 2 years to compressed JSON, writes to `UPLOAD_DIR/archive/`, marks `archived_at`; `purge_archived_logs(db)` — deletes only rows where `archived_at IS NOT NULL AND created_at < now() - interval '7 years'` |
| EDIT | `backend/app/api/v1/reports.py` | Add `POST /api/v1/admin/archival/run` (admin-only) and `GET /api/v1/admin/archival/status` endpoints |

---

### TASK-11 — Replace OpenAI Cheque OCR with On-Premise Tesseract

**Priority:** CRITICAL | **BRD Ref:** NFR-010 | **Effort:** Medium

**Description:**
BRD mandates no external cloud dependency (air-gapped capable). OpenAI OCR sends cheque images to external cloud — blocks on-prem compliance. Must be swappable without code change.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/core/config.py` | Add `OCR_PROVIDER: str = "tesseract"` — values: `"tesseract"` (default/production), `"openai"` (dev/UAT only) |
| NEW | `backend/app/services/ocr_service.py` | `OCRService.extract_cheque_details(image_bytes) -> dict` — routes to provider based on `OCR_PROVIDER`; `TesseractOCRProvider` using `pytesseract`; `OpenAIOCRProvider` — existing logic moved here |
| EDIT | `backend/app/services/cheque_ocr_service.py` | Replace direct OpenAI call with `OCRService.extract_cheque_details()` |
| EDIT | `backend/requirements.txt` | Add `pytesseract>=0.3.10`, `Pillow>=10.0.0` |
| EDIT | `backend/Dockerfile` | Add `RUN apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-eng` before the Python install step |

---

## Phase 2 — Channel Expansion and Transaction Completeness

---

### TASK-12 — Intercity Cheque Deposit as Separate Transaction Type

**Priority:** HIGH | **BRD Ref:** Section 5 #5 | **Effort:** Small | **Depends on:** TASK-01

**Description:**
BRD defines Intercity Cheque as distinct type with duplicate detection and clearing cut-off controls separate from local cheque.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/models/__init__.py` | Add `INTERCITY_CHEQUE_DEPOSIT = "INTERCITY_CHEQUE_DEPOSIT"` to `TransactionType` enum |
| NEW | `backend/app/database/migrations/add_intercity_cheque_type.sql` | `ALTER TYPE transactiontype ADD VALUE 'INTERCITY_CHEQUE_DEPOSIT';` |
| EDIT | `backend/app/services/drid_service.py` | Add to `category_map`; add `clearing_city` required field check in `extra_data`; in `complete_deposit_slip()` add duplicate query: same cheque number + drawee bank + amount in last 30 days → teller warning; add clearing cut-off: if time > 14:00 PKT flag `"next_business_day_clearing": true` in `extra_data` |
| EDIT | `backend/app/services/aml_service.py` | Add slight score bump (+0.1) for `INTERCITY_CHEQUE_DEPOSIT` (cross-city movement indicator) |
| EDIT | `backend/app/whatsapp/whatsapp_adapter.py` | Add "Intercity Cheque" option to the cheque deposit sub-menu |
| EDIT | `backend/app/sms/sms_adapter.py` | Same — add intercity cheque option to SMS menu |

---

### TASK-13 — Credit Card Payment Transaction Type

**Priority:** HIGH | **BRD Ref:** Section 5 #9 | **Effort:** Small | **Depends on:** TASK-01

**Description:**
BRD requires credit card cash payment with duplicate payment prevention.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/models/__init__.py` | Add `CREDIT_CARD_PAYMENT = "CREDIT_CARD_PAYMENT"` to `TransactionType` enum |
| NEW | `backend/app/database/migrations/add_credit_card_type.sql` | `ALTER TYPE transactiontype ADD VALUE 'CREDIT_CARD_PAYMENT';` |
| EDIT | `backend/app/services/drid_service.py` | Add to `category_map` (PAYMENT); in `complete_deposit_slip()` add duplicate check: same `card_number_last4` + same `billing_month` within 24 hours → teller warning (not block) |
| EDIT | `backend/app/whatsapp/whatsapp_adapter.py` | Add "Credit Card Payment" under "Bills/Cards" sub-menu; collect `card_number_last4`, `billing_month` into `extra_data` |
| EDIT | `backend/app/sms/sms_adapter.py` | Same menu addition for SMS |

---

### TASK-14 — Charity / Zakat / Special Collections Transaction Type

**Priority:** MEDIUM | **BRD Ref:** Section 5 #11 | **Effort:** Small | **Depends on:** TASK-01

**Description:**
BRD requires cause code validation and specific narration rules for charity/Zakat collections.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/models/__init__.py` | Add `CHARITY_COLLECTION = "CHARITY_COLLECTION"` to `TransactionType` enum |
| NEW | `backend/app/database/migrations/add_charity_type.sql` | `ALTER TYPE transactiontype ADD VALUE 'CHARITY_COLLECTION';` |
| EDIT | `backend/app/services/drid_service.py` | Add to `category_map` (PAYMENT); add cause code validation against allowed list from `system_settings`; auto-fill narration if blank: `"Charity: {cause_name} - {collection_period}"` |
| EDIT | `backend/app/database/seed.py` | Add default `system_settings` entries for allowed cause codes (e.g., `ZAKAT_2026`, `EDHI_FOUNDATION`, `SAYLANI`) |
| EDIT | `backend/app/whatsapp/whatsapp_adapter.py` | Add "Charity / Zakat" option to deposit type menu; collect `cause_code` and `cause_name` |
| EDIT | `backend/app/sms/sms_adapter.py` | Same menu addition |

---

### TASK-15 — Loan / Financing Instalment Transaction Type

**Priority:** HIGH | **BRD Ref:** Section 5 #8 | **Effort:** Small | **Depends on:** TASK-04

**Description:**
BRD requires loan instalment with auto-posting to T24 via `LOAN.REPAYMENT` application and reconciliation controls.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/models/__init__.py` | Add `LOAN_INSTALMENT = "LOAN_INSTALMENT"` to `TransactionType` enum |
| NEW | `backend/app/database/migrations/add_loan_instalment_type.sql` | `ALTER TYPE transactiontype ADD VALUE 'LOAN_INSTALMENT';` |
| EDIT | `backend/app/services/drid_service.py` | Add to `category_map` (PAYMENT); in `complete_deposit_slip()` if type is `LOAN_INSTALMENT` and `T24_ENABLED`, call `T24Service.post_loan_repayment()` |
| EDIT | `backend/app/services/t24_service.py` | Add `post_loan_repayment(transaction) -> T24Response` — maps to T24 `LOAN.REPAYMENT` application with `loan_account_number`, `principal_component`, `profit_component` from `extra_data` |
| EDIT | `backend/app/whatsapp/whatsapp_adapter.py` | Add "Loan / Financing Instalment" to deposit type menu; collect `loan_account_number`, `instalment_number`, `due_date` |
| EDIT | `backend/app/sms/sms_adapter.py` | Same menu addition |

---

### TASK-16 — Own Account Transfer (Self-Transfer) as Distinct Type

**Priority:** MEDIUM | **BRD Ref:** Section 5 #7 | **Effort:** Small | **Depends on:** TASK-01

**Description:**
BRD splits `FUND_TRANSFER` into self-transfer (low-risk, STP-eligible) vs third-party transfer. System has only one `FUND_TRANSFER` type.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/models/__init__.py` | Add `OWN_ACCOUNT_TRANSFER = "OWN_ACCOUNT_TRANSFER"` to `TransactionType` enum |
| NEW | `backend/app/database/migrations/add_own_transfer_type.sql` | `ALTER TYPE transactiontype ADD VALUE 'OWN_ACCOUNT_TRANSFER';` |
| EDIT | `backend/app/services/drid_service.py` | Add to `category_map` (TRANSFER); in `create_deposit_slip()`: if type is `OWN_ACCOUNT_TRANSFER`, validate both source and destination accounts belong to same customer CNIC — reject if not |
| EDIT | `backend/app/services/aml_service.py` | Skip `THIRD_PARTY_HIGH_AMOUNT` rule for `OWN_ACCOUNT_TRANSFER` |
| EDIT | `backend/app/whatsapp/whatsapp_adapter.py` | Split "Fund Transfer" menu into "Own Account (Self)" and "Third Party Transfer" |
| EDIT | `backend/app/sms/sms_adapter.py` | Same menu split |

---

### TASK-17 — Business / Merchant Deposit AML Enhancements

**Priority:** HIGH | **BRD Ref:** Section 5 #3, FR-008 | **Effort:** Medium

**Description:**
BRD requires merchant_code capture, merchant velocity/aggregation monitoring, and enhanced due diligence workflow at teller for high-risk merchant deposits.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/core/config.py` | Add `AML_MERCHANT_MONTHLY_THRESHOLD_PKR: float = 5000000.00` |
| EDIT | `backend/app/services/aml_service.py` | Add `_check_merchant_velocity(db, merchant_code, amount, exclude_txn_id)` — queries total `CASH_DEPOSIT` transactions this month with same `extra_data->merchant_code`; flag `MERCHANT_HIGH_VOLUME` if over threshold |
| EDIT | `backend/app/whatsapp/whatsapp_adapter.py` | In business/merchant flow: add `merchant_code` collection step; validate against allowed merchant list in `system_settings` |
| EDIT | `backend/app/sms/sms_adapter.py` | Same `merchant_code` collection step |
| EDIT | `frontend/src/components/DRIDLookupModal.tsx` | When `depositor_type = BUSINESS` and AML flags include `MERCHANT_HIGH_VOLUME` or `THIRD_PARTY_HIGH_AMOUNT`, show an "Enhanced Due Diligence" checklist section the teller must complete before proceeding |
| EDIT | `backend/app/database/seed.py` | Seed `system_settings` with an initial allowed merchant codes list |

---

### TASK-18 — Utility / Bill Payment Reference Validation

**Priority:** MEDIUM | **BRD Ref:** Section 5 #10 | **Effort:** Medium | **Depends on:** TASK-04

**Description:**
BRD requires reference number validated against FBR, NADRA, or utility company APIs before DRID creation. Currently any reference is accepted.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/core/config.py` | Add `BILL_VALIDATION_ENABLED: bool = False`, `BILL_VALIDATION_API_URL: str = ""` |
| NEW | `backend/app/services/bill_validation_service.py` | `BillValidationService.validate_reference(bill_type, reference_number) -> dict` — calls external bill validation API; returns `{"valid": bool, "consumer_name": str, "amount_due": Decimal}` or raises on error |
| EDIT | `backend/app/whatsapp/whatsapp_adapter.py` | After `BILL_PAYMENT` reference entry: if `BILL_VALIDATION_ENABLED`, call `BillValidationService.validate_reference()` and show consumer name + amount back to customer for confirmation |
| EDIT | `backend/app/sms/sms_adapter.py` | Same validation step in SMS bill payment flow |
| EDIT | `frontend/src/components/DRIDLookupModal.tsx` | Show `"Reference validated: ✓"` or `"Reference not pre-validated — manual check required"` badge in teller view based on `extra_data.reference_validated` flag |

---

### TASK-19 — WhatsApp via Meta-Approved BSP

**Priority:** CRITICAL | **BRD Ref:** FR-022 | **Effort:** Medium

**Description:**
BRD requires WhatsApp sender displayed as "Meezan Bank" via Meta-approved BSP with bank's own WABA. System uses Twilio sandbox. The `WhatsAppAdapter` state machine is unchanged — only the transport layer swaps.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/core/config.py` | Add `WHATSAPP_PROVIDER: str = "twilio"` — values: `"twilio"`, `"meta"` |
| NEW | `backend/app/whatsapp/providers/__init__.py` | Empty init for providers package |
| NEW | `backend/app/whatsapp/providers/twilio_provider.py` | Extract current Twilio inbound parsing and TwiML response building from `whatsapp_server.py` into `TwilioWhatsAppProvider` class |
| NEW | `backend/app/whatsapp/providers/meta_provider.py` | `MetaWhatsAppProvider`: parse Meta JSON webhook format; respond HTTP 200 immediately; send reply via `POST graph.facebook.com/v18.0/{WHATSAPP_PHONE_NUMBER_ID}/messages` with Bearer token; handle `media_id` resolution for cheque images; handle `hub.challenge` webhook verification GET |
| EDIT | `backend/app/whatsapp/whatsapp_server.py` | Import provider based on `WHATSAPP_PROVIDER` config; delegate inbound parsing and outbound sending to the active provider; add `GET /whatsapp/webhook` for Meta hub verification |

---

### TASK-20 — USSD Channel (*321#)

**Priority:** CRITICAL | **BRD Ref:** FR-023–027 | **Effort:** Large

**Description:**
BRD requires USSD `*321#` for feature-phone/no-internet customers. USSD is a completely different protocol from SMS — session-based, character-limited menus, no internet on customer device, requires PTA short code registration.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/core/config.py` | Add `USSD_ENABLED: bool = False`, `USSD_GATEWAY_URL: str = ""`, `USSD_SHORT_CODE: str = "*321#"`, `USSD_SESSION_TIMEOUT_SECONDS: int = 180` |
| NEW | `backend/app/ussd/__init__.py` | Empty init for USSD package |
| NEW | `backend/app/ussd/ussd_adapter.py` | USSD state machine: ultra-short menus (≤182 chars), session-based flow (USSD_MAIN → DEPOSIT_TYPE → CUSTOMER_TYPE → ACCOUNT → AMOUNT → CONFIRM → DRID_ISSUED); generates 6-digit numeric Ref ID; after session close sends SMS confirmation |
| NEW | `backend/app/ussd/ussd_messages.py` | All USSD screen strings — strictly under 182 characters per screen |
| EDIT | `backend/app/whatsapp/whatsapp_server.py` | Add `POST /ussd/webhook` endpoint accepting USSD gateway HTTP callback (session_id, msisdn, input, session_state); route to `ussd_adapter.py`; return USSD response in gateway's expected format |
| EDIT | `backend/app/models/__init__.py` | `USSD` is already in the `Channel` enum — no change needed |

---

### TASK-21 — Branch Kiosk Interface (Touch + Urdu)

**Priority:** HIGH | **BRD Ref:** FR-015–017 | **Effort:** Large

**Description:**
BRD requires a full-screen touch-optimised kiosk with English/Urdu toggle, receipt printing, and DRID re-generation for walk-in customers. Kiosk also needs to retrieve receipts post-transaction.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `frontend/package.json` | Add `i18next`, `react-i18next` for translations |
| NEW | `frontend/src/locales/en.json` | English strings for all kiosk-facing UI text |
| NEW | `frontend/src/locales/ur.json` | Urdu translations of all kiosk strings (RTL text) |
| NEW | `frontend/src/pages/Kiosk.tsx` | Full-screen touch-optimised page: large buttons, no hover states, language toggle (EN/اردو); flow: DRID generation (same as `CustomerDeposit.tsx` but touch-optimised) + receipt retrieval by CNIC or TXN ref; `@media print` CSS for thermal receipt 80mm layout |
| EDIT | `frontend/src/App.tsx` | Add `/kiosk` route pointing to `Kiosk.tsx` |
| EDIT | `backend/app/models/__init__.py` | Add `KIOSK = "KIOSK"` to `Channel` enum |
| NEW | `backend/app/database/migrations/add_kiosk_channel.sql` | `ALTER TYPE channel ADD VALUE 'KIOSK';` |
| EDIT | `backend/app/api/v1/branches.py` | Add `GET /{branch_id}/kiosk-qr` endpoint — returns a QR code encoding the kiosk URL pre-loaded with the branch ID (for branch lobby QR posters) |

---

### TASK-22 — Active Directory / LDAP Authentication (Teller SSO)

**Priority:** HIGH | **BRD Ref:** Section 13 Integration | **Effort:** Medium

**Description:**
BRD requires teller SSO via the bank's Active Directory/LDAP. Currently system uses its own credential store. With LDAP, tellers use their existing bank network password — no separate password to manage.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/requirements.txt` | Add `ldap3>=2.9.1` |
| EDIT | `backend/app/core/config.py` | Add `LDAP_ENABLED: bool = False`, `LDAP_SERVER: str = ""`, `LDAP_PORT: int = 389`, `LDAP_BASE_DN: str = ""`, `LDAP_BIND_DN: str = ""`, `LDAP_BIND_PASSWORD: str = ""`, `LDAP_USER_SEARCH_FILTER: str = "(sAMAccountName={username})"`, `LDAP_ROLE_ATTRIBUTE: str = "department"` |
| EDIT | `backend/app/services/auth_service.py` | In `authenticate_user()`: if `LDAP_ENABLED`, try LDAP bind first; on success, look up or auto-create local `User` record using LDAP `sAMAccountName` and `department`/group to assign role; if LDAP fails, reject (do not fall back to local credentials); if `LDAP_ENABLED = False`, use existing bcrypt flow |

---

## Phase 3 — Core Banking Integration and Full Rollout

---

### TASK-23 — T24 Transaction Posting (Scenario 1)

**Priority:** CRITICAL | **BRD Ref:** Section 8.2 Scenario 1 | **Effort:** Large | **Depends on:** TASK-04

**Description:**
BRD Scenario 1: after teller verification the vendor system posts to T24 automatically — teller no longer re-keys in T24. `t24_transaction_id`, `t24_posting_date`, `t24_response` columns already exist on the `Transaction` model.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/services/t24_service.py` | Add `post_cash_deposit(txn)`, `post_cheque_deposit(txn)`, `post_pay_order(txn)`, `post_bill_payment(txn)`, `post_fund_transfer(txn)` — each maps `Transaction` + `extra_data` fields to the correct T24 application and returns a `T24Response` with `t24_transaction_id` |
| EDIT | `backend/app/services/drid_service.py` | In `complete_deposit_slip()` after AML checks: call appropriate `T24Service.post_*()` method; on success store `t24_transaction_id`, `t24_posting_date`, `t24_response`; on T24 failure revert slip to VERIFIED and raise error; on timeout add to Redis retry queue |
| EDIT | `backend/app/api/v1/deposit_slips.py` | Include `t24_transaction_id` in `DepositSlipCompleteResponse` |
| EDIT | `backend/app/schemas/deposit_slip.py` | Add `t24_transaction_id: Optional[str]` to `DepositSlipCompleteResponse` |
| EDIT | `backend/app/api/v1/reports.py` | Add `GET /api/v1/admin/t24-queue` — lists transactions in Redis retry queue (admin-only) |
| EDIT | `frontend/src/components/DRIDLookupModal.tsx` | Show T24 Transaction ID on the completion success screen |

---

### TASK-24 — ESB Integration for Straight-Through Processing (Scenario 2)

**Priority:** HIGH | **BRD Ref:** Section 8.2 Scenario 2 | **Effort:** Large | **Depends on:** TASK-23

**Description:**
BRD Scenario 2: full STP — vendor system submits to ESB which routes to T24 asynchronously. No teller T24 session required at all.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/core/config.py` | Add `ESB_ENABLED: bool = False`, `ESB_API_URL: str = ""`, `ESB_API_KEY: str = ""`, `ESB_TIMEOUT_SECONDS: int = 30`, `STP_ELIGIBLE_TYPES: str = ""` (comma-separated TransactionType values) |
| NEW | `backend/app/services/esb_service.py` | `ESBService.submit_transaction(txn) -> ESBResponse` — wraps transaction in ESB message envelope (REST or SOAP per bank IT spec); handles async acknowledgement (ESB returns correlation ID); `ESBService.handle_callback(payload)` — processes ESB callback when T24 posts |
| EDIT | `backend/app/services/drid_service.py` | If `ESB_ENABLED`, route `complete_deposit_slip()` through `ESBService` instead of direct `T24Service`; for STP-eligible types (`STP_ELIGIBLE_TYPES` list) with AML score = 0, skip teller verification checklist |
| EDIT | `backend/app/whatsapp/whatsapp_server.py` | Add `POST /esb/callback` endpoint — receives T24 confirmation callback from ESB; calls `ESBService.handle_callback()`; updates `Transaction.t24_transaction_id` and `DigitalDepositSlip.status` |
| NEW | `backend/app/services/reconciliation_service.py` | `ReconciliationService.reconcile_recent(db)` — queries T24 for transactions posted in the last hour not yet confirmed in local DB; matches by teller + amount + time window; closes gaps |
| EDIT | `backend/app/api/v1/reports.py` | Add `POST /api/v1/admin/reconciliation/run` (admin-only) and `GET /api/v1/admin/reconciliation/status` |

---

### TASK-25 — Document Archive / DMS Integration

**Priority:** HIGH | **BRD Ref:** Section 13 — DMS | **Effort:** Medium | **Depends on:** TASK-10

**Description:**
BRD requires all receipts and transaction records archived to bank's DMS for 7-year retention. Currently receipts exist only in the PostgreSQL volume.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/core/config.py` | Add `DMS_ENABLED: bool = False`, `DMS_API_URL: str = ""`, `DMS_API_KEY: str = ""` |
| NEW | `backend/app/services/dms_service.py` | `DMSService.archive_receipt(receipt) -> str` — uploads receipt PDF to DMS, returns `dms_document_id`; `DMSService.archive_transaction(txn) -> str`; `DMSService.get_document(dms_document_id) -> bytes` |
| EDIT | `backend/app/models/__init__.py` | Add `dms_document_id = Column(String(100), nullable=True)` to `Receipt` model |
| NEW | `backend/app/database/migrations/add_dms_document_id.sql` | `ALTER TABLE receipts ADD COLUMN dms_document_id VARCHAR(100);` |
| EDIT | `backend/app/services/drid_service.py` | After `ReceiptService.create_receipt()`: if `DMS_ENABLED`, call `DMSService.archive_receipt()` as a FastAPI `BackgroundTask` (non-blocking) |
| EDIT | `backend/app/api/v1/receipts.py` | Add `GET /{receipt_id}/archive` endpoint — retrieves archived copy from DMS via `DMSService.get_document()` (auditor-only) |

---

### TASK-26 — Meezan Mobile App API (DDS Module Endpoints)

**Priority:** HIGH | **BRD Ref:** Section 6.2, Section 13 | **Effort:** Medium | **Depends on:** TASK-04

**Description:**
BRD requires the Meezan Mobile App team to integrate using vendor APIs. Current `MobileDemo.tsx` is a UI mockup only. Need dedicated authenticated mobile API endpoints.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/core/config.py` | Add `MOBILE_APP_JWT_SECRET: str = ""`, `MOBILE_APP_BUNDLE_ID: str = ""` |
| NEW | `backend/app/api/v1/mobile/__init__.py` | Empty init for mobile API package |
| NEW | `backend/app/api/v1/mobile/auth.py` | `POST /api/v1/mobile/auth/login` — accepts app auth token, issues customer-scoped JWT (read/create own DRIDs only — no teller or admin permissions) |
| NEW | `backend/app/api/v1/mobile/accounts.py` | `GET /api/v1/mobile/accounts` — returns authenticated customer's accounts fetched via `T24Service.get_customer_by_cnic()` |
| NEW | `backend/app/api/v1/mobile/deposits.py` | `POST /api/v1/mobile/deposit-slips` — creates DRID with `channel: "MOBILE"`; `GET /api/v1/mobile/deposit-slips/{drid}` — status polling (customer sees when teller completes) |
| NEW | `backend/app/api/v1/mobile/receipts.py` | `GET /api/v1/mobile/receipts` — customer's own transaction history and receipt download links |
| EDIT | `backend/app/main.py` | Register `mobile` router with prefix `/api/v1/mobile` |

---

## Phase 4 — Post-Go-Live Optimisations

---

### TASK-27 — Redis-Backed Session Persistence for WhatsApp / SMS

**Priority:** HIGH | **BRD Ref:** NFR-005 | **Effort:** Medium

**Description:**
WhatsApp/SMS sessions in Python dict — lost on container restart, prevents horizontal scaling. Redis is already in the stack and accessible from the `whatsapp` container.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/whatsapp/whatsapp_adapter.py` | Replace in-memory `sessions: Dict[str, UserSession]` dict in `SessionManager` with Redis operations: `get_session(phone)` → `redis.hgetall(f"wa:session:{phone}")` + JSON deserialise; `save_session(phone, session)` → `redis.hset()` + `redis.expire(…, 1800)`; `delete_session(phone)` → `redis.delete()` |
| EDIT | `backend/app/sms/sms_adapter.py` | Same Redis-backed session manager replacement (key prefix `sms:session:`) |

---

### TASK-28 — Q-Matic Queue Management Integration

**Priority:** LOW | **BRD Ref:** Section 14 Phase 4 | **Effort:** Medium

**Description:**
BRD Phase 4: DRID linked to a branch queue ticket so the customer gets a queue number along with their Ref ID and the teller display shows their name when called.

**Files to Change:**

| Action | File | What Changes |
|---|---|---|
| EDIT | `backend/app/core/config.py` | Add `QMATIC_ENABLED: bool = False`, `QMATIC_API_URL: str = ""`, `QMATIC_BRANCH_MAPPING: str = ""` (JSON mapping branch_code → qmatic_branch_id) |
| NEW | `backend/app/services/qmatic_service.py` | `QMaticService.issue_ticket(branch_id, service_type) -> QueueTicket` — calls Q-Matic API, returns `ticket_number` and `estimated_wait_minutes` |
| EDIT | `backend/app/services/drid_service.py` | In `create_deposit_slip()`: after DRID is created, if `QMATIC_ENABLED` and branch has a Q-Matic mapping, call `QMaticService.issue_ticket()`; store `queue_ticket_number` and `estimated_wait_minutes` in `extra_data` |
| EDIT | `backend/app/whatsapp/whatsapp_messages.py` | Update DRID confirmation message to include: `"Queue Ticket: B-042. Est. wait: 12 min."` when `queue_ticket_number` is set |
| EDIT | `backend/app/sms/sms_messages.py` | Same queue ticket addition in SMS confirmation |
| EDIT | `frontend/src/components/DRIDLookupModal.tsx` | Show queue ticket number in teller DRID detail view |

---

## Complete File Change Map

A quick reference showing every file touched and which tasks affect it.

### Backend — Services

| File | Tasks |
|---|---|
| `backend/app/services/drid_service.py` | 01, 02, 04, 05, 08, 12, 13, 14, 15, 16, 23, 24, 25, 27, 28 |
| `backend/app/services/aml_service.py` | 02, 12, 16, 17 |
| `backend/app/services/t24_service.py` *(new + extend)* | 04, 15, 23 |
| `backend/app/services/auth_service.py` | 22 |
| `backend/app/services/report_service.py` | 09, 10 |
| `backend/app/services/cheque_ocr_service.py` | 11 |
| `backend/app/services/archival_service.py` *(new)* | 10 |
| `backend/app/services/ocr_service.py` *(new)* | 11 |
| `backend/app/services/bill_validation_service.py` *(new)* | 18 |
| `backend/app/services/esb_service.py` *(new)* | 24 |
| `backend/app/services/dms_service.py` *(new)* | 25 |
| `backend/app/services/reconciliation_service.py` *(new)* | 24 |
| `backend/app/services/qmatic_service.py` *(new)* | 28 |

### Backend — API Endpoints

| File | Tasks |
|---|---|
| `backend/app/api/v1/deposit_slips.py` | 05, 06, 23 |
| `backend/app/api/v1/reports.py` | 09, 10, 23, 24 |
| `backend/app/api/v1/customers.py` | 02 |
| `backend/app/api/v1/transactions.py` | 02 |
| `backend/app/api/v1/branches.py` | 21 |
| `backend/app/api/v1/receipts.py` | 25 |
| `backend/app/api/v1/mobile/` *(new package)* | 26 |
| `backend/app/main.py` | 26 |

### Backend — Core

| File | Tasks |
|---|---|
| `backend/app/core/config.py` | 03, 05, 11, 17, 18, 19, 20, 22, 23, 24, 25, 26, 28 |
| `backend/app/core/security.py` | 02 |
| `backend/app/middleware/auth.py` | 03 |
| `backend/app/models/__init__.py` | 02, 03, 05, 12, 13, 14, 15, 16, 21, 25 |

### Backend — Channels

| File | Tasks |
|---|---|
| `backend/app/whatsapp/whatsapp_server.py` | 19, 20, 24 |
| `backend/app/whatsapp/whatsapp_adapter.py` | 12, 13, 14, 15, 16, 17, 18, 27 |
| `backend/app/whatsapp/whatsapp_messages.py` | 01, 28 |
| `backend/app/whatsapp/providers/` *(new package)* | 19 |
| `backend/app/sms/sms_adapter.py` | 12, 13, 14, 15, 16, 17, 18, 27 |
| `backend/app/sms/sms_messages.py` | 01, 28 |
| `backend/app/ussd/` *(new package)* | 20 |

### Backend — Infrastructure

| File | Tasks |
|---|---|
| `backend/requirements.txt` | 09, 11, 22 |
| `backend/Dockerfile` | 11 |
| `backend/app/database/seed.py` | 01, 14 |
| `backend/app/database/migrations/` *(new files)* | 02, 03, 05, 12, 13, 14, 15, 16, 10, 21, 25 |

### Frontend

| File | Tasks |
|---|---|
| `frontend/src/App.tsx` | 03, 21 |
| `frontend/src/pages/CustomerDeposit.tsx` | 01, 06, 07 |
| `frontend/src/pages/Dashboard.tsx` | 01, 08 |
| `frontend/src/pages/Reports.tsx` | 09 |
| `frontend/src/pages/Kiosk.tsx` *(new)* | 21 |
| `frontend/src/components/DRIDLookupModal.tsx` | 01, 05, 07, 17, 18, 23, 28 |
| `frontend/src/components/NewTransactionModal.tsx` | 08 |
| `frontend/src/components/reports/ExportButton.tsx` | 09 |
| `frontend/src/locales/en.json` *(new)* | 21 |
| `frontend/src/locales/ur.json` *(new)* | 21 |
| `frontend/package.json` | 21 |

---

*Development plan prepared by: Engineering Team — eDimensionz*
*Based on: gap.md and Meezan_Bank_DDS_BRD_v2.docx*
*Date: March 2026*
