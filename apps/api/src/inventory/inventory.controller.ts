import { Controller, Post, Body, UseGuards, Request } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("inventory")
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) { }

  @Post("adjust")
  async adjustStock(
    @Request() req,
    @Body()
    body: {
      productId: string;
      quantity: number;
      reason: string;
      storeId?: string;
    },
  ) {
    const userId = req.user.userId;
    const userStoreId = req.user.storeId;
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.role === 'ADMIN' || req.user.permissions?.includes('*');

    let targetStoreId = body.storeId;



    // STRICT ENFORCEMENT
    if (!isSystemAdmin) {
      if (!userStoreId) {
        throw new Error("User has no assigned store and is not an Admin. Operation denied.");
      }
      targetStoreId = userStoreId;
    }

    if (!targetStoreId) {
      // Only Admins can reach here if they didn't provide body.storeId
      // Or if userStoreId was somehow valid but empty?
      const defaultStore = await this.inventoryService.getFirstStore(); // Fallback for Admins only
      if (defaultStore) targetStoreId = defaultStore.id;
      else throw new Error("Store ID required");
    }

    return this.inventoryService.adjustStock({
      productId: body.productId,
      storeId: targetStoreId,
      quantity: body.quantity,
      reason: body.reason,
      userId,
    });
  }

  @Post("restock")
  async restock(
    @Request() req,
    @Body()
    body: {
      productId: string;
      quantity: number;
      unitCost: number;
      newPrice?: number;
      storeId?: string;
      supplierName?: string;
    },
  ) {
    const userId = req.user.userId;
    const userStoreId = req.user.storeId;
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.role === 'ADMIN' || req.user.permissions?.includes('*');

    let targetStoreId = body.storeId;



    // STRICT ENFORCEMENT
    if (!isSystemAdmin) {
      if (!userStoreId) {
        throw new Error("User has no assigned store and is not an Admin. Operation denied.");
      }
      targetStoreId = userStoreId;
    }

    if (!targetStoreId) {
      const defaultStore = await this.inventoryService.getFirstStore();
      if (defaultStore) targetStoreId = defaultStore.id;
      else throw new Error("Store ID required");
    }

    return this.inventoryService.restock({
      productId: body.productId,
      storeId: targetStoreId,
      quantity: body.quantity,
      unitCost: body.unitCost,
      newPrice: body.newPrice,
      userId,
      supplierName: body.supplierName,
      tenantId: req.user.tenantId,
    });
  }
}
