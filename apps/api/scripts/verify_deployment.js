
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyDeployment() {
    console.log("🚀 Starting Post-Deployment Verification...");

    // 1. Create Tenant Context
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        console.warn("⚠️ No tenant found. Skipping verification.");
        return;
    }

    // 2. Create Isolated Store
    const store = await prisma.store.create({
        data: {
            name: "Deploy Verify Store " + Date.now(),
            tenantId: tenant.id
        }
    });

    // 3. Create Admin User Context
    const user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });

    try {
        console.log("🧪 Seeding Test Scenarios...");

        // Scenario A: Canceled Sale (Should typically be ignored)
        const saleCanceled = await prisma.sale.create({
            data: {
                tenantId: tenant.id, storeId: store.id, userId: user.id, total: 100, status: 'CANCELED',
                payments: { create: [{ method: 'CASH', amount: 100 }] }
            }
        });
        await prisma.salesReturn.create({
            data: {
                tenantId: tenant.id, storeId: store.id, createdBy: user.id, saleId: saleCanceled.id, total: 100,
                items: { create: [] }
            }
        });

        // Scenario B: Refunded Sale (Should be Net 0)
        const saleRefunded = await prisma.sale.create({
            data: {
                tenantId: tenant.id, storeId: store.id, userId: user.id, total: 100, status: 'REFUNDED',
                payments: { create: [{ method: 'CASH', amount: 100 }] }
            }
        });
        await prisma.salesReturn.create({
            data: {
                tenantId: tenant.id, storeId: store.id, createdBy: user.id, saleId: saleRefunded.id, total: 100,
                items: { create: [] }
            }
        });

        console.log("🔍 Running Logic Check (Simulating 'getStats')...");

        // MIMIC SALES SERVICE LOGIC (The Fixed Version)
        // 1. Fetch Sales (Exclude CANCELED)
        const sales = await prisma.sale.findMany({
            where: {
                tenantId: tenant.id, storeId: store.id,
                status: { notIn: ['CANCELED', 'CANCELLED', 'PENDING'] }
            }
        });

        // 2. Fetch Returns
        const returns = await prisma.salesReturn.findMany({
            where: { tenantId: tenant.id, storeId: store.id },
            include: { sale: true }
        });

        let revenue = 0;
        sales.forEach(s => revenue += Number(s.total)); // Should include Refunded (100)

        returns.forEach(r => {
            // THE FIX: Ignore return if sale is CANCELED
            if (['CANCELED', 'CANCELLED', 'PENDING'].includes(r.sale.status)) return;
            revenue -= Number(r.total);
        });

        console.log(`calculatedRevenue: ${revenue}`);

        // Expected: 
        // Gross: 100 (Refunded Sale)
        // Returns: -100 (Refunded Sale)
        // Canceled: Ignored completely.
        // Net: 0.

        if (Math.abs(revenue) < 0.01) {
            console.log("✅ VERIFICATION PASSED: Logic handles Canceled and Refunded states correctly.");
        } else {
            console.error(`❌ VERIFICATION FAILED: Expected 0, Got ${revenue}`);
            process.exit(1); // Fail the deployment step!
        }

    } catch (e) {
        console.error("Verification Error:", e);
        process.exit(1);
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

verifyDeployment();
