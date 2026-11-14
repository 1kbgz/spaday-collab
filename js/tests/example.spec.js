import { spawn } from "node:child_process";
import { test, expect } from "@playwright/test";

test("example shares pointers and edits between independent browsers", async ({
  browser,
}) => {
  let server;
  const contexts = [];
  try {
    const origin = await new Promise((resolve, reject) => {
      server = spawn(
        process.env.SPADAY_TEST_PYTHON ?? "python",
        [
          "-u",
          "-c",
          `
import socket, uvicorn
from spaday_collab.example import create_app
sock=socket.socket()
sock.bind(("127.0.0.1",0))
print(f"http://127.0.0.1:{sock.getsockname()[1]}",flush=True)
uvicorn.Server(uvicorn.Config(create_app(),log_level="error")).run(sockets=[sock])
`,
        ],
        { cwd: "..", stdio: ["ignore", "pipe", "pipe"] },
      );
      server.once("error", reject);
      server.once("exit", (code) =>
        reject(new Error(`Server exited: ${code}`)),
      );
      server.stdout.once("data", (data) => resolve(data.toString().trim()));
      server.stderr.on("data", (data) => process.stderr.write(data));
    });
    await expect
      .poll(async () => {
        try {
          return (await fetch(origin)).status;
        } catch {
          return 0;
        }
      })
      .toBe(200);
    const errors = [];
    const pages = [];
    for (const path of ["/", "/bob"]) {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.addInitScript(() => {
        const Socket = WebSocket;
        window.demoSockets = [];
        window.WebSocket = class extends Socket {
          constructor(...args) {
            super(...args);
            window.demoSockets.push(this);
          }
        };
      });
      await page.goto(origin + path);
      await expect(page.getByRole("textbox")).toHaveValue(
        "Edit this note from either browser.",
      );
      pages.push(page);
    }
    const [alice, bob] = pages;
    await expect(alice.getByRole("checkbox")).toBeChecked();
    await bob.setViewportSize({ width: 950, height: 850 });
    await alice.mouse.move(10, 10);
    await expect(bob.locator("spaday-pointers .label")).toHaveText("Alice");
    await expect(bob.locator("spaday-pointers .hover")).toHaveCSS(
      "width",
      "950px",
    );
    const cursor = bob.locator("spaday-pointers .cursor");
    await expect
      .poll(async () => (await cursor.boundingBox())?.x)
      .toBeCloseTo((10 * 950) / alice.viewportSize().width, 1);
    await bob.getByRole("checkbox").uncheck();
    await expect(bob.locator("spaday-pointers .label")).toHaveText("Alice");
    await bob.evaluate(() => {
      document.body.style.minHeight = "2000px";
      window.scrollTo(0, 1000);
    });
    await expect(bob.locator("spaday-pointers .label")).toHaveText("Alice");
    await alice.getByRole("textbox").hover();
    await expect(bob.locator("spaday-pointers .cursor")).toHaveCount(0);
    await bob.evaluate(() => window.scrollTo(0, 0));
    await expect(bob.locator("spaday-pointers .label")).toHaveText("Alice");
    await alice.getByRole("checkbox").uncheck();
    await alice.mouse.move(10, 10);
    await expect(bob.locator("spaday-pointers .cursor")).toHaveCount(0);
    await alice.getByRole("textbox").hover();
    await expect(bob.locator("spaday-pointers .label")).toHaveText("Alice");
    await alice.getByRole("checkbox").check();
    await alice.mouse.move(10, 10);
    await expect(bob.locator("spaday-pointers .hover")).toHaveCSS(
      "width",
      "950px",
    );
    await alice.getByRole("textbox").hover();
    await expect
      .poll(
        async () =>
          (await bob.locator("spaday-pointers .hover").boundingBox())?.width,
      )
      .toBe((await bob.getByRole("textbox").boundingBox()).width);
    await alice.getByRole("textbox").focus();
    await expect(bob.locator("#note-focus")).toHaveText("Alice: Focused");
    await expect(bob.getByRole("textbox")).toHaveCSS("outline-style", "solid");
    await alice.getByRole("textbox").fill("Shared edit");
    await expect(bob.locator("#note-focus")).toHaveText("Alice: Editing");
    await expect(bob.getByRole("textbox")).toHaveValue("Shared edit");
    await alice
      .getByRole("textbox")
      .evaluate((el) => el.setSelectionRange(0, 6));
    await expect(bob.locator(".text-selection")).toHaveCount(1);
    await expect(bob.locator(".text-caret")).toHaveCount(1);
    const selected = await bob.locator(".text-selection").boundingBox();
    await expect
      .poll(async () => (await bob.locator(".text-caret").boundingBox()).x)
      .toBeCloseTo(selected.x + selected.width, 0);
    await alice
      .getByRole("textbox")
      .evaluate((el) => el.setSelectionRange(0, 6, "backward"));
    await expect
      .poll(async () => (await bob.locator(".text-caret").boundingBox()).x)
      .toBeCloseTo(selected.x, 0);
    await alice
      .getByRole("textbox")
      .evaluate((el) => el.setSelectionRange(3, 3));
    await expect(bob.locator(".text-selection")).toHaveCount(0);
    await expect(bob.locator(".text-caret")).toHaveCount(1);

    await alice.locator("section").hover();
    await expect(bob.locator("#note-focus")).toHaveText("Alice: Focused");
    await expect(bob.locator("#review-focus")).toBeEmpty();
    await alice.getByRole("textbox").press("Tab");
    await expect(bob.locator("#note-focus")).toBeEmpty();
    await expect(bob.locator(".text-caret")).toHaveCount(0);
    await expect(bob.locator("#review-focus")).toHaveText("Alice: Focused");
    // Mouse movement and keyboard focus are independent awareness fields.
    await alice.getByRole("textbox").hover();
    await expect(bob.locator("#review-focus")).toHaveText("Alice: Focused");
    await alice.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(bob.locator("#review-focus")).toBeEmpty();
    await alice.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(bob.locator("#review-focus")).toHaveText("Alice: Focused");
    await alice.locator("section").hover();
    await expect(bob.locator("spaday-pointers .label")).toHaveText("Alice");
    await alice.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: true }),
      ),
    );
    await expect(bob.locator(".cursor")).toHaveCount(0);
    await expect(bob.locator("#review-focus")).toBeEmpty();
    await alice.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      ),
    );
    await expect(bob.locator("#review-focus")).toHaveText("Alice: Focused");
    await contexts[0].setOffline(true);
    await alice.evaluate(() =>
      window.demoSockets.forEach((socket) => socket.close()),
    );
    await expect(bob.locator("#review-focus")).toBeEmpty();
    await contexts[0].setOffline(false);
    await expect(bob.locator("#review-focus")).toHaveText("Alice: Focused");
    await alice.mouse.move(1, 1);
    await alice.getByRole("textbox").hover();
    await expect(bob.locator(".label")).toHaveText("Alice");
    await contexts[0].close();
    await expect(bob.locator(".cursor")).toHaveCount(0);
    await expect(bob.locator("#review-focus")).toBeEmpty();
    expect(errors).toEqual([]);
  } finally {
    await Promise.allSettled(contexts.map((c) => c.close()));
    if (server && server.exitCode === null)
      await new Promise((resolve) => {
        server.once("exit", resolve);
        server.kill();
      });
  }
});
