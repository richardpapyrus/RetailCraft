
import { Controller, Get, Query, UseGuards, Request, ForbiddenException, BadRequestException } from '@nestjs/common';
import { TillReportsService } from './till-reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@Controller('till-reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TillReportsController {
    constructor(private readonly reportsService: TillReportsService) { }

    // Same rule as GET /tills: administrators report on the store picked in the top bar, or on
    // every store when none is picked (Organization HQ); everyone else is held to their own store.
    private resolveStore(req, queryStoreId?: string): string | undefined {
        const isSystemAdmin = req.user.role === 'Administrator' || req.user.permissions?.includes('*');
        if (isSystemAdmin) return queryStoreId || undefined;
        if (req.user.storeId) return req.user.storeId;
        if (!queryStoreId) throw new BadRequestException('Store ID required for floating staff');
        return queryStoreId;
    }

    @Get('dashboard')
    @RequirePermissions('VIEW_TILL_REPORTS')
    async getDashboard(
        @Request() req,
        @Query('from') from: string,
        @Query('to') to: string,
        @Query('tillId') tillId?: string,
        @Query('storeId') queryStoreId?: string
    ) {
        const storeId = this.resolveStore(req, queryStoreId);

        const startDate = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
        const endDate = to ? new Date(to) : new Date();

        const overview = await this.reportsService.getDashboardStats(
            req.user.tenantId,
            storeId,
            startDate,
            endDate,
            tillId
        );

        const payments = await this.reportsService.getPaymentBreakdown(
            req.user.tenantId,
            storeId,
            startDate,
            endDate,
            tillId
        );

        return { ...overview, payments };
    }

    @Get('exceptions')
    @RequirePermissions('VIEW_TILL_REPORTS')
    async getExceptions(
        @Request() req,
        @Query('from') from: string,
        @Query('to') to: string,
        @Query('tillId') tillId?: string,
        @Query('storeId') queryStoreId?: string
    ) {
        const storeId = this.resolveStore(req, queryStoreId);
        const startDate = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
        const endDate = to ? new Date(to) : new Date();

        return this.reportsService.getExceptions(
            req.user.tenantId,
            storeId,
            startDate,
            endDate,
            tillId
        );
    }
    @Get('inventory')
    @RequirePermissions('VIEW_TILL_REPORTS')
    async getInventory(
        @Request() req,
        @Query('from') from: string,
        @Query('to') to: string,
        @Query('tillId') tillId?: string,
        @Query('storeId') queryStoreId?: string
    ) {
        const storeId = this.resolveStore(req, queryStoreId);
        const startDate = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
        const endDate = to ? new Date(to) : new Date();

        return this.reportsService.getInventoryImpact(
            req.user.tenantId,
            storeId,
            startDate,
            endDate,
            tillId
        );
    }
}
