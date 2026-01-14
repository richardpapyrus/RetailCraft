FROM node:18-slim

RUN apt-get update -y && apt-get install -y openssl python3 make g++

WORKDIR /app

COPY package.json .
COPY turbo.json .
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Install dependencies
RUN npm install

COPY . .

WORKDIR /app/apps/api
RUN npx prisma generate

RUN npm run build

CMD ["npm", "run", "start:prod"]
