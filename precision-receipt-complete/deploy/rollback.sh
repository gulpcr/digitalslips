#!/bin/bash
set -euo pipefail

# ============================================================
# rollback.sh — Roll back to a previous release tag
# Usage: ./rollback.sh <TAG>
#
# Examples:
#   ./rollback.sh v1.0.0        # Rollback to v1.0.0
#   ./rollback.sh               # Lists available tags
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Configuration ──
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

TAG="${1:-}"

# ── No tag provided: list available tags ──
if [ -z "$TAG" ]; then
  echo "Usage: ./rollback.sh <TAG>"
  echo ""
  echo "Available backend image tags:"
  gcloud artifacts docker tags list "$REGISTRY/backend" \
    --format="table[box](tag, version.name.basename())" 2>/dev/null || \
  gcloud artifacts docker images list "$REGISTRY/backend" --include-tags \
    --format="table(TAGS)" 2>/dev/null || \
  echo "  (Could not list tags — check gcloud auth and project config)"
  echo ""

  # Show current release on VM
  echo "Current release on VM:"
  gcloud compute ssh "$VM_NAME" --zone="$VM_ZONE" --command="
    cat $REMOTE_DIR/.release 2>/dev/null || echo '  (unknown)'
  " 2>/dev/null || echo "  (VM unreachable)"

  exit 1
fi

echo "============================================"
echo "  Precision Receipt — Rollback"
echo "============================================"
echo "  Rolling back to: $TAG"
echo "  Registry:        $REGISTRY"
echo "  VM:              $VM_NAME ($VM_ZONE)"
echo "============================================"

# ── Verify tag exists ──
echo ""
echo ">> Verifying tag $TAG exists in registry..."
if ! gcloud artifacts docker images list "$REGISTRY/backend" --include-tags --format="value(TAGS)" 2>/dev/null | grep -q "$TAG"; then
  echo "WARNING: Tag '$TAG' may not exist in registry. Proceeding anyway (docker pull will fail if missing)."
fi

# ── Rollback on VM ──
echo ""
echo ">> Rolling back $VM_NAME to $TAG..."
gcloud compute ssh "$VM_NAME" --zone="$VM_ZONE" --command="
  cd $REMOTE_DIR

  # Record rollback
  PREV_TAG=\$(grep RELEASE_TAG .release 2>/dev/null | cut -d= -f2 || echo 'unknown')
  echo 'RELEASE_TAG=$TAG' > .release
  echo 'Rolled back from: '\$PREV_TAG >> .release
  echo 'Rolled back at: $(date -u +%Y-%m-%dT%H:%M:%SZ)' >> .release

  # Set env
  export RELEASE_TAG=$TAG
  export REGISTRY=$REGISTRY

  # Source production env
  if [ -f .env.prod ]; then
    set -a; source .env.prod; set +a
  fi

  # Pull the old images and restart
  docker compose -f docker-compose.prod.yml pull
  docker compose -f docker-compose.prod.yml up -d

  # Show status
  echo ''
  echo '── Service Status ──'
  docker compose -f docker-compose.prod.yml ps

  echo ''
  echo 'Rolled back to $TAG successfully.'
"

echo ""
echo "============================================"
echo "  Rollback complete: $TAG"
echo "============================================"
