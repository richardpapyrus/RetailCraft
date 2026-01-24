import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

      // Calculate refund amount for this line (simple pro-rata of priceAtSale)
      // Note: Does not currently handle pro-rata of global discounts/taxes perfectly.
      // MVP: Refund = PriceAtSale * Qty.
      const refundAmount = Number(saleItem.priceAtSale) * item.quantity;
      totalRefund += refundAmount;

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
      transactionUpdates.push(
        prisma.cashTransaction.create({
          data: {
            tillSessionId: tillSession.id,
            type: 'CASH_OUT',
            amount: totalRefund,
            reason: `Refund for Sale #${sale.id.slice(0, 8)}`,
            description: `Items returned: ${items.map(i => i.productId).join(', ')}`
          }
        })
      );
      console.log(`[ReturnsService] Linked Refund to Till Session ${tillSession.id} as CASH_OUT`);
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
    ]);
  }
}
