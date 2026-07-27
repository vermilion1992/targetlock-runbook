import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("sign-in returns to the requested TargetLock route", async ({ page }) => {
  await page.goto("/holes/DDH041/current");
  await expect(page).toHaveURL(
    "/sign-in?next=%2Fholes%2FDDH041%2Fcurrent",
  );
  await page.getByLabel("Operator name").fill("Route Test Driller");
  await page.getByRole("button", { name: "Sign in on this device" }).click();
  await expect(page).toHaveURL("/holes/DDH041/current");
  await expect(page.getByRole("heading", { name: "DDH041" })).toBeVisible();
});

test("phone sign-in starts a project-owned hole and resumes it safely", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page).toHaveURL("/sign-in");
  await page.getByLabel("Operator name").fill("E2E Driller");
  await page.getByRole("button", { name: "Sign in on this device" }).click();
  await expect(page).toHaveURL("/start");
  await expect(
    page.getByRole("heading", { name: "Welcome, E2E Driller" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /New project/ }).click();
  await page.getByLabel("Project code").fill("E2E-26-01");
  await page.getByLabel("Project name").fill("E2E North Ridge");
  await page.getByLabel("Client").fill("E2E Minerals");
  await page.getByLabel("Location").fill("North Ridge");
  await page.getByLabel("Rig name").fill("E2E Rig 1");
  await page.getByLabel("Rig serial").fill("E2E-RIG-001");
  await page.getByLabel("Rig model").fill("DE150");
  await page.getByRole("button", { name: "Create project" }).click();

  await expect(page).toHaveURL(/\/projects\/project-/);
  const projectUrl = page.url();
  await expect(
    page.getByRole("heading", { name: "E2E North Ridge" }),
  ).toBeVisible();

  await page.goto("/start");
  await page.getByRole("button", { name: /New drill hole/ }).click();
  await page
    .getByRole("button", { name: /E2E North Ridge.*E2E-26-01/ })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Create a hole in E2E North Ridge?",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/projects\/project-.*\/holes\/new/);
  await page.getByLabel("Hole ID").fill("E2E-DDH-001");
  await page.getByRole("button", { name: "Create hole and continue" }).click();

  await expect(page).toHaveURL("/holes/E2E-DDH-001/current");
  await expect(page.getByTestId("drilling-setup-required")).toBeVisible();
  await expect(page.getByText("RECORD NEXT RUN — LOCKED")).toBeVisible();

  await page.getByRole("link", { name: "Update BHA — next action" }).click();
  await expect(
    page.getByRole("heading", { name: "Initial BHA setup" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Full BHA length" }).fill("6.0");
  await page.getByRole("textbox", { name: "Constant stick-up" }).fill("1.0");
  await expect(page.getByText("Optional component details")).toBeVisible();
  await page.getByRole("button", { name: "Save initial setup" }).click();

  await expect(page).toHaveURL(
    "/holes/E2E-DDH-001/current?notice=bha-updated",
  );
  await expect(
    page.getByRole("heading", { name: "No active shift" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Start shift" }).click();
  await page.getByRole("button", { name: "Start shift" }).click();

  await expect(page).toHaveURL(
    "/holes/E2E-DDH-001/current?notice=shift-started",
  );
  await expect(page.getByText("Active Day Shift")).toBeVisible();

  await page.goto("/holes/E2E-DDH-001/timeline");
  await expect(page.getByText("Initial hole setup recorded")).toBeVisible();
  await expect(page.getByText(/Dip -60\.0° · azimuth 128\.0° GRID/)).toBeVisible();
  await expect(page.getByText("Initial BHA setup recorded")).toBeVisible();
  await expect(
    page.getByText(/Initial full BHA 6\.0 m · initial constant stick-up 1\.0 m/),
  ).toBeVisible();

  await page.goto(projectUrl);
  await expect(page.getByText("E2E-DDH-001")).toBeVisible();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();

  await page.goto("/start");
  await expect(
    page.getByRole("heading", { name: "E2E-DDH-001" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Record next run" }).click();
  await expect(
    page.getByRole("heading", { name: "Open E2E-DDH-001?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Sign out E2E Driller" }).click();
  await expect(page).toHaveURL("/sign-in");
});
