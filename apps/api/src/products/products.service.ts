import { Injectable } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import * as csv from "csv-parser";
import { Readable } from "stream";

const prisma = new PrismaClient();

@Injectable()
export class ProductsService {
  async importProducts(tenantId: string, buffer: Buffer, storeId?: string) {
    const products: any[] = [];
    const stream = Readable.from(buffer.toString());

    return new Promise((resolve, reject) => {
      stream
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/^[\uFEFF]/, '')
        }))
        .on("data", (data) => products.push(data))
        .on("end", async () => {
          let createdCount = 0;
          let updatedCount = 0;
          let errors = 0;



          for (const row of products) {
            try {
              // Normalize keys just in case, though mapHeaders handles most
              const name = row.name || row.Name;
              const sku = row.sku || row.Sku || row.SKU;
              const price = row.price || row.Price;

              if (!name || !sku || !price) {

                continue;
              }
              const { ...rest } = row;

              const productData = {
                name,
                sku,
                price: parseFloat(price),
                tenantId,
                costPrice: rest.costPrice
                  ? parseFloat(rest.costPrice)
                  : undefined,
                minStockLevel: rest.minStockLevel
                  ? parseInt(rest.minStockLevel)
                  : 0,
                description: rest.description,
                category: rest.category,
                barcode: rest.barcode,
                storeId, // Assign to specific store if provided
              };

              const existing = await prisma.product.findFirst({
                where: { sku, tenantId },
              });

              const quantity = row.quantity || row.Quantity;
              let product;

              if (existing) {
                product = await prisma.product.update({
                  where: { id: existing.id },
                  data: productData,
                });
                updatedCount++;
              } else {
                product = await prisma.product.create({
                  data: productData,
                });
                createdCount++;
              }

              // Handle Inventory if Quantity & StoreId provided
              if (storeId && quantity !== undefined && quantity !== null && quantity !== '') {
                const qty = parseInt(quantity.toString());
                if (!isNaN(qty)) {
                  await prisma.inventory.upsert({
                    where: { storeId_productId: { storeId, productId: product.id } },
                    update: { quantity: qty }, // Import sets the absolute quantity
                    create: {
                      storeId,
                      productId: product.id,
                      quantity: qty
                    }
                  });
                }
              }
            } catch (e) {
              console.error("Import Row Error", e);
              errors++;
            }
          }
          resolve({ createdCount, updatedCount, errors });
        })
        .on("error", (err) => reject(err));
    });
  }

  async create(data: {
    name: string;
    sku: string;
    price: string | number;
    costPrice?: string | number;
    minStockLevel?: number;
    tenantId: string;
    description?: string;
    barcode?: string | null;
    supplierId?: string;
    category?: string | null;
  }) {
    return prisma.product.create({
      data: {
        ...data,
        price: data.price, // Prisma handles string -> Decimal
        costPrice: data.costPrice,
        minStockLevel: data.minStockLevel || 0,
        barcode:
          data.barcode === "" || data.barcode === null ? null : data.barcode,
        category:
          data.category === "" || data.category === null ? null : data.category,
        storeId: (data as any).storeId, // Add storeId to create
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      sku?: string;
      price?: string | number;
      costPrice?: string | number;
      minStockLevel?: number;
      description?: string;
      barcode?: string;
      supplierId?: string | null;
    },
  ) {
    const {
      id: _i,
      tenantId: _t,
      createdAt: _c,
      updatedAt: _u,
      inventory: _inv,
      supplier: _sup,
      inventoryEvents: _ie,
      ...cleanData
    } = data as any;
    const updateData: any = { ...cleanData };

    // Sanitize Numbers
    if (updateData.price !== undefined) {
      const p = parseFloat(updateData.price.toString());
      if (isNaN(p)) throw new Error("Invalid Price");
      updateData.price = p;
    }
    if (updateData.costPrice !== undefined) {
      // Handle null/empty explicitly if passed
      if (updateData.costPrice === "" || updateData.costPrice === null) {
        updateData.costPrice = null; // Assuming schema allows null, but schema says default 0.0. Let's use 0 or undefined.
        // Actually schema says: costPrice Decimal @default(0.0). It is NOT optional in schema?
        // Schema: costPrice Decimal @default(0.0)
        // So it cannot be null.
        updateData.costPrice = 0;
      } else {
        const c = parseFloat(updateData.costPrice.toString());
        updateData.costPrice = isNaN(c) ? 0 : c;
      }
    }
    if (updateData.minStockLevel !== undefined) {
      const m = parseInt(updateData.minStockLevel.toString());
      updateData.minStockLevel = isNaN(m) ? 0 : m;
    }

    // Sanitize Strings to Null if empty (to avoid Unique Constraint violations on empty strings)
    if (updateData.barcode === "" || updateData.barcode === null) {
      updateData.barcode = null;
    }
    if (updateData.category === "" || updateData.category === null) {
      updateData.category = null;
    }

    // Handle SupplierId
    // If it is explicitly null, we want to disconnect or set to null.
    // Prisma update expects: supplierId: null OR supplier: { disconnect: true } if using relations,
    // but since we have the scalar supplierId, passing null works IF it is nullable.
    // Schema: supplierId String? -> Nullable.

    return prisma.product.update({
      where: { id },
      data: updateData,
    });
  }

  async findAll(
    tenantId: string,
    skip: number = 0,
    take: number = 50,
    filters: { search?: string; category?: string; lowStock?: boolean } = {},
    storeId?: string, // NEW: Optional Store Filter
  ) {
    // If lowStock filter is active, we MUST use raw query for aggregation
    if (filters.lowStock) {
      const searchTerm = filters.search ? `%${filters.search}%` : "%";

      // Raw query to fetch products with low stock (inventory <= minStockLevel)
      const lowStockProducts: any[] = await prisma.$queryRaw`
                SELECT p.id 
                FROM "Product" p
                LEFT JOIN "Inventory" i ON p.id = i."productId" AND (${storeId ? Prisma.sql`i."storeId" = ${storeId}` : Prisma.sql`1=1`})
                WHERE p."tenantId" = ${tenantId}
                AND (${filters.category ? Prisma.sql`p.category = ${filters.category}` : Prisma.sql`1=1`})
                AND (
                    p.name ILIKE ${searchTerm} OR 
                    p.sku ILIKE ${searchTerm} OR 
                    p.barcode ILIKE ${searchTerm}
                )
                GROUP BY p.id
                HAVING COALESCE(SUM(i.quantity), 0) <= p."minStockLevel"
                OFFSET ${skip}
                LIMIT ${take}
            `;

      const productIds = lowStockProducts.map((p) => p.id);

      // Count total matching for pagination
      const totalResult: any[] = await prisma.$queryRawUnsafe(`
                 SELECT COUNT(DISTINCT p.id) as count
                 FROM "Product" p
                  LEFT JOIN "Inventory" i ON p.id = i."productId" ${storeId ? `AND i."storeId" = '${storeId}'` : ''}
                  WHERE p."tenantId" = '${tenantId}'
                 ${storeId ? `AND p."storeId" = '${storeId}'` : ''}
                 AND (${filters.category ? `p.category = '${filters.category}'` : '1=1'})
                 AND (
                    p.name ILIKE '%${searchTerm}%' OR 
                    p.sku ILIKE '%${searchTerm}%' OR 
                    p.barcode ILIKE '%${searchTerm}%'
                 )
                 GROUP BY p.id
                 HAVING COALESCE(SUM(i.quantity), 0) <= p."minStockLevel"
            `);
      const total = totalResult.length;

      const data = await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: {
          inventory: { where: storeId ? { storeId } : undefined },
          supplier: true
        },
        orderBy: { createdAt: "desc" },
      });

      return { total, data };
    }

    // Standard Prisma Query for non-lowStock filters
    // STRICT ISOLATION: If storeId is provided, we strictly filter by it.

    const where: any = { tenantId };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { sku: { contains: filters.search, mode: "insensitive" } },
        { barcode: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (
      filters.category &&
      filters.category !== "undefined" &&
      filters.category !== "null" &&
      filters.category.trim() !== ""
    ) {
      where.category = filters.category;
    }

    // STRICT STORE ISOLATION
    if (storeId) {
      where.storeId = storeId;
    }

    const [total, data] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: {
          inventory: { where: storeId ? { storeId } : undefined },
          supplier: true
        },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    console.log(
      `[ProductsService] findAll for ${tenantId} (Store: ${storeId || 'All'}): found ${data.length} items (total count: ${total}) with where clause: ${JSON.stringify(where)}`,
    );
    return { total, data };
  }

  async getStats(tenantId: string, storeId?: string) {
    // 1. Total Products (Strict Isolation)
    const productWhere: any = { tenantId };
    if (storeId) {
      productWhere.storeId = storeId;
    }

    const totalProducts = await prisma.product.count({ where: productWhere });

    // 2. Inventory Value & Low Stock Count
    const products = await prisma.product.findMany({
      where: productWhere,
      include: {
        inventory: { where: storeId ? { storeId } : undefined } // Filter inventory
      },
    });

    let totalValue = 0;
    let lowStockCount = 0;

    for (const p of products) {
      const totalQty =
        p.inventory?.reduce((sum, inv) => sum + inv.quantity, 0) || 0;
      const cost = Number(p.costPrice) || 0;
      totalValue += cost * totalQty;

      if (p.minStockLevel > 0 && totalQty <= p.minStockLevel) {
        lowStockCount++;
      }
    }

    console.log(
      `[ProductsService] getStats for ${tenantId}: totalProducts=${totalProducts}, inventoryValue=${totalValue.toFixed(2)}, lowStockCount=${lowStockCount}`,
    );
    return {
      totalProducts,
      inventoryValue: totalValue.toFixed(2),
      lowStockCount,
    };
  }

  async findOne(id: string, tenantId: string) {
    return prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        inventory: true,
        supplier: true,
        inventoryEvents: {
          include: {
            supplier: true,
            user: { select: { email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });
  }

  async findEvents(productId: string, skip: number = 0, take: number = 50) {
    const [total, data] = await prisma.$transaction([
      prisma.inventoryEvent.count({ where: { productId } }),
      prisma.inventoryEvent.findMany({
        where: { productId },
        include: {
          supplier: true,
          user: { select: { email: true } },
        },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { total, data };
  }
}
