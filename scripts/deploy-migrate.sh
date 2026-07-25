#!/bin/bash
#
# Applies pending Prisma migrations to the database that a given pm2 app
# actually runs against.
#
# Why this exists: apps/api/.env is committed to the repo and rsynced to every
# server, so `prisma migrate deploy` reads its connection string from that one
# shared file. On 2026-02-10 that file was pointed at pos_db_staging, which
# meant production deploys silently migrated the staging database while the
# production API kept running against pos_db — so pos_db never received new
# tables. Reading the URL from ecosystem.config.js instead makes the migration
# target and the runtime target the same by construction: they now come from a
# single source, and cannot drift apart again.
#
# Usage: bash scripts/deploy-migrate.sh <pm2-app-name>
#   e.g. bash scripts/deploy-migrate.sh pos-api-prod

set -euo pipefail

APP_NAME="${1:?Usage: deploy-migrate.sh <pm2-app-name>}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ECOSYSTEM="${ROOT_DIR}/ecosystem.config.js"

if [ ! -f "$ECOSYSTEM" ]; then
  echo "ERROR: ecosystem.config.js not found at ${ECOSYSTEM}" >&2
  exit 1
fi

# Pull the connection string straight out of the pm2 app definition.
DATABASE_URL="$(
  node -e "
    const apps = require('${ECOSYSTEM}').apps || [];
    const app = apps.find(a => a.name === '${APP_NAME}');
    if (!app || !app.env || !app.env.DATABASE_URL) process.exit(1);
    process.stdout.write(app.env.DATABASE_URL);
  "
)" || {
  echo "ERROR: no DATABASE_URL defined for pm2 app '${APP_NAME}' in ecosystem.config.js" >&2
  echo "       Refusing to fall back to apps/api/.env — that is exactly the bug this guards against." >&2
  exit 1
}

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: resolved an empty DATABASE_URL for '${APP_NAME}'" >&2
  exit 1
fi

export DATABASE_URL

# Log the target with credentials masked, so the deploy log always shows which
# database was migrated without leaking the password.
echo "→ Migrating database for ${APP_NAME}: $(echo "$DATABASE_URL" | sed -E 's#//[^@]*@#//***:***@#')"

cd "${ROOT_DIR}/apps/api"

# Informational only: `migrate status` exits non-zero when migrations are
# pending, which is the normal case here, so it must not abort the deploy.
npx prisma migrate status || true

npx prisma migrate deploy

echo "✅ Migrations applied for ${APP_NAME}"
