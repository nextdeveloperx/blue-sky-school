export const RESULT_STATUSES = ["draft", "approved", "rejected", "published"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  rejected: "Rejected",
  published: "Published",
};

/** Plain-English explanation of each status, used by the Info panel and status
 * column — kept here so the wording stays in sync with what the RPCs
 * (compute_results/approve_results/reject_results/publish_results/
 * reopen_for_correction in migration 19) actually do. */
export const RESULT_STATUS_EXPLANATIONS: Record<ResultStatus, string> = {
  draft: "Marks are still being totalled or reviewed. Nothing is final yet.",
  approved: "The principal has reviewed and approved this result. It is ready to publish.",
  rejected:
    "The principal sent this back with a reason instead of approving it. There is currently no action in this system that moves a rejected result forward again — correcting marks and recomputing updates the numbers but does not change this status.",
  published: "The official result. The student's verified parent can now see it on the Family Dashboard.",
};

export interface ResultFilterRow {
  id: string;
  student_name: string;
  admission_no: string;
  class_id: string | null;
  section_id: string | null;
  status: ResultStatus;
}

export interface ResultFilters {
  classId?: string;
  sectionId?: string;
  status?: ResultStatus | "all";
  /** Matched case-insensitively against the student's name and admission number. */
  studentQuery?: string;
}

/**
 * Filters an already-fetched list of results (for one exam term — exam term
 * itself is a server-side query parameter, not part of this filter) by
 * class, section, status, and a free-text student search. Pure and
 * dependency-free so it can be unit-tested without a Supabase client.
 */
export function filterResultRows(rows: ResultFilterRow[], filters: ResultFilters): ResultFilterRow[] {
  const query = filters.studentQuery?.trim().toLowerCase();
  return rows.filter((r) => {
    if (filters.classId && r.class_id !== filters.classId) return false;
    if (filters.sectionId && r.section_id !== filters.sectionId) return false;
    if (filters.status && filters.status !== "all" && r.status !== filters.status) return false;
    if (query) {
      const haystack = `${r.student_name} ${r.admission_no}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}
