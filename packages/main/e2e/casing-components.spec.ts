import { expect, test, type Page } from "@playwright/test";

async function reset(page: Page) {
  await page.goto("/holes/DDH041/current");
  await page.evaluate(() => {
    const key = "targetlock:prototype:v1:operator-session";
    const session = window.localStorage.getItem(key);
    window.localStorage.clear();
    if (session) window.localStorage.setItem(key, session);
  });
  await page.reload();
}

async function startDayShift(page: Page) {
  await page.goto("/holes/DDH041/shifts/start");
  await page.getByRole("combobox", { name: "Shift" }).selectOption("DAY");
  await page
    .getByRole("combobox", { name: "Primary driller" })
    .selectOption({ label: "M. Hoffman" });
  await page.getByRole("button", { name: "Start shift" }).click();
  await expect(
    page.getByText("Runbook shift started successfully."),
  ).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, context: string) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
      { message: `${context} should not overflow horizontally` },
    )
    .toBe(true);
}

async function selectOptionMatching(
  page: Page,
  comboboxName: string,
  optionName: RegExp,
) {
  const combobox = page.getByRole("combobox", { name: comboboxName });
  const value = await combobox
    .getByRole("option", { name: optionName })
    .getAttribute("value");
  if (!value) throw new Error(`Option ${String(optionName)} has no value.`);
  await combobox.selectOption(value);
}

test.beforeEach(async ({ page }) => {
  await reset(page);
});

test("advances casing and retains immutable history after refresh", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/casing");
  await expect(page.getByRole("heading", { name: "DDH041 casing" })).toBeVisible();
  await page.getByRole("button", { name: "PQ", exact: true }).click();
  await page.getByRole("textbox", { name: "Casing depth" }).fill("19.0");
  await page.getByRole("button", { name: "Add casing" }).click();
  await expect(page.getByText("PQ casing updated.")).toBeVisible();
  await expect(page.getByText("19.0 m", { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("19.0 m", { exact: true }).first()).toBeVisible();

  await page.goto("/holes/DDH041/casing/casing-pq-ddh041");
  const advanceEvent = page.locator("li").filter({ hasText: "Advance" }).first();
  await expect(advanceEvent).toContainText("18.0 m");
  await expect(advanceEvent).toContainText("19.0 m");

  await page.goto("/holes/DDH041/current");
  const casingCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Casing", exact: true }),
  });
  await expect(casingCard).toContainText("PQ");
  await expect(casingCard).toContainText("19.0 m");
  await page.goto("/holes/DDH041/timeline");
  const localCasingTimelineEntry = page.locator("li").filter({
    hasText: "18.0 m → 19.0 m",
  });
  await expect(
    localCasingTimelineEntry.getByRole("link", { name: /casing advanced/i }),
  ).toBeVisible();
});

