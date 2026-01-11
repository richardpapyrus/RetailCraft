
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const pos = await prisma.purchaseOrder.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { supplier: true, store: true }
    });

    console.log("Recent POs:");
    console.log(JSON.stringify(pos, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
