import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Injectable()
export class SuppliersService {
  async create(data: {
    name: string;
    contact?: string;
    phone?: string;
    email?: string;
    tenantId: string;
  }) {
    return prisma.supplier.create({
      data: {
        ...data,
        storeId: (data as any).storeId,
      },
    });
  }

  async findAll(tenantId: string, storeId?: string) {
    const where: any = { tenantId };
    if (storeId) where.storeId = storeId;
    return prisma.supplier.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, tenantId: string) {
    return prisma.supplier.findFirst({
      where: { id, tenantId },
      include: { products: true },
    });
  }

  async update(
    id: string,
    data: { name?: string; contact?: string; phone?: string; email?: string },
  ) {
    return prisma.supplier.update({
      where: { id }, // In real app, ensure tenantId matches
      data,
    });
  }

  async remove(id: string) {
    return prisma.supplier.delete({
      where: { id },
    });
  }
}
