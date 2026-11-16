import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export interface JournalLineInput { accountCode: string; debitMinor?: number; creditMinor?: number; description?: string | null }
export interface SystemJournalInput { sourceType: string; sourceId: string; idempotencyKey: string; description: string; actorUserId?: string | null; lines: JournalLineInput[] }

export function postSystemJournalEntry(db: Database.Database, input: SystemJournalInput) {
  const key = input.idempotencyKey.trim();
  if (key.length < 8 || key.length > 160) throw new Error("Invalid journal idempotency key.");
  const existing = db.prepare("SELECT id, entry_no FROM journal_entries WHERE idempotency_key = ?").get(key) as { id: string; entry_no: string } | undefined;
  if (existing) return { journalEntryId: existing.id, entryNo: existing.entry_no, duplicate: true };
  if (input.lines.length < 2 || input.lines.length > 100) throw new Error("A journal entry requires between 2 and 100 lines.");
  let debitTotal = 0, creditTotal = 0;
  const normalized = input.lines.map((line, index) => {
    const debit = line.debitMinor ?? 0, credit = line.creditMinor ?? 0;
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit < 0 || credit < 0 || (debit > 0) === (credit > 0)) throw new Error("Each journal line must contain either a positive debit or a positive credit.");
    debitTotal += debit; creditTotal += credit;
    const account = db.prepare("SELECT id FROM accounts WHERE code = ? AND is_active = 1").get(line.accountCode) as { id: string } | undefined;
    if (!account) throw new Error(`Active account ${line.accountCode} was not found.`);
    return { accountId: account.id, debit, credit, description: line.description?.trim() || null, lineNo: index + 1 };
  });
  if (!Number.isSafeInteger(debitTotal) || !Number.isSafeInteger(creditTotal) || debitTotal <= 0 || debitTotal !== creditTotal) throw new Error("Journal entry is not balanced.");
  const id = randomUUID();
  const date = new Date().toISOString().slice(0, 10);
  const entryNo = `JE-${date.replaceAll("-", "")}-${id.slice(0, 8).toUpperCase()}`;
  db.prepare("INSERT INTO journal_entries(id, entry_no, source_type, source_id, description, entry_date, status, idempotency_key, created_by, posted_by, posted_at) VALUES (?, ?, ?, ?, ?, ?, 'posted', ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))")
    .run(id, entryNo, input.sourceType, input.sourceId, input.description.trim(), date, key, input.actorUserId ?? null, input.actorUserId ?? null);
  const insert = db.prepare("INSERT INTO journal_lines(id, journal_entry_id, account_id, line_no, debit_minor, credit_minor, description) VALUES (?, ?, ?, ?, ?, ?, ?)");
  for (const line of normalized) insert.run(randomUUID(), id, line.accountId, line.lineNo, line.debit, line.credit, line.description);
  db.prepare("INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json) VALUES (?, ?, 'accounting.journal.auto_posted', 'journal_entry', ?, ?)")
    .run(randomUUID(), input.actorUserId ?? null, id, JSON.stringify({ sourceType: input.sourceType, sourceId: input.sourceId, debitTotalMinor: debitTotal }));
  return { journalEntryId: id, entryNo, duplicate: false };
}

export function listAccounts(db: Database.Database) {
  return db.prepare("SELECT id, code, name_ar, name_en, account_type, normal_balance, parent_id, is_system, is_active FROM accounts ORDER BY code").all();
}

export function getTrialBalance(db: Database.Database, asOf: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || new Date(`${asOf}T00:00:00.000Z`).toISOString().slice(0, 10) !== asOf) throw new Error("Invalid trial balance date.");
  const rows = db.prepare(`
    SELECT a.id, a.code, a.name_ar, a.name_en, a.account_type, a.normal_balance,
      COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jl.debit_minor ELSE 0 END), 0) AS debit_minor,
      COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jl.credit_minor ELSE 0 END), 0) AS credit_minor
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted' AND je.entry_date <= ?
    WHERE a.is_active = 1
    GROUP BY a.id
    ORDER BY a.code
  `).all(asOf) as Array<{ id: string; code: string; name_ar: string; name_en: string | null; account_type: AccountType; normal_balance: "debit" | "credit"; debit_minor: number; credit_minor: number }>;
  const items = rows.map(row => {
    const debit = Number(row.debit_minor), credit = Number(row.credit_minor);
    return { ...row, debitMinor: debit, creditMinor: credit, debitBalanceMinor: Math.max(0, debit - credit), creditBalanceMinor: Math.max(0, credit - debit) };
  });
  return { asOf, items, totals: { debitMinor: items.reduce((sum, item) => sum + item.debitBalanceMinor, 0), creditMinor: items.reduce((sum, item) => sum + item.creditBalanceMinor, 0), debitMovementsMinor: items.reduce((sum, item) => sum + item.debitMinor, 0), creditMovementsMinor: items.reduce((sum, item) => sum + item.creditMinor, 0) } };
}

