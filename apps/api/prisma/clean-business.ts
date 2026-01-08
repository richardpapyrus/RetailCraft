
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('⚠️  STARTING BUSINESS DATA CLEANUP ⚠️');
    console.log('This will delete ALL Products, Inventory, Sales, and Transactions.');
    console.log('Settings, Users, Stores, and Tenants will remain intact.');

    // 1. Transactional Data (Reverse dependencies first)
    console.log('1. Deleting Sales and Returns...');
    await prisma.salesReturnItem.deleteMany({});
    await prisma.salesReturn.deleteMany({});
    await prisma.saleItem.deleteMany({});
    await prisma.sale.deleteMany({}); // Cascades to Payment if linked, but Payment is usually embed or separate? 
    // Schema has 'status' and 'paymentMethod' on Sale, but no separate Payment table linked? 
    // Ah, 'CashTransaction' is separate.

    // 2. Financial Data
    console.log('2. Deleting Financial Sessions...');
    await prisma.cashTransaction.deleteMany({});
    await prisma.tillSession.deleteMany({});

    // 3. Inventory & Product Data
    console.log('3. Deleting Inventory and Products...');
    await prisma.inventoryEvent.deleteMany({});
    await prisma.inventory.deleteMany({});
    // Products depend on Suppliers maybe? No, Product->Supplier (optional).
    // But SalesReturnItem depends on Product. (Deleted above).
    // SaleItem depends on Product. (Deleted above).
    await prisma.product.deleteMany({});

    console.log('✅ Cleanup Complete. The system is ready for fresh data.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
