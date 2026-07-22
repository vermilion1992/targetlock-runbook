import { describe, expect, it } from "vitest";

import {
  buildCsvDocument,
  escapeSpreadsheetFormula,
} from "./formula-escape";

describe("escapeSpreadsheetFormula", () => {
  it("prefixes formula-like values", () => {
    expect(escapeSpreadsheetFormula("=1+1")).toBe("'=1+1");
    expect(escapeSpreadsheetFormula("+cmd")).toBe("'+cmd");
    expect(escapeSpreadsheetFormula("-2")).toBe("'-2");
    expect(escapeSpreadsheetFormula("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("leaves safe text unchanged", () => {
    expect(escapeSpreadsheetFormula("Normal note")).toBe("Normal note");
  });
});

describe("buildCsvDocument", () => {
  it("emits UTF-8 BOM, quoting and escaped formulas", () => {
    const csv = buildCsvDocument(
      ["end_depth_m", "comment"],
      [
        [661.5, "=HYPERLINK(\"http://evil\")"],
        [12.3, "ok, quoted"],
      ],
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"ok, quoted"');
  });
});
