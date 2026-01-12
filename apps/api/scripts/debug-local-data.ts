
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to DB...');
    try {
        const products = await prisma.product.findMany({ take: 1 });
        const users = await prisma.user.findMany({ include: { tenant: true } });
        const tenants = await prisma.tenant.findMany();

        console.log('--- DIAGNOSTIC RESULT ---');
        console.log(`Total Tenants: ${tenants.length}`);
        tenants.forEach(t => console.log('Tenant:', t.id, t.name));

        console.log(`Total Users: ${users.length}`);
        users.forEach(u => console.log('User:', u.email, 'Tenant:', u.tenantId));

        console.log(`Total Products in DB: ${await prisma.product.count()}`);
        if (products.length > 0) {
            console.log('Sample Product Tenant:', products[0].tenantId);
        }
    } catch (e) {
        console.error('Error connecting to DB:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
