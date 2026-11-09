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
async function press(key, selector = "body", modifiers = {}) {
    return page.evaluate(
        ({ key, selector, modifiers }) => {
            const before = window.__sent.length;
            const target = document.querySelector(selector);
            target.focus?.();
            const event = new KeyboardEvent("keydown", {
                key,
                bubbles: true,
                cancelable: true,
                ...modifiers,
            });
            target.dispatchEvent(event);
            return {
                key,
                on: selector,
                modifiers,
                forwarded: window.__sent.slice(before),
                prevented: event.defaultPrevented,
            };
        },
        { key, selector, modifiers }
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
// Drawer tabs: Ctrl+1..8 forwarded, neighbours and other Ctrl bindings not.
for (let digit = 1; digit <= 8; digit += 1) {
    cases.push(await press(String(digit), "body", { ctrlKey: true }));
}
for (const key of ["0", "9", "d", "t"]) {
    cases.push(await press(key, "body", { ctrlKey: true }));
}
// Typing in a field must also swallow the drawer shortcut.
for (const key of ["1", "2"]) {
    cases.push(await press(key, "#text", { ctrlKey: true }));
}

const showBindings = {
    " ": "next",
    ArrowRight: "next",
    PageDown: "next",
    ArrowLeft: "previous",
    PageUp: "previous",
    Escape: "clear",
};

function expectedResult(key, modifiers) {
    if (modifiers.ctrlKey) {
        if (!modifiers.altKey && /^[1-8]$/.test(key)) return "Ctrl+" + key;
        return null;
    }
    // The page forwards the key name; Rust maps it to a command.
    return Object.hasOwn(showBindings, key) ? key : null;
}

const checks = cases.map((result) => {
    const typing = result.on === "#text";
    const expected = expectedResult(result.key, result.modifiers || {});
    const shouldForward = !typing && expected !== null;
    const pass = shouldForward
        ? result.forwarded.length === 1 &&
          result.forwarded[0] === expected &&
          result.prevented
        : result.forwarded.length === 0 && !result.prevented;
    return { ...result, expected, shouldForward, pass };
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
