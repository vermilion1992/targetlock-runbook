import { expect, type Page } from "@playwright/test";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

export async function resetPilotBrowserState(page: Page) {
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
    await Promise.all(
      ["targetlock-runbook-media-v1", "targetlock-runbook-reports-v1"].map(
        (name) =>
          new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          }),
      ),
    );
  });
  await page.reload();
  await expect(page.getByText("DDH041").first()).toBeVisible();
}

export async function expectNoHorizontalOverflow(page: Page, context: string) {
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

export async function startDayShift(page: Page) {
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

export async function selectOptionMatching(
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

export async function uploadTrayPhoto(page: Page, name = "tray-pilot.png") {
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await expect(page.getByAltText(/Preview of selected/i)).toBeVisible();
}

export async function selectOnlyFormat(
  page: Page,
  format: "PDF" | "XLSX" | "CSV",
) {
  for (const candidate of ["PDF", "XLSX", "CSV"] as const) {
    const checkbox = page.getByRole("checkbox", { name: candidate });
    const checked = await checkbox.isChecked();
    if ((candidate === format) !== checked) {
      await checkbox.click();
    }
  }
}
