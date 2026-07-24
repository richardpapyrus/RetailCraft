import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import {
  RequestUser,
  resolveReadScope,
  resolveWriteScope,
  canMutateExpense,
  canAttachToExpense,
  parseDateRange,
} from "./expense-scope";

export interface ExpenseFilters {
  from?: string;
  to?: string;
  categoryId?: string;
  storeId?: string;
  createdById?: string;
  search?: string;
  minAmount?: string;
  maxAmount?: string;
  skip?: string;
  take?: string;
  sortBy?: string;
  sortDir?: string;
}

export interface ExpenseInput {
  expenseDate?: string;
  amount?: number | string;
  categoryId?: string;
  description?: string;
  notes?: string;
  vendor?: string;
  reference?: string;
  paymentMethod?: string;
  storeId?: string;
  metadata?: Prisma.InputJsonValue;
}

const SORTABLE_FIELDS = new Set([
  "expenseDate",
  "amount",
  "createdAt",
  "description",
]);

const EXPENSE_INCLUDE = {
  category: { select: { id: true, name: true, color: true, status: true } },
  store: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  updatedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ExpenseInclude;

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- helpers

  private parseAmount(value: unknown): number {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      throw new BadRequestException("Amount must be a number");
    }
    if (amount <= 0) {
      throw new BadRequestException("Amount must be greater than zero");
    }
    if (amount > 1_000_000_000) {
      throw new BadRequestException("Amount is unrealistically large");
    }
    // Money is stored to 2dp; rounding here keeps totals exact.
    return Math.round(amount * 100) / 100;
  }

  private parseExpenseDate(value?: string): Date {
    if (!value) throw new BadRequestException("Expense date is required");

    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00.000Z`) // midday UTC so the calendar day is stable across timezones
      : new Date(value);

    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid expense date: ${value}`);
    }

    // Guard against typos like year 20255 that would wreck chart axes.
    const maxFuture = new Date();
    maxFuture.setUTCFullYear(maxFuture.getUTCFullYear() + 1);
    if (date > maxFuture) {
      throw new BadRequestException(
        "Expense date cannot be more than a year in the future",
      );
    }
    return date;
  }

  private async assertCategory(tenantId: string, categoryId?: string) {
    if (!categoryId) throw new BadRequestException("Category is required");
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id: categoryId, tenantId },
    });
    if (!category) throw new BadRequestException("Category not found");
    if (category.status !== "ACTIVE") {
      throw new BadRequestException(
        `"${category.name}" is archived and cannot be used for new expenses`,
      );
    }
    return category;
  }

  private async assertStore(tenantId: string, storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, tenantId },
    });
    if (!store) throw new BadRequestException("Store not found");
    return store;
  }

  /**
   * Writes one audit row. Audit failures must never lose the user's expense, so
   * this is called outside the write transaction and swallows its own errors.
   */
  private async recordAudit(
    expenseId: string,
    tenantId: string,
    action: string,
    user: RequestUser,
    changes?: Prisma.InputJsonValue,
  ) {
    try {
      await this.prisma.expenseAuditLog.create({
        data: {
          expenseId,
          tenantId,
          action,
          changes: changes ?? Prisma.JsonNull,
          userId: user.userId,
          userName: user.email || null,
          },
      });
    } catch (e) {
      console.error("[Expenses] Failed to write audit log", e);
    }
  }

  /** Field-level before/after pairs for the audit log. */
  private diff(
    before: Record<string, any>,
    after: Record<string, any>,
    fields: string[],
  ) {
    const changes: Record<string, { from: any; to: any }> = {};
    for (const field of fields) {
      if (after[field] === undefined) continue;

      const prev =
        before[field] instanceof Date
          ? before[field].toISOString()
          : before[field] !== null && typeof before[field] === "object"
            ? String(before[field])
            : before[field];
      const next =
        after[field] instanceof Date
          ? after[field].toISOString()
          : after[field] !== null && typeof after[field] === "object"
            ? String(after[field])
            : after[field];

      if (String(prev ?? "") !== String(next ?? "")) {
        changes[field] = { from: prev ?? null, to: next ?? null };
      }
    }
    return changes;
  }

  // ------------------------------------------------------------------ reads

  buildWhere(
    user: RequestUser,
    filters: ExpenseFilters,
  ): Prisma.ExpenseWhereInput {
    const storeId = resolveReadScope(user, filters.storeId);
    const { start, end } = parseDateRange(filters.from, filters.to);

    const where: Prisma.ExpenseWhereInput = {
      tenantId: user.tenantId,
      isDeleted: false,
      ...(storeId ? { storeId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.createdById ? { createdById: filters.createdById } : {}),
    };

    if (start || end) {
      where.expenseDate = {
        ...(start ? { gte: start } : {}),
        ...(end ? { lte: end } : {}),
      };
    }

    const min = filters.minAmount ? Number(filters.minAmount) : undefined;
    const max = filters.maxAmount ? Number(filters.maxAmount) : undefined;
    if (Number.isFinite(min) || Number.isFinite(max)) {
      where.amount = {
        ...(Number.isFinite(min) ? { gte: min } : {}),
        ...(Number.isFinite(max) ? { lte: max } : {}),
      };
    }

    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { vendor: { contains: search, mode: "insensitive" } },
        { reference: { contains: search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  async findAll(user: RequestUser, filters: ExpenseFilters) {
    const where = this.buildWhere(user, filters);

    const take = Math.min(Math.max(Number(filters.take) || 25, 1), 200);
    const skip = Math.max(Number(filters.skip) || 0, 0);

    const sortBy = SORTABLE_FIELDS.has(filters.sortBy || "")
      ? (filters.sortBy as string)
      : "expenseDate";
    const sortDir = filters.sortDir === "asc" ? "asc" : "desc";

    const [data, total, sum] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: EXPENSE_INCLUDE,
        // Secondary sort keeps pagination stable when many rows share a date.
        orderBy: [{ [sortBy]: sortDir }, { createdAt: "desc" }],
        skip,
        take,
      }),
      this.prisma.expense.count({ where }),
      this.prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    return {
      data,
      total,
      skip,
      take,
      // Total across the whole filtered set, not just this page.
      filteredTotal: Number(sum._sum.amount || 0),
    };
  }

  async findOne(user: RequestUser, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId: user.tenantId, isDeleted: false },
      include: EXPENSE_INCLUDE,
    });
    if (!expense) throw new NotFoundException("Expense not found");

    // Re-run the scope check so a scoped user cannot fetch another store's row by id.
    resolveReadScope(user, expense.storeId);

    return expense;
  }

  async getAuditTrail(user: RequestUser, id: string) {
    await this.findOne(user, id);
    return this.prisma.expenseAuditLog.findMany({
      where: { expenseId: id, tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  // ----------------------------------------------------------------- writes

  async create(user: RequestUser, body: ExpenseInput) {
    const storeId = resolveWriteScope(user, body.storeId);
    await this.assertStore(user.tenantId, storeId);
    await this.assertCategory(user.tenantId, body.categoryId);

    const description = body.description?.trim();
    if (!description) {
      throw new BadRequestException("Description is required");
    }

    const expense = await this.prisma.expense.create({
      data: {
        expenseDate: this.parseExpenseDate(body.expenseDate),
        amount: this.parseAmount(body.amount),
        description,
        notes: body.notes?.trim() || null,
        vendor: body.vendor?.trim() || null,
        reference: body.reference?.trim() || null,
        paymentMethod: body.paymentMethod?.trim() || null,
        categoryId: body.categoryId as string,
        storeId,
        tenantId: user.tenantId,
        createdById: user.userId,
        ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
      },
      include: EXPENSE_INCLUDE,
    });

    await this.recordAudit(expense.id, user.tenantId, "CREATE", user, {
      amount: { from: null, to: Number(expense.amount) },
      description: { from: null, to: expense.description },
      category: { from: null, to: expense.category?.name ?? null },
      expenseDate: { from: null, to: expense.expenseDate.toISOString() },
    });

    return expense;
  }

  async update(user: RequestUser, id: string, body: ExpenseInput) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, tenantId: user.tenantId, isDeleted: false },
      include: { category: { select: { name: true } } },
    });
    if (!existing) throw new NotFoundException("Expense not found");

    resolveReadScope(user, existing.storeId);

    if (!canMutateExpense(user, existing)) {
      throw new ForbiddenException(
        "You can only edit expenses you created. Ask an administrator to change this one.",
      );
    }

    const data: Prisma.ExpenseUpdateInput = {};
    const auditable: Record<string, any> = {};

    if (body.expenseDate !== undefined) {
      const parsed = this.parseExpenseDate(body.expenseDate);
      data.expenseDate = parsed;
      auditable.expenseDate = parsed;
    }
    if (body.amount !== undefined) {
      const parsed = this.parseAmount(body.amount);
      data.amount = parsed;
      auditable.amount = parsed;
    }
    if (body.categoryId !== undefined) {
      const category = await this.assertCategory(
        user.tenantId,
        body.categoryId,
      );
      data.category = { connect: { id: body.categoryId } };
      auditable.categoryName = category.name;
    }
    if (body.description !== undefined) {
      const description = body.description.trim();
      if (!description) throw new BadRequestException("Description is required");
      data.description = description;
      auditable.description = description;
    }
    if (body.notes !== undefined) {
      data.notes = body.notes?.trim() || null;
      auditable.notes = data.notes;
    }
    if (body.vendor !== undefined) {
      data.vendor = body.vendor?.trim() || null;
      auditable.vendor = data.vendor;
    }
    if (body.reference !== undefined) {
      data.reference = body.reference?.trim() || null;
      auditable.reference = data.reference;
    }
    if (body.paymentMethod !== undefined) {
      data.paymentMethod = body.paymentMethod?.trim() || null;
      auditable.paymentMethod = data.paymentMethod;
    }
    if (body.metadata !== undefined) {
      data.metadata = body.metadata;
    }

    // Moving an expense between stores is a privileged action — it shifts money
    // between two sets of books.
    if (body.storeId !== undefined && body.storeId !== existing.storeId) {
      const targetStoreId = resolveWriteScope(user, body.storeId);
      await this.assertStore(user.tenantId, targetStoreId);
      data.store = { connect: { id: targetStoreId } };
      auditable.storeId = targetStoreId;
    }

    data.updatedBy = { connect: { id: user.userId } };

    const changes = this.diff(
      {
        ...existing,
        amount: Number(existing.amount),
        categoryName: existing.category?.name,
      },
      auditable,
      [
        "expenseDate",
        "amount",
        "categoryName",
        "description",
        "notes",
        "vendor",
        "reference",
        "paymentMethod",
        "storeId",
      ],
    );

    const updated = await this.prisma.expense.update({
      where: { id },
      data,
      include: EXPENSE_INCLUDE,
    });

    if (Object.keys(changes).length > 0) {
      await this.recordAudit(id, user.tenantId, "UPDATE", user, changes);
    }

    return updated;
  }

  /**
   * Soft delete. The row is retained so its audit trail — including this
   * deletion — remains readable, and so a mistaken delete can be undone.
   */
  async remove(user: RequestUser, id: string) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, tenantId: user.tenantId, isDeleted: false },
      include: { category: { select: { name: true } } },
    });
    if (!existing) throw new NotFoundException("Expense not found");

    resolveReadScope(user, existing.storeId);

    if (!canMutateExpense(user, existing)) {
      throw new ForbiddenException(
        "You can only delete expenses you created. Ask an administrator to remove this one.",
      );
    }

    await this.prisma.expense.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedById: user.userId },
    });

    await this.recordAudit(id, user.tenantId, "DELETE", user, {
      amount: { from: Number(existing.amount), to: null },
      description: { from: existing.description, to: null },
      category: { from: existing.category?.name ?? null, to: null },
    });

    return { success: true, id };
  }

  async bulkRemove(user: RequestUser, ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException("No expenses selected");
    }
    if (ids.length > 200) {
      throw new BadRequestException(
        "Select no more than 200 expenses at a time",
      );
    }

    const deleted: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const id of ids) {
      try {
        await this.remove(user, id);
        deleted.push(id);
      } catch (e: any) {
        skipped.push({ id, reason: e?.message || "Could not delete" });
      }
    }

    return { deleted: deleted.length, skipped };
  }

  // ------------------------------------------------------------ attachments

  async attachReceipt(
    user: RequestUser,
    id: string,
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");

    const existing = await this.prisma.expense.findFirst({
      where: { id, tenantId: user.tenantId, isDeleted: false },
    });
    if (!existing) throw new NotFoundException("Expense not found");

    resolveReadScope(user, existing.storeId);
    if (!canAttachToExpense(user, existing)) {
      throw new ForbiddenException(
        "You can only attach receipts to expenses you created.",
      );
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        attachmentUrl: `/api/uploads/${file.filename}`,
        attachmentName: file.originalname,
        attachmentType: file.mimetype,
        attachmentSize: file.size,
        updatedById: user.userId,
      },
      include: EXPENSE_INCLUDE,
    });

    await this.recordAudit(id, user.tenantId, "ATTACHMENT_ADDED", user, {
      attachment: {
        from: existing.attachmentName ?? null,
        to: file.originalname,
      },
    });

    return updated;
  }

  async removeReceipt(user: RequestUser, id: string) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, tenantId: user.tenantId, isDeleted: false },
    });
    if (!existing) throw new NotFoundException("Expense not found");

    resolveReadScope(user, existing.storeId);
    if (!canAttachToExpense(user, existing)) {
      throw new ForbiddenException(
        "You can only change receipts on expenses you created.",
      );
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        attachmentUrl: null,
        attachmentName: null,
        attachmentType: null,
        attachmentSize: null,
        updatedById: user.userId,
      },
      include: EXPENSE_INCLUDE,
    });

    // The file itself is intentionally left on disk — the audit trail still
    // references it, and orphan cleanup is a separate operational concern.
    await this.recordAudit(id, user.tenantId, "ATTACHMENT_REMOVED", user, {
      attachment: { from: existing.attachmentName ?? null, to: null },
    });

    return updated;
  }

  // ------------------------------------------------------------ import/export

  async exportCsv(user: RequestUser, filters: ExpenseFilters) {
    const where = this.buildWhere(user, filters);

    const rows = await this.prisma.expense.findMany({
      where,
      include: EXPENSE_INCLUDE,
      orderBy: { expenseDate: "desc" },
      take: 10000,
    });

    const escape = (value: unknown) => {
      const str = value === null || value === undefined ? "" : String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const header = [
      "Date",
      "Category",
      "Description",
      "Amount",
      "Store",
      "Vendor",
      "Reference",
      "Payment Method",
      "Notes",
      "Recorded By",
      "Recorded At",
    ];

    const lines = rows.map((r) =>
      [
        r.expenseDate.toISOString().split("T")[0],
        r.category?.name,
        r.description,
        Number(r.amount).toFixed(2),
        r.store?.name,
        r.vendor,
        r.reference,
        r.paymentMethod,
        r.notes,
        r.createdBy?.name || r.createdBy?.email,
        r.createdAt.toISOString(),
      ]
        .map(escape)
        .join(","),
    );

    const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
    lines.push("");
    lines.push([escape("TOTAL"), "", "", escape(total.toFixed(2))].join(","));

    return [header.join(","), ...lines].join("\n");
  }

  /**
   * CSV import. Validates every row first and writes nothing unless the whole
   * file is valid, so a partial import can never leave half a month's books in.
   */
  async importCsv(
    user: RequestUser,
    file: Express.Multer.File,
    storeIdParam?: string,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");

    const storeId = resolveWriteScope(user, storeIdParam);
    await this.assertStore(user.tenantId, storeId);

    const text = file.buffer
      ? file.buffer.toString("utf8")
      : require("fs").readFileSync(file.path, "utf8");

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new BadRequestException(
        "The file needs a header row and at least one expense row",
      );
    }

    const splitRow = (line: string) => {
      const cells: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          cells.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      return cells;
    };

    const header = splitRow(lines[0]).map((h) => h.toLowerCase());
    const col = (...names: string[]) => {
      for (const name of names) {
        const idx = header.indexOf(name);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const dateIdx = col("date", "expense date", "expensedate");
    const amountIdx = col("amount", "value", "total");
    const categoryIdx = col("category", "expense category");
    const descIdx = col("description", "details", "notes");

    const missing: string[] = [];
    if (dateIdx === -1) missing.push("Date");
    if (amountIdx === -1) missing.push("Amount");
    if (categoryIdx === -1) missing.push("Category");
    if (descIdx === -1) missing.push("Description");
    if (missing.length) {
      throw new BadRequestException(
        `The file is missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`,
      );
    }

    const vendorIdx = col("vendor", "supplier", "payee");
    const referenceIdx = col("reference", "ref", "invoice");
    const paymentIdx = col("payment method", "payment", "method");

    const categories = await this.prisma.expenseCategory.findMany({
      where: { tenantId: user.tenantId, status: "ACTIVE" },
    });
    const categoryByName = new Map(
      categories.map((c) => [c.name.toLowerCase(), c]),
    );

    const parsed: Prisma.ExpenseCreateManyInput[] = [];
    const errors: { row: number; message: string }[] = [];
    const newCategoryNames = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const cells = splitRow(lines[i]);
      const rowNumber = i + 1;

      const categoryName = (cells[categoryIdx] || "").trim();
      const description = (cells[descIdx] || "").trim();

      try {
        if (!categoryName) throw new Error("Category is required");
        if (!description) throw new Error("Description is required");

        const expenseDate = this.parseExpenseDate(cells[dateIdx]);
        const amount = this.parseAmount(
          (cells[amountIdx] || "").replace(/[^0-9.\-]/g, ""),
        );

        const category = categoryByName.get(categoryName.toLowerCase());
        if (!category) {
          newCategoryNames.add(categoryName);
        }

        parsed.push({
          // Ids are assigned up front so the audit rows below can reference
          // them — createMany does not return the records it created.
          id: randomUUID(),
          expenseDate,
          amount,
          description,
          vendor: vendorIdx !== -1 ? cells[vendorIdx] || null : null,
          reference: referenceIdx !== -1 ? cells[referenceIdx] || null : null,
          paymentMethod: paymentIdx !== -1 ? cells[paymentIdx] || null : null,
          // Resolved below once any missing categories have been created.
          categoryId: category?.id ?? `PENDING:${categoryName.toLowerCase()}`,
          storeId,
          tenantId: user.tenantId,
          createdById: user.userId,
        });
      } catch (e: any) {
        errors.push({ row: rowNumber, message: e?.message || "Invalid row" });
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `Import cancelled — nothing was saved. ${errors.length} row${errors.length === 1 ? "" : "s"} could not be read: ` +
          errors
            .slice(0, 10)
            .map((e) => `row ${e.row}: ${e.message}`)
            .join("; ") +
          (errors.length > 10 ? ` …and ${errors.length - 10} more` : ""),
      );
    }

    for (const name of newCategoryNames) {
      const created = await this.prisma.expenseCategory.create({
        data: { name, status: "ACTIVE", tenantId: user.tenantId },
      });
      categoryByName.set(name.toLowerCase(), created);
    }

    for (const row of parsed) {
      if (row.categoryId.startsWith("PENDING:")) {
        const key = row.categoryId.slice("PENDING:".length);
        const resolved = categoryByName.get(key);
        if (!resolved) {
          throw new BadRequestException(
            `Could not resolve category for one or more rows. Nothing was saved.`,
          );
        }
        row.categoryId = resolved.id;
      }
    }

    const result = await this.prisma.expense.createMany({ data: parsed });

    try {
      await this.prisma.expenseAuditLog.createMany({
        data: parsed.map((row) => ({
          expenseId: row.id as string,
          tenantId: user.tenantId,
          action: "CREATE",
          changes: {
            source: { from: null, to: `CSV import (${file.originalname})` },
            amount: { from: null, to: Number(row.amount) },
            description: { from: null, to: row.description },
          },
          userId: user.userId,
          userName: user.email || null,
        })),
      });
    } catch (e) {
      console.error("[Expenses] Failed to write import audit logs", e);
    }

    return {
      imported: result.count,
      categoriesCreated: Array.from(newCategoryNames),
    };
  }
}
