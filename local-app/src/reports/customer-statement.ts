import type Database from "better-sqlite3";

export interface CustomerStatementItem {
  id: string;
  entryType: "sale" | "payment" | "return";
  documentNo: string;
  reference: string | null;
  method: string | null;
  createdAt: string;
  debitMinor: number;
  creditMinor: number;
  balanceMinor: number;
}

export function getCustomerStatement(
  db: Database.Database,
  customerId: string,
  limit = 100,
  offset = 0
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new Error("Limit must be between 1 and 200.");
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error("Offset must be a non-negative integer.");
  }

  const customer = db.prepare(`
    SELECT id, code, name, phone, credit_limit_minor, is_active
    FROM customers WHERE id = ?
  `).get(customerId) as {
    id: string; code: string; name: string; phone: string | null;
    credit_limit_minor: number; is_active: number;
  } | undefined;
  if (!customer) throw new Error("Customer not found.");

  const summary = db.prepare(`
    SELECT
      COALESCE((SELECT SUM(total_minor) FROM sales
        WHERE customer_id = ? AND status = 'posted'), 0) AS sales_minor,
      COALESCE((SELECT SUM(p.amount_minor) FROM payments p
        JOIN sales s ON s.id = p.sale_id
        WHERE s.customer_id = ? AND s.status = 'posted'), 0) AS payments_minor,
      COALESCE((SELECT SUM(sr.total_minor) FROM sale_returns sr
        JOIN sales s ON s.id = sr.sale_id
        WHERE s.customer_id = ? AND s.status = 'posted' AND sr.status = 'posted'), 0) AS returns_minor
  `).get(customerId, customerId, customerId) as {
    sales_minor: number; payments_minor: number; returns_minor: number;
  };

  const items = db.prepare(`
    WITH entries AS (
      SELECT s.id AS id, 'sale' AS entry_type, s.document_no AS document_no,
        NULL AS reference, NULL AS method, s.created_at AS created_at,
        s.total_minor AS debit_minor, 0 AS credit_minor, 0 AS entry_order
      FROM sales s
      WHERE s.customer_id = ? AND s.status = 'posted'
      UNION ALL
      SELECT p.id, 'payment', s.document_no, p.reference, p.method, p.created_at,
        0, p.amount_minor, 1
      FROM payments p JOIN sales s ON s.id = p.sale_id
      WHERE s.customer_id = ? AND s.status = 'posted'
      UNION ALL
      SELECT sr.id, 'return', sr.document_no, sr.reason, NULL, sr.created_at,
        0, sr.total_minor, 2
      FROM sale_returns sr JOIN sales s ON s.id = sr.sale_id
      WHERE s.customer_id = ? AND s.status = 'posted' AND sr.status = 'posted'
    ), balanced AS (
      SELECT *,
        SUM(debit_minor - credit_minor) OVER (
          ORDER BY created_at, entry_order, id
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS balance_minor
      FROM entries
    )
    SELECT id, entry_type AS entryType, document_no AS documentNo,
      reference, method, created_at AS createdAt,
      debit_minor AS debitMinor, credit_minor AS creditMinor, balance_minor AS balanceMinor
    FROM balanced
    ORDER BY created_at ASC, entry_order ASC, id ASC
    LIMIT ? OFFSET ?
  `).all(customerId, customerId, customerId, limit, offset) as CustomerStatementItem[];

  const salesMinor = Number(summary.sales_minor);
  const paymentsMinor = Number(summary.payments_minor);
  const returnsMinor = Number(summary.returns_minor);
  return {
    customer,
    summary: {
      salesMinor,
      paymentsMinor,
      returnsMinor,
      outstandingMinor: salesMinor - paymentsMinor - returnsMinor
    },
    items,
    pagination: { limit, offset }
  };
}
