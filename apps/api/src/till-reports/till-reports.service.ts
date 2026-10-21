
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TillReportsService {
    constructor(private prisma: PrismaService) { }

    // Sessions opened in the period on the tills in scope. No storeId means every store in
    // the tenant (Organization HQ view); the controller decides who may ask for that.
    private sessionScope(tenantId: string, storeId: string | undefined, from: Date, to: Date, tillId?: string) {
        return {
            till: { tenantId, ...(storeId ? { storeId } : {}) },
            openedAt: { gte: from, lte: to },
            ...(tillId ? { tillId } : {})
        };
    }

    async getDashboardStats(tenantId: string, storeId: string | undefined, from: Date, to: Date, tillId?: string) {
        const where = this.sessionScope(tenantId, storeId, from, to, tillId);

        // 1. Session Overview
        const sessions = await (this.prisma as any).tillSession.findMany({
            where,
            include: {
                user: { select: { name: true } },
                till: { select: { name: true, store: { select: { name: true } } } }
            },
            orderBy: { openedAt: 'desc' }
        });

        // 2. Aggregate Sales (Gross, Net, Tax, Discount)
        // We need to look at SALES tied to these sessions
        const sessionIds = sessions.map(s => s.id);

        const salesAgg = await (this.prisma as any).sale.aggregate({
            where: { tillSessionId: { in: sessionIds }, status: 'COMPLETED' },
            _sum: {
                total: true,
                subtotal: true,
                taxTotal: true,
                discountTotal: true,
                changeGiven: true
            },
            _count: { _all: true }
        });

        // Use proper SalesReturn model instead of 'REFUNDED' status on Sale
        const refundAgg = await (this.prisma as any).salesReturn.aggregate({
            where: { sale: { tillSessionId: { in: sessionIds } } },
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
                    storeName: s.till.store?.name,
                    staffName: s.user.name,
                    openedAt: s.openedAt,
                    closedAt: s.closedAt,
                    status: s.status,
                    openingFloat: Number(s.openingFloat),
                    // != null, not truthiness: a till that balanced exactly has variance 0.
                    closingCash: s.closingCash != null ? Number(s.closingCash) : null,
                    variance: s.variance != null ? Number(s.variance) : null
                }))
            },
            sales: {
                grossSales: Number(salesAgg._sum.subtotal || 0),
                totalCollected: Number(salesAgg._sum.total || 0) - Number(refundAgg._sum.total || 0),
                totalTax: Number(salesAgg._sum.taxTotal || 0),
                totalDiscount: Number(salesAgg._sum.discountTotal || 0),
                totalChangeGiven: Number(salesAgg._sum.changeGiven || 0),
                transactionCount: Number(salesAgg._count._all || 0),
                refundTotal: Number(refundAgg._sum.total || 0),
                refundCount: Number(refundAgg._count._all || 0)
            }
        };
    }

    async getPaymentBreakdown(tenantId: string, storeId: string | undefined, from: Date, to: Date, tillId?: string) {
        const whereSession = this.sessionScope(tenantId, storeId, from, to, tillId);

        // Find sessions first to scope the payments
        const sessions = await (this.prisma as any).tillSession.findMany({ where: whereSession, select: { id: true } });
        const sessionIds = sessions.map(s => s.id);

        // Split by the actual tenders (SalePayment), not Sale.paymentMethod, which is just
        // "SPLIT" for multi-tender sales. Change is handed back in cash, so it comes off CASH,
        // the same rule the till's own session report and expected-cash use. The methods then
        // add up to the sales total.
        const sales = await this.prisma.sale.findMany({
            where: { tillSessionId: { in: sessionIds }, status: 'COMPLETED' },
            select: { total: true, paymentMethod: true, payments: { select: { method: true, amount: true } } }
        });

        const byMethod = new Map<string, { amount: number; count: number }>();
        const add = (method: string, amount: number) => {
            const row = byMethod.get(method) || { amount: 0, count: 0 };
            row.amount += amount;
            row.count += 1;
            byMethod.set(method, row);
        };

        for (const sale of sales) {
            const total = Number(sale.total);
            if (sale.payments.length === 0) {
                // Older sales recorded before split tenders have no payment rows.
                add(sale.paymentMethod || 'UNKNOWN', total);
                continue;
            }
            const paid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
            let change = Math.max(0, paid - total);
            for (const p of sale.payments) {
                let amount = Number(p.amount);
                if (p.method === 'CASH' && change > 0) {
                    const fromCash = Math.min(change, amount);
                    amount -= fromCash;
                    change -= fromCash;
                }
                add(p.method, amount);
            }
        }

        return [...byMethod.entries()]
            .map(([method, row]) => ({ method, amount: row.amount, count: row.count }))
            .sort((a, b) => b.amount - a.amount);
    }

    async getExceptions(tenantId: string, storeId: string | undefined, from: Date, to: Date, tillId?: string) {
        const whereSession = this.sessionScope(tenantId, storeId, from, to, tillId);
        const sessions = await this.prisma.tillSession.findMany({ where: whereSession, select: { id: true } });
        const sessionIds = sessions.map(s => s.id);

        // 1. Refunds (Querying actual SalesReturn records)
        const refunds = await (this.prisma as any).salesReturn.findMany({
            where: { sale: { tillSessionId: { in: sessionIds } } },
            include: { user: { select: { name: true } }, sale: { select: { id: true, total: true } } },
            orderBy: { createdAt: 'desc' }
        });

        // 2. Voided (If we track voids as sales with status VOIDED)
        const voids = await (this.prisma as any).sale.findMany({
            where: { tillSessionId: { in: sessionIds }, status: 'VOIDED' },
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }
        });

        // 3. Cash Transactions (No Sale / Pay Out)
        const cashTx = await (this.prisma as any).cashTransaction.findMany({
            where: { tillSessionId: { in: sessionIds } }, // Filter type if needed
            orderBy: { createdAt: 'desc' }
        });

        return {
            refunds,
            voids,
            cashEvents: cashTx
        };
    }
    async getInventoryImpact(tenantId: string, storeId: string | undefined, from: Date, to: Date, tillId?: string) {
        const whereSession = this.sessionScope(tenantId, storeId, from, to, tillId);
        const sessions = await this.prisma.tillSession.findMany({ where: whereSession, select: { id: true } });
        const sessionIds = sessions.map(s => s.id);

        // Aggregate Sales Items
        const items = await (this.prisma as any).saleItem.groupBy({
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
        const products = await (this.prisma as any).product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, sku: true }
        });

        const productsMap = new Map<string, any>(products.map(p => [p.id, p]));

        return items.map(i => ({
            productId: i.productId,
            name: productsMap.get(i.productId)?.name || 'Unknown Product',
            sku: productsMap.get(i.productId)?.sku || 'N/A',
            quantitySold: Number(i._sum.quantity || 0)
        })).sort((a, b) => b.quantitySold - a.quantitySold);
    }
}
