export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: "VIEW_DASHBOARD",

  // Products
  VIEW_PRODUCTS: "VIEW_PRODUCTS",
  MANAGE_PRODUCTS: "MANAGE_PRODUCTS", // Create, Edit, Delete

  // Inventory
  VIEW_INVENTORY: "VIEW_INVENTORY",
  MANAGE_INVENTORY: "MANAGE_INVENTORY", // Adjust, Move, Count

  // Sales
  process_sales: "PROCESS_SALES", // Run the POS
  view_sales: "VIEW_SALES", // View history
  manage_sales: "MANAGE_SALES", // Void, Refund (High privilege)
  MANAGE_DISCOUNTS: "MANAGE_DISCOUNTS", // Apply Manual Discounts

  // Customers
  VIEW_CUSTOMERS: "VIEW_CUSTOMERS",
  MANAGE_CUSTOMERS: "MANAGE_CUSTOMERS",

  // Suppliers
  VIEW_SUPPLIERS: "VIEW_SUPPLIERS",
  MANAGE_SUPPLIERS: "MANAGE_SUPPLIERS",
  RAISE_PURCHASE_ORDER: "RAISE_PURCHASE_ORDER",
  RECEIVE_GOODS: "RECEIVE_GOODS",

  // Tills
  OPEN_TILL: "OPEN_TILL",
  CLOSE_TILL: "CLOSE_TILL",
  MANAGE_TILLS: "MANAGE_TILLS", // Create/Delete Tills
  VIEW_TILL_REPORTS: "VIEW_TILL_REPORTS",

  // Reports
  VIEW_REPORTS: "VIEW_REPORTS",

  // Users & Roles
  MANAGE_USERS: "MANAGE_USERS", // Invite, Edit Users, Assign Roles

  // Settings
  MANAGE_SETTINGS: "MANAGE_SETTINGS", // Store Settings, General Config
};

export const PERMISSION_GROUPS = [
  {
    label: "Products",
    permissions: [PERMISSIONS.VIEW_PRODUCTS, PERMISSIONS.MANAGE_PRODUCTS],
  },
  {
    label: "Inventory",
    permissions: [PERMISSIONS.VIEW_INVENTORY, PERMISSIONS.MANAGE_INVENTORY],
  },
  {
    label: "Sales (POS)",
    permissions: [
      PERMISSIONS.process_sales,
      PERMISSIONS.view_sales,
      PERMISSIONS.manage_sales,
      PERMISSIONS.MANAGE_DISCOUNTS,
    ],
  },
  {
    label: "Customers",
    permissions: [PERMISSIONS.VIEW_CUSTOMERS, PERMISSIONS.MANAGE_CUSTOMERS],
  },
  {
    label: "Suppliers & Purchasing", // Renaming for clarity implies POs
    permissions: [
      PERMISSIONS.VIEW_SUPPLIERS,
      PERMISSIONS.MANAGE_SUPPLIERS,
      PERMISSIONS.RAISE_PURCHASE_ORDER,
      PERMISSIONS.RECEIVE_GOODS
    ],
  },
  {
    label: "Tills",
    permissions: [
      PERMISSIONS.OPEN_TILL,
      PERMISSIONS.CLOSE_TILL,
      PERMISSIONS.MANAGE_TILLS,
      PERMISSIONS.VIEW_TILL_REPORTS,
    ],
  },
  {
    label: "Reports",
    permissions: [PERMISSIONS.VIEW_REPORTS],
  },
  {
    label: "Administration",
    permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_SETTINGS],
  },
];
