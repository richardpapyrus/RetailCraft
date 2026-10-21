#!/usr/bin/env node
//
// Builds the database indexes listed in scripts/proposed-indexes.sql. Run by the
// "Apply Database Indexes" GitHub Action — see .github/workflows/apply-indexes.yml.
//
// Safe to run any number of times:
//   - every statement is CREATE INDEX CONCURRENTLY IF NOT EXISTS, so an index
//     that already exists is skipped, and building one never blocks sales;
//   - anything else in the file is refused before a single statement runs;
//   - an index left INVALID by an interrupted earlier build is dropped and rebuilt.
// Indexes change no data and no query results, only how fast rows are found.
//
// CONCURRENTLY cannot run inside a transaction, which is why this sends the
// statements one by one instead of going through `prisma migrate`.
//
// The repo is public, so Action logs are too: output names only the database
// and the indexes, never any business data.
//
// Usage: node scripts/apply-indexes.js <pm2-app-name> [--dry-run]
//   --dry-run reports what would be built without building anything.

const fs = require('fs');
const path = require('path');

const APP_NAME = process.argv[2];
const DRY_RUN = process.argv.includes('--dry-run');
const SQL_FILE = path.join(__dirname, 'proposed-indexes.sql');

if (!APP_NAME) {
  console.error('Usage: node scripts/apply-indexes.js <pm2-app-name> [--dry-run]');
  process.exit(1);
}

// Pull the statements out of the SQL file and refuse anything that isn't an
// additive, non-blocking index build.
const CREATE = /^CREATE INDEX CONCURRENTLY IF NOT EXISTS "([A-Za-z0-9_]+)"\s+ON "([A-Za-z0-9_]+)" \("[A-Za-z0-9_]+"(?:, "[A-Za-z0-9_]+")*\)$/;
const statements = fs.readFileSync(SQL_FILE, 'utf8')
  .split('\n')
  .map((line) => line.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);

const indexes = [];
for (const sql of statements) {
  const m = sql.match(CREATE);
  if (!m) {
    console.error(`ERROR: refusing to run a statement that is not "CREATE INDEX CONCURRENTLY IF NOT EXISTS":\n   ${sql}`);
    process.exit(1);
  }
  indexes.push({ name: m[1], table: m[2], sql });
}
if (indexes.length === 0) {
  console.error(`ERROR: no index statements found in ${path.basename(SQL_FILE)}.`);
  process.exit(1);
}

// Same rule as scripts/deploy-migrate.sh: the database comes from the pm2 app
// definition, never from the committed apps/api/.env.
const apps = require(path.join(__dirname, '..', 'ecosystem.config.js')).apps || [];
const app = apps.find((a) => a.name === APP_NAME);
const url = app && app.env && app.env.DATABASE_URL;
if (!url) {
  console.error(`ERROR: no DATABASE_URL for pm2 app '${APP_NAME}' in ecosystem.config.js. Refusing to guess.`);
  process.exit(1);
}
// One connection: keeps clear of the cluster's connection limit.
process.env.DATABASE_URL = url + (url.includes('?') ? '&' : '?') + 'connection_limit=1';

// Resolve the client the API itself uses (hoisted to the root or inside apps/api).
const { PrismaClient } = require(
  require.resolve('@prisma/client', { paths: [path.join(__dirname, '..', 'apps', 'api')] })
);
const prisma = new PrismaClient();

async function indexState(name) {
  const rows = await prisma.$queryRaw`
    SELECT i.indisvalid AS valid
    FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
    WHERE c.relname = ${name}`;
  if (rows.length === 0) return 'missing';
  return rows[0].valid ? 'ok' : 'invalid';
}

async function main() {
  console.log(`→ Database for ${APP_NAME}: ${new URL(url).pathname.slice(1)}`);
  console.log(DRY_RUN ? '→ Mode: DRY RUN (nothing will be built)\n' : '→ Mode: APPLY\n');

  let built = 0, skipped = 0, failed = 0;
  for (const idx of indexes) {
    const state = await indexState(idx.name);
    if (state === 'ok') {
      console.log(`   ✓ ${idx.name} — already in place`);
      skipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(`   • ${idx.name} — would be ${state === 'invalid' ? 'rebuilt (left broken by an earlier run)' : 'built'}`);
      continue;
    }
    try {
      const started = Date.now();
      if (state === 'invalid') {
        await prisma.$executeRawUnsafe(`DROP INDEX CONCURRENTLY IF EXISTS "${idx.name}"`);
      }
      await prisma.$executeRawUnsafe(idx.sql);
      console.log(`   ✅ ${idx.name} — built in ${((Date.now() - started) / 1000).toFixed(1)}s`);
      built++;
    } catch (err) {
      // Carry on with the rest; a re-run picks this one up again.
      console.error(`   ❌ ${idx.name} — failed: ${err.message.split('\n').pop()}`);
      failed++;
    }
  }

  console.log(`\nDone. ${built} built, ${skipped} already in place, ${failed} failed (of ${indexes.length}).`);
  if (failed) {
    console.log('Re-run the action to retry the failed ones; finished indexes are skipped.');
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('❌ Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
