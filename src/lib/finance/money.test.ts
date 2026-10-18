import { describe, it, expect } from "vitest";
import { rupeesToMinor, formatMinor, sumMinor, isValidMinor } from "./money";

describe("rupeesToMinor", () => {
  it("converts whole rupees", () => {
    expect(rupeesToMinor("1250")).toBe(125000);
  });

  it("converts rupees with paise", () => {
    expect(rupeesToMinor("1250.50")).toBe(125050);
  });

  it("rounds rather than truncates fractional paise", () => {
    expect(rupeesToMinor("10.005")).toBe(1001); // 1000.5 rounds to 1001, not 1000
  });

  it("accepts a numeric input", () => {
    expect(rupeesToMinor(99.99)).toBe(9999);
  });

  it("throws on invalid input", () => {
    expect(() => rupeesToMinor("not a number")).toThrow();
  });
});

describe("formatMinor", () => {
  it("formats whole rupees", () => {
    expect(formatMinor(125000)).toBe("₹1,250.00");
  });

  it("formats paise", () => {
    expect(formatMinor(125050)).toBe("₹1,250.50");
  });

  it("formats zero", () => {
    expect(formatMinor(0)).toBe("₹0.00");
  });
});

describe("sumMinor", () => {
  it("sums multiple amounts", () => {
    expect(sumMinor([100, 200, 300])).toBe(600);
  });

  it("returns 0 for an empty array", () => {
    expect(sumMinor([])).toBe(0);
  });
});

describe("isValidMinor", () => {
  it("accepts non-negative integers", () => {
    expect(isValidMinor(0)).toBe(true);
    expect(isValidMinor(100)).toBe(true);
  });

  it("rejects negative numbers", () => {
    expect(isValidMinor(-1)).toBe(false);
  });

  it("rejects non-integers (a stray float bug should be loud, not silent)", () => {
    expect(isValidMinor(100.5)).toBe(false);
  });
});
