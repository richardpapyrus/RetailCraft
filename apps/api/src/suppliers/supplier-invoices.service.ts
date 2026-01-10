
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class SupplierInvoicesService {
    // Create Invoice linked to PO
    async create(data: {
        poId: string;
        invoiceNumber: string;
        amount: number;
        dueDate?: Date;
    }) {
        const po = await prisma.purchaseOrder.findUnique({ where: { id: data.poId } });
        if (!po) throw new Error("PO not found");

        // 3-Way Match Check (Basic Warning)
        // In a real system, we would compare sum(GRN) vs Invoice Amount
        // For now, we allow creation but could flag mismatch
        const isMismatch = data.amount !== Number(po.totalAmount);

        return prisma.supplierInvoice.create({
            data: {
                poId: data.poId,
                invoiceNumber: data.invoiceNumber,
                amount: data.amount,
                dueDate: data.dueDate,
                status: isMismatch ? 'DISPUTED' : 'PENDING' // Auto-flag mismatch
            }
        });
    }

    async findAll(storeId: string) {
        // Find invoices for POs belonging to this store
        return prisma.supplierInvoice.findMany({
            where: { purchaseOrder: { storeId } },
            include: { purchaseOrder: true }
        });
    }
}
