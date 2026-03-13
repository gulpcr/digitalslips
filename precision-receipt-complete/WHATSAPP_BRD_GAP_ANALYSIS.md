# WhatsApp Flow — BRD Gap Analysis

**BRD Document:** BRD Flows & Processes v1.2.docx
**Implementation:** `backend/app/whatsapp/whatsapp_adapter.py` + `whatsapp_messages.py`
**Date:** 2026-03-13

---

## Flows Covered in BRD

| # | Flow | BRD | Implemented |
|---|------|-----|-------------|
| 1 | Cash Deposit — Own Account (Self) | YES | YES |
| 2 | Cash Deposit — Own Account (Third-Party Depositor) | YES | YES |
| 3 | Cheque Deposit — Own Account (Self) | YES | YES |
| 4 | Cheque Deposit — Own Account (Third-Party Depositor) | YES | PARTIAL |

---

## GAP ANALYSIS

### GAP 1: Menu Structure Mismatch — "Digital Deposit Slip" as Option 5 vs nested under Branch Services

| | BRD | Implementation |
|---|-----|----------------|
| **Main Menu** | 5 options: Account Services, Card Services, Branch Services, Complaints & Support, **Digital Deposit Slip** | 4 options: Account Services, Card Services, **Branch Services**, Complaints & Support |
| **DDS Access** | Customer replies **5** from main menu (direct access) | Customer replies **3** (Branch Services) → then **1** (Digital Deposit Slip) — **extra step** |

**Impact:** BRD shows Digital Deposit Slip as a top-level menu item (option 5). Implementation nests it under Branch Services, requiring 2 taps instead of 1.

**Status:** DEVIATION — extra navigation step

---

### GAP 2: Missing Self vs Third-Party Depositor Selection for Cash Deposits

| | BRD | Implementation |
|---|-----|----------------|
| **Cash Deposit Flow** | After selecting Cash Deposit, system asks: "1 – Self (Account Holder)" / "2 – Third Party Depositor" | After selecting deposit type, system asks **customer type**: "1 – Meezan Customer" / "2 – Walk-in Individual" / "3 – Business/Merchant" |
| **Third-party capture** | If customer selects "Third Party", system collects depositor Name, Mobile, CNIC **after** account & amount | Walk-in flow collects CNIC, Name, Phone, Target Account — treated as a **different customer type**, not as a third-party for the account holder |

**Impact:** The BRD flow allows a **registered Meezan customer** to create a deposit slip and then specify a **third-party depositor** (someone else will bring the cash). In the implementation, the "Walk-in" flow is for **unknown customers** depositing to a known account — it's a different concept. A Meezan customer who wants a third party to deposit on their behalf has no way to specify the depositor details.

**Status:** MISSING — Third-party depositor sub-flow for existing Meezan customers not implemented

---

### GAP 3: Missing Self vs Third-Party Depositor Selection for Cheque Deposits

| | BRD | Implementation |
|---|-----|----------------|
| **Cheque Deposit Flow** | Step 8: System asks "1 – Self" / "2 – Third Party Depositor" | Cheque flow goes: Image Upload → OCR → Clearing Type → Account Selection → Confirmation. **No depositor selection step.** |
| **Third-party cheque flow** | If "Third Party" selected: after cheque OCR confirmation, system collects depositor Name, Mobile, CNIC (Steps 17-18) | Not implemented |

**Impact:** Same as GAP 2 but for cheque deposits. A customer cannot specify that someone else will bring the cheque to the branch.

**Status:** MISSING — Third-party depositor flow for cheque deposits not implemented

---

### GAP 4: Cheque Flow — Missing "Edit / Re-upload" Option at OCR Confirmation

| | BRD | Implementation |
|---|-----|----------------|
| **OCR Confirmation** | Options: "1 – Confirm" / "2 – Edit / Re-upload Cheque Image" | Options: "1 – Confirm" / "2 – Edit Details" / "3 – Re-upload Cheque" / "4 – Cancel" |

**Impact:** Implementation actually has **more** options than BRD (Edit Details + Re-upload separately). This is an improvement, not a gap.

**Status:** EXCEEDS BRD (better UX)

---

### GAP 5: Deposit Type Menu — BRD Shows Only 2 Options, Implementation Has 6

| | BRD | Implementation |
|---|-----|----------------|
| **Deposit Types** | 1 – Cash Deposit, 2 – Cheque Deposit | 1 – Cash, 2 – Cheque, 3 – Pay Order, 4 – Own Account Transfer, 5 – Loan Instalment, 6 – Charity/Zakat |

