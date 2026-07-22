/**
 * Protect spreadsheet consumers from formula injection when exporting
 * untrusted user text into Excel or CSV cells.
 */
export function escapeSpreadsheetFormula(value: string): string {
  if (value.length === 0) {
    return value;
  }
  const first = value[0];
  if (first === "=" || first === "+" || first === "-" || first === "@") {
    return `'${value}`;
  }
  return value;
}

export function escapeSpreadsheetCell(value: unknown): string | number | boolean {
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return escapeSpreadsheetFormula(String(value));
}

export function csvQuote(value: unknown): string {
  const escaped = String(escapeSpreadsheetCell(value));
  if (/[",\n\r]/.test(escaped)) {
    return `"${escaped.replace(/"/g, '""')}"`;
  }
  return escaped;
}

export function buildCsvDocument(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines = [
    headers.map(csvQuote).join(","),
    ...rows.map((row) => row.map(csvQuote).join(",")),
  ];
  // UTF-8 BOM helps Excel recognise encoding.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
