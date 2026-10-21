-- One-off data fix (Oct 2026): auto-created suppliers ("Unregistered Supplier",
-- and suppliers created on stock receive) were saved with the schema default
-- currency USD instead of the tenant's currency. PO totals are stored as plain
-- numbers and take their currency label from the supplier, so PO-2026-2133
-- showed $58,000.00 instead of ₦58,000.00. The amount itself is correct; only
-- the supplier's currency label is wrong.
--
-- Run against ONE database at a time (pos_db for prod, pos_db_staging for staging).

-- 1. Preview (read-only): every supplier whose currency differs from its tenant's.
SELECT s.id, s.name, s."isSystem", s.currency AS supplier_currency,
       t.name AS tenant, t.currency AS tenant_currency,
       (SELECT COUNT(*) FROM "PurchaseOrder" po WHERE po."supplierId" = s.id) AS po_count
FROM "Supplier" s
JOIN "Tenant" t ON t.id = s."tenantId"
WHERE s.currency <> t.currency
ORDER BY t.name, s.name;

-- 2. Fix the system-generated "Unregistered Supplier" for every tenant.
--    This is what relabels PO-2026-2133 to ₦58,000.00.
BEGIN;
UPDATE "Supplier" s
SET currency = t.currency, "updatedAt" = NOW()
FROM "Tenant" t
WHERE s."tenantId" = t.id
  AND s.name = 'Unregistered Supplier'
  AND s.currency <> t.currency;
-- Expect a small row count (one per affected tenant). If it looks right:
COMMIT;
-- otherwise: ROLLBACK;

-- 3. Any OTHER rows returned by step 1 may be genuinely foreign-currency
--    suppliers. Review them one by one and fix only the ones that are wrong, e.g.:
-- UPDATE "Supplier" SET currency = 'NGN', "updatedAt" = NOW() WHERE id = '<supplier id>';
