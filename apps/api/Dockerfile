FROM node:18-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json .
COPY turbo.json .
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Install dependencies (naive, optimize later with turbo prune)
RUN npm install

COPY . .

WORKDIR /app/apps/api
RUN npx prisma generate

CMD ["npm", "run", "start:dev"]
