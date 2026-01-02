export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ["*"], // All permissions
  MANAGER: [
    "MANAGE_PRODUCTS",
    "MANAGE_INVENTORY",
    "VIEW_REPORTS",
    "MANAGE_CUSTOMERS",
    "MANAGE_DISCOUNTS",
    "POS_ACCESS",
  ],
  CASHIER: ["POS_ACCESS", "VIEW_PRODUCTS", "VIEW_CUSTOMERS"],
};
