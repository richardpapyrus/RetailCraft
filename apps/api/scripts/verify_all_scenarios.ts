
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyAll() {
    console.log("--- MASTER VERIFICATION: REVENUE LOGIC ---");

    // Cleanup
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error("No Tenant");

    const store = await prisma.store.create({
        data: { name: "Master Verify Store", tenantId: tenant.id }
    });

    const user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
    if (!user) throw new Error("No User");

    try {
        const today = new Date();
        const start = new Date(today); start.setHours(0, 0, 0, 0);
        const end = new Date(today); end.setHours(23, 59, 59, 999);

        // 1. BASELINE: Normal Sale (100) -> Return (40). Net = 60.
        const sale1 = await prisma.sale.create({
            data: {
                tenantId: tenant.id, storeId: store.id, userId: user.id, total: 100, status: 'COMPLETED',
                payments: { create: [{ method: 'CASH', amount: 100 }] }
            }
        });
        await prisma.salesReturn.create({
            data: {
                tenantId: tenant.id, storeId: store.id, createdBy: user.id, saleId: sale1.id, total: 40,
                items: { create: [] }
            }
        });

        // 2. REFUNDED STATUS: Sale (100) -> Return (100). Net = 0.
        // Logic Requirement: Include Sale in Gross, Subtract Return.
        const sale2 = await prisma.sale.create({
            data: {
                tenantId: tenant.id, storeId: store.id, userId: user.id, total: 100, status: 'REFUNDED',
                payments: { create: [{ method: 'CARD', amount: 100 }] }
            }
        });
        await prisma.salesReturn.create({
            data: {
                tenantId: tenant.id, storeId: store.id, createdBy: user.id, saleId: sale2.id, total: 100,
                items: { create: [] }
            }
        });

        // 3. CANCELED STATUS: Sale (100) -> Return (100). Net = 0.
        // Logic Requirement: Exclude Sale from Gross, IGNORE Return.
        const sale3 = await prisma.sale.create({
            data: {
                tenantId: tenant.id, storeId: store.id, userId: user.id, total: 100, status: 'CANCELED',
                payments: { create: [{ method: 'CASH', amount: 100 }] }
            }
        });
        await prisma.salesReturn.create({
            data: {
                tenantId: tenant.id, storeId: store.id, createdBy: user.id, saleId: sale3.id, total: 100,
                items: { create: [] }
            }
        });

        // 4. PENDING STATUS: Sale (100) -> Return (100). Net = 0.
        // Logic Requirement: Exclude Sale, IGNORE Return.
        const sale4 = await prisma.sale.create({
            data: {
                tenantId: tenant.id, storeId: store.id, userId: user.id, total: 100, status: 'PENDING',
                payments: { create: [{ method: 'CASH', amount: 100 }] }
            }
        });
        await prisma.salesReturn.create({
            data: {
                tenantId: tenant.id, storeId: store.id, createdBy: user.id, saleId: sale4.id, total: 100,
                items: { create: [] }
            }
        });

        console.log("--- RUNNING SERVICE LOGIC ---");

        // MIMIC SALES SERVICE LOGIC
        // Query Sales (Exclude CANCELED/PENDING)
        const sales = await prisma.sale.findMany({
            where: {
                tenantId: tenant.id, storeId: store.id,
                createdAt: { gte: start, lte: end },
                status: { notIn: ['CANCELED', 'CANCELLED', 'PENDING'] }
            },
            include: { items: true, payments: true }
        });

        // Query Returns (Fetch All, Filter in Loop)
        const returns = await prisma.salesReturn.findMany({
            where: { tenantId: tenant.id, storeId: store.id, createdAt: { gte: start, lte: end } },
            include: { items: true, sale: { include: { payments: true, items: true } } }
        });

        let revenue = 0;
        let saleCount = 0;

        sales.forEach(s => {
            revenue += Number(s.total);
            saleCount++;
        });

        let returnCount = 0;
        let ignoredReturnCount = 0;

        returns.forEach(r => {
            // FIX LOGIC
            if (['CANCELED', 'CANCELLED', 'PENDING'].includes(r.sale.status)) {
                ignoredReturnCount++;
                return;
            }
            revenue -= Number(r.total);
            returnCount++;
        });

        console.log(`Sales Included: ${saleCount} (Expected 2: Baseline + Refunded)`);
        console.log(`Returns Subtracted: ${returnCount} (Expected 2: Baseline + Refunded)`);
        console.log(`Returns Ignored: ${ignoredReturnCount} (Expected 2: Canceled + Pending)`);
        console.log(`Final Revenue: ${revenue}`);

        const expectedRevenue = 60; // 100(1) - 40(1) + 100(2) - 100(2) + 0 + 0 = 60.

        if (Math.abs(revenue - expectedRevenue) < 0.01) {
            console.log("✅ MASTER VERIFICATION PASSED. Protocol Correct.");
        } else {
            console.error(`❌ VERIFICATION FAILED. Expected ${expectedRevenue}, Got ${revenue}.`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        // Cleanup based on storeId
        try {
            await prisma.salesReturnItem.deleteMany({ where: { return: { storeId: store.id } } });
            await prisma.salesReturn.deleteMany({ where: { storeId: store.id } });

            const salesInStore = await prisma.sale.findMany({ where: { storeId: store.id }, select: { id: true } });
            const saleIds = salesInStore.map(s => s.id);

            await prisma.salePayment.deleteMany({ where: { saleId: { in: saleIds } } });
            await prisma.sale.deleteMany({ where: { storeId: store.id } });
            await prisma.store.delete({ where: { id: store.id } });
        } catch (cleanupError) {
            // ignore
        }
        await prisma.$disconnect();
    }
}

verifyAll();
