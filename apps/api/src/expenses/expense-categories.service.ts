import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface CategoryInput {
  name?: string;
  description?: string;
  color?: string;
}

/**
 * Default set offered on first use so a new store is not staring at an empty
 * dropdown. These are created on demand (see `seedDefaults`) and are ordinary
 * editable categories once created — nothing about them is special.
 */
export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Rent", color: "#235347" },
  { name: "Utilities", color: "#B8843A" },
  { name: "Payroll", color: "#B3574A" },
  { name: "Supplies", color: "#3F5C8A" },
  { name: "Marketing", color: "#7BA396" },
  { name: "Repairs & Maintenance", color: "#6B7280" },
  { name: "Insurance", color: "#8A6BA8" },
  { name: "Equipment", color: "#2F7A8C" },
  { name: "Fuel", color: "#C2703D" },
  { name: "Miscellaneous", color: "#A9B0B0" },
];

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private normaliseName(name: string) {
    return name.trim().replace(/\s+/g, " ");
  }

  async findAll(tenantId: string, includeArchived = false) {
    const categories = await this.prisma.expenseCategory.findMany({
      where: {
        tenantId,
        ...(includeArchived ? {} : { status: "ACTIVE" }),
      },
      orderBy: { name: "asc" },
    });

    // Usage counts drive the "in use" warning on delete. Soft-deleted expenses
    // do not count — they are already invisible everywhere else.
    const counts = await this.prisma.expense.groupBy({
      by: ["categoryId"],
      where: { tenantId, isDeleted: false },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((c) => [c.categoryId, c._count._all]));

    return categories.map((c) => ({
      ...c,
      expenseCount: countMap.get(c.id) || 0,
    }));
  }

  async findOne(tenantId: string, id: string) {
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id, tenantId },
    });
    if (!category) throw new NotFoundException("Expense category not found");
    return category;
  }

  async create(tenantId: string, data: CategoryInput) {
    if (!data.name || !this.normaliseName(data.name)) {
      throw new BadRequestException("Category name is required");
    }
    const name = this.normaliseName(data.name);

    const existing = await this.prisma.expenseCategory.findFirst({
      where: { tenantId, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      // Re-activating a previously archived category is friendlier than telling
      // the user a name they cannot see is taken.
      if (existing.status === "ARCHIVED") {
        return this.prisma.expenseCategory.update({
          where: { id: existing.id },
          data: {
            status: "ACTIVE",
            description: data.description ?? existing.description,
            color: data.color ?? existing.color,
          },
        });
      }
      throw new BadRequestException(
        `An expense category named "${name}" already exists`,
      );
    }

    return this.prisma.expenseCategory.create({
      data: {
        name,
        description: data.description?.trim() || null,
        color: data.color || null,
        status: "ACTIVE",
        tenantId,
      },
    });
  }

  async update(tenantId: string, id: string, data: CategoryInput) {
    await this.findOne(tenantId, id);

    const payload: Record<string, unknown> = {};

    if (data.name !== undefined) {
      const name = this.normaliseName(data.name);
      if (!name) throw new BadRequestException("Category name is required");

      const clash = await this.prisma.expenseCategory.findFirst({
        where: {
          tenantId,
          name: { equals: name, mode: "insensitive" },
          id: { not: id },
        },
      });
      if (clash) {
        throw new BadRequestException(
          `An expense category named "${name}" already exists`,
        );
      }
      payload.name = name;
    }

    if (data.description !== undefined) {
      payload.description = data.description?.trim() || null;
    }
    if (data.color !== undefined) {
      payload.color = data.color || null;
    }

    return this.prisma.expenseCategory.update({ where: { id }, data: payload });
  }

  async archive(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.expenseCategory.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
  }

  async restore(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.expenseCategory.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
  }

  /**
   * Hard delete, permitted only while the category has never been used.
   * Anything with history is archived instead so reports stay readable.
   */
  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    const inUse = await this.prisma.expense.count({ where: { categoryId: id } });
    if (inUse > 0) {
      throw new BadRequestException(
        `This category is used by ${inUse} expense${inUse === 1 ? "" : "s"} and cannot be deleted. Archive it instead — it will stay out of the dropdown but existing records keep their history.`,
      );
    }

    return this.prisma.expenseCategory.delete({ where: { id } });
  }

  /**
   * Creates the starter categories for a tenant that has none yet. Idempotent:
   * anything already present (by name) is left untouched.
   */
  async seedDefaults(tenantId: string) {
    const existing = await this.prisma.expenseCategory.findMany({
      where: { tenantId },
      select: { name: true },
    });
    const taken = new Set(existing.map((c) => c.name.toLowerCase()));

    const missing = DEFAULT_EXPENSE_CATEGORIES.filter(
      (c) => !taken.has(c.name.toLowerCase()),
    );
    if (missing.length === 0) return this.findAll(tenantId);

    await this.prisma.expenseCategory.createMany({
      data: missing.map((c) => ({
        name: c.name,
        color: c.color,
        status: "ACTIVE",
        tenantId,
      })),
      skipDuplicates: true,
    });

    return this.findAll(tenantId);
  }
}
