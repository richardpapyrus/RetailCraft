---
description: How to start the application with auto-restart protection (PM2)
---

This workflow replaces the manual `npm run dev` commands with a robust process manager (PM2) that automatically restarts the servers if they crash.

Step 1: Stop any currently running terminals (Frontend/Backend).
Step 2: Start the robust ecosystem.
// turbo
npm start

Step 3: Monitor the logs (Optional)
npm run logs

Step 4: Stop the application when done
npm run stop
