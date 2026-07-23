import { describe, expect, it } from "vitest";

import {
  evaluateReportCurrency,
  fingerprintSourceVersions,
} from "./report-currency";

describe("report currency", () => {
  it("fingerprints relevant source versions stably", () => {
    const fingerprint = fingerprintSourceVersions([
      { entityType: "run", entityId: "run-2", version: 2 },
      { entityType: "run", entityId: "run-1", version: 1 },
      { entityType: "ui_preference", entityId: "theme", version: 9 },
    ]);
    expect(fingerprint).toBe("run:run-1:1|run:run-2:2");
  });

  it("marks reports current when fingerprints match", () => {
    const versions = [
      { entityType: "hole", entityId: "DDH041", version: 1 },
      { entityType: "run", entityId: "run-1", version: 3 },
    ];
    const result = evaluateReportCurrency(versions, versions);
    expect(result.status).toBe("current");
    expect(result.changesDetected).toEqual([]);
  });

  it("detects out-of-date operational changes", () => {
    const generated = [
      { entityType: "run", entityId: "run-1", version: 1 },
      { entityType: "survey", entityId: "survey-1", version: 1 },
    ];
    const current = [
      { entityType: "run", entityId: "run-1", version: 2 },
      { entityType: "survey", entityId: "survey-1", version: 1 },
      { entityType: "tray", entityId: "tray-1", version: 1 },
    ];
    const result = evaluateReportCurrency(generated, current);
    expect(result.status).toBe("out_of_date");
    expect(result.changesDetected).toEqual(
      expect.arrayContaining(["Runs changed", "Trays added"]),
    );
  });

  it("ignores unrelated preference entities", () => {
    const generated = [{ entityType: "run", entityId: "run-1", version: 1 }];
    const current = [
      { entityType: "run", entityId: "run-1", version: 1 },
      { entityType: "ui_preference", entityId: "density", version: 4 },
    ];
    expect(evaluateReportCurrency(generated, current).status).toBe("current");
  });
});
