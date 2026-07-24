import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { PERMISSIONS } from "../common/constants/permissions";

/**
 * The authenticated principal as produced by JwtStrategy.validate().
 */
export interface RequestUser {
  userId: string;
  email?: string;
  role?: string;
  permissions?: string[];
  tenantId: string;
  storeId?: string | null;
}

export function hasPermission(user: RequestUser, permission: string): boolean {
  if (!user) return false;
  if (user.role === "Administrator" || user.role === "ADMIN") return true;
  if (user.permissions?.includes("*")) return true;
  return user.permissions?.includes(permission) || false;
}

/**
 * True when the user may look at data belonging to stores other than their own.
 * Mirrors the "Headquarters" view offered by the store selector.
 */
export function canViewAllStores(user: RequestUser): boolean {
  return hasPermission(user, PERMISSIONS.VIEW_ALL_STORE_EXPENSES);
}

/**
 * Resolves which store(s) a read request is allowed to cover.
 *
 * Returns `undefined` only for a user cleared to see every store who did not
 * ask for a specific one — callers must treat `undefined` as "no store filter"
 * (i.e. organization-wide aggregate). Everyone else is pinned to their own
 * store, and a user with neither global access nor an assigned store is
 * refused rather than silently shown another store's figures.
 */
export function resolveReadScope(
  user: RequestUser,
  requestedStoreId?: string,
): string | undefined {
  if (canViewAllStores(user)) {
    return requestedStoreId || undefined;
  }

  if (!user.storeId) {
    throw new ForbiddenException(
      "Your account is not assigned to a store, so expenses cannot be shown. Ask an administrator to assign you to a location.",
    );
  }

  // A scoped user asking for someone else's store is refused outright rather
  // than being quietly redirected to their own.
  if (requestedStoreId && requestedStoreId !== user.storeId) {
    throw new ForbiddenException(
      "You do not have access to expenses for that store.",
    );
  }

  return user.storeId;
}

/**
 * Resolves the store an expense will be written to. Unlike reads, a write can
 * never be organization-wide: every expense belongs to exactly one store.
 */
export function resolveWriteScope(
  user: RequestUser,
  requestedStoreId?: string,
): string {
  if (canViewAllStores(user)) {
    if (!requestedStoreId) {
      throw new BadRequestException(
        "Select a store before recording an expense. Expenses always belong to a single location.",
      );
    }
    return requestedStoreId;
  }

  if (!user.storeId) {
    throw new ForbiddenException(
      "Your account is not assigned to a store, so expenses cannot be recorded.",
    );
  }

  if (requestedStoreId && requestedStoreId !== user.storeId) {
    throw new ForbiddenException(
      "You can only record expenses against your own store.",
    );
  }

  return user.storeId;
}

/**
 * Whether the user may modify/delete a given expense.
 * MANAGE_ALL_EXPENSES covers any expense; EDIT_EXPENSES covers only their own.
 *
 * This is an OR of two permissions, which PermissionsGuard cannot express (it
 * requires *all* listed permissions), so mutation routes are authorized here in
 * the service rather than by a route decorator.
 */
export function canMutateExpense(
  user: RequestUser,
  expense: { createdById: string },
): boolean {
  if (hasPermission(user, PERMISSIONS.MANAGE_ALL_EXPENSES)) return true;
  return (
    hasPermission(user, PERMISSIONS.EDIT_EXPENSES) &&
    expense.createdById === user.userId
  );
}

/**
 * Attaching or replacing a receipt on an expense you recorded yourself is part
 * of recording it, so CREATE_EXPENSES is enough for your own entries.
 */
export function canAttachToExpense(
  user: RequestUser,
  expense: { createdById: string },
): boolean {
  if (canMutateExpense(user, expense)) return true;
  return (
    hasPermission(user, PERMISSIONS.CREATE_EXPENSES) &&
    expense.createdById === user.userId
  );
}

/**
 * Calendar-month boundaries used by every "Month-to-Date" figure.
 *
 * These deliberately ignore any dashboard/report date filter: MTD always means
 * the 1st of the current month through now, and rolls over on its own.
 */
export function monthToDateRange(now: Date = new Date()) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  // Runs to the end of today, not to the current instant. Expenses are stamped
  // at midday UTC so that their calendar day is timezone-stable; cutting the
  // range off at "now" would hide today's entries every morning. This also
  // matches how SalesService.getStats widens its own end date.
  const end = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  return { start, end };
}

/**
 * The same span in the previous calendar month, capped at the equivalent day so
 * "this month vs last month" compares like with like mid-month.
 */
export function previousMonthToDateRange(now: Date = new Date()) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0),
  );

  // Last day of the previous month, so comparing on the 31st of a 31-day month
  // against a 30-day month does not overflow into the current month.
  const lastDayPrevMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0),
  ).getUTCDate();
  const day = Math.min(now.getUTCDate(), lastDayPrevMonth);

  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, day, 23, 59, 59, 999),
  );

  return { start, end };
}

/**
 * Parses a `YYYY-MM-DD` (or full ISO) query parameter into an inclusive range.
 * Date-only values are widened to cover the whole day in UTC, matching how the
 * rest of the app treats dashboard date pickers.
 */
export function parseDateRange(from?: string, to?: string) {
  const isDateOnly = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

  let start: Date | undefined;
  let end: Date | undefined;

  if (from) {
    start = isDateOnly(from) ? new Date(`${from}T00:00:00.000Z`) : new Date(from);
    if (isNaN(start.getTime())) {
      throw new BadRequestException(`Invalid "from" date: ${from}`);
    }
  }

  if (to) {
    end = isDateOnly(to) ? new Date(`${to}T23:59:59.999Z`) : new Date(to);
    if (isNaN(end.getTime())) {
      throw new BadRequestException(`Invalid "to" date: ${to}`);
    }
  }

  if (start && end && start > end) {
    throw new BadRequestException('"from" date must not be after "to" date.');
  }

  return { start, end };
}
