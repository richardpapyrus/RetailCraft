import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  Query,
} from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("customers")
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) { }

  @Post()
  create(
    @Request() req,
    @Body() createCustomerDto: { name: string; email?: string; phone?: string },
  ) {
    console.log('[Debug Obinna] User:', req.user.email, 'Role:', req.user.role, 'HomeStore:', req.user.storeId);
    console.log('[Debug Obinna] Body StoreId:', (createCustomerDto as any).storeId);
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.role === 'ADMIN' || req.user.permissions?.includes('*');

    let targetStoreId = (createCustomerDto as any).storeId;

    if (!isSystemAdmin) {
      if (!req.user.storeId && !targetStoreId) throw new Error("Operation denied: No store assigned");
      // If storeId is provided in body, use it. Otherwise default to user's store.
      if (!targetStoreId) targetStoreId = req.user.storeId;
    }

    // Verify storeId is not passed twice (as string and as relation)
    const { storeId: _s, ...rest } = createCustomerDto as any;

    return this.customersService.create({
      ...rest,
      tenant: { connect: { id: req.user.tenantId } },
      store: targetStoreId ? { connect: { id: targetStoreId } } : undefined,
    });
  }

  @Get()
  findAll(
    @Request() req,
    @Query("skip") skip: string,
    @Query("take") take: string,
    @Query("storeId") queryStoreId?: string,
  ) {
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.role === 'ADMIN' || req.user.permissions?.includes('*');
    let storeId = queryStoreId; // Accept query param

    if (!isSystemAdmin) {
      if (req.user.storeId) storeId = req.user.storeId;
      else storeId = 'invalid-store-id';
    }

    return this.customersService.findAll(
      req.user.tenantId,
      parseInt(skip || "0"),
      parseInt(take || "50"),
      storeId // Pass strict filter
    );
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Request() req) {
    return this.customersService.findOne(id, req.user.tenantId);
  }

  @Get(":id/sales")
  findSales(
    @Param("id") id: string,
    @Request() req,
    @Query("skip") skip: string,
    @Query("take") take: string,
  ) {
    return this.customersService.findSales(
      id,
      parseInt(skip || "0"),
      parseInt(take || "50"),
    );
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateCustomerDto: any,
    @Request() req,
  ) {
    return this.customersService.update(
      id,
      updateCustomerDto,
      req.user.tenantId,
    );
  }
}
