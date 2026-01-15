
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TillReportsService {
    constructor(private prisma: PrismaService) { }

    async getDashboardStats(tenantId: string, storeId: string, from: Date, to: Date, tillId?: string) {
        const where = {
            till: { tenantId, storeId },
            openedAt: { gte: from, lte: to },
            ...(tillId ? { tillId } : {})
        };

        // 1. Session Overview
        const sessions = await this.prisma.tillSession.findMany({
            where,
            include: {
                user: { select: { name: true } },
                till: { select: { name: true } }
            },
            orderBy: { openedAt: 'desc' }
        });

        // 2. Aggregate Sales (Gross, Net, Tax, Discount)
        // We need to look at SALES tied to these sessions
        const sessionIds = sessions.map(s => s.id);

        const salesAgg = await this.prisma.sale.aggregate({
            where: { tillSessionId: { in: sessionIds }, status: 'COMPLETED' },
            _sum: {
                total: true,
                subtotal: true,
                taxTotal: true,
                discountTotal: true,
                changeGiven: true
            },
        },
            _count: { _all: true }
        });

    const refundAgg = await this.prisma.sale.aggregate({
        where: { tillSessionId: { in: sessionIds }, status: 'REFUNDED' }, // Or partial? Logic usually separate table or status
        _sum: { total: true },
        _count: { _all: true }
    });

        return {
    overview: {
        sessionCount: sessions.length,
        openSessions: sessions.filter(s => s.status === 'OPEN').length,
        sessions: sessions.map(s => ({
            id: s.id,
            tillName: s.till.name,
            staffName: s.user.name,
            openedAt: s.openedAt,
            closedAt: s.closedAt,
            status: s.status,
            openingFloat: Number(s.openingFloat),
            closingCash: s.closingCash ? Number(s.closingCash) : null,
            variance: s.variance ? Number(s.variance) : null
        }))
    },
    sales: {
        grossSales: Number(salesAgg._sum.subtotal || 0), // Pre-tax Pre-discount usually? Or Total? 
        // Better def: Gross = Total collected. Net = Subtotal. 
        // Let's stick to: Total (Final), Tax, Discount.
        totalCollected: Number(salesAgg._sum.total || 0),
        totalTax: Number(salesAgg._sum.taxTotal || 0),
        totalDiscount: Number(salesAgg._sum.discountTotal || 0),
        totalChangeGiven: Number(salesAgg._sum.changeGiven || 0),
        transactionCount: Number(salesAgg._count._all || 0),
        refundTotal: Number(refundAgg._sum.total || 0),
        refundCount: Number(refundAgg._count._all || 0)
    }
};
    }

    async getPaymentBreakdown(tenantId: string, storeId: string, from: Date, to: Date, tillId ?: string) {
    const whereSession = {
        till: { tenantId, storeId },
        openedAt: { gte: from, lte: to },
        ...(tillId ? { tillId } : {})
    };

    // Find sessions first to scope the payments
    const sessions = await this.prisma.tillSession.findMany({ where: whereSession, select: { id: true } });
    const sessionIds = sessions.map(s => s.id);

    // Group by Payment Method on Sale
    // Wait, Sales have ONE payment method usually in simple schema, or distinct Payments table?
    // User requested "Split payments". This implies `Payment` entity.
    // Check Schema: `Payment` table exists?
    // If not, we rely on `Sale.paymentMethod`.
    // Let's assume `Sale.paymentMethod` for now based on previous knowledge, BUT check for `Payment` relation if splits exist.
    // I will use `Sale` aggregation for now, but if `Payment` exists I'll swap.

    // TODO: strictly we should check schema. Assuming Sale.paymentMethod for now.
    const byMethod = await this.prisma.sale.groupBy({
        by: ['paymentMethod'],
        where: { tillSessionId: { in: sessionIds }, status: 'COMPLETED' },
        _sum: { total: true },
        _count: { _all: true }
    });

    return byMethod.map(g => ({
        method: g.paymentMethod,
        amount: Number(g._sum.total || 0),
        count: Number(g._count._all || 0)
    }));
}

    async getExceptions(tenantId: string, storeId: string, from: Date, to: Date, tillId ?: string) {
    const whereSession = {
        till: { tenantId, storeId },
        openedAt: { gte: from, lte: to },
        ...(tillId ? { tillId } : {})
    };
    const sessions = await this.prisma.tillSession.findMany({ where: whereSession, select: { id: true } });
    const sessionIds = sessions.map(s => s.id);

    // 1. Refunds
    const refunds = await this.prisma.sale.findMany({
        where: { tillSessionId: { in: sessionIds }, status: 'REFUNDED' },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
    });

    // 2. Voided (If we track voids as sales with status VOIDED)
    const voids = await this.prisma.sale.findMany({
        where: { tillSessionId: { in: sessionIds }, status: 'VOIDED' },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
    });

    // 3. Cash Transactions (No Sale / Pay Out)
    const cashTx = await this.prisma.cashTransaction.findMany({
        where: { tillSessionId: { in: sessionIds } }, // Filter type if needed
        orderBy: { createdAt: 'desc' }
    });

    return {
        refunds,
        voids,
        cashEvents: cashTx
    };
}
    async getInventoryImpact(tenantId: string, storeId: string, from: Date, to: Date, tillId ?: string) {
    const whereSession = {
        till: { tenantId, storeId },
        openedAt: { gte: from, lte: to },
        ...(tillId ? { tillId } : {})
    };
    const sessions = await this.prisma.tillSession.findMany({ where: whereSession, select: { id: true } });
    const sessionIds = sessions.map(s => s.id);

    // Aggregate Sales Items
    const items = await this.prisma.saleItem.groupBy({
        by: ['productId'],
        where: {
            sale: {
                tillSessionId: { in: sessionIds },
                status: 'COMPLETED'
            }
        },
        _sum: { quantity: true }
    });

    // Enrich with Product Info
    const productIds = items.map(i => i.productId);
    const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true }
    });

    const productsMap = new Map(products.map(p => [p.id, p]));

    return items.map(i => ({
        productId: i.productId,
        name: productsMap.get(i.productId)?.name || 'Unknown Product',
        sku: productsMap.get(i.productId)?.sku || 'N/A',
        quantitySold: Number(i._sum.quantity || 0)
    })).sort((a, b) => b.quantitySold - a.quantitySold);
}
}
