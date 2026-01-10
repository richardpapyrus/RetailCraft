
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class PurchaseOrdersService {

    // Create PO (Draft)
    async create(data: {
        supplierId: string;
        storeId: string;
        tenantId: string;
        userId: string;
        items: { productId: string; quantity: number; unitCost: number }[];
        notes?: string;
    }) {
        // 1. Generate PO Number (Safe Approach: Max + 1)
        // Sort by poNumber desc to handle out-of-order creation dates
        const lastPO = await prisma.purchaseOrder.findFirst({
            where: { tenantId: data.tenantId },
            orderBy: { poNumber: 'desc' }
        });

        let nextNumber = 1;
        if (lastPO && lastPO.poNumber) {
            const parts = lastPO.poNumber.split('-');
            const lastSeq = parseInt(parts[parts.length - 1]);
            if (!isNaN(lastSeq)) {
                nextNumber = lastSeq + 1;
            }
        }

        const poNumber = `PO-${new Date().getFullYear()}-${nextNumber.toString().padStart(4, '0')}`;
        console.log(`[PO Service] Generating PO Number. Last: ${lastPO?.poNumber || 'None'}. Next: ${poNumber}`);

        // 2. Calculate Total
        const totalAmount = data.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

        return prisma.purchaseOrder.create({
            data: {
                poNumber,
                status: 'DRAFT',
                supplier: { connect: { id: data.supplierId } },
                store: { connect: { id: data.storeId } },
                tenant: { connect: { id: data.tenantId } },
                user: { connect: { id: data.userId } },
                notes: data.notes,
                totalAmount,
                items: {
                    create: data.items.map(item => ({
                        product: { connect: { id: item.productId } },
                        quantityOrdered: item.quantity,
                        unitCost: item.unitCost,
                        totalCost: item.quantity * item.unitCost
                    }))
                }
            },
            include: { items: true }
        });
    }

    // Find All (Store Filtered)
    async findAll(tenantId: string, storeId?: string, status?: string) {
        const where: any = { tenantId };
        if (storeId) where.storeId = storeId;
        if (status) where.status = status;

        return prisma.purchaseOrder.findMany({
            where,
            include: { supplier: true, user: true },
            orderBy: { createdAt: 'desc' }
        });
    }

    // Find One
    async findOne(id: string, tenantId: string) {
        const po = await prisma.purchaseOrder.findFirst({
            where: { id, tenantId },
            include: {
                supplier: true,
                items: { include: { product: true } },
                grns: true
            }
        });
        if (!po) throw new NotFoundException("Purchase Order not found");
        return po;
    }

    // Update Status (e.g. DRAFT -> SENT)
    async updateStatus(id: string, status: string, tenantId: string) {
        return prisma.purchaseOrder.update({
            where: { id }, // In prod valid tenantId check
            data: { status }
        });
    }
}
