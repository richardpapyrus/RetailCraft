import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { prisma } from "../prisma/client"; // shared pool (was new PrismaClient())

@Injectable()
export class ReturnsService {
  async createReturn(data: {
    saleId: string;
    items: { productId: string; quantity: number; restock: boolean }[];
    tenantId: string;
    userId: string;
    storeId: string;
  }) {
    const { saleId, items, tenantId, userId, storeId } = data;


    // 1. Fetch Sale with Items and Previous Returns
    const sale = await prisma.sale.findUnique({
      where: { id: saleId, tenantId },
      include: {
        items: true,
        returns: { include: { items: true } },
      },
    });

    if (!sale) throw new NotFoundException("Sale not found");

    let totalRefund = 0;
    const returnItemsData: any[] = [];
    const inventoryUpdates: any[] = [];

    // Refunds give back each item's share of what was actually paid — the sale
    // total after discounts, loyalty points and tax, spread over shelf value.
    // A sale paid entirely with points therefore refunds no cash.
    const saleSubtotal = Number(sale.subtotal);
    const paidRatio = saleSubtotal > 0 ? Number(sale.total) / saleSubtotal : 0;
    const shelfValueOf = (productId: string, quantity: number) =>
      Number(sale.items.find((si) => si.productId === productId)?.priceAtSale || 0) * quantity;
    const previouslyReturnedValue = sale.returns.reduce(
      (sum, ret) => sum + ret.items.reduce((s, ri) => s + shelfValueOf(ri.productId, ri.quantity), 0),
      0,
    );
    let returnedValue = 0;

    // 2. Validate Items
    for (const item of items) {
      const saleItem = sale.items.find((si) => si.productId === item.productId);
      if (!saleItem)
        throw new BadRequestException(
          `Product ${item.productId} was not part of this sale`,
        );

      // Calculate previously returned qty
      const previousReturned = sale.returns.reduce((sum, ret) => {
        const ri = ret.items.find((ri) => ri.productId === item.productId);
        return sum + (ri ? ri.quantity : 0);
      }, 0);

      const available = saleItem.quantity - previousReturned;
      if (item.quantity > available) {
        throw new BadRequestException(
          `Cannot return ${item.quantity} of product ${item.productId}. Only ${available} available.`,
        );
      }

      const lineValue = Number(saleItem.priceAtSale) * item.quantity;
      const refundAmount = Math.round(lineValue * paidRatio * 100) / 100;
      totalRefund += refundAmount;
      returnedValue += lineValue;

      returnItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        restock: item.restock,
        refundAmount: refundAmount,
      });

