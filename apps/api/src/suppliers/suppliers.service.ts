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
    currency?: string;
    termDays?: number;
    tenantId: string;
    storeId?: string;
  }) {
    return prisma.supplier.create({
      data: {
        name: data.name,
        contact: data.contact,
        phone: data.phone,
        email: data.email,
        currency: data.currency || "USD",
        termDays: data.termDays || 30,
        tenantId: data.tenantId,
        storeId: data.storeId,
      },
    });
  }

  async findAll(tenantId: string, storeId?: string) {
    const where: any = { tenantId };

    if (storeId) {
      where.OR = [
        { storeId: storeId },
        { storeId: null } // Include Global/System Suppliers
      ];
    }
    return prisma.supplier.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, tenantId: string) {
    return prisma.supplier.findFirst({
      where: { id, tenantId },
      include: {
        supplierProducts: {
          include: { product: true }
        }
      },
    });
  }

  async update(
    id: string,
    data: { name?: string; contact?: string; phone?: string; email?: string; currency?: string; termDays?: number },
  ) {
    return prisma.supplier.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return prisma.supplier.delete({
      where: { id },
    });
  }

  // Multi-Supplier Product Management
  async addProduct(supplierId: string, productId: string, data: { supplierSku?: string, lastCost: number, isPreferred?: boolean }) {
    return prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId, productId } },
      update: {
        supplierSku: data.supplierSku,
        lastCost: data.lastCost,
        isPreferred: data.isPreferred
      },
      create: {
        supplierId,
        productId,
        supplierSku: data.supplierSku,
        lastCost: data.lastCost,
        isPreferred: data.isPreferred || false
      }
    });
  }

  async removeProduct(supplierId: string, productId: string) {
    return prisma.supplierProduct.delete({
      where: { supplierId_productId: { supplierId, productId } }
    });
  }

  async findReorderItems(supplierId: string, storeId: string) {
    // 1. Get Products where this Supplier is the 'Preferred Supplier' (Legacy Field)
    // The frontend sets Product.supplierId, so we must query that.
    const isUnassigned = supplierId === 'unassigned';

    // 1. Get Products where this Supplier is the 'Preferred Supplier'
    // AND the product belongs to the Current Store (or is Global)
    const products = await prisma.product.findMany({
      where: {
        supplierId: isUnassigned ? null : supplierId,
        OR: [
          { storeId: storeId },
          { storeId: null }
        ]
      },
      include: {
        inventory: { where: { storeId } }
      }
    });

    // 2. Filter for Low Stock (Qty <= MinStock)
    return products
      .map(product => {
        const currentQty = product.inventory[0]?.quantity || 0;
        const minStock = product.minStockLevel || 0;

        // Strict Reorder Rule:
        // 1. Must be below or at Min Stock
        // 2. AND (Min Stock must be defined (>0) OR Stock must be negative (Backordered))
        // RELAXED: Just check if Stock <= Min. (Handles 0 <= 0 case).
        const needsReorder = currentQty <= minStock;

        if (needsReorder) {
          let suggestQty = (minStock - currentQty);
          if (suggestQty <= 0) suggestQty = 1; // Safety fallback

          return {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            supplierSku: (product as any).supplierSku || '', // If field exists
            currentStock: currentQty,
            minStock: minStock,
            lastCost: product.costPrice,
            suggestedQty: suggestQty,
            product: product
          };
        }
        return null;
      })
      .filter(item => item !== null)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 15);
  }
}
