import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { prisma } from "../prisma/client";

@Injectable()
export class LoyaltyExpiryService {
  private readonly logger = new Logger(LoyaltyExpiryService.name);

  // Points reset when a customer hasn't bought anything for the tenant's
  // loyaltyExpiryDays (the Loyalty page describes it as "days after last
  // purchase"). Zero or less means points never expire.
  @Cron("0 2 * * *", { timeZone: "Africa/Lagos" })
  async expireLapsedPoints() {
    const tenants = await prisma.tenant.findMany({
      where: { loyaltyExpiryDays: { gt: 0 } },
      select: { id: true, loyaltyExpiryDays: true },
    });

    for (const tenant of tenants) {
      const cutoff = new Date(Date.now() - tenant.loyaltyExpiryDays * 24 * 60 * 60 * 1000);
      try {
        // A customer with points but no sale since the cutoff has lapsed. The
        // customer's own createdAt guards anyone added after the cutoff.
        const expired = await prisma.$executeRaw`
          UPDATE "Customer" c
          SET "loyaltyPoints" = 0, "updatedAt" = NOW()
          WHERE c."tenantId" = ${tenant.id}
            AND c."loyaltyPoints" > 0
            AND c."createdAt" < ${cutoff}
            AND NOT EXISTS (
              SELECT 1 FROM "Sale" s
              WHERE s."customerId" = c."id" AND s."createdAt" >= ${cutoff}
            )`;
        if (expired > 0) {
          this.logger.log(`Tenant ${tenant.id}: expired points for ${expired} customer(s) with no purchase since ${cutoff.toISOString()}`);
        }
      } catch (e) {
        this.logger.error(`Tenant ${tenant.id}: points expiry failed`, e as Error);
      }
    }
  }
}
