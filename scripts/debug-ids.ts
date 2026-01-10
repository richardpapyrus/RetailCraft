
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const store = await prisma.store.findFirst({ where: { name: { contains: 'Branch' } } });
    const supplier = await prisma.supplier.findFirst({ where: { name: { contains: 'Chileme' } } });
    const product = await prisma.product.findFirst({ where: { name: { contains: 'NEW' } } });
    const user = await prisma.user.findFirst({ where: { roleDef: { name: 'Administrator' } } });

    console.log('Store Match:', store?.id, store?.name);
    console.log('Supplier:', supplier?.id, supplier?.name, 'StoreId:', supplier?.storeId);
    console.log('Product:', product?.id, product?.name, 'StoreId:', product?.storeId);
    console.log('User:', user?.id, user?.email);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
