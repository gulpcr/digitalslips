# Precision Receipt System — User Guide

## Prerequisites

Install these once on the server machine:
- **Docker Desktop** — https://www.docker.com/get-started
- **Git** — https://git-scm.com

---

## 1. First-Time Setup

```bash
# Clone the repository
git clone https://github.com/gulpcr/digitalslips.git
cd digitalslips/precision-receipt-complete
```

**Create the environment file:**
```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in these required values:

| Variable | What to put |
|---|---|
| `JWT_SECRET` | Any random string, 32+ characters |
| `ENCRYPTION_KEY` | Exactly 32 characters |
| `SESSION_SECRET` | Any random string |
| `TWILIO_ACCOUNT_SID` | From Twilio console |
| `TWILIO_AUTH_TOKEN` | From Twilio console |
| `TWILIO_PHONE_NUMBER` | WhatsApp number (e.g. `+14155238886`) |
| `TWILIO_SMS_PHONE_NUMBER` | SMS number from Twilio |
| `OPENAI_API_KEY` | For cheque OCR scanning |
| `PUBLIC_URL` | Your server's public URL (e.g. `https://yourdomain.com`) |

Leave everything else at defaults for a standard installation.

---

## 2. Start the System

```bash
cd precision-receipt-complete
docker compose up -d
```

First run takes ~5 minutes to download and build images.

**Seed the database (first time only):**
```bash
docker compose exec backend python app/database/seed.py
```

---

## 3. Access the System

| Service | URL |
|---|---|
| **Bank Dashboard** | http://localhost:3080 |
| **API** | http://localhost:8001 |
| **API Docs** | http://localhost:8001/api/docs |
| **WhatsApp Webhook** | http://localhost:9001 |

Default login: `admin` / `Admin@123456` — **change this immediately after first login.**

---

## 4. WhatsApp Integration (for customer receipts)

1. Install **ngrok**: https://ngrok.com/download
2. Run: `ngrok http 9001`
3. Copy the `https://xxxx.ngrok.io` URL
4. In [Twilio Sandbox](https://console.twilio.com) → WhatsApp → Sandbox settings, set webhook to:
   `https://xxxx.ngrok.io/whatsapp/webhook`
5. Customers join by texting: **`join receive-greatest`** to `+1 415 523 8886`

> For production, replace ngrok with your permanent domain and update `PUBLIC_URL` in `.env`.

---

## 5. Daily Operations

**Start the system:**
```bash
docker compose up -d
```

**Stop the system:**
```bash
docker compose down
```

**View logs if something is wrong:**
```bash
docker compose logs -f backend
docker compose logs -f whatsapp
```

**Restart a single service:**
```bash
docker compose restart backend
```

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| Dashboard won't load | Run `docker compose ps` — all services should say `Up` |
| Port already in use | Change port in `docker-compose.yml` (e.g. `3081:80`) |
| WhatsApp not receiving | Check ngrok is running and Twilio webhook URL is updated |
| Database errors | Run `docker compose logs postgres` to check |
| Need to reset data | `docker compose down -v` then repeat setup steps |

---

## 7. Backup

Data is stored in Docker volumes. To back up the database:

```bash
docker run --rm -v precision-receipt-complete_postgres_data:/data \
  -v $(pwd):/backup alpine \
  tar czf /backup/db-backup-$(date +%Y%m%d).tar.gz /data
```
