# BRD v1.2 vs System Implementation — Gap Analysis

**Date:** 2026-03-12
**BRD:** Business Requirement Document v1.2 — Slip-less Digital Deposit Framework
**System:** Precision Receipt System (precision-receipt-complete/)

---

## 1. TRANSACTION TYPES (BRD requires 11)

| # | Category | Transaction Type | Status | Notes |
|---|----------|-----------------|--------|-------|
| 1 | Cash | Cash Deposit – Own Account | ✅ YES | `CASH_DEPOSIT` enum, full flow |
| 2 | Cash | Cash Deposit – Third Party (Walk-in) | ✅ YES | Via depositor fields (name/CNIC/phone/relationship) |
| 3 | Cash | Cash Deposit – Business/Merchant | ✅ YES | BUSINESS depositor type with registration/tax fields |
| 4 | Instrument | Cheque Deposit (own bank) | ✅ YES | `CHEQUE_DEPOSIT` with cheque fields |
| 5 | Instrument | Other Bank Cheque Deposit | ✅ YES | Handled under CHEQUE_DEPOSIT with bank selection (12+ banks) |
| 6 | Instrument | Pay Order / Demand Draft | ✅ YES | `PAY_ORDER` with payee fields |
| 7 | Internal | Own Account Transfer (Self) | ❌ NO | Not in TransactionType enum |
| 8 | Internal | Loan / Financing Instalment | ❌ NO | Not in TransactionType enum |
| 9 | Bills/Cards | Credit Card Payment | ⚠️ PARTIAL | Generic `BILL_PAYMENT` with type=CARD, not dedicated |
| 10 | Govt/Utility | Utility / Govt / Tax Payments | ⚠️ PARTIAL | Generic `BILL_PAYMENT` with subtypes (ELECTRICITY, GAS, etc.) |
| 11 | Special | Charity / Zakat / Special Collections | ❌ NO | Not in TransactionType enum |

**Score: 6 of 11 (3 missing, 2 partial)**

> Phase 1 scope per BRD: Cash Deposit, Cheque Deposit, Pay Order, Bill Payment — all 4 are present.
> Missing types are Phase 2/3 items.

---

## 2. CUSTOMER CHANNELS (BRD requires 6)

| # | Channel | Target | Status | Notes |
|---|---------|--------|--------|-------|
| 1 | Meezan Mobile App | Smartphone customers | ❌ NO | Only a browser-based mockup (`MobileDemo.tsx`), no native app |
| 2 | WhatsApp Banking | WhatsApp-active customers | ⚠️ PARTIAL | Full flow works via Twilio sandbox, NOT Meta-approved BSP with Meezan branding |
| 3 | Web Portal / In-Branch Portal | All customers, walk-ins | ✅ YES | `CustomerDeposit.tsx` at `/deposit`, publicly accessible, responsive |
| 4 | Branch Kiosk / Smart Tablet | Branch walk-ins | ❌ NO | Not built — no touch-optimized UI, no receipt printer, no Urdu |
| 5 | SMS Banking | Non-smartphone users | ⚠️ PARTIAL | SMS flow via Twilio works, but no PTA short code, no USSD protocol |
| 6 | Q-Matic | Queue management | ❌ NO | Phase 4 item, not built |

**Score: 1 fully implemented, 2 partial, 3 missing**

---

## 3. FUNCTIONAL REQUIREMENTS — Digital Deposit Engine (Core)

