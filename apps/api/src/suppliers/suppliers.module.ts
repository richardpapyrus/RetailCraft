import { Module } from "@nestjs/common";
import { SuppliersService } from "./suppliers.service";
import { SuppliersController } from "./suppliers.controller";

import { SupplierInvoicesService } from "./supplier-invoices.service";
import { SupplierInvoicesController } from "./supplier-invoices.controller";
import { SupplierReturnsService } from "./supplier-returns.service";
import { SupplierReturnsController } from "./supplier-returns.controller";

@Module({
  controllers: [SuppliersController, SupplierInvoicesController, SupplierReturnsController],
  providers: [SuppliersService, SupplierInvoicesService, SupplierReturnsService],
  exports: [SuppliersService, SupplierInvoicesService, SupplierReturnsService],
})
export class SuppliersModule { }
