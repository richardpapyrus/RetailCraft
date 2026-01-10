
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class SupplierReturnsService {
    // Create RTS
    async create(data: {
        supplierId: string;
        storeId: string;
        items: { productId: string; quantity: number }[];
        reason?: string;
    }) {
        return prisma.$transaction(async (tx) => {
            const returnNumber = `RTS-${Date.now()}`; // Simple generation

            const rts = await tx.supplierReturn.create({
                data: {
                    returnNumber,
                    supplierId: data.supplierId,
                    storeId: data.storeId,
                    reason: data.reason,
                    status: 'PENDING',
                    items: {
                        create: data.items.map(i => ({
                            productId: i.productId,
                            quantity: i.quantity
                        }))
                    }
                }
            });

            // Decrement Inventory IMMEDIATELY or upon Completion? 
            // Usually upon shipping. For simplicity we assume 'created' = 'shipped' for now 
            // or we add a 'ship' method. 
            // Let's stick to strict: Create Pending -> Ship (execute).

            return rts;
        });
    }

    async execute(id: string) {
        return prisma.$transaction(async (tx) => {
            const rts = await tx.supplierReturn.findUnique({ where: { id }, include: { items: true } });
            if (!rts || rts.status !== 'PENDING') throw new Error("Invalid RTS");

            for (const item of rts.items) {
                await tx.inventory.update({
                    where: { storeId_productId: { storeId: rts.storeId, productId: item.productId } },
                    data: { quantity: { decrement: item.quantity } }
                });

                await tx.inventoryEvent.create({
                    data: {
                        type: 'RETURN', // Supplier Return
                        quantity: -item.quantity,
                        storeId: rts.storeId,
                        productId: item.productId,
                        reason: `RTS: ${rts.returnNumber}`
                    }
                });
            }

            return tx.supplierReturn.update({ where: { id }, data: { status: 'COMPLETED' } });
        });
    }
}
