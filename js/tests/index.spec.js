import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/dist/index.html");
  await page.evaluate(() => customElements.whenDefined("spaday-pointers"));
});
const show = (
  page,
  pointer = { target: "first", x: 0.5, y: 0.5 },
  label = "Alice",
) =>
  page.evaluate(
    ({ pointer, label }) => {
      document.querySelector("spaday-pointers").peers = [
        { peer: "a", pointer, label, color: "#f4a261" },
      ];
    },
    { pointer, label },
  );

test("projects relative coordinates and styles without intercepting clicks", async ({
  page,
}) => {
  await show(page);
  const box = await page.locator("[data-collab-target]").boundingBox();
  const cursor = page.locator("spaday-pointers .cursor");
  await expect(cursor).toBeVisible();
  const bounds = await cursor.boundingBox();
  expect(bounds.x).toBeCloseTo(box.x + box.width / 2);
  expect(bounds.y).toBeCloseTo(box.y + box.height / 2);
  await expect(cursor).toHaveCSS("pointer-events", "none");
  await page.locator("[data-collab-target]").click();
  await expect(page.locator(".label")).toHaveText("Alice");
});

test("local events withdraw on leave and stop after disconnect", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.pointers = [];
    window.overlay = document.querySelector("spaday-pointers");
    overlay.addEventListener("pointer-change", (e) =>
      pointers.push(e.detail.pointer),
    );
  });
  await page.locator("[data-collab-target]").hover();
  await expect
    .poll(() => page.evaluate(() => pointers.at(-1)?.target))
    .toBe("first");
  await page.mouse.move(1, 1);
  await expect.poll(() => page.evaluate(() => pointers.at(-1))).toBe(null);
  await page.evaluate(() => overlay.remove());
  const count = await page.evaluate(() => pointers.length);
  await page.locator("[data-collab-target]").hover();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => pointers.length)).toBe(count);
  await page.evaluate(() => document.body.append(overlay));
  await page.mouse.move(1, 1);
  await page.locator("[data-collab-target]").hover();
  await expect
    .poll(() => page.evaluate(() => pointers.at(-1)?.target))
    .toBe("first");
});

test("rejects malformed pointers and treats labels as text", async ({
  page,
}) => {
  await show(
    page,
    { target: "first", x: 0.5, y: 0.5 },
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator(".label")).toHaveText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator("spaday-pointers img")).toHaveCount(0);
  for (const pointer of [
    null,
    {},
    { target: "missing", x: 0.5, y: 0.5 },
    { target: "first", x: NaN, y: 0 },
    { target: "first", x: 2, y: 0 },
    { target: "first", x: "0", y: 0 },
  ]) {
    await show(page, pointer);
    await expect(page.locator(".cursor")).toHaveCount(0);
  }
});

test("tracks target layout and hides obscured or removed targets", async ({
  page,
}) => {
  await show(page);
  await expect(page.locator(".cursor")).toBeVisible();
  await page
    .locator("[data-collab-target]")
    .evaluate((el) => (el.style.marginTop = "140px"));
  await expect
    .poll(async () => (await page.locator(".cursor").boundingBox())?.y)
    .toBe(240);
  await page.evaluate(() => {
    const cover = document.createElement("div");
    cover.id = "cover";
    Object.assign(cover.style, {
      position: "fixed",
      inset: "0",
      background: "white",
      zIndex: "10",
    });
    document.body.append(cover);
  });
  await expect(page.locator(".cursor")).toHaveCount(0);
  await page.locator("#cover").evaluate((el) => el.remove());
  await expect(page.locator(".cursor")).toBeVisible();
  await page.locator("[data-collab-target]").evaluate((el) => el.remove());
  await expect(page.locator(".cursor")).toHaveCount(0);
});

