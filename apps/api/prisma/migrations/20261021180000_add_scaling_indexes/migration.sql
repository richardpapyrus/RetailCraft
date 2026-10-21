-- Records in Prisma the 21 indexes already built on staging and production by
-- the "Apply Database Indexes" Action (scripts/apply-indexes.js), so the schema
-- and the databases agree.
--
-- On those databases this is a no-op: each index is checked by name first and
-- CREATE INDEX only runs when it is missing, so no table is locked. (A plain
-- CREATE INDEX IF NOT EXISTS would still take a lock on the table before
-- noticing the index exists.) Only a brand-new, empty database builds them here.

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"Product_tenantId_isArchived_name_idx"') IS NULL THEN
    CREATE INDEX "Product_tenantId_isArchived_name_idx" ON "Product"("tenantId", "isArchived", "name");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"Inventory_productId_idx"') IS NULL THEN
    CREATE INDEX "Inventory_productId_idx" ON "Inventory"("productId");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"InventoryEvent_productId_storeId_createdAt_idx"') IS NULL THEN
    CREATE INDEX "InventoryEvent_productId_storeId_createdAt_idx" ON "InventoryEvent"("productId", "storeId", "createdAt");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"Sale_tenantId_storeId_createdAt_idx"') IS NULL THEN
    CREATE INDEX "Sale_tenantId_storeId_createdAt_idx" ON "Sale"("tenantId", "storeId", "createdAt");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"Sale_tenantId_createdAt_idx"') IS NULL THEN
    CREATE INDEX "Sale_tenantId_createdAt_idx" ON "Sale"("tenantId", "createdAt");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"Sale_tillSessionId_idx"') IS NULL THEN
    CREATE INDEX "Sale_tillSessionId_idx" ON "Sale"("tillSessionId");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"Sale_customerId_idx"') IS NULL THEN
    CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"SalePayment_saleId_idx"') IS NULL THEN
    CREATE INDEX "SalePayment_saleId_idx" ON "SalePayment"("saleId");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"SaleItem_saleId_idx"') IS NULL THEN
    CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"SaleItem_productId_idx"') IS NULL THEN
    CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"TillSession_tillId_status_openedAt_idx"') IS NULL THEN
    CREATE INDEX "TillSession_tillId_status_openedAt_idx" ON "TillSession"("tillId", "status", "openedAt");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"CashTransaction_tillSessionId_idx"') IS NULL THEN
    CREATE INDEX "CashTransaction_tillSessionId_idx" ON "CashTransaction"("tillSessionId");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"SalesReturn_saleId_idx"') IS NULL THEN
    CREATE INDEX "SalesReturn_saleId_idx" ON "SalesReturn"("saleId");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"SalesReturn_tenantId_storeId_createdAt_idx"') IS NULL THEN
    CREATE INDEX "SalesReturn_tenantId_storeId_createdAt_idx" ON "SalesReturn"("tenantId", "storeId", "createdAt");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"SalesReturnItem_returnId_idx"') IS NULL THEN
    CREATE INDEX "SalesReturnItem_returnId_idx" ON "SalesReturnItem"("returnId");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"PurchaseOrder_tenantId_storeId_createdAt_idx"') IS NULL THEN
    CREATE INDEX "PurchaseOrder_tenantId_storeId_createdAt_idx" ON "PurchaseOrder"("tenantId", "storeId", "createdAt");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"PurchaseOrder_supplierId_createdAt_idx"') IS NULL THEN
    CREATE INDEX "PurchaseOrder_supplierId_createdAt_idx" ON "PurchaseOrder"("supplierId", "createdAt");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"PurchaseOrderItem_poId_idx"') IS NULL THEN
    CREATE INDEX "PurchaseOrderItem_poId_idx" ON "PurchaseOrderItem"("poId");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"GoodsReceivedNote_poId_idx"') IS NULL THEN
    CREATE INDEX "GoodsReceivedNote_poId_idx" ON "GoodsReceivedNote"("poId");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"GoodsReceivedNote_storeId_receivedDate_idx"') IS NULL THEN
    CREATE INDEX "GoodsReceivedNote_storeId_receivedDate_idx" ON "GoodsReceivedNote"("storeId", "receivedDate");
  END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
  IF to_regclass('"GRNItem_grnId_idx"') IS NULL THEN
    CREATE INDEX "GRNItem_grnId_idx" ON "GRNItem"("grnId");
  END IF;
END $$;
