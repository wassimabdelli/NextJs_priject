#!/usr/bin/env bash
# Démarre MongoDB (si besoin) puis Next.js en mode dev.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! mongosh --quiet mongodb://localhost:27017 --eval 'db.runCommand({ping:1})' >/dev/null 2>&1; then
  echo "→ Démarrage MongoDB (mongod --config /opt/homebrew/etc/mongod.conf)"
  mongod --config /opt/homebrew/etc/mongod.conf >>/tmp/syndicpro-mongod.log 2>&1 &
  sleep 2
fi

echo "→ npm run dev"
exec npm run dev
