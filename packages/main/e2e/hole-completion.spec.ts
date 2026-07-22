import { expect, test, type Page } from "@playwright/test";

async function resetBrowserState(page: Page) {
  await page.goto("/holes/DDH041/current");
  await page.evaluate(async () => {
    window.localStorage.clear();
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
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("targetlock-media");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
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
  await resetBrowserState(page);
});

test("lists seeded completed and abandoned holes with filters", async ({
  page,
}) => {
  await page.goto("/holes/completed");
  await expect(
    page.getByRole("heading", { name: "Completed and abandoned holes" }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "DDH038" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "DDH039" })).toBeVisible();

  await page.getByRole("combobox", { name: "Status" }).selectOption("ABANDONED");
  await expect(page.getByRole("cell", { name: "DDH039" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "DDH038" })).toHaveCount(0);

  await page.getByRole("combobox", { name: "Status" }).selectOption("COMPLETED");
  await expect(page.getByRole("cell", { name: "DDH038" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "DDH039" })).toHaveCount(0);
});

test("shows locked completion snapshot and blocks drilling primary action language", async ({
  page,
}) => {
  await page.goto("/holes/DDH038/complete");
  await expect(
    page.getByRole("heading", { name: "DDH038 completion" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hole locked" })).toBeVisible();
  await expect(page.getByText("Frozen final statistics")).toBeVisible();
  await expect(page.getByRole("link", { name: "Reopen hole" })).toBeVisible();
});

test("reopens a completed hole and restores mutable messaging", async ({
  page,
}) => {
  await page.goto("/holes/DDH038/reopen");
  await expect(page.getByRole("heading", { name: "Reopen DDH038" })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Reason" })
    .fill("Client approved a short extension for Stage 5 testing.");
  await page.getByRole("button", { name: "Reopen hole" }).click();

  await expect(
    page.getByRole("heading", { name: "Final hole review" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText("Hole reopened to Active", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hole locked" })).toHaveCount(
    0,
  );
});

test("opens DDH041 final hole review with checklist sections", async ({
  page,
}) => {
  await page.goto("/holes/DDH041/more");
  await page.getByRole("link", { name: "Final hole review" }).click();
  await expect(
    page.getByRole("heading", { name: "Final hole review" }),
  ).toBeVisible();
  await expect(page.getByText("Blocking checks")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Completion reason" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Complete and lock hole" }),
  ).toBeDisabled();
});

test("completed-hole routes remain usable at phone and tablet widths", async ({
  page,
}) => {
  for (const width of [360, 390, 430, 768, 1024] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/holes/completed");
    await expect(
      page.getByRole("heading", { name: "Completed and abandoned holes" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, `completed list @ ${width}`);

    await page.goto("/holes/DDH038/complete");
    await expect(page.getByRole("heading", { name: "Hole locked" })).toBeVisible();
    await expectNoHorizontalOverflow(page, `completion snapshot @ ${width}`);
  }
});

test("completed list and completion review support dark mode", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/holes/completed");
  await expect(
    page.getByRole("heading", { name: "Completed and abandoned holes" }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "DDH038" })).toBeVisible();

  await page.goto("/holes/DDH041/complete");
  await expect(
    page.getByRole("heading", { name: "Final hole review" }),
  ).toBeVisible();
  await expect(page.getByText("Authoritative hole state")).toBeVisible();
});
