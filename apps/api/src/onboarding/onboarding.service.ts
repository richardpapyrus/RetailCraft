import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Injectable()
export class OnboardingService {
  constructor() {}

  async updateBusinessProfile(
    tenantId: string,
    data: { name: string; currency: string; locale: string },
  ) {
    // Update Tenant
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: data.name,
        currency: data.currency,
        locale: data.locale,
      },
    });

    // Also update the default store name to match business name if it's the only one
    // or just update the first store found.
    const store = await prisma.store.findFirst({ where: { tenantId } });
    if (store) {
      await prisma.store.update({
        where: { id: store.id },
        data: { name: data.name },
      });
    }
    return { success: true };
  }

  async updateStoreDetails(
    storeId: string,
    data: { name?: string; address: string; phone: string },
  ) {
    return prisma.store.update({
      where: { id: storeId },
      data: {
        name: data.name, // Optional update if provided
        address: data.address,
        phone: data.phone,
      },
    });
  }

  async createTax(tenantId: string, data: { name: string; rate: number }) {
    return prisma.tax.create({
      data: {
        name: data.name,
        rate: data.rate,
        tenantId,
        active: true,
      },
    });
  }

  async createProduct(
    tenantId: string,
    data: { name: string; price: number; sku: string },
  ) {
    // Check if SKU exists to avoid 500
    const existing = await prisma.product.findFirst({
      where: { sku: data.sku, tenantId },
    });

    if (existing) {
      // Update it instead of failing, or just return it
      return prisma.product.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          price: data.price,
        },
      });
    }

    return prisma.product.create({
      data: {
        name: data.name,
        price: data.price,
        sku: data.sku,
        tenantId,
      },
    });
  }

  async completeOnboarding(tenantId: string) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { onboardingCompleted: true },
    });
  }
}
