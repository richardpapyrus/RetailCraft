import { Injectable, BadRequestException } from "@nestjs/common";
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
        throw new BadRequestException(`Insufficient stock. Cannot process adjustment resulting in negative inventory (Current Result: ${inventory.quantity}).`);
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

  // Read-only aging report.
  //
  // "Age" = days since stock was last added for that product+store (latest
  // RECEIVE / RECEIVE_STOCK / ADJUSTMENT_ADD event; products whose only stock
  // came from creation/CSV import have no such event, so we fall back to the
  // product's createdAt). An item is EXCLUDED while it is still selling: any
  // SALE event within `staleDays` means the stock is turning over and the lack
  // of replenishment just means it hasn't hit its reorder point yet.
  async getAgingReport(params: {
    tenantId: string;
    storeId?: string;
    staleDays?: number;
    take?: number;
  }) {
    const { tenantId, storeId, take } = params;
    const staleDays = Math.min(365, Math.max(1, Math.floor(params.staleDays ?? 60)));

    const inventories = await prisma.inventory.findMany({
      where: {
        quantity: { gt: 0 },
        ...(storeId ? { storeId } : {}),
        product: { tenantId, isArchived: false },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            costPrice: true,
            minStockLevel: true,
            createdAt: true,
            category: { select: { name: true } },
          },
        },
        store: { select: { id: true, name: true } },
      },
    });

    const emptySummary = {
      totalItems: 0,
      totalQuantity: 0,
      totalValueTiedUp: 0,
      staleDays,
    };
    if (inventories.length === 0) return { items: [], summary: emptySummary };

    const productIds = [...new Set(inventories.map((i) => i.productId))];
    const storeIds = [...new Set(inventories.map((i) => i.storeId))];

    const [lastAdds, lastSales] = await Promise.all([
      prisma.inventoryEvent.groupBy({
        by: ['productId', 'storeId'],
        where: {
          productId: { in: productIds },
          storeId: { in: storeIds },
          type: { in: ['RECEIVE', 'RECEIVE_STOCK', 'ADJUSTMENT_ADD'] },
        },
        _max: { createdAt: true },
      }),
      prisma.inventoryEvent.groupBy({
        by: ['productId', 'storeId'],
        where: {
          productId: { in: productIds },
          storeId: { in: storeIds },
          type: 'SALE',
        },
        _max: { createdAt: true },
      }),
    ]);

    const key = (productId: string, sId: string) => `${productId}|${sId}`;
    const lastAddMap = new Map(
      lastAdds.map((e) => [key(e.productId, e.storeId), e._max.createdAt]),
    );
    const lastSaleMap = new Map(
      lastSales.map((e) => [key(e.productId, e.storeId), e._max.createdAt]),
    );

    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const staleCutoff = now - staleDays * DAY_MS;

    const items: any[] = [];
    let totalQuantity = 0;
    let totalValueTiedUp = 0;

    for (const inv of inventories) {
      const k = key(inv.productId, inv.storeId);
      const lastSoldAt = lastSaleMap.get(k) ?? null;

      // Still turning over — not "sitting" stock.
      if (lastSoldAt && lastSoldAt.getTime() >= staleCutoff) continue;

      const lastReceivedAt = lastAddMap.get(k) ?? inv.product.createdAt;
      const ageDays = Math.max(0, Math.floor((now - lastReceivedAt.getTime()) / DAY_MS));
      const unitCost = Number(inv.product.costPrice) || 0;
      const valueTiedUp = unitCost * inv.quantity;

      totalQuantity += inv.quantity;
      totalValueTiedUp += valueTiedUp;

      items.push({
        productId: inv.productId,
        name: inv.product.name,
        sku: inv.product.sku,
        category: inv.product.category?.name ?? null,
        storeId: inv.storeId,
        storeName: inv.store.name,
        quantity: inv.quantity,
        minStockLevel: inv.product.minStockLevel,
        unitCost,
        valueTiedUp,
        lastReceivedAt,
        lastSoldAt,
        ageDays,
        daysSinceLastSale: lastSoldAt
          ? Math.max(0, Math.floor((now - lastSoldAt.getTime()) / DAY_MS))
          : null, // never sold
      });
    }

    // Oldest stock first; ties broken by the most money tied up.
    items.sort((a, b) => b.ageDays - a.ageDays || b.valueTiedUp - a.valueTiedUp);

    return {
      items: take && take > 0 ? items.slice(0, take) : items,
      summary: {
        totalItems: items.length,
        totalQuantity,
        totalValueTiedUp,
        staleDays,
      },
    };
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
