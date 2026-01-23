
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const poId = '04a1eaf4-9495-4c30-b810-da1100f775e6';
    const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId }
    });
    console.log("PO Tenant:", po?.tenantId);

    const grns = await prisma.goodsReceivedNote.findMany({
        include: { purchaseOrder: true }
    });
    console.log("Existing GRNs Tenants:", grns.map(g => ({ num: g.grnNumber, tenant: g.purchaseOrder.tenantId })));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
