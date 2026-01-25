
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugStatuses() {
    console.log("--- Debugging Live Sales Statuses ---");
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return;

    const today = new Date();
    const start = new Date(today); start.setHours(0, 0, 0, 0);
    const end = new Date(today); end.setHours(23, 59, 59, 999);

    console.log(`Range: ${start.toISOString()} - ${end.toISOString()}`);

    const sales = await prisma.sale.findMany({
        where: {
            tenantId: tenant.id,
            createdAt: { gte: start, lte: end }
        },
        select: { id: true, total: true, status: true, paymentMethod: true }
    });

    console.log(`Found ${sales.length} Sales Today:`);
    sales.forEach(s => {
        console.log(`- ID: ${s.id.slice(0, 8)} | Total: ${s.total} | Status: "${s.status}" | Method: ${s.paymentMethod}`);
    });

    // Also check Returns
    const returns = await prisma.salesReturn.findMany({
        where: { tenantId: tenant.id, createdAt: { gte: start, lte: end } },
        select: { id: true, total: true, saleId: true }
    });

    console.log(`Found ${returns.length} Returns Today:`);
    returns.forEach(r => {
        console.log(`- ID: ${r.id.slice(0, 8)} | Total: ${r.total} | SaleID: ${r.saleId.slice(0, 8)}`);
    });

    await prisma.$disconnect();
}

debugStatuses();
