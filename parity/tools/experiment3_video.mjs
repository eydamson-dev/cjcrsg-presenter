// Experiment 3: what does the same 1080p clip cost when 1, 2 and 4 surfaces
// play it at once?
//
// Method: for each surface count, measure CPU twice over the same window — once
// with idle pages, once with the clip playing. The difference is the media cost,
// which removes browser launch and page load from the number.
//
// Uses WebM/VP9 because Playwright's Chromium build has no H.264.
//
// Usage: node experiment3_video.mjs <video.webm> <out.json>

import { chromium } from "playwright";
import { writeFileSync, mkdirSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const [videoPath, outPath] = process.argv.slice(2);
if (!videoPath || !outPath) {
    console.error("usage: node experiment3_video.mjs <video> <out.json>");
    process.exit(2);
}

const WARMUP_MS = 4000;
const SAMPLE_MS = 15000;
const COUNTS = [1, 2, 4];
const VIEWPORT = { width: 1280, height: 720 };

const pageFile = join(dirname(outPath), "experiment3-page.html");
mkdirSync(dirname(pageFile), { recursive: true });

function writePage(withVideo) {
    const video = withVideo
        ? `<video id="v" src="file://${videoPath}" autoplay muted loop playsinline></video>`
        : "";
    writeFileSync(
        pageFile,
        `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#000;overflow:hidden}
video{width:100vw;height:100vh;object-fit:contain}</style></head>
<body>${video}</body></html>`
    );
}

/// CPU seconds across every Chromium process of this run, from /proc.
function browserCpuSeconds() {
    let ticks = 0;
    for (const entry of readdirSync("/proc")) {
        if (!/^\d+$/.test(entry)) continue;
        try {
            const cmdline = readFileSync(`/proc/${entry}/cmdline`, "utf8");
            if (!cmdline.includes("ms-playwright/chromium")) continue;
            const stat = readFileSync(`/proc/${entry}/stat`, "utf8");
            const rest = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
            ticks += Number(rest[11]) + Number(rest[12]);
        } catch {
            // exited between listing and reading
        }
    }
    return ticks / 100;
}

async function measure(count, withVideo) {
    writePage(withVideo);
    const browser = await chromium.launch({
        args: ["--autoplay-policy=no-user-gesture-required"],
    });
    const context = await browser.newContext({ viewport: VIEWPORT });
    const pages = [];

    for (let i = 0; i < count; i++) {
        const page = await context.newPage();
        await page.goto(`file://${pageFile}`, { waitUntil: "load" });
        pages.push(page);
    }

    // Wait until every surface is actually playing, not merely loaded.
    if (withVideo) {
        for (const page of pages) {
            await page
                .waitForFunction(() => {
                    const v = document.getElementById("v");
                    return v && v.readyState >= 2 && v.currentTime > 0.5;
                }, { timeout: 15000 })
                .catch(() => {});
        }
    }

    await new Promise((r) => setTimeout(r, WARMUP_MS));

    const cpuBefore = browserCpuSeconds();
    const startTimes = withVideo
        ? await Promise.all(
              pages.map((p) => p.evaluate(() => document.getElementById("v")?.currentTime ?? 0))
          )
        : [];

    await new Promise((r) => setTimeout(r, SAMPLE_MS));

    const cpuAfter = browserCpuSeconds();

    const perPage = [];
    for (const page of pages) {
        if (!withVideo) {
            perPage.push({ dropped: null, total: null, advanced: null });
            continue;
        }
        const quality = await page.evaluate(() => {
            const v = document.getElementById("v");
            const q = v?.getVideoPlaybackQuality?.();
            return q
                ? { total: q.totalVideoFrames, dropped: q.droppedVideoFrames, time: v.currentTime }
                : null;
        });
        perPage.push({
            dropped: quality?.dropped ?? null,
            total: quality?.total ?? null,
            time: quality?.time ?? null,
        });
    }

    await browser.close();

    return {
        cpuSeconds: +(cpuAfter - cpuBefore).toFixed(2),
        perPage,
        startTimes: startTimes.map((t) => +Number(t).toFixed(2)),
    };
}

const results = [];
for (const count of COUNTS) {
    const idle = await measure(count, false);
    const playing = await measure(count, true);
    results.push({
        surfaces: count,
        idleCpu: idle.cpuSeconds,
        videoCpu: playing.cpuSeconds,
        mediaCpu: +(playing.cpuSeconds - idle.cpuSeconds).toFixed(2),
        mediaCpuPerSurface: +((playing.cpuSeconds - idle.cpuSeconds) / count).toFixed(2),
        dropped: playing.perPage.reduce((n, p) => n + (p.dropped ?? 0), 0),
        frames: playing.perPage.reduce((n, p) => n + (p.total ?? 0), 0),
    });
}

rmSync(pageFile, { force: true });

const report = {
    video: videoPath,
    codec: "VP9/WebM (Playwright Chromium has no H.264)",
    sampleSeconds: SAMPLE_MS / 1000,
    viewport: `${VIEWPORT.width}x${VIEWPORT.height}`,
    results,
};
writeFileSync(outPath, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
