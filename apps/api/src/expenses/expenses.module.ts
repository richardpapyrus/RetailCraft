import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SalesModule } from "../sales/sales.module";

import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";
import { ExpenseCategoriesController } from "./expense-categories.controller";
import { ExpenseCategoriesService } from "./expense-categories.service";
import { ExpenseAnalyticsService } from "./expense-analytics.service";

@Module({
  // SalesModule supplies the existing gross-profit calculation, which the
  // analytics service consumes rather than reimplementing.
  imports: [PrismaModule, SalesModule],
  controllers: [ExpensesController, ExpenseCategoriesController],
  providers: [
    ExpensesService,
    ExpenseCategoriesService,
    ExpenseAnalyticsService,
  ],
  exports: [ExpensesService, ExpenseAnalyticsService],
})
export class ExpensesModule {}
