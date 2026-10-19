// A cell whose text starts with one of these is interpreted as a formula by
// Excel, Google Sheets, and LibreOffice when the CSV is opened — a classic
// CSV/formula-injection vector (CWE-1236). Several exported fields
// (expense descriptions, payment reference notes, guardian/student names)
// are free text writable by accountant/teacher accounts, so this must be
// neutralized regardless of who opens the file.
//
// Leading whitespace/control characters (space, tab, CR, LF, and other
// Unicode whitespace matched by \s) before the trigger character are
// included deliberately: some spreadsheet import paths trim leading
// whitespace before deciding whether a cell is a formula, so " =1+1" is a
// documented bypass of a naive "does the cell start with one of these
// exact characters" check. Matching through leading whitespace closes that
// without altering what gets detected as "safe" plain text.
const FORMULA_TRIGGER = /^\s*[=+\-@]/;

/** Minimal CSV builder — no new dependency, CSV opens in any spreadsheet tool. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    let str = value === null || value === undefined ? "" : String(value);
    // Prefixing with a single quote is the standard mitigation: every
    // supported spreadsheet application renders the cell as literal text
    // instead of evaluating it, while the value still reads correctly.
    if (FORMULA_TRIGGER.test(str)) {
      str = `'${str}`;
    }
    // RFC 4180 requires quoting for a field containing a comma, a double
    // quote, OR a line break — a bare \r (not just \n) also needs quoting,
    // otherwise some parsers treat it as a row separator on its own.
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
