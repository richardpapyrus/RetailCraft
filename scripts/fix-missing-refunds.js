
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Scanning for Missing Refund Transactions...");

    // 1. Get all returns
    const returns = await prisma.salesReturn.findMany({
        include: {
            sale: true,
            user: true
        }
    });

    console.log(`Found ${returns.length} total returns.`);
    let fixedCount = 0;

    for (const ret of returns) {
        // Check if original sale was CASH
        const pm = (ret.sale.paymentMethod || '').trim().toUpperCase();
        const isCash = pm === 'CASH' || pm === 'SPLIT';

        if (!isCash) {
            // console.log(`⏩ Skipping Return ${ret.id} (Payment Method: ${pm})`);
            continue;
        }

        // Find Session Active at Return Time
        // Logic: Same User, Same Store.
        // Opened <= ReturnTime AND (Closed >= ReturnTime OR Closed is NULL)
        const session = await prisma.tillSession.findFirst({
            where: {
                userId: ret.createdBy,
                till: { storeId: ret.storeId },
                openedAt: { lte: ret.createdAt },
                OR: [
                    { closedAt: { gte: ret.createdAt } },
                    { closedAt: null }
                ]
            }
        });

        if (!session) {
            console.log(`⚠️ Warning: No Till Session found for Return ${ret.id} (User: ${ret.createdBy}, Time: ${ret.createdAt.toISOString()})`);
            continue;
        }

        // Check for existing Cash Transaction linked to this session matching properties
        // We match by amount and type CASH_OUT.
        // And ideally created around the same time? Or linked by reasoning?
        // Reason in code was: `Refund for Sale #${sale.id.slice(0, 8)}`

        const expectedReasonStart = `Refund for Sale #${ret.saleId.slice(0, 8)}`;

        const existingTx = await prisma.cashTransaction.findFirst({
            where: {
                tillSessionId: session.id,
                type: 'CASH_OUT',
                amount: ret.total,
                // We use relaxed check on reason or simply existence if matches amount/type
                // reason: { startsWith: expectedReasonStart }
            }
        });

        if (existingTx) {
            // Found it, logic worked (or was manually fixed)
            // console.log(`✅ Return ${ret.id} has transaction ${existingTx.id}.`);
            continue;
        }

        console.log(`🛠️ Fixing Return ${ret.id} (Sale: ${ret.saleId}, Amount: ${ret.total}, Session: ${session.id})...`);

        // Create Transaction
        await prisma.cashTransaction.create({
            data: {
                tillSessionId: session.id,
                type: 'CASH_OUT',
                amount: ret.total,
                reason: `Refund for Sale #${ret.saleId.slice(0, 8)} (Auto-Fix)`,
                description: `Retroactive Fix for Missing Refund Transaction`,
                createdAt: ret.createdAt // Backdate it to match return time
            }
        });

        // RECALCULATE Session totals if closed
        if (session.status === 'CLOSED') {
            await recalculateSession(session.id);
        }

        fixedCount++;
    }

    console.log(`\n🎉 Fix Complete. Repaired ${fixedCount} missing transactions.`);
}

async function recalculateSession(sessionId) {
    const session = await prisma.tillSession.findUnique({ where: { id: sessionId } });

    // Aggregates
    const sales = await prisma.sale.aggregate({
        where: { tillSessionId: sessionId, paymentMethod: { equals: "CASH", mode: "insensitive" } },
        _sum: { total: true }
    });

    const cashIn = await prisma.cashTransaction.aggregate({
        where: { tillSessionId: sessionId, type: "CASH_IN" },
        _sum: { amount: true }
    });

    const cashOut = await prisma.cashTransaction.aggregate({
        where: { tillSessionId: sessionId, type: "CASH_OUT" },
        _sum: { amount: true }
    });

    const totalSales = Number(sales._sum.total || 0);
    const totalCashIn = Number(cashIn._sum.amount || 0);
    const totalCashOut = Number(cashOut._sum.amount || 0);

    const opening = Number(session.openingFloat);
    const closing = Number(session.closingCash || 0);

    const expected = opening + totalSales + totalCashIn - totalCashOut;
    const variance = closing - expected;

    // Update
    await prisma.tillSession.update({
        where: { id: sessionId },
        data: {
            expectedCash: expected,
            variance: variance
        }
    });
    console.log(`   Updated Session ${sessionId}: Expected=${expected}, Variance=${variance}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
