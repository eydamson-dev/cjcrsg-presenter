// Calibration capture: the same FreeShow slide, twice, and the difference between
// them. Establishes the noise floor before any threshold is chosen.
//
// Usage: NODE_PATH=<freeshow>/node_modules node capture_freeshow.mjs <outdir>

import { chromium } from "playwright";
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2] ?? "/tmp/parity-capture";
mkdirSync(outDir, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function capture(page, path) {
    // The slide preview the remote renders for the selected show.
    const slide = page.locator(".slide").first();
    await slide.waitFor({ state: "visible", timeout: 15000 });
    await slide.screenshot({ path });
    return path;
}

async function diff(a, b) {
    const [da, db] = await Promise.all([
        sharp(a).raw().ensureAlpha().toBuffer({ resolveWithObject: true }),
        sharp(b).raw().ensureAlpha().toBuffer({ resolveWithObject: true }),
    ]);

    if (da.info.width !== db.info.width || da.info.height !== db.info.height) {
        return { comparable: false, sizeA: [da.info.width, da.info.height], sizeB: [db.info.width, db.info.height] };
    }

    let differing = 0;
    let maxDelta = 0;
    let totalDelta = 0;
    for (let i = 0; i < da.data.length; i++) {
        const d = Math.abs(da.data[i] - db.data[i]);
        if (d > 0) differing++;
        if (d > maxDelta) maxDelta = d;
        totalDelta += d;
    }

    const pixels = da.info.width * da.info.height;
    return {
        comparable: true,
        width: da.info.width,
        height: da.info.height,
        pixels,
        differingChannels: differing,
        differingPixelRatio: differing / da.data.length,
        maxChannelDelta: maxDelta,
        meanChannelDelta: totalDelta / da.data.length,
    };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto("http://127.0.0.1:5510/", { waitUntil: "networkidle" });
await wait(2000);
await page.getByText("Parity Fixture").first().click();
await wait(2500);

const first = await capture(page, join(outDir, "slide-a.png"));
await wait(700);
const second = await capture(page, join(outDir, "slide-b.png"));

const result = await diff(first, second);
result.captures = [first, second];

writeFileSync(join(outDir, "calibration.json"), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));

await browser.close();
