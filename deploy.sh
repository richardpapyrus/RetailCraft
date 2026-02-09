#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

echo "🚀 Starting Automated Deployment for RetailCraft..."

# 1. Update Codebase
if [ -d ".git" ]; then
    echo "⬇️  Pulling latest changes..."
    git pull
else
    echo "⚠️  Not a git repository, skipping git pull."
fi

# 2. Install Dependencies (Recursive for Monorepo)
echo "📦 Installing Dependencies..."
npm install

# 3. Backend Deployment (API)
echo "🛠️  Deploying Backend (API)..."
cd apps/api

echo "   Running Database Migrations..."
# CRITICAL: This fixes the 500 Error by aligning the DB schema
npx prisma generate
npx prisma migrate deploy

echo "   🌱 Seeding Database (Ensuring Admin User exists)..."
npx prisma db seed

# Optional: Run User Restoration if script exists
if [ -f "../../scripts/restore-admin.js" ]; then
    echo "   👤 Running Admin Restoration Script..."
    node ../../scripts/restore-admin.js
fi

# Run Auto-Repair for Refunds (Critical Fix)
if [ -f "../../scripts/fix-missing-refunds.js" ]; then
    echo "   🔧 Running Refund Data Repair Script..."
    node ../../scripts/fix-missing-refunds.js
fi

echo "   Building API..."
npm run build

cd ../..

# 4. Frontend Deployment (Web)
echo "🛠️  Deploying Frontend (Web)..."
cd apps/web

echo "   Building Web App..."
npm run build

cd ../..

# 5. Restart Services
echo "🔄 Restarting Services..."

# Delete existing to clear cache/state issues
pm2 delete pos-api-prod || true
pm2 delete pos-web-prod || true

# Start Services using Ecosystem
echo "   Starting Services..."
pm2 start ecosystem.config.js --only pos-api-prod,pos-web-prod

# Save PM2 List
pm2 save

echo "✅ Deployment Complete! System is online."
