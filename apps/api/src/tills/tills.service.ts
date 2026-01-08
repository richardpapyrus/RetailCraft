import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Injectable()
export class TillsService {
  async createTill(data: { name: string; storeId: string; tenantId: string }) {
    return prisma.till.create({
      data: {
        name: data.name,
        storeId: data.storeId,
        tenantId: data.tenantId,
        status: "CLOSED",
      },
    });
  }

  async getTills(tenantId: string, storeId?: string) {
    return prisma.till.findMany({
      where: {
        tenantId,
        ...(storeId ? { storeId } : {}),
      },
      include: { sessions: { where: { status: "OPEN" } } },
    });
  }

  async updateTill(id: string, data: { name: string }) {
    return prisma.till.update({
      where: { id },
      data: { name: data.name },
    });
  }

  async deleteTill(id: string) {
    // Check for dependencies
    const sessionCount = await prisma.tillSession.count({
      where: { tillId: id },
    });
    if (sessionCount > 0) {
      throw new BadRequestException(
        "Cannot delete till with associated sessions. Close sessions or archive till instead.",
      );
    }
    return prisma.till.delete({ where: { id } });
  }

  async openSession(data: {
    tillId: string;
    userId: string;
    openingFloat: number;
  }) {
    // 1. Check if Till is actually IN USE (ignore status flag if stuck)
    const till = await prisma.till.findUnique({ where: { id: data.tillId } });
    if (!till) throw new NotFoundException("Till not found");

    // Robust Check: Look for an ACTUAL open session record.
    const existingSession = await prisma.tillSession.findFirst({
      where: { tillId: data.tillId, status: "OPEN" },
    });

    if (existingSession)
      throw new BadRequestException("Till is already open by another user");

    // 2. Check if User has another open session IN THIS STORE
    // We allow same user to have open sessions in DIFFERENT stores (e.g. multi-store manager)
    // But only one open session per store per user (usually).
    const userSession = await prisma.tillSession.findFirst({
      where: {
        userId: data.userId,
        status: "OPEN",
        till: {
          storeId: till.storeId
        }
      },
    });
    if (userSession)
      throw new BadRequestException("User already has an open till session in this store");

    return prisma.$transaction(async (tx) => {
      // Update Till Status
      await tx.till.update({
        where: { id: data.tillId },
        data: { status: "OPEN" },
      });

      // Create Session
      return tx.tillSession.create({
        data: {
          tillId: data.tillId,
          userId: data.userId,
          openingFloat: data.openingFloat,
          status: "OPEN",
          openedAt: new Date(),
        },
      });
    });
  }

  async getActiveSession(userId: string, storeId?: string) {
    return prisma.tillSession.findFirst({
      where: {
        userId,
        status: "OPEN",
        ...(storeId ? { till: { storeId } } : {})
      },
      include: { till: true },
    });
  }

  async getSessionSummary(sessionId: string) {
    const session = await prisma.tillSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException("Session not found");

    // Aggregate Sales (Cash)
    const sales = await prisma.sale.aggregate({
      where: { tillSessionId: sessionId, paymentMethod: "CASH" },
      _sum: { total: true },
    });

    // Aggregate Cash Transactions
    const cashIn = await prisma.cashTransaction.aggregate({
      where: { tillSessionId: sessionId, type: "CASH_IN" },
      _sum: { amount: true },
    });

    const cashOut = await prisma.cashTransaction.aggregate({
      where: { tillSessionId: sessionId, type: "CASH_OUT" },
      _sum: { amount: true },
    });

    const totalSales = Number(sales._sum.total || 0);
    const totalCashIn = Number(cashIn._sum.amount || 0);
    const totalCashOut = Number(cashOut._sum.amount || 0);
    const openingFloat = Number(session.openingFloat);

    const expectedCash = openingFloat + totalSales + totalCashIn - totalCashOut;

    return {
      ...session,
      totals: {
        sales: totalSales,
        cashIn: totalCashIn,
        cashOut: totalCashOut,
        expectedCash,
      },
    };
  }

  async closeSession(sessionId: string, closingCash: number) {
    const summary = await this.getSessionSummary(sessionId);
    const expected = summary.totals.expectedCash;
    const variance = closingCash - expected;

    return prisma.$transaction(async (tx) => {
      // Update Session
      const session = await tx.tillSession.update({
        where: { id: sessionId },
        data: {
          closingCash,
          expectedCash: expected,
          variance,
          status: "CLOSED",
          closedAt: new Date(),
        },
      });

      // Update Till Status
      await tx.till.update({
        where: { id: session.tillId },
        data: { status: "CLOSED" },
      });

      return session;
    });
  }

  async recordTransaction(data: {
    tillSessionId: string;
    type: "CASH_IN" | "CASH_OUT";
    amount: number;
    reason: string;
    userId: string;
  }) {
    return prisma.cashTransaction.create({
      data: {
        tillSessionId: data.tillSessionId,
        type: data.type,
        amount: data.amount,
        reason: data.reason,
      },
    });
  }
  async getTillSessions(tillId: string) {
    return prisma.tillSession.findMany({
      where: {
        tillId,
        status: "CLOSED",
      },
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: {
        openedAt: "desc",
      },
    });
  }
}