| Req ID | Requirement | Status | Gap Details |
|--------|-------------|--------|-------------|
| FR-001 | DRID format: `MZ-YYYY-XXXXXXXX` | ❌ NO | Current format is `DRID-YYYYMMDD-XXXXXX` (wrong prefix, 6-char suffix instead of 8) |
| FR-002 | 60-minute DRID expiry | ✅ YES | `DEFAULT_VALIDITY_MINUTES = 60`, expiry checked on retrieval |
| FR-003 | QR code generated with each DRID | ✅ YES | QR service generates base64 PNG, stored in DB |
| FR-004 | Support all 11 transaction types | ⚠️ PARTIAL | 6 of 11 (Phase 1 types covered) |
| FR-005 | Complete data capture | ✅ YES | All fields: DRID, account, name, CNIC, amount, type, channel, depositor, timestamps, branch |
| FR-006 | Cheque fields (number, date, bank, payee, amount in words, image scan) | ⚠️ PARTIAL | Has number/date/bank/branch. **Missing: amount in words, cheque image scan** |
| FR-007 | Account validation (format + live CBS) | ⚠️ PARTIAL | Local DB check only. **No live T24/CBS account validation** |
| FR-008 | 3 depositor types (Self, Third Party, Business/Merchant) | ✅ YES | All 3 with full fields including relationship, registration, tax ID |
| FR-009 | Complete immutable audit log per DRID | ⚠️ PARTIAL | Timestamps tracked on DRID entity (created, retrieved, verified, completed). **Not separate immutable AuditLog entries per event** |

---

## 4. FUNCTIONAL REQUIREMENTS — Customer Portal (Web / Kiosk)

| Req ID | Requirement | Status | Gap Details |
|--------|-------------|--------|-------------|
| FR-011 | Public portal, no login required | ✅ YES | `/deposit` route has no auth wrapper |
| FR-012 | Responsive design (mobile/tablet/desktop) | ✅ YES | Tailwind responsive breakpoints throughout |
| FR-013 | Real-time countdown timer | ❌ NO | Shows static "Valid for 60 minutes" text, **no live JavaScript countdown** |
| FR-014 | Download/print DRID page as PDF | ⚠️ PARTIAL | `window.print()` button exists. **No PDF generation library (jsPDF/html2pdf)** |
| FR-015 | English AND Urdu language support | ❌ NO | English only, **no i18n/localization, no Urdu translations** |
| FR-016 | Kiosk receipt printing | ❌ NO | Kiosk not built |
| FR-017 | QR code poster for branch access | ❌ NO | System QR is DRID verification QR, **not branch portal access QR** |

---

## 5. FUNCTIONAL REQUIREMENTS — WhatsApp Banking

| Req ID | Requirement | Status | Gap Details |
|--------|-------------|--------|-------------|
| FR-018 | DDS flow as WhatsApp menu option | ✅ YES | "Digital Deposit Slip" in Branch Services menu |
| FR-019 | Both registered customers and walk-ins | ✅ YES | Menu: Meezan Customer / Walk-in Individual / Business Merchant |
| FR-020 | DRID + QR code image via WhatsApp | ✅ YES | QR generated and sent as media attachment |
| FR-021 | Post-transaction receipt via WhatsApp | ✅ YES | `/whatsapp/notify/transaction-complete` endpoint |
| — | Meta-approved BSP branding | ❌ NO | Using Twilio sandbox, not Meezan Bank verified sender |

---

## 6. FUNCTIONAL REQUIREMENTS — SMS Banking

| Req ID | Requirement | Status | Gap Details |
|--------|-------------|--------|-------------|
| FR-023 | SMS short code, all Pakistani telecoms | ❌ NO | Uses standard Twilio SMS, **no PTA-registered short code** |
| FR-024 | Keyword "DEPOSIT" trigger flow | ⚠️ PARTIAL | Uses "HI" trigger instead of "DEPOSIT" |
| FR-025 | DRID delivered via SMS reply | ✅ YES | DRID sent in SMS response |
| FR-026 | No internet/smartphone required | ❌ NO | **USSD protocol not implemented** (different from SMS, requires SMPP gateway) |
| FR-027 | Both registered and walk-in support | ✅ YES | Same flow as WhatsApp (customer type selection) |

---

## 7. FUNCTIONAL REQUIREMENTS — Teller Portal

