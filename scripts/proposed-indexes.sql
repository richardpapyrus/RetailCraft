-- Applied automatically after each deploy by the "Apply Database Indexes"
-- GitHub Action (.github/workflows/apply-indexes.yml → scripts/apply-indexes.js),
-- which runs these one at a time and skips any that already exist. To add an
-- index, add a line here in the same form; the script refuses anything that is
-- not `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Name" ON "Table" ("col", ...)`.
--
-- Postgres does not index foreign keys automatically, and apart from Expenses
-- the schema declares no @@index at all, so every date-range report and every
-- "load the items for these sales" join scans the whole table. Cost grows
-- linearly with history; these indexes make it grow with the size of the
-- window being asked for instead.
--
-- Purely additive: no data changes, no column changes, query results identical.
-- CONCURRENTLY builds without blocking sales at the till. It cannot run inside
-- a transaction, which is why this is not a `prisma migrate` migration. Names
-- follow Prisma's convention so a later `@@index([...])` in schema.prisma
-- matches them (use IF NOT EXISTS in that migration). An interrupted build
-- leaves an INVALID index; the script drops and rebuilds those.

-- Sales history, dashboard, reports, heatmap, till reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Sale_tenantId_storeId_createdAt_idx" ON "Sale" ("tenantId", "storeId", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Sale_tenantId_createdAt_idx"         ON "Sale" ("tenantId", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Sale_tillSessionId_idx"              ON "Sale" ("tillSessionId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Sale_customerId_idx"                 ON "Sale" ("customerId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SaleItem_saleId_idx"                 ON "SaleItem" ("saleId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SaleItem_productId_idx"              ON "SaleItem" ("productId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SalePayment_saleId_idx"              ON "SalePayment" ("saleId");

-- Returns
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SalesReturn_saleId_idx"                     ON "SalesReturn" ("saleId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SalesReturn_tenantId_storeId_createdAt_idx" ON "SalesReturn" ("tenantId", "storeId", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SalesReturnItem_returnId_idx"               ON "SalesReturnItem" ("returnId");

-- Tills
-- openedAt last so the paged session history (newest first) reads straight off the index.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "TillSession_tillId_status_openedAt_idx" ON "TillSession" ("tillId", "status", "openedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CashTransaction_tillSessionId_idx"   ON "CashTransaction" ("tillSessionId");

-- Stock movements (product history, aging report)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "InventoryEvent_productId_storeId_createdAt_idx" ON "InventoryEvent" ("productId", "storeId", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Inventory_productId_idx"             ON "Inventory" ("productId");

-- Products list
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_tenantId_isArchived_name_idx" ON "Product" ("tenantId", "isArchived", "name");

-- Purchasing
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PurchaseOrder_tenantId_storeId_createdAt_idx" ON "PurchaseOrder" ("tenantId", "storeId", "createdAt");
-- Supplier page transaction history (paged, newest first)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PurchaseOrder_supplierId_createdAt_idx" ON "PurchaseOrder" ("supplierId", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PurchaseOrderItem_poId_idx"           ON "PurchaseOrderItem" ("poId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GoodsReceivedNote_poId_idx"           ON "GoodsReceivedNote" ("poId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GoodsReceivedNote_storeId_receivedDate_idx" ON "GoodsReceivedNote" ("storeId", "receivedDate");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GRNItem_grnId_idx"                    ON "GRNItem" ("grnId");
