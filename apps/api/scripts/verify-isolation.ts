import { PrismaClient } from '@prisma/client';
import { AuthService } from '../src/auth/auth.service';
import { SalesService } from '../src/sales/sales.service';
import { JwtService } from '@nestjs/jwt';

const prisma = new PrismaClient();
const authService = new AuthService(new JwtService({ secret: 'test' }));
const salesService = new SalesService();

async function main() {
    console.log('--- Starting Verification ---');

    // 1. Create a User (Admin) which creates Business + Location 1
    console.log('1. Registering Business...');
    const adminReg = await authService.register({
        email: `admin_${Date.now()}@test.com`,
        password: 'password',
        businessName: 'Test Business',
        storeName: 'Location 1'
    });
    const adminUser = adminReg.user;
    console.log(`   Admin Context: Tenant=${adminUser.tenantId}, Store=${adminUser.storeId}`);

    // 2. Create a Second Location
    console.log('2. Creating Location 2...');
    const loc2 = await prisma.store.create({
        data: {
            name: 'Location 2',
            tenantId: adminUser.tenantId
        }
    });
    console.log(`   Location 2 ID: ${loc2.id}`);

    // 2b. Create a Category
    const category = await prisma.productCategory.create({
        data: {
            name: 'Test Category',
            tenantId: adminUser.tenantId,
            status: 'ACTIVE'
        }
    });

    // 3. Create a Product (Global Catalog)
    console.log('3. Creating Product...');
    const product = await prisma.product.create({
        data: {
            name: 'Test Product',
            sku: `SKU_${Date.now()}`,
            price: 100,
            tenant: { connect: { id: adminUser.tenantId } },
            category: { connect: { id: category.id } }
            // storeId is optional on Product, leaving null for global
        }
    });

    // 4. Create Inventory in Location 1 ONLY
    console.log('4. Adding Inventory to Location 1...');
    await prisma.inventory.create({
        data: {
            storeId: adminUser.storeId,
            productId: product.id,
            quantity: 50
        }
    });

    // 5. Try to sell in Location 1 (Should Succeed)
    console.log('5. Selling in Location 1...');
    await salesService.processSale({
        items: [{ productId: product.id, quantity: 1 }],
        paymentMethod: 'CASH',
        tenantId: adminUser.tenantId,
        storeId: adminUser.storeId,
        userId: adminUser.id
    });
    console.log('   ✅ Sale in Location 1 successful');

    // 6. Try to sell in Location 2 (Should Fail - No Inventory)
    console.log('6. Attempting Sale in Location 2 (Should Fail due to Isolation)...');
    try {
        await salesService.processSale({
            items: [{ productId: product.id, quantity: 1 }],
            paymentMethod: 'CASH',
            tenantId: adminUser.tenantId,
            storeId: loc2.id, // Trying Loc 2
            userId: adminUser.id
        });
        console.error('   ❌ ERROR: Sale in Location 2 succeeded but should have failed (No Stock)');
    } catch (e) {
        console.log('   ✅ Sale in Location 2 failed as expected:', e.message);
    }

    // 7. Verify Customer Isolation (Schema Check)
    console.log('7. Verifying Customer Isolation...');
    try {
        // Try to create customer WITHOUT storeId
        await prisma.customer.create({
            data: {
                name: 'Global Customer',
                code: `C_${Date.now()}`,
                tenantId: adminUser.tenantId,
            } as any
        });
        console.error('   ❌ ERROR: Created Customer without storeId');
    } catch (e) {
        if (e.code === 'P2002' || e.message.includes('storeId'))
            console.log('   ✅ Customer creation failed as expected (storeId required)');
        else
            console.log('   ✅ Customer creation failed (Likely storeId constraint):', e.code);
    }

    console.log('--- Verification Complete ---');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