test("clips hover outlines at scrolling ancestors", async ({ page }) => {
  await page.evaluate(() => {
    const target = document.querySelector("[data-collab-target]");
    target.style.margin = "0";
    const clip = document.createElement("div");
    clip.id = "clip";
    Object.assign(clip.style, {
      height: "80px",
      width: "300px",
      overflow: "auto",
      margin: "40px",
    });
    target.replaceWith(clip);
    clip.append(target);
  });
  await show(page, { target: "first", x: 0.5, y: 0.2 });
  await expect(page.locator(".cursor")).toBeVisible();
  await expect(page.locator(".hover")).toHaveCSS("height", "80px");
  await show(page, { target: "first", x: 0.5, y: 0.8 });
  await expect(page.locator(".cursor")).toHaveCount(0);
});

test("custom adapter resolves virtual targets and responds to viewport changes", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.visible = true;
    document.querySelector("spaday-pointers").adapter = {
      hitTest: () => "virtual",
      resolve: (id) =>
        id === "virtual" && window.visible
          ? { bounds: new DOMRect(40, 40, 100, 100), hit: () => true }
          : undefined,
    };
  });
  await show(page, { target: "virtual", x: 0.5, y: 0.5 });
  await expect(page.locator(".cursor")).toBeVisible();
  await page.evaluate(() => {
    window.visible = false;
    document.dispatchEvent(new Event("viewport-change"));
  });
  await expect(page.locator(".cursor")).toHaveCount(0);
});

test("tracking is usable without the Pointers renderer", async ({ page }) => {
  await page.evaluate(async () => {
    document.querySelector("spaday-pointers").remove();
    const { connectPointers, domTargets } = await import("/dist/cdn/index.js");
    window.changes = [];
    window.projected = [];
    window.tracker = connectPointers(
      domTargets(),
      (p) => changes.push(p),
      (p) => (projected = p),
    );
    tracker.render([
      { peer: "one", pointer: { target: "first", x: 0.5, y: 0.5 } },
    ]);
  });
  await expect.poll(() => page.evaluate(() => projected.length)).toBe(1);
  await page.locator("[data-collab-target]").hover();
  await expect
    .poll(() => page.evaluate(() => changes.at(-1)?.target))
    .toBe("first");
  await page.evaluate(() => tracker.disconnect());
  expect(await page.evaluate(() => projected)).toEqual([]);
  expect(await page.evaluate(() => changes.at(-1))).toBe(null);
});

test("a custom DOM renderer does not trigger an observer loop", async ({
  page,
}) => {
  await page.evaluate(async () => {
    document.querySelector("spaday-pointers").remove();
    const { connectPointers, domTargets } = await import("/dist/cdn/index.js");
    window.draws = 0;
    const output = document.createElement("output");
    document.body.append(output);
    window.tracker = connectPointers(
      domTargets(),
      () => {},
      (p) => {
        window.draws++;
        output.textContent = JSON.stringify(p);
      },
    );
    tracker.render([
      { peer: "a", pointer: { target: "first", x: 0.5, y: 0.5 } },
    ]);
  });
  await expect.poll(() => page.evaluate(() => window.draws)).toBe(1);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.draws)).toBe(1);
  await page.evaluate(() => tracker.disconnect());
});

test("ordinary targets include content inside nested shadow roots", async ({
  page,
}) => {
  await page.locator("[data-collab-target]").evaluate((el) => {
    el.attachShadow({ mode: "open" }).innerHTML =
      '<button style="width:100%;height:100%">Shadow content</button>';
  });
  await show(page);
  await expect(page.locator(".cursor")).toBeVisible();
  await page.evaluate(() => {
    window.local = null;
    document
      .querySelector("spaday-pointers")
      .addEventListener(
        "pointer-change",
        (e) => (window.local = e.detail.pointer),
      );
  });
  await page.getByRole("button", { name: "Shadow content" }).hover();
  await expect
    .poll(() => page.evaluate(() => window.local?.target))
    .toBe("first");
});
