import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Injectable()
export class SalesService {
  async processSale(data: {
    items: { productId: string; quantity: number }[];
    paymentMethod: string; // 'CASH' | 'CARD'
    tenantId: string;
    storeId: string;
    userId: string;
    tillSessionId?: string; // Optional for now, but should be enforced
    customerId?: string;
    discount?: {
      id?: string;
      name?: string;
      type: "PERCENTAGE" | "FIXED";
      value: number;
    }; // Manual or System
    redeemPoints?: number; // New: Points to redeem
  }) {
    const {
      items,
      paymentMethod,
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
          include: { till: true } // Need to check storeId
        });
        if (!session) throw new BadRequestException("Invalid Till Session ID");
        if (session.status !== "OPEN")
          throw new BadRequestException("Till Session is not OPEN");

        // STRICT ISOLATION CHECK
        if (session.till.storeId !== storeId) {
          throw new BadRequestException(`Till Session belongs to a different store (${session.till.name}). Please switch stores or close the remote session.`);
        }
      }

      // 1. Resolve Discount (Securely)
      let resolvedDiscount = null;
      if (discount) {
        if (discount.id) {
          // System Discount: Fetch from DB to ensure validity and targeting
          const dbDiscount = await tx.discount.findUnique({
            where: { id: discount.id },
          });
          if (dbDiscount && dbDiscount.active) {
            const now = new Date();
            // Validation: Check validity dates
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
          // Manual Discount: Applies to ALL by default
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
        });
        if (!product)
          throw new BadRequestException(`Product ${item.productId} not found`);

        const lineTotal = Number(product.price) * item.quantity;
        subtotal += lineTotal;

        // Check eligibility for discount
        let isEligible = false;
        if (resolvedDiscount) {
          if (resolvedDiscount.targetType === "ALL") {
            isEligible = true;
          } else if (resolvedDiscount.targetType === "PRODUCT") {
            isEligible = resolvedDiscount.targetValues.includes(product.id);
          } else if (resolvedDiscount.targetType === "CATEGORY") {
            // Check if product category matches any target value
            // Assuming targetValues contains category names
            if (
              product.category &&
              resolvedDiscount.targetValues.includes(product.category)
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

        // NEW: Inventory Check
        // Note: This does not lock the row, so race conditions are possible in high-concurrency.
        // For a robust system, we should use Optimistic Concurrency Control or SELECT FOR UPDATE.
        // Given the current scope, a simple check is sufficient.
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
          // Fixed amount: cap at eligible subtotal (can't discount more than the items worth)
          discountAmount = Math.min(resolvedDiscount.value, eligibleSubtotal);
        }
      }

      // Loyalty Redemption Logic
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

        // Redemption Value: 1 Point = $0.10 (Hardcoded for now)
        const pointValue = 0.1;
        const redemptionValue = redeemPoints * pointValue;

        discountAmount += redemptionValue;
        pointsUsed = redeemPoints;

        // Deduct points
        await tx.customer.update({
          where: { id: customerId },
          data: { loyaltyPoints: { decrement: redeemPoints } },
        });
      }

      // Final safety cap (should already be handled by logic above but good to be safe)
      if (discountAmount > subtotal) discountAmount = subtotal;

      const taxableAmount = subtotal - discountAmount;

      // Loyalty Accrual Logic (Earn on Subtotal before tax, but after discount? Standard is usually effective spend)
      // Let's earn on taxableAmount (Spend after discounts). Rate: 1 Point per $1.
      let pointsEarned = 0;
      if (customerId) {
        pointsEarned = Math.floor(taxableAmount); // 1 point per $1.00
        if (pointsEarned > 0) {
          await tx.customer.update({
            where: { id: customerId },
            data: { loyaltyPoints: { increment: pointsEarned } },
          });
        }
      }

      // 4. Calculate Taxes
      // Fetch all active taxes for this tenant
      const activeTaxes = await tx.tax.findMany({
        where: { tenantId, active: true },
      });
      const totalTaxRate = activeTaxes.reduce(
        (sum, t) => sum + Number(t.rate),
        0,
      );
      const taxAmount = taxableAmount * totalTaxRate;

      const finalTotal = taxableAmount + taxAmount;

      // 5. Create Sale Record
      const sale = await tx.sale.create({
        data: {
          total: finalTotal,
          subtotal: subtotal,
          discountTotal: discountAmount,
          taxTotal: taxAmount,
          paymentMethod: paymentMethod,
          status: "COMPLETED",
          tenantId,
          storeId,
          userId,
          customerId,
          tillSessionId,
          loyaltyPointsUsed: pointsUsed,
          loyaltyPointsEarned: pointsEarned,
        },
      });

      // 6. Create SaleItems and Update Inventory
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

  async findAll(tenantId: string, storeId?: string) {
    const where: any = { tenantId };
    if (storeId) where.storeId = storeId;

    return prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        user: {
          select: { email: true, name: true }, // Include name
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getStats(
    tenantId: string,
    from?: string,
    to?: string,
    storeId?: string,
  ) {
    // Parse dates or default to "This Month"
    const now = new Date();
    const startOfPeriod = from
      ? new Date(from)
      : new Date(now.getFullYear(), now.getMonth(), 1);

    let endOfPeriod;
    if (to) {
      endOfPeriod = new Date(to);
      endOfPeriod.setHours(23, 59, 59, 999);
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

    // Calculate "Previous Period" for comparison (Same duration)
    const duration = endOfPeriod.getTime() - startOfPeriod.getTime();
    const startOfPrev = new Date(startOfPeriod.getTime() - duration);
    const endOfPrev = new Date(startOfPeriod.getTime()); // Approximately

    // Helper: Fetch aggregates for a range
    const getAggregates = async (start: Date, end: Date) => {
      const data = await prisma.sale.findMany({
        where: {
          tenantId,
          storeId: storeId || undefined,
          status: "COMPLETED",
          createdAt: { gte: start, lte: end },
        },
        include: { items: true },
      });

      let revenue = 0;
      let cost = 0;
      let tax = 0;
      const paymentBreakdown: Record<string, number> = {};

      data.forEach((sale) => {
        const total = Number(sale.total);
        revenue += total;
        tax += Number(sale.taxTotal || 0);

        const method = sale.paymentMethod || "UNKNOWN";
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + total;

        sale.items.forEach((item) => {
          cost += Number(item.costAtSale) * item.quantity;
        });
      });
      return {
        revenue,
        cost,
        tax,
        count: data.length,
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
        customer: { select: { name: true } },
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
      end.setHours(23, 59, 59, 999);
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
      endDt.setHours(23, 59, 59, 999);
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
}
