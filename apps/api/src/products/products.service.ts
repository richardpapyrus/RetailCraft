import { Injectable, BadRequestException } from "@nestjs/common";
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

          // Chunk Processing for Performance (Batch size: 50)
          const chunkSize = 50;

          for (let i = 0; i < products.length; i += chunkSize) {
            const chunk = products.slice(i, i + chunkSize);

            // Process chunk in parallel
            const results = await Promise.all(
              chunk.map(row => this.processImportRow(row, tenantId, storeId))
            );

            // Aggregate stats
            for (const res of results) {
              if (res.status === 'created') createdCount++;
              else if (res.status === 'updated') updatedCount++;
              else if (res.status === 'error') errors++;
            }
          }

          resolve({ createdCount, updatedCount, errors });
        })
        .on("error", (err) => reject(err));
    });
  }

  // Helper for Processing Single Row (Extracted for Parallel Execution)
  private async processImportRow(row: any, tenantId: string, storeId?: string): Promise<{ status: 'created' | 'updated' | 'error' | 'skipped' }> {
    try {
      const name = row.name;
      const sku = row.sku;
      const price = row.price;

      // Relaxed Validation: Default values for missing fields

      // Name defaults to "Unnamed Product" if completely missing
      const finalName = name || `Unnamed Product ${Math.floor(Math.random() * 1000)}`;

      // Auto-generate SKU if missing (Name + Random Suffix) uses finalName
      const finalSku = sku || `${finalName.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().substring(0, 15)}-${Math.floor(Math.random() * 10000)}`;

      // Price defaults to 0 if missing
      let finalPrice = 0;
      if (price) {
        const parsed = parseFloat(price.toString());
        if (!isNaN(parsed)) finalPrice = parsed;
      }

      // Removed Strict Check: We now accept almost anything.
      // if (!name || !finalSku || !price) ...

      // Handle Store Fallback for Inventory
      let targetStoreId = storeId;
      if (!targetStoreId && (row.quantity || row.quantity === 0)) {
        const defaultStore = await prisma.store.findFirst({ where: { tenantId } });
        if (defaultStore) targetStoreId = defaultStore.id;
      }

      // Valid Category Logic
      let categoryId = await this.getDefaultCategoryId(tenantId);
      if (row.category && row.category.trim() !== "") {
        const catName = row.category.trim();
        const existingCat = await prisma.productCategory.findFirst({
          where: { tenantId, name: { equals: catName, mode: 'insensitive' } }
        });
        if (existingCat) {
          categoryId = existingCat.id;
        } else {
          const newCat = await prisma.productCategory.create({
            data: { name: catName, tenantId, status: 'ACTIVE' }
          });
          categoryId = newCat.id;
        }
      }

      const productScalars = {
        name: finalName,
        sku: finalSku,
        price: finalPrice,
        // tenantId, // Removed to force connect
        costPrice: row.costprice ? parseFloat(row.costprice) : undefined,
        minStockLevel: row.minstocklevel ? parseInt(row.minstocklevel) : 0,
        description: row.description,
        // category: ... Removed
        barcode: row.barcode && row.barcode.trim() !== "" ? row.barcode : null,

      };

      // SMART DEDUPLICATION LOGIC
      // 1. If we generated a random SKU, we can't reliably use it to find existing products.
      // 2. We must look for existing products by Barcode OR Name to prevent duplicates/constraint errors.

      const searchConditions: any[] = [];

      // If SKU was provided in CSV (not generated), it is the primary key.
      if (sku) {
        searchConditions.push({ sku: sku });
      }

      // If Barcode is provided, check for it.
      if (row.barcode && row.barcode.trim() !== "") {
        searchConditions.push({ barcode: row.barcode });
      }

      // Fallback: Check by Name if we haven't found it yet.
      // (Useful for re-imports of files without SKU/Barcode)
      if (finalName) {
        searchConditions.push({ name: finalName });
      }

      // Execute Search
      let existing = null;
      if (searchConditions.length > 0) {
        existing = await prisma.product.findFirst({
          where: {
            tenantId,
            OR: searchConditions
          }
        });
      }

      let product;
      let status: 'created' | 'updated' = 'created';

      if (existing) {
        // Update
        const { sku: _sk, ...updateVars } = productScalars;
        const finalUpdateData = { ...updateVars };

        if (sku) {
          (finalUpdateData as any).sku = sku;
        }

        product = await prisma.product.update({
          where: { id: existing.id },
          data: {
            ...finalUpdateData,
            // category: { connect: { id: categoryId } } // Optional: do we update category on re-import?
            // Let's assume Yes if provided, but we already resolved categoryId.
            // Logic: verify if we should overwrite. For now, let's connect it to ensure consistency.
            category: { connect: { id: categoryId } }
          },
        });
        status = 'updated';
      } else {
        // Create
        product = await prisma.product.create({
          data: {
            ...productScalars,
            tenant: { connect: { id: tenantId } },
            category: { connect: { id: categoryId } }
          },
        });
        status = 'created';
      }

      // Handle Inventory
      const quantity = row.quantity;
      if (targetStoreId && quantity !== undefined && quantity !== null && quantity !== '') {
        const qty = parseInt(quantity.toString());
        if (!isNaN(qty)) {
          await prisma.inventory.upsert({
            where: { storeId_productId: { storeId: targetStoreId, productId: product.id } },
            update: { quantity: qty },
            create: {
              storeId: targetStoreId,
              productId: product.id,
              quantity: qty
            }
          });
        }
      }
      return { status: status };

    } catch (e) {
      console.error("Row Error:", e);
      return { status: 'error' };
    }
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
    categoryId?: string;
  }) {
    const { tenantId, categoryId, supplierId, storeId, ...rest } = data as any; // explicit any to catch storeId if missing in type

    const finalCategoryId = categoryId || (await this.getDefaultCategoryId(tenantId));

    return prisma.product.create({
      data: {
        ...rest,
        price: data.price, // Prisma handles string -> Decimal
        costPrice: data.costPrice,
        minStockLevel: data.minStockLevel || 0,
        barcode:
          data.barcode === "" || data.barcode === null ? null : data.barcode,
        tenant: { connect: { id: tenantId } },
        category: categoryId ? { connect: { id: categoryId } } : undefined, // Optional connection
        store: storeId ? { connect: { id: storeId } } : undefined, // Explicit connect
        ...(supplierId ? { supplier: { connect: { id: supplierId } } } : {}),
      },
      include: { category: true } // Return with category
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
    if (updateData.price !== undefined && updateData.price !== null) {
      const p = parseFloat(updateData.price.toString());
      if (isNaN(p)) throw new Error("Invalid Price");
      updateData.price = p;
    }
    if (updateData.costPrice !== undefined) {
      if (updateData.costPrice === "" || updateData.costPrice === null) {
        updateData.costPrice = 0;
      } else {
        const c = parseFloat(updateData.costPrice.toString());
        updateData.costPrice = isNaN(c) ? 0 : c;
      }
    }
    if (updateData.minStockLevel !== undefined && updateData.minStockLevel !== null) {
      const m = parseInt(updateData.minStockLevel.toString());
      updateData.minStockLevel = isNaN(m) ? 0 : m;
    }

    // Sanitize Strings
    if (updateData.barcode === "" || updateData.barcode === null) {
      updateData.barcode = null;
    }
    if (updateData.category === "" || updateData.category === null) {
      delete updateData.category; // Legacy
    } else if (updateData.category) {
      updateData.categoryId = updateData.category;
      delete updateData.category;
    }

    // Sanitize categoryId (Frontend sends "" for clear/empty)
    if (updateData.categoryId === "" || updateData.categoryId === null) {
      updateData.categoryId = null;
    }
    if (updateData.supplierId === "" || updateData.supplierId === null) {
      updateData.supplierId = null;
    }

    try {
      return await prisma.product.update({
        where: { id },
        data: updateData,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException("Product with this SKU or Barcode already exists.");
      }
      if (error.code === 'P2003') {
        throw new BadRequestException("Invalid Supplier or Category reference (ID mismatch).");
      }
      if (error.code === 'P2025') {
        throw new BadRequestException("Product not found.");
      }
      // Re-throw generic limits/other errors
      throw error;
    }
  }

  async archive(id: string) {
    return prisma.product.update({
      where: { id },
      data: { isArchived: true }
    });
  }

  async unarchive(id: string) {
    return prisma.product.update({
      where: { id },
      data: { isArchived: false }
    });
  }

  async findAll(
    tenantId: string,
    skip: number = 0,
    take: number = 50,
    filters: { search?: string; category?: string; lowStock?: boolean } = {},
    storeId?: string, // NEW: Optional Store Filter
    includeArchived: boolean = false // default hidden
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
                AND (${filters.category ? Prisma.sql`p."categoryId" = ${filters.category}` : Prisma.sql`1=1`})
                AND (
                    p.name ILIKE ${searchTerm} OR 
                    p.sku ILIKE ${searchTerm} OR 
                    p.barcode ILIKE ${searchTerm}
                )
                GROUP BY p.id
                HAVING COALESCE(SUM(i.quantity), 0) <= COALESCE(p."minStockLevel", 0) OR COALESCE(SUM(i.quantity), 0) = 0
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
                 ${storeId ? `AND (p."storeId" = '${storeId}' OR p."storeId" IS NULL OR i."storeId" = '${storeId}')` : ''}
                 AND (${filters.category ? `p."categoryId" = '${filters.category}'` : '1=1'})
                 AND (
                    p.name ILIKE '%${searchTerm}%' OR 
                    p.sku ILIKE '%${searchTerm}%' OR 
                    p.barcode ILIKE '%${searchTerm}%'
                 )
                 GROUP BY p.id
                 GROUP BY p.id
                 HAVING COALESCE(SUM(i.quantity), 0) <= COALESCE(p."minStockLevel", 0) OR COALESCE(SUM(i.quantity), 0) = 0
            `);
      const total = totalResult.length;

      const data = await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: {
          inventory: { where: storeId ? { storeId } : undefined },
          supplier: true
        },
        orderBy: { name: "asc" },
      });

      return { total, data };
    }

    // Standard Prisma Query for non-lowStock filters
    // STRICT ISOLATION: If storeId is provided, we strictly filter by it.

    const where: any = { tenantId };

    if (!includeArchived) {
      where.isArchived = false;
    }

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
      where.categoryId = filters.category;
    }

    // STRICT STORE ISOLATION -> NOW ALLOWS GLOBAL PRODUCTS AND SHARED INVENTORY
    if (storeId) {
      where.AND = [
        {
          OR: [
            { storeId: storeId },
            { storeId: null },
            // Also visible if this store has inventory records for it
            { inventory: { some: { storeId: storeId } } }
          ]
        }
      ];
    }

    const [total, data] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: {
          inventory: { where: storeId ? { storeId } : undefined },
          supplier: true,
          category: true,
        },
        skip,
        take,
        orderBy: { name: "asc" },
      }),
    ]);

    /* console.log(
      `[ProductsService] findAll for ${tenantId} (Store: ${storeId || 'All'}): found ${data.length} items (total count: ${total}) with where clause: ${JSON.stringify(where)}`,
    ); */
    return { total, data };
  }

  async getStats(tenantId: string, storeId?: string) {
    // 1. Total Products (Strict Isolation)
    const productWhere: any = { tenantId };
    if (storeId) {
      productWhere.OR = [
        { storeId: storeId },
        { storeId: null },
        { inventory: { some: { storeId: storeId } } }
      ];
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

      const minStock = p.minStockLevel || 0; // Null Safety
      if (totalQty <= minStock || totalQty === 0) {
        lowStockCount++;
      }
    }

    /* console.log(
      `[ProductsService] getStats for ${tenantId}: totalProducts=${totalProducts}, inventoryValue=${totalValue.toFixed(2)}, lowStockCount=${lowStockCount}`,
    ); */
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
        category: true,
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

  private async getDefaultCategoryId(tenantId: string): Promise<string> {
    const category = await prisma.productCategory.findFirst({
      where: { tenantId, name: 'Uncategorized' },
      select: { id: true }
    });
    if (category) return category.id;

    // Fallback: Create if missing (Self-Healing)
    const newCat = await prisma.productCategory.create({
      data: { name: 'Uncategorized', tenantId, status: 'ACTIVE' }
    });
    return newCat.id;
  }
}
