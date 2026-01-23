
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const productId = '023eaa12-423d-4835-9287-24b11f7ccd66';
    const product = await prisma.product.findUnique({
        where: { id: productId }
    });

    console.log("Product:", product);
    if (product) {
        console.log("Cost:", product.costPrice);
        console.log("Price:", product.price);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
