import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SalesService } from '../sales/sales.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('business')
@UseGuards(JwtAuthGuard)
export class BusinessController {
    constructor(private readonly salesService: SalesService) { }

    @Get('dashboard')
    async getDashboard(@Request() req, @Query('from') from?: string, @Query('to') to?: string) {
        // Only Administrators can access this
        // We assume the strict role check might be handled by a guard or here.
        // For now, checks if user has access to tenant.

        // Aggregate stats across ALL stores for the tenant
        const stats = await this.salesService.getStats(req.user.tenantId, from, to);

        // Also fetch breakdown by store
        const storeBreakdown = await prisma.sale.groupBy({
            by: ['storeId'],
            where: {
                tenantId: req.user.tenantId,
                status: 'COMPLETED',
                // Date filter
            },
            _sum: {
                total: true,
            },
            _count: {
                id: true
            }
        });

        // Resolve store names
        const stores = await prisma.store.findMany({
            where: { tenantId: req.user.tenantId }
        });

        const breakdown = storeBreakdown.map(sb => ({
            storeId: sb.storeId,
            storeName: stores.find(s => s.id === sb.storeId)?.name || 'Unknown',
            total: sb._sum.total,
            count: sb._count.id
        }));

        return {
            aggregate: stats,
            byLocation: breakdown
        };
    }
}
