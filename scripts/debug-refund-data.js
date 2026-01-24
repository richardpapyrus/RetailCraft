
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
    const saleIdStart = '04cc8486';
    console.log(`Searching for Sale starting with: ${saleIdStart}...`);

    const sale = await prisma.sale.findFirst({
        where: { id: { startsWith: saleIdStart } },
        include: {
            user: true,
            store: true,
            tillSession: true,
            returns: true,
            payments: true
        }
    });

    if (!sale) {
        console.error("❌ Sale not found!");
        return;
    }

    console.log("\n=== SALE DATA ===");
    console.log(`ID: ${sale.id}`);
    console.log(`Payment Method (Raw): '${sale.paymentMethod}'`);
    console.log(`Total: ${sale.total}`);
    console.log(`User: ${sale.userId} (${sale.user.email})`);
    console.log(`Store: ${sale.storeId} (${sale.store.name})`);
    console.log(`Till Session ID (Sale Linked): ${sale.tillSessionId}`);

    console.log("\n=== PAYMENTS ===");
    sale.payments.forEach(p => {
        console.log(`- Method: '${p.method}', Amount: ${p.amount}`);
    });

    console.log("\n=== ACTIVE SESSION CHECK ===");
    // Simulate what ReturnsService does to find the session
    const activeSession = await prisma.tillSession.findFirst({
        where: {
            userId: sale.userId,
            status: "OPEN", // Logic looks for OPEN session
            till: { storeId: sale.storeId },
        },
        include: { till: true }
    });

    if (activeSession) {
        console.log(`✅ Found OPEN Session: ${activeSession.id}`);
        console.log(`   Opened At: ${activeSession.openedAt}`);
        console.log(`   Till: ${activeSession.till.name}`);
    } else {
        console.log("❌ NO OPEN SESSION FOUND for this User in this Store.");
        // Check for ANY session (closed?)
        const closedSession = await prisma.tillSession.findFirst({
            where: {
                userId: sale.userId,
                till: { storeId: sale.storeId },
            },
            orderBy: { openedAt: 'desc' }
        });
        if (closedSession) {
            console.log(`   (Found a CLOSED/Other session: ${closedSession.id} Status: ${closedSession.status})`);
        }
    }

    console.log("\n=== CASH TRANSACTIONS ===");
    // Check if any refund transaction was actually created for this session
    if (activeSession) {
        const txs = await prisma.cashTransaction.findMany({
            where: { tillSessionId: activeSession.id },
            orderBy: { createdAt: 'desc' }
        });
        console.log(`Found ${txs.length} transactions in the active session:`);
        txs.forEach(t => {
            console.log(`- [${t.type}] ${t.amount} (${t.reason})`);
        });
    }

}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
