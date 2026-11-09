// Evidence probe: real mouse hit tests on the drawer strip and grab offset.
// Uses the shipped CSS and the shipped DRAWER_SCRIPT in headless Chromium.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../..");
const { chromium } = await import(
    `file://${resolve(root, "parity/tools/node_modules/playwright/index.mjs")}`
);
const css = readFileSync(`${root}/apps/desktop/assets/main.css`, "utf8");
const drawerSource = readFileSync(`${root}/apps/desktop/src/drawer.rs`, "utf8");
const match = drawerSource.match(/pub const DRAWER_SCRIPT: &str = r#"([\s\S]*?)"#;/);
if (!match) throw new Error("DRAWER_SCRIPT not found");
const drawerScript = match[1];

const tabs = [
    "1 Shows",
    "2 Media",
    "3 Audio",
    "4 Overlays",
    "5 Templates",
    "6 Scripture",
    "7 Calendar",
    "8 Functions",
]
    .map((label, index) => `<button class="drawer-tab${index === 0 ? " active" : ""}">${label}</button>`)
    .join("");

const pageHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body><div class="controller">
  <header class="topbar"><div class="brand"><h1>Probe</h1></div></header>
  <div class="workspace"><div class="workspace-grid">
    <aside class="column left">left</aside><div class="resize-handle"></div>
    <main class="column center">centre</main><div class="resize-handle"></div>
    <aside class="column right">right</aside>
  </div></div>
  <div class="drawer" style="--drawer-h: 300px;">
    <div class="drawer-top"><div class="drawer-tabs">${tabs}</div></div>
    <div class="drawer-body"><div class="drawer-content">content</div><aside class="drawer-info">clock</aside></div>
  </div>
</div>
<script>
window.__sent = [];
window.dioxus = { send: (raw) => window.__sent.push(JSON.parse(raw)) };
${drawerScript}
</script></body></html>`;

const browser = await chromium.launch();
const results = {};

async function setup(page) {
    await page.setContent(pageHtml);
    await page.waitForTimeout(100);
}

async function reset(page) {
    await page.evaluate(() => {
        window.__sent = [];
        window.__tabClicks = 0;
        document.querySelector(".drawer").style.setProperty("--drawer-h", "300px");
    });
}

async function rect(page) {
    return page.evaluate(() => {
        const r = document.querySelector(".drawer").getBoundingClientRect();
        return { top: r.top, height: r.height, bottom: r.bottom };
    });
}

async function drag(page, fromX, fromY, toY) {
    await reset(page);
    const before = await rect(page);
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX, toY, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    const after = await rect(page);
    const sent = await page.evaluate(() =>
        window.__sent.filter((message) => message.kind === "drawer_resize"),
    );
    return { before, after, sent };
}

for (const viewport of [
    { width: 1280, height: 800, label: "1280x800" },
    { width: 1024, height: 640, label: "1024x640" },
    { width: 400, height: 600, label: "400x600" },
]) {
    const page = await browser.newPage({ viewport });
    await setup(page);

    const geometry = await rect(page);
    const barY = geometry.top + 2;
    await page.evaluate(() => {
        window.__tabClicks = 0;
        document.querySelectorAll(".drawer-tab").forEach((tab) => {
            tab.addEventListener("click", () => {
                window.__tabClicks += 1;
            });
        });
    });
    const hit = (x) =>
        page.evaluate(({ x, y }) => {
            const el = document.elementFromPoint(x, y);
            return { tag: el?.tagName, className: el?.className };
        }, { x, y: barY });

    const center = await hit(Math.round(viewport.width / 2));
    const leftTab = await hit(40);
    const centerDrag = await drag(page, Math.round(viewport.width / 2), barY, 300);
    const tabDrag = await drag(page, 40, barY, 300);

    // A press/release with no movement is a click; a move suppresses the click.
    const clickWithoutMove = await (async () => {
        await reset(page);
        await page.mouse.move(Math.round(viewport.width / 2), barY);
        await page.mouse.down();
        await page.mouse.up();
        await page.waitForTimeout(100);
        return page.evaluate(() => window.__tabClicks);
    })();
    const clickAfterDrag = await (async () => {
        await reset(page);
        await page.mouse.move(Math.round(viewport.width / 2), barY);
        await page.mouse.down();
        await page.mouse.move(Math.round(viewport.width / 2), barY - 2, { steps: 3 });
        await page.mouse.up();
        await page.waitForTimeout(100);
        return page.evaluate(() => window.__tabClicks);
    })();

    // Offset: grab 2 px below the top, move the pointer 2 px up. A correct
    // implementation keeps the top 2 px below the pointer and grows by 2 px.
    await reset(page);
    const offsetBefore = await rect(page);
    await page.mouse.move(Math.round(viewport.width / 2), barY);
    await page.mouse.down();
    await page.mouse.move(Math.round(viewport.width / 2), barY - 2, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    const offsetAfter = await rect(page);

    results[viewport.label] = {
        geometry,
        barCenterHit: center,
        barOverTabHit: leftTab,
        centerDrag,
        tabDrag,
        clickWithoutMove,
        clickAfterDrag,
        offset: {
            grabY: barY,
            pointerAfter: barY - 2,
            before: offsetBefore,
            after: offsetAfter,
            pointerMinusTop: barY - 2 - offsetAfter.top,
        },
    };
    await page.close();
}

writeFileSync(resolve(here, "drag-hit-test-report.json"), JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify(results, null, 2));
await browser.close();
