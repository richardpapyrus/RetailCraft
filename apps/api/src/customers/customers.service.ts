import { Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Injectable()
export class CustomersService {
  async create(
    data:
      | Prisma.CustomerCreateInput
      | (Omit<Prisma.CustomerCreateInput, "code"> & { code?: string }),
  ) {
    // Auto-generate human readable code if not provided
    if (!data.code) {
      const count = await prisma.customer.count();
      data.code = `C-${(count + 1001).toString()}`;
    }
    // ensure storeId is passed in data
    return prisma.customer.create({ data: data as Prisma.CustomerCreateInput });
  }

  async findAll(tenantId: string, skip: number = 0, take: number = 50, storeId?: string, search?: string) {
    const where: Prisma.CustomerWhereInput = { tenantId };

    // STRICT ISOLATION:
    if (storeId) {
      where.storeId = storeId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [total, data] = await prisma.$transaction([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { total, data };
  }

  findOne(id: string, tenantId: string) {
    return prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        sales: {
          orderBy: { createdAt: "desc" },
          take: 50, // Limit initial fetch
        },
      },
    });
  }

  async findSales(customerId: string, skip: number = 0, take: number = 50) {
    const [total, data] = await prisma.$transaction([
      prisma.sale.count({ where: { customerId } }),
      prisma.sale.findMany({
        where: { customerId },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { total, data };
  }

  update(
    id: string,
    updateCustomerDto: Prisma.CustomerUpdateInput,
    tenantId: string,
  ) {
    return prisma.customer.update({
      where: { id, tenantId },
      data: updateCustomerDto,
    });
  }
}
