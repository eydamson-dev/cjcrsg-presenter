// Capture our rendered slide at an exact size, with the same metrics the
// FreeShow capture reports, so the two are directly comparable.
//
// Usage: node capture_render.mjs <html-file> <outdir> <width> <height>

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [htmlPath, outDir, widthArg, heightArg] = process.argv.slice(2);
if (!htmlPath || !outDir) {
    console.error("usage: node capture_render.mjs <html> <outdir> <w> <h>");
    process.exit(2);
}

const width = Number(widthArg) || 1920;
const height = Number(heightArg) || 1080;
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

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
        });
    });
    return { rootSize: [rootRect.width, rootRect.height], texts };
});

await page.locator(".slide").first().screenshot({ path: join(outDir, "ours-slide.png") });
writeFileSync(join(outDir, "ours-metrics.json"), JSON.stringify(metrics, null, 1));
console.log(JSON.stringify(metrics, null, 1));
await browser.close();
