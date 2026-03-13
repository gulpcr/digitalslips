# PRECISION RECEIPT SYSTEM — FULL AUDIT REPORT

**Date:** 2026-03-12
**Scope:** Backend, Frontend, Chrome Extension, Infrastructure, Build Configuration

---

## CRITICAL (Immediate Action Required)

| # | Area | Issue | File(s) |
|---|------|-------|---------|
| 1 | **Security** | CORS allows `*` origins — any website can make authenticated API requests | `backend/app/main.py:80-86`, `whatsapp_server.py:46` |
| 2 | **Security** | Real credentials exposed in `.env` — Twilio keys, SMTP passwords, DB password, OpenAI key, ngrok URL | `.env:12-86` |
| 3 | **Security** | `DEBUG=True` default exposes stack traces | `backend/app/core/config.py:21` |
| 4 | **Security** | JWT_SECRET has no default — empty/short value allows token forgery | `backend/app/core/config.py:35` |
| 5 | **Security** | DB credentials hardcoded in docker-compose.yml (`precision123`) | `docker-compose.yml:11-13` |
| 6 | **Auth** | `/initiate` deposit slip endpoint has **no authentication** — anyone can create deposit slips | `backend/app/api/v1/deposit_slips.py:85-146` |
| 7 | **Auth** | Logout doesn't invalidate JWT tokens — stolen tokens stay valid forever | `backend/app/api/v1/auth.py:71-84` |
| 8 | **Auth** | Frontend stores tokens in `localStorage` (XSS-vulnerable), no token refresh implemented | `frontend/src/store/authStore.ts:35`, `api.ts:40-53` |
| 9 | **Banking** | No double-spend prevention — same DRID can be used for multiple deposits, no account locking | `drid_service.py` |
| 10 | **Data** | Silent `except: pass` on DRID creation failure — orphaned transactions, no logging | `transactions.py:311`, `drid_service.py:454` |
| 11 | **Extension** | No message validation in background.js — any tab can send `COMPLETE_SLIP`, `FILL_TRANSACT` messages | `chrome-extension/background.js:143-396` |
| 12 | **Frontend** | Race condition: CNIC lookup fires multiple times on rapid typing, stale results overwrite newer | `NewTransactionModal.tsx:135-159` |
| 13 | **Frontend** | Dashboard stats calculated from current page only (10 items), not actual totals — metrics are wrong | `Dashboard.tsx:67-75` |

---

## HIGH

| # | Area | Issue | File(s) |
|---|------|-------|---------|
| 14 | **Race Condition** | DRID uniqueness check-then-insert is not atomic — concurrent requests can get same DRID | `drid_service.py:99-104` |
| 15 | **Banking** | `float(transaction.amount)` causes precision loss in financial calculations | `transactions.py:297` |
| 16 | **Banking** | Account balance/status not verified before deposit completion | `drid_service.py:319-423` |
| 17 | **Banking** | No duplicate transaction prevention — no idempotency key on create | `transactions.py:202-325` |
| 18 | **AML** | Daily/monthly AML limits only check completed transactions — pending ones bypass limits | `aml_service.py:156-197` |
| 19 | **AML** | CTR threshold hardcoded at PKR 250K, only checks CASH_DEPOSIT — cheques bypass | `aml_service.py:103-113` |
| 20 | **Performance** | N+1 query: `transaction_to_response()` queries DigitalDepositSlip per row in list | `transactions.py:30-66, 121` |
| 21 | **Performance** | N+1 query: `slip_to_response()` queries Branch per deposit slip in list | `deposit_slips.py:32-78, 625` |
| 22 | **Performance** | `/pending` endpoint returns ALL pending slips — no pagination, unbounded query | `deposit_slips.py:607-626` |
| 23 | **Routing** | `/pending` route shadowed by `/{drid}` param route — defined after it | `deposit_slips.py:607 vs 629` |
| 24 | **Security** | No rate limiting on public endpoints (receipt verify, DRID initiate) | `deposit_slips.py:85`, `receipts.py:150-203` |
| 25 | **Security** | Nginx missing security headers (X-Frame-Options, CSP, HSTS, X-Content-Type-Options) | `frontend/nginx.conf` |
| 26 | **Security** | No network isolation in Docker — all services on same network, DB accessible from frontend | `docker-compose.yml:152-154` |
| 27 | **Security** | `python-jose==3.3.0` is unmaintained (last release 2021), potential JWT vulnerabilities | `requirements.txt` |
| 28 | **Security** | Sourcemaps enabled in production build — exposes full source code | `vite.config.ts:38` |
| 29 | **Frontend** | `ReceiptModal` silently swallows QR/receipt load errors — user sees empty modal | `ReceiptModal.tsx:61-66` |
| 30 | **Frontend** | `console.log` exposes auth token presence in production | `depositSlip.service.ts:165` |
| 31 | **Infra** | No backend healthcheck in docker-compose — frontend starts before backend is ready | `docker-compose.yml:51-82` |
| 32 | **Infra** | DB port mismatch between compose (5434) and .env (5433) | `docker-compose.yml:16` vs `.env:14-16` |
| 33 | **Config** | Default DB password `precision123` hardcoded in config | `config.py:25-29` |

