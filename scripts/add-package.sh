#!/usr/bin/env bash
set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/add-package.sh <package> [--dev]"
  exit 1
fi

PACKAGE="$1"
MODE="$2"

SERVICES=(
  account-service
  character-service
  combat-service
)

for s in "${SERVICES[@]}"; do
  echo "➕ Adding $PACKAGE to $s"
  if [ "$MODE" == "--dev" ]; then
    (cd services/$s && npm install -D "$PACKAGE")
  else
    (cd services/$s && npm install "$PACKAGE")
  fi
done

echo "✅ Package added to all services"
