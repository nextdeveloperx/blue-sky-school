/**
 * Pure validation/normalization for the admissions enquiry form. Mirrors
 * the CHECK constraints and validation inside the submit_admission_enquiry
 * database function exactly (see supabase/migrations/20261020_30_...) so
 * the frontend rejects bad input with a helpful message before ever
 * reaching the server, while the server-side copy remains the real
 * enforcement boundary a client can't bypass.
 */

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** Strips everything but digits and a single leading "+" — accepts any
 * international format a parent might type (spaces, hyphens, parens,
 * dots), not just a 10-digit Indian pattern. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  return (hasPlus ? "+" : "") + digits;
}

export function isValidPhone(normalized: string): boolean {
  return PHONE_PATTERN.test(normalized);
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

export interface EnquiryFormValues {
  parentName: string;
  phone: string;
  email: string;
  studentName: string;
  applyingForClass: string;
  academicSession: string;
  message: string;
  consent: boolean;
}

export type EnquiryFieldErrors = Partial<Record<keyof EnquiryFormValues, string>>;

export function validateEnquiryForm(values: EnquiryFormValues): EnquiryFieldErrors {
  const errors: EnquiryFieldErrors = {};

  const name = values.parentName.trim();
  if (name.length < 2) {
    errors.parentName = "Enter the parent/guardian's name";
  } else if (name.length > 120) {
    errors.parentName = "Name is too long (120 characters max)";
  }

  const phone = normalizePhone(values.phone);
  if (!isValidPhone(phone)) {
    errors.phone = "Enter a valid contact number, with country code if outside India";
  }

  if (values.email.trim() !== "" && !isValidEmail(values.email.trim())) {
    errors.email = "Enter a valid email address";
  }

  if (values.studentName.trim().length > 120) {
    errors.studentName = "Student name is too long (120 characters max)";
  }

  if (values.applyingForClass.trim() === "") {
    errors.applyingForClass = "Select the class you're applying for";
  }

  if (values.academicSession.trim() === "") {
    errors.academicSession = "Academic session is required";
  }

  if (values.message.length > 1000) {
    errors.message = "Message is too long (1000 characters max)";
  }

  if (!values.consent) {
    errors.consent = "Consent to be contacted is required to submit an enquiry";
  }

  return errors;
}

export function hasEnquiryFormErrors(errors: EnquiryFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
