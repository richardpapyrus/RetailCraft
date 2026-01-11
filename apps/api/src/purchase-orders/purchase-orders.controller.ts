
import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards, Request } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard)
export class PurchaseOrdersController {
    constructor(private readonly poService: PurchaseOrdersService) { }

    @Post()
    async create(@Request() req, @Body() body: any) {
        let storeId = body.storeId;
        const isSystemAdmin = req.user.role === 'Administrator' || req.user.permissions?.includes('*');

        if (!isSystemAdmin && !req.user.permissions?.includes('RAISE_PURCHASE_ORDER')) {
            throw new Error("Permission Denied: Requires RAISE_PURCHASE_ORDER");
        }

        if (!isSystemAdmin) {
            if (!req.user.storeId) throw new Error("Store Context Required");
            storeId = req.user.storeId;
        }

        if (!storeId) throw new Error("Store ID is required");

        try {
            return await this.poService.create({
                ...body,
                tenantId: req.user.tenantId,
                storeId: storeId,
                userId: req.user.userId
            });
        } catch (e) {
            console.error("==========================================");
            console.error("PO CREATION ERROR:");
            console.error(e);
            console.error("Payload:", JSON.stringify(body));
            console.error("StoreId:", storeId);
            console.error("UserId:", req.user.userId);
            console.error("==========================================");
            throw e;
        }
    }

    @Get()
    findAll(@Request() req, @Query('status') status?: string, @Query('storeId') queryStoreId?: string) {
        let storeId = req.user.storeId;
        const isSystemAdmin = req.user.role === 'Administrator' || req.user.permissions?.includes('*');

        if (isSystemAdmin) {
            // Allow Admin to view all or specific store
            storeId = queryStoreId;
        }

        return this.poService.findAll(req.user.tenantId, storeId, status);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Request() req) {
        return this.poService.findOne(id, req.user.tenantId);
    }

    @Patch(':id/status')
    updateStatus(@Param('id') id: string, @Body('status') status: string, @Request() req) {
        return this.poService.updateStatus(id, status, req.user.tenantId);
    }
}
