import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

/** Extracts the raw cell text for a single-row, single-column toCsv() call,
 * undoing at most one layer of CSV quoting so we can inspect what a
 * spreadsheet app would actually see as the start of the cell. Splits only
 * on the header/data boundary (not on every "\n") because a data value
 * containing its own embedded newline legitimately spans multiple lines
 * inside CSV quotes — naively splitting on "\n" would cut that value in
 * half and produce a false failure, not a real one. */
function firstDataCell(csv: string): string {
  const headerEnd = csv.indexOf("\n");
  const rest = headerEnd === -1 ? "" : csv.slice(headerEnd + 1);
  if (rest.startsWith('"') && rest.endsWith('"')) {
    return rest.slice(1, -1).replace(/""/g, '"');
  }
  return rest;
}

describe("toCsv — CSV formatting (non-security)", () => {
  it("quotes values containing commas", () => {
    expect(toCsv([{ a: "x,y" }])).toBe('a\n"x,y"');
  });

  it("escapes embedded double quotes", () => {
    expect(toCsv([{ a: 'say "hi"' }])).toBe('a\n"say ""hi"""');
  });

  it("quotes values containing embedded newlines", () => {
    expect(toCsv([{ a: "line1\nline2" }])).toBe('a\n"line1\nline2"');
  });

  it("renders null as empty", () => {
    expect(toCsv([{ a: null }])).toBe("a\n");
  });

  it("renders undefined as empty", () => {
    expect(toCsv([{ a: undefined }])).toBe("a\n");
  });

  it("renders an explicit empty string as empty, unquoted", () => {
    expect(toCsv([{ a: "" }])).toBe("a\n");
  });

  it("does not add a header/data row for an empty input array", () => {
    expect(toCsv([])).toBe("");
  });

  it("leaves negative numeric-looking values that don't start with - or + alone", () => {
    // A number embedded mid-string, or a value with no leading sign, is
    // never touched by the formula guard.
    expect(toCsv([{ a: "100" }])).toBe("a\n100");
    expect(toCsv([{ a: "0" }])).toBe("a\n0");
    expect(toCsv([{ a: "3.14" }])).toBe("a\n3.14");
  });

  it("passes through Unicode text and ordinary names unmodified", () => {
    expect(toCsv([{ name: "José García" }])).toBe("name\nJosé García");
    expect(toCsv([{ name: "北京小学" }])).toBe("name\n北京小学");
    expect(toCsv([{ name: "Müller-Schmidt" }])).toBe("name\nMüller-Schmidt");
    expect(toCsv([{ name: "O'Brien" }])).toBe("name\nO'Brien"); // apostrophe mid-name, not a leading one
  });

  it("produces exactly one data row per input row (row count preserved)", () => {
    const rows = [{ a: "x" }, { a: "=1+1" }, { a: "y,z" }, { a: null }];
    const csv = toCsv(rows);
    // header + 4 data rows = 5 lines
    expect(csv.split("\n").length).toBe(5);
  });
});

describe("toCsv — formula-injection neutralization (CWE-1236)", () => {
  // Free-text fields that land in real exports (expenses.description,
  // payments.reference_note, guardian/student names) are writable by
  // accountant/teacher accounts, so this must hold regardless of who opens
  // the exported file, and regardless of which supported spreadsheet app
  // they use (Excel, Google Sheets, LibreOffice all honor a leading `'`).

  it("neutralizes a leading '=' (the classic case)", () => {
    const malicious = '=HYPERLINK("http://evil.example","click")';
    const cell = firstDataCell(toCsv([{ description: malicious }]));
    expect(cell).toBe(`'${malicious}`);
    expect(/^[=+\-@]/.test(cell)).toBe(false);
  });

  it("neutralizes a leading '+'", () => {
    expect(toCsv([{ a: "+1+1" }])).toBe("a\n'+1+1");
  });

  it("neutralizes a leading '-'", () => {
    expect(toCsv([{ a: "-2+3" }])).toBe("a\n'-2+3");
  });

  it("neutralizes a leading '@' (DDE-style trigger)", () => {
    const cell = firstDataCell(toCsv([{ a: "@SUM(1,1)" }]));
    expect(cell).toBe("'@SUM(1,1)");
  });

  it("does not treat a mid-string formula character as a trigger", () => {
    // Only the LEADING character (ignoring leading whitespace) matters —
    // "Revenue=5000" is safe plain text and must round-trip untouched.
    expect(toCsv([{ a: "Revenue=5000" }])).toBe("a\nRevenue=5000");
  });

  describe("bypass via leading whitespace/control characters", () => {
    // Some spreadsheet import paths trim leading whitespace before
    // deciding whether a cell is a formula — a naive "does the string
    // start with one of these exact characters" check misses this.
    it.each([
      ["leading space", " =1+1"],
      ["leading tab", "\t+1+1"],
      ["leading carriage return", "\r-1+1"],
      ["leading newline", "\n@A1"],
      ["multiple leading spaces", "   =1+1"],
      ["tab then space then trigger", "\t =SUM(A1:A2)"],
    ])("neutralizes: %s", (_label, value) => {
      const cell = firstDataCell(toCsv([{ a: value }]));
      // The neutralized cell must not evaluate as a formula: a literal
      // apostrophe must be the very first character.
      expect(cell.startsWith("'")).toBe(true);
      expect(cell).toBe(`'${value}`);
    });
  });

  it("still renders a legitimate negative number as readable text", () => {
    // Accepted tradeoff of the standard mitigation: a real negative number
    // also gets the neutralizing prefix. Every supported spreadsheet app
    // hides the leading apostrophe and displays the value correctly as
    // text — this does not corrupt or hide the underlying value, it only
    // means it reads as text rather than a formatted number.
    expect(toCsv([{ a: "-500" }])).toBe("a\n'-500");
  });

  it("still renders an ordinary '+'-prefixed phone number as readable text", () => {
    const cell = firstDataCell(toCsv([{ phone: "+91-9876543210" }]));
    expect(cell).toBe("'+91-9876543210");
  });

  it("combines correctly with comma/quote escaping", () => {
    // Formula neutralization happens BEFORE the quote/comma escaping pass,
    // so a malicious value that also contains commas or quotes still gets
    // both protections applied together, not one at the expense of the other.
    const cell = firstDataCell(toCsv([{ a: '=A1,"B1"' }]));
    expect(cell.startsWith("'=A1,")).toBe(true);
    expect(/^[=+\-@]/.test(cell)).toBe(false);
  });

  it("never lets an exported cell begin with =, +, -, or @ after neutralization", () => {
    const cases = [
      "=1+1",
      "+1+1",
      "-1+1",
      "@A1",
      '=HYPERLINK("x","y")',
      " =1+1",
      "\t@CMD",
    ];
    for (const value of cases) {
      const cell = firstDataCell(toCsv([{ a: value }]));
      expect(/^[=+\-@]/.test(cell)).toBe(false);
    }
  });
});
