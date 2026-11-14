import { test, expect } from "@playwright/test";

test("textarea overlay follows wrapping and scrolling and rejects stale offsets", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.evaluate(async () => {
    document.body.innerHTML = `<style>
      .editor { position:relative; width:220px; }
      textarea { box-sizing:border-box; display:block; width:100%; height:90px; padding:10px; border:2px solid; font:20px/24px monospace; }
      .text-presence { position:absolute; overflow:hidden; pointer-events:none; }
      .text-mirror { position:absolute; box-sizing:border-box; overflow-wrap:break-word; visibility:hidden; }
      .text-selection,.text-caret { position:absolute; pointer-events:none; }
    </style><div class="editor"><textarea data-collab-target="note"></textarea></div>`;
    const { connectTextSelection } =
      await import("/examples/text-selection.js");
    window.textarea = document.querySelector("textarea");
    window.overlay = connectTextSelection(textarea);
    window.share = (text, anchor, head) => {
      textarea.value = text;
      overlay.render([
        {
          peer: "alice",
          state: {
            focus: { target: "note", selection: { text, anchor, head } },
            color: "red",
          },
        },
      ]);
    };
    share("abcdefghij", 2, 5);
  });
  const caret = page.locator(".text-caret");
  const selection = page.locator(".text-selection");
  await expect(caret).toHaveCount(1);
  const metrics = await page.locator("textarea").evaluate((el) => {
    const context = document.createElement("canvas").getContext("2d");
    context.font = getComputedStyle(el).font;
    return {
      left: el.getBoundingClientRect().left + el.clientLeft + 10,
      char: context.measureText("a").width,
    };
  });
  expect((await caret.boundingBox()).x).toBeCloseTo(
    metrics.left + 5 * metrics.char,
    0,
  );
  expect((await selection.boundingBox()).width).toBeCloseTo(
    3 * metrics.char,
    0,
  );
  await page.evaluate(() => share("abcdefghij ".repeat(15), 2, 100));
  await expect.poll(() => selection.count()).toBeGreaterThan(2);
  const before = await caret.boundingBox();
  await page.locator("textarea").evaluate((el) => {
    el.scrollTop = 72;
  });
  await expect
    .poll(async () => (await caret.boundingBox()).y)
    .toBeCloseTo(before.y - 72, 0);
  await page.locator(".editor").evaluate((el) => {
    el.style.width = "120px";
  });
  await expect
    .poll(async () => (await caret.boundingBox()).y)
    .not.toBeCloseTo(before.y - 72, 0);

  // Remote text can arrive before or after its awareness update.
  await page.evaluate(() => {
    textarea.value = "different";
    overlay.refresh();
  });
  await expect(caret).toHaveCount(0);
  await expect(selection).toHaveCount(0);
  await page.evaluate(() => share("", 0, 0));
  await expect(caret).toHaveCount(1);
  await page.evaluate(() => share("line\n", 5, 5));
  await expect(caret).toHaveCount(1);
  await expect
    .poll(() => page.locator(".text-mirror").textContent())
    .toBe("line\n\u200b");
  const end = await caret.boundingBox();
  await page.evaluate(() => share("line\n", 0, 0));
  await expect
    .poll(async () => (await caret.boundingBox()).y)
    .toBeCloseTo(end.y - 24, 0);
  await page.evaluate(() => share("line", -1, 100));
  await expect(caret).toHaveCount(0);
  await page.evaluate(() => {
    overlay.disconnect();
    overlay.disconnect();
    share("text", 0, 1);
  });
  await expect(page.locator(".text-presence")).toHaveCount(0);
});
