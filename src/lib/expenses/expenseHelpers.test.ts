import { describe, expect, it } from "vitest";
import {
  canManageExpenses,
  computeExpenseTotals,
  expenseFormSchema,
  filterExpenses,
  groupExpensesByCategory,
  groupExpensesByPeriod,
  matchesPeriodLabel,
  type ExpenseFilterRow,
  type ExpenseLike,
} from "./expenseHelpers";

describe("expenseFormSchema (creation + validation)", () => {
  const valid = {
    title: "Electricity Bill",
    category_id: "11111111-1111-1111-1111-111111111111",
    incurred_on: "2026-10-25",
    amount: "1250.50",
    payment_method: "upi" as const,
    vendor: "City Power Co",
    description: "October bill",
    receipt_ref: "RCPT-123",
  };

  it("accepts a fully valid expense", () => {
    expect(expenseFormSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts optional fields left blank", () => {
    const result = expenseFormSchema.safeParse({ ...valid, vendor: "", description: "", receipt_ref: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing title", () => {
    const result = expenseFormSchema.safeParse({ ...valid, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only title", () => {
    const result = expenseFormSchema.safeParse({ ...valid, title: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a missing category", () => {
    const result = expenseFormSchema.safeParse({ ...valid, category_id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing date", () => {
    const result = expenseFormSchema.safeParse({ ...valid, incurred_on: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a zero amount", () => {
    const result = expenseFormSchema.safeParse({ ...valid, amount: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = expenseFormSchema.safeParse({ ...valid, amount: "-50" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric amount", () => {
    const result = expenseFormSchema.safeParse({ ...valid, amount: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid payment method", () => {
    const result = expenseFormSchema.safeParse({ ...valid, payment_method: "bitcoin" });
    expect(result.success).toBe(false);
  });

  it("accepts every supported payment method", () => {
    for (const method of ["cash", "upi", "bank_transfer", "cheque", "other"]) {
      expect(expenseFormSchema.safeParse({ ...valid, payment_method: method }).success).toBe(true);
    }
  });
});

describe("canManageExpenses (authorization)", () => {
  it("allows principal", () => {
    expect(canManageExpenses(["principal"])).toBe(true);
  });

  it("allows accountant", () => {
    expect(canManageExpenses(["accountant"])).toBe(true);
  });

  it("denies teacher", () => {
    expect(canManageExpenses(["teacher"])).toBe(false);
  });

  it("denies parent", () => {
    expect(canManageExpenses(["parent"])).toBe(false);
  });

  it("denies a user with no roles", () => {
    expect(canManageExpenses([])).toBe(false);
  });

  it("allows a user holding multiple roles including principal", () => {
    expect(canManageExpenses(["teacher", "principal"])).toBe(true);
  });
});

describe("computeExpenseTotals", () => {
  const rows: ExpenseLike[] = [
    { amount_minor: 10000, incurred_on: "2026-10-25", voided_at: null }, // today
    { amount_minor: 25000, incurred_on: "2026-10-25", voided_at: null }, // today
    { amount_minor: 50000, incurred_on: "2026-10-10", voided_at: null }, // earlier this month
    { amount_minor: 99999, incurred_on: "2026-10-05", voided_at: "2026-10-06T00:00:00Z" }, // voided — excluded
    { amount_minor: 70000, incurred_on: "2026-09-30", voided_at: null }, // last month
  ];

  it("sums today's expenses and counts them", () => {
    const totals = computeExpenseTotals(rows, { today: "2026-10-25", monthPrefix: "2026-10" });
    expect(totals.todayTotalMinor).toBe(35000);
    expect(totals.todayCount).toBe(2);
  });

  it("sums this month's expenses, excluding voided and other months", () => {
    const totals = computeExpenseTotals(rows, { today: "2026-10-25", monthPrefix: "2026-10" });
    expect(totals.monthTotalMinor).toBe(85000);
  });

  it("excludes voided expenses from every total", () => {
    const totals = computeExpenseTotals(rows, { today: "2026-10-25", monthPrefix: "2026-10" });
    // 155000 = sum of all non-voided rows; if the voided 99999 row leaked in, this would be 254999.
    expect(totals.rangeTotalMinor).toBe(155000);
  });

  it("respects a custom date range", () => {
    const totals = computeExpenseTotals(rows, {
      today: "2026-10-25",
      monthPrefix: "2026-10",
      rangeFrom: "2026-10-01",
      rangeTo: "2026-10-25",
    });
    expect(totals.rangeTotalMinor).toBe(85000);
    expect(totals.rangeCount).toBe(3);
  });

  it("returns zeros for an empty dataset", () => {
    const totals = computeExpenseTotals([], { today: "2026-10-25", monthPrefix: "2026-10" });
    expect(totals.todayTotalMinor).toBe(0);
    expect(totals.todayCount).toBe(0);
    expect(totals.monthTotalMinor).toBe(0);
  });
});

describe("filterExpenses", () => {
  const rows: ExpenseFilterRow[] = [
    {
      id: "1",
      title: "Electricity Bill",
      vendor: "City Power",
      description: "October",
      category_id: "cat-electricity",
      payment_method: "upi",
      incurred_on: "2026-10-05",
      voided_at: null,
    },
    {
      id: "2",
      title: "Cleaning Supplies",
      vendor: "SparkleCo",
      description: null,
      category_id: "cat-cleaning",
      payment_method: "cash",
      incurred_on: "2026-10-10",
      voided_at: null,
    },
    {
      id: "3",
      title: "Old Repair",
      vendor: "Fix-It",
      description: "mistaken entry",
      category_id: "cat-repairs",
      payment_method: "cash",
      incurred_on: "2026-09-20",
      voided_at: "2026-09-21T00:00:00Z",
    },
  ];

  it("excludes voided rows by default", () => {
    const result = filterExpenses(rows, {});
    expect(result.map((r) => r.id)).toEqual(["1", "2"]);
  });

  it("includes voided rows when explicitly asked", () => {
    const result = filterExpenses(rows, { includeVoided: true });
    expect(result.map((r) => r.id)).toEqual(["1", "2", "3"]);
  });

  it("filters by category", () => {
    const result = filterExpenses(rows, { categoryId: "cat-cleaning" });
    expect(result.map((r) => r.id)).toEqual(["2"]);
  });

  it("filters by payment method", () => {
    const result = filterExpenses(rows, { paymentMethod: "upi" });
    expect(result.map((r) => r.id)).toEqual(["1"]);
  });

  it("filters by date range", () => {
    const result = filterExpenses(rows, { dateFrom: "2026-10-06", dateTo: "2026-10-31" });
    expect(result.map((r) => r.id)).toEqual(["2"]);
  });

  it("searches across title, vendor, and description case-insensitively", () => {
    expect(filterExpenses(rows, { search: "sparkle" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterExpenses(rows, { search: "CITY" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterExpenses(rows, { search: "october" }).map((r) => r.id)).toEqual(["1"]);
  });

  it("combines multiple filters (AND semantics)", () => {
    const result = filterExpenses(rows, { paymentMethod: "cash", categoryId: "cat-cleaning" });
    expect(result.map((r) => r.id)).toEqual(["2"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterExpenses(rows, { search: "nonexistent-vendor-xyz" })).toEqual([]);
  });
});

describe("groupExpensesByCategory", () => {
  it("sums spend per category, largest first", () => {
    const result = groupExpensesByCategory([
      { category_name: "Electricity", amount_minor: 50000, voided_at: null },
      { category_name: "Cleaning", amount_minor: 200000, voided_at: null },
      { category_name: "Electricity", amount_minor: 30000, voided_at: null },
    ]);
    expect(result).toEqual([
      { name: "Cleaning", value: 200000 },
      { name: "Electricity", value: 80000 },
    ]);
  });

  it("excludes voided expenses from category totals", () => {
    const result = groupExpensesByCategory([
      { category_name: "Repairs", amount_minor: 100000, voided_at: null },
      { category_name: "Repairs", amount_minor: 999999, voided_at: "2026-10-06T00:00:00Z" },
    ]);
    expect(result).toEqual([{ name: "Repairs", value: 100000 }]);
  });

  it("groups a null category under Uncategorized", () => {
    const result = groupExpensesByCategory([{ category_name: null, amount_minor: 1000, voided_at: null }]);
    expect(result).toEqual([{ name: "Uncategorized", value: 1000 }]);
  });

  it("returns an empty array for no expenses", () => {
    expect(groupExpensesByCategory([])).toEqual([]);
  });
});

describe("groupExpensesByPeriod", () => {
  const rows: ExpenseLike[] = [
    { amount_minor: 10000, incurred_on: "2026-07-05", voided_at: null },
    { amount_minor: 20000, incurred_on: "2026-07-05", voided_at: null },
    { amount_minor: 30000, incurred_on: "2026-07-20", voided_at: null },
    { amount_minor: 40000, incurred_on: "2026-08-02", voided_at: null },
    { amount_minor: 99999, incurred_on: "2026-07-05", voided_at: "2026-07-06T00:00:00Z" },
  ];

  it("groups by day, excluding voided, in chronological order", () => {
    const result = groupExpensesByPeriod(rows, "day");
    expect(result).toEqual([
      { name: "5 Jul 2026", value: 30000 },
      { name: "20 Jul 2026", value: 30000 },
      { name: "2 Aug 2026", value: 40000 },
    ]);
  });

  it("groups by month, excluding voided, in chronological order", () => {
    const result = groupExpensesByPeriod(rows, "month");
    expect(result).toEqual([
      { name: "Jul 2026", value: 60000 },
      { name: "Aug 2026", value: 40000 },
    ]);
  });

  it("keeps different years with the same month distinct (no label collision)", () => {
    const multiYear: ExpenseLike[] = [
      { amount_minor: 1000, incurred_on: "2025-07-05", voided_at: null },
      { amount_minor: 2000, incurred_on: "2026-07-05", voided_at: null },
    ];
    const result = groupExpensesByPeriod(multiYear, "month");
    expect(result).toEqual([
      { name: "Jul 2025", value: 1000 },
      { name: "Jul 2026", value: 2000 },
    ]);
  });

  it("correctly crosses a year boundary (December -> January) without a timezone-shifted date", () => {
    const yearBoundary: ExpenseLike[] = [
      { amount_minor: 500, incurred_on: "2026-12-31", voided_at: null },
      { amount_minor: 700, incurred_on: "2027-01-01", voided_at: null },
    ];
    const result = groupExpensesByPeriod(yearBoundary, "day");
    expect(result).toEqual([
      { name: "31 Dec 2026", value: 500 },
      { name: "1 Jan 2027", value: 700 },
    ]);
  });

  it("returns an empty array for no expenses", () => {
    expect(groupExpensesByPeriod([], "month")).toEqual([]);
  });
});

describe("matchesPeriodLabel", () => {
  it("matches a day label to its own date only", () => {
    expect(matchesPeriodLabel("2026-07-05", "5 Jul 2026", "day")).toBe(true);
    expect(matchesPeriodLabel("2026-07-06", "5 Jul 2026", "day")).toBe(false);
  });

  it("matches a month label to any date within that month", () => {
    expect(matchesPeriodLabel("2026-07-01", "Jul 2026", "month")).toBe(true);
    expect(matchesPeriodLabel("2026-07-31", "Jul 2026", "month")).toBe(true);
    expect(matchesPeriodLabel("2026-08-01", "Jul 2026", "month")).toBe(false);
  });

  it("does not confuse the same month across different years", () => {
    expect(matchesPeriodLabel("2025-07-05", "Jul 2026", "month")).toBe(false);
  });
});
