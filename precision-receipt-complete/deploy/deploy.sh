#!/bin/bash
set -euo pipefail

# ============================================================
# deploy.sh — Build, tag, push images, and deploy to GCP VM
# Usage: ./deploy.sh [TAG] [--skip-build] [--skip-push]
#
# Examples:
#   ./deploy.sh v1.0.0          # Build, push, deploy with tag v1.0.0
#   ./deploy.sh                 # Auto-generates tag from timestamp
#   ./deploy.sh v1.0.0 --skip-build  # Push & deploy existing images
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Configuration (override via environment or .deploy.env) ──
if [ -f "$SCRIPT_DIR/.deploy.env" ]; then
  source "$SCRIPT_DIR/.deploy.env"
fi

REGION="${GCP_REGION:-us-central1}"
PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID in environment or .deploy.env}"
REPO_NAME="${ARTIFACT_REPO:-digitalslips}"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"
VM_NAME="${GCP_VM_NAME:-digitalslips-vm}"
VM_ZONE="${GCP_VM_ZONE:-us-central1-a}"
REMOTE_DIR="${REMOTE_APP_DIR:-/opt/digitalslips}"

# ── Parse arguments ──
TAG="${1:-$(date +%Y%m%d-%H%M%S)}"
SKIP_BUILD=false
SKIP_PUSH=false

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --skip-push)  SKIP_PUSH=true ;;
  esac
done

echo "============================================"
echo "  Precision Receipt — Deploy"
echo "============================================"
echo "  Tag:       $TAG"
echo "  Registry:  $REGISTRY"
echo "  VM:        $VM_NAME ($VM_ZONE)"
echo "============================================"

# ── Step 1: Build images ──
if [ "$SKIP_BUILD" = false ]; then
  echo ""
  echo ">> Building backend image..."
  docker build -t "$REGISTRY/backend:$TAG" "$PROJECT_DIR/backend"

  echo ""
  echo ">> Building frontend image..."
  docker build -t "$REGISTRY/frontend:$TAG" "$PROJECT_DIR/frontend"

  # Also tag as :latest
  docker tag "$REGISTRY/backend:$TAG" "$REGISTRY/backend:latest"
  docker tag "$REGISTRY/frontend:$TAG" "$REGISTRY/frontend:latest"

  echo ">> Build complete."
else
  echo ">> Skipping build (--skip-build)"
fi

# ── Step 2: Push to Artifact Registry ──
if [ "$SKIP_PUSH" = false ]; then
  echo ""
  echo ">> Pushing images to Artifact Registry..."
  docker push "$REGISTRY/backend:$TAG"
  docker push "$REGISTRY/backend:latest"
  docker push "$REGISTRY/frontend:$TAG"
  docker push "$REGISTRY/frontend:latest"
  echo ">> Push complete."
else
  echo ">> Skipping push (--skip-push)"
fi

# ── Step 3: Copy compose + env to VM (if not already there) ──
echo ""
echo ">> Syncing deployment files to VM..."
gcloud compute scp "$SCRIPT_DIR/docker-compose.prod.yml" "${VM_NAME}:${REMOTE_DIR}/docker-compose.prod.yml" --zone="$VM_ZONE" --quiet 2>/dev/null || true

# ── Step 4: Deploy on VM via SSH ──
echo ""
echo ">> Deploying $TAG on $VM_NAME..."
gcloud compute ssh "$VM_NAME" --zone="$VM_ZONE" --command="
  cd $REMOTE_DIR

  # Record release tag
  echo 'RELEASE_TAG=$TAG' > .release
  echo 'Deployed at: $(date -u +%Y-%m-%dT%H:%M:%SZ)' >> .release

  # Set env for compose
  export RELEASE_TAG=$TAG
  export REGISTRY=$REGISTRY

  # Source production env
  if [ -f .env.prod ]; then
    set -a; source .env.prod; set +a
  fi

  # Pull new images and restart
  docker compose -f docker-compose.prod.yml pull
  docker compose -f docker-compose.prod.yml up -d

  # Show status
  echo ''
  echo '── Service Status ──'
  docker compose -f docker-compose.prod.yml ps

  echo ''
  echo 'Deployed $TAG successfully.'
"

echo ""
echo "============================================"
echo "  Deployment complete: $TAG"
echo "============================================"
