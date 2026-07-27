import { expect, test, type Page } from "@playwright/test";

async function installReportFailureHook(page: Page) {
  await page.addInitScript(() => {
    const proto = IDBObjectStore.prototype;
    const originalPut = proto.put;
    proto.put = function patchedPut(
      this: IDBObjectStore,
      ...args: Parameters<typeof originalPut>
    ) {
      if (
        sessionStorage.getItem("tl-fail-report-put") === "1" &&
        this.name === "report-files"
      ) {
        sessionStorage.removeItem("tl-fail-report-put");
        const request = {
          result: undefined,
          error: new DOMException("QuotaExceededError", "QuotaExceededError"),
          onsuccess: null as ((ev: Event) => void) | null,
          onerror: null as ((ev: Event) => void) | null,
          readyState: "pending",
          addEventListener() {
            return undefined;
          },
          removeEventListener() {
            return undefined;
          },
          dispatchEvent() {
            return false;
          },
        } as unknown as IDBRequest;
        queueMicrotask(() => {
          request.onerror?.(new Event("error"));
        });
        return request;
      }
      return originalPut.apply(this, args);
    };
  });
}

async function reset(page: Page) {
  await page.goto("/holes/DDH041/current");
  await page.evaluate(async () => {
    const sessionKey = "targetlock:prototype:v1:operator-session";
    const operatorSession = window.localStorage.getItem(sessionKey);
    window.localStorage.clear();
    if (operatorSession) {
      window.localStorage.setItem(sessionKey, operatorSession);
    }
    window.sessionStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("targetlock-runbook-reports-v1");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
  await expect(page.getByText("DDH041").first()).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, context: string) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1,
        ),
      { message: `${context} should not overflow horizontally` },
    )
    .toBe(true);
}

async function openReports(page: Page, holeId = "DDH041") {
  await page.goto(`/holes/${holeId}/reports`);
  await expect(
    page.getByRole("heading", { name: "Reports", exact: true }),
  ).toBeVisible();
}

async function selectOnlyFormat(page: Page, format: "PDF" | "XLSX" | "CSV") {
  for (const candidate of ["PDF", "XLSX", "CSV"] as const) {
    const checkbox = page.getByRole("checkbox", { name: candidate });
    const checked = await checkbox.isChecked();
    if ((candidate === format) !== checked) {
      await checkbox.click();
    }
  }
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await installReportFailureHook(page);
  await reset(page);
});

test("1. Hole Summary PDF generate, progress, success, open, download, activity", async ({
  page,
}) => {
  await openReports(page);
  await expect(
    page.getByText(/Reports are stored on this device/i),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Hole Summary" }).check();
  await selectOnlyFormat(page, "PDF");

  const generateButton = page.getByRole("button", { name: "Generate report" });
  await generateButton.click();
  // Fast machines may complete before progress UI is asserted; accept either.
  await expect(
    page
      .getByText(/Generating report/i)
      .or(page.getByText(/Report generated/i))
      .first(),
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/Report generated/i)).toBeVisible({
    timeout: 45_000,
  });
  await expect(
    page.getByText(/DDH041_Hole_Summary_v001_.*\.pdf/i).first(),
  ).toBeVisible();
  await expect(page.getByText(/PDF \/ Version 1 \//i)).toBeVisible();
  await expect(page.getByText(/\d+(\.\d+)?\s?(B|KB|MB)/i).first()).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download PDF/i }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /DDH041_Hole_Summary_v001_.*\.pdf$/i,
  );
  const path = await download.path();
  expect(path).toBeTruthy();
  await expect(page.getByText(/Download started:/i)).toBeVisible();

  await page.getByRole("button", { name: /Open PDF/i }).first().click();
  await expect(
    page.getByText(/Opened |Popup blocked/i).first(),
  ).toBeVisible({ timeout: 15_000 });

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/holes/DDH041/reports/history");
  await expect(page.getByRole("heading", { name: "Report Activity" })).toBeVisible();
  await expect(
    page.locator("table").getByRole("cell", { name: /Hole Summary/i }),
  ).toBeVisible();
  await expect(
    page.locator("table").getByText(/Hole_Summary_v001_/i),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.locator("table").getByText(/Hole_Summary_v001_/i),
  ).toBeVisible();
});

test("2. Full-Hole PDF versioning keeps v1 when v2 is generated", async ({
  page,
}) => {
  await openReports(page);
  await page.getByRole("radio", { name: "Full-Hole Runbook" }).check();
  await selectOnlyFormat(page, "PDF");

  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText(/Report generated/i)).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText(/Full_Runbook_v001_/i).first()).toBeVisible();

  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText(/Full-Hole Runbook PDF Version 2/i)).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText(/Full_Runbook_v002_/i).first()).toBeVisible();
  await expect(page.getByText(/Full_Runbook_v001_/i).first()).toBeVisible();
});

