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

async function fillSurvey(
  page: Page,
  values: { depth: string; dip: string; azimuth: string },
) {
  await page.getByRole("textbox", { name: "Survey depth" }).fill(values.depth);
  await page.getByRole("textbox", { name: "Dip" }).fill(values.dip);
  await page.getByRole("textbox", { name: "Azimuth" }).fill(values.azimuth);
}

test.beforeEach(async ({ page }) => {
  await reset(page);
});

test("lists surveys in one card ordered from shallow to deep", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/holes/DDH041/surveys");
  await expect(page.getByRole("heading", { name: "DDH041 surveys" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add survey" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage survey tools" })).toHaveCount(0);
  await expect(page.getByText("Distance since")).toHaveCount(0);
  await expect(page.getByText("Average spacing")).toHaveCount(0);
  await expect(page.getByLabel("Depth, tool or serial")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Survey records" })).toBeVisible();

  const depths = page
    .getByTestId("survey-records-table-mobile")
    .getByRole("row")
    .locator("th a");
  await expect(depths.first()).toBeVisible();
  const count = await depths.count();
  expect(count).toBeGreaterThan(1);
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const text = (await depths.nth(index).innerText()).replace(/[^\d.]/g, "");
    values.push(Number(text));
  }
  expect(values).toEqual([...values].sort((left, right) => left - right));
});

test("adds a survey with inherited settings and updates history and timeline", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/surveys/new");
  await expect(
    page.getByRole("combobox", { name: "Survey tool" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "North reference" }),
  ).toHaveCount(0);
  await expect(page.getByText("Survey settings", { exact: true })).toBeVisible();
  await expect(page.getByText("Grid North · EZ-TRAC", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: /Field note/i }),
  ).toHaveAttribute(
    "placeholder",
    "Example: Reading repeated after moving away from magnetic interference.",
  );
  await fillSurvey(page, { depth: "625.0", dip: "-72.2", azimuth: "140.5" });
  await page.getByRole("button", { name: "SAVE SURVEY" }).click();
  await expect(
    page.getByText("Survey saved locally. Dashboard, history and timeline are updated."),
  ).toBeVisible();

  await page.goto("/holes/DDH041/surveys");
  await expect(page.getByRole("heading", { name: "DDH041 surveys" })).toBeVisible();
  await expect(
    page
      .getByTestId("survey-records-table")
      .getByText("625.0 m", { exact: true }),
  ).toBeVisible();
  await page.goto("/holes/DDH041/timeline");
  await expect(
    page.locator("li").filter({ hasText: "625.0 m" }).getByRole("link", {
      name: "Survey recorded",
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator("li").filter({ hasText: "625.0 m" }).getByRole("link", {
      name: "Survey recorded",
    }),
  ).toBeVisible();
});

test("focuses a large-change warning and allows deliberate correction", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/surveys/new");
  await fillSurvey(page, { depth: "625.0", dip: "-72.2", azimuth: "220.0" });
  await page.getByRole("button", { name: "SAVE SURVEY" }).click();
  const warning = page.getByRole("alert").filter({ hasText: "Check survey entry" });
  await expect(warning).toBeVisible();
  await expect(warning).toBeFocused();
  await warning.getByRole("button", { name: "CHECK ENTRY" }).click();
  await page.getByRole("textbox", { name: "Azimuth" }).fill("140.5");
  await page.getByRole("button", { name: "SAVE SURVEY" }).click();
  await expect(
    page.getByText("Survey saved locally. Dashboard, history and timeline are updated."),
  ).toBeVisible();
});

test("handles duplicate-depth surveys without overwriting the existing record", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/surveys/new");
  await fillSurvey(page, { depth: "420.0", dip: "-68.3", azimuth: "136.4" });
  await page.getByRole("button", { name: "SAVE SURVEY" }).click();
  const warning = page.getByRole("alert").filter({ hasText: "already exists at this depth" });
  await expect(warning).toBeVisible();
  await warning.getByRole("link", { name: "VIEW EXISTING" }).click();
  await expect(page.getByRole("heading", { name: "DDH041 surveys" })).toBeVisible();
  await page.goto("/holes/DDH041/surveys/new");
  await fillSurvey(page, { depth: "420.0", dip: "-68.3", azimuth: "136.4" });
  await page.getByRole("button", { name: "SAVE SURVEY" }).click();
  await page.getByRole("button", { name: "SAVE ANYWAY" }).click();
  await page.goto("/holes/DDH041/surveys");
  await expect(
    page
      .getByTestId("survey-records-table")
      .getByText("420.0 m", { exact: true }),
  ).toHaveCount(2);
});
