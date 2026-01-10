
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const STORE_ID = "dbfc8fb6-01b2-4362-add3-3b3bbef7653e"; // Branch Store
const SUPPLIER_ID = "de59a31f-15ce-4130-949e-2481e1d77270"; // Chileme (in dbfc...)
const PRODUCT_ID = "a1543162-9bd5-4fd1-9d41-735ee3dde808"; // NEW NEW (in dbfc...)
const USER_ID = "461b283f-cb9f-45f0-a839-d65fedf6b0e2";
const TENANT_ID = "default-tenant-id"; // Assuming default, or I should fetch it.

async function main() {
    // Fetch Tenant ID from Store
    const store = await prisma.store.findUnique({ where: { id: STORE_ID } });
    if (!store) throw new Error("Store not found");

    const poNumber = 'PO-' + Date.now();

    console.log("Attempting to create PO with:", {
        storeId: STORE_ID,
        supplierId: SUPPLIER_ID,
        productId: PRODUCT_ID,
        userId: USER_ID,
        tenantId: store.tenantId
    });

    try {
        const po = await prisma.purchaseOrder.create({
            data: {
                poNumber,
                status: 'DRAFT',
                supplier: { connect: { id: SUPPLIER_ID } },
                store: { connect: { id: STORE_ID } },
                tenant: { connect: { id: store.tenantId } },
                user: { connect: { id: USER_ID } },
                notes: "Debug PO",
                totalAmount: 1950.00,
                items: {
                    create: [{
                        product: { connect: { id: PRODUCT_ID } },
                        quantityOrdered: 13,
                        unitCost: 150,
                        totalCost: 1950
                    }]
                }
            },
            include: { items: true }
        });
        console.log("✅ Success! PO Created:", po.id);
    } catch (e) {
        console.error("❌ Failed!");
        console.error(e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
