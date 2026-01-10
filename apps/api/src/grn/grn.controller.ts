
import { Controller, Post, Body, UseGuards, Request, Get, Query } from '@nestjs/common';
import { GrnService } from './grn.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('grn')
@UseGuards(JwtAuthGuard)
export class GrnController {
    constructor(private readonly grnService: GrnService) { }

    @Post()
    receive(@Request() req, @Body() body: any) {
        let storeId = body.storeId;
        const isAdmin = req.user.role === 'Administrator' || req.user.permissions?.includes('*');

        if (!isAdmin) {
            // For non-admins, ensure they have RECEIVE permission and a Store Context
            if (!req.user.permissions?.includes('RECEIVE_STOCK') && req.user.role !== 'Manager') {
                throw new Error("Permission Denied");
            }
            if (!req.user.storeId) throw new Error("Store Context Required");
            storeId = req.user.storeId;
        }

        if (!storeId) throw new Error("Store ID required for GRN");

        return this.grnService.receive({
            ...body,
            userId: req.user.userId,
            storeId: storeId
        });
    }

    @Get()
    findAll(@Request() req) {
        if (!req.user.storeId) return []; // Or throw
        return this.grnService.findAll(req.user.storeId);
    }
}