| Req ID | Requirement | Status | Gap Details |
|--------|-------------|--------|-------------|
| FR-028 | DRID lookup: manual entry + QR scan | ✅ YES | Both methods in DRIDLookupModal |
| FR-029 | Quick Scan auto-populate | ✅ YES | QR parsed → auto-retrieve → details displayed |
| FR-030 | Display: time remaining, amount, customer, depositor, cheque image | ✅ YES | All fields displayed including cheque details |
| FR-031 | Mandatory verification checklist (3 items) | ✅ YES | Amount, CNIC, instrument checks — all must be checked to proceed |
| FR-032 | OTP dispatch (configurable) | ⚠️ PARTIAL | OTP service built but **disabled in UI** ("OTP Verification (Optional - Disabled)") |
| FR-033 | Customer authorization checkbox | ✅ YES | Mandatory checkbox before "Complete Transaction" |
| FR-034 | TXN ref + RCP number, "Completed!" display, Next/Receipt buttons | ✅ YES | All shown on success step |
| FR-035 | "New Transaction" button (without DRID) | ❌ NO | **Teller cannot create deposits directly**, only lookup existing DRIDs |
| FR-036 | Ctrl+N shortcut for next customer | ✅ YES | Works in Quick Scan Mode |
| FR-037 | "Deposited/Paid" marking per type | ⚠️ PARTIAL | Shows generic "COMPLETED", **not type-specific "Deposited" or "Paid"** |

---

## 8. FUNCTIONAL REQUIREMENTS — Admin Dashboard

| Req ID | Requirement | Status | Gap Details |
|--------|-------------|--------|-------------|
| FR-037 | Real-time metrics (total, amount, completed, success rate) | ✅ YES | All 4 stat cards on Dashboard |
| FR-038 | Recent Transactions table (all columns + actions) | ✅ YES | Reference, DRID, Customer, Type, Amount, Status, Date, View/Receipt |
| FR-039 | Search by reference, name, CNIC | ✅ YES | Debounced search with all 3 fields |
| FR-040 | Reports with date-range, PDF + Excel/CSV export | ⚠️ PARTIAL | Date-range filters + CSV export exist. **No PDF export, no Excel export** |
| FR-041 | Users module (create/activate/deactivate/role assignment) | ✅ YES | Full CRUD with role selection |
| FR-042 | Branches module (configure codes, assign tellers) | ⚠️ PARTIAL | Branch CRUD exists. **Teller-to-branch assignment not in UI** |
| FR-043 | RBAC (tellers blocked from admin, admins from transactions) | ✅ YES | Role-based route restrictions enforced |

---

## 9. RECEIPT DELIVERY (BRD requires 4 channels)

| Channel | Status | Gap Details |
|---------|--------|-------------|
| WhatsApp receipt + QR (within 30s) | ⚠️ PARTIAL | Works via Twilio sandbox. **Not Meezan-branded, 30s SLA not enforced** |
| SMS receipt + short URL (within 60s) | ⚠️ PARTIAL | SMS sent. **No short URL, no PTA sender ID, 60s SLA not enforced** |
| Online Portal receipt (secure link, PDF, verify, share) | ⚠️ PARTIAL | Public receipt page exists. **PDF download not confirmed, time-limited link missing** |
| Branch Kiosk receipt (by CNIC/TXN, printable) | ❌ NO | **Kiosk not built** |

---

## 10. NON-FUNCTIONAL REQUIREMENTS

