import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Injectable()
export class TaxesService {
  async findAll(tenantId: string) {
    return prisma.tax.findMany({
      where: { tenantId, active: true },
    });
  }

  async create(tenantId: string, data: any) {
    return prisma.tax.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async update(id: string, data: any) {
    return prisma.tax.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    // Soft delete
    return prisma.tax.update({
      where: { id },
      data: { active: false },
    });
  }
}
