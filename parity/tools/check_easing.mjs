// Verify that the generated CSS easing curves are understood by a browser.
//
// Reads the JSON from generate_easing.py, then in Chromium and WebKit:
//  - asks CSS.supports() about each curve;
//  - runs a 1 s animation with it and samples opacity at 25 % and 75 %;
//  - compares the samples with the expected values from the generator.
//
// Usage: node check_easing.mjs <curves.json> <out.json>

import { chromium, webkit } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [curvesPath, outPath] = process.argv.slice(2);
if (!curvesPath || !outPath) {
    console.error("usage: node check_easing.mjs <curves.json> <out.json>");
    process.exit(2);
}

const curves = JSON.parse(readFileSync(curvesPath, "utf8"));
const report = { browsers: {}, passed: true };

for (const [name, launcher] of [
    ["chromium", chromium],
    ["webkit", webkit],
]) {
    let browser;
    try {
        browser = await launcher.launch();
    } catch (error) {
        report.browsers[name] = { available: false, reason: String(error).split("\n")[0] };
        continue;
    }
    const page = await browser.newPage();
    await page.setContent("<div id='target' style='width:100px;height:100px'></div>");

    const results = {};
    for (const [curve, data] of Object.entries(curves)) {
        const result = await page.evaluate(({ css, sampled }) => {
            const supported = CSS.supports("animation-timing-function", css);
            const target = document.getElementById("target");
            const animation = target.animate([{ opacity: 0 }, { opacity: 1 }], {
                duration: 1000,
                easing: css,
                fill: "both",
            });
            animation.pause();
            const at = (time) => {
                animation.currentTime = time;
                return +Number(getComputedStyle(target).opacity).toFixed(3);
            };
            const values = { at25: at(250), at75: at(750) };
            animation.cancel();
            return {
                supported,
                at25: values.at25,
                at75: values.at75,
                expected25: sampled.sample_25,
                expected75: sampled.sample_75,
                error25: +Math.abs(values.at25 - sampled.sample_25).toFixed(3),
                error75: +Math.abs(values.at75 - sampled.sample_75).toFixed(3),
            };
        }, { css: data.css, sampled: data });
        result.pass = result.supported && result.error25 <= 0.03 && result.error75 <= 0.03;
        if (!result.pass) report.passed = false;
        results[curve] = result;
    }

    report.browsers[name] = results;
    await browser.close();
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
process.exit(report.passed ? 0 : 1);
