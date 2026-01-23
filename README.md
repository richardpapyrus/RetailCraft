# Enterprise Retail POS (Local-First)

## Prerequisites
- Node.js (LTS)
- Docker Desktop
- npm

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install      # Install root dependencies (if any)
   npm install -w apps/api
   npm install -w apps/web
   ```

2. **Start Infrastructure**
   ```bash
   docker compose up -d postgres redis
   ```

3. **Initialize Database**
   ```bash
   cd apps/api
   npx prisma generate
   npx prisma migrate dev --name init
   ```

4. **Start Applications**
   You can start everything with Docker Compose or locally.

   **Option A: Docker Compose (All-in-one)**
   ```bash
   docker compose up --build
   ```

   **Option B: Local Development**
   - API: `cd apps/api && npm run start:dev` (Port 4000)
   - Web: `cd apps/web && npm run dev` (Port 3000)

## Project Structure
- `apps/api`: NestJS Backend
- `apps/web`: Next.js Frontend
- `apps/docs`: Next.js Documentation (Port 3001)
- `docker/`: Docker configurations

## Documentation
For detailed guides on how to use the POS system, run the documentation app:
```bash
cd apps/docs && npm run dev
```
Then visit [http://localhost:3001](http://localhost:3001).
