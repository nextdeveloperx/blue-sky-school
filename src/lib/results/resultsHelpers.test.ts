import { describe, expect, it } from "vitest";
import {
  RESULT_STATUSES,
  RESULT_STATUS_EXPLANATIONS,
  RESULT_STATUS_LABELS,
  filterResultRows,
  type ResultFilterRow,
} from "./resultsHelpers";

const ROWS: ResultFilterRow[] = [
  { id: "r1", student_name: "Asha Rao", admission_no: "ADM2026-0001", class_id: "c1", section_id: "s1a", status: "draft" },
  { id: "r2", student_name: "Vikram Shah", admission_no: "ADM2026-0002", class_id: "c1", section_id: "s1b", status: "approved" },
  { id: "r3", student_name: "Meera Iyer", admission_no: "ADM2026-0003", class_id: "c2", section_id: "s2a", status: "published" },
  { id: "r4", student_name: "Rohan Gupta", admission_no: "ADM2026-0004", class_id: "c2", section_id: "s2a", status: "rejected" },
];

describe("filterResultRows", () => {
  it("returns every row when no filters are set", () => {
    expect(filterResultRows(ROWS, {})).toHaveLength(4);
  });

  it("filters by class", () => {
    const result = filterResultRows(ROWS, { classId: "c1" });
    expect(result.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("filters by section within a class", () => {
    const result = filterResultRows(ROWS, { classId: "c2", sectionId: "s2a" });
    expect(result.map((r) => r.id)).toEqual(["r3", "r4"]);
  });

  it("filters by status", () => {
    expect(filterResultRows(ROWS, { status: "published" }).map((r) => r.id)).toEqual(["r3"]);
  });

  it("treats status 'all' as no filter", () => {
    expect(filterResultRows(ROWS, { status: "all" })).toHaveLength(4);
  });

  it("matches student search case-insensitively against the name", () => {
    expect(filterResultRows(ROWS, { studentQuery: "vikram" }).map((r) => r.id)).toEqual(["r2"]);
  });

  it("matches student search against the admission number", () => {
    expect(filterResultRows(ROWS, { studentQuery: "0003" }).map((r) => r.id)).toEqual(["r3"]);
  });

  it("combines class, status, and student search", () => {
    const result = filterResultRows(ROWS, { classId: "c2", status: "rejected", studentQuery: "rohan" });
    expect(result.map((r) => r.id)).toEqual(["r4"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterResultRows(ROWS, { studentQuery: "nobody" })).toEqual([]);
  });

  it("ignores a blank search string", () => {
    expect(filterResultRows(ROWS, { studentQuery: "   " })).toHaveLength(4);
  });
});

describe("result status labels and explanations", () => {
  it("has a label and explanation for every supported status", () => {
    for (const status of RESULT_STATUSES) {
      expect(RESULT_STATUS_LABELS[status]).toBeTruthy();
      expect(RESULT_STATUS_EXPLANATIONS[status]).toBeTruthy();
    }
  });

  it("is honest that a rejected result has no supported forward action", () => {
    expect(RESULT_STATUS_EXPLANATIONS.rejected.toLowerCase()).toContain("no action");
  });
});
