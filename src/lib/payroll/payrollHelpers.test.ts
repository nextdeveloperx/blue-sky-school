import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_KIND_EXPLANATIONS,
  ADJUSTMENT_KIND_LABELS,
  computePayrollSummary,
  isFullyDisbursed,
  type PayslipLike,
} from "./payrollHelpers";

describe("computePayrollSummary", () => {
  it("sums base, adjustments, and net across all payslips", () => {
    const payslips: PayslipLike[] = [
      { base_amount_minor: 5000000, adjustments_total_minor: 50000, net_amount_minor: 5050000, paid_at: null },
      { base_amount_minor: 4000000, adjustments_total_minor: -20000, net_amount_minor: 3980000, paid_at: null },
    ];
    const summary = computePayrollSummary(payslips);
    expect(summary.staffCount).toBe(2);
    expect(summary.baseTotalMinor).toBe(9000000);
    expect(summary.adjustmentsTotalMinor).toBe(30000);
    expect(summary.netTotalMinor).toBe(9030000);
  });

  it("separates disbursed (paid) from remaining (not yet paid) by net amount", () => {
    const payslips: PayslipLike[] = [
      { base_amount_minor: 5000000, adjustments_total_minor: 0, net_amount_minor: 5000000, paid_at: "2026-10-05T00:00:00Z" },
      { base_amount_minor: 4000000, adjustments_total_minor: 0, net_amount_minor: 4000000, paid_at: null },
    ];
    const summary = computePayrollSummary(payslips);
    expect(summary.disbursedTotalMinor).toBe(5000000);
    expect(summary.disbursedCount).toBe(1);
    expect(summary.remainingTotalMinor).toBe(4000000);
    expect(summary.remainingCount).toBe(1);
  });

  it("never reports a paid amount when nothing has been marked paid", () => {
    const payslips: PayslipLike[] = [
      { base_amount_minor: 5000000, adjustments_total_minor: 0, net_amount_minor: 5000000, paid_at: null },
    ];
    const summary = computePayrollSummary(payslips);
    expect(summary.disbursedTotalMinor).toBe(0);
    expect(summary.disbursedCount).toBe(0);
    expect(summary.remainingTotalMinor).toBe(5000000);
  });

  it("returns all zeros for an empty run", () => {
    const summary = computePayrollSummary([]);
    expect(summary).toEqual({
      staffCount: 0,
      baseTotalMinor: 0,
      adjustmentsTotalMinor: 0,
      netTotalMinor: 0,
      disbursedTotalMinor: 0,
      disbursedCount: 0,
      remainingTotalMinor: 0,
      remainingCount: 0,
    });
  });
});

describe("isFullyDisbursed", () => {
  it("is false for an empty run (nothing to disburse yet, not \"done\")", () => {
    expect(isFullyDisbursed([])).toBe(false);
  });

  it("is false when at least one payslip is unpaid", () => {
    const payslips: PayslipLike[] = [
      { base_amount_minor: 1, adjustments_total_minor: 0, net_amount_minor: 1, paid_at: "2026-10-05T00:00:00Z" },
      { base_amount_minor: 1, adjustments_total_minor: 0, net_amount_minor: 1, paid_at: null },
    ];
    expect(isFullyDisbursed(payslips)).toBe(false);
  });

  it("is true once every payslip is marked paid", () => {
    const payslips: PayslipLike[] = [
      { base_amount_minor: 1, adjustments_total_minor: 0, net_amount_minor: 1, paid_at: "2026-10-05T00:00:00Z" },
      { base_amount_minor: 1, adjustments_total_minor: 0, net_amount_minor: 1, paid_at: "2026-10-06T00:00:00Z" },
    ];
    expect(isFullyDisbursed(payslips)).toBe(true);
  });
});

describe("adjustment kind labels and explanations", () => {
  it("has a label and explanation for every supported kind", () => {
    for (const kind of ["bonus", "advance", "deduction"] as const) {
      expect(ADJUSTMENT_KIND_LABELS[kind]).toBeTruthy();
      expect(ADJUSTMENT_KIND_EXPLANATIONS[kind]).toBeTruthy();
    }
  });

  it("describes bonus as adding to pay, and advance/deduction as subtracting", () => {
    expect(ADJUSTMENT_KIND_EXPLANATIONS.bonus.toLowerCase()).toContain("add");
    expect(ADJUSTMENT_KIND_EXPLANATIONS.advance.toLowerCase()).toContain("subtract");
    expect(ADJUSTMENT_KIND_EXPLANATIONS.deduction.toLowerCase()).toContain("subtract");
  });
});
