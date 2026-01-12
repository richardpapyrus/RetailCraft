import { Controller, Get, Post, Body, Patch, Param, Delete, Request, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    @Post()
    create(@Request() req, @Body() body: { name: string; description?: string }) {
        return this.categoriesService.create(req.user.tenantId, body);
    }

    @Get()
    findAll(@Request() req) {
        return this.categoriesService.findAll(req.user.tenantId);
    }

    @Get(':id')
    findOne(@Request() req, @Param('id') id: string) {
        return this.categoriesService.findOne(req.user.tenantId, id);
    }

    @Patch(':id')
    update(@Request() req, @Param('id') id: string, @Body() body: { name?: string; description?: string }) {
        return this.categoriesService.update(req.user.tenantId, id, body);
    }

    @Delete(':id')
    remove(@Request() req, @Param('id') id: string) {
        return this.categoriesService.remove(req.user.tenantId, id);
    }
}
