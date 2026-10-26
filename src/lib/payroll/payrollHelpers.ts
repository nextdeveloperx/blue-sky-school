export const ADJUSTMENT_KINDS = ["bonus", "advance", "deduction"] as const;
export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number];

export const ADJUSTMENT_KIND_LABELS: Record<AdjustmentKind, string> = {
  bonus: "Bonus",
  advance: "Advance",
  deduction: "Deduction",
};

/** Plain-English explanation of each adjustment type, used by the Info panel and inline help —
 * kept here (not hardcoded in JSX) so the wording can be unit-tested against what the RPC
 * actually does (bonus adds to net pay, advance/deduction subtract — see migration 15). */
export const ADJUSTMENT_KIND_EXPLANATIONS: Record<AdjustmentKind, string> = {
  bonus: "Adds to this month's pay — e.g. a festival bonus or performance reward.",
  advance: "Subtracts from this month's pay — money already given to the staff member ahead of payday.",
  deduction: "Subtracts from this month's pay — e.g. for unpaid leave or a correction.",
};

export const PAYROLL_PAYMENT_METHODS = ["cash", "upi", "bank_transfer"] as const;
export type PayrollPaymentMethod = (typeof PAYROLL_PAYMENT_METHODS)[number];

export const PAYROLL_PAYMENT_METHOD_LABELS: Record<PayrollPaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
};

export interface PayslipLike {
  base_amount_minor: number;
  adjustments_total_minor: number;
  net_amount_minor: number;
  paid_at: string | null;
}

export interface PayrollSummary {
  staffCount: number;
  baseTotalMinor: number;
  adjustmentsTotalMinor: number;
  netTotalMinor: number;
  /** Sum of net pay for payslips actually marked paid — "disbursed", not "finalized". */
  disbursedTotalMinor: number;
  disbursedCount: number;
  /** Net pay still owed on payslips not yet marked paid. Only meaningful once the run is
   * finalized (amounts are locked); reported either way, from whatever payslips are present. */
  remainingTotalMinor: number;
  remainingCount: number;
}

/**
 * Totals for the Payroll Summary section, computed purely from the payslips
 * of one run (no DB read of its own) — the same payslip rows the "Monthly
 * Payroll" table already shows, so the summary can never disagree with the
 * detail rows beneath it.
 */
export function computePayrollSummary(payslips: PayslipLike[]): PayrollSummary {
  let baseTotalMinor = 0;
  let adjustmentsTotalMinor = 0;
  let netTotalMinor = 0;
  let disbursedTotalMinor = 0;
  let disbursedCount = 0;
  let remainingTotalMinor = 0;
  let remainingCount = 0;

  for (const p of payslips) {
    baseTotalMinor += p.base_amount_minor;
    adjustmentsTotalMinor += p.adjustments_total_minor;
    netTotalMinor += p.net_amount_minor;
    if (p.paid_at) {
      disbursedTotalMinor += p.net_amount_minor;
      disbursedCount += 1;
    } else {
      remainingTotalMinor += p.net_amount_minor;
      remainingCount += 1;
    }
  }

  return {
    staffCount: payslips.length,
    baseTotalMinor,
    adjustmentsTotalMinor,
    netTotalMinor,
    disbursedTotalMinor,
    disbursedCount,
    remainingTotalMinor,
    remainingCount,
  };
}

/** True once every payslip in the run has been marked paid — used only for display ("fully
 * disbursed" vs "partially disbursed"), never to imply a run auto-transitions status. */
export function isFullyDisbursed(payslips: PayslipLike[]): boolean {
  return payslips.length > 0 && payslips.every((p) => p.paid_at);
}