| Req ID | Requirement | Status | Gap Details |
|--------|-------------|--------|-------------|
| NFR-001 | 99.9% uptime during banking hours | ❓ N/A | Operational metric, cannot verify from code |
| NFR-002 | DRID generation < 2 seconds | ❓ N/A | No performance benchmarks in code |
| NFR-003 | Teller lookup < 1.5 seconds | ❓ N/A | No performance benchmarks in code |
| NFR-004 | WhatsApp receipt < 30s, SMS < 60s | ⚠️ PARTIAL | No SLA enforcement mechanism |
| NFR-005 | Nationwide concurrent teller support | ⚠️ PARTIAL | DB pool size=20, max_overflow=0 — **may be insufficient** |
| NFR-006 | TLS 1.3 + AES-256 encryption at rest | ⚠️ PARTIAL | TLS at hosting layer. **AES-256 at rest: NO — data stored in plaintext** |
| NFR-007 | RBAC + 15-min inactivity timeout | ⚠️ PARTIAL | RBAC: YES. **Session timeout: 60-min JWT, no inactivity detection** |
| NFR-008 | CNIC masked in display, encrypted in storage | ⚠️ PARTIAL | Partial masking in some UIs. **CNIC stored as plaintext in PostgreSQL** |
| NFR-009 | Audit logs retained 7 years, tamper-proof | ⚠️ PARTIAL | Audit logs created. **No retention policy, no archival, logs are deletable** |
| NFR-010 | On-premises, no cloud dependency | ❌ NO | **External deps: OpenAI (cheque OCR), Twilio (WhatsApp/SMS)** |

---

## 11. CBS INTEGRATION

| Scenario | Status | Gap Details |
|----------|--------|-------------|
| Scenario 1: Manual T24 entry | ⚠️ PARTIAL | Chrome extension built to auto-fill T24 fields. **Requires T24 field mapping config, uses Twilio sandbox** |
| Scenario 2: Automated ESB-to-T24 | ❌ NO | **Not implemented — no `t24_service.py`, no ESB integration, all T24 fields null** |

---

## OVERALL SCORECARD

| Category | Total Reqs | ✅ YES | ⚠️ PARTIAL | ❌ NO | Coverage |
|----------|-----------|--------|-----------|-------|----------|
| Transaction Types (11) | 11 | 6 | 2 | 3 | 55% |
| Channels (6) | 6 | 1 | 2 | 3 | 17% |
| Digital Deposit Engine (FR-001–009) | 9 | 4 | 4 | 1 | 44% |
| Customer Portal (FR-011–017) | 7 | 2 | 1 | 4 | 29% |
| WhatsApp (FR-018–021) | 4 | 4 | 0 | 0 | 100% |
| SMS Banking (FR-023–027) | 5 | 2 | 1 | 2 | 40% |
| Teller Portal (FR-028–037) | 10 | 6 | 2 | 2 | 60% |
| Admin Dashboard (FR-037–043) | 7 | 5 | 2 | 0 | 71% |
| Receipt Delivery (4 channels) | 4 | 0 | 3 | 1 | 0% |
| Non-Functional (NFR-001–010) | 10 | 0 | 7 | 1 | 0% |
| CBS Integration (2 scenarios) | 2 | 0 | 1 | 1 | 0% |
| **TOTAL** | **75** | **30** | **25** | **18** | **40%** |

---

## PHASE 1 GO-LIVE BLOCKERS (Must Have items that are ❌ NO)

These are **Must Have** requirements from BRD that are completely missing:

1. **FR-001**: DRID format must be `MZ-YYYY-XXXXXXXX` (currently `DRID-YYYYMMDD-XXXXXX`)
2. **FR-013**: Real-time countdown timer on portal
3. **FR-015**: Urdu language support
4. **FR-017**: Branch QR code posters for portal access
5. **FR-035**: Teller "New Transaction" without pre-generated DRID
6. **NFR-008**: CNIC encryption at rest (currently plaintext)
7. **NFR-010**: On-premises deployment (external cloud deps: OpenAI, Twilio)

## PHASE 1 HIGH-PRIORITY GAPS (Must Have items that are ⚠️ PARTIAL)

8. **FR-006**: Cheque image scan at teller + amount in words
9. **FR-007**: Live CBS/T24 account validation (currently local DB only)
10. **FR-009**: Immutable per-event audit log (currently timestamps on entity)
11. **FR-032**: OTP dispatch currently disabled in UI
12. **NFR-006**: AES-256 encryption at rest not implemented
13. **NFR-007**: 15-minute inactivity session timeout (currently 60-min JWT)
14. **NFR-009**: 7-year audit retention + tamper-proof logs
15. **FR-040**: PDF and Excel report export (only CSV exists)
