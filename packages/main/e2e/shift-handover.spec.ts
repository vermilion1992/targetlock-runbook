import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/holes/DDH041/current");
  await page.evaluate(() => {
    const key = "targetlock:prototype:v1:operator-session";
    const session = window.localStorage.getItem(key);
    window.localStorage.clear();
    if (session) window.localStorage.setItem(key, session);
  });
  await page.reload();
});

test("continues one unfinished run across Day and Night Shift", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/current");
  await expect(page.getByRole("heading", { name: "No active shift" })).toBeVisible();

  await page.getByRole("link", { name: "Start shift" }).click();
  await expect(page).toHaveURL(/\/shifts\/start$/);
  await page.getByRole("combobox", { name: "Shift" }).selectOption("DAY");
  await page.getByRole("combobox", { name: "Primary driller" }).selectOption({
    label: "M. Hoffman",
  });
  await page.getByRole("button", { name: "Start shift" }).click();
  await expect(
    page.getByText("Runbook shift started successfully."),
  ).toBeVisible();

  await page.getByRole("link", { name: "RECORD NEXT RUN" }).click();
  await expect(page.getByRole("heading", { name: "Record run 246" })).toBeVisible();
  await page.getByRole("button", { name: "Add 3.0 m" }).click();
  await page.getByRole("textbox", { name: "Measured stick-up" }).fill("0.1");
  await page.getByRole("textbox", { name: "Core recovered" }).fill("3.0");
  await page.getByRole("button", { name: "Complete run" }).click();
  await expect(page).toHaveURL(/\/runs\/local-run-/);
  await expect(page.getByRole("heading", { name: "Run 246" })).toBeVisible();

  await page.goto("/holes/DDH041/current");
  await expect(page.getByRole("heading", { name: /CURRENT SHIFT|Active shift/i })).toBeVisible();
  await page.getByRole("link", { name: "RECORD NEXT RUN" }).click();
  await expect(page.getByRole("heading", { name: "Record run 247" })).toBeVisible();
  await expect(page.getByText(/Draft saved locally/)).toBeVisible();

  await page.getByRole("link", { name: "Back to Overview" }).click();
  await expect(page.getByRole("heading", { name: /CURRENT SHIFT|Active shift/i })).toBeVisible();
  await page.getByRole("link", { name: "Close shift" }).click();
  await expect(page.getByText("Run 247 is in progress")).toBeVisible();
  await page.getByRole("textbox", { name: "Handover note" }).fill(
    "Core slightly broken near the end of the last run.",
  );
  await page.getByRole("button", { name: "End shift" }).click();

  await expect(
    page.getByRole("heading", { name: "DAY SHIFT HANDOVER" }),
  ).toBeVisible();
  await expect(page.getByText("Run in progress")).toBeVisible();
  await page.getByRole("combobox", { name: "Shift" }).selectOption("NIGHT");
  await page.getByRole("combobox", { name: "Incoming driller" }).selectOption({ label: "J. Smith" });
  await page.getByRole("button", { name: "Accept handover" }).click();
  await expect(
    page.getByText("Handover accepted. The incoming shift now owns new work."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /CURRENT SHIFT|Active shift/i })).toBeVisible();

  await page.getByRole("link", { name: "RECORD NEXT RUN" }).click();
  await expect(page.getByRole("heading", { name: "Record run 247" })).toBeVisible();
  await page.getByRole("textbox", { name: "Measured stick-up" }).fill("0.0");
  await page.getByRole("textbox", { name: "Core recovered" }).fill("0.1");
  await page.getByRole("button", { name: "Complete run" }).click();
  await expect(page).toHaveURL(/\/runs\/local-run-/);

  await expect(page.getByText("Shared between shifts")).toBeVisible();
  await expect(page.getByText(/Day Shift — M\. Hoffman/)).toBeVisible();
  await expect(page.getByText(/Night Shift — J\. Smith/)).toBeVisible();

  await page.goto("/holes/DDH041/runbook");
  await expect(page.getByRole("link", { name: "247", exact: true })).toBeVisible();
  await expect(page.getByText("Shared", { exact: true }).last()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "247", exact: true })).toBeVisible();
  await expect(page.getByText("Shared", { exact: true }).last()).toBeVisible();
});

test("major Stage 2 screens fit the approved widths in light and dark modes", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const widths = [360, 390, 430, 768, 1024] as const;
  const routes = [
    "/holes/DDH041/current",
    "/holes/DDH041/shifts/start",
    "/holes/DDH041/shifts",
    "/holes/DDH041/runbook",
    "/holes/DDH041/timeline",
    "/holes/DDH041/handover",
  ] as const;

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 700 ? 900 : 1024 });
      for (const route of routes) {
        const response = await page.goto(route);
        expect(response?.ok(), `${route} should return a successful response`).toBe(true);
        await expect(page.getByText("This hole view could not load")).toHaveCount(0);
        await expect(page.locator("main")).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
    }
  }
});
