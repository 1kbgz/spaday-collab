import { test, expect } from "@playwright/test";

test("example focus withdraws on blur and disposes pending typing updates", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.clock.install();
  await page.evaluate(async () => {
    const { connectFocus } = await import("/examples/focus.js");
    const input = document.createElement("textarea");
    input.dataset.collabTarget = "note";
    document.body.append(input);
    window.changes = [];
    window.stopFocus = connectFocus((value) => window.changes.push(value));
  });
  const input = page.locator("textarea");
  await input.focus();
  await expect
    .poll(() => page.evaluate(() => window.changes.at(-1)))
    .toEqual({ target: "note", editing: false });
  await input.fill("Local text is not included in focus state");
  await expect
    .poll(() => page.evaluate(() => window.changes.at(-1)))
    .toEqual({ target: "note", editing: true });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect
    .poll(() => page.evaluate(() => window.changes.at(-1)))
    .toBeNull();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect
    .poll(() => page.evaluate(() => window.changes.at(-1)))
    .toEqual({ target: "note", editing: false });
  await input.fill("Another edit");
  await page.evaluate(() => {
    window.stopFocus();
    window.stopFocus();
    window.disposedCount = window.changes.length;
  });
  await expect
    .poll(() => page.evaluate(() => window.changes.at(-1)))
    .toBeNull();
  await input.fill("After disposal");
  await page.clock.fastForward(1600); // Detect callbacks left over from the editing timeout.
  expect(await page.evaluate(() => window.changes.length)).toBe(
    await page.evaluate(() => window.disposedCount),
  );
});
