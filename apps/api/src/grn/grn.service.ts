
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class GrnService {

    // Receive Goods
    async receive(data: {
        poId: string;
        userId: string;
        storeId: string; // Must match PO store
        items: {
            productId: string;
            quantityReceived: number;
            costPrice?: number;
            sellingPrice?: number;
            batchNumber?: string;
            expiryDate?: Date
        }[];
        notes?: string;
    }) {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id: data.poId },
            include: { items: true }
        });

        if (!po) throw new NotFoundException("PO not found");
        if (po.storeId !== data.storeId) throw new BadRequestException("Store Mismatch: Cannot receive PO from another store");
        if (po.status !== 'SENT' && po.status !== 'PARTIALLY_RECEIVED') throw new BadRequestException(`PO Status ${po.status} is not valid for receiving`);

        // Transaction: Create GRN + Update Inventory + Update PO
        return prisma.$transaction(async (tx) => {
            // 1. Generate GRN Number (Tenant-wide to avoid collisions)
            const count = await tx.goodsReceivedNote.count({ where: { purchaseOrder: { tenantId: po.tenantId } } });
            const grnNumber = `GRN-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

            // 2. Create GRN
            const grn = await tx.goodsReceivedNote.create({
                data: {
                    grnNumber,
                    poId: data.poId,
                    receivedBy: data.userId,
                    storeId: data.storeId,
                    notes: data.notes,
                    items: {
                        create: data.items.map(item => ({
                            productId: item.productId,
                            quantityReceived: item.quantityReceived,
                            batchNumber: item.batchNumber,
                            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null
                        }))
                    }
                }
            });

            let poFullyReceived = true;

            // 3. Update Inventory & PO Items
            for (const receivedItem of data.items) {
                // A. Increment Inventory
                await tx.inventory.upsert({
                    where: { storeId_productId: { storeId: data.storeId, productId: receivedItem.productId } },
                    update: { quantity: { increment: receivedItem.quantityReceived } },
                    create: { storeId: data.storeId, productId: receivedItem.productId, quantity: receivedItem.quantityReceived }
                });

                // B. Log Event
                await tx.inventoryEvent.create({
                    data: {
                        type: 'RECEIVE',
                        quantity: receivedItem.quantityReceived,
                        storeId: data.storeId,
                        productId: receivedItem.productId,
                        userId: data.userId,
                        reason: `GRN: ${grnNumber}`,
                        supplierId: po.supplierId
                    }
                });

                // B2. Update Product Pricing (New Feature)
                if (receivedItem.costPrice !== undefined && receivedItem.sellingPrice !== undefined) {
                    await tx.product.update({
                        where: { id: receivedItem.productId },
                        data: {
                            costPrice: receivedItem.costPrice,
                            price: receivedItem.sellingPrice
                        }
                    });
                }

                // C. Update Supplier Cost (Tracking)
                const costToUse = receivedItem.costPrice !== undefined ? receivedItem.costPrice : (po.items.find(p => p.productId === receivedItem.productId)?.unitCost || 0);

                await tx.supplierProduct.updateMany({
                    where: { supplierId: po.supplierId, productId: receivedItem.productId },
                    data: { lastCost: costToUse }
                });

                // D. Update PO Item
                const poItem = po.items.find(p => p.productId === receivedItem.productId);
                if (poItem) {
                    const newTotal = poItem.quantityReceived + receivedItem.quantityReceived;
                    await tx.purchaseOrderItem.update({
                        where: { id: poItem.id },
                        data: { quantityReceived: newTotal }
                    });

                    if (newTotal < poItem.quantityOrdered) poFullyReceived = false;
                }
            }

            // Check for remaining un-received items in PO
            const receivedIds = data.items.map(i => i.productId);
            const hiddenPending = po.items.filter(p => !receivedIds.includes(p.productId) && p.quantityReceived < p.quantityOrdered);
            if (hiddenPending.length > 0) poFullyReceived = false;

            // 4. Update PO Status
            const newStatus = poFullyReceived ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED';
            await tx.purchaseOrder.update({
                where: { id: po.id },
                data: { status: newStatus }
            });

            return grn;
        });
    }

    async findAll(storeId: string) {
        return prisma.goodsReceivedNote.findMany({
            where: { storeId },
            include: { user: true, purchaseOrder: true },
            orderBy: { receivedDate: 'desc' }
        });
    }
}
