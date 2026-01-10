
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('⚠️  STARTING BUSINESS DATA CLEANUP ⚠️');
    console.log('This will delete ALL Products, Inventory, Sales, and Transactions.');
    console.log('Settings, Users, Stores, and Tenants will remain intact.');

    // 0. PO & Supplier Data (Dependencies of Product/Supplier)
    console.log('0. Deleting PO/GRN Data...');
    await prisma.supplierReturnItem.deleteMany({});
    await prisma.supplierReturn.deleteMany({});
    await prisma.supplierInvoice.deleteMany({});
    await prisma.gRNItem.deleteMany({});
    await prisma.goodsReceivedNote.deleteMany({});
    await prisma.purchaseOrderItem.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.supplierProduct.deleteMany({});

    // 1. Transactional Data (Reverse dependencies first)
    console.log('1. Deleting Sales and Returns...');
    await prisma.salesReturnItem.deleteMany({});
    await prisma.salesReturn.deleteMany({});
    await prisma.saleItem.deleteMany({});
    await prisma.salePayment.deleteMany({}); // Added Payment
    await prisma.sale.deleteMany({});

    // 2. Financial Data
    console.log('2. Deleting Financial Sessions...');
    await prisma.cashTransaction.deleteMany({});
    await prisma.tillSession.deleteMany({});

    // 3. Inventory & Product Data
    console.log('3. Deleting Inventory and Products...');
    await prisma.inventoryEvent.deleteMany({});
    await prisma.inventory.deleteMany({});
    await prisma.product.deleteMany({});

    // Optional: Delete Suppliers if needed for full reset?
    // Let's keep Suppliers for now as they are "Master Data" often, 
    // but purely for PO test, maybe we want to recreate them?
    // The E2E test creates 'Acme Inc'. If it exists, it might duplicate or fail if unique name?
    // Schema: Supplier name is String (not unique).
    // So distinct 'Acme Inc's will pile up.
    // Let's delete Suppliers too.
    console.log('4. Deleting Suppliers...');
    await prisma.supplier.deleteMany({});

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
