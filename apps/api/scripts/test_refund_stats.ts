
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function regressionTest() {
    console.log("Starting Regression Test for Dashboard Stats (Improved)...");

    // Cleanup
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error("No Tenant");

    // Create Isolated Store for cleanliness
    const store = await prisma.store.create({
        data: { name: "Regression Store", tenantId: tenant.id }
    });

    // Create User
    const user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
    if (!user) throw new Error("No User");

    // Create Product
    const product = await prisma.product.create({
        data: {
            name: "Test Item",
            sku: `REG-${Date.now()}`,
            price: 50,
            costPrice: 20,
            tenantId: tenant.id,
            storeId: store.id
        }
    });

    try {
        const today = new Date();
        const start = new Date(today); start.setHours(0, 0, 0, 0);
        const end = new Date(today); end.setHours(23, 59, 59, 999);

        console.log("1. Seeding Sale A (2 Items @ 50 = 100)...");
        const saleA = await prisma.sale.create({
            data: {
                tenantId: tenant.id, storeId: store.id, userId: user.id,
                total: 100,
                status: 'COMPLETED',
                payments: { create: [{ method: 'CASH', amount: 100 }] },
                items: { create: [{ productId: product.id, quantity: 2, priceAtSale: 50, costAtSale: 20 }] }
            }
        });

        console.log("2. Seeding Sale B (1 Item @ 50 = 50)...");
        const saleB = await prisma.sale.create({
            data: {
                tenantId: tenant.id, storeId: store.id, userId: user.id,
                total: 50,
                status: 'COMPLETED',
                payments: { create: [{ method: 'CARD', amount: 50 }] },
                items: { create: [{ productId: product.id, quantity: 1, priceAtSale: 50, costAtSale: 20 }] }
            }
        });

        console.log("3. Returning Sale A Partial (1 Item @ 50)...");
        const returnA = await prisma.salesReturn.create({
            data: {
                tenantId: tenant.id, storeId: store.id, createdBy: user.id,
                saleId: saleA.id,
                total: 50,
                items: { create: [{ productId: product.id, quantity: 1, restock: true, refundAmount: 50 }] }
            }
        });

        console.log("--- RUNNING VERIFICATION QUERY ---");

        // MIMIC SALES SERVICE LOGIC EXACTLY
        const sales = await prisma.sale.findMany({
            where: { tenantId: tenant.id, storeId: store.id, createdAt: { gte: start, lte: end } },
            include: { items: true, payments: true }
        });
        const returns = await prisma.salesReturn.findMany({
            where: { tenantId: tenant.id, storeId: store.id, createdAt: { gte: start, lte: end } },
            include: { items: true, sale: { include: { payments: true, items: true } } }
        });

        let revenue = 0;
        let cost = 0;
        let breakdown: any = { CASH: 0, CARD: 0 };

        sales.forEach(s => {
            revenue += Number(s.total);
            s.payments.forEach(p => breakdown[p.method] = (breakdown[p.method] || 0) + Number(p.amount));
            s.items.forEach(i => cost += Number(i.costAtSale) * i.quantity);
        });

        returns.forEach(r => {
            const refund = Number(r.total);
            revenue -= refund;

            // Payment De-allocation
            const sale = r.sale;
            const totalPaid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
            sale.payments.forEach(p => {
                const ratio = Number(p.amount) / totalPaid;
                breakdown[p.method] -= refund * ratio;
            });

            // Cost Reversal
            r.items.forEach(ri => {
                if (ri.restock) {
                    const orig = sale.items.find(i => i.productId === ri.productId);
                    if (orig) cost -= Number(orig.costAtSale) * ri.quantity;
                }
            });
        });

        console.log(`Calculated Revenue: ${revenue}`);
        console.log(`Calculated Cost: ${cost}`);
        console.log(`Calculated Profit: ${revenue - cost}`);
        console.log(`Breakdown:`, breakdown);

        const expectedRevenue = 100;
        const expectedProfit = 60;

        let success = true;

        if (Math.abs(revenue - expectedRevenue) < 0.01) {
            console.log("✅ Revenue Logic Correct");
        } else {
            console.error(`❌ Revenue Logic FAILED. Expected ${expectedRevenue}, Got ${revenue}`);
            success = false;
        }

        if (Math.abs((revenue - cost) - expectedProfit) < 0.01) {
            console.log("✅ Profit Logic Correct");
        } else {
            console.error(`❌ Profit Logic FAILED. Expected ${expectedProfit}, Got ${revenue - cost}`);
            success = false;
        }

        // Cash should be 100 paid - 50 returned (Sale A was Cash) = 50.
        // Card should be 50 paid = 50.
        // Total Breakdwon = 100. Matches Revenue.
        if (Math.abs(breakdown.CASH - 50) < 0.01 && Math.abs(breakdown.CARD - 50) < 0.01) {
            console.log("✅ Payment Breakdown Correct");
        } else {
            console.error(`❌ Payment Breakdown FAILED.`, breakdown);
            success = false;
        }

    } catch (e) {
        console.error("Test Logic Error:", e);
    } finally {
        // Cleanup (Best Effort)
        try {
            console.log("Cleaning up...");
            await prisma.salesReturnItem.deleteMany({ where: { return: { storeId: store.id } } });
            await prisma.salesReturn.deleteMany({ where: { storeId: store.id } });

            // Payments link to Sales, Sales link to Store
            // We need to find Sales first to delete Payments? 
            // Prisma Relation Mode matches DB. Usually Cascade or Restrict.
            // If Restrict, we must delete payments first.

            // Delete payments for sales in this store
            const salesInStore = await prisma.sale.findMany({ where: { storeId: store.id }, select: { id: true } });
            const saleIds = salesInStore.map(s => s.id);

            await prisma.salePayment.deleteMany({ where: { saleId: { in: saleIds } } });
            await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });

            await prisma.sale.deleteMany({ where: { storeId: store.id } });

            await prisma.inventoryEvent.deleteMany({ where: { storeId: store.id } });
            await prisma.inventory.deleteMany({ where: { storeId: store.id } });

            // Product links to Tenant/Store
            // Can't delete product if it's referenced in archived sales? We deleted sales.
            await prisma.product.deleteMany({ where: { storeId: store.id } });

            await prisma.store.deleteMany({ where: { id: store.id } });
            console.log("Cleanup Complete.");
        } catch (cleanupError) {
            console.warn("Cleanup failed (Test data might remain):", cleanupError.message);
        }
        await prisma.$disconnect();
    }
}

regressionTest();
