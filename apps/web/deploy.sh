#!/bin/bash
set -e

echo "🛑 Stopping pos-web..."
pm2 stop pos-web || true

echo "🧹 Cleaning .next directory..."
rm -rf .next
rm -rf .swc

echo "🏗️ Building..."
npm run build

echo "✅ Build complete. Restarting..."
pm2 restart pos-web

echo "🚀 Deployment finished."
