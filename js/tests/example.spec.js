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
      await page.goto(origin + path);
      await expect(page.getByRole("textbox")).toHaveValue(
        "Edit this note from either browser.",
      );
      pages.push(page);
    }
    const [alice, bob] = pages;
    await alice.getByRole("textbox").hover();
    await expect(bob.locator("spaday-pointers .label")).toHaveText("Alice");
    await alice.getByRole("textbox").fill("Shared edit");
    await expect(bob.getByRole("textbox")).toHaveValue("Shared edit");
    await alice.locator("section").hover();
    await expect(bob.locator("spaday-pointers .label")).toHaveText("Alice");
    await alice.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: true }),
      ),
    );
    await expect(bob.locator(".cursor")).toHaveCount(0);
    await alice.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      ),
    );
    await alice.mouse.move(1, 1);
    await alice.getByRole("textbox").hover();
    await expect(bob.locator(".label")).toHaveText("Alice");
    await contexts[0].close();
    await expect(bob.locator(".cursor")).toHaveCount(0);
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
