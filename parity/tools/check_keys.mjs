// Browser-level test of the keyboard bindings the app ships.
//
// Loads apps/desktop/assets/keys.js into a page with the same `dioxus.send`
// hook Dioxus provides, dispatches real keydown events, and reports what the
// script forwarded. The Rust half (key name -> command -> engine) is covered by
// cargo tests; this proves the capture rules: which keys are forwarded, which
// are ignored while typing, and which are prevented from scrolling.
//
// Usage: node check_keys.mjs <keys.js> <out.json>

import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [scriptPath, outPath] = process.argv.slice(2);
if (!scriptPath || !outPath) {
    console.error("usage: node check_keys.mjs <keys.js> <out.json>");
    process.exit(2);
}

const script = readFileSync(scriptPath, "utf8");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`
  <body>
    <button id="focusable">A button</button>
    <input id="text" />
  </body>
`);

await page.evaluate(() => {
    window.__sent = [];
    window.dioxus = { send: (key) => window.__sent.push(key) };
});
await page.addScriptTag({ content: script });

/** Dispatch a keydown on a selector and report what happened. */
async function press(key, selector = "body") {
    return page.evaluate(
        ({ key, selector }) => {
            const before = window.__sent.length;
            const target = document.querySelector(selector);
            target.focus?.();
            const event = new KeyboardEvent("keydown", {
                key,
                bubbles: true,
                cancelable: true,
            });
            target.dispatchEvent(event);
            return {
                key,
                on: selector,
                forwarded: window.__sent.slice(before),
                prevented: event.defaultPrevented,
            };
        },
        { key, selector }
    );
}

const cases = [];
for (const key of [" ", "ArrowRight", "PageDown", "ArrowLeft", "PageUp", "Escape"]) {
    cases.push(await press(key));
}
for (const key of ["a", "ArrowUp", "Enter", "Home", "End", "Tab"]) {
    cases.push(await press(key));
}
// Typing must never trigger the show.
for (const key of [" ", "ArrowLeft", "Escape"]) {
    cases.push(await press(key, "#text"));
}

const expected = {
    " ": "next",
    ArrowRight: "next",
    PageDown: "next",
    ArrowLeft: "previous",
    PageUp: "previous",
    Escape: "clear",
};

const checks = cases.map((result) => {
    const typing = result.on === "#text";
    const shouldForward = !typing && Object.hasOwn(expected, result.key);
    const pass = shouldForward
        ? result.forwarded.length === 1 && result.prevented
        : result.forwarded.length === 0 && !result.prevented;
    return { ...result, shouldForward, pass };
});

const failed = checks.filter((check) => !check.pass);
const report = {
    script: scriptPath,
    passed: failed.length === 0,
    cases: checks,
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");

await browser.close();
console.log(JSON.stringify(report, null, 2));
process.exit(report.passed ? 0 : 1);
