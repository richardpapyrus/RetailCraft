
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugStats() {
    try {
        console.log("--- Debugging Dashboard Stats ---");

        // 1. Get Tenant ID (Assuming first one found or specific one)
        const tenant = await prisma.tenant.findFirst();
        if (!tenant) {
            console.error("No tenant found!");
            return;
        }
        console.log(`Tenant: ${tenant.name} (${tenant.id})`);

        // 2. Define Time Range (Today)
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        console.log(`Range: ${start.toISOString()} to ${end.toISOString()}`);


        // Seed Test Data
        const store = await prisma.store.findFirst({ where: { tenantId: tenant.id } });
        const user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });

        if (!store || !user) {
            console.log("Skipping seed (no store/user)");
        } else {
            console.log("Seeding Test Transaction...");
            // 1. Create Sale
            const sale = await prisma.sale.create({
                data: {
                    tenantId: tenant.id,
                    storeId: store.id,
                    userId: user.id,
                    total: 100.00,
                    status: 'COMPLETED',
                    paymentMethod: 'CASH',
                    payments: {
                        create: [{ method: 'CASH', amount: 100.00 }] // New Multi-Tender Structure
                    }
                }
            });
            console.log(`Created Sale: ${sale.id} ($100)`);

            // 2. Create Return
            const ret = await prisma.salesReturn.create({
                data: {
                    tenantId: tenant.id,
                    storeId: store.id,
                    createdBy: user.id,
                    saleId: sale.id,
                    total: 40.00
                }
            });
            console.log(`Created Return: ${ret.id} ($40)`);
        }

        // 3. Fetch Sales (Gross)
        const sales = await prisma.sale.findMany({
            where: {
                tenantId: tenant.id,
                status: 'COMPLETED',
                createdAt: { gte: start, lte: end }
            },
            include: { payments: true }
        });

        console.log(`\nFound ${sales.length} Sales today.`);
        let grossRevenue = 0;
        sales.forEach(s => {
            console.log(`- Sale ${s.id.slice(0, 8)}: ${s.total} (${s.paymentMethod})`);
            grossRevenue += Number(s.total);
        });
        console.log(`Gross Revenue: ${grossRevenue.toFixed(2)}`);


        // 4. Fetch Returns (Standalone)
        const returns = await prisma.salesReturn.findMany({
            where: {
                tenantId: tenant.id,
                createdAt: { gte: start, lte: end }
            },
            include: { sale: true }
        });

        console.log(`\nFound ${returns.length} Returns today.`);
        let totalRefunds = 0;
        returns.forEach(r => {
            console.log(`- Return ${r.id.slice(0, 8)} (for Sale ${r.sale.id.slice(0, 8)}): ${r.total}`);
            totalRefunds += Number(r.total);
        });
        console.log(`Total Refunds: ${totalRefunds.toFixed(2)}`);

        // 5. Net Calculation
        const netRevenue = grossRevenue - totalRefunds;
        console.log(`\nNET REVENUE CALCULATION:`);
        console.log(`${grossRevenue.toFixed(2)} (Gross) - ${totalRefunds.toFixed(2)} (Refunds) = ${netRevenue.toFixed(2)} (Net)`);

        console.log("\nIf this matches your dashboard, the math is correct.");
        console.log("If the dashboard shows Gross Revenue, then the code on server is likely outdated or not running this logic.");

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

debugStats();
