# Precision Receipt System — Technical FAQ
### How-To Guide for Development & Implementation Teams

---

## Table of Contents

1. [T24 Integration — Fetching Customer Data](#1-t24-integration--fetching-customer-data)
2. [Switching to a Local SMS Provider](#2-switching-to-a-local-sms-provider)
3. [Switching to Your Own WhatsApp Number](#3-switching-to-your-own-whatsapp-number)
4. [Adding New Reports](#4-adding-new-reports)
5. [Adding a New Transaction Type](#5-adding-a-new-transaction-type)
6. [Scaling Under Load](#6-scaling-under-load)
7. [Security Posture](#7-security-posture)

---

## 1. T24 Integration — Fetching Customer Data

---

**Q: Right now where does the system get customer data from?**

A: From its own PostgreSQL database. When a customer sends their CNIC via WhatsApp or SMS, `create_deposit_slip()` in `drid_service.py` does `db.query(Customer).filter(Customer.cnic == customer_cnic).first()`. The `customers` table in the local database is the source. Currently that data was seeded manually. There is no live connection to T24.

---

**Q: How will customer data come from T24 when the integration is live?**

A: Two patterns are available — pick based on T24 version and available APIs:

**Option A — Sync (recommended for high volume)**
A background job (daily or event-driven) calls the T24 Customer enquiry API and upserts the result into the local `customers` and `accounts` tables. The DRID flow continues querying the local database — zero latency impact. The job can be a simple Python script using the existing `app/core/database.py` session and the T24 REST endpoint `GET /party/customers/{cnic}` or OFS enquiry `CUSTOMER.ENQUIRY,,/{cnic}`. Cache freshness is typically good enough — customer KYC status and account details change rarely.

**Option B — Live lookup (recommended for real-time accuracy)**
Inside `DRIDService.create_deposit_slip()`, before the local customer query, add a T24 lookup:
```python
# In drid_service.py create_deposit_slip()
if settings.T24_ENABLED:
    t24_customer = T24Service.get_customer_by_cnic(customer_cnic)
    if t24_customer:
        _upsert_customer_from_t24(db, t24_customer)  # Keep local DB in sync
```
Then continue with the local query. The upsert means the local DB is always up to date after the lookup and subsequent flows (AML velocity checks, reporting) work against local data without further T24 calls.

The config already has `T24_ENABLED`, `T24_API_URL`, `T24_API_KEY`, and `T24_TIMEOUT_SECONDS` in `config.py`. Only `app/services/t24_service.py` needs to be created.

---

**Q: What T24 customer fields does the system need?**

A: The `Customer` model needs these fields from T24:

| System Field | T24 OFS Field | T24 REST Path |
|---|---|---|
| `cnic` | `SHORT.NAME` | `customerId` |
| `full_name` | `NAME` | `partyName` |
| `phone` | `PHONE` | `mobilePhone` |
| `email` | `EMAIL` | `emailAddress` |
| `date_of_birth` | `DATE.OF.BIRTH` | `dateOfBirth` |
| `kyc_status` | `CUSTOMER.STATUS` | `kycStatus` |
| `is_blocked` | `FROZEN` | `accountStatus` |
| `account_number` | `ACCOUNT.ENQUIRY` | `/accounts?customerId=` |
| `account_type` | `ACCOUNT.TYPE` | `accountType` |

For cash deposits the minimum required is `full_name`, `account_number`, and `kyc_status`. Everything else enriches the AML checks and receipt.

---

**Q: What if T24 is down when a customer tries to generate a DRID?**

A: The local database acts as the fallback. If `T24Service.get_customer_by_cnic()` times out or returns an error, the system logs the failure and falls back to the local customer record. If the customer exists locally (from a prior sync), the DRID is created normally. If the customer has never been synced, the creation fails with a clear message: "Customer not found. Please visit the branch or contact customer service." This is acceptable — a new customer who has never interacted with the system before cannot self-serve without a prior data sync. The T24 timeout is already configurable: `T24_TIMEOUT_SECONDS = 30` in `config.py`.

---

## 2. Switching to a Local SMS Provider

---

**Q: How is SMS currently wired?**

A: Two layers:
- **Transport layer** — `whatsapp_server.py` handles the `/sms/webhook` endpoint. It receives Twilio's HTTP POST, extracts `Body` and `From`, calls the adapter, and returns a TwiML `<Response><Message>` XML response back to Twilio. Twilio then delivers that message to the customer.
- **Logic layer** — `sms_adapter.py` and `sms_messages.py` contain the full conversation state machine (30+ states: MAIN_MENU → DEPOSIT_TYPE → ACCOUNT_SELECTION → AMOUNT_INPUT → CONFIRMATION etc.). This layer has zero knowledge of Twilio — it just processes text in and returns text out.

---

**Q: What exactly needs to change to switch to a local SMS gateway (e.g., PTCL, local aggregator, or bank-owned SMSC)?**

A: Only the transport layer changes. The state machine in `sms_adapter.py` is untouched. Specifically:

**1. Inbound webhook** — local gateways typically POST in a different format than Twilio. Twilio sends:
```
Body=Hello&From=%2B923001234567&To=%2B14155238886
```
A local gateway might send JSON:
```json
{"from": "03001234567", "message": "Hello", "timestamp": "..."}
```
Change the `/sms/webhook` handler in `whatsapp_server.py` to parse the local format. The phone number normalisation (stripping `+`, country code handling) also needs to match the local format.

**2. Outbound sending** — currently the handler returns a TwiML XML response. Local gateways typically require an HTTP callback or a separate outbound API call. Change the response from TwiML to either HTTP 200 (empty body) plus a separate POST to the gateway's send endpoint.

**3. Config** — `SMS_PROVIDER: str = "twilio"` already exists in `config.py`. Add a second provider branch:
```python
if settings.SMS_PROVIDER == "twilio":
    return build_twiml_response(text)
elif settings.SMS_PROVIDER == "local_gateway":
    send_via_local_gateway(to_number, text)
    return Response(status_code=200)
```

**Effort: 1–2 days** for a developer who has the local gateway API documentation. No database changes, no state machine changes, no frontend changes.

---

**Q: Are there any limitations with SMS that WhatsApp does not have?**

A: Yes. SMS has a 160-character limit per message (multipart SMS works but costs more per message). The current `sms_messages.py` already handles this — messages are kept short and use numbered menus instead of rich text. The cheque OCR feature is not available over SMS (no image support) so cheque deposits use manual text entry (the user types cheque number, date, and bank name separately). This is already implemented. The main functional difference is no QR code — the DRID reference number is sent as plain text and the customer reads it to the teller.

---

## 3. Switching to Your Own WhatsApp Number

---

**Q: What does "your own WhatsApp integration" mean technically?**

A: Currently the system uses Twilio as a middleman — customers message Twilio's shared sandbox number and Twilio forwards to this system. "Your own integration" means registering the bank's own phone number directly with Meta's WhatsApp Business API (Cloud API) so messages flow: Customer → Meta → your webhook directly, with no Twilio in the chain. The bank's name and number appear in the customer's WhatsApp contact as the verified business.

---

**Q: What code changes are needed to switch from Twilio WhatsApp to Meta Cloud API?**

A: The `WhatsAppAdapter` state machine in `whatsapp_adapter.py` and all of `whatsapp_messages.py` are completely unchanged — they process structured session data with no awareness of which transport is used. Only the webhook server layer changes:

**Inbound (receiving messages from customers):**

Twilio format (current):
```
Body=Hello&From=whatsapp%3A%2B923001234567&MediaUrl0=https://...
```
Meta Cloud API format (new):
```json
{"entry":[{"changes":[{"value":{
  "messages":[{"from":"923001234567","text":{"body":"Hello"}}]
}}]}]}
```
The webhook in `whatsapp_server.py` needs to parse the new JSON format. Meta also requires a one-time webhook verification: a `GET` on the webhook URL with `hub.challenge` must be echoed back before messages start flowing.

**Outbound (sending replies to customers):**

Twilio uses TwiML — you return XML in the HTTP response to the webhook. Meta does not use this pattern — you must respond to the webhook with HTTP 200 immediately, then make a **separate** outbound API call:
```
POST https://graph.facebook.com/v18.0/{phone_number_id}/messages
Authorization: Bearer {access_token}
Content-Type: application/json

{"messaging_product":"whatsapp","to":"923001234567","text":{"body":"Your DRID is..."}}
```
This decouples sending from receiving, which is actually better — no 15-second Twilio timeout risk.

**Cheque images:**
Twilio gives a direct `MediaUrl0` URL. Meta gives a `media_id` that must be resolved with a separate API call before downloading.

**Config changes needed:**
`WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_API_KEY` already exist in `config.py` — just populate them.

**Effort: 2–3 days** to swap the transport layer. The state machine, database operations, AML checks, and receipt generation are all untouched.

---

**Q: What does the bank need to set up on the Meta side?**

A: Five steps:
1. **Meta Business Account** — verified at business.facebook.com with the bank's legal name
2. **WhatsApp Business Account (WABA)** — created under the business account
3. **Phone number registration** — a dedicated number (landline or mobile) registered to the WABA. That number can no longer be used on standard WhatsApp.
4. **Business verification** — submit bank registration documents to Meta. Takes 1–5 business days for a licensed bank.
5. **Message templates** — for any message sent more than 24 hours after the customer last wrote (e.g., a transaction receipt sent later the same day). Submit templates (DRID confirmation, transaction receipt, AML hold notice) to Meta for approval. Takes 1–2 business days each.

The bank number then appears as a verified "Meezan Bank" contact in every customer's WhatsApp — far better trust than Twilio's shared sandbox number.

---

## 4. Adding New Reports

---

**Q: How are reports structured in the codebase?**

A: Three files own the reports feature:
- `app/services/report_service.py` — query logic, one static method per report
- `app/schemas/report.py` — Pydantic response schemas (one dataclass per report type)
- `app/api/v1/reports.py` — REST endpoints, role-based access enforcement

The `ReportService` has a `_apply_role_filter()` method that automatically scopes data: ADMIN and AUDITOR see all branches, MANAGER sees own branch only, TELLER sees only their own transactions. This filter is applied uniformly — any new report built with the same pattern gets role-based scoping for free.

Existing reports: `transaction-summary`, `user-activity`, `transaction-trends`, `branch-comparison`, `failed-transactions`, `audit-trail`, `fraud-alerts`.

---

**Q: What are the exact steps to add a new report — for example a "Daily Cash Position" report?**

A: Three steps, three files:

**Step 1 — Schema** (`app/schemas/report.py`):
```python
class DailyCashPositionEntry(BaseModel):
    branch_id: str
    branch_name: str
    cash_in: Decimal
    cheque_in: Decimal
    total_deposits: int
    report_date: date

class DailyCashPositionReport(BaseModel):
    entries: List[DailyCashPositionEntry]
    grand_total_cash: Decimal
    grand_total_cheque: Decimal
    generated_at: datetime
```

**Step 2 — Service** (`app/services/report_service.py`):
```python
@staticmethod
def get_daily_cash_position(db, current_user, filters) -> DailyCashPositionReport:
    query = db.query(
        Transaction.branch_id,
        Transaction.transaction_type,
        func.sum(Transaction.amount).label("total"),
        func.count().label("count")
    ).filter(
        Transaction.status == TransactionStatus.COMPLETED
    )
    query = ReportService._apply_role_filter(query, current_user, db)
    query = ReportService._apply_date_filter(query, filters)
    # group by branch, pivot on type, return DailyCashPositionReport
```

**Step 3 — Endpoint** (`app/api/v1/reports.py`):
```python
@router.get("/daily-cash-position", response_model=DailyCashPositionReport)
async def daily_cash_position(
    filters: ReportFilters = Depends(),
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    return ReportService.get_daily_cash_position(db, current_user, filters)
```

That is the entire change — no migrations, no model changes, no frontend rebuild required (the frontend report page fetches dynamically from the API). **Effort: half a day** for a developer familiar with SQLAlchemy and the existing report pattern.

---

**Q: Can reports be exported to CSV or Excel?**

A: CSV export is already built. `report_service.py` has a CSV export helper and the `reports.py` endpoint accepts an `?export=csv` query parameter that returns a `StreamingResponse` with a `Content-Disposition: attachment` header. Adding Excel export requires adding `openpyxl` to `requirements.txt` and a 20-line method in `report_service.py` that writes rows to an in-memory `openpyxl` workbook and streams it back. No structural changes needed.

---

## 5. Adding a New Transaction Type

---

**Q: What transaction types exist today and what is the data model?**

A: Five types are defined in the `TransactionType` enum in `app/models/__init__.py`:
- `CASH_DEPOSIT` — category: DEPOSIT
- `CHEQUE_DEPOSIT` — category: DEPOSIT, requires instrument verification
- `PAY_ORDER` — category: PAYMENT, requires instrument verification
- `BILL_PAYMENT` — category: PAYMENT
- `FUND_TRANSFER` — category: TRANSFER

The `category_map` in `DRIDService.complete_deposit_slip()` determines how each type maps to a `TransactionCategory`. Type-specific extra data (cheque number, drawee bank, bill reference, etc.) is stored in the `extra_data` JSONB column — no separate table needed for most new types.

---

**Q: What are the exact steps to add a new transaction type — for example "LOAN_INSTALLMENT"?**

A: Five changes across five files:

**1. `app/models/__init__.py`** — add to the enum:
```python
class TransactionType(str, enum.Enum):
    ...
    LOAN_INSTALLMENT = "LOAN_INSTALLMENT"
```

**2. `app/services/drid_service.py`** — add to `category_map`:
```python
category_map = {
    ...
    TransactionType.LOAN_INSTALLMENT: TransactionCategory.PAYMENT,
}
```
And if this type requires instrument verification, add to the check in `verify_deposit_slip()`.

**3. `app/whatsapp/whatsapp_adapter.py`** — add `"5": "Loan Installment"` to the deposit type menu and a handler branch that collects any loan-specific extra fields (e.g., loan account number).

**4. `app/sms/sms_adapter.py`** — same menu addition for the SMS flow.

**5. Database migration** — PostgreSQL enums require an `ALTER TYPE` migration:
```sql
ALTER TYPE transactiontype ADD VALUE 'LOAN_INSTALLMENT';
```
Run via `app/database/migrations/run_migrations.py`.

If T24 integration is live, also add the T24 application mapping in `T24Service` (loan installments post to T24's `LOAN.REPAYMENT` application, not `TELLER`).

**Effort: 1 day** including testing. No new tables or columns needed — `extra_data JSONB` absorbs type-specific fields.

---

## 6. Scaling Under Load

---

**Q: What is the current capacity ceiling and what breaks first?**

A: Three bottlenecks in priority order:

**1. In-memory sessions (breaks first under horizontal scaling)**
The WhatsApp/SMS conversation state is stored in Python dictionaries in the `whatsapp` container's process memory. If you run two `whatsapp` containers behind a load balancer, sessions are split across containers — a customer might hit a different container on their next message and lose their session. Fix: move sessions from the in-memory dict to Redis using `HSET`/`HGET` keyed by phone number. The `UserSession` dataclass is already serialisable. Redis is already in the stack. This is the most important scaling prerequisite.

**2. Database connection pool (moderate risk)**
`config.py` sets `DB_POOL_SIZE = 20, DB_MAX_OVERFLOW = 0` — a hard ceiling of 20 simultaneous database connections across all containers. Under high teller load (many branches completing transactions simultaneously) this pool exhausts and requests queue. Short-term fix: increase `DB_MAX_OVERFLOW` to 10. Proper fix: add PgBouncer in transaction pooling mode between the application and PostgreSQL, which lets the application maintain a large pool while PostgreSQL sees a small number of actual connections.

**3. Single host (breaks under hardware failure)**
The entire system runs on one Docker Compose host. There is no automatic failover. Fix: move to a container orchestrator (Docker Swarm or Kubernetes) with at least two hosts and a managed PostgreSQL service (AWS RDS, Azure DB). With Redis-backed sessions in place, the stateless `whatsapp` and `backend` containers can run as replicated services instantly.

---

**Q: How does the system scale from 10 branches to 100 branches?**

A: A 10x branch increase means roughly 10x concurrent tellers and 10x customer message volume. The sequence of changes needed:

| Step | Change | Unlocks |
|---|---|---|
| 1 | Redis-backed sessions | Run multiple `whatsapp` replicas |
| 2 | Increase `DB_MAX_OVERFLOW` to 20 | Handle more concurrent DB ops |
| 3 | Add PgBouncer | DB handles 10x connection attempts |
| 4 | Move to managed PostgreSQL (RDS) | Automated backups, read replica for reports |
| 5 | Docker Swarm or k8s with 2+ nodes | Automatic failover, rolling deploys |
| 6 | nginx load balancer in front | Distribute teller web traffic across backend replicas |

Steps 1–4 can be done on the existing infrastructure without a hosting change. The application code (FastAPI async endpoints) is already designed for horizontal scaling — no rewrites needed.

---

**Q: The cheque OCR calls OpenAI synchronously — does this become a problem at scale?**

A: Yes. The WhatsApp webhook must respond within 15 seconds or Twilio marks it as failed. Under light load this is fine. At scale, if many customers are sending cheque images simultaneously, OpenAI API latency can spike. The fix is to make OCR asynchronous: respond to Twilio immediately with "Processing your cheque, please wait..." then trigger the OCR call via a background task (FastAPI's `BackgroundTasks` or a Redis queue), and send the result back proactively via Twilio's outbound Messages API. This also allows swapping to a local OCR engine (Tesseract, Azure AI Document Intelligence) without any timeout risk.

---

## 7. Security Posture

---

**Q: What security controls are in place today?**

A: The system has layered security controls:

| Layer | Control | Status |
|---|---|---|
| Authentication | JWT (HS256, 60-min expiry) + refresh tokens (7 days) | Live |
| Password storage | bcrypt with 12 rounds | Live |
| Account lockout | 3 failed attempts → 30-minute lockout | Live |
| Role-based access | ADMIN / MANAGER / TELLER / AUDITOR scoping on all API endpoints | Live |
| API signatures | RSA-2048 private key signs every receipt PDF | Live |
| Audit logging | Every teller action written to `audit_logs` with before/after state | Live |
| AML checks | 8 rule-based checks on every completed transaction, fraud_score 0.0–1.0 | Live |
| Transport | TLS at load balancer / hosting layer, internal Docker network is HTTP | Live |
| Secrets management | `.env` file, not committed to Git | Live |
| CORS | Configured in `config.py` with explicit origin whitelist | Live |

---

**Q: What are the known security gaps that must be addressed before production?**

A: Four gaps in priority order:

**Gap 1 — CNIC stored in plain text**
`customers.cnic`, `transactions.customer_cnic`, and `digital_deposit_slips.customer_cnic` store CNICs as plain strings used as join keys. Fix: store a HMAC-SHA256 hash for lookups and encrypt the raw value with `pgcrypto` or application-layer AES. This is the highest-priority data protection item.

**Gap 2 — No nginx-level rate limiting**
Application-level lockout protects the login endpoint but there is no rate limit at the nginx layer. A distributed attacker using many IPs can still hammer the DRID retrieve endpoint. Fix: add `limit_req_zone` to `nginx.conf` on `/api/v1/auth/login` and `/api/v1/deposit-slips`. Two lines of nginx config.

**Gap 3 — Cheque images sent to OpenAI**
Cheque images contain account numbers, MICR codes, and signatures. OpenAI's API data retention policy must be reviewed, a Data Processing Agreement executed, and the bank's data classification policy consulted before enabling this in production. Consider replacing with an on-premise OCR engine.

**Gap 4 — No NADRA VERIS integration**
Walk-in customers enter their own CNIC — there is no system-level verification that the CNIC is genuine. The teller manually checks the physical document. For high-value third-party cash deposits (above PKR 200,000, already flagged by the AML `THIRD_PARTY_HIGH_AMOUNT` rule), NADRA VERIS API verification should be a hard requirement before the DRID is created.

---

**Q: Is the teller portal protected from one teller accessing another teller's transactions?**

A: Yes. The role-based filter in `ReportService._apply_role_filter()` enforces this at the data layer — TELLER role queries are scoped to `Transaction.processed_by == current_user.id`. A teller cannot retrieve, verify, or complete a DRID that was created for a different branch — the DRID retrieve endpoint checks `slip.branch_id` against the teller's `branch_id`. ADMIN and MANAGER roles have cross-branch visibility as expected. This scoping applies uniformly across all API endpoints via the `require_manager_or_above` and `get_current_active_user` middleware dependencies.

---

**Q: What happens if a teller's JWT token is stolen?**

A: The attacker would have access for up to 60 minutes (the JWT expiry). They could retrieve and complete deposit slips assigned to that teller's branch. Every action is written to `audit_logs` with the teller's user ID, so forensic analysis is possible. The token cannot be revoked mid-expiry today — this is a gap. Fix: store active session tokens in Redis with a TTL equal to the JWT expiry, and on logout delete the Redis key. Then a logout or admin-triggered revocation invalidates the token immediately. Session tracking infrastructure (the `sessions` table and Redis) already exists in the stack.

---

*Last updated: March 2026*
*Maintained by: Engineering Team — Precision Receipt System*
