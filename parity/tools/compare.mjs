// Compare two images at the same size. Reports pixel deltas and a coarse
// structural read (where ink is, as a 3x3 occupancy grid).
//
// Usage: node compare.mjs <a.png> <b.png> [out-diff.png]

import sharp from "sharp";
import { writeFileSync } from "node:fs";

const [aPath, bPath, diffPath] = process.argv.slice(2);
if (!aPath || !bPath) {
    console.error("usage: node compare.mjs <a.png> <b.png> [out-diff.png]");
    process.exit(2);
}

const a = await sharp(aPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const b = await sharp(bPath)
    .resize(a.info.width, a.info.height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

const { width, height } = a.info;
let differing = 0;
let maxDelta = 0;
let total = 0;
const ink = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
];
const inkB = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
];

for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const da = Math.abs(a.data[i] - b.data[i]);
        const dr = Math.abs(a.data[i + 1] - b.data[i + 1]);
        const dg = Math.abs(a.data[i + 2] - b.data[i + 2]);
        const d = Math.max(da, dr, dg);
        if (d > 8) differing++;
        if (d > maxDelta) maxDelta = d;
        total += d;

        const cellY = Math.min(2, Math.floor((y / height) * 3));
        const cellX = Math.min(2, Math.floor((x / width) * 3));
        // "ink" = a pixel noticeably brighter than the black background
        if (a.data[i] > 40) ink[cellY][cellX]++;
        if (b.data[i] > 40) inkB[cellY][cellX]++;
    }
}

const pixels = width * height;
const ratio = (grid) => {
    const sum = grid.flat().reduce((n, v) => n + v, 0) || 1;
    return grid.map((row) => row.map((v) => +(v / sum).toFixed(3)));
};

const result = {
    size: [width, height],
    differingPixelRatio: +(differing / pixels).toFixed(4),
    maxChannelDelta: maxDelta,
    meanChannelDelta: +(total / pixels).toFixed(2),
    inkA: ratio(ink),
    inkB: ratio(inkB),
};

if (diffPath) {
    const out = Buffer.alloc(pixels * 4);
    for (let i = 0; i < pixels; i++) {
        const at = i * 4;
        const d = Math.max(
            Math.abs(a.data[at] - b.data[at]),
            Math.abs(a.data[at + 1] - b.data[at + 1]),
            Math.abs(a.data[at + 2] - b.data[at + 2])
        );
        out[at] = Math.min(255, d * 3);
        out[at + 1] = Math.min(255, d * 3);
        out[at + 2] = Math.min(255, d * 3);
        out[at + 3] = 255;
    }
    writeFileSync(diffPath, await sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer());
    result.diff = diffPath;
}

console.log(JSON.stringify(result, null, 1));
