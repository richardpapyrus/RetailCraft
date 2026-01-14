import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from "@nestjs/common";
import { SuppliersService } from "./suppliers.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("suppliers")
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) { }

  @Post()
  create(@Request() req, @Body() body: any) {
    let targetStoreId = body.storeId;
    // Strict RBAC
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.permissions?.includes('*');
    if (!isSystemAdmin) {
      if (!req.user.storeId) throw new Error("Operation denied: No store assigned");
      targetStoreId = req.user.storeId;
    }

    if (!targetStoreId) {
      throw new Error("Store Context is required to create a Supplier. Global suppliers are not allowed.");
    }

    return this.suppliersService.create({
      ...body,
      tenantId: req.user.tenantId,
      storeId: targetStoreId, // Pass to service
    });
  }

  @Get()
  findAll(@Request() req, @Query("storeId") queryStoreId?: string, @Query("search") search?: string) {
    let storeId = queryStoreId;
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.permissions?.includes('*');
    if (!isSystemAdmin) {
      if (req.user.storeId) storeId = req.user.storeId;
      else storeId = 'invalid-store-id';
    }
    return this.suppliersService.findAll(req.user.tenantId, storeId, search);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Request() req) {
    return this.suppliersService.findOne(id, req.user.tenantId);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: any, @Request() req) {
    return this.suppliersService.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Request() req) {
    // TODO: Check permissions or if used in POs
    return this.suppliersService.remove(id);
  }

  @Post(":id/products")
  addProduct(
    @Param("id") id: string,
    @Body() body: { productId: string, supplierSku?: string, lastCost: number, isPreferred?: boolean },
    @Request() req
  ) {
    return this.suppliersService.addProduct(id, body.productId, body);
  }

  @Delete(":id/products/:productId")
  removeProduct(@Param("id") id: string, @Param("productId") productId: string) {
    return this.suppliersService.removeProduct(id, productId);
  }

  @Get(":id/reorder-items")
  getReorderItems(@Param("id") id: string, @Query("storeId") storeId: string, @Request() req) {
    const targetStore = storeId || req.user.storeId;
    if (!targetStore) throw new Error("Store Context Required");
    return this.suppliersService.findReorderItems(id, targetStore);
  }
}