test("3. Excel generate, download, activity, refresh", async ({ page }) => {
  await openReports(page);
  await page.getByRole("radio", { name: "Full-Hole Runbook" }).check();
  await selectOnlyFormat(page, "XLSX");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText(/Report generated/i)).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText(/DDH041_Runbook_v001_.*\.xlsx/i).first()).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: /Download (Excel|XLSX)/i })
    .first()
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/holes/DDH041/reports/history");
  await expect(
    page.locator("table").getByRole("cell", { name: /Full-Hole Runbook/i }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator("table").getByText(/Runbook_v001_/i),
  ).toBeVisible();
});

test("4. out-of-date after relevant change; updated version current; old historical", async ({
  page,
}) => {
  await openReports(page);
  await page.getByRole("radio", { name: "Hole Summary" }).check();
  await selectOnlyFormat(page, "PDF");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText(/Report generated/i)).toBeVisible({
    timeout: 45_000,
  });

  // Simulate a relevant Hole-record change by ageing the immutable snapshot fingerprint
  // (runs/surveys/etc. versions), then reloading Report Centre currency checks.
  const aged = await page.evaluate(() => {
    const key = Object.keys(window.localStorage).find((item) =>
      item.includes(":reports"),
    );
    if (!key) return false;
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const envelope = JSON.parse(raw) as {
      snapshots: Array<{
        sourceVersions: Array<{
          entityType: string;
          entityId: string;
          version: number;
        }>;
      }>;
    };
    const snapshot = envelope.snapshots[0];
    if (!snapshot) return false;
    snapshot.sourceVersions = snapshot.sourceVersions.map((item) =>
      item.entityType === "run" || item.entityType === "survey"
        ? { ...item, version: Math.max(0, item.version - 1) }
        : item,
    );
    window.localStorage.setItem(key, JSON.stringify(envelope));
    return true;
  });
  expect(aged).toBe(true);

  await openReports(page);
  await expect(page.getByText(/Report out of date/i).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByText(/Historical report \/ Generated before the latest Hole changes/i).first(),
  ).toBeVisible();

  await page
    .getByRole("button", { name: /Generate updated report/i })
    .first()
    .click();
  await expect(page.getByText(/Report generated/i)).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText(/Hole_Summary_v002_/i).first()).toBeVisible();
  await expect(page.getByText(/Hole_Summary_v001_/i).first()).toBeVisible();
  await expect(
    page.getByText(/Historical report \/ Generated before the latest Hole changes/i).first(),
  ).toBeVisible();
});

test("5. failure state is not marked generated and supports retry", async ({
  page,
}) => {
  await openReports(page);
  await page.getByRole("radio", { name: "Hole Summary" }).check();
  await selectOnlyFormat(page, "PDF");
  await page.evaluate(() => {
    sessionStorage.setItem("tl-fail-report-put", "1");
  });
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText(/Generation failed/i)).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText(/Report generated/i)).toHaveCount(0);
  await expect(page.getByText(/Failed generations|Not generated/i).first()).toBeVisible();

  await page.getByRole("button", { name: /^Retry$/i }).first().click();
  await expect(page.getByText(/Report generated/i)).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText(/Hole_Summary_v001_/i).first()).toBeVisible();
  await expect(page.getByText(/Hole_Summary_v002_/i)).toHaveCount(0);
});test("legacy share/email smoke remains available", async ({ page }) => {
  await openReports(page);
  await page.getByRole("radio", { name: "Survey History" }).check();
  await selectOnlyFormat(page, "PDF");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText(/Report generated/i)).toBeVisible({
    timeout: 45_000,
  });

  await page.getByRole("button", { name: /^Share(\s|$)/i }).first().click();
  await expect(
    page.getByText(
      /shared from this device|downloaded instead|Share cancelled|Not delivered by TargetLock/i,
    ),
  ).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /Prepare Email/i }).first().click();
  await expect(page.getByRole("heading", { name: "Prepare Email" })).toBeVisible();
  await page.getByRole("textbox", { name: "To" }).fill("supervisor@briggs.example");
  await page.getByRole("button", { name: "Share to email app" }).click();
  await expect(page.getByText(/Email draft prepared/i)).toBeVisible({
    timeout: 15_000,
  });
});

test("responsive Report Centre widths and themes", async ({ page }) => {
  await openReports(page);
  for (const width of [360, 390, 430, 768, 1024]) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: width < 700 ? 900 : 1024 });
      await expect(
        page.getByRole("heading", { name: "Reports", exact: true }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(
        page,
        `reports at ${width}px ${colorScheme}`,
      );
    }
  }
});
