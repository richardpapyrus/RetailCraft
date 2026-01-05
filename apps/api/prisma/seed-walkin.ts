import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        console.log("No tenant found.");
        return;
    }

    const exists = await prisma.customer.findFirst({
        where: { code: 'WALKIN', tenantId: tenant.id }
    });

    if (!exists) {
        const store = await prisma.store.findFirst({ where: { tenantId: tenant.id } });
        if (!store) {
            console.log("No store found for tenant.");
            return;
        }

        await prisma.customer.create({
            data: {
                name: 'Walk-in Customer',
                code: 'WALKIN',
                tenantId: tenant.id,
                storeId: store.id
            }
        });
        console.log("Created Walk-in Customer for Tenant:", tenant.name);
    } else {
        console.log("Walk-in Customer already exists.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
