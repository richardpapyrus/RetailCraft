import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Query,
  Res,
} from "@nestjs/common";
import { SalesService } from "./sales.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient(); // Quick fix for querying default store helper if needed, better to use service

@InjectableHelper()
class InventoryHelper {
  static async getFirstStore() {
    return prisma.store.findFirst();
  }
}
function InjectableHelper() {
  return function (_target: any) { };
}

@Controller("sales")
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) { }

  @Get()
  async findAll(@Request() req, @Query("storeId") queryStoreId?: string) {
    let storeId = queryStoreId;
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.permissions?.includes('*');
    if (!isSystemAdmin) {
      if (req.user.storeId) storeId = req.user.storeId;
      else storeId = 'invalid-store-id';
    }
    return this.salesService.findAll(req.user.tenantId, storeId);
  }

  @Get("test-reload")
  testReload() {
    return { message: "Reloaded" };
  }

  @Get("stats")
  async getStats(
    @Request() req,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("storeId") queryStoreId?: string,
  ) {
    console.log(`[SalesController] getStats params: from=${from}, to=${to}, queryStoreId=${queryStoreId}`);
    console.log(`[SalesController] User: ${req.user.email}, Role: ${req.user.role}, StoreId: ${req.user.storeId}, Permissions: ${req.user.permissions}`);

    let storeId = queryStoreId;

    // Check if user has global access permissions
    // We allow explicit 'Administrator', 'ADMIN' roles, OR 'Owner', 'Manager'
    // Also check for '*' permission.
    const allowedGlobalRoles = ['Administrator', 'ADMIN', 'Owner', 'Manager'];
    const hasGlobalAccess = allowedGlobalRoles.includes(req.user.role) || req.user.permissions?.includes('*');

    if (!hasGlobalAccess) {
      if (req.user.storeId) storeId = req.user.storeId;
      else storeId = 'invalid-store-id'; // Lock out users with no store and no global access
    } else {
      // If system admin, allow undefined storeId (All stores)
      // If queryStoreId is provided, use it.
    }
    return this.salesService.getStats(req.user.tenantId, from, to, storeId);
  }

  @Get("top-products")
  async getTopProducts(
    @Request() req,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("sortBy") sortBy?: "value" | "count",
    @Query("limit") limit?: number,
    @Query("skip") skip?: number,
    @Query("storeId") queryStoreId?: string,
  ) {
    let storeId = queryStoreId;
    // Non-Admins are restricted to their assigned store
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.permissions?.includes('*');
    if (!isSystemAdmin) {
      if (req.user.storeId) storeId = req.user.storeId;
      else storeId = 'invalid-store-id'; // Prevent fallback
    }

    return this.salesService.getTopProducts(req.user.tenantId, {
      from,
      to,
      sortBy,
      limit: limit ? Number(limit) : 10,
      skip: skip ? Number(skip) : 0,
      storeId,
    });
  }

  @Get("export")
  async exportSales(
    @Request() req,
    @Res() res,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("storeId") queryStoreId?: string,
  ) {
    let storeId = queryStoreId;
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.permissions?.includes('*');
    if (!isSystemAdmin) {
      if (req.user.storeId) storeId = req.user.storeId;
      else storeId = 'invalid-store-id'; // Prevent fallback
    }

    const csv = await this.salesService.exportSales(
      req.user.tenantId,
      from,
      to,
      storeId,
    );

    res.set({
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="sales_export_${new Date().toISOString().slice(0, 10)}.csv"`,
    });

    res.send(csv);
  }

  @Post()
  async create(
    @Request() req,
    @Body()
    body: {
      items: any[];
      paymentMethod: string;
      customerId?: string;
      discount?: any;
      tillSessionId?: string;
      redeemPoints?: number;
      storeId?: string;
    },
  ) {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    // Prioritize Body StoreId (for Admins operating POS), else User StoreId
    let storeId = body.storeId;

    const isSystemAdmin = req.user.role === 'Administrator' || req.user.permissions?.includes('*');

    if (!isSystemAdmin) {
      // Enforce assigned store for non-admins
      if (req.user.storeId) {
        storeId = req.user.storeId;
      } else {
        throw new Error("Operation denied: No store assigned to user");
      }
    }

    if (!storeId) {
      // Should not happen if POS enforces it, but purely for robustness
      throw new Error("Store ID required for sale");
    }

    return this.salesService.processSale({
      items: body.items,
      paymentMethod: body.paymentMethod,
      tenantId,
      storeId,
      userId,
      customerId: body.customerId,
      discount: body.discount,
      tillSessionId: body.tillSessionId,
      redeemPoints: body.redeemPoints,
    });
  }
}
