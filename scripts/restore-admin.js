
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');

// Try loading from .env in root or current dir
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });

const prisma = new PrismaClient();

async function main() {
    const email = 'richardiweanoge@gmail.com';
    const password = 'password123'; // Temporary password
    console.log(`Checking for user: ${email}...`);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        console.log("User already exists. Determining Reset...");
        // Optionally update password if needed
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });
        console.log(`Password reset to '${password}'`);
        return;
    }

    console.log("User not found. Re-creating...");

    // 1. Find Tenant/Store (Assume defaults exist from seed)
    const tenant = await prisma.tenant.findFirst();
    const store = await prisma.store.findFirst();
    const role = await prisma.role.findFirst({ where: { name: 'Administrator' } });

    if (!tenant || !store || !role) {
        throw new Error("Critical: Default Tenant, Store, or Admin Role not found. Has seeding run?");
    }

    // 2. Create User
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            name: 'Richard Iweanoge',
            roleId: role.id,
            tenantId: tenant.id,
            storeId: store.id
        }
    });

    console.log(`✅ User '${newUser.email}' created successfully.`);
    console.log(`Credentials: ${email} / ${password}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
