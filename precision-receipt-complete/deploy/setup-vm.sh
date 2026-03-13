#!/bin/bash
set -euo pipefail

# ============================================================
# setup-vm.sh — One-time setup for GCP Compute Engine VM
# Run this ON the VM after SSH-ing in, or pass via startup script
#
# Tested on: Ubuntu 22.04 LTS, Debian 12
# ============================================================

echo "============================================"
echo "  Precision Receipt — VM Setup"
echo "============================================"

# ── 1. Install Docker ──
if ! command -v docker &>/dev/null; then
  echo ">> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo ">> Docker installed. You may need to log out and back in for group changes."
else
  echo ">> Docker already installed: $(docker --version)"
fi

# ── 2. Install Docker Compose plugin ──
if ! docker compose version &>/dev/null; then
  echo ">> Installing Docker Compose plugin..."
  sudo apt-get update -qq
  sudo apt-get install -y docker-compose-plugin
else
  echo ">> Docker Compose already installed: $(docker compose version)"
fi

# ── 3. Configure Artifact Registry authentication ──
echo ""
echo ">> Configuring Docker auth for Artifact Registry..."
# Detect region from metadata or use default
REGION=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/zone 2>/dev/null | rev | cut -d'/' -f1 | rev | sed 's/-[a-z]$//' || echo "us-central1")
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet 2>/dev/null || \
  echo "WARNING: gcloud not available. Run 'gcloud auth configure-docker REGION-docker.pkg.dev' manually."

# ── 4. Create application directory ──
APP_DIR="/opt/digitalslips"
echo ""
echo ">> Setting up application directory at $APP_DIR..."
sudo mkdir -p "$APP_DIR"
sudo chown "$USER":"$USER" "$APP_DIR"

# ── 5. Create placeholder env file ──
if [ ! -f "$APP_DIR/.env.prod" ]; then
  cat > "$APP_DIR/.env.prod" <<'ENVEOF'
# === Precision Receipt — Production Environment ===
# Copy from deploy/.env.prod.example and fill in values

# Release (managed by deploy/rollback scripts)
# RELEASE_TAG=latest
# REGISTRY=us-central1-docker.pkg.dev/YOUR_PROJECT/digitalslips

# Database
DB_PASSWORD=CHANGE_ME

# Security — generate with: openssl rand -hex 32
JWT_SECRET=CHANGE_ME
ENCRYPTION_KEY=CHANGE_ME
SESSION_SECRET=CHANGE_ME

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_SMS_PHONE_NUMBER=
SMS_ENABLED=false
SMS_PROVIDER=twilio

# External URL (for webhooks, receipt verification links)
PUBLIC_URL=https://your-domain.com

# OpenAI (cheque OCR)
OPENAI_API_KEY=
OPENAI_VISION_MODEL=gpt-4o
ENVEOF
  echo ">> Created $APP_DIR/.env.prod — EDIT THIS FILE with real values."
else
  echo ">> $APP_DIR/.env.prod already exists, skipping."
fi

# ── 6. System tuning ──
echo ""
echo ">> Applying system tuning..."

# Increase file descriptor limits for Docker
if ! grep -q "precision-receipt" /etc/security/limits.conf 2>/dev/null; then
  sudo tee -a /etc/security/limits.conf > /dev/null <<'EOF'
# precision-receipt: increase limits for Docker containers
*    soft    nofile    65535
*    hard    nofile    65535
EOF
fi

# Enable Docker service on boot
sudo systemctl enable docker 2>/dev/null || true

echo ""
echo "============================================"
echo "  VM Setup Complete"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Edit $APP_DIR/.env.prod with real credentials"
echo "  2. Open firewall ports: 80 (HTTP), 443 (HTTPS), 9001 (WhatsApp webhook)"
echo "     gcloud compute firewall-rules create allow-web --allow tcp:80,tcp:443,tcp:9001 --target-tags=digitalslips"
echo "  3. From your local machine, run: ./deploy.sh v1.0.0"
echo ""
echo "  If you just added yourself to the docker group, log out and back in first."
