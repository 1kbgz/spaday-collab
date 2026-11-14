import { test, expect } from "@playwright/test";

test("page selections span inline markup and blocks without changing local selection", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.evaluate(async () => {
    document.body.innerHTML =
      '<main><p data-collab-text="first">Hello <strong>shared</strong> world</p><p data-collab-text="second">Another paragraph</p><p id="private">Not shared</p></main>';
    const { connectPageSelection } =
      await import("/examples/page-selection.js");
    window.activity = null;
    window.display = connectPageSelection(
      document.querySelector("main"),
      (value) => (window.activity = value),
    );
    display.enable(true);
    const first = document.querySelector("strong").firstChild;
    const second = document.querySelector(
      '[data-collab-text="second"]',
    ).firstChild;
    const range = document.createRange();
    range.setStart(first, 2);
    range.setEnd(second, 7);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const existing = document.createRange();
    existing.selectNodeContents(document.querySelector("#private"));
    CSS.highlights.set("application-owned", new Highlight(existing));
  });
  const expected = [
    { target: "first", text: "Hello shared world", start: 8, end: 18 },
    { target: "second", text: "Another paragraph", start: 0, end: 7 },
  ];
  await expect
    .poll(() => page.evaluate(() => window.activity))
    .toEqual(expected);
  const selected = await page.evaluate(() =>
    document.getSelection().toString(),
  );
  await page.evaluate(() =>
    display.render([{ state: { selection: activity, color: "orange" } }]),
  );
  const remote = () =>
    page.evaluate(() =>
      [...CSS.highlights]
        .filter(([name]) => name !== "application-owned")
        .flatMap(([, value]) => [...value].map((range) => range.toString())),
    );
  await expect.poll(remote).toEqual(["ared world", "Another"]);
  expect(await page.evaluate(() => document.getSelection().toString())).toBe(
    selected,
  );
  await page.evaluate(() => {
    document.querySelector("strong").textContent = "different";
  });
  await expect.poll(remote).toEqual(["Another"]);
  await page.evaluate(() =>
    display.render([
      {
        state: {
          selection: [
            { target: "second", text: "Another paragraph", start: -1, end: 7 },
          ],
        },
      },
    ]),
  );
  await expect.poll(remote).toEqual([]);
  await page.evaluate(() => {
    display.enable(false);
    const range = document.createRange();
    range.selectNodeContents(
      document.querySelector('[data-collab-text="second"]'),
    );
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(range);
  });
  await expect.poll(() => page.evaluate(() => window.activity)).toEqual([]);
  await page.evaluate(() => display.enable(true));
  await expect.poll(() => page.evaluate(() => window.activity.length)).toBe(1);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    ),
  );
  await expect.poll(() => page.evaluate(() => window.activity)).toEqual([]);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await expect.poll(() => page.evaluate(() => window.activity.length)).toBe(1);
  await page.evaluate(() => {
    display.disconnect();
    display.disconnect();
  });
  await expect
    .poll(() => page.evaluate(() => [...CSS.highlights.keys()]))
    .toEqual(["application-owned"]);
  expect(await page.evaluate(() => window.activity)).toEqual([]);
});
