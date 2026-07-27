import { expect, test, type Page } from "@playwright/test";

const HOLE = "DDH041";
const morePath = `/holes/${HOLE}/more`;

const moreTools: ReadonlyArray<{
  id: string;
  path: string;
  parentPath: string;
}> = [
  {
    id: "timeline",
    path: `/holes/${HOLE}/timeline`,
    parentPath: morePath,
  },
  {
    id: "survey-settings",
    path: `/holes/${HOLE}/survey-settings`,
    parentPath: morePath,
  },
  { id: "casing", path: `/holes/${HOLE}/casing`, parentPath: morePath },
  {
    id: "components",
    path: `/holes/${HOLE}/components`,
    parentPath: morePath,
  },
  { id: "surveys", path: `/holes/${HOLE}/surveys`, parentPath: morePath },
  {
    id: "statistics",
    path: `/holes/${HOLE}/statistics`,
    parentPath: morePath,
  },
  { id: "reports", path: `/holes/${HOLE}/reports`, parentPath: morePath },
  {
    id: "report-history",
    path: `/holes/${HOLE}/reports/history`,
    parentPath: `/holes/${HOLE}/reports`,
  },
  { id: "shifts", path: `/holes/${HOLE}/shifts`, parentPath: morePath },
];

async function resetBrowserState(page: Page) {
  await page.goto(`/holes/${HOLE}/current`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    const sessionKey = "targetlock:prototype:v1:operator-session";
    const operatorSession = window.localStorage.getItem(sessionKey);
    window.localStorage.clear();
    if (operatorSession) {
      window.localStorage.setItem(sessionKey, operatorSession);
    }
    if ("indexedDB" in window && typeof indexedDB.databases === "function") {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases
          .map((database) => database.name)
          .filter((name): name is string => typeof name === "string")
          .map(
            (name) =>
              new Promise<void>((resolve, reject) => {
                const request = indexedDB.deleteDatabase(name);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
                request.onblocked = () => resolve();
              }),
          ),
      );
    }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function waitForSurveySettingsReady(page: Page) {
  await expect(page.getByTestId("survey-settings-form")).toHaveAttribute(
    "data-ready",
    "true",
  );
}

test.beforeEach(async ({ page }) => {
  await resetBrowserState(page);
});

test("More tools return to the same hole More page", async ({ page }) => {
  for (const tool of moreTools) {
    await page.goto(morePath, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /More runbook tools/i }),
    ).toBeVisible();
    await page.locator(`#${tool.id}`).click();
    await expect(page).toHaveURL(new RegExp(tool.path.replace(/\//g, "\\/")));
    const back = page.getByTestId("runbook-page-back");
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("aria-label", /Back to /i);
    if (tool.id === "survey-settings") {
      await waitForSurveySettingsReady(page);
    }
    const box = await back.boundingBox();
    expect(box, `${tool.id} back target size`).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(48);
    expect(box!.width).toBeGreaterThanOrEqual(48);
    await back.click();
    await expect(page).toHaveURL(tool.parentPath);
  }
});

test("direct secondary URL uses canonical More fallback", async ({ page }) => {
  await page.goto(`/holes/${HOLE}/timeline`, {
    waitUntil: "domcontentloaded",
  });
  const back = page.getByTestId("runbook-page-back");
  await expect(back).toHaveAttribute("aria-label", "Back to More");
  await back.click();
  await expect(page).toHaveURL(morePath);
});

test("Survey Settings returnTo from Trajectory vs More", async ({ page }) => {
  await page.goto(`/holes/${HOLE}/trajectory`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("trajectory-dashboard")).toBeVisible();
  await page.getByRole("link", { name: /Survey Settings/i }).first().click();
  await waitForSurveySettingsReady(page);
  await expect(page).toHaveURL(/survey-settings/);
  await expect(page).toHaveURL(/returnTo=/);
  const backFromTrajectory = page.getByTestId("runbook-page-back");
  await expect(backFromTrajectory).toHaveAttribute(
    "aria-label",
    "Back to Trajectory",
  );
  await backFromTrajectory.click();
  await expect(page).toHaveURL(`/holes/${HOLE}/trajectory`);

  await page.goto(morePath, { waitUntil: "domcontentloaded" });
  await page.locator("#survey-settings").click();
  await waitForSurveySettingsReady(page);
  await expect(page).toHaveURL(
    new RegExp(`/holes/${HOLE}/survey-settings(?!.*returnTo)`),
  );
  const backFromMore = page.getByTestId("runbook-page-back");
  await expect(backFromMore).toHaveAttribute("aria-label", "Back to More");
  await backFromMore.click();
  await expect(page).toHaveURL(morePath);
});

test("dirty Survey Settings shows discard confirmation", async ({ page }) => {
  await page.goto(`/holes/${HOLE}/survey-settings`, {
    waitUntil: "domcontentloaded",
  });
  await waitForSurveySettingsReady(page);
  await page.getByTestId("survey-interval-input").fill("45.0");
  await page.getByTestId("runbook-page-back").click();
  await expect(page.getByTestId("discard-leave-dialog")).toBeVisible();
  await page.getByTestId("discard-keep-editing").click();
  await expect(page).toHaveURL(/survey-settings/);
  await page.getByTestId("runbook-page-back").click();
  await page.getByTestId("discard-and-leave").click();
  await expect(page).toHaveURL(morePath);
});

test("responsive back control at approved widths", async ({ page }) => {
  const widths = [360, 390, 430, 768, 1024] as const;
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/holes/${HOLE}/timeline`, {
      waitUntil: "domcontentloaded",
    });
    const back = page.getByTestId("runbook-page-back");
    await expect(back).toBeVisible();
    const box = await back.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    );
    expect(overflow, `${width}px no horizontal overflow`).toBe(true);
  }
});

test("primary More page has no in-page back control", async ({ page }) => {
  await page.goto(morePath, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("runbook-page-back")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /Hole planning/i }),
  ).toBeVisible();
});
