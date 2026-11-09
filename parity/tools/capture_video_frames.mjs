// Capture an HTML render twice, to prove a video is actually playing.
//
// Usage: node capture_video_frames.mjs <html-file> <outdir> [viewport]

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [htmlPath, outDir, viewportArg] = process.argv.slice(2);
if (!htmlPath || !outDir) {
    console.error("usage: node capture_video_frames.mjs <html> <outdir> [WxH]");
    process.exit(2);
}

const [width, height] = (viewportArg || "1280x720").split("x").map(Number);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
const errors = [];
page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(String(error)));

await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });

const readState = () =>
    page.evaluate(() => {
        const video = document.querySelector("video");
        if (!video) return null;
        return {
            currentTime: +video.currentTime.toFixed(3),
            paused: video.paused,
            readyState: video.readyState,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            error: video.error ? video.error.message : null,
        };
    });

await page.waitForTimeout(500);
const first = await readState();
await page.screenshot({ path: join(outDir, "frame-500ms.png") });

await page.waitForTimeout(2000);
const second = await readState();
await page.screenshot({ path: join(outDir, "frame-2500ms.png") });

const report = {
    html: htmlPath,
    viewport: [width, height],
    first,
    second,
    advancedSeconds: first && second ? +(second.currentTime - first.currentTime).toFixed(3) : null,
    errors,
};
writeFileSync(join(outDir, "video-report.json"), JSON.stringify(report, null, 2) + "\n");

await browser.close();
console.log(JSON.stringify(report, null, 2));
process.exit(report.advancedSeconds > 0 && report.first?.videoWidth > 0 ? 0 : 1);
