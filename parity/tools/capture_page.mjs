// Screenshot a page at one or more viewports. Headless: never touches the desktop.
//
// Usage: node capture_page.mjs <url> <outdir> [widthxheight ...]

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [url, outDir, ...sizes] = process.argv.slice(2);
if (!url || !outDir) {
    console.error("usage: node capture_page.mjs <url> <outdir> [WxH ...]");
    process.exit(2);
}

mkdirSync(outDir, { recursive: true });
const viewports = (sizes.length ? sizes : ["390x844", "1280x720"]).map((size) => {
    const [width, height] = size.split("x").map(Number);
    return { width, height, label: size };
});

const browser = await chromium.launch();
const results = [];

for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
    const file = join(outDir, `remote-${viewport.label}.png`);
    await page.screenshot({ path: file });
    results.push({
        viewport: viewport.label,
        status: response?.status(),
        title: await page.title(),
        file,
    });
    await page.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 1));
