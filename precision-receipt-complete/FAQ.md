# Precision Receipt System — FAQ
### For CIO, CDO, and Technical Stakeholders

---

## Table of Contents

1. [Security & Compliance](#1-security--compliance)
2. [Reliability & Operations](#2-reliability--operations)
3. [Scalability](#3-scalability)
4. [Data Governance](#4-data-governance)
5. [AML & Regulatory](#5-aml--regulatory)
6. [Business & Operations](#6-business--operations)
7. [Integrating with Temenos Transact (T24)](#7-integrating-with-temenos-transact-t24)
8. [Integrating with Meta WhatsApp Business API](#8-integrating-with-meta-whatsapp-business-api)

---

## 1. Security & Compliance

---

**Q: RSA keys are stored in a `./keys/` directory inside the container. What happens to them when the container restarts? Are they regenerated?**

A: Currently the keys directory is mounted as a Docker volume (`backend_uploads`), so keys persist across container restarts. However, this is a risk — volume-level access on the host server is sufficient to steal the private key. The recommended hardening path is to move key storage to a secrets manager (AWS Secrets Manager, HashiCorp Vault, or Azure Key Vault) and load the key material at startup via environment injection rather than from disk. Until that is done, ensure the production host has strict filesystem permissions and the keys directory is excluded from all backups that leave the security perimeter.

---

**Q: The JWT secret is in a `.env` file. How is that file protected in production? Who has access to it?**

A: The `.env` file is the current mechanism for passing secrets into Docker Compose. In production this should be treated as a secret file — not committed to Git (already enforced via `.gitignore`), accessible only to the deployment user, and rotated on a schedule. The better long-term approach is to replace the `.env` file with Docker Swarm secrets, Kubernetes Secrets (with Sealed Secrets or External Secrets Operator), or a CI/CD secrets vault. Access to the raw `.env` on the server should be logged and audited. Currently there is no automatic rotation — this must be done manually and requires a container restart.

---

**Q: There is no visible rate limiting on the API. What prevents brute force on the login endpoint or DRID enumeration?**

A: The `auth_service.py` implements login attempt tracking — after a configurable number of failed attempts (`MAX_LOGIN_ATTEMPTS`, default 3) the account is locked for `LOCKOUT_DURATION_SECONDS` (default 1800 seconds / 30 minutes). However, this is application-level protection only. There is no nginx-level rate limiting configured today. For production hardening, nginx `limit_req_zone` should be added to cap requests per IP on `/api/v1/auth/login` and `/api/v1/deposit-slips`. DRID format (`DRID-YYYYMMDD-XXXXXX`) with a 6-character alphanumeric suffix gives ~2.1 billion combinations — enumeration is impractical but the retrieve endpoint should still be rate-limited.

---

**Q: CNIC numbers are stored in plain text across multiple tables. Is that compliant with data protection requirements?**

A: CNIC numbers are stored as plain strings in `customers`, `transactions`, and `digital_deposit_slips` tables. This is a known gap. The CNIC is used as a lookup key across joins, which is why it is not currently encrypted — encryption would require application-layer decryption before every lookup, adding latency. The recommended approach is PostgreSQL column-level encryption (`pgcrypto`) on the `customers.cnic` field with a deterministic hash stored separately for lookups, or migration to a format-preserving encryption scheme. Until then, database access must be restricted strictly — no direct DB access from application code outside the ORM, and all database users should have the minimum required privilege set.

---

**Q: Where does TLS terminate in production and who manages the certificate?**

A: TLS terminates at the reverse proxy or load balancer in front of the Docker host — the nginx container inside Docker listens on plain HTTP port 80. In the current production setup at `rcpt-demo.edimensionz.com`, TLS is managed at the hosting/CDN layer (typically Cloudflare, AWS ALB, or a separate nginx on the host). The internal Docker network communication is unencrypted HTTP, which is acceptable as long as it stays within a private network. Certificate renewal must be tracked separately — the system itself has no automatic certificate management (Let's Encrypt / certbot) configured.

---

## 2. Reliability & Operations

---

**Q: Redis is used for sessions. If Redis goes down, do all active WhatsApp and SMS conversations die instantly?**

A: Yes, currently. The WhatsApp and SMS adapters use an in-memory `SessionManager` class — Redis is used by the backend for caching and session data but the conversation state machines store session state in Python dictionaries in the `whatsapp` container's process memory. If the `whatsapp` container crashes or restarts, all in-progress customer conversations are lost and customers must start over by sending "HI". The fix is to back the `SessionManager` with Redis persistence so sessions survive restarts. This is a planned improvement — the Redis container is already in the stack and accessible to the `whatsapp` container.

---

**Q: The WhatsApp and SMS session state is in-memory. What happens to active customer sessions if that container crashes?**

A: All active sessions are lost. A customer mid-flow (e.g., has entered their account number and is entering the amount) will receive no response on their next message and will need to restart. The DRID itself is not lost — if it was already generated it remains in the database. The customer can re-initiate or a teller can retrieve the existing DRID if the customer has the reference number. To fully resolve this, sessions should be serialised to Redis with a TTL matching the session timeout (30 minutes). The `UserSession` dataclass is already serialisable — the migration requires replacing the in-memory dict with Redis hash operations.

---

**Q: There is no visible backup strategy for PostgreSQL. What is the RTO and RPO?**

A: Currently there is no automated backup configured in the Docker Compose setup — the `postgres_data` volume is on the host filesystem only. RTO and RPO are undefined. For production the minimum acceptable setup is daily `pg_dump` to an off-host location (S3, Azure Blob, or NFS) with point-in-time recovery enabled via WAL archiving. Recommended: use a managed PostgreSQL service (AWS RDS, Azure Database for PostgreSQL) which provides automated backups, point-in-time restore, and read replicas out of the box, eliminating the need to manage this manually.

---

**Q: T24 integration is not live. How is the system posting transactions to core banking right now?**

A: It is not. When a teller marks a transaction as complete via the `POST /{drid}/complete` endpoint, the system creates a `Transaction` record in its own PostgreSQL database and marks the status as `COMPLETED`. The `t24_transaction_id`, `t24_posting_date`, and `t24_response` fields are left null. The system is operating as a **digital deposit slip generator only** — actual fund posting still happens manually in T24 by the teller after completing the DRID flow. The DRID reference number serves as the paper trail linking the two systems until the live integration is built. See Section 7 for the full T24 integration plan.

---

**Q: What is the failover plan if the production domain goes down during business hours?**

A: There is no automatic failover today. The system runs as a single Docker Compose stack on one host. If the host or domain goes down, all channels (WhatsApp, SMS, Web) stop working simultaneously. The WhatsApp channel is the highest risk since the Twilio webhook URL is hardcoded to the production domain — Twilio will log error 11200 (HTTP retrieval failure) for every incoming customer message. The minimum viable continuity plan is to have a secondary host ready with a Docker Compose `docker compose up` runbook, and update the Twilio webhook URL via API (a 30-second operation). Longer term, a load balancer with health-checked backend pool provides automatic failover.

---

## 3. Scalability

---

**Q: WhatsApp and SMS run on a single container. What is the maximum concurrent sessions supported?**

A: The `whatsapp` container runs a single FastAPI/uvicorn process. FastAPI is async so it can handle many concurrent HTTP requests, but each session object lives in memory. Practical limits depend on the host machine RAM — each session object is small (~2KB of Python dict data) so 10,000 concurrent sessions would use roughly 20MB. The real bottleneck is the Twilio webhook throughput and database query latency for customer lookups. A single container should comfortably handle hundreds of concurrent active conversations. Beyond that, horizontal scaling requires moving session state to Redis (see Q above) and running multiple `whatsapp` container replicas behind a load balancer.

---

**Q: The cheque OCR calls OpenAI synchronously during the customer WhatsApp flow. What happens if OpenAI is slow or down?**

A: The customer waits. The WhatsApp webhook has a Twilio timeout of 15 seconds — if the OCR call takes longer, Twilio considers the webhook failed and may retry or return an error to the customer. If OpenAI returns an error, the system falls back to asking the customer to enter cheque details manually. Currently there is no queue or async offloading for the OCR call. The recommended fix is to respond to Twilio immediately with "Processing your cheque, please wait..." and then make the OCR call asynchronously, sending the result back to the customer via a proactive Twilio API message rather than a TwiML response. This decouples the 15-second Twilio webhook window from the OCR processing time.

---

**Q: The database connection pool is set to `pool_size=20, max_overflow=0`. Has this been load tested?**

A: No formal load testing has been performed. The pool of 20 connections with no overflow means a maximum of 20 simultaneous database operations across the backend and whatsapp containers combined. Under high teller load (many branches simultaneously completing transactions) this could become a bottleneck. PostgreSQL itself handles up to `max_connections` (default 100) connections. For immediate relief, `max_overflow` can be increased to 10-20 without risk. For production scale, a connection pooler like PgBouncer should sit between the application and PostgreSQL, allowing the application pool to be large while keeping actual PostgreSQL connections low and stable.

---

## 4. Data Governance

---

**Q: Customer CNIC, account numbers, and phone numbers flow through Twilio's servers when WhatsApp and SMS messages are sent. Has a data processing agreement been signed with Twilio?**

A: This must be verified with the legal and compliance team. Twilio is GDPR-compliant and offers a Data Processing Addendum (DPA). For a Pakistani bank operating under SBP regulations, the key question is whether CNIC and account data constitutes sensitive personal data that cannot be processed by a foreign entity without specific controls. In the current WhatsApp flow, the customer types their account number and it passes through Twilio's infrastructure. The technical mitigation is to avoid sending full account numbers in message bodies — the system already masks accounts (e.g., `****-3456`). A full CNIC is never sent in a message body but is stored internally. The DPA with Twilio should be reviewed and executed before production rollout to customers.

---

**Q: Cheque images are sent to OpenAI for OCR. Who owns that data once it leaves the system?**

A: OpenAI's API data usage policy (as of 2025) states that data sent via API is not used to train models and is retained for a limited period (default 30 days for abuse monitoring). However, a cheque image contains highly sensitive data — account number, MICR code, signature, payee name, and amount. Before using OpenAI OCR in production, the bank should: (1) obtain a written data processing agreement with OpenAI, (2) confirm this is permitted under the bank's data classification policy for "Confidential" data, (3) evaluate whether an on-premise OCR solution (e.g., Tesseract + custom model, or Azure AI Document Intelligence with data residency controls) should replace the OpenAI dependency. The cheque OCR feature should not be enabled in production without these approvals.

---

**Q: The `audit_logs` table stores old and new data as JSONB. Does this mean sensitive fields sit in the audit log indefinitely?**

A: Yes. Currently the `old_data` and `new_data` JSONB columns in `audit_logs` store the full before/after state of any changed entity. If a customer record is updated, the CNIC, phone number, and account details appear verbatim in the audit log. This is a data minimisation concern. The fix is to apply a field-level redaction function before writing to `audit_logs` — masking CNIC to `*****1234`, account numbers to `****5678`, and omitting phone numbers unless the action type specifically requires them. The audit log should capture that a field changed and who changed it, not necessarily the full raw values for sensitive fields.

---

**Q: What is the data retention policy for completed DRIDs, transactions, and receipts?**

A: No retention policy is defined or enforced in the system today. All records accumulate indefinitely in the database. For regulatory compliance (SBP requires transaction records to be retained for a minimum of 10 years), a tiered retention approach is recommended: hot data (last 2 years) in PostgreSQL, warm data (2-10 years) archived to cold storage (S3 Glacier or equivalent) in compressed, signed format, with a restore procedure documented and tested. DRID records (expired, cancelled) older than 90 days have no operational value and could be archived sooner. A scheduled database job should enforce these policies automatically.

---

## 5. AML & Regulatory

---

**Q: The CTR threshold is hardcoded at PKR 250,000. How does the compliance team update this without a code deployment?**

A: Currently it is a setting in `config.py` (`CTR_THRESHOLD_PKR = 250000.00`) loaded from the `.env` file at startup. Changing it requires updating `.env` and restarting the backend container — not a code deployment, but still an operational step requiring server access. The cleaner solution is to move all AML thresholds to the `system_settings` database table, which already exists in the schema with `key`, `value`, `value_type`, `category`, and `updated_by` columns. The AML service would read thresholds from the database at check time (with a short Redis cache), allowing the compliance team to update them via an admin UI without touching the server at all. This change can be built in a single sprint.

---

**Q: AML flags a transaction as suspicious with `is_suspicious = true`, but what happens next? Who sees it, who acts on it?**

A: Currently nothing automated happens after the flag is set. The `is_suspicious` field and `fraud_flags` JSONB are stored on the transaction record and an entry is written to `audit_logs` with severity `WARNING`. There is no case management workflow, no alert pushed to a supervisor dashboard, and no SLA enforced. The reports endpoint (`/api/v1/reports/fraud-alerts`) can surface these records, but a user must actively check it. The immediate requirement is a real-time alert — when `is_suspicious = true` is written, the notification service should send an internal alert (email or WhatsApp) to the branch manager and compliance officer. A case management queue (even a simple status field `aml_review_status` + `aml_reviewed_by` + `aml_reviewed_at`) should be added so flagged transactions have a documented review trail.

---

**Q: There is no STR (Suspicious Transaction Report) generation. How is the bank currently filing STRs with FMU?**

A: STRs are currently a manual process. When the compliance team identifies a suspicious transaction (by querying the system or through teller escalation), they prepare and file the STR with the Financial Monitoring Unit manually using FMU's goAML portal. The system does not generate, format, or submit STRs. Building this properly requires: (1) a compliance officer interface to review flagged transactions and mark them for STR, (2) a structured STR data model matching FMU's goAML XML schema, (3) either a manual export/upload workflow to goAML or a direct API integration if FMU provides one. This is a compliance priority item that should be scheduled before full production rollout.

---

**Q: The monthly AML volume threshold is PKR 2,000,000. Has this been approved by the compliance officer?**

A: The PKR 2,000,000 threshold was set as a technical default during development. It has not been formally reviewed or approved by the compliance function. Before the AML rules go live in production, every threshold value (CTR: PKR 250,000, high amount: PKR 500,000, unverified customer: PKR 100,000, third-party: PKR 200,000, daily limit: PKR 500,000, monthly limit: PKR 2,000,000) must be reviewed and sign-off obtained from the Chief Compliance Officer and MLRO. The AML service was built to be configurable precisely so these values can be adjusted without code changes. The recommended process is a formal threshold calibration workshop with compliance before go-live.

---

**Q: The DRID expires in 60 minutes. What happens if a customer generates a DRID at home and gets stuck in the branch queue?**

A: The customer's DRID will expire and they will need to generate a new one. This is a known UX friction point, particularly in high-traffic branches. The 60-minute validity is configurable (`validity_minutes` field on each slip) and can be extended. Options: (1) increase the default to 120 or 180 minutes, (2) allow customers to renew an expired DRID via WhatsApp/SMS by sending their previous DRID reference, (3) allow tellers to extend a specific DRID from the teller interface. The expiry is a fraud control — a long-lived DRID increases the window for misuse — so any extension should be a deliberate compliance decision rather than an arbitrary increase.

---

**Q: Walk-in non-customers can initiate a deposit slip with just a CNIC. What prevents someone from entering a false CNIC?**

A: Currently nothing verifies the CNIC against an authoritative source. The system accepts whatever CNIC the user types, checks it against the internal customer database, and if not found, creates a walk-in record. There is no NADRA VERIS (National Database & Registration Authority verification service) integration. The teller is the control point — when the customer arrives at the branch, the teller is required to verify the physical CNIC document against what was entered in the DRID. However, this is a manual check with no system enforcement. For high-risk transactions (third-party cash deposits above PKR 200,000), the teller physically copies the CNIC — the AML flag `THIRD_PARTY_HIGH_AMOUNT` is raised for these cases. NADRA VERIS integration should be prioritised for the walk-in non-customer flow.

---

**Q: Every transaction requires a teller — when does straight-through processing (STP) get built?**

A: STP is not in the current build. The document specification describes an STP path for low-risk transactions (internal transfers, bill payments under threshold, own-account deposits by verified customers) where the system auto-posts without teller intervention. Building STP requires: (1) a live T24 integration so the system can actually post to core banking, (2) risk-tier classification logic to determine which transactions qualify, (3) regulatory approval from SBP for automated posting without human review. STP is dependent on T24 integration being live. It is the highest-value efficiency gain in the roadmap but cannot be built until the core banking connection is established.

---

**Q: Branch locator and appointment booking are in the WhatsApp menu but not implemented. What does a customer see?**

A: A customer who selects Branch Locator or Appointment Booking receives the message: *"Branch Locator will be available soon. Send HI for the main menu."* This is a stub response in the WhatsApp message handler. These features are visible in the menu, creating a broken experience. Until they are built, the options should either be removed from the menu or replaced with a message directing the customer to the bank's website or call centre. Showing menu items that lead to dead ends damages customer trust in the digital channel.

---

## 7. Integrating with Temenos Transact (T24)

---

**Q: What does T24 integration mean for this system and why does it matter?**

A: Temenos Transact (formerly T24) is the core banking system where actual account balances are held, transactions are legally posted, and the general ledger is maintained. Right now the Precision Receipt System is a **digital form layer** — it manages the deposit slip workflow and stores transaction records in its own database, but does not touch T24. A teller still has to manually enter the transaction into T24 after completing it in this system. Full T24 integration means: when a teller clicks "Complete" in this system, the transaction is automatically posted to T24 and the customer's account balance is updated in real time, with zero re-keying.

---

**Q: What T24 interfaces are available for integration?**

A: Temenos Transact exposes several integration options:

- **T24 OFS (Object Format String)** — the legacy text-based messaging protocol. Widely used, well-documented, works over HTTP or MQ. Messages look like `FUNDS.TRANSFER,CREATE/I/PROCESS/1/1,0,/GBP/...`
- **T24 REST API (Temenos Infinity / Quantum)** — modern REST/JSON interface available in R17+. Requires Temenos API Gateway or Infinity middleware layer. Recommended for new integrations.
- **Temenos Payment Hub** — for payment-specific transactions (transfers, IBFT)
- **JMS / IBM MQ** — message queue integration for asynchronous posting, common in larger bank deployments
- **T24 TAFC / TAFJ** — direct Java API access, used by internal bank applications only

The recommended path is the **T24 REST API** if the bank's T24 version is R17 or later. If on an older version, OFS over HTTP is the practical choice.

---

**Q: What changes are needed in the codebase to connect to T24?**

A: The groundwork is already laid. The `Transaction` model has `t24_transaction_id`, `t24_posting_date`, `t24_value_date`, and `t24_response` fields. The `config.py` already has `T24_ENABLED`, `T24_API_URL`, `T24_API_KEY`, and `T24_TIMEOUT_SECONDS` settings. What needs to be built:

1. **`app/services/t24_service.py`** — a new service class that maps the internal `Transaction` object to a T24 OFS message or REST payload, calls the T24 API, parses the response, and handles errors (insufficient funds, account frozen, duplicate posting)

2. **Hook in `drid_service.py`** — inside `complete_deposit_slip()`, after AML checks pass, call `T24Service.post_transaction(db, transaction)` and store the response before generating the receipt

3. **Transaction type mapping** — each of the 5 transaction types (CASH_DEPOSIT, CHEQUE_DEPOSIT, PAY_ORDER, BILL_PAYMENT, FUND_TRANSFER) maps to a different T24 application (TELLER, FUNDS.TRANSFER, PAYMENT.ORDER, etc.)

4. **Error handling** — if T24 rejects the posting, the DRID must revert to VERIFIED status and the teller must be notified

---

**Q: What data does T24 need for each transaction type?**

A: The minimum fields T24 requires for a cash deposit posting:

| Field | Source in System |
|---|---|
| Debit account (vault/teller account) | Branch configuration |
| Credit account | `transaction.customer_account` |
| Amount | `transaction.amount` |
| Currency | `transaction.currency` |
| Value date | Today's date |
| Narrative | `transaction.narration` |
| Teller ID | `transaction.processed_by` |
| Channel | `transaction.channel` |

For cheque deposits, T24 additionally needs clearing type, cheque number, drawee bank, and instrument date. These are already stored in `transaction.extra_data` JSONB.

---

**Q: How should the T24 integration handle failures — what if T24 is down or rejects the posting?**

A: Three scenarios need handling:

- **T24 timeout / unreachable** — the DRID should remain in `VERIFIED` status, not move to `PROCESSING`. The teller sees an error: "Core banking system unavailable, please retry." A retry queue should be implemented using Redis so the transaction can be re-submitted automatically when T24 recovers.

- **T24 rejects the transaction** (e.g., account frozen, insufficient funds in vault) — the rejection reason should be parsed from the T24 response, stored in `transaction.failure_reason`, and the transaction status set to `FAILED`. The teller should see the specific T24 error message.

- **T24 posts successfully but acknowledgement is lost** (network timeout after posting) — this is the dangerous case. A reconciliation job should run every 15 minutes querying T24 for any transactions posted in the last hour that are not yet confirmed in the local database, matching on the teller ID and amount+time window.

---

**Q: Will T24 integration require changes to the bank's T24 environment?**

A: Yes. The bank's T24 team will need to:

1. Create a dedicated API user account for the Precision Receipt System with posting permissions only
2. Configure the allowed applications and input types for that user
3. Set up the API Gateway or expose the OFS endpoint in the bank's internal network
4. Ensure the Precision Receipt System server IP is whitelisted at the T24 network/firewall layer
5. Define the teller and vault account mapping per branch

This is a T24 system administration task that requires Temenos-certified support from the bank's core banking team or a Temenos partner.

---

**Q: How long does a typical T24 integration take?**

A: For a greenfield REST API integration from a pre-built system like this one (with placeholder fields already in the data model): **6 to 12 weeks** including T24 environment setup, API testing in a T24 sandbox, UAT with the operations team, and go-live cutover. The main delay is usually T24 environment access and the bank's internal change management process, not the development work itself. The development effort for the `T24Service` class and hook integration is estimated at 2-3 weeks of backend engineering.

---

## 8. Integrating with Meta WhatsApp Business API

---

**Q: What is the difference between the current Twilio WhatsApp setup and Meta's WhatsApp Business API?**

A: The current setup uses **Twilio as an intermediary**. Twilio has a partnership with Meta that allows it to relay WhatsApp messages through its own infrastructure. This means:

- Messages flow: Customer → Meta → Twilio → Your Webhook
- Twilio handles the Meta API authentication and connection
- You pay Twilio per message (markup over Meta's base rate)
- Limited to Twilio's sandbox for development (join code required)
- Subject to Twilio's feature roadmap and rate limits
- WhatsApp number is Twilio's shared sandbox number in test mode

**Meta's direct WhatsApp Business API (Cloud API)** removes Twilio from the chain:

- Messages flow: Customer → Meta → Your Webhook directly
- You authenticate directly with Meta using a system user access token
- Lower per-message cost (no Twilio markup)
- Access to all WhatsApp Business features (interactive buttons, list messages, templates, media messages)
- Your own dedicated WhatsApp Business number verified under the bank's name
- Requires a verified Meta Business Account

---

**Q: What does the bank need to go live on Meta WhatsApp Business API directly?**

A: The requirements are:

1. **Meta Business Account** — verified business account at business.facebook.com with the bank's legal entity name
2. **WhatsApp Business Account (WABA)** — created under the Meta Business Account
3. **Phone number** — a dedicated phone number that will become the bank's official WhatsApp number. This number cannot be used on the standard WhatsApp app once registered.
4. **Business verification** — Meta requires document submission to verify the business identity. For a licensed bank this is straightforward but takes 1-5 business days.
5. **Display name approval** — the name shown to customers (e.g., "Meezan Bank") must be approved by Meta.
6. **Message templates** — any outbound messages sent outside the 24-hour customer service window must use pre-approved templates. These are submitted to Meta for review (1-2 business days each).

---

**Q: What code changes are required to switch from Twilio WhatsApp to Meta Cloud API?**

A: The conversation logic in `WhatsAppAdapter` does not change — the state machine, session management, and message text are channel-agnostic. What changes is the layer that sends and receives messages:

**Inbound (receiving messages):**
- Replace Twilio's webhook format with Meta's webhook format. Meta sends JSON (`{"entry": [{"changes": [{"value": {"messages": [...]}}]}]}`) versus Twilio's form-encoded fields (`Body=...&From=...`). The `whatsapp_server.py` webhook handler needs to parse the new format.
- Meta requires webhook verification: a `GET` request with `hub.challenge` must be answered before messages start flowing.

**Outbound (sending messages):**
- Replace `build_twiml_response()` (which returns XML) with direct calls to Meta's Cloud API (`POST https://graph.facebook.com/v18.0/{phone_number_id}/messages`) using a Bearer token.
- Meta does not use TwiML — you must respond to the webhook with HTTP 200 immediately and then make a separate API call to send the reply.

**Media (cheque images):**
- Twilio passes `MediaUrl0` directly. Meta passes a `media_id` which must be separately fetched before downloading the image bytes.

Estimated migration effort: **2-3 weeks** for a developer familiar with both APIs.

---

**Q: Can the system support both Twilio WhatsApp and Meta WhatsApp simultaneously?**

A: Yes. The recommended architecture is to define a `WhatsAppProvider` interface with two implementations: `TwilioWhatsAppProvider` and `MetaWhatsAppProvider`. The `whatsapp_server.py` routes to the correct provider based on the incoming webhook path or a config flag. This allows running Twilio in development/UAT and Meta in production, or running both in parallel during a migration period.

---

**Q: What are Meta's message template requirements and how do they affect the flow?**

A: Meta distinguishes between two message types:

- **Session messages** — any format, sent within 24 hours of the customer's last message. The current conversational flow (menus, confirmations, DRID delivery) all fall into this category. No pre-approval needed.
- **Template messages** — required when sending a message more than 24 hours after the customer's last message. The transaction completion receipt may fall outside the 24-hour window if the customer initiated the DRID in the morning and the teller posts later.

Templates to pre-approve: `drid_confirmation`, `transaction_receipt`, `aml_hold_notice`, `drid_expiry_reminder`. Each takes 1-2 business days for Meta approval.

---

**Q: How does pricing compare between Twilio WhatsApp and Meta direct?**

A: Approximate pricing (verify current rates before budget planning):

| Component | Twilio WhatsApp | Meta Cloud API (Direct) |
|---|---|---|
| Inbound message | $0.005 per message | Free |
| Outbound (session) | $0.005–$0.008 per message | $0.005–$0.009 per conversation (24hr window) |
| Outbound (template) | $0.005–$0.008 per message | $0.015–$0.025 per template conversation |
| Setup fee | None | None |
| Volume discounts | Available | Available via Meta tiers |

For a high-volume bank deployment, direct Meta integration typically saves 20-40% on messaging costs. However, Twilio provides a managed layer — webhook reliability, delivery tracking, and support — that has operational value.

---

**Q: Is there a middle-ground option other than Twilio or going fully direct with Meta?**

A: Yes. Several WhatsApp Business Solution Providers (BSPs) offer managed Meta API access with better pricing than Twilio and more features than raw Meta API:

- **360dialog** — widely used in fintech, offers a managed WABA with a REST API very similar to Meta's Cloud API.
- **Infobip** — enterprise-grade, good for regulated industries, offers SLA-backed delivery and compliance features.
- **Bird (formerly MessageBird)** — strong in Asia/Middle East markets, offers omnichannel (WhatsApp + SMS + email) in one API.
- **Vonage (now Ericsson)** — enterprise-focused, good for banks with compliance requirements.

The code changes required to switch to any of these BSPs are similar to the Meta direct migration — replace the outbound API call and inbound webhook parser, keep the adapter logic intact.

---

*Last updated: March 2026*
*Maintained by: Engineering Team — Precision Receipt System*
