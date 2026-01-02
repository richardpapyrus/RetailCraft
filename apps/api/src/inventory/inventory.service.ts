import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Injectable()
export class InventoryService {
  async adjustStock(data: {
    productId: string;
    storeId: string;
    quantity: number; // positive or negative
    reason?: string;
    userId?: string;
  }) {
    const { productId, storeId, quantity, reason, userId } = data;

    return prisma.$transaction(async (tx) => {
      // 1. Update or Create Inventory record
      const inventory = await tx.inventory.upsert({
        where: {
          storeId_productId: {
            storeId,
            productId,
          },
        },
        update: {
          quantity: { increment: quantity },
        },
        create: {
          storeId,
          productId,
          quantity,
        },
      });

      if (inventory.quantity < 0) {
        // Optional: Prevent negative stock? For now, allow it but maybe warn.
        // throw new BadRequestException('Insufficient stock');
      }

      // 2. Create Inventory Event
      await tx.inventoryEvent.create({
        data: {
          type: quantity > 0 ? "ADJUSTMENT_ADD" : "ADJUSTMENT_REMOVE",
          quantity,
          reason: reason || "Manual Adjustment",
          storeId,
          productId,
          userId,
        },
      });

      return inventory;
    });
  }

  async getStock(storeId: string, productId: string) {
    return prisma.inventory.findUnique({
      where: {
        storeId_productId: {
          storeId,
          productId,
        },
      },
    });
  }

  async getFirstStore() {
    return prisma.store.findFirst();
  }

  async restock(data: {
    productId: string;
    storeId: string;
    quantity: number;
    unitCost: number;
    newPrice?: number;
    userId?: string;
    supplierName?: string;
    tenantId: string;
  }) {
    const {
      productId,
      storeId,
      quantity,
      unitCost,
      newPrice,
      userId,
      supplierName,
      tenantId,
    } = data;

    return prisma.$transaction(async (tx) => {
      // 0. Handle Supplier
      let supplierId: string | null = null;
      if (supplierName) {
        // Find or create supplier
        let supplier = await tx.supplier.findFirst({
          where: { name: supplierName, tenantId },
        });
        if (!supplier) {
          supplier = await tx.supplier.create({
            data: { name: supplierName, tenantId },
          });
        }
        supplierId = supplier.id;
      }

      // 1. Fetch current consistency
      const product = await tx.product.findUniqueOrThrow({
        where: { id: productId },
      });
      const currentInv = await tx.inventory.findUnique({
        where: { storeId_productId: { storeId, productId } },
      });

      const currentQty = currentInv ? currentInv.quantity : 0;
      const currentCost = Number(product.costPrice);

      // 2. Calculate Weighted Average Cost
      // NewCost = ((Qty * Cost) + (AddQty * AddCost)) / (TotalQty)
      // Note: If current qty is negative, we treat it as 0 for cost averaging purposes usually, or we just absorb the incoming cost.
      // Let's stick to standard math but handle 0 denominator.

      let newWeightedCost = Number(unitCost);

      if (currentQty > 0) {
        const totalValue = currentQty * currentCost + quantity * unitCost;
        const totalQty = currentQty + quantity;
        if (totalQty > 0) {
          newWeightedCost = totalValue / totalQty;
        }
      }

      // 3. Update Product Cost & Price
      await tx.product.update({
        where: { id: productId },
        data: {
          costPrice: newWeightedCost,
          ...(newPrice ? { price: newPrice } : {}),
        },
      });

      // 4. Update Stock
      const inventory = await tx.inventory.upsert({
        where: { storeId_productId: { storeId, productId } },
        update: { quantity: { increment: quantity } },
        create: { storeId, productId, quantity },
      });

      // 5. Log Event
      await tx.inventoryEvent.create({
        data: {
          type: "RECEIVE_STOCK",
          quantity,
          reason: `Restock @$${unitCost}/unit`,
          storeId,
          productId,
          userId,
          supplierId,
        },
      });

      return inventory;
    });
  }
}
