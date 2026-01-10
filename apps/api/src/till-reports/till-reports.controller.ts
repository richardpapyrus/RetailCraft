
import { Controller, Get, Query, UseGuards, Request, ForbiddenException, BadRequestException } from '@nestjs/common';
import { TillReportsService } from './till-reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@Controller('till-reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TillReportsController {
    constructor(private readonly reportsService: TillReportsService) { }

    @Get('dashboard')
    @RequirePermissions('VIEW_TILL_REPORTS')
    async getDashboard(
        @Request() req,
        @Query('from') from: string,
        @Query('to') to: string,
        @Query('tillId') tillId?: string
    ) {
        if (!req.user.storeId) throw new BadRequestException('User must belong to a store context');

        const startDate = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
        const endDate = to ? new Date(to) : new Date();

        const overview = await this.reportsService.getDashboardStats(
            req.user.tenantId,
            req.user.storeId,
            startDate,
            endDate,
            tillId
        );

        const payments = await this.reportsService.getPaymentBreakdown(
            req.user.tenantId,
            req.user.storeId,
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
        @Query('tillId') tillId?: string
    ) {
        const startDate = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
        const endDate = to ? new Date(to) : new Date();

        return this.reportsService.getExceptions(
            req.user.tenantId,
            req.user.storeId, // Strict Store Scope
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
        @Query('tillId') tillId?: string
    ) {
        const startDate = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
        const endDate = to ? new Date(to) : new Date();

        return this.reportsService.getInventoryImpact(
            req.user.tenantId,
            req.user.storeId, // Strict Store Scope
            startDate,
            endDate,
            tillId
        );
    }
}
