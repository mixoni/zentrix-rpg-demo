#!/usr/bin/env bash
set -e

SERVICES=(
  account-service
  character-service
  combat-service
)

for s in "${SERVICES[@]}"; do
  echo "📦 Installing dependencies for $s"
  (cd services/$s && npm install)
done

echo "✅ All services installed"
