import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PERMISSIONS } from "../common/constants/permissions";
import {
  ExpenseCategoriesService,
  CategoryInput,
} from "./expense-categories.service";

@Controller("expense-categories")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpenseCategoriesController {
  constructor(private readonly categories: ExpenseCategoriesService) {}

  // Readable by anyone who can see expenses — the entry form needs the list.
  @Get()
  @Permissions(PERMISSIONS.VIEW_EXPENSES)
  findAll(@Request() req, @Query("includeArchived") includeArchived?: string) {
    return this.categories.findAll(
      req.user.tenantId,
      includeArchived === "true",
    );
  }

  // Creating from the expense entry screen is intentionally allowed for anyone
  // who can record an expense, so the flow is not interrupted.
  @Post()
  @Permissions(PERMISSIONS.CREATE_EXPENSES)
  create(@Request() req, @Body() body: CategoryInput) {
    return this.categories.create(req.user.tenantId, body);
  }

  @Post("seed-defaults")
  @Permissions(PERMISSIONS.MANAGE_EXPENSE_CATEGORIES)
  seedDefaults(@Request() req) {
    return this.categories.seedDefaults(req.user.tenantId);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.MANAGE_EXPENSE_CATEGORIES)
  update(@Request() req, @Param("id") id: string, @Body() body: CategoryInput) {
    return this.categories.update(req.user.tenantId, id, body);
  }

  @Patch(":id/archive")
  @Permissions(PERMISSIONS.MANAGE_EXPENSE_CATEGORIES)
  archive(@Request() req, @Param("id") id: string) {
    return this.categories.archive(req.user.tenantId, id);
  }

  @Patch(":id/restore")
  @Permissions(PERMISSIONS.MANAGE_EXPENSE_CATEGORIES)
  restore(@Request() req, @Param("id") id: string) {
    return this.categories.restore(req.user.tenantId, id);
  }

  @Delete(":id")
  @Permissions(PERMISSIONS.MANAGE_EXPENSE_CATEGORIES)
  remove(@Request() req, @Param("id") id: string) {
    return this.categories.remove(req.user.tenantId, id);
  }
}
