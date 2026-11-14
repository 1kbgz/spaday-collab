import { test, expect } from "@playwright/test";

test("page fallback composes with a custom adapter without target collisions", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.evaluate(async () => {
    await customElements.whenDefined("spaday-pointers");
    const { pageTargets } = await import("/examples/page-pointers.js");
    window.virtualVisible = true;
    window.adapter = {
      hitTest: (x, y) =>
        x >= 100 && x <= 200 && y >= 100 && y <= 200 ? "page" : null,
      resolve: (id) =>
        id === "page" && window.virtualVisible
          ? { bounds: new DOMRect(100, 100, 100, 100), hit: () => true }
          : undefined,
    };
    window.overlay = document.querySelector("spaday-pointers");
    overlay.adapter = pageTargets(adapter, true);
    window.current = null;
    overlay.addEventListener(
      "pointer-change",
      (e) => (window.current = e.detail.pointer),
    );
  });
  await page.mouse.move(10, 10);
  await expect
    .poll(() => page.evaluate(() => window.current?.target))
    .toBe("page");
  await page.mouse.move(150, 150);
  await expect
    .poll(() => page.evaluate(() => window.current))
    .toEqual({ target: "target:page", x: 0.5, y: 0.5 });
  await page.mouse.move(10, 10);
  await expect
    .poll(() => page.evaluate(() => window.current?.target))
    .toBe("page");
  await page.evaluate(() => {
    overlay.peers = [
      {
        peer: "remote",
        pointer: { target: "target:page", x: 0.5, y: 0.5 },
        label: "Remote",
      },
    ];
  });
  await expect(page.locator(".hover")).toHaveCSS("width", "100px");
  await page.evaluate(() => {
    window.virtualVisible = false;
    document.dispatchEvent(new Event("viewport-change"));
  });
  await expect(page.locator(".cursor")).toHaveCount(0);
  await page.evaluate(async () => {
    const { pageTargets } = await import("/examples/page-pointers.js");
    overlay.adapter = pageTargets(adapter, false);
    overlay.peers = [
      {
        peer: "remote",
        pointer: { target: "page", x: 0.5, y: 0.5 },
        label: "Remote",
      },
    ];
  });
  await expect(page.locator(".label")).toHaveText("Remote");
  await page.mouse.move(20, 20);
  expect(await page.evaluate(() => window.current)).toBe(null);
});