      if (item.restock) {
        // Prepare Inventory Update
        inventoryUpdates.push(
          prisma.inventory.upsert({
            where: {
              storeId_productId: { storeId, productId: item.productId },
            },
            update: { quantity: { increment: item.quantity } },
            create: {
              storeId,
              productId: item.productId,
              quantity: item.quantity,
            },
          }),
        );

        // Inventory Event
        inventoryUpdates.push(
          prisma.inventoryEvent.create({
            data: {
              storeId,
              productId: item.productId,
              type: "RETURN",
              quantity: item.quantity,
              reason: `Return for Sale ${sale.id}`,
              userId,
            },
          }),
        );
      }
    }

    // Loyalty: take back the returned share of points earned on the sale and
    // give back the returned share of points spent on it. Shares are cumulative
    // across partial returns so rounding never drifts. Balance floors at 0
    // when the customer has already spent the points being taken back.
    const loyaltyUpdates: any[] = [];
    if (sale.customerId && saleSubtotal > 0) {
      const pointsShare = (points: number, value: number) =>
        Math.round(points * Math.min(1, value / saleSubtotal));
      const pointsDelta = (points: number) =>
        pointsShare(points, previouslyReturnedValue + returnedValue) -
        pointsShare(points, previouslyReturnedValue);
      const earnedBack = pointsDelta(sale.loyaltyPointsEarned || 0);
      const usedBack = pointsDelta(sale.loyaltyPointsUsed || 0);
      const delta = usedBack - earnedBack;
      if (delta !== 0) {
        loyaltyUpdates.push(
          prisma.$executeRaw`UPDATE "Customer" SET "loyaltyPoints" = GREATEST(0, "loyaltyPoints" + ${delta}), "updatedAt" = NOW() WHERE "id" = ${sale.customerId}`,
        );
        console.log(`[ReturnsService] Loyalty for Sale ${sale.id}: -${earnedBack} earned, +${usedBack} redeemed restored`);
      }
    }

    // 3. Check for Active Till Session
    const tillSession = await prisma.tillSession.findFirst({
      where: {
        userId,
        status: "OPEN",
        till: { storeId },
      },
    });

    // 4. Prepare Till Update (if applicable)
    // If original sale was CASH, we assume refund is CASH out of till.
    // If original was CARD, typically refund is CARD (no cash movement), but depends on policy.
    // For now, let's assume if it is a "Return", we are giving money back.
    // Using sale.paymentMethod to determine.
    const transactionUpdates: any[] = [];

    // We only deduct from Till if the original payment was CASH or SPLIT involving Cash
    // Robust check: Handle case sensitivity and whitespace
    const pm = (sale.paymentMethod?.toString() || '').trim().toUpperCase();
    const isCashCalc = pm === 'CASH' || pm === 'SPLIT';

    console.log(`[ReturnsService] Processing Return for Sale ${sale.id}. Method: '${sale.paymentMethod}' -> Normalized: '${pm}'. ActiveSession: ${tillSession?.id}`);

    if (tillSession && isCashCalc) {
      // Fetch Sale Payments to calculate exact cash ratio
      const salePayments = await prisma.salePayment.findMany({ where: { saleId: sale.id } });
      let cashRatio = 1; // Default 100% cash if legacy or no records

      if (salePayments && salePayments.length > 0) {
        const totalPaid = salePayments.reduce((sum, p) => sum + Number(p.amount), 0);
        if (totalPaid > 0) {
          const cashPaid = salePayments.filter(p => p.method.toUpperCase() === 'CASH').reduce((sum, p) => sum + Number(p.amount), 0);

          // Deduct Change Given from Cash Paid to get Net Cash Paid
          const changeGiven = Number(sale.changeGiven || 0);
          const netCashPaid = Math.max(0, cashPaid - changeGiven);

          const netTotalPaid = Math.max(0, totalPaid - changeGiven);
          if (netTotalPaid > 0) {
            cashRatio = netCashPaid / netTotalPaid;
          } else {
            cashRatio = 0;
          }
        }
      }

      const exactCashRefund = totalRefund * cashRatio;

      if (exactCashRefund > 0) {
        transactionUpdates.push(
          prisma.cashTransaction.create({
            data: {
              tillSessionId: tillSession.id,
              type: 'CASH_OUT',
              amount: exactCashRefund,
              reason: `Refund for Sale #${sale.id.slice(0, 8)}`,
              description: `Items returned: ${items.map(i => i.productId).join(', ')} (Cash Portion)`
            }
          })
        );
        console.log(`[ReturnsService] Linked Refund to Till Session ${tillSession.id} as CASH_OUT for $${exactCashRefund.toFixed(2)} (Ratio: ${(cashRatio * 100).toFixed(1)}%)`);
      }
    } else {
      // Critical Debugging: If this was supposed to be a Cash Refund, but we didn't find a session, THROW ERROR.
      // Do not fail silently.
      if (isCashCalc && !tillSession) {
        throw new BadRequestException(
          `Refund Error: No Open Till Session found in Store '${storeId}'. You must have an OPEN till to process cash refunds.`
        );
      }

      console.warn(`[ReturnsService] Transaction SKIPPED. SessionFound: ${!!tillSession}, IsCash: ${isCashCalc}`);
    }

    // 5. Transaction
    return await prisma.$transaction([
      // Create Return Record
      prisma.salesReturn.create({
        data: {
          sale: { connect: { id: saleId } },
          tenant: { connect: { id: tenantId } },
          store: { connect: { id: storeId } },
          user: { connect: { id: userId } },
          total: totalRefund,
          reason: "Customer Return",
          items: {
            create: returnItemsData,
          },
        },
      }),
      // Execute Inventory Updates if any
      ...inventoryUpdates,
      // Execute Till Updates
      ...transactionUpdates,
      // Reverse loyalty points
      ...loyaltyUpdates,
    ]);
  }
}
