// Look at a VM's web console (dockur/noVNC) from Playwright.
//
// Usage:
//   node watch_vm.mjs <url> <out.png> [waitSeconds] [--type TEXT] [--key KEY]
//
// Screenshots the console after waiting, optionally sending keystrokes first.
// Keystrokes go to the page after clicking the canvas, which is how noVNC gets
// focus. Useful for a headless check of what a Windows VM is showing.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const [url, out, waitArg, ...rest] = args;
if (!url || !out) {
    console.error("usage: node watch_vm.mjs <url> <out.png> [waitSeconds] [--type TEXT] [--key KEY]");
    process.exit(2);
}
const waitSeconds = Number(waitArg) || 5;

const actions = [];
for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--type") actions.push({ type: "text", value: rest[++i] });
    else if (rest[i] === "--key") actions.push({ type: "key", value: rest[++i] });
    else if (rest[i] === "--click") {
        const [x, y] = rest[++i].split(",").map(Number);
        actions.push({ type: "click", x, y });
    } else if (rest[i] === "--dblclick") {
        const [x, y] = rest[++i].split(",").map(Number);
        actions.push({ type: "dblclick", x, y });
    }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(waitSeconds * 1000);

const canvas = page.locator("canvas").first();
if ((await canvas.count()) > 0) {
    await canvas.click({ position: { x: 80, y: 80 } }).catch(() => {});
    await page.waitForTimeout(300);
}

for (const action of actions) {
    if (action.type === "text") await page.keyboard.type(action.value, { delay: 40 });
    else if (action.type === "key") await page.keyboard.press(action.value);
    else if (action.type === "click") await page.mouse.click(action.x, action.y);
    else if (action.type === "dblclick") await page.mouse.dblclick(action.x, action.y);
    await page.waitForTimeout(400);
}

mkdirSync(dirname(out), { recursive: true });
await page.screenshot({ path: out });
console.log(JSON.stringify({ url, out, waitedSeconds: waitSeconds, actions: actions.length }));
await browser.close();
