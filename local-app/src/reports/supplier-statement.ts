import type Database from "better-sqlite3";

export interface SupplierStatementItem {
  id: string;
  entryType: "purchase" | "payment" | "return";
  documentNo: string;
  reference: string | null;
  method: string | null;
  createdAt: string;
  debitMinor: number;
  creditMinor: number;
  balanceMinor: number;
}

export function getSupplierStatement(
  db: Database.Database,
  supplierId: string,
  limit = 100,
  offset = 0
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new Error("Limit must be between 1 and 200.");
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error("Offset must be a non-negative integer.");
  }

  const supplier = db.prepare(`
    SELECT id, code, name, phone, is_active
    FROM suppliers WHERE id = ?
  `).get(supplierId) as {
    id: string; code: string; name: string; phone: string | null; is_active: number;
  } | undefined;
  if (!supplier) throw new Error("Supplier not found.");

  const summary = db.prepare(`
    SELECT
      COALESCE(SUM(p.total_minor), 0) AS purchases_minor,
      COALESCE((
        SELECT SUM(pp.amount_minor)
        FROM purchase_payments pp
        JOIN purchases paid_purchase ON paid_purchase.id = pp.purchase_id
        WHERE paid_purchase.supplier_id = ? AND paid_purchase.status = 'posted'
      ), 0) AS payments_minor,
      COALESCE((
        SELECT SUM(pr.total_minor)
        FROM purchase_returns pr
        JOIN purchases returned_purchase ON returned_purchase.id = pr.purchase_id
        WHERE returned_purchase.supplier_id = ? AND returned_purchase.status = 'posted' AND pr.status = 'posted'
      ), 0) AS returns_minor
    FROM purchases p
    WHERE p.supplier_id = ? AND p.status = 'posted'
  `).get(supplierId, supplierId, supplierId) as { purchases_minor: number; payments_minor: number; returns_minor: number };

  const items = db.prepare(`
    WITH entries AS (
      SELECT
        p.id AS id, 'purchase' AS entry_type, p.document_no AS document_no,
        NULL AS reference, NULL AS method, p.created_at AS created_at,
        p.total_minor AS debit_minor, 0 AS credit_minor, 0 AS entry_order
      FROM purchases p
      WHERE p.supplier_id = ? AND p.status = 'posted'
      UNION ALL
      SELECT
        pp.id AS id, 'payment' AS entry_type, p.document_no AS document_no,
        pp.reference AS reference, pp.method AS method, pp.created_at AS created_at,
        0 AS debit_minor, pp.amount_minor AS credit_minor, 1 AS entry_order
      FROM purchase_payments pp
      JOIN purchases p ON p.id = pp.purchase_id
      WHERE p.supplier_id = ? AND p.status = 'posted'
      UNION ALL
      SELECT
        pr.id AS id, 'return' AS entry_type, p.document_no AS document_no,
        pr.reason AS reference, NULL AS method, pr.created_at AS created_at,
        0 AS debit_minor, pr.total_minor AS credit_minor, 2 AS entry_order
      FROM purchase_returns pr JOIN purchases p ON p.id = pr.purchase_id
      WHERE p.supplier_id = ? AND p.status = 'posted' AND pr.status = 'posted'
    ), balanced AS (
      SELECT *,
        SUM(debit_minor - credit_minor) OVER (
          ORDER BY created_at, entry_order, id
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS balance_minor
      FROM entries
    )
    SELECT
      id, entry_type AS entryType, document_no AS documentNo,
      reference, method, created_at AS createdAt,
      debit_minor AS debitMinor, credit_minor AS creditMinor, balance_minor AS balanceMinor
    FROM balanced
    ORDER BY created_at ASC, entry_order ASC, id ASC
    LIMIT ? OFFSET ?
  `).all(supplierId, supplierId, supplierId, limit, offset) as SupplierStatementItem[];

  const purchasesMinor = Number(summary.purchases_minor);
  const paymentsMinor = Number(summary.payments_minor);
  const returnsMinor = Number(summary.returns_minor);
  return {
    supplier,
    summary: {
      purchasesMinor,
      paymentsMinor,
      returnsMinor,
      outstandingMinor: purchasesMinor - paymentsMinor - returnsMinor
    },
    items,
    pagination: { limit, offset }
  };
}