test("changes bit and reamer at exact depth with persistent timeline records", async ({
  page,
}) => {
  await startDayShift(page);

  await page.goto("/holes/DDH041/components/bit/change");
  await expect(page.getByRole("heading", { name: "Change Bit" })).toBeVisible();
  await selectOptionMatching(page, "Incoming component", /BIT-HQ-003007/);
  await page.getByRole("button", { name: "Save Bit change" }).click();
  await expect(page.getByText("Bit change saved at the recorded depth.")).toBeVisible();
  await expect(page.getByText("BIT-HQ-003007", { exact: true }).first()).toBeVisible();
  const assignmentHistory = page.getByLabel("Assignment history");
  await expect(
    assignmentHistory.getByRole("row").filter({ hasText: "BIT-HQ-002193" }),
  ).toContainText("412.6 m – 698.4 m");
  await expect(
    assignmentHistory.getByRole("row").filter({ hasText: "BIT-HQ-003007" }),
  ).toContainText("698.4 m – active");

  await page.goto("/holes/DDH041/components/reamer/change");
  await expect(page.getByRole("heading", { name: "Change Reamer" })).toBeVisible();
  await selectOptionMatching(page, "Incoming component", /REA-HQ-001104/);
  await page.getByRole("button", { name: "Save Reamer change" }).click();
  await expect(
    page.getByText("Reamer change saved at the recorded depth."),
  ).toBeVisible();
  await expect(page.getByText("REA-HQ-001104", { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("REA-HQ-001104", { exact: true }).first()).toBeVisible();
  await page.goto("/holes/DDH041/components");
  const bitCard = page.locator("article").filter({
    has: page.getByText("Inventory Bit", { exact: true }),
  });
  const reamerCard = page.locator("article").filter({
    has: page.getByText("Inventory Reamer", { exact: true }),
  });
  await expect(bitCard).toContainText("BIT-HQ-003007");
  await expect(reamerCard).toContainText("REA-HQ-001104");
  await page.goto("/holes/DDH041/current");
  await expect(page.getByTestId("bha-overview-card")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Update BHA", exact: true }),
  ).toBeVisible();
  await page.goto("/holes/DDH041/timeline");
  await expect(
    page
      .locator("li")
      .filter({ hasText: "BIT-HQ-002193 → BIT-HQ-003007" })
      .getByRole("link", { name: "Bit changed" }),
  ).toBeVisible();
  await expect(
    page
      .locator("li")
      .filter({ hasText: "REA-HQ-000912 → REA-HQ-001104" })
      .getByRole("link", { name: "Reamer changed" }),
  ).toBeVisible();
});

test("blocks a component already active in another hole", async ({ page }) => {
  await startDayShift(page);
  await page.goto("/holes/DDH041/components/bit/change");
  await selectOptionMatching(
    page,
    "Incoming component",
    /BIT-HQ-003008.*Active/,
  );
  await page.getByRole("button", { name: "Save Bit change" }).click();
  await expect(
    page.getByRole("alert").filter({
      hasText: "Duplicate active component prevented",
    }),
  ).toBeVisible();
  await page.goto("/holes/DDH041/components");
  await expect(page.getByText("BIT-HQ-002193", { exact: true }).first()).toBeVisible();
});

test("retains before and after bit ownership in completed runs", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await startDayShift(page);

  await page.getByRole("link", { name: "RECORD NEXT RUN" }).click();
  await page.getByRole("button", { name: "Add 3.0 m" }).click();
  await page.getByRole("textbox", { name: "Measured stick-up" }).fill("0.1");
  await page.getByRole("textbox", { name: "Core recovered" }).fill("3.0");
  await page.getByRole("button", { name: "Complete run" }).click();
  await expect(page.getByText("BIT-HQ-002193", { exact: true })).toBeVisible();

  await page.goto("/holes/DDH041/components/bit/change");
  await selectOptionMatching(page, "Incoming component", /BIT-HQ-003007/);
  await page.getByRole("button", { name: "Save Bit change" }).click();

  await page.goto("/holes/DDH041/current");
  await page.getByRole("link", { name: "RECORD NEXT RUN" }).click();
  await page.getByRole("textbox", { name: "Measured stick-up" }).fill("0.0");
  await page.getByRole("textbox", { name: "Core recovered" }).fill("0.1");
  await page.getByRole("button", { name: "Complete run" }).click();
  await expect(page.getByText("BIT-HQ-003007", { exact: true })).toBeVisible();

  await page.goto("/holes/DDH041/runbook");
  await page.getByRole("link", { name: "246", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Run 246" })).toBeVisible();
  await expect(page.getByText("BIT-HQ-002193", { exact: true }).first()).toBeVisible();
  await page.goto("/holes/DDH041/runbook");
  await page.getByRole("link", { name: "247", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Run 247" })).toBeVisible();
  await expect(page.getByText("BIT-HQ-003007", { exact: true }).first()).toBeVisible();
});

test("saves a confirmed within-run bit change and keeps immutable run disclosure", async ({
  page,
}) => {
  await startDayShift(page);
  await page.goto("/holes/DDH041/components/bit/change");
  await selectOptionMatching(page, "Incoming component", /BIT-HQ-003007/);
  const changeDepth = page.getByRole("textbox", { name: "Exact change depth" });
  await expect(changeDepth).toHaveValue("698.4");
  await changeDepth.fill("697.0");
  await expect(page.getByText("Change depth is inside a completed run")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Removal comment" })
    .fill("Wear confirmed during Run 245.");
  await page
    .getByRole("checkbox", {
      name: "Confirm this change occurred within the run",
    })
    .check();
  await page.getByRole("button", { name: "Save Bit change" }).click();
  await expect(page.getByText("Bit change saved at the recorded depth.")).toBeVisible();

  await page.goto("/holes/DDH041/runs/run-ddh041-245");
  await expect(page.getByRole("heading", { name: "Run 245" })).toBeVisible();
  const changeRecord = page.locator("article").filter({
    hasText: "Bit changed at 697.0 m during this run",
  });
  await expect(changeRecord).toContainText("Outgoing BIT-HQ-002193");
  await expect(changeRecord).toContainText("Incoming BIT-HQ-003007");
  await expect(changeRecord).toContainText("Removal reason worn");
  await expect(changeRecord).toContainText("Run interval 695.4 m – 698.4 m");
  await expect(page.getByText("PQ to 18.0 m; HQ to 42.0 m")).toBeVisible();
  await page.reload();
  await expect(changeRecord).toContainText("Bit changed at 697.0 m");
});

test("opens the organisation component registry and assignment detail", async ({
  page,
}) => {
  await page.goto("/components?holeId=DDH041");
  await expect(
    page.getByRole("heading", { name: "Component Registry" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /BIT-HQ-002193/ }).click();
  await expect(page).toHaveURL(
    "/components/component-bit-002193?holeId=DDH041",
  );
  await expect(
    page.getByRole("heading", { name: "BIT-HQ-002193" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Assignment history" }),
  ).toBeVisible();
});

test("rejects reserved hole subpaths and routes the bare index safely", async ({
  page,
}) => {
  await page.goto("/holes/completed/current");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();

  await page.goto("/holes");
  await expect(page).toHaveURL("/projects");
});

test("Stage 3 routes fit approved widths and expose focus-managed warnings", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const widths = [360, 390, 430, 768, 1024] as const;
  const routes = [
    "/holes/DDH041/casing",
    "/holes/DDH041/casing/new",
    "/holes/DDH041/casing/casing-pq-ddh041",
    "/holes/DDH041/casing/casing-pq-ddh041/advance",
    "/holes/DDH041/casing/casing-pq-ddh041/correct",
    "/holes/DDH041/components",
    "/holes/DDH041/components/bit/assign",
    "/holes/DDH041/components/reamer/assign",
    "/holes/DDH041/components/bit/change",
    "/holes/DDH041/components/reamer/change",
    "/holes/DDH041/current",
    "/holes/DDH041/runbook",
    "/holes/DDH041/runs/run-ddh041-245",
    "/components",
    "/components/new",
    "/components/component-bit-002193",
  ] as const;

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 700 ? 900 : 1024 });
      for (const route of routes) {
        const response = await page.goto(route);
        expect(response?.ok(), `${route} should load`).toBe(true);
        await expect(page.locator("main")).toBeVisible();
        await expectNoHorizontalOverflow(
          page,
          `${route} at ${width}px in ${colorScheme} mode`,
        );
      }
    }
  }

  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/components/new");
  await expect(page.getByRole("combobox", { name: "Type" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Serial number" })).toBeVisible();
  const addComponentButton = page.getByRole("button", { name: "Save component" });
  const addComponentBox = await addComponentButton.boundingBox();
  expect(addComponentBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await page.goto("/holes/DDH041/casing/new");
  await page.getByRole("textbox", { name: "End depth" }).fill("700.0");
  await expect(page.getByText(/deeper than the current completed hole depth/i)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.textContent))
    .toContain("deeper than the current completed hole depth");

  await startDayShift(page);
  await page.goto("/holes/DDH041/components/bit/change");
  const changeDepth = page.getByRole("textbox", { name: "Exact change depth" });
  await expect(changeDepth).toHaveValue("698.4");
  await changeDepth.fill("697.0");
  await expect(page.getByText("Change depth is inside a completed run")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.textContent))
    .toContain("Change depth is inside a completed run");
  const saveButton = page.getByRole("button", { name: "Save Bit change" });
  const box = await saveButton.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});
