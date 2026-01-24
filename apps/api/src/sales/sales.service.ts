import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

@Injectable()
export class SalesService {
  async processSale(data: {
    items: { productId: string; quantity: number }[];
    paymentMethod?: string; // Legacy/Fallback
    payments?: { method: string; amount: number; reference?: string }[]; // New Multi-Tender
    tenantId: string;
    storeId: string;
    userId: string;
    tillSessionId?: string;
    customerId?: string;
    discount?: {
      id?: string;
      name?: string;
      type: "PERCENTAGE" | "FIXED";
      value: number;
    };
    redeemPoints?: number;
  }) {
    const {
      items,
      paymentMethod,
      payments,
      tenantId,
      storeId,
      userId,
      tillSessionId,
      discount,
      redeemPoints,
    } = data;
    let customerId = data.customerId;

    return prisma.$transaction(async (tx) => {
      // 0. Handle Walk-in Customer
      if (!customerId) {
        const walkIn = await tx.customer.findFirst({
          where: {
            tenantId,
            OR: [{ code: "WALKIN" }, { name: "Walk-in Customer" }],
          },
        });
        if (walkIn) customerId = walkIn.id;
      }

      // 0.5 Verify Till Session (If provided)
      if (tillSessionId) {
        const session = await tx.tillSession.findUnique({
          where: { id: tillSessionId },
          include: { till: true },
        });
        if (!session) throw new BadRequestException("Invalid Till Session ID");
        if (session.status !== "OPEN")
          throw new BadRequestException("Till Session is not OPEN");

        if (session.till.storeId !== storeId) {
          throw new BadRequestException(
            `Till Session belongs to a different store (${session.till.name}). Please switch stores or close the remote session.`,
          );
        }
      }

      // 1. Resolve Discount
      let resolvedDiscount = null;
      if (discount) {
        if (discount.id) {
          const dbDiscount = await tx.discount.findUnique({
            where: { id: discount.id },
          });
          if (dbDiscount && dbDiscount.active) {
            const now = new Date();
            const isValid =
              (!dbDiscount.startDate || now >= dbDiscount.startDate) &&
              (!dbDiscount.endDate || now <= dbDiscount.endDate);

            if (isValid) {
              resolvedDiscount = {
                type: dbDiscount.type,
                value: Number(dbDiscount.value),
                targetType: dbDiscount.targetType,
                targetValues: dbDiscount.targetValues,
              };
            }
          }
        } else {
          resolvedDiscount = {
            type: discount.type,
            value: discount.value,
            targetType: "ALL",
            targetValues: [],
          };
        }
      }

      // 2. Calculate Subtotal & Verify Items
      let subtotal = 0;
      let eligibleSubtotal = 0;
      const itemSnapshots = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { category: true }
        });
        if (!product)
          throw new BadRequestException(`Product ${item.productId} not found`);

        const lineTotal = Number(product.price) * item.quantity;
        subtotal += lineTotal;

        let isEligible = false;
        if (resolvedDiscount) {
          if (resolvedDiscount.targetType === "ALL") {
            isEligible = true;
          } else if (resolvedDiscount.targetType === "PRODUCT") {
            isEligible = resolvedDiscount.targetValues.includes(product.id);
          } else if (resolvedDiscount.targetType === "CATEGORY") {
            if (
              product.category &&
              // Use name for legacy compatibility or ID? Using Name is safer for "Electronics" stored in discounts
              resolvedDiscount.targetValues.includes(product.category.name)
            ) {
              isEligible = true;
            }
          }
        }

        if (isEligible) {
          eligibleSubtotal += lineTotal;
        }

        itemSnapshots.push({
          productId: item.productId,
          quantity: item.quantity,
          priceAtSale: product.price,
          costAtSale: product.costPrice || 0,
        });

        // Inventory Check
        const inventory = await tx.inventory.findUnique({
          where: { storeId_productId: { storeId, productId: item.productId } },
        });
        const currentStock = inventory?.quantity || 0;
        if (currentStock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}". Available: ${currentStock}, Requested: ${item.quantity}`,
          );
        }
      }

      // 3. Calculate Discount Amount
      let discountAmount = 0;
      if (resolvedDiscount && eligibleSubtotal > 0) {
        if (resolvedDiscount.type === "PERCENTAGE") {
          discountAmount = eligibleSubtotal * (resolvedDiscount.value / 100);
        } else {
          discountAmount = Math.min(resolvedDiscount.value, eligibleSubtotal);
        }
      }

      // Fetch Tenant Loyalty Settings
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId }
      });
      const earnRate = Number(tenant?.loyaltyEarnRate) || 1.0;
      const redeemRate = Number(tenant?.loyaltyRedeemRate) || 0.10;

      // Loyalty Redemption
      let pointsUsed = 0;
      if (redeemPoints && redeemPoints > 0) {
        if (!customerId)
          throw new BadRequestException("Customer required to redeem points");
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });
        if (!customer) throw new BadRequestException("Customer not found");
        if (customer.loyaltyPoints < redeemPoints)
          throw new BadRequestException("Insufficient loyalty points");

        const redemptionValue = redeemPoints * redeemRate;

        discountAmount += redemptionValue;
        pointsUsed = redeemPoints;

        await tx.customer.update({
          where: { id: customerId },
          data: { loyaltyPoints: { decrement: redeemPoints } },
        });
      }

      if (discountAmount > subtotal) discountAmount = subtotal;

      const taxableAmount = subtotal - discountAmount;

      // Loyalty Accrual
      let pointsEarned = 0;
      if (customerId) {
        // Re-fetch customer to check membership status if not already known? 
        // We fetched customer earlier ONLY if redeeming.
        // If not redeeming, we might not have 'customer' variable in scope or it might be partial.
        // Actually, we haven't fetched customer if redeemPoints was 0.

        const customerForAccrual = await tx.customer.findUnique({ where: { id: customerId } });

        if (customerForAccrual && customerForAccrual.isLoyaltyMember) {
          pointsEarned = Math.floor(taxableAmount * earnRate);
          if (pointsEarned > 0) {
            await tx.customer.update({
              where: { id: customerId },
              data: { loyaltyPoints: { increment: pointsEarned } },
            });
          }
        }
      }

      // 4. Calculate Taxes
      const activeTaxes = await tx.tax.findMany({
        where: { tenantId, active: true },
      });
      const totalTaxRate = activeTaxes.reduce(
        (sum, t) => sum + Number(t.rate),
        0,
      );
      const taxAmount = taxableAmount * totalTaxRate;
      const finalTotal = taxableAmount + taxAmount;

      // 5. Payment Logic (Multi-Tender)
      let finalPayments = payments || [];

      // If no explicit payments array, fallback to legacy method with Full Amount
      if (finalPayments.length === 0) {
        if (!paymentMethod) throw new BadRequestException("Payment Method required");
        finalPayments = [{ method: paymentMethod, amount: finalTotal }];
      }

      // Validate Totals (Allow tolerance for float math)
      const totalPaid = finalPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      // Allow overpayment (Change), but reject underpayment
      // Tolerance 0.01
      if (totalPaid < finalTotal - 0.01) {
        throw new BadRequestException(`Insufficient Payment. Total: ${finalTotal.toFixed(2)}, Paid: ${totalPaid.toFixed(2)}`);
      }

      // Determine Summary Method
      const isSplit = finalPayments.length > 1;
      const summaryMethod = isSplit ? "SPLIT" : finalPayments[0].method;

      const changeGiven = Math.max(0, totalPaid - finalTotal);

      // 6. Create Sale
      const sale = await tx.sale.create({
        data: {
          total: finalTotal,
          subtotal: subtotal,
          discountTotal: discountAmount,
          taxTotal: taxAmount,
          paymentMethod: summaryMethod,

          payments: {
            create: finalPayments.map(p => ({
              method: p.method,
              amount: p.amount,
              reference: p.reference
            }))
          },
          status: "COMPLETED",
          tenant: { connect: { id: tenantId } },
          store: { connect: { id: storeId } },
          user: { connect: { id: userId } },
          customer: customerId ? { connect: { id: customerId } } : undefined,
          tillSession: tillSessionId ? { connect: { id: tillSessionId } } : undefined,
          loyaltyPointsUsed: pointsUsed,
          loyaltyPointsEarned: pointsEarned,
        },
      });

      // 7. Create SaleItems and Update Inventory
      for (const item of itemSnapshots) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            quantity: item.quantity,
            priceAtSale: item.priceAtSale,
            costAtSale: item.costAtSale,
          },
        });

        await tx.inventory.upsert({
          where: { storeId_productId: { storeId, productId: item.productId } },
          update: { quantity: { decrement: item.quantity } },
          create: {
            storeId,
            productId: item.productId,
            quantity: -item.quantity,
          },
        });

        await tx.inventoryEvent.create({
          data: {
            type: "SALE",
            quantity: -item.quantity,
            reason: `Sale #${sale.id.slice(0, 8)}`,
            storeId,
            productId: item.productId,
            userId,
          },
        });
      }

      return sale;
    });
  }

  async findAll(tenantId: string, storeId?: string, skip?: number, take?: number, search?: string) {
    // console.log(`[SalesService] findAll: search="${search}", storeId="${storeId}"`);
    const where: Prisma.SaleWhereInput = { tenantId };
    if (storeId) where.storeId = storeId;

    if (search) {
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          search
        )
      ) {
        // Exact UUID match optimized
        where.id = search;
      } else {
        where.OR = [
          { id: { contains: search.replace(/^#/, ''), mode: 'insensitive' } }, // Partial ID match (short codes)
          { customer: { name: { contains: search, mode: 'insensitive' } } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } }, // Added Email
          { items: { some: { product: { name: { contains: search, mode: 'insensitive' } } } } } // Added Product Name
        ];
      }
    }

    const [data, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take,
        include: {
          items: {
            include: {
              product: true,
            },
          },
          payments: true, // Include split details
          returns: {
            include: {
              items: true
            }
          },
          customer: true,
          user: {
            select: { email: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.sale.count({ where })
    ]);

    return { data, total };
  }

  async getStats(
    tenantId: string,
    from?: string,
    to?: string,
    storeId?: string,
  ) {
    const now = new Date();
    const startOfPeriod = from
      ? new Date(from)
      : new Date(now.getFullYear(), now.getMonth(), 1);

    let endOfPeriod;
    if (to) {
      endOfPeriod = new Date(to);
      endOfPeriod.setUTCHours(23, 59, 59, 999);
    } else {
      endOfPeriod = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      );
    }

    const duration = endOfPeriod.getTime() - startOfPeriod.getTime();
    const startOfPrev = new Date(startOfPeriod.getTime() - duration);
    const endOfPrev = new Date(startOfPeriod.getTime());

    const getAggregates = async (start: Date, end: Date) => {
      // 1. Fetch Sales (GROSS)
      const sales = await prisma.sale.findMany({
        where: {
          tenantId,
          storeId: storeId || undefined,
          status: "COMPLETED",
          createdAt: { gte: start, lte: end },
        },
        include: { items: true, payments: true },
      });

      // 2. Fetch Returns (Regardless of when sale happened, but RETURN happened in period)
      const returns = await prisma.salesReturn.findMany({
        where: {
          tenantId,
          storeId: storeId || undefined,
          createdAt: { gte: start, lte: end },
        },
        include: {
          items: true,
          sale: {
            include: {
              payments: true,
              items: true // Needed for Cost Lookup
            }
          }
        }
      });

      let revenue = 0;
      let cost = 0;
      let tax = 0;
      const paymentBreakdown: Record<string, number> = {};

      // A. Process Sales (Add)
      sales.forEach((sale) => {
        const total = Number(sale.total);
        revenue += total;
        tax += Number(sale.taxTotal || 0);

        if (sale.payments && sale.payments.length > 0) {
          sale.payments.forEach(p => {
            const m = p.method;
            paymentBreakdown[m] = (paymentBreakdown[m] || 0) + Number(p.amount);
          });
        } else {
          const method = sale.paymentMethod || "UNKNOWN";
          paymentBreakdown[method] = (paymentBreakdown[method] || 0) + total;
        }

        sale.items.forEach((item) => {
          cost += Number(item.costAtSale) * item.quantity;
        });
      });

      // B. Process Returns (Subtract)
      returns.forEach((ret) => {
        const refundAmount = Number(ret.total);
        revenue -= refundAmount;

        const saleTotal = Number(ret.sale.total);
        const saleTax = Number(ret.sale.taxTotal);
        if (saleTotal > 0) {
          tax -= (refundAmount / saleTotal) * saleTax;
        }

        const sale = ret.sale;
        if (sale.payments && sale.payments.length > 0) {
          const totalPaid = sale.payments.reduce((s, p) => s + Number(p.amount), 0);
          if (totalPaid > 0) {
            sale.payments.forEach(p => {
              const m = p.method;
              const ratio = Number(p.amount) / totalPaid;
              const portion = refundAmount * ratio;
              paymentBreakdown[m] = (paymentBreakdown[m] || 0) - portion;
            });
          }
        } else {
          const method = sale.paymentMethod || "UNKNOWN";
          paymentBreakdown[method] = (paymentBreakdown[method] || 0) - refundAmount;
        }

        // Adjust Cost (Re-stocking)
        ret.items.forEach(ri => {
          if (ri.restock) {
            // Find original cost
            const originalItem = sale.items.find(si => si.productId === ri.productId);
            if (originalItem) {
              cost -= Number(originalItem.costAtSale) * ri.quantity;
            }
          }
        });
      });

      return {
        revenue,
        cost,
        tax,
        count: sales.length,
        profit: revenue - cost,
        paymentBreakdown,
      };
    };

    const current = await getAggregates(startOfPeriod, endOfPeriod);
    const previous = await getAggregates(startOfPrev, endOfPrev);

    // Chart Data (Group by Day, showing Current vs Previous trend if overlapping? Actually logic requested is "Layered")
    // Simply returning daily data for Current Period for now, and maybe a "prevRevenue" if we align dates.
    // Simplified Trend: Just return daily revenue/profit for proper graphing.

    // MTD Logic for Chart (Layered)
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    // Previous Month Data for Chart Layering
    const startOfPrevMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );
    const endOfPrevMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59),
    );

    // Fetch MTD Chart Data
    const mtdSales = await prisma.sale.findMany({
      where: {
        tenantId,
        storeId: storeId || undefined, // Filter by store
        status: "COMPLETED",
        createdAt: { gte: startOfMonth },
      },
      select: { createdAt: true, total: true },
    });

    const prevMonthSales = await prisma.sale.findMany({
      where: {
        tenantId,
        storeId: storeId || undefined,
        status: "COMPLETED",
        createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth },
      },
      select: { createdAt: true, total: true },
    });

    // Group by "Day of Month" (1-31) for comparison
    const trendMap = new Map<number, { current: number; previous: number }>();

    mtdSales.forEach((s) => {
      const day = s.createdAt.getUTCDate();
      const curr = trendMap.get(day) || { current: 0, previous: 0 };
      curr.current += Number(s.total);
      trendMap.set(day, curr);
    });

    prevMonthSales.forEach((s) => {
      const day = s.createdAt.getUTCDate();
      const curr = trendMap.get(day) || { current: 0, previous: 0 };
      curr.previous += Number(s.total);
      trendMap.set(day, curr);
    });

    // Generate array for 1-31 (Max days in month)
    // Note: Number of days in current UTC month
    const daysInCurrentMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const trendChartData = [];
    const todayDay = now.getUTCDate();

    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const data = trendMap.get(i) || { current: 0, previous: 0 };

      // Logic: If i > today, set current to null
      let currentVal: number | null = data.current;
      if (i > todayDay) {
        currentVal = null;
      }

      trendChartData.push({
        day: i,
        current: currentVal,
        previous: data.previous,
      });
    }

    // Recent Sales
    const recentSales = await prisma.sale.findMany({
      where: {
        tenantId,
        storeId: storeId || undefined,
      },
      take: 10, // Increased to 10
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { email: true, name: true } },
        customer: { select: { name: true, code: true } },
        items: { include: { product: true } },
        payments: true,
        returns: { include: { items: true } },
      },
    });
    return {
      filtered: current,
      comparison: previous,
      trendChartData,
      recentSales,
    };
  }

  async getTopProducts(
    tenantId: string,
    options: {
      from?: string;
      to?: string;
      sortBy?: "value" | "count";
      limit?: number;
      skip?: number;
      storeId?: string;
    },
  ) {
    const {
      from,
      to,
      sortBy = "value",
      limit = 10,
      skip = 0,
      storeId,
    } = options;

    const now = new Date();
    const start = from
      ? new Date(from)
      : new Date(now.getFullYear(), now.getMonth(), 1); // Default This Month

    let end;
    if (to) {
      end = new Date(to);
      end.setUTCHours(23, 59, 59, 999);
    } else {
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    // Fetch all sales items for the period (Efficient enough for local-first/SMB)
    // We query SaleItems directly joined with Sale to filter by Tenant/Date
    const items = await prisma.saleItem.findMany({
      where: {
        sale: {
          tenantId,
          storeId: storeId || undefined,
          status: "COMPLETED",
          createdAt: { gte: start, lte: end },
        },
      },
    });

    // Aggregate in memory
    const productStats = new Map<string, { quantity: number; value: number }>();

    items.forEach((item) => {
      const stats = productStats.get(item.productId) || {
        quantity: 0,
        value: 0,
      };
      stats.quantity += item.quantity;
      stats.value += Number(item.priceAtSale) * item.quantity;
      productStats.set(item.productId, stats);
    });

    // Convert to array
    const aggregated = Array.from(productStats.entries()).map(
      ([productId, stats]) => ({
        productId,
        quantity: stats.quantity,
        value: stats.value,
      }),
    );

    // Sort
    aggregated.sort((a, b) => {
      if (sortBy === "count") return b.quantity - a.quantity;
      return b.value - a.value;
    });

    // Pagination
    const totalCount = aggregated.length;
    const paged = aggregated.slice(skip, skip + limit);

    // Enrich with Product Details
    const productIds = paged.map((p) => p.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });

    const result = paged.map((stat) => {
      const prod = products.find((p) => p.id === stat.productId);
      return {
        ...stat,
        name: prod?.name || "Unknown",
        sku: prod?.sku || "N/A",
      };
    });

    return {
      data: result,
      total: totalCount,
    };
  }
  async exportSales(
    tenantId: string,
    from?: string,
    to?: string,
    storeId?: string,
  ) {
    // const { filtered } = await this.getStats(tenantId, from, to, storeId); // Unused

    // filtered is an Aggregate? No, getStats logic is a bit weird.
    // wait, getStats calls `getAggregates` which returns { revenue, cost, count, profit }.
    // But getStats ALSO returns `recentSales` (take: 10).
    // I need ALL sales for the period.

    // Re-implement simplified fetch for export
    const now = new Date();

    // Default to *All Time* if no dates provided for export? Or reuse consistent defaults.
    // Let's reuse logic: If no dates, default to This Month.
    const startDt = from
      ? new Date(from)
      : new Date(now.getFullYear(), now.getMonth(), 1);

    let endDt;
    if (to) {
      endDt = new Date(to);
      endDt.setUTCHours(23, 59, 59, 999);
    } else {
      endDt = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const sales = await prisma.sale.findMany({
      where: {
        tenantId,
        storeId: storeId || undefined,
        status: "COMPLETED",
        createdAt: { gte: startDt, lte: endDt },
      },
      include: {
        items: { include: { product: true } },
        user: true,
        customer: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Generate CSV Header
    const header = [
      "Date",
      "Sale ID",
      "Cashier",
      "Customer",
      "Payment Method",
      "Items",
      "Subtotal",
      "Discount",
      "Tax",
      "Total",
    ].join(",");

    // Generate Rows
    const rows = sales.map((sale) => {
      const date = sale.createdAt.toISOString();
      const cashier = sale.user?.name || sale.userId;
      const customer = sale.customer?.name || "Walk-In";
      const items = sale.items
        .map((i) => `${i.product?.name || "Unknown"} x${i.quantity}`)
        .join(" | ");

      // Escape fields that might contain commas
      const escape = (str: string) => `"${str.replace(/"/g, '""')}"`;

      return [
        date,
        sale.id,
        escape(cashier || ""),
        escape(customer),
        sale.paymentMethod,
        escape(items),
        sale.subtotal,
        sale.discountTotal,
        sale.taxTotal,
        sale.total,
      ].join(",");
    });

    return [header, ...rows].join("\n");
  }

  async getProductSummary(
    tenantId: string,
    storeId?: string,
    from?: string,
    to?: string,
  ) {
    const now = new Date();
    const startDate = from ? new Date(from) : now;
    // Ensure start is 00:00:00
    startDate.setHours(0, 0, 0, 0);

    const endDate = to ? new Date(to) : new Date(startDate);
    // Ensure end is 23:59:59
    endDate.setHours(23, 59, 59, 999);

    console.log(`[SalesService] getProductSummary Params: from=${from}, to=${to}`);
    console.log(`[SalesService] Resolved Range: ${startDate.toISOString()} - ${endDate.toISOString()}`);

    // 1. Fetch Sales Items for the Range
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          tenantId,
          storeId: storeId || undefined,
          status: "COMPLETED",
          createdAt: { gte: startDate, lte: endDate },
        },
      },
      include: {
        product: true,
      },
    });

    // 2. Aggregate Data
    const summaryMap = new Map<string, {
      productId: string;
      name: string;
      sku: string;
      quantitySold: number;
      totalValue: number;
    }>();

    saleItems.forEach(item => {
      const existing = summaryMap.get(item.productId);
      if (existing) {
        existing.quantitySold += item.quantity;
        existing.totalValue += Number(item.priceAtSale) * item.quantity;
      } else {
        summaryMap.set(item.productId, {
          productId: item.productId,
          name: item.product?.name || 'Unknown',
          sku: item.product?.sku || 'N/A',
          quantitySold: item.quantity,
          totalValue: Number(item.priceAtSale) * item.quantity,
        });
      }
    });

    // 3. Fetch Current Inventory for these products
    const productIds = Array.from(summaryMap.keys());

    // We need inventory for the specific store if storeId is provided, or sum of all stores? 
    // Request implies "Current Stock" relevant to the sales view. 
    // If viewing ALL stores, stock should likely be SUM. 
    // If viewing specific store, stock should be specific store.

    const inventoryWhere: Prisma.InventoryWhereInput = {
      productId: { in: productIds },
    };
    if (storeId) {
      inventoryWhere.storeId = storeId;
    }

    const inventoryItems = await prisma.inventory.findMany({
      where: inventoryWhere,
    });

    // Map inventory by Product ID
    const stockMap = new Map<string, number>();
    inventoryItems.forEach(inv => {
      const current = stockMap.get(inv.productId) || 0;
      stockMap.set(inv.productId, current + inv.quantity);
    });

    // 4. Merge and Result
    const result = Array.from(summaryMap.values()).map(item => ({
      ...item,
      currentStock: stockMap.get(item.productId) || 0,
    }));

    // Sort by Quantity Sold Descending
    result.sort((a, b) => b.quantitySold - a.quantitySold);

    return result;
  }
}