---

## MEDIUM

| # | Area | Issue | File(s) |
|---|------|-------|---------|
| 34 | **Banking** | Transaction creation not atomic — receipt, AML check, DRID are separate commits | `drid_service.py:356-422` |
| 35 | **Banking** | Receipt created even when signature service fails — unsigned receipts issued | `receipt_service.py:103-106` |
| 36 | **Banking** | No transaction reversal/chargeback mechanism | `models/__init__.py:285-342` |
| 37 | **Banking** | `t24_transaction_id` stored but never verified as actually posted to core banking | `models/__init__.py:317-320` |
| 38 | **Validation** | Enum `KeyError` if invalid status/type passed as query param — crashes instead of 400 | `transactions.py:87-90` |
| 39 | **Validation** | `additional_data: Dict[str, Any]` accepts arbitrary JSON — no schema validation | `schemas/deposit_slip.py:30`, `transaction.py:30` |
| 40 | **Validation** | No phone format validation before OTP send | `deposit_slips.py:316-340` |
| 41 | **Performance** | Report service loads all transactions into memory to extract IDs | `report_service.py:90-95` |
| 42 | **Performance** | Missing composite DB indexes for (status+created_at), (customer_id+created_at) | `models/__init__.py` |
| 43 | **DB** | `DB_MAX_OVERFLOW=0` — system fails if >20 concurrent connections needed | `config.py:30-31` |
| 44 | **DB** | `get_db()` doesn't rollback uncommitted transactions before close | `database.py:38-42` |
| 45 | **Race Condition** | DRID expiration check has TOCTOU gap — concurrent request can use expired slip | `drid_service.py:289-294` |
| 46 | **Frontend** | DRIDLookupModal: `time_remaining_seconds` shown but never counts down | `DRIDLookupModal.tsx:504-509` |
| 47 | **Frontend** | Form data persists across transaction type changes — old fields not cleared | `NewTransactionModal.tsx` |
| 48 | **Frontend** | Auth store: `expires_in` from login response never stored — can't proactively refresh | `authStore.ts` |
| 49 | **Frontend** | Input fields missing maxLength (CNIC accepts unlimited chars) | `NewTransactionModal.tsx:678, 790, 952` |
| 50 | **Frontend** | No confirmation dialog when closing form modal with data entered | `NewTransactionModal.tsx:393-396` |
| 51 | **Extension** | Hardcoded ports in manifest/background.js — breaks if deployment ports change | `manifest.json:13-18`, `background.js:451-456` |
| 52 | **Extension** | Audit log capped at 1000 entries with no archival | `background.js:55` |
| 53 | **Extension** | Field mappings duplicated in background.js and options.js | `background.js:466-521`, `options.js:360-383` |
| 54 | **Infra** | No gzip in nginx, no rate limiting | `nginx.conf` |
| 55 | **Infra** | No resource limits (CPU/memory) on any Docker service | `docker-compose.yml` |
| 56 | **Infra** | No .dockerignore — `COPY . .` includes .env, __pycache__, .git | Backend Dockerfile |
| 57 | **Build** | Dev dependencies (pytest, black, mypy) in production requirements.txt | `requirements.txt:38-48` |

---

## LOW

| # | Area | Issue | File(s) |
|---|------|-------|---------|
| 58 | **Code** | `datetime.utcnow()` returns naive datetime — should use `datetime.now(timezone.utc)` | Multiple backend files |
| 59 | **Code** | Magic number `str(uuid.uuid4())[:6]` for DRID part length | `drid_service.py:38` |
| 60 | **Code** | Failed login lockout threshold hardcoded at 5 | `auth_service.py:59` |
| 61 | **Code** | Health endpoint only checks app, not DB/Redis/SMS connectivity | `main.py:184-194` |
| 62 | **Code** | Customer CNIC stored in plaintext — no encryption at rest | `models/__init__.py:223-248` |
| 63 | **Code** | Missing audit logs for user permission changes | `users.py:166-214` |
| 64 | **Code** | Logging includes PII (phone, email) in plaintext | `deposit_slips.py:429` |
| 65 | **Code** | Frontend deps use `^` (caret) versions — non-deterministic builds | `package.json:14-26` |
| 66 | **Code** | No `TransactionType.WITHDRAWAL` or `REVERSAL` enum value | `models/__init__.py:64-69` |

---

## Summary

| Severity | Count |
|----------|-------|
| **CRITICAL** | 13 |
| **HIGH** | 20 |
| **MEDIUM** | 24 |
| **LOW** | 9 |
| **Total** | **66** |

## Top 5 Priority Areas

1. **Security**: CORS wildcard, exposed credentials, missing auth on endpoints
2. **Banking Integrity**: No double-spend prevention, float amounts, missing AML checks
3. **Authentication**: Token storage in localStorage, no refresh, no logout invalidation
4. **Performance**: N+1 queries on every list endpoint, unbounded queries
5. **Infrastructure**: Missing security headers, no network isolation, no resource limits
