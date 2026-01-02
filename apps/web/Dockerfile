FROM node:18-alpine

WORKDIR /app

COPY package.json .
COPY turbo.json .
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN npm install

COPY . .

WORKDIR /app/apps/web

CMD ["npm", "run", "dev"]
