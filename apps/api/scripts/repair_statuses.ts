
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function repairStatuses() {
    console.log("🛠️ STARTING SALES STATUS REPAIR...");

    // 1. Find all sales that have returns but are NOT "COMPLETED"
    const salesWithReturns = await prisma.sale.findMany({
        where: {
            returns: { some: {} },
            status: { not: 'COMPLETED' }
        },
        include: { returns: true }
    });

    console.log(`Found ${salesWithReturns.length} sales with Returns that are NOT Completed.`);

    let updated = 0;
    for (const sale of salesWithReturns) {
        // Skip if Canceled/Voided (These SHOULD be excluded)
        if (["CANCELED", "CANCELLED", "VOID", "PENDING"].includes(sale.status.toUpperCase())) {
            console.log(`Skipping Sale #${sale.id.slice(0, 8)} (Status: ${sale.status}) - Correctly Excluded.`);
            continue;
        }

        // If it's REFUNDED or PARTIALLY_REFUNDED, change to COMPLETED
        // ensuring they are counted in Gross Revenue.
        await prisma.sale.update({
            where: { id: sale.id },
            data: { status: 'COMPLETED' }
        });
        console.log(`✅ Fixed Sale #${sale.id.slice(0, 8)}: "${sale.status}" -> "COMPLETED"`);
        updated++;
    }

    console.log(`\n Repair Complete. Updated ${updated} sales.`);
    console.log("Please hard-refresh your dashboard.");
    await prisma.$disconnect();
}

repairStatuses();
