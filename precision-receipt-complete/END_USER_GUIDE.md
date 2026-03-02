# Meezan Bank — Digital Deposit Slip & Receipt System
## End User Guide

---

## What Is This System?

This system lets you create a **Digital Reference ID (DRID)** before visiting a branch, so the teller can pull up your details instantly — no paper forms to fill at the counter. You can use:

- **Web** — any browser on your phone or computer
- **WhatsApp** — chat with the bank
- **SMS** — for basic phones without internet

---

## Channel 1: Web (Browser)

### How to Access
Open your browser and go to the bank's deposit portal (e.g. `https://rcpt-demo.edimensionz.com/`).

### Step-by-Step

**Step 1 — Choose Transaction Type**

Select one of the five options:

| Type | Use When |
|---|---|
| Cash Deposit | You are depositing physical cash |
| Cheque Deposit | You have a cheque to deposit |
| Pay Order | You want a bank-issued pay order |
| Bill Payment | Paying electricity, gas, phone, etc. |
| Fund Transfer | Sending money to another account |

**Step 2 — Enter Your Information**

Fill in:
- **Your CNIC** — format: `42101-1234567-1`
- **Account Number** — your Meezan Bank account
- **Amount** — in PKR

**Step 3 — Fill Transaction-Specific Details**

Depending on what you selected:

- **Cash Deposit** — select who is depositing:
  - *Myself* — no extra info needed
  - *Family Member / Agent* — their name, CNIC, phone
  - *Business / Merchant* — business name, registration number, NTN, contact person, phone

- **Cheque Deposit** — enter:
  - Cheque number (6–10 digits)
  - Cheque date
  - Bank name
  - Payee name (as written on cheque)
  - Clearing type: **Local** (same city, 1 day, PKR 50 fee) or **Inter-City** (3 days, PKR 150 fee)
  - Optional: scan the cheque using the **Scan Cheque** button — details fill automatically

- **Pay Order** — payee's full name and CNIC

- **Bill Payment** — bill type, consumer number, biller name (e.g. K-Electric, SNGPL), due date

- **Fund Transfer** — beneficiary name, account number, bank. For other banks, provide IBAN.

**Step 4 — Generate DRID**

Click **Generate Digital Reference (DRID)**. You will see:

- A **DRID code** (e.g. `DRID-20260227-XXXX`)
- A **QR code** — show this at the branch counter
- **Validity timer** — 60 minutes. Visit the branch before it expires.

**Step 5 — At the Branch**

1. Visit any Meezan Bank branch within 60 minutes
2. Tell the teller: *"I have a DRID"*
3. Show the QR code or read out the DRID
4. Teller retrieves your details — no forms to fill
5. Complete payment and receive your receipt

> If the DRID expires, simply go back to the portal and create a new one.

---

## Channel 2: WhatsApp

### How to Connect

1. Save Meezan Bank's WhatsApp number: **+1 415 523 8886**
2. Send the message: **`join receive-greatest`**
3. You will receive a welcome reply confirming you are connected

> This step is only needed once.

### Conversation Flow

Send **Hi** at any time to reach the main menu.

```
You:   Hi

Bank:  MEEZAN BANK - Digital Services
       1. Account Services
       2. Card Services
       3. Branch Services
       4. Complaints & Support
       Reply with option number (1-4)

You:   3

Bank:  BRANCH SERVICES
       1. Digital Deposit Slip
       2. Appointment Booking
       3. Branch Locator
       Reply with option number (1-3)

You:   1

Bank:  Select deposit type:
       1. Cash Deposit
       2. Cheque Deposit
       3. Pay Order / Demand Draft
       Reply with option number (1-3)
```

Follow the prompts step by step. At the end you receive your **DRID** and a **QR code image** — show it at the branch.

### Cheque Deposit via WhatsApp

You can **send a photo of your cheque** — the system reads it automatically and fills in the details. You then confirm or edit anything that was read incorrectly.

### Tips

- Send **0** at any step to go back to the previous menu
- Send **Hi** to restart from the beginning
- Your session stays active for **30 minutes**. If it times out, send Hi again.

---

## Channel 3: SMS

### How to Use

Send a text to the bank's SMS number.

Start by sending: **`Hi`**

```
You:   Hi

Bank:  MEEZAN BANK - SMS Banking

       Select a Service:
       1. Account Services
       2. Card Services
       3. Branch Services
       4. Complaints & Support

       Reply with option number (1-4)
```

Select **3** for Branch Services, then **1** for Digital Deposit Slip and follow the prompts.

### SMS-Specific Notes

- SMS cannot process images — for cheque deposits you will be asked to **type the cheque details manually** (cheque number, date, bank, amount, payee name)
- Use **WhatsApp** if you want to scan a cheque image instead
- Session expires after **30 minutes** of inactivity — send `Hi` to restart

### Who Can Deposit

During the flow you will be asked:

| Option | When to Choose |
|---|---|
| Meezan Customer | You have a Meezan Bank account — your details are fetched automatically using your CNIC |
| Walk-in Individual | You do not have a Meezan account — you will enter name, CNIC, phone, and target account number |
| Business / Merchant | A company making a deposit — you enter business name, registration number, NTN, contact person |

---

## After Getting Your DRID (All Channels)

1. **Note the DRID code** or screenshot it
2. **Visit any branch** within 60 minutes
3. Tell the teller: *"I have a DRID"*
4. Show your QR code or give the DRID number verbally
5. Teller processes the transaction
6. You receive a **digital receipt** sent to your phone

---

## Verifying a Receipt

To verify a receipt you received:

- Scan the QR code on the receipt — it opens a verification page
- Or visit the verification URL directly: `https://rcpt-demo.edimensionz.com/verify/RCP-XXXXXXXX`

The page shows the transaction details, amount, and confirms it is genuine.

---

## Frequently Asked Questions

**My DRID expired. What do I do?**
Create a new one — go back to the web portal or send Hi on WhatsApp/SMS and repeat the process.

**I entered the wrong amount. Can I edit it?**
Before confirming: yes. During the cheque flow you can edit fields. After the DRID is generated: create a new slip with the correct amount.

**Can someone else visit the branch with my DRID?**
Yes, for cash deposits you can send a family member or agent. Enter their details when asked "Who is making the deposit?"

**I don't have a Meezan Bank account but want to deposit into someone else's account.**
Select "Walk-in Individual" in the customer type step and provide the target account number.

**What is the difference between Local and Inter-City cheque?**

| | Local | Inter-City |
|---|---|---|
| Same city as account | Yes | No |
| Clearing time | 1 business day | 3 business days |
| Processing fee | PKR 50 | PKR 150 |

**Which channel should I use?**

| Situation | Recommended Channel |
|---|---|
| At home, have internet | Web |
| On phone, want to chat | WhatsApp |
| Basic phone / no internet | SMS |
| Cheque with photo scan | WhatsApp |

---

*Meezan Bank Pakistan — Digital Transaction System*
*Powered by eDimensionz*
