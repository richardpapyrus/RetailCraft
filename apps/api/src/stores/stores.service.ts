import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Injectable()
export class StoresService {
  async findAll(tenantId: string, storeId?: string) {
    return prisma.store.findMany({
      where: {
        tenantId,
        ...(storeId ? { id: storeId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true } } },
    });
  }

  async create(tenantId: string, data: any) {
    return prisma.store.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async update(id: string, tenantId: string, data: any) {
    const {
      tenantId: _t,
      id: _i,
      createdAt: _c,
      updatedAt: _u,
      ...cleanData
    } = data;
    return prisma.store.update({
      where: { id, tenantId },
      data: cleanData,
    });
  }

  async delete(id: string, tenantId: string) {
    // Check if store has dependencies (inventory, sales)
    // For now, let Prisma handle constraints or fail
    return prisma.store.delete({
      where: { id, tenantId },
    });
  }
}
