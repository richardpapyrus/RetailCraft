import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Injectable()
export class TenantsService {
  async update(id: string, data: { currency?: string; locale?: string; logoUrl?: string; brandColor?: string }) {
    // If updating currency/locale, check if sales exist
    if (data.currency || data.locale) {
      // Check default store or all stores? All stores for this tenant.
      // Assuming tenantId column exists in Sale table (it generally should, or implicit via store)
      // Wait, Sale model might link to Store, which links to Tenant.
      // Let's check Schema if Sale has tenantId directly. Ideally yes for RLS.
      // If not, we query via Store.
      // prisma.sale.count({ where: { store: { tenantId: id } } })

      const salesCount = await prisma.sale.count({
        where: {
          store: {
            tenantId: id,
          },
        },
      });

      if (salesCount > 0) {
        // Check if the NEW currency is actually different from OLD currency.
        // Fetch current tenant settings.
        const currentTenant = await prisma.tenant.findUnique({ where: { id } });
        if (
          currentTenant &&
          (currentTenant.currency !== data.currency ||
            currentTenant.locale !== data.locale)
        ) {
          throw new BadRequestException(
            "Cannot change currency settings after transactions have been recorded. PLease contact support if you need to reset your account.",
          );
        }
      }
    }

    return prisma.tenant.update({
      where: { id },
      data,
    });
  }
}
