import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  isValidPhone,
  isValidEmail,
  validateEnquiryForm,
  hasEnquiryFormErrors,
  type EnquiryFormValues,
} from "./enquiry";

function baseValues(overrides: Partial<EnquiryFormValues> = {}): EnquiryFormValues {
  return {
    parentName: "Jane Parent",
    phone: "+91 98765 43210",
    email: "jane@example.com",
    studentName: "Little Jane",
    applyingForClass: "Class 1",
    academicSession: "2025-26",
    message: "Interested in admission",
    consent: true,
    ...overrides,
  };
}

describe("normalizePhone", () => {
  it("strips spaces, hyphens, and parentheses", () => {
    expect(normalizePhone("+91 (987) 654-3210")).toBe("+919876543210");
  });

  it("preserves a leading + but strips everything else non-numeric", () => {
    expect(normalizePhone("+1-555-0100")).toBe("+15550100");
  });

  it("does not assume an Indian number — accepts other country codes", () => {
    expect(isValidPhone(normalizePhone("+44 20 7946 0958"))).toBe(true);
    expect(isValidPhone(normalizePhone("+1 650 555 0100"))).toBe(true);
  });

  it("leaves a plain national number (no +) as digits only", () => {
    expect(normalizePhone("98765 43210")).toBe("9876543210");
  });
});

describe("isValidPhone", () => {
  it("accepts 7-15 digit numbers with an optional leading +", () => {
    expect(isValidPhone("9876543210")).toBe(true);
    expect(isValidPhone("+919876543210")).toBe(true);
    expect(isValidPhone("1234567")).toBe(true); // 7 digits, lower bound
  });

  it("rejects too-short or too-long numbers", () => {
    expect(isValidPhone("123456")).toBe(false); // 6 digits
    expect(isValidPhone("1234567890123456")).toBe(false); // 16 digits
  });

  it("rejects non-numeric content", () => {
    expect(isValidPhone("not-a-phone")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("jane@example.com")).toBe(true);
    expect(isValidEmail("jane.parent+school@example.co.in")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing-domain@")).toBe(false);
    expect(isValidEmail("@missing-local.com")).toBe(false);
  });
});

describe("validateEnquiryForm", () => {
  it("passes for a fully valid, complete submission", () => {
    const errors = validateEnquiryForm(baseValues());
    expect(hasEnquiryFormErrors(errors)).toBe(false);
  });

  it("passes with every optional field left empty", () => {
    const errors = validateEnquiryForm(
      baseValues({ email: "", studentName: "", message: "" }),
    );
    expect(hasEnquiryFormErrors(errors)).toBe(false);
  });

  it("flags a missing/too-short parent name", () => {
    expect(validateEnquiryForm(baseValues({ parentName: "" })).parentName).toBeTruthy();
    expect(validateEnquiryForm(baseValues({ parentName: "J" })).parentName).toBeTruthy();
  });

  it("flags an oversized parent name", () => {
    expect(
      validateEnquiryForm(baseValues({ parentName: "x".repeat(121) })).parentName,
    ).toBeTruthy();
  });

  it("flags a malformed phone number", () => {
    expect(validateEnquiryForm(baseValues({ phone: "abc" })).phone).toBeTruthy();
  });

  it("flags a malformed email only when one is provided", () => {
    expect(validateEnquiryForm(baseValues({ email: "not-an-email" })).email).toBeTruthy();
    expect(validateEnquiryForm(baseValues({ email: "" })).email).toBeUndefined();
  });

  it("flags an oversized student name", () => {
    expect(
      validateEnquiryForm(baseValues({ studentName: "x".repeat(121) })).studentName,
    ).toBeTruthy();
  });

  it("flags a missing class or session", () => {
    expect(validateEnquiryForm(baseValues({ applyingForClass: "" })).applyingForClass).toBeTruthy();
    expect(validateEnquiryForm(baseValues({ academicSession: "" })).academicSession).toBeTruthy();
  });

  it("flags an oversized message", () => {
    expect(validateEnquiryForm(baseValues({ message: "x".repeat(1001) })).message).toBeTruthy();
  });

  it("flags missing consent", () => {
    expect(validateEnquiryForm(baseValues({ consent: false })).consent).toBeTruthy();
  });

  it("reports multiple simultaneous errors, not just the first", () => {
    const errors = validateEnquiryForm(
      baseValues({ parentName: "", phone: "bad", consent: false }),
    );
    expect(Object.keys(errors).length).toBeGreaterThanOrEqual(3);
  });
});
