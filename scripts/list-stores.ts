
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const stores = await prisma.store.findMany();
    console.log('Available Stores:');
    stores.forEach(s => {
        console.log(`- ${s.name} (${s.id})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
