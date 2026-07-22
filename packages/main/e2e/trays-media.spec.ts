import { expect, test, type Page } from "@playwright/test";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function reset(page: Page) {
  await page.goto("/holes/DDH041/current");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

async function uploadTrayPhoto(page: Page, name = "tray.png") {
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await expect(page.getByAltText(/Preview of selected/i)).toBeVisible();
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

test.beforeEach(async ({ page }) => {
  await reset(page);
});

test("photographs the suggested next tray and persists image metadata", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/trays/new");
  await expect(page.getByRole("textbox", { name: "Tray number" })).toHaveValue("112");
  await expect(page.getByRole("textbox", { name: "Start depth" })).toHaveValue("661.6");
  await expect(page.getByRole("textbox", { name: "End depth" })).toHaveValue("698.4");
  await uploadTrayPhoto(page);
  await page.getByRole("button", { name: "SAVE TRAY" }).click();
  await expect(page.getByText("Tray photograph verified and saved locally.")).toBeVisible();
  const trayCard = page.locator("article").filter({ hasText: "Current tray" });
  await expect(trayCard).toContainText("112");

  await page.getByRole("link", { name: "View library" }).click();
  const trayLink = page.getByRole("link", { name: /Tray 112/ });
  await expect(trayLink).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: /Tray 112/ })).toBeVisible();
  await expect(page.getByAltText(/Completed core tray 112/)).toBeVisible();
});

test("searches the tray library, opens detail and navigates adjacent trays", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/trays");
  await page.getByRole("searchbox", { name: "Search tray number or depth" }).fill("110");
  await page.getByRole("link", { name: /Tray 110/ }).click();
  await expect(page.getByRole("heading", { name: "Tray 110" })).toBeVisible();
  await expect(page.getByAltText(/Completed core tray 110/)).toBeVisible();
  await expect(page.getByText(/Run|No completed run overlap/).first()).toBeVisible();
  await page.getByRole("link", { name: "Tray 109" }).click();
  await expect(page.getByRole("heading", { name: "Tray 109" })).toBeVisible();
  await page.getByRole("link", { name: "Tray 110" }).click();
  await expect(page.getByRole("heading", { name: "Tray 110" })).toBeVisible();
});

test("replaces a tray photograph only after safe media storage", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/trays/tray-ddh041-110");
  await expect(page.getByAltText("Completed core tray 110")).toBeVisible();
  await page.getByRole("link", { name: "Replace photograph" }).click();
  await expect(page.getByRole("heading", { name: /Replace tray 110 photograph/ })).toBeVisible();
  await expect(page.getByAltText(/Current photograph for completed core tray 110/)).toBeVisible();
  await uploadTrayPhoto(page, "replacement.png");
  await page
    .getByRole("textbox", { name: "Replacement reason" })
    .fill("First photograph was blurred");
  await page.getByRole("button", { name: "REPLACE PHOTOGRAPH" }).click();
  await expect(page.getByRole("heading", { name: "Tray 110" })).toBeVisible();
  await expect(page.getByText("First photograph was blurred")).toBeVisible();
  await page.reload();
  await expect(page.getByAltText(/Replacement photograph for completed core tray 110/)).toBeVisible();
});

test("shows a crossing run without metre allocation", async ({ page }) => {
  await page.goto("/holes/DDH041/trays/tray-ddh041-111");
  await expect(page.getByRole("heading", { name: "Tray 111" })).toBeVisible();
  const overlap = page.getByRole("region", { name: "Run overlap" });
  await expect(overlap).toContainText("Run");
  await expect(overlap).toContainText("No recovered metres are allocated");
  await expect(overlap).not.toContainText(/allocated \d/);
});

test("Stage 4 screens fit approved widths in light and dark modes", async ({
  page,
}) => {
  test.setTimeout(360_000);
  const widths = [360, 390, 430, 768, 1024] as const;
  const routes = [
    "/holes/DDH041/current",
    "/holes/DDH041/surveys",
    "/holes/DDH041/surveys/new",
    "/holes/DDH041/surveys/survey-ddh041-425",
    "/holes/DDH041/surveys/survey-ddh041-425/correct",
    "/holes/DDH041/surveys/tools",
    "/holes/DDH041/trays",
    "/holes/DDH041/trays/new",
    "/holes/DDH041/trays/tray-ddh041-110",
    "/holes/DDH041/trays/tray-ddh041-110/correct",
    "/holes/DDH041/trays/tray-ddh041-110/replace-photo",
  ] as const;
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 700 ? 900 : 1024 });
      for (const route of routes) {
        const response = await page.goto(route);
        expect(response?.ok(), `${route} should load`).toBe(true);
        await expect(page.locator("main")).toBeVisible();
        await expectNoHorizontalOverflow(page, `${route} at ${width}px ${colorScheme}`);
      }
    }
  }
});
