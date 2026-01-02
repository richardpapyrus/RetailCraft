import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Injectable()
export class DiscountsService {
  async findAll(tenantId: string) {
    return prisma.discount.findMany({
      where: { tenantId, active: true },
    });
  }

  async create(tenantId: string, data: any) {
    return prisma.discount.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async update(id: string, data: any) {
    return prisma.discount.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prisma.discount.update({
      where: { id },
      data: { active: false },
    });
  }
}
