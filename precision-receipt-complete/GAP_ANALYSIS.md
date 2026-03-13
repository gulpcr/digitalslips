# Gap Analysis — BRD v2.0 vs Precision Receipt System
**Meezan Bank Digital Deposit Slip Framework**
*March 2026 · Confidential*

---

## How to Read This Document

| Symbol | Meaning |
|---|---|
| ✅ | Fully implemented — matches BRD |
| ⚠️ | Partially implemented — gap exists |
| ❌ | Not implemented — missing from system |
| ➕ | In system but NOT in BRD |

---

## Part 1 — In BRD, NOT (or partially) in System

### 1.1 Transaction Types

BRD Section 5 defines **11 transaction types**. The system implements **5**.

| # | BRD Transaction Type | BRD Phase | System Status | Gap Detail |
|---|---|---|---|---|
| 1 | Cash Deposit — Own Account | Phase 1 | ✅ CASH_DEPOSIT | Fully implemented |
| 2 | Cash Deposit — Third Party (Walk-in) | Phase 2 | ⚠️ Partial | Walk-in CNIC capture exists; merchant profiling absent; no enhanced AML workflow at teller UI |
| 3 | Cash Deposit — Business/Merchant | Phase 2 | ⚠️ Partial | Business flow in WhatsApp/SMS captures name/registration/tax ID; no `merchant_code` field; no velocity aggregation per merchant |
| 4 | Cheque Deposit | Phase 1 | ✅ CHEQUE_DEPOSIT | Fully implemented including OCR |
| 5 | **Intercity Cheque Deposit** | Phase 1 | ❌ Missing | BRD requires duplicate detection and clearing cut-off control as a separate type. System has one CHEQUE_DEPOSIT — no `clearing_type: INTERCITY` distinction |
| 6 | Pay Order / Demand Draft | Phase 1 | ✅ PAY_ORDER | Implemented |
| 7 | **Own Account Transfer (Self)** | Phase 3 | ❌ Missing | FUND_TRANSFER exists but not split into self-transfer vs third-party transfer. BRD treats self-transfer as low-risk with STP |
| 8 | **Loan / Financing Instalment** | Phase 3 | ❌ Missing | Not in TransactionType enum; BRD requires auto-posting and reconciliation controls |
| 9 | **Credit Card Payment** | Phase 2 | ❌ Missing | Not in system at all; BRD requires duplicate payment prevention |
| 10 | Utility / Govt / Tax Payments | Phase 2 | ⚠️ Partial | BILL_PAYMENT exists; no reference number validation against FBR/NADRA/utility APIs |
| 11 | **Charity / Zakat / Special Collections** | Phase 2 | ❌ Missing | Not in system; BRD requires cause code validation and specific narration rules |

**Summary: 5 of 11 transaction types fully implemented. 4 missing entirely. 2 partial.**

---

### 1.2 Customer Channels

BRD Section 6 defines **5 channels**. System implements **3** (WhatsApp, SMS, Web).

