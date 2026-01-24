
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
    console.log("🕵️‍♂️ Diagnosing Latest Return Logic...");

    // 1. Get Latest Return
    const ret = await prisma.salesReturn.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
            sale: true,
            user: true,
            store: true,
            tenant: true
        }
    });

    if (!ret) {
        console.error("❌ No SalesReturn found in database.");
        return;
    }

    console.log(`\n📅 Latest Return: ${ret.id}`);
    console.log(`   Created At: ${ret.createdAt.toISOString()}`);
    console.log(`   User: ${ret.createdBy} (${ret.user.email})`);
    console.log(`   Store: ${ret.storeId} (${ret.store.name})`);
    console.log(`   Sale ID: ${ret.saleId}`);

    // 2. Analyze Payment Method Logic
    const rawMethod = ret.sale.paymentMethod;
    const pm = (rawMethod || '').trim().toUpperCase();
    const isCashCalc = pm === 'CASH' || pm === 'SPLIT';

    console.log(`\n💳 Payment Method Checks:`);
    console.log(`   Raw: '${rawMethod}'`);
    console.log(`   Normalized: '${pm}'`);
    console.log(`   Is Cash?: ${isCashCalc}`);

    if (!isCashCalc) {
        console.log("   ❌ Condition FAILED: Payment method is not CASH/SPLIT.");
    } else {
        console.log("   ✅ Condition PASSED: Payment method is valid.");
    }

    // 3. Analyze Till Session Logic
    console.log(`\n🏦 Till Session Lookup:`);
    console.log(`   Searching for Session with:`);
    console.log(`   - UserId: ${ret.createdBy}`);
    console.log(`   - Status: OPEN`);
    console.log(`   - StoreId: ${ret.storeId}`);

    const tillSession = await prisma.tillSession.findFirst({
        where: {
            userId: ret.createdBy,
            status: "OPEN",
            till: { storeId: ret.storeId },
        },
        include: { till: true }
    });

    if (tillSession) {
        console.log(`   ✅ FOUND Session: ${tillSession.id}`);
        console.log(`      Opened At: ${tillSession.openedAt}`);
        console.log(`      Till: ${tillSession.till.name}`);
    } else {
        console.log(`   ❌ NO OPEN SESSION FOUND.`);

        // Debug: Why?
        // Check if ANY session exists for this user/store
        const anySession = await prisma.tillSession.findFirst({
            where: { userId: ret.createdBy, till: { storeId: ret.storeId } },
            orderBy: { createdAt: 'desc' }
        });

        if (anySession) {
            console.log(`      (Latest session found was status: '${anySession.status}', closed at: ${anySession.closedAt})`);
        } else {
            console.log(`      (User has NEVER had a session in this store)`);
        }
    }

    // 4. Final Verdict
    if (tillSession && isCashCalc) {
        const tx = await prisma.cashTransaction.findFirst({
            where: {
                tillSessionId: tillSession.id,
                type: 'CASH_OUT',
                amount: ret.total,
                reason: { contains: ret.saleId.slice(0, 8) }
            }
        });

        if (tx) {
            console.log(`\n🎉 CONCLUSION: Transaction EXISTS (${tx.id}). Everything looks correct.`);
        } else {
            console.log(`\n⚠️ CONCLUSION: Logic says 'SHOULD CREATE', but Transaction is MISSING in DB?`);
            console.log(`   This implies the Code Fix was NOT active at the time, or a transaction failure occurred.`);
        }
    } else {
        console.log(`\n🛑 CONCLUSION: Logic skipped creation because conditions failed.`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
