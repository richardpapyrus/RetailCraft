
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { prisma } from "../prisma/client"; // shared pool (was new PrismaClient())

const PO_LIST_INCLUDE = {
    supplier: true,
    user: { select: { id: true, name: true } },
};

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

        // Detect "Unassigned" -> Map to System Vendor
        let finalSupplierId = data.supplierId;
        if (data.supplierId === 'unassigned') {
            const systemVendor = await prisma.supplier.findFirst({
                where: {
                    tenantId: data.tenantId,
                    name: 'Unregistered Supplier'
                }
            });

            if (systemVendor) {
                finalSupplierId = systemVendor.id;
            } else {
                const newVendor = await prisma.supplier.create({
                    data: {
                        name: 'Unregistered Supplier',
                        tenantId: data.tenantId,
                        termDays: 0,
                        contact: 'System Generated'
                    }
                });
                finalSupplierId = newVendor.id;
            }
        }

        // 2. Calculate Total
        const totalAmount = data.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

        return prisma.purchaseOrder.create({
            data: {
                poNumber,
                status: 'DRAFT',
                supplier: { connect: { id: finalSupplierId } },
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
    // `user` is narrowed to id/name: the full row carried the password hash and invitation token.
    async findAll(tenantId: string, storeId?: string, status?: string) {
        return prisma.purchaseOrder.findMany({
            where: this.listWhere(tenantId, storeId, status),
            include: PO_LIST_INCLUDE,
            orderBy: { createdAt: 'desc' }
        });
    }

    // Paged variant of findAll — one page from the DB plus a total, instead of every PO ever raised.
    async findPage(tenantId: string, page: number, limit: number, storeId?: string, status?: string) {
        const where = this.listWhere(tenantId, storeId, status);
        const [data, total] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where,
                include: PO_LIST_INCLUDE,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.purchaseOrder.count({ where }),
        ]);
        return { data, total };
    }

    private listWhere(tenantId: string, storeId?: string, status?: string) {
        const where: any = { tenantId };
        if (storeId) where.storeId = storeId;
        if (status) where.status = status;
        return where;
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
