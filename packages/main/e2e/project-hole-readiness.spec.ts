import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("signed-out hole deep link passes through Start confirmation", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/current?notice=shift-started");
  await expect(page).toHaveURL(
    "/sign-in?next=%2Fholes%2FDDH041%2Fcurrent%3Fnotice%3Dshift-started",
  );
  await page.getByLabel("Operator name").fill("Route Test Driller");
  await page.getByRole("button", { name: "Sign in on this device" }).click();
  await expect(page).toHaveURL(
    "/start?next=%2Fholes%2FDDH041%2Fcurrent%3Fnotice%3Dshift-started",
  );
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Open DDH041?" }),
  ).toBeVisible();
  await expect(dialog.getByText("North Ridge Minerals")).toBeVisible();
  await expect(dialog.getByText("Pilbara, Western Australia")).toBeVisible();
  await expect(dialog.getByText("Rig 10")).toBeVisible();
  await expect(dialog.getByText("Driller")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Continue to requested page" })
    .click();
  await expect(page).toHaveURL(
    "/holes/DDH041/current?notice=shift-started",
  );
  await expect(page.getByRole("heading", { name: "DDH041" })).toBeVisible();
});

test("driller chooses local work but cannot open setup routes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Operator name").fill("E2E Driller");
  await page.getByRole("button", { name: "Sign in on this device" }).click();

  await expect(page).toHaveURL("/start");
  await expect(page.getByTestId("setup-work")).toHaveCount(0);
  await expect(page.getByTestId("driller-work-guidance")).toContainText(
    "create a Draft from a client plan",
  );
  await expect(
    page.getByRole("button", { name: /New drill hole/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /New project/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Create hole from plan/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Choose other work/ }).click();
  await page.getByRole("button", { name: /DDH041/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Open DDH041?" }),
  ).toBeVisible();
  await expect(dialog.getByText("North Ridge Minerals")).toBeVisible();
  await expect(dialog.getByText("Pilbara, Western Australia")).toBeVisible();
  await expect(dialog.getByText("Rig 10")).toBeVisible();
  await expect(dialog.getByText("Active", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Driller", { exact: true })).toBeVisible();

  await page.goto("/projects/new");
  await expect(
    page.getByText("Supervisor setup only", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("signed in as a Driller")).toBeVisible();
});

test("driller creates an assigned Draft hole from a client plan", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Operator name").fill("Plan Test Driller");
  await page.getByRole("button", { name: "Sign in on this device" }).click();

  await page.getByRole("button", { name: /Create hole from plan/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Briggs North Ridge/ }).click();
  await dialog.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/start\/new-hole\?project=/);
  await expect(
    page.getByRole("heading", { name: "Create assigned hole" }),
  ).toBeVisible();
  await page.getByLabel("Hole ID").fill("PLAN-DDH-001");
  await page.getByLabel("Client plan reference").fill("NRM-WI-2026-041");
  await page.getByLabel("Plan revision").fill("Rev B");
  await page.getByRole("button", { name: "Create hole and continue" }).click();

  await expect(page).toHaveURL("/holes/PLAN-DDH-001/current");
  await expect(page.getByTestId("drilling-setup-required")).toBeVisible();
  await page.getByRole("link", { name: "Update BHA — next action" }).click();
  await expect(
    page.getByRole("heading", { name: "Initial BHA setup" }),
  ).toBeVisible();
});

test("phone sign-in starts a project-owned hole and resumes it safely", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page).toHaveURL("/sign-in");
  await page.getByLabel("Operator name").fill("E2E Supervisor");
  await page.getByText("Supervisor", { exact: true }).click();
  await page.getByRole("button", { name: "Sign in on this device" }).click();
  await expect(page).toHaveURL("/start");
  await expect(
    page.getByRole("heading", { name: "Choose your work" }),
  ).toBeVisible();
  await expect(page.getByTestId("setup-work")).toBeVisible();

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
  await expect(page.getByText("BHA components")).toBeVisible();
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

  await page.getByRole("button", { name: "Sign out E2E Supervisor" }).click();
  await expect(page).toHaveURL("/sign-in");
});
