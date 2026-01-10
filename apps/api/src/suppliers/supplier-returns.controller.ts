
import { Controller, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SupplierReturnsService } from './supplier-returns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('supplier-returns')
@UseGuards(JwtAuthGuard)
export class SupplierReturnsController {
    constructor(private readonly returnsService: SupplierReturnsService) { }

    @Post()
    create(@Request() req, @Body() body: any) {
        if (!req.user.storeId) throw new Error("Store Context Required");
        return this.returnsService.create({ ...body, storeId: req.user.storeId });
    }

    @Post(':id/execute')
    execute(@Param('id') id: string) {
        return this.returnsService.execute(id);
    }
}
