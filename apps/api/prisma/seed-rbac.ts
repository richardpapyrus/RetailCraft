
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_ROLES = {
    ADMIN: {
        name: 'Administrator',
        description: 'Full access to all system features',
        permissions: ['*'], // Wildcard for full access
        isSystem: true
    },
    MANAGER: {
        name: 'Manager',
        description: 'Manage store operations, products, and inventory',
        permissions: [
            'MANAGE_PRODUCTS', 'MANAGE_INVENTORY', 'MANAGE_CUSTOMERS',
            'MANAGE_SUPPLIERS', 'VIEW_SALES', 'MANAGE_TILLS', 'VIEW_REPORTS'
        ],
        isSystem: true
    },
    CASHIER: {
        name: 'Cashier',
        description: 'Process sales and returns',
        permissions: ['PROCESS_SALES', 'PROCESS_RETURNS', 'VIEW_PRODUCTS', 'MANAGE_CUSTOMERS'], // Added MANAGE_CUSTOMERS for Cashiers too? Or keep separate?
        isSystem: true
    },
    SALES_ASSOCIATE: {
        name: 'Sales Associate',
        description: 'Sales and Customer Management',
        permissions: ['PROCESS_SALES', 'PROCESS_RETURNS', 'VIEW_PRODUCTS', 'MANAGE_CUSTOMERS'],
        isSystem: true
    }
};

async function main() {
    console.log('Starting RBAC Migration...');

    // 1. Get all tenants
    const tenants = await prisma.tenant.findMany();
    console.log(`Found ${tenants.length} tenants.`);

    for (const tenant of tenants) {
        console.log(`Processing Tenant: ${tenant.name} (${tenant.id})`);

        // 2. Create Default Roles for Tenant
        const rolesMap = new Map(); // RoleType -> RoleID

        for (const [key, def] of Object.entries(DEFAULT_ROLES)) {
            // Check if exists
            let role = await prisma.role.findFirst({
                where: { tenantId: tenant.id, name: def.name }
            });

            if (!role) {
                console.log(`  Creating role: ${def.name}`);
                role = await prisma.role.create({
                    data: {
                        name: def.name,
                        description: def.description,
                        permissions: def.permissions,
                        isSystem: def.isSystem,
                        tenantId: tenant.id
                    }
                });
            } else {
                console.log(`  Role ${def.name} already exists. Updating Permissions...`);
                // Force update permissions to ensure they match definition (Fix for Obinna)
                role = await prisma.role.update({
                    where: { id: role.id },
                    data: { permissions: def.permissions }
                });
            }
            rolesMap.set(key, role.id);
        }

        // 3. Migrate Users
        const users = await prisma.user.findMany({
            where: { tenantId: tenant.id }
        });

        for (const user of users) {
            if (user.roleId) continue; // Already migrated

            const targetRoleType = user.role || 'CASHIER'; // Default to Cashier if unknown
            const roleId = rolesMap.get(targetRoleType);

            if (roleId) {
                console.log(`  Migrating User ${user.email} (${targetRoleType}) -> Role ID: ${roleId}`);
                await prisma.user.update({
                    where: { id: user.id },
                    data: { roleId: roleId }
                });
            } else {
                console.warn(`  Unknown role type '${user.role}' for user ${user.email}, defaulting to Cashier.`);
                const cashierId = rolesMap.get('CASHIER');
                if (cashierId) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { roleId: cashierId }
                    });
                }
            }
        }
    }

    console.log('RBAC Migration Complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
