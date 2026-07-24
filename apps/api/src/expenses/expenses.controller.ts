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
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage, memoryStorage } from "multer";
import { extname } from "path";
import type { Response } from "express";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PERMISSIONS } from "../common/constants/permissions";
import {
  ExpensesService,
  ExpenseFilters,
  ExpenseInput,
} from "./expenses.service";
import { ExpenseAnalyticsService } from "./expense-analytics.service";

const RECEIPT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

const receiptUploadOptions = {
  storage: diskStorage({
    destination: "./uploads",
    filename: (_req, file, cb) => {
      const randomName = Array(32)
        .fill(null)
        .map(() => Math.round(Math.random() * 16).toString(16))
        .join("");
      cb(null, `receipt-${randomName}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (!RECEIPT_MIME_TYPES.includes(file.mimetype)) {
      return cb(
        new BadRequestException(
          "Receipts must be a PDF, JPG or PNG file.",
        ) as any,
        false,
      );
    }
    cb(null, true);
  },
};

@Controller("expenses")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpensesController {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly analytics: ExpenseAnalyticsService,
  ) {}

  // ------------------------------------------------------------- analytics
  // Declared before ":id" so these paths are not swallowed by the id route.

  /**
   * Month-to-date expenses and net profit. Takes no date range on purpose —
   * it always reports the current calendar month.
   */
  @Get("month-to-date")
  @Permissions(PERMISSIONS.VIEW_EXPENSES)
  getMonthToDate(@Request() req, @Query("storeId") storeId?: string) {
    return this.analytics.getMonthToDate(req.user, storeId);
  }

  @Get("summary")
  @Permissions(PERMISSIONS.VIEW_EXPENSES)
  getSummary(
    @Request() req,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("storeId") storeId?: string,
  ) {
    return this.analytics.getSummary(req.user, from, to, storeId);
  }

  @Get("trend")
  @Permissions(PERMISSIONS.VIEW_EXPENSES)
  getTrend(
    @Request() req,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("storeId") storeId?: string,
    @Query("granularity") granularity?: "day" | "week" | "month" | "auto",
  ) {
    return this.analytics.getTrend(
      req.user,
      from,
      to,
      storeId,
      granularity || "auto",
    );
  }

  @Get("by-store")
  @Permissions(PERMISSIONS.VIEW_ALL_STORE_EXPENSES)
  getStoreBreakdown(
    @Request() req,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.analytics.getStoreBreakdown(req.user, from, to);
  }

  @Get("alerts")
  @Permissions(PERMISSIONS.VIEW_EXPENSES)
  getAlerts(@Request() req, @Query("storeId") storeId?: string) {
    return this.analytics.getAlerts(req.user, storeId);
  }

  @Get("export")
  @Permissions(PERMISSIONS.VIEW_EXPENSES)
  async exportCsv(
    @Request() req,
    @Res() res: Response,
    @Query() query: ExpenseFilters,
  ) {
    const csv = await this.expenses.exportCsv(req.user, query);
    const stamp = new Date().toISOString().split("T")[0];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="expenses-${stamp}.csv"`,
    );
    return res.send(csv);
  }

  // ------------------------------------------------------------------ list

  @Get()
  @Permissions(PERMISSIONS.VIEW_EXPENSES)
  findAll(@Request() req, @Query() query: ExpenseFilters) {
    return this.expenses.findAll(req.user, query);
  }

  @Get(":id")
  @Permissions(PERMISSIONS.VIEW_EXPENSES)
  findOne(@Request() req, @Param("id") id: string) {
    return this.expenses.findOne(req.user, id);
  }

  @Get(":id/audit")
  @Permissions(PERMISSIONS.VIEW_EXPENSES)
  getAuditTrail(@Request() req, @Param("id") id: string) {
    return this.expenses.getAuditTrail(req.user, id);
  }

  // ---------------------------------------------------------------- writes

  @Post()
  @Permissions(PERMISSIONS.CREATE_EXPENSES)
  create(@Request() req, @Body() body: ExpenseInput) {
    return this.expenses.create(req.user, body);
  }

  @Post("import")
  @Permissions(PERMISSIONS.CREATE_EXPENSES)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importCsv(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Query("storeId") storeId?: string,
  ) {
    return this.expenses.importCsv(req.user, file, storeId);
  }

  // Authorized per expense inside the service (see canMutateExpense): entries
  // the caller may not delete are reported back as skipped rather than failing
  // the whole batch.
  @Post("bulk-delete")
  @Permissions(PERMISSIONS.VIEW_EXPENSES)
  bulkRemove(@Request() req, @Body() body: { ids: string[] }) {
    return this.expenses.bulkRemove(req.user, body?.ids);
  }

  // Also authorized in the service (canAttachToExpense), which allows the
  // recorder of an expense to attach its receipt.
  @Post(":id/attachment")
  @Permissions(PERMISSIONS.VIEW_EXPENSES)
  @UseInterceptors(FileInterceptor("file", receiptUploadOptions))
  attachReceipt(
    @Request() req,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.expenses.attachReceipt(req.user, id, file);
  }

  @Delete(":id/attachment")
  @Permissions(PERMISSIONS.VIEW_EXPENSES)
  removeReceipt(@Request() req, @Param("id") id: string) {
    return this.expenses.removeReceipt(req.user, id);
  }

  // Editing requires EDIT_EXPENSES (own entries) *or* MANAGE_ALL_EXPENSES (any
  // entry). PermissionsGuard ANDs its arguments and so cannot express that, so
  // the route gates on read access and the service enforces the real rule.
  @Patch(":id")
  @Permissions(PERMISSIONS.VIEW_EXPENSES)
  update(@Request() req, @Param("id") id: string, @Body() body: ExpenseInput) {
    return this.expenses.update(req.user, id, body);
  }

  @Delete(":id")
  @Permissions(PERMISSIONS.VIEW_EXPENSES)
  remove(@Request() req, @Param("id") id: string) {
    return this.expenses.remove(req.user, id);
  }
}