| Channel | BRD Phase | System Status | Gap Detail |
|---|---|---|---|
| **Meezan Mobile App** | Phase 3 | ❌ Not built | BRD says app team integrates using vendor REST API. API exists. `MobileDemo.tsx` is a UI mockup only — no authenticated app session, no account pre-selection from CBS |
| WhatsApp Banking | Phase 2 | ⚠️ Partial | Flow works. WhatsApp sender is Twilio sandbox number, not verified 'Meezan Bank' BSP number (FR-022). BRD menu shows "1-Account Services, 2-Card Services, 3-Branch Services, 4-Complaints" — system menu differs |
| Web Portal | Phase 1 | ✅ Live | Portal exists; publicly accessible |
| **Branch Kiosk / Smart Tablet** | Phase 2 | ❌ Not built | Touch-optimised full-screen mode not built; kiosk receipt printer integration not built; English/Urdu toggle not built; DRID re-generation at kiosk not built |
| **USSD (*321#)** | Phase 2 | ❌ Not built | System has Twilio SMS but USSD (*321#) is a completely different protocol (SMPP/USSD Gateway via telecom operators). 6-digit Ref ID format, no-internet operation, PTA registration — none of this exists |

---

### 1.3 Functional Requirements — Teller Portal

| FR | BRD Requirement | System Status | Gap |
|---|---|---|---|
| FR-013 | Real-time countdown timer on DRID page | ⚠️ | Expiry stored in DB; no visible live countdown in teller UI |
| FR-014 | Customer can download/print DRID confirmation as PDF | ❌ | No PDF export of DRID confirmation slip; customer sees on-screen only |
| FR-015 | Kiosk: English and Urdu language toggle | ❌ | No Urdu support anywhere in system |
| FR-016 | Kiosk receipt printer support | ❌ | Kiosk not built |
| FR-017 | Branch QR code poster → loads portal on customer phone via branch Wi-Fi | ❌ | No branch-specific QR posters generated; system QR is DRID QR, not branch access QR |
| FR-032 | OTP dispatch to customer before completion (configurable) | ⚠️ | `otp_service.py` exists; OTP is generated; wiring into DRID complete flow is incomplete — teller UI has authorisation checkbox but no OTP input field |
| FR-035 | Teller 'New Transaction' button — initiate without pre-generated DRID | ❌ | Teller can only look up existing DRIDs; cannot create a new DRID directly from teller portal on behalf of a counter customer |
| FR-036 | Ctrl+N keyboard shortcut to advance to next customer | ❌ | No keyboard shortcuts implemented |

---

### 1.4 Functional Requirements — DRID Format

| Aspect | BRD Spec | System Implementation | Gap |
|---|---|---|---|
| DRID prefix | `MZ-` (e.g., MZ-2026-00012345 or MZ-2603001234) | `DRID-` (e.g., DRID-20260305-AB12CD) | ❌ Prefix mismatch — bank branding not applied |
| DRID suffix | Sequential numeric component in BRD examples | Random UUID 6-char alphanumeric | ⚠️ Different format; BRD implies sequential for readability |

---

### 1.5 Functional Requirements — Admin & Reporting

| FR | BRD Requirement | System Status | Gap |
|---|---|---|---|
| FR-040 | Reports exportable in **PDF and Excel/CSV** | ⚠️ | CSV export exists; PDF report export not implemented; Excel not implemented |
| FR-034 | RCP receipt number (format RCP-YYYYMMDD-XXXXXXXX) | ⚠️ | `Receipt` model exists with `receipt_number`; format is not explicitly `RCP-` prefixed |

---

### 1.6 Non-Functional Requirements

| NFR | BRD Requirement | System Status | Gap |
|---|---|---|---|
| NFR-001 | 99.9% uptime during banking hours; 99.5% off-hours | ❌ | Single Docker Compose host; no HA, no load balancer, no health-check failover |
| NFR-005 | Support concurrent usage by all nationwide branch tellers | ❌ | Not load-tested; in-memory sessions block horizontal scaling; DB pool of 20 connections |
| NFR-006 | TLS 1.3 in transit; **AES-256 encryption at rest** for PII | ⚠️ | TLS at hosting layer ✅; AES-256 at rest ❌ — CNIC and PII stored in plain text in PostgreSQL |
| NFR-007 | Session timeout after **15 minutes of inactivity** | ❌ | JWT access token is 60 minutes; no inactivity-based session timeout |
| NFR-008 | CNIC masked in display (42201-XXXXX30-9); stored encrypted | ❌ | CNIC stored as plain text; masking is partial in UI; no encryption |
| NFR-009 | Audit logs retained **7 years**; tamper-proof | ❌ | No retention policy or archival job; logs accumulate indefinitely but can be deleted |
| NFR-010 | **On-premises deployment; no external cloud dependency** | ❌ | System calls OpenAI (cheque OCR) and Twilio (WhatsApp/SMS) — both external cloud; BRD mandates air-gapped capability |
| NFR-011 | RTO 4 hours; RPO 1 hour | ❌ | No DR plan; no backup strategy; no documented recovery runbook |
| NFR-012 | SBP, AML/CFT, PTA compliance | ⚠️ | AML checks built; CTR threshold configured; STR filing not built; PTA SMS sender ID and USSD not registered |

---

### 1.7 Integration Requirements

| System | BRD Requirement | Status | Gap |
|---|---|---|---|
| **Temenos T24** | Account validation + transaction posting via REST API / ISO 8583 | ❌ | `t24_transaction_id` fields exist in DB; `T24_ENABLED` flag in config; no `t24_service.py` built; all T24 fields null at runtime |
| **ESB (Enterprise Service Bus)** | REST/SOAP transaction routing to T24 (Scenario 2 STP) | ❌ | Not built; required for Phase 3 STP |
| **WhatsApp Business API via approved BSP** | Meezan-branded sender; Meta-approved BSP | ❌ | Using Twilio sandbox; not a Meta-approved BSP with bank's own WABA |
| **SMS/USSD Gateway (SMPP + USSD protocol)** | OTP, receipt SMS, USSD *321# | ⚠️ | SMS via Twilio HTTP API; USSD via SMPP/USSD Gateway not built; PTA-registered alphanumeric sender ID not configured |
| **Active Directory / LDAP** | SSO for teller and admin authentication | ❌ | System uses its own username/password credential store; no LDAP/AD integration |
| **Document Archive / DMS** | 7-year archival of digital records and receipts | ❌ | No DMS integration; receipts stored only in PostgreSQL volume |
| **NADRA VERIS** | CNIC verification for walk-in customers | ❌ | CNIC accepted as typed; no NADRA verification |
| **Branch Kiosk Hardware** | Touch-screen terminal, receipt printer driver | ❌ | No kiosk software built |
| **Q-Matic (Queue Management)** | Post-go-live: DRID → queue ticket (Phase 4) | ❌ | Not built (Phase 4 item) |

---

### 1.8 Receipt Delivery

| Channel | BRD Requirement | Status | Gap |
|---|---|---|---|
| WhatsApp | Formatted receipt + QR code; sender 'Meezan Bank'; within 30 sec | ⚠️ | Receipt sent ✅; QR code sent ✅; sender is Twilio sandbox not Meezan Bank ❌ |
| SMS | TXN reference, amount, date/time, short URL to full receipt; alphanumeric sender ID; within 60 sec | ⚠️ | Basic SMS receipt sent ✅; no short URL to portal receipt ❌; PTA alphanumeric sender ID not configured ❌ |
| Online Portal | Secure time-limited link; PDF download; QR verification; share options | ⚠️ | Receipt viewable ✅; PDF download ⚠️ (receipt PDF exists but portal access via secure link unclear); share button ❌ |
| Branch Kiosk | Receipt retrieval by CNIC or TXN; printer output | ❌ | Kiosk not built |

---

## Part 2 — In System, NOT in BRD

These are capabilities built into the Precision Receipt system that are not mentioned or required by the BRD. They represent additional value or design decisions that should be reviewed for alignment.

| # | Feature in System | BRD Mention | Comment |
|---|---|---|---|
| 1 | **RSA-2048 digital signature on every receipt** | Not mentioned | System signs receipts with RSA private key. BRD only mentions QR code for verification. This exceeds BRD requirements — confirm bank wants this. |
| 2 | **OpenAI GPT-4o cheque OCR via customer WhatsApp** | Not mentioned | BRD FR-006 says cheque image capture at teller counter. System allows customer to photograph and send cheque via WhatsApp — much earlier in the flow. BRD also does not approve sending cheque images to an external cloud service. |
| 3 | **AUDITOR role** | BRD defines Teller / Manager / Admin only | System has a 4th role: AUDITOR (read-only, cross-branch visibility). BRD has no Auditor role. Should be added to BRD or removed. |
| 4 | **Blockchain receipt anchoring** (configured, inactive) | Not mentioned | `RECEIPT_BLOCKCHAIN_ENABLED` flag exists in config. Not required by BRD. Should be removed or documented as a future optional feature. |
| 5 | **AML fraud_score (0.0–1.0 numeric scoring)** | BRD mentions CTR/STR flags but not numeric scoring | System runs 8 rules producing a composite fraud_score. BRD AML layer is described at a conceptual level. Score thresholds and rules should be formally approved by Compliance. |
| 6 | **Redis session cache** | Not mentioned | BRD does not specify caching. Redis is used for WhatsApp/SMS session management. Fine as implementation detail but should be documented in the technical spec. |
| 7 | **MOBILE channel enum** | BRD defines 5 channels; MOBILE is separate from app | System `Channel` enum has MOBILE as a distinct value alongside WHATSAPP, SMS, WEB, USSD, BRANCH. Aligns with BRD but needs to be the authenticated mobile app session, not the demo page. |
| 8 | **Multiple active DRIDs blocked per customer/account** | Not specified in BRD | System blocks a new DRID if an active one exists for the same customer+account. BRD does not mention this restriction. Confirm this is the desired behaviour. |
| 9 | **DRID prefix is `DRID-` not `MZ-`** | BRD shows `MZ-2026-XXXXXXXX` | System generates `DRID-YYYYMMDD-XXXXXX`. Format, prefix, and length differ from BRD. The bank-facing customer-visible DRID should match what is in the BRD. |
| 10 | **JWT expiry is 60 minutes** | BRD NFR-007 says session timeout 15 minutes | System issues 60-minute JWT tokens. BRD requires 15-minute inactivity timeout. System does not enforce inactivity timeout at all. |
| 11 | **`extra_data` JSONB for type-specific fields** | BRD defines a flat Deposit_Transactions table | System uses a single table with JSONB overflow for type-specific fields (cheque number, bill reference, etc.). BRD implies a flatter data model. Both approaches are valid — should be documented for audit/DMS export purposes. |
| 12 | **`AuditLog` with before/after JSONB state** | BRD audit log has specific event types only | System stores full before/after JSONB of any changed entity. BRD only defines: DRID_CREATED, RETRIEVED, OTP_SENT, OTP_VERIFIED, VERIFIED, AUTHORISED, COMPLETED, EXPIRED, AML_FLAGGED. System has more granular logging — this is a superset. |

---

## Part 3 — Summary Scorecard

### By BRD Section

| BRD Section | Coverage | Status |
|---|---|---|
| Transaction Types (11 types) | 5 of 11 fully done | ❌ 6 missing |
| Channels (5 channels) | 3 of 5 done | ❌ USSD and Kiosk missing |
| DRID Engine Core (FR-001–010) | 7 of 10 | ⚠️ Format mismatch, 11-type support missing |
| Web Portal (FR-011–017) | 4 of 7 | ⚠️ No PDF download, no Urdu, no countdown, no branch QR poster |
| WhatsApp Channel (FR-018–022) | 4 of 5 | ⚠️ BSP/branding not live |
| USSD/SMS Channel (FR-023–027) | 0 of 5 | ❌ USSD not built |
| Teller Portal (FR-028–036) | 6 of 9 | ⚠️ OTP partial, no New Transaction button, no shortcuts |
| Admin Dashboard (FR-037–043) | 6 of 7 | ⚠️ PDF/Excel export missing |
| Receipt Delivery (4 channels) | 2 of 4 fully | ⚠️ Kiosk missing, WhatsApp not BSP-branded |
| Non-Functional Requirements | 3 of 12 | ❌ Major gaps in HA, encryption, session timeout, on-prem |
| Integrations (9 systems) | 1 of 9 (WhatsApp partial) | ❌ T24, ESB, LDAP, DMS, NADRA all missing |

---

### Priority Gaps for Phase 1 Go-Live

These gaps **block** Phase 1 acceptance criteria:

| Priority | Gap | BRD Ref |
|---|---|---|
| 🔴 CRITICAL | DRID format must use `MZ-` prefix | FR-001 |
| 🔴 CRITICAL | CNIC must be stored encrypted (AES-256), not plain text | NFR-006, NFR-008 |
| 🔴 CRITICAL | Session inactivity timeout must be 15 minutes | NFR-007 |
| 🔴 CRITICAL | On-prem deployment — OpenAI (external cloud) blocks this | NFR-010 |
| 🔴 CRITICAL | T24 account validation before DRID creation (live CBS lookup) | FR-007 |
| 🟠 HIGH | DRID PDF download for customer (print/save) | FR-014 |
| 🟠 HIGH | OTP flow fully wired into teller completion (input field in UI) | FR-032 |
| 🟠 HIGH | PTA-registered alphanumeric SMS sender ID | Integration |
| 🟠 HIGH | Teller 'New Transaction' button (walk-in without prior DRID) | FR-035 |
| 🟡 MEDIUM | Countdown timer on DRID page | FR-013 |
| 🟡 MEDIUM | PDF and Excel report export | FR-040 |
| 🟡 MEDIUM | Audit log 7-year retention policy and archival | NFR-009 |

### Priority Gaps for Phase 2

| Priority | Gap | BRD Ref |
|---|---|---|
| 🔴 CRITICAL | USSD *321# channel (requires SMPP/USSD gateway + PTA registration) | FR-023–027 |
| 🔴 CRITICAL | WhatsApp via verified Meta BSP (Meezan Bank branded sender) | FR-022 |
| 🔴 CRITICAL | Branch Kiosk — touch UI, printer, English/Urdu | FR-015–016 |
| 🔴 CRITICAL | Third-party and Business/Merchant deposit AML controls at teller UI | FR-008, Section 5 |
| 🟠 HIGH | Credit Card Payment transaction type | Section 5 #9 |
| 🟠 HIGH | Charity/Zakat transaction type | Section 5 #11 |
| 🟠 HIGH | Intercity Cheque Deposit as distinct type | Section 5 #5 |
| 🟠 HIGH | Branch QR poster (branch access QR, not DRID QR) | FR-017 |

### Priority Gaps for Phase 3

| Priority | Gap | BRD Ref |
|---|---|---|
| 🔴 CRITICAL | T24 ESB integration for STP | Section 8.2 Scenario 2 |
| 🔴 CRITICAL | Meezan Mobile App API — authenticated DDS module | Section 6.2 |
| 🔴 CRITICAL | LDAP / Active Directory SSO for teller authentication | Section 13 |
| 🟠 HIGH | Loan / Financing Instalment transaction type | Section 5 #8 |
| 🟠 HIGH | Own Account Transfer (Self) distinct from FUND_TRANSFER | Section 5 #7 |
| 🟠 HIGH | Document Archive / DMS integration for 7-year retention | Section 13 |

---

## Part 4 — Items Needing Compliance / Business Sign-off

These are not code gaps — they require decisions from the bank's business or compliance team:

1. **AML threshold values** — CTR PKR 250,000, monthly PKR 2,000,000, etc. — not formally approved by MLRO.
2. **OpenAI cheque OCR** — BRD does not mention or approve sending cheque images to an external AI service. This must be reviewed under data classification policy before production.
3. **AUDITOR role** — exists in system, not in BRD. Bank needs to decide if this role is required.
4. **Multiple active DRID block** — system blocks duplicate DRIDs per customer+account. BRD silent on this. Confirm desired behaviour.
5. **DRID validity extension** — BRD Section 15.2 states 60-minute window is fixed and not configurable. System has `validity_minutes` as a configurable field. Remove configurability or align BRD.
6. **STR filing process** — BRD says STR flags are generated; no workflow for filing with FMU goAML is defined in BRD. Compliance team must define the process.

---

*Document prepared by: Engineering Team — eDimensionz*
*Based on: Meezan_Bank_DDS_BRD_v2.docx and Precision Receipt System codebase review*
*Date: March 2026*
