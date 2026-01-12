import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { ProductsModule } from "./products/products.module";
import { InventoryModule } from "./inventory/inventory.module";
import { SalesModule } from "./sales/sales.module";
import { CustomersModule } from "./customers/customers.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { UsersModule } from "./users/users.module";
import { StoresModule } from "./stores/stores.module";
import { TaxesModule } from "./taxes/taxes.module";
import { DiscountsModule } from "./discounts/discounts.module";

import { TillsModule } from "./tills/tills.module";
import { TenantsModule } from "./tenants/tenants.module";
import { ReturnsModule } from "./returns/returns.module";

import { OnboardingModule } from "./onboarding/onboarding.module";
// import { PrismaModule } from './prisma/prisma.module'; // Removed
import { ConfigModule } from "@nestjs/config";
import { RolesModule } from "./roles/roles.module";
import { PrismaModule } from "./prisma/prisma.module";
import { BusinessModule } from "./business/business.module";
// import { ServeStaticModule } from '@nestjs/serve-static';
import { UploadsModule } from "./uploads/uploads.module";
import { PurchaseOrdersModule } from "./purchase-orders/purchase-orders.module";
import { GrnModule } from "./grn/grn.module";
import { TillReportsModule } from "./till-reports/till-reports.module";
import { CategoriesModule } from "./categories/categories.module";
import { join } from 'path';

import { LoggerMiddleware } from "./common/middleware/logger.middleware";
import { ApiPrefixMiddleware } from "./common/middleware/api-prefix.middleware";

@Module({
  imports: [
    AuthModule,
    OnboardingModule,
    ProductsModule,
    InventoryModule,
    SalesModule,
    ConfigModule.forRoot({ isGlobal: true }),
    CustomersModule,
    SuppliersModule,
    UsersModule,
    StoresModule,
    TaxesModule,
    DiscountsModule,
    TillsModule,
    TenantsModule,
    ReturnsModule,
    RolesModule,
    PrismaModule,
    BusinessModule,
    UploadsModule,
    PurchaseOrdersModule,
    GrnModule,
    TillReportsModule,
    CategoriesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
    consumer.apply(ApiPrefixMiddleware).forRoutes("*"); // Handle /api prefix removal
  }
}
