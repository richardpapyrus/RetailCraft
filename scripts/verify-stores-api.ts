
import * as dotenv from 'dotenv';
dotenv.config();

console.log('Environment loaded.');
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
    console.log("🚀 Verifying via Prisma Directly...");

    // 1. List All Users
    const users = await prisma.user.findMany();
    console.log(`found ${users.length} users:`);

    for (const u of users) {
        console.log(`- ${u.name} (${u.email}) [ID: ${u.id}]`);
        console.log(`  Tenant: ${u.tenantId}`);
        console.log(`  RoleID: ${u.roleId}`);

        const stores = await prisma.store.findMany({ where: { tenantId: u.tenantId } });
        console.log(`  Stores: ${stores.length}`);
        stores.forEach(s => console.log(`    * ${s.name} (ID: ${s.id})`));
        console.log('---');
    }
}

verify()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
