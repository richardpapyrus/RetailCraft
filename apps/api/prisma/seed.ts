import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('password', 10);

    // 1. Create Tenant (Idempotent)
    const tenant = await prisma.tenant.upsert({
        where: { id: 'default-tenant-id' }, // We need a fixed ID for upsert, or we findFirst
        update: {},
        create: {
            id: 'default-tenant-id',
            name: 'Local Demo Tenant',
        },
    });

    console.log('Ensure Tenant:', tenant.id);

    // 2. Create Store
    const store = await prisma.store.upsert({
        where: { id: 'default-store-id' },
        update: {},
        create: {
            id: 'default-store-id',
            name: 'Main Store - Local',
            tenantId: tenant.id,
        },
    });

    console.log('Ensure Store:', store.id);

    // 3. Create Administrator Role
    const adminRole = await prisma.role.upsert({
        where: {
            tenantId_name: {
                tenantId: tenant.id,
                name: 'Administrator'
            }
        },
        update: {},
        create: {
            name: 'Administrator',
            description: 'System Administrator - Full Access',
            permissions: ['*'],
            isSystem: true,
            tenantId: tenant.id
        }
    });

    console.log('Ensure Role: Administrator');

    // 4. Create Admin User
    await prisma.user.upsert({
        where: { email: 'admin@pos.local' },
        update: {
            roleId: adminRole.id // Ensure link is maintained
        },
        create: {
            email: 'admin@pos.local',
            password: hashedPassword,
            name: 'System Admin',

            roleId: adminRole.id,
            tenantId: tenant.id,
            storeId: store.id,
        },
    });

    console.log('Ensure User: admin@pos.local');

    // 4. Create Default Walk-in Customer
    await prisma.customer.upsert({
        where: { code: 'WALKIN' },
        update: {},
        create: {
            name: 'Walk-in Customer',
            code: 'WALKIN',
            tenantId: tenant.id,
            storeId: store.id
        }

    });

    // 5. Create "Unspecified" System Supplier
    await prisma.supplier.upsert({
        where: { id: 'unspecified-supplier' }, // Fixed ID handling? Supplier ID is uuid, but we can try to force one or findFirst
        // Actually ID field is string @id @default(uuid()). We can supply a string.
        update: { isSystem: true }, // Ensure system flag is set if exists
        create: {
            id: 'unspecified-supplier',
            name: 'Unspecified',
            tenantId: tenant.id,
            isSystem: true,
            email: 'system@retailcraft.com',
            phone: 'N/A',
            // storeId is optional, global
        }
    });
    console.log('Ensure Supplier: Unspecified');

    // 5. Enrichment: Run for ALL Tenants to ensure user sees data regardless of login

    // NOTE: Random Seed Data generation disabled for Production Baseline.
    // Uncomment lines below if test data is required.

    /*
    const supplierNames = [
        "Acme Corp", "Global Supplies", "Tech Distro", "Organic Farms", "Best Foods",
        "Quality Goods", "Prime Distribution", "Elite Sourcing", "Direct Imports", "Local Harvest",
        "Fresh Picks", "Metro Wholesalers", "Standard Supply", "Rapid Logistics", "Value Traders"
    ];
    const allTenants = await prisma.tenant.findMany();
    
    for (const t of allTenants) {
        // ... (truncated for cleanliness) ...
    }
    */
    console.log('Skipping Random Enrichment (Clean Baseline)');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
