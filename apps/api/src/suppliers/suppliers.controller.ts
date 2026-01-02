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
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.role === 'ADMIN' || req.user.permissions?.includes('*');
    if (!isSystemAdmin) {
      if (!req.user.storeId) throw new Error("Operation denied: No store assigned");
      targetStoreId = req.user.storeId;
    }

    return this.suppliersService.create({
      ...body,
      tenantId: req.user.tenantId,
      storeId: targetStoreId, // Pass to service
    });
  }

  @Get()
  findAll(@Request() req, @Query("storeId") queryStoreId?: string) {
    let storeId = queryStoreId;
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.role === 'ADMIN' || req.user.permissions?.includes('*');
    if (!isSystemAdmin) {
      if (req.user.storeId) storeId = req.user.storeId;
      else storeId = 'invalid-store-id';
    }
    return this.suppliersService.findAll(req.user.tenantId, storeId);
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
    return this.suppliersService.remove(id);
  }
}
