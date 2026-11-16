import { afterAll, afterEach, describe, expect, it } from "vitest";
import { closeDatabase, openDatabase } from "../db/database.js";
import {
  createCustomer,
  createSupplier,
  deactivateCustomer,
  deactivateSupplier,
  listCustomers,
  listSuppliers,
  updateCustomer,
  updateSupplier
} from "./partners.js";

describe("customer and supplier services", () => {
  const db = openDatabase(":memory:");
  afterAll(() => closeDatabase(db));

  afterEach(() => {
    db.exec("DELETE FROM audit_events");
    db.exec("DELETE FROM customers");
    db.exec("DELETE FROM suppliers");
  });

  it("creates, searches and updates customers using integer minor-unit credit limits", () => {
    const customer = createCustomer(db, {
      code: "C-001",
      name: "عميل نقدي",
      phone: "+967700000001",
      creditLimitMinor: 12500
    });
    expect(customer.credit_limit_minor).toBe(12500);
    expect(listCustomers(db, "C-001")).toHaveLength(1);

    const updated = updateCustomer(db, customer.id, {
      code: "C-001",
      name: "عميل محدث",
      phone: null,
      creditLimitMinor: 25000
    });
    expect(updated.name).toBe("عميل محدث");
    expect(updated.credit_limit_minor).toBe(25000);
    expect(db.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE entity_type = 'customer'").get())
      .toEqual({ count: 2 });
  });

  it("creates, searches and updates suppliers", () => {
    const supplier = createSupplier(db, {
      code: "S-001",
      name: "مورد تجريبي",
      phone: "777000000"
    });
    expect(listSuppliers(db, "مورد")).toHaveLength(1);

    const updated = updateSupplier(db, supplier.id, {
      code: "S-002",
      name: "مورد محدث"
    });
    expect(updated.code).toBe("S-002");
    expect(updated.name).toBe("مورد محدث");
  });

  it("rejects invalid and duplicate partner identities and invalid credit limits", () => {
    createCustomer(db, { code: "C-002", name: "عميل صحيح" });
    expect(() => createCustomer(db, { code: "C-002", name: "تكرار" })).toThrow();
    expect(() => createSupplier(db, { code: "bad code", name: "مورد" })).toThrow();
    expect(() => createCustomer(db, {
      code: "C-003",
      name: "عميل غير صالح",
      creditLimitMinor: -1
    })).toThrow(/creditLimitMinor/);
  });

  it("deactivates partners with an auditable, non-destructive operation", () => {
    const customer = createCustomer(db, { code: "C-004", name: "عميل" });
    const supplier = createSupplier(db, { code: "S-004", name: "مورد" });
    deactivateCustomer(db, customer.id);
    deactivateSupplier(db, supplier.id);
    expect(listCustomers(db)).toHaveLength(0);
    expect(listSuppliers(db)).toHaveLength(0);
    expect(db.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action LIKE '%deactivated'").get())
      .toEqual({ count: 2 });
  });

  it("keeps stored partner history and rejects updates to deactivated records", () => {
    const customer = createCustomer(db, { code: "C-005", name: "عميل" });
    deactivateCustomer(db, customer.id);
    expect(() => updateCustomer(db, customer.id, {
      code: "C-005",
      name: "بعد التعطيل"
    })).toThrow(/Inactive/);
    expect(db.prepare("SELECT is_active FROM customers WHERE id = ?").get(customer.id))
      .toEqual({ is_active: 0 });
  });
});