**Impact:** Implementation exceeds BRD scope with 4 additional transaction types. Not a gap — this is ahead of BRD.

**Status:** EXCEEDS BRD

---

### GAP 6: DRID Format Alignment

| | BRD | Implementation |
|---|-----|----------------|
| **DRID Format** | `MZ-2026-00012345` (MZ-YYYY-8digits) | `MZ-2026-A1B2C3D4` (MZ-YYYY-8alphanumeric) |

**Impact:** BRD shows numeric-only suffix. Implementation uses alphanumeric (hex from UUID). Functionally equivalent but format differs slightly.

**Status:** MINOR DEVIATION

---

### GAP 7: Missing Digital Confirmation Message After Teller Completes Transaction

| | BRD | Implementation |
|---|-----|----------------|
| **Post-completion** | Step 25/26: "Customer receives digital confirmation via WhatsApp/SMS" with account, amount, transaction ID, branch, date/time | WhatsApp confirmation after teller completion is **not automatically sent**. DRID status updates to COMPLETED but no WhatsApp message is pushed back to the customer. |

**Impact:** BRD requires the system to send a WhatsApp notification back to the customer when the teller completes the deposit. Currently, the customer only gets the initial DRID message — no completion confirmation via WhatsApp.

**Status:** MISSING — Post-completion WhatsApp notification not implemented

---

### GAP 8: Customer Authentication / Phone Verification

| | BRD | Implementation |
|---|-----|----------------|
| **Step 2-3** | System performs customer identification using registered mobile number. Validates: (a) mobile linked to Meezan profile, (b) registered for WhatsApp Banking | System looks up customer by phone number in DB. No "WhatsApp Banking registration" check — any phone number in the customer table is treated as registered. |

**Impact:** BRD implies a separate WhatsApp Banking registration/enrollment step. Implementation auto-matches any customer by phone — no registration gate.

**Status:** PARTIAL — No WhatsApp Banking enrollment/registration check

---

### GAP 9: Account Display Format — Masking

| | BRD | Implementation |
|---|-----|----------------|
| **Account Display** | Masked format: `0012--3456` (first 4, last 4 with dashes) | Full or partially masked: depends on `account_selection()` helper — shows account number + type |

**Impact:** BRD specifies a specific masking pattern. Implementation may expose more account digits than intended.

**Status:** MINOR — Masking format should match BRD pattern

---

### GAP 10: Confirmation Summary — Missing Fields per BRD

| | BRD (Third-Party Cash) | Implementation |
|---|-----|----------------|
| **Summary includes** | Account Number (masked), Account Holder Name, Deposit Amount, Depositor Name, Depositor CNIC, Depositor Mobile Number | Account, Customer Name, Amount, Transaction Type, Depositor Name/CNIC/Phone (if walk-in) |

**Impact:** Fields are present but displayed only when a walk-in depositor is used. For a Meezan customer with third-party depositor (GAP 2), these fields would not appear since that flow doesn't exist.

**Status:** DEPENDENT ON GAP 2

---

## SUMMARY TABLE

| Gap | Description | Severity | Status |
|-----|-------------|----------|--------|
| GAP 1 | DDS nested under Branch Services instead of main menu option 5 | LOW | **FIXED** — Added as option 5 in main menu |
| GAP 2 | No Self vs Third-Party depositor choice for Cash Deposits (Meezan customers) | **HIGH** | **FIXED** — Added DEPOSITOR_TYPE step with third-party detail collection |
| GAP 3 | No Self vs Third-Party depositor choice for Cheque Deposits | **HIGH** | **FIXED** — Same flow applies to cheque deposits |
| GAP 4 | Cheque OCR edit/re-upload options | N/A | Exceeds BRD |
| GAP 5 | Additional transaction types (Pay Order, Own Account, Loan, Charity) | N/A | Exceeds BRD |
| GAP 6 | DRID suffix format (alphanumeric vs numeric) | LOW | Minor deviation |
| GAP 7 | No WhatsApp completion notification after teller processes deposit | **HIGH** | **ALREADY IMPLEMENTED** — NotificationService sends completion message |
| GAP 8 | No WhatsApp Banking registration/enrollment gate | MEDIUM | Partial |
| GAP 9 | Account number masking format | LOW | **FIXED** — Now shows `0012--3456` format per BRD |
| GAP 10 | Confirmation summary fields (depends on GAP 2) | MEDIUM | **FIXED** — Depositor details shown in confirmation when third-party selected |
