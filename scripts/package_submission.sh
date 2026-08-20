#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROLL_NUMBER="${1:-SE23UCSE186}"
SOURCE_PREFIX="$ROOT/submission/$ROLL_NUMBER"
STAGE_ROOT="$ROOT/tmp/submission-package"
STAGE="$STAGE_ROOT/$ROLL_NUMBER"
OUT="$ROOT/submission/$ROLL_NUMBER.zip"

if [[ ! "$ROLL_NUMBER" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "Roll number may contain only letters, numbers, underscore, or hyphen." >&2
  exit 1
fi

for extension in pptx pdf mp4; do
  if [[ ! -f "$SOURCE_PREFIX.$extension" ]]; then
    echo "Missing source artifact: $SOURCE_PREFIX.$extension" >&2
    exit 1
  fi
done

mkdir -p "$STAGE/source"

rsync -a --delete \
  --exclude '.git/' \
  --exclude '.next/' \
  --exclude '.vinext/' \
  --exclude '.wrangler/' \
  --exclude 'dist/' \
  --exclude 'demo-dist/' \
  --exclude 'node_modules/' \
  --exclude 'backend/target/' \
  --exclude 'tmp/' \
  --exclude 'submission/' \
  --exclude '.env' \
  --exclude '.DS_Store' \
  "$ROOT/" "$STAGE/source/"

for extension in pptx pdf mp4; do
  cp "$SOURCE_PREFIX.$extension" "$STAGE/$ROLL_NUMBER.$extension"
done

(cd "$STAGE_ROOT" && zip -q -FS -r "$OUT" "$ROLL_NUMBER")

echo "Wrote $OUT"
