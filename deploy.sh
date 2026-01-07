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
npx prisma migrate deploy

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
pm2 delete pos-api || true
pm2 delete pos-web || true

# Start API
echo "   Starting API..."
cd apps/api
pm2 start npm --name "pos-api" -- run start:prod

# Start Web (Production Mode)
echo "   Starting Web..."
cd ../../apps/web
pm2 start npm --name "pos-web" -- start

# Save PM2 List
pm2 save

echo "✅ Deployment Complete! System is online."
