/**
 * The only module that should ever touch money arithmetic. All amounts are
 * integer minor units (paise) end to end — in the database, in RPC payloads,
 * and here. Never do `amount * 100` or `/ 100` inline anywhere else.
 */

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/** Parses a rupees-and-paise user input string (e.g. "1250.50") into minor units. */
export function rupeesToMinor(rupees: string | number): number {
  const value = typeof rupees === "string" ? Number(rupees) : rupees;
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid rupee amount: ${rupees}`);
  }
  // Round rather than truncate so 10.005 doesn't silently become 1000.
  return Math.round(value * 100);
}

/** Formats minor units as a localized rupee string, e.g. 125050 -> "₹1,250.50". */
export function formatMinor(amountMinor: number): string {
  return INR_FORMATTER.format(amountMinor / 100);
}

/** Sums an array of minor-unit amounts. */
export function sumMinor(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

/** True if a value is a valid non-negative integer minor-unit amount. */
export function isValidMinor(amount: number): boolean {
  return Number.isInteger(amount) && amount >= 0;
}
