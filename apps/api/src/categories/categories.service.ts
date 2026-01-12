import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class CategoriesService {

    async create(tenantId: string, data: { name: string; description?: string }) {
        // Check uniqueness
        const existing = await prisma.productCategory.findFirst({
            where: { tenantId, name: { equals: data.name, mode: 'insensitive' } }
        });

        if (existing) {
            throw new BadRequestException('Category with this name already exists');
        }

        return prisma.productCategory.create({
            data: {
                ...data,
                tenantId,
                status: 'ACTIVE'
            }
        });
    }

    async findAll(tenantId: string) {
        return prisma.productCategory.findMany({
            where: { tenantId, status: 'ACTIVE' },
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { products: true } }
            }
        });
    }

    async findOne(tenantId: string, id: string) {
        const category = await prisma.productCategory.findFirst({
            where: { id, tenantId }
        });
        if (!category) throw new NotFoundException('Category not found');
        return category;
    }

    async update(tenantId: string, id: string, data: { name?: string; description?: string }) {
        await this.findOne(tenantId, id); // Ensure exists

        if (data.name) {
            const existing = await prisma.productCategory.findFirst({
                where: {
                    tenantId,
                    name: { equals: data.name, mode: 'insensitive' },
                    id: { not: id }
                }
            });
            if (existing) throw new BadRequestException('Category name already taken');
        }

        return prisma.productCategory.update({
            where: { id },
            data
        });
    }

    async remove(tenantId: string, id: string) {
        const category = await this.findOne(tenantId, id);

        // Check usage
        const productCount = await prisma.product.count({
            where: { categoryId: id }
        });

        if (productCount > 0) {
            throw new BadRequestException(`Cannot delete category. It is used by ${productCount} products. Move them first.`);
        }

        // Hard Delete allowed if unused. Alternatively Soft Delete.
        // Given requirement "Prevent deletion ... in use", hard delete is fine if unused.
        // If strict soft delete required, update status.
        // Requirement 8: "Prevent deletion of categories in use (or soft-delete with warning)"
        // I'll implement Hard Delete if unused. Soft delete if needed later.

        return prisma.productCategory.delete({
            where: { id }
        });
    }
}
