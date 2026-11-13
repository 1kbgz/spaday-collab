import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
test("Python gallery renders pointers and handles local movement", async ({
  page,
}) => {
  test.skip(
    !existsSync("dist/lite/index.html"),
    "Build with make pyodide-example first",
  );
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/dist/lite/");
  await expect(
    page.getByRole("heading", { name: "Shared pointer gallery" }),
  ).toBeVisible({ timeout: 100000 });
  await expect(page.locator("spaday-pointers .cursor")).toHaveCount(2);
  await page.locator('[data-collab-target="first"]').hover();
  await expect(page.locator("#pointer")).toContainText("first");
  expect(errors).toEqual([]);
});