export function listJournalEntries(db: Database.Database, limit = 100, offset = 0) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0) throw new Error("Invalid journal pagination.");
  const entries = db.prepare("SELECT id, entry_no, source_type, source_id, description, entry_date, status, created_at, posted_at FROM journal_entries ORDER BY entry_date DESC, entry_no DESC LIMIT ? OFFSET ?").all(limit, offset) as Array<Record<string, unknown> & { id: string }>;
  const lines = db.prepare("SELECT jl.id, jl.journal_entry_id, a.code AS account_code, a.name_ar AS account_name, jl.debit_minor, jl.credit_minor, jl.description FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id WHERE jl.journal_entry_id = ? ORDER BY jl.line_no");
  return entries.map(entry => ({ ...entry, lines: lines.all(entry.id) }));
}

export function getFinancialStatements(db: Database.Database, from: string, to: string) {
  const validDate = (value: string) => /^\\d{4}-\\d{2}-\\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  if (!validDate(from) || !validDate(to) || from > to) throw new Error("Invalid financial statement date range.");

  const rows = db.prepare(`
    SELECT a.id, a.code, a.name_ar, a.name_en, a.account_type, a.normal_balance,
      COALESCE(SUM(CASE WHEN je.entry_date <= ? THEN jl.debit_minor ELSE 0 END), 0) AS debit_to_date,
      COALESCE(SUM(CASE WHEN je.entry_date <= ? THEN jl.credit_minor ELSE 0 END), 0) AS credit_to_date,
      COALESCE(SUM(CASE WHEN je.entry_date BETWEEN ? AND ? THEN jl.debit_minor ELSE 0 END), 0) AS period_debit,
      COALESCE(SUM(CASE WHEN je.entry_date BETWEEN ? AND ? THEN jl.credit_minor ELSE 0 END), 0) AS period_credit
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
    WHERE a.is_active = 1
    GROUP BY a.id
    ORDER BY a.code
  `).all(to, to, from, to, from, to) as Array<{
    id: string; code: string; name_ar: string; name_en: string | null;
    account_type: AccountType; normal_balance: "debit" | "credit";
    debit_to_date: number; credit_to_date: number; period_debit: number; period_credit: number;
  }>;

  const amount = (debit: number, credit: number, normal: "debit" | "credit") =>
    normal === "debit" ? Number(debit) - Number(credit) : Number(credit) - Number(debit);
  const periodRows = rows.filter(row => row.account_type === "revenue" || row.account_type === "expense").map(row => ({
    id: row.id, code: row.code, name: row.name_ar, accountType: row.account_type,
    amountMinor: amount(row.period_debit, row.period_credit, row.normal_balance)
  }));
  const revenue = periodRows.filter(row => row.accountType === "revenue");
  const expenses = periodRows.filter(row => row.accountType === "expense");
  const revenueMinor = revenue.reduce((sum, row) => sum + row.amountMinor, 0);
  const expensesMinor = expenses.reduce((sum, row) => sum + row.amountMinor, 0);
  const netIncomeMinor = revenueMinor - expensesMinor;

  const balanceRows = rows.filter(row => row.account_type === "asset" || row.account_type === "liability" || row.account_type === "equity").map(row => ({
    id: row.id, code: row.code, name: row.name_ar, accountType: row.account_type,
    amountMinor: amount(row.debit_to_date, row.credit_to_date, row.normal_balance)
  }));
  const assets = balanceRows.filter(row => row.accountType === "asset");
  const liabilities = balanceRows.filter(row => row.accountType === "liability");
  const equity = balanceRows.filter(row => row.accountType === "equity");
  const assetsMinor = assets.reduce((sum, row) => sum + row.amountMinor, 0);
  const liabilitiesMinor = liabilities.reduce((sum, row) => sum + row.amountMinor, 0);
  const equityMinor = equity.reduce((sum, row) => sum + row.amountMinor, 0);
  const liabilitiesAndEquityMinor = liabilitiesMinor + equityMinor + netIncomeToDate(rows);
  return {
    period: { from, to },
    profitAndLoss: { revenue, expenses, revenueMinor, expensesMinor, netIncomeMinor },
    balanceSheet: {
      asOf: to, assets, liabilities, equity,
      currentEarningsMinor: netIncomeToDate(rows),
      assetsMinor, liabilitiesMinor, equityMinor,
      liabilitiesAndEquityMinor,
      differenceMinor: assetsMinor - liabilitiesAndEquityMinor,
      balanced: assetsMinor === liabilitiesAndEquityMinor
    }
  };
}

function netIncomeToDate(rows: Array<{
  account_type: AccountType; normal_balance: "debit" | "credit";
  debit_to_date: number; credit_to_date: number;
}>): number {
  return rows.reduce((sum, row) => {
    if (row.account_type === "revenue") return sum + (row.normal_balance === "debit"
      ? Number(row.debit_to_date) - Number(row.credit_to_date)
      : Number(row.credit_to_date) - Number(row.debit_to_date));
    if (row.account_type === "expense") return sum - (row.normal_balance === "debit"
      ? Number(row.debit_to_date) - Number(row.credit_to_date)
      : Number(row.credit_to_date) - Number(row.debit_to_date));
    return sum;
  }, 0);
}
