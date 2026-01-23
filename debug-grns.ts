
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const grns = await prisma.goodsReceivedNote.findMany({
        orderBy: { grnNumber: 'desc' }
    });
    console.log("Existing GRNs:", grns.map(g => g.grnNumber));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
