// Capture one FreeShow slide plus its layout metrics.
//
// Usage: node capture_freeshow_slide.mjs <outdir> [showName]

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [outDir, showName = "Parity Fixture"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto("http://127.0.0.1:5510/", { waitUntil: "networkidle" });
await wait(2000);
await page.getByText(showName).first().click();
await wait(2500);

const slide = page.locator(".slide").first();
await slide.waitFor({ state: "visible", timeout: 15000 });
const box = await slide.boundingBox();

const metrics = await page.evaluate(() => {
    const root = document.querySelector(".slide");
    if (!root) return null;
    const rootRect = root.getBoundingClientRect();
    const texts = [];
    root.querySelectorAll("*").forEach((el) => {
        if (el.children.length > 0) return;
        const text = (el.textContent || "").trim();
        if (!text) return;
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        texts.push({
            text,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            color: style.color,
            // Positions relative to the slide, so a scaled preview is comparable.
            rel: {
                x: +((r.x - rootRect.x) / rootRect.width).toFixed(4),
                y: +((r.y - rootRect.y) / rootRect.height).toFixed(4),
                w: +(r.width / rootRect.width).toFixed(4),
                h: +(r.height / rootRect.height).toFixed(4),
            },
        });
    });
    return { rootSize: [rootRect.width, rootRect.height], texts };
});

await slide.screenshot({ path: join(outDir, "freeshow-slide.png") });
writeFileSync(join(outDir, "freeshow-metrics.json"), JSON.stringify({ box, metrics }, null, 1));

console.log(JSON.stringify({ box, rootSize: metrics?.rootSize, texts: metrics?.texts }, null, 1));
await browser.close();
