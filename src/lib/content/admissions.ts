/**
 * Single source of truth for the admission-session label shown across the
 * public site (hero badge, Admissions page, homepage CTA band).
 *
 * FLAG FOR SCHOOL REVIEW: this value was not changed as part of this pass
 * because it cannot be verified from any source in this codebase — the
 * `academic_years` table (the one place a real "current" session is
 * recorded) has no rows in production, and there is no other verified
 * school record to read it from. The value below was simply carried
 * forward from the existing site copy, which predates this review.
 *
 * As of this writing the system date is well into what would be the
 * 2026-27 cycle for an April-March school year, so "2025-26" is likely
 * stale. Confirm the real current/open admission session with the school
 * and update this one constant — every place that shows it will update
 * together.
 */
export const CURRENT_ADMISSION_SESSION = "2025-26";

/**
 * Class levels offered — mirrors the same labels already shown on the
 * Academics page (src/pages/Academics.tsx), reused here rather than
 * invented separately so the enquiry form's dropdown always matches what
 * the school actually advertises it teaches.
 */
export const APPLYING_CLASS_OPTIONS = [
  "Nursery",
  "LKG",
  "UKG",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
] as const;
