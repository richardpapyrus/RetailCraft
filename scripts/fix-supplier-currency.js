#!/usr/bin/env node
//
// Relabels suppliers that were saved with the schema default currency (USD)
// instead of their tenant's currency. Run by the "Fix Supplier Currency"
// GitHub Action — see .github/workflows/fix-supplier-currency.yml.
//
// Only the system-generated "Unregistered Supplier" is changed. Other
// mismatched suppliers are listed but left alone: they may genuinely be
// foreign-currency suppliers and need a human decision.
//
// PO totals are plain numbers that take their currency label from the
// supplier, so this changes how they display, never the amounts.
//
// Usage: node scripts/fix-supplier-currency.js <pm2-app-name> [--apply]
//   Without --apply nothing is written (preview only).

const path = require('path');

const APP_NAME = process.argv[2];
const APPLY = process.argv.includes('--apply');

if (!APP_NAME) {
  console.error('Usage: node scripts/fix-supplier-currency.js <pm2-app-name> [--apply]');
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
process.env.DATABASE_URL = url;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log(`→ Database for ${APP_NAME}: ${url.replace(/\/\/[^@]*@/, '//***:***@')}`);
  console.log(APPLY ? '→ Mode: APPLY (changes will be saved)\n' : '→ Mode: PREVIEW (nothing will be changed)\n');

  const suppliers = await prisma.supplier.findMany({
    include: {
      tenant: { select: { name: true, currency: true } },
      _count: { select: { purchaseOrders: true } },
    },
    orderBy: { name: 'asc' },
  });
  const mismatched = suppliers.filter((s) => s.currency !== s.tenant.currency);

  if (mismatched.length === 0) {
    console.log('✅ Every supplier already matches its business currency. Nothing to do.');
    return;
  }

  const toFix = mismatched.filter((s) => s.name === 'Unregistered Supplier');
  const toReview = mismatched.filter((s) => s.name !== 'Unregistered Supplier');

  const line = (s) =>
    `   • ${s.tenant.name} — "${s.name}": ${s.currency} → should be ${s.tenant.currency} (${s._count.purchaseOrders} purchase orders)`;

  if (toFix.length) {
    console.log(`Will fix automatically (${toFix.length}):`);
    toFix.forEach((s) => console.log(line(s)));
    console.log('');
  }
  if (toReview.length) {
    console.log(`Different currency from the business — NOT changed, check these by hand in Suppliers (${toReview.length}):`);
    toReview.forEach((s) => console.log(line(s)));
    console.log('');
  }

  if (!APPLY) {
    console.log('Preview only. Run the action again with "apply" to save the fix.');
    return;
  }

  for (const s of toFix) {
    await prisma.supplier.update({ where: { id: s.id }, data: { currency: s.tenant.currency } });
    console.log(`✅ Fixed: ${s.tenant.name} — "${s.name}" is now ${s.tenant.currency}`);
  }
  console.log(`\nDone. ${toFix.length} supplier(s) updated.`);
}

main()
  .catch((err) => {
    console.error('❌ Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
