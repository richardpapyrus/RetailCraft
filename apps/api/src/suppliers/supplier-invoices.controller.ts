
import { Controller, Post, Body, Get, UseGuards, Request, Query } from '@nestjs/common';
import { SupplierInvoicesService } from './supplier-invoices.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('supplier-invoices')
@UseGuards(JwtAuthGuard)
export class SupplierInvoicesController {
    constructor(private readonly invoicesService: SupplierInvoicesService) { }

    @Post()
    create(@Request() req, @Body() body: any) {
        // Finance Role check?
        return this.invoicesService.create(body);
    }

    @Get()
    findAll(@Request() req, @Query('storeId') storeId: string) {
        return this.invoicesService.findAll(storeId || req.user.storeId);
    }
}
