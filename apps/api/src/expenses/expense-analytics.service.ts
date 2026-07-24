import { Injectable, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SalesService } from "../sales/sales.service";
import { PERMISSIONS } from "../common/constants/permissions";
import {
  RequestUser,
  resolveReadScope,
  hasPermission,
  monthToDateRange,
  previousMonthToDateRange,
  parseDateRange,
} from "./expense-scope";

export interface DailyPoint {
  date: string;
  amount: number;
}

@Injectable()
export class ExpenseAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesService: SalesService,
  ) {}

  private baseWhere(
    tenantId: string,
    storeId: string | undefined,
    start: Date,
    end: Date,
  ): Prisma.ExpenseWhereInput {
    return {
      tenantId,
      isDeleted: false,
      ...(storeId ? { storeId } : {}),
      expenseDate: { gte: start, lte: end },
    };
  }

  private async totalFor(
    tenantId: string,
    storeId: string | undefined,
    start: Date,
    end: Date,
  ) {
    const result = await this.prisma.expense.aggregate({
      where: this.baseWhere(tenantId, storeId, start, end),
      _sum: { amount: true },
      _count: { _all: true },
      _max: { amount: true },
    });

    return {
      total: Number(result._sum.amount || 0),
      count: result._count._all,
      largest: Number(result._max.amount || 0),
    };
  }

  /** Daily series with zero-filled gaps so charts do not draw misleading jumps. */
  private async dailySeries(
    tenantId: string,
    storeId: string | undefined,
    start: Date,
    end: Date,
  ): Promise<DailyPoint[]> {
    const rows = await this.prisma.expense.findMany({
      where: this.baseWhere(tenantId, storeId, start, end),
      select: { expenseDate: true, amount: true },
      orderBy: { expenseDate: "asc" },
    });

    const byDay = new Map<string, number>();
    for (const row of rows) {
      const key = row.expenseDate.toISOString().split("T")[0];
      byDay.set(key, (byDay.get(key) || 0) + Number(row.amount));
    }

    const series: DailyPoint[] = [];
    const cursor = new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        start.getUTCDate(),
      ),
    );
    const last = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
    );

    // Hard stop so an absurd custom range cannot spin here.
    let guard = 0;
    while (cursor <= last && guard++ < 1100) {
      const key = cursor.toISOString().split("T")[0];
      series.push({ date: key, amount: byDay.get(key) || 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return series;
  }

  private async byCategory(
    tenantId: string,
    storeId: string | undefined,
    start: Date,
    end: Date,
  ) {
    const grouped = await this.prisma.expense.groupBy({
      by: ["categoryId"],
      where: this.baseWhere(tenantId, storeId, start, end),
      _sum: { amount: true },
      _count: { _all: true },
    });

    if (grouped.length === 0) return [];

    const categories = await this.prisma.expenseCategory.findMany({
      where: { id: { in: grouped.map((g) => g.categoryId) } },
      select: { id: true, name: true, color: true },
    });
    const byId = new Map(categories.map((c) => [c.id, c]));

    const total = grouped.reduce((sum, g) => sum + Number(g._sum.amount || 0), 0);

    return grouped
      .map((g) => {
        const amount = Number(g._sum.amount || 0);
        return {
          categoryId: g.categoryId,
          name: byId.get(g.categoryId)?.name || "Uncategorized",
          color: byId.get(g.categoryId)?.color || null,
          amount,
          count: g._count._all,
          percentage: total > 0 ? (amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }

  /**
   * Month-to-date expenses and net profit. Deliberately takes no date range —
   * this always covers the 1st of the current calendar month through now, and
   * is unaffected by any dashboard filter.
   */
  async getMonthToDate(user: RequestUser, requestedStoreId?: string) {
    const storeId = resolveReadScope(user, requestedStoreId);
    const { start, end } = monthToDateRange();
    const prev = previousMonthToDateRange();

    const [current, previous, series, categories] = await Promise.all([
      this.totalFor(user.tenantId, storeId, start, end),
      this.totalFor(user.tenantId, storeId, prev.start, prev.end),
      this.dailySeries(user.tenantId, storeId, start, end),
      this.byCategory(user.tenantId, storeId, start, end),
    ]);

    // Gross profit is owned by the sales module; it is consumed here, never
    // recalculated, so the two screens can never disagree.
    const grossProfit = await this.getGrossProfit(
      user.tenantId,
      start,
      end,
      storeId,
    );
    const prevGrossProfit = await this.getGrossProfit(
      user.tenantId,
      prev.start,
      prev.end,
      storeId,
    );

    const netProfit = grossProfit.profit - current.total;
    const prevNetProfit = prevGrossProfit.profit - previous.total;

    const daysElapsed = Math.max(
      1,
      Math.floor((end.getTime() - start.getTime()) / 86400000) + 1,
    );

    // Running net profit through the month, for the trend line.
    let runningExpense = 0;
    const netProfitSeries = series.map((point) => {
      runningExpense += point.amount;
      return { date: point.date, expenses: point.amount, runningExpense };
    });

    return {
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      monthLabel: start.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
      expenses: {
        total: current.total,
        count: current.count,
        largest: current.largest,
        averageDaily: current.total / daysElapsed,
        previousTotal: previous.total,
        change: this.percentageChange(previous.total, current.total),
      },
      grossProfit: {
        total: grossProfit.profit,
        previousTotal: prevGrossProfit.profit,
        change: this.percentageChange(
          prevGrossProfit.profit,
          grossProfit.profit,
        ),
      },
      revenue: {
        total: grossProfit.revenue,
        previousTotal: prevGrossProfit.revenue,
      },
      netProfit: {
        total: netProfit,
        previousTotal: prevNetProfit,
        change: this.percentageChange(prevNetProfit, netProfit),
      },
      expenseToSalesRatio:
        grossProfit.revenue > 0
          ? (current.total / grossProfit.revenue) * 100
          : null,
      dailySeries: series,
      netProfitSeries,
      categories,
    };
  }

  /**
   * Everything the Expenses page needs for an arbitrary reporting period.
   * Sales figures are only included for users cleared to see them.
   */
  async getSummary(
    user: RequestUser,
    from?: string,
    to?: string,
    requestedStoreId?: string,
  ) {
    const storeId = resolveReadScope(user, requestedStoreId);
    const { start, end } = this.resolvePeriod(from, to);

    // Same-length window immediately before the selected one.
    const duration = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - duration - 1);
    const prevEnd = new Date(start.getTime() - 1);

    const [current, previous, series, categories] = await Promise.all([
      this.totalFor(user.tenantId, storeId, start, end),
      this.totalFor(user.tenantId, storeId, prevStart, prevEnd),
      this.dailySeries(user.tenantId, storeId, start, end),
      this.byCategory(user.tenantId, storeId, start, end),
    ]);

    const days = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
    );

    const summary: Record<string, unknown> = {
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      expenses: {
        total: current.total,
        count: current.count,
        largest: current.largest,
        averageDaily: current.total / days,
        previousTotal: previous.total,
        change: this.percentageChange(previous.total, current.total),
      },
      dailySeries: series,
      categories,
      topCategories: categories.slice(0, 5),
    };

    if (hasPermission(user, PERMISSIONS.VIEW_FINANCIAL_REPORTS)) {
      const gross = await this.getGrossProfit(
        user.tenantId,
        start,
        end,
        storeId,
      );
      const prevGross = await this.getGrossProfit(
        user.tenantId,
        prevStart,
        prevEnd,
        storeId,
      );

      summary.financials = {
        totalSales: gross.revenue,
        grossProfit: gross.profit,
        totalExpenses: current.total,
        netProfit: gross.profit - current.total,
        previous: {
          totalSales: prevGross.revenue,
          grossProfit: prevGross.profit,
          totalExpenses: previous.total,
          netProfit: prevGross.profit - previous.total,
        },
        expenseToSalesRatio:
          gross.revenue > 0 ? (current.total / gross.revenue) * 100 : null,
        netMargin:
          gross.revenue > 0
            ? ((gross.profit - current.total) / gross.revenue) * 100
            : null,
      };
    }

    return summary;
  }

  /**
   * Spend over time at day/week/month resolution. The caller picks the bucket;
   * "auto" widens as the range grows so the chart never renders 400 bars.
   */
  async getTrend(
    user: RequestUser,
    from?: string,
    to?: string,
    requestedStoreId?: string,
    granularity: "day" | "week" | "month" | "auto" = "auto",
  ) {
    const storeId = resolveReadScope(user, requestedStoreId);
    const { start, end } = this.resolvePeriod(from, to);

    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const bucket =
      granularity !== "auto"
        ? granularity
        : days <= 62
          ? "day"
          : days <= 400
            ? "week"
            : "month";

    const daily = await this.dailySeries(user.tenantId, storeId, start, end);

    if (bucket === "day") {
      return { granularity: bucket, points: daily };
    }

    const grouped = new Map<string, number>();
    for (const point of daily) {
      const date = new Date(`${point.date}T00:00:00.000Z`);
      let key: string;

      if (bucket === "month") {
        key = point.date.slice(0, 7);
      } else {
        // Week starting Monday.
        const day = date.getUTCDay();
        const offset = day === 0 ? 6 : day - 1;
        const weekStart = new Date(date);
        weekStart.setUTCDate(date.getUTCDate() - offset);
        key = weekStart.toISOString().split("T")[0];
      }

      grouped.set(key, (grouped.get(key) || 0) + point.amount);
    }

    return {
      granularity: bucket,
      points: Array.from(grouped.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  /**
   * Per-store totals for the selected period. Restricted to users who can see
   * across stores — store-scoped users get a single row for their own store.
   */
  async getStoreBreakdown(
    user: RequestUser,
    from?: string,
    to?: string,
  ) {
    if (!hasPermission(user, PERMISSIONS.VIEW_ALL_STORE_EXPENSES)) {
      throw new ForbiddenException(
        "You do not have access to cross-store expense reporting.",
      );
    }

    const { start, end } = this.resolvePeriod(from, to);

    const grouped = await this.prisma.expense.groupBy({
      by: ["storeId"],
      where: this.baseWhere(user.tenantId, undefined, start, end),
      _sum: { amount: true },
      _count: { _all: true },
    });

    const stores = await this.prisma.store.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, name: true },
    });
    const byId = new Map(stores.map((s) => [s.id, s.name]));

    return grouped
      .map((g) => ({
        storeId: g.storeId,
        name: byId.get(g.storeId) || "Unknown store",
        amount: Number(g._sum.amount || 0),
        count: g._count._all,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  /**
   * Plain-language alerts for the current month. Each one is a fact the owner
   * would want to notice without going looking for it.
   */
  async getAlerts(user: RequestUser, requestedStoreId?: string) {
    const storeId = resolveReadScope(user, requestedStoreId);
    const { start, end } = monthToDateRange();
    const prev = previousMonthToDateRange();

    const [current, previous, categories, prevCategories] = await Promise.all([
      this.totalFor(user.tenantId, storeId, start, end),
      this.totalFor(user.tenantId, storeId, prev.start, prev.end),
      this.byCategory(user.tenantId, storeId, start, end),
      this.byCategory(user.tenantId, storeId, prev.start, prev.end),
    ]);

    const alerts: {
      severity: "info" | "warning";
      title: string;
      detail: string;
    }[] = [];

    const change = this.percentageChange(previous.total, current.total);
    if (change !== null && change >= 20 && previous.total > 0) {
      alerts.push({
        severity: "warning",
        title: `Expenses are up ${change.toFixed(1)}% on last month`,
        detail: `Month-to-date spend is ${current.total.toFixed(2)} against ${previous.total.toFixed(2)} over the same days last month.`,
      });
    } else if (change !== null && change <= -20 && previous.total > 0) {
      alerts.push({
        severity: "info",
        title: `Expenses are down ${Math.abs(change).toFixed(1)}% on last month`,
        detail: `Month-to-date spend is ${current.total.toFixed(2)} against ${previous.total.toFixed(2)} over the same days last month.`,
      });
    }

    // A single category swinging hard is more actionable than the total moving.
    const prevByName = new Map(prevCategories.map((c) => [c.name, c.amount]));
    for (const category of categories.slice(0, 5)) {
      const before = prevByName.get(category.name) || 0;
      const categoryChange = this.percentageChange(before, category.amount);
      if (categoryChange !== null && categoryChange >= 50 && before > 0) {
        alerts.push({
          severity: "warning",
          title: `${category.name} spending is up ${categoryChange.toFixed(0)}%`,
          detail: `${category.amount.toFixed(2)} so far this month, against ${before.toFixed(2)} over the same days last month.`,
        });
      }
    }

    // A single unusually large entry is worth a second look.
    if (current.count >= 5) {
      const average = current.total / current.count;
      if (current.largest > average * 5 && current.largest > 0) {
        alerts.push({
          severity: "info",
          title: "A single large expense was recorded this month",
          detail: `The largest entry is ${current.largest.toFixed(2)}, well above the ${average.toFixed(2)} average for the month.`,
        });
      }
    }

    if (hasPermission(user, PERMISSIONS.VIEW_FINANCIAL_REPORTS)) {
      const gross = await this.getGrossProfit(
        user.tenantId,
        start,
        end,
        storeId,
      );
      if (gross.revenue > 0) {
        const ratio = (current.total / gross.revenue) * 100;
        if (ratio >= 40) {
          alerts.push({
            severity: "warning",
            title: `Expenses are ${ratio.toFixed(0)}% of sales this month`,
            detail:
              "A high expense-to-sales ratio squeezes net profit. Review the top categories below.",
          });
        }
      }
      if (gross.profit - current.total < 0) {
        alerts.push({
          severity: "warning",
          title: "Net profit is negative month-to-date",
          detail: `Expenses of ${current.total.toFixed(2)} exceed gross profit of ${gross.profit.toFixed(2)}.`,
        });
      }
    }

    return alerts;
  }

  // ---------------------------------------------------------------- internals

  /** Defaults to the current calendar month when no range is supplied. */
  private resolvePeriod(from?: string, to?: string) {
    const parsed = parseDateRange(from, to);
    if (parsed.start && parsed.end) {
      return { start: parsed.start, end: parsed.end };
    }
    const mtd = monthToDateRange();
    return {
      start: parsed.start || mtd.start,
      end: parsed.end || mtd.end,
    };
  }

  /**
   * Reads revenue and gross profit from the sales module for a period.
   * `getStats` is the same call the dashboard uses, so the numbers match by
   * construction. A sales-side failure degrades to zeroes rather than taking
   * the whole expenses page down.
   */
  private async getGrossProfit(
    tenantId: string,
    start: Date,
    end: Date,
    storeId?: string,
  ): Promise<{ revenue: number; profit: number }> {
    try {
      const stats: any = await this.salesService.getStats(
        tenantId,
        start.toISOString(),
        end.toISOString(),
        storeId,
      );
      return {
        revenue: Number(stats?.filtered?.revenue || 0),
        profit: Number(stats?.filtered?.profit || 0),
      };
    } catch (e) {
      console.error("[Expenses] Could not read sales figures", e);
      return { revenue: 0, profit: 0 };
    }
  }

  private percentageChange(before: number, after: number): number | null {
    if (!before || before === 0) return null;
    return ((after - before) / Math.abs(before)) * 100;
  }
}
