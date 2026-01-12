
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding Local Data...');

    // 1. Get Tenant (Assuming seed.ts ran, otherwise find ANY tenant)
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        console.log('Creating Default Tenant...');
        tenant = await prisma.tenant.create({
            data: { name: 'Local Demo Tenant' }
        });
    }

    // 2. Create Categories
    const categoriesData = ['Electronics', 'Clothing', 'Home', 'Groceries'];
    const categories = [];

    for (const name of categoriesData) {
        let cat = await prisma.productCategory.findFirst({
            where: { tenantId: tenant.id, name }
        });
        if (!cat) {
            cat = await prisma.productCategory.create({
                data: {
                    name,
                    tenantId: tenant.id,
                    status: 'ACTIVE'
                }
            });
        }
        categories.push(cat);
        console.log(`Ensured Category: ${cat.name}`);
    }

    // 3. Create Products
    const productsData = [
        { name: 'Wireless Mouse', price: 29.99, sku: 'MOUSE001', catIndex: 0 },
        { name: 'Mechanical Keyboard', price: 99.99, sku: 'KEYB001', catIndex: 0 },
        { name: 'Cotton T-Shirt', price: 15.00, sku: 'SHIRT001', catIndex: 1 },
        { name: 'Jeans', price: 45.00, sku: 'JEAN001', catIndex: 1 },
        { name: 'Coffee Mug', price: 9.99, sku: 'MUG001', catIndex: 2 },
        { name: 'Apples (1kg)', price: 4.50, sku: 'APPLE001', catIndex: 3 },
        { name: 'Milk (1L)', price: 1.20, sku: 'MILK001', catIndex: 3 },
    ];

    for (const p of productsData) {
        const category = categories[p.catIndex];
        const existing = await prisma.product.findFirst({
            where: { sku: p.sku, tenantId: tenant.id }
        });

        if (!existing) {
            await prisma.product.create({
                data: {
                    name: p.name,
                    sku: p.sku,
                    price: p.price,
                    tenantId: tenant.id,
                    categoryId: category.id
                }
            });
            console.log(`Created Product: ${p.name}`);
        } else {
            // Optional: Update category if missing
            if (!existing.categoryId) {
                await prisma.product.update({
                    where: { id: existing.id },
                    data: { categoryId: category.id }
                });
                console.log(`Updated Product Category: ${p.name}`);
            }
        }
    }

    console.log('✅ Seeding Complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
