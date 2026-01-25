
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testStatusLogic() {
    console.log("Starting Status Logic Test...");

    // Cleanup
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error("No Tenant");

    const store = await prisma.store.create({
        data: { name: "Status Test Store", tenantId: tenant.id }
    });

    const user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
    if (!user) throw new Error("No User");

    try {
        const today = new Date();
        const start = new Date(today); start.setHours(0, 0, 0, 0);
        const end = new Date(today); end.setHours(23, 59, 59, 999);

        console.log("1. Seeding Sale C (100) -> Status REFUNDED");
        const saleC = await prisma.sale.create({
            data: {
                tenantId: tenant.id, storeId: store.id, userId: user.id,
                total: 100,
                status: 'REFUNDED', // This simulates the issue
                payments: { create: [{ method: 'CASH', amount: 100 }] }
            }
        });

        console.log("2. Creating Return for Sale C (100)");
        await prisma.salesReturn.create({
            data: {
                tenantId: tenant.id, storeId: store.id, createdBy: user.id,
                saleId: saleC.id,
                total: 100,
                items: { create: [] } // Items don't matter for Revenue calc
            }
        });

        console.log("--- RUNNING LOGIC ---");

        // MIMIC NEW SERVICE LOGIC (Status NOT CANCELED)
        const sales = await prisma.sale.findMany({
            where: {
                tenantId: tenant.id, storeId: store.id,
                createdAt: { gte: start, lte: end },
                status: { notIn: ['CANCELED', 'CANCELLED', 'PENDING'] }
            },
            include: { items: true, payments: true }
        });

        const returns = await prisma.salesReturn.findMany({
            where: { tenantId: tenant.id, storeId: store.id, createdAt: { gte: start, lte: end } },
            include: { items: true, sale: { include: { payments: true, items: true } } }
        });

        let revenue = 0;
        sales.forEach(s => revenue += Number(s.total));
        returns.forEach(r => revenue -= Number(r.total));

        console.log(`Calculated Revenue: ${revenue}`);
        const expected = 0;

        if (Math.abs(revenue - expected) < 0.01) {
            console.log("✅ SUCCESS: Revenue is 0. (Grooss 100 - Refund 100).");
        } else {
            console.error(`❌ FAILURE: Revenue is ${revenue}. Likely Negative?`);
            console.log("This means the 'REFUNDED' sale was NOT fetched.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        // Cleanup based on storeId
        try {
            await prisma.salesReturnItem.deleteMany({ where: { return: { storeId: store.id } } });
            await prisma.salesReturn.deleteMany({ where: { storeId: store.id } });

            // Delete payments for sales in this store
            const salesInStore = await prisma.sale.findMany({ where: { storeId: store.id }, select: { id: true } });
            const saleIds = salesInStore.map(s => s.id);

            await prisma.salePayment.deleteMany({ where: { saleId: { in: saleIds } } });
            await prisma.sale.deleteMany({ where: { storeId: store.id } });
            await prisma.store.delete({ where: { id: store.id } });
        } catch (cleanupError) {
            console.log("Cleanup error ignored");
        }
        await prisma.$disconnect();
    }
}

testStatusLogic();
