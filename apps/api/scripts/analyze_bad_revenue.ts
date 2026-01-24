
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// IDs from Screenshot 2
const TARGET_IDS = [
    "a1c3893b",
    "416b5d4e",
    "dec451f5",
    "cf389e8e",
    "581cfa04",
    "da0988fc",
    "bf76a888",
    "ad472dfb"
];

async function analyze() {
    console.log("--- ANALYZING TARGET SALES ---");
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return;

    let totalGross = 0;
    let totalRefunds = 0;

    // Scan recent sales instead of targets
    console.log("Scanning recent 100 sales...");
    const sales = await prisma.sale.findMany({
        where: { tenantId: tenant.id },
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: { returns: true }
    });

    for (const sale of sales) {
        const sTotal = Number(sale.total);
        if (sale.returns.length === 0) continue;

        const rTotal = sale.returns.reduce((sum, r) => sum + Number(r.total), 0);
        const isExcluded = ["CANCELED", "CANCELLED", "PENDING", "VOID"].includes(sale.status); // Extended check

        if (isExcluded) {
            console.log(`[!] FOUND CANDIDATE: Sale #${sale.id.slice(0, 8)}`);
            console.log(`    Status: "${sale.status}" (Excluded)`);
            console.log(`    Refunds: ${rTotal} (Should be Ignored)`);

            // In OLD logic, this would be -rTotal.
            // In NEW logic, this should be 0.
            totalRefunds += rTotal;
        }
    }

    console.log("--- SUMMARY FOR THESE ITEMS ---");
    console.log(`Gross Included: ${totalGross}`);
    console.log(`Refunds Subtracted: ${totalRefunds}`);
    console.log(`Net Revenue: ${totalGross - totalRefunds}`);
    console.log("If this matches your -1100, then we know why.");

    await prisma.$disconnect();
}

analyze();
