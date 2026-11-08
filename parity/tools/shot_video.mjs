// Screenshot a playing surface, as evidence that decode actually runs.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const outDir = "/tmp/opencode/evidence/experiment-3";
mkdirSync(outDir, { recursive: true });

const pagePath = `${outDir}/video-page.html`;
writeFileSync(
    pagePath,
    `<!doctype html><html><body style="margin:0;background:#000">
     <video id="v" src="file:///tmp/opencode/media/test-1080p.webm" autoplay muted loop
            style="width:100vw;height:100vh;object-fit:contain"></video></body></html>`
);

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`file://${pagePath}`, { waitUntil: "load" });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/playing.png` });
const info = await page.evaluate(() => {
    const v = document.getElementById("v");
    return { currentTime: +v.currentTime.toFixed(2), width: v.videoWidth, height: v.videoHeight };
});
console.log(JSON.stringify(info));
await browser.close();
