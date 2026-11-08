// Capture a FreeShow slide at full 1920x1080 by resizing the Zoomed container,
// which re-runs its ResizeObserver and lays the slide out at scale 1.
//
// Headless: only the FreeShow remote page is driven, no desktop window.
//
// Usage: node capture_freeshow_fullres.mjs <outdir> [showName]

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [outDir, showName = "Parity Fixture"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--force-device-scale-factor=1"] });
const page = await browser.newPage({ viewport: { width: 2200, height: 1400 } });
await page.goto("http://127.0.0.1:5510/", { waitUntil: "networkidle" });
await wait(2000);
await page.getByText(showName).first().click();
await wait(2500);

// Force the preview container to the reference resolution.
const sized = await page.evaluate(() => {
    const root = document.querySelector(".slide");
    if (!root) return null;
    root.style.width = "1920px";
    root.style.height = "1080px";
    root.style.maxWidth = "none";
    root.style.maxHeight = "none";
    root.style.flex = "none";
    root.style.position = "fixed";
    root.style.left = "0";
    root.style.top = "0";
    root.style.zIndex = "99999";
    return root.getBoundingClientRect().toJSON();
});
await wait(1200);

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
            rel: {
                x: +((r.x - rootRect.x) / rootRect.width).toFixed(4),
                y: +((r.y - rootRect.y) / rootRect.height).toFixed(4),
                w: +(r.width / rootRect.width).toFixed(4),
                h: +(r.height / rootRect.height).toFixed(4),
            },
            px: {
                x: +(r.x - rootRect.x).toFixed(2),
                y: +(r.y - rootRect.y).toFixed(2),
                w: +r.width.toFixed(2),
                h: +r.height.toFixed(2),
            },
        });
    });
    return { rootSize: [rootRect.width, rootRect.height], texts };
});

const target = page.locator(".slide").first();
await target.screenshot({ path: join(outDir, "freeshow-1920x1080.png") });
writeFileSync(join(outDir, "freeshow-1920x1080.json"), JSON.stringify({ sized, metrics }, null, 1));

console.log(JSON.stringify({ sized, rootSize: metrics?.rootSize, texts: metrics?.texts }, null, 1));
await browser.close();
