import { test, expect } from "@playwright/test";

test("optional click markers expire, deduplicate, and clean up without animations", async ({
  page,
}) => {
  await page.route("**/src/ts/pointers.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'export { isPointer } from "/dist/esm/index.js";',
    }),
  );
  await page.goto("/dist/index.html");
  await page.clock.install();
  await page.evaluate(async () => {
    const { connectClicks, connectViewport } =
      await import("/examples/page-activity.js");
    document.body.innerHTML = "<button>Activate</button>";
    document.body.style.minHeight = "3000px";
    const adapter = {
      hitTest: () => "target",
      resolve: () => ({ bounds: new DOMRect(0, 0, 200, 200), hit: () => true }),
    };
    window.clicks = [];
    window.tracker = connectClicks(adapter, (value) => clicks.push(value));
    window.viewport = connectViewport((value) => (window.progress = value));
    window.peer = {
      peer: "alice",
      state: {
        click: { id: "one", pointer: { target: "target", x: 0.5, y: 0.5 } },
      },
    };
  });
  await page.getByRole("button").click();
  expect(await page.evaluate(() => clicks)).toEqual([]);
  await page.evaluate(() => tracker.enable(true));
  await page.getByRole("button").focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => clicks.at(-1).pointer.target)).toBe(
    "target",
  );
  await page.evaluate(() => tracker.render([peer]));
  await expect(page.locator(".click-marker")).toHaveCount(1);
  await page.clock.fastForward(900);
  await expect(page.locator(".click-marker")).toHaveCount(0);
  expect(await page.evaluate(() => clicks.at(-1))).toBeNull();
  await page.evaluate(() => tracker.render([peer]));
  await expect(page.locator(".click-marker")).toHaveCount(0);
  await page.evaluate(() => {
    peer.state.click.id = "two";
    tracker.render([peer]);
  });
  await expect(page.locator(".click-marker")).toHaveCount(1);
  await page.evaluate(() => tracker.render([]));
  await expect(page.locator(".click-marker")).toHaveCount(0);
  await page.evaluate(() => {
    viewport.enable(true);
    window.scrollTo(0, 600);
  });
  await expect.poll(() => page.evaluate(() => progress)).toBeGreaterThan(0);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(() => page.evaluate(() => progress)).toBeNull();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => page.evaluate(() => progress)).toBeGreaterThan(0);
  await page.evaluate(() => {
    viewport.enable(false);
    tracker.disconnect();
    viewport.disconnect();
    window.count = clicks.length;
  });
  await expect.poll(() => page.evaluate(() => progress)).toBeNull();
  await page.getByRole("button").click();
  expect(await page.evaluate(() => clicks.length)).toBe(
    await page.evaluate(() => count),
  );
});
