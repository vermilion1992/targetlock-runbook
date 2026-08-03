import { expect, test, type Page } from "@playwright/test";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const tallTrayImage = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="4000" viewBox="0 0 2000 4000"><rect width="2000" height="4000" fill="#172433"/></svg>',
);

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

test("restores the phone viewport after closing the core camera", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/holes/DDH041/trays/new");
  const before = await page.evaluate(() => ({
    bodyStyle: document.body.getAttribute("style") ?? "",
    rootStyle: document.documentElement.getAttribute("style") ?? "",
    scrollWidth: document.documentElement.scrollWidth,
  }));

  await page.getByRole("button", { name: "TAKE CORE PHOTO" }).click();
  await expect(
    page.getByRole("dialog", { name: "Take core photo" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.body.dataset.tlCameraLock ?? null),
    )
    .toBe("1");
  await expect(page.getByTestId("tray-guide-aperture")).toHaveCount(0);
  const guide = page.getByTestId("tray-guide-frame");
  const startMarker = page.getByTestId("tray-start-marker");
  await expect(guide).toBeVisible();
  await expect(startMarker).toBeVisible();
  await expect(startMarker).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const guideBox = await guide.boundingBox();
  const markerBox = await startMarker.boundingBox();
  if (!guideBox || !markerBox) {
    throw new Error("Tray camera guide did not produce measurable bounds.");
  }
  expect(markerBox.x).toBeGreaterThan(guideBox.x + guideBox.width);
  expect(markerBox.height).toBeGreaterThan(markerBox.width);
  expect(guideBox.width / guideBox.height).toBeCloseTo(
    (1 / 2) * (0.85 / 1.15),
    2,
  );

  await page.getByRole("button", { name: "Close camera" }).click();
  await expect(
    page.getByRole("dialog", { name: "Take core photo" }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        bodyStyle: document.body.getAttribute("style") ?? "",
        rootStyle: document.documentElement.getAttribute("style") ?? "",
        lock: document.body.dataset.tlCameraLock ?? null,
      })),
    )
    .toEqual({
      bodyStyle: before.bodyStyle,
      rootStyle: before.rootStyle,
      lock: null,
    });
  await expectNoHorizontalOverflow(page, "tray form after camera");
  await expect(
    page.getByRole("textbox", { name: "Tray number" }),
  ).toBeInViewport();
  expect(before.scrollWidth).toBeLessThanOrEqual(390);
});

test("keeps a full-size tray preview within the phone viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto("/holes/DDH041/trays/new");
  await expectNoHorizontalOverflow(page, "tray form before photo preview");
  await expect(
    page.getByRole("textbox", { name: /Field note/i }),
  ).toHaveAttribute(
    "placeholder",
    "Example: Broken core near the tray end; metre marks are clearly visible.",
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "tray-2026-08-02T14-09-41-952Z.svg",
    mimeType: "image/svg+xml",
    buffer: tallTrayImage,
  });

  await expect(page.getByAltText(/Preview of selected/i)).toBeVisible();
  await expectNoHorizontalOverflow(page, "full-size tray photo preview");
  await expect(page.getByRole("button", { name: "Remove" })).toBeInViewport();
});

test("photographs the suggested next tray and persists image metadata", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/trays/new");
  await expect(page.getByRole("textbox", { name: "Tray number" })).toHaveValue("106");
  await expect(page.getByRole("textbox", { name: "Start depth" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "End depth" })).toHaveCount(0);
  await expect(page.getByText("Final partial tray")).toHaveCount(0);
  await uploadTrayPhoto(page);
  await page.getByRole("button", { name: "SAVE TRAY" }).click();
  await expect(page.getByText("Tray photograph verified and saved locally.")).toBeVisible();
  const trayCard = page.locator("article").filter({ hasText: "Current tray" });
  await expect(trayCard).toContainText("106");

  await page.goto("/holes/DDH041/trays");
  const trayLink = page.getByRole("link", { name: /Tray 106/ });
  await expect(trayLink).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: /Tray 106/ })).toBeVisible();
  await expect(page.getByAltText(/Completed core tray 106/)).toBeVisible();
});

test("searches the tray library, opens detail and navigates adjacent trays", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/trays");
  await page.getByRole("searchbox", { name: "Search tray number or depth" }).fill("104");
  await page.getByRole("link", { name: /Tray 104/ }).click();
  await expect(page.getByRole("heading", { name: "Tray 104" })).toBeVisible();
  await expect(page.getByAltText(/core tray 104/i)).toBeVisible();
  await expect(page.getByText("Recorded by")).toBeVisible();
  await expect(page.getByText("Date / time")).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit details" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Replace photograph" })).toBeVisible();
  await page.getByRole("link", { name: "Tray 103" }).click();
  await expect(page.getByRole("heading", { name: "Tray 103" })).toBeVisible();
  await page.getByRole("link", { name: "Tray 104" }).click();
  await expect(page.getByRole("heading", { name: "Tray 104" })).toBeVisible();
});

test("replaces a tray photograph only after safe media storage", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/trays/tray-ddh041-104");
  await expect(page.getByAltText(/core tray 104/i)).toBeVisible();
  await page.getByRole("link", { name: "Replace photograph" }).click();
  await expect(page.getByRole("heading", { name: /Replace tray 104 photograph/ })).toBeVisible();
  await expect(page.getByAltText(/Current photograph for completed core tray 104/)).toBeVisible();
  await uploadTrayPhoto(page, "replacement.png");
  await page
    .getByRole("textbox", { name: "Replacement reason" })
    .fill("First photograph was blurred");
  await page.getByRole("button", { name: "REPLACE PHOTOGRAPH" }).click();
  await expect(page.getByRole("heading", { name: "Tray 104" })).toBeVisible();
  await expect(page.getByText("First photograph was blurred")).toBeVisible();
  await page.reload();
  await expect(page.getByAltText(/Replacement photograph for completed core tray 104/)).toBeVisible();
});

test("shows tray photograph provenance without depth KPIs", async ({ page }) => {
  await page.goto("/holes/DDH041/trays/tray-ddh041-105");
  await expect(page.getByRole("heading", { name: "Tray 105" })).toBeVisible();
  await expect(page.getByText("Recorded by", { exact: true })).toBeVisible();
  await expect(page.getByText("Shift", { exact: true })).toBeVisible();
  await expect(page.getByText("Date / time", { exact: true })).toBeVisible();
  await expect(page.getByText("Depth range")).toHaveCount(0);
  await expect(page.getByText("Related runs")).toHaveCount(0);
  await expect(page.getByText("Final partial")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Run overlap" })).toHaveCount(0);
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
    "/holes/DDH041/trays/tray-ddh041-104",
    "/holes/DDH041/trays/tray-ddh041-104/correct",
    "/holes/DDH041/trays/tray-ddh041-104/replace-photo",
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
