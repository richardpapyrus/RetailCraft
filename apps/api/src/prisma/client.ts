import { PrismaService } from "./prisma.service";

// One database client (and so one connection pool) for the whole API process.
// Services previously each did `new PrismaClient()`, opening ~22 separate pools
// against a cluster shared by prod and staging.
//
// Pool size comes from DATABASE_POOL_SIZE (set per app in ecosystem.config.js),
// default 10. A connection_limit already present in DATABASE_URL wins.
function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("connection_limit=")) return url;
  const size = parseInt(process.env.DATABASE_POOL_SIZE ?? "", 10);
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=${size > 0 ? size : 10}`;
}

const url = databaseUrl();

export const prisma = new PrismaService(url ? { datasources: { db: { url } } } : undefined);
