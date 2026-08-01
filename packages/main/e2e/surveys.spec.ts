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

test("adds a survey and updates dashboard, history and timeline after refresh", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/surveys/new");
  await expect(
    page.getByRole("combobox", { name: "Survey tool" }),
  ).toHaveValue("survey-tool-reflex-01");
  await expect(
    page.getByRole("combobox", { name: "North reference" }),
  ).toHaveValue("GRID");
  await fillSurvey(page, { depth: "450.0", dip: "-62.4", azimuth: "130.1" });
  await page.getByRole("button", { name: "SAVE SURVEY" }).click();
  await expect(
    page.getByText("Survey saved locally. Dashboard, history and timeline are updated."),
  ).toBeVisible();
  const latest = page.locator("article").filter({ hasText: "Latest survey" });
  await expect(latest).toContainText("450.0 m");

  await page.goto("/holes/DDH041/surveys");
  await expect(page.getByRole("heading", { name: "DDH041 surveys" })).toBeVisible();
  await expect(page.getByText("450.0 m", { exact: true }).first()).toBeVisible();
  await page.goto("/holes/DDH041/timeline");
  await expect(
    page.locator("li").filter({ hasText: "450.0 m" }).getByRole("link", {
      name: "Survey recorded",
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator("li").filter({ hasText: "450.0 m" }).getByRole("link", {
      name: "Survey recorded",
    }),
  ).toBeVisible();
});

test("focuses a large-change warning and allows deliberate correction", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/surveys/new");
  await fillSurvey(page, { depth: "450.0", dip: "-62.4", azimuth: "220.0" });
  await page.getByRole("button", { name: "SAVE SURVEY" }).click();
  const warning = page.getByRole("alert").filter({ hasText: "Check survey entry" });
  await expect(warning).toBeVisible();
  await expect(warning).toBeFocused();
  await warning.getByRole("button", { name: "CHECK ENTRY" }).click();
  await page.getByRole("textbox", { name: "Azimuth" }).fill("130.1");
  await page.getByRole("button", { name: "SAVE SURVEY" }).click();
  await expect(page.getByText("Survey saved locally.")).toBeVisible();
});

test("handles duplicate-depth surveys without overwriting the existing record", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/surveys/new");
  await fillSurvey(page, { depth: "425.0", dip: "-62.2", azimuth: "129.9" });
  await page.getByRole("button", { name: "SAVE SURVEY" }).click();
  const warning = page.getByRole("alert").filter({ hasText: "already exists at this depth" });
  await expect(warning).toBeVisible();
  await warning.getByRole("link", { name: "VIEW EXISTING" }).click();
  await expect(page.getByRole("heading", { name: "DDH041 surveys" })).toBeVisible();
  await page.goto("/holes/DDH041/surveys/new");
  await fillSurvey(page, { depth: "425.0", dip: "-62.2", azimuth: "129.9" });
  await page.getByRole("button", { name: "SAVE SURVEY" }).click();
  await page.getByRole("button", { name: "SAVE ANYWAY" }).click();
  await page.goto("/holes/DDH041/surveys");
  await expect(page.getByText("Total surveys").locator("..")).toContainText("5");
});
