// Deterministic media fixtures for the parity harness.
//
// The reference's media features (a drawer click, a background video, the media
// control strip, "next after media") can only be observed against real files.
// They are generated rather than committed: the commands in this file reproduce
// them exactly, and `observe_reference.mjs` regenerates them into /tmp whenever a
// scenario that needs them is seeded.
//
// Usage:
//   node parity/tools/generate_media.mjs [--out <dir>] [--duration <seconds>] [--force]
//
// Writes (default directory /tmp/opencode/media):
//
//   video-bg.webm  WebM VP9 + Opus, 1280x720, 3 s by default, solid red -> green
//                  -> blue (one third of the clip each), with a quiet 440 Hz
//                  sine (-20 dB). The audio track is not decoration: the
//                  reference detects the end of a background from an
//                  HTMLAudioElement (`videoPlayer.ts:344-360`), so a silent file
//                  would make "next after media" fall back to a ticker.
//   logo.png       320x180 magenta (#ff00ff) with an 8 px white border. An image
//                  background for the click/clear cycle and the "layers" style.
//
// ffmpeg is required at /usr/bin/ffmpeg (override with FFMPEG=/path/to/ffmpeg).
// The script is idempotent: an existing, non-empty file is kept unless --force
// is passed. It prints what it wrote.

import { execFileSync } from "child_process"
import { existsSync, mkdirSync, statSync } from "fs"
import { join, resolve } from "path"
import { fileURLToPath } from "url"

export const MEDIA_VIDEO_NAME = "video-bg.webm"
export const MEDIA_LOGO_NAME = "logo.png"
export const DEFAULT_MEDIA_DIR = "/tmp/opencode/media"
export const DEFAULT_DURATION = 3
export const MEDIA_WIDTH = 1280
export const MEDIA_HEIGHT = 720

// Resolved once so the driver and the CLI agree on the directory even when the
// environment variable is set.
export const MEDIA_DIR = resolve(process.env.PARITY_MEDIA_DIR || DEFAULT_MEDIA_DIR)

const FFMPEG = process.env.FFMPEG || "/usr/bin/ffmpeg"

function runFfmpeg(args, label) {
    try {
        execFileSync(FFMPEG, args, { stdio: ["ignore", "pipe", "pipe"] })
    } catch (err) {
        const stderr = err && err.stderr ? String(err.stderr).trim().split("\n").slice(-8).join("\n") : ""
        const code = err && err.code !== undefined ? ` (exit ${err.code})` : ""
        throw new Error(`${label}: ffmpeg failed${code}${stderr ? `:\n${stderr}` : " with no message"}`)
    }
}

// Three solid colour segments concatenated, plus a sine track of the full length.
// `concat` needs identical size/rate/pixel format on every input, which the
// constant `color` source gives.
function videoArgs(duration, out) {
    const segment = duration / 3
    return [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-f",
        "lavfi",
        "-i",
        `color=c=0xff0000:size=${MEDIA_WIDTH}x${MEDIA_HEIGHT}:rate=30:duration=${segment}`,
        "-f",
        "lavfi",
        "-i",
        `color=c=0x00cc00:size=${MEDIA_WIDTH}x${MEDIA_HEIGHT}:rate=30:duration=${segment}`,
        "-f",
        "lavfi",
        "-i",
        `color=c=0x0000ff:size=${MEDIA_WIDTH}x${MEDIA_HEIGHT}:rate=30:duration=${segment}`,
        "-f",
        "lavfi",
        "-i",
        `sine=frequency=440:sample_rate=48000:duration=${duration}`,
        "-filter_complex",
        "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v];[3:a]volume=0.1[a]",
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-c:v",
        "libvpx-vp9",
        "-b:v",
        "0",
        "-crf",
        "32",
        "-deadline",
        "realtime",
        "-cpu-used",
        "8",
        "-row-mt",
        "1",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "libopus",
        "-b:a",
        "64k",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-shortest",
        "-f",
        "webm",
        out
    ]
}

function logoArgs(out) {
    return [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=0xff00ff:size=320x180:rate=1:duration=1",
        "-vf",
        "drawbox=x=0:y=0:w=iw:h=ih:color=white@1.0:t=8",
        "-frames:v",
        "1",
        "-pix_fmt",
        "rgb24",
        "-f",
        "image2",
        out
    ]
}

/**
 * Generate both fixture files. Throws if ffmpeg is missing or a file does not
 * appear, because a silently absent fixture turns a media observation into an
 * assertion about a show that will not load.
 */
export function generateMedia(options = {}) {
    const dir = resolve(options.dir || MEDIA_DIR)
    const duration = Number(options.duration === undefined ? DEFAULT_DURATION : options.duration)
    const force = options.force === true
    if (!Number.isFinite(duration) || duration < 1) throw new Error(`duration must be at least 1 second, got ${options.duration}`)

    if (!existsSync(FFMPEG)) throw new Error(`ffmpeg is not at ${FFMPEG}; install it or set FFMPEG=/path/to/ffmpeg`)
    mkdirSync(dir, { recursive: true })

    const targets = [
        { name: MEDIA_VIDEO_NAME, path: join(dir, MEDIA_VIDEO_NAME), args: (out) => videoArgs(duration, out) },
        { name: MEDIA_LOGO_NAME, path: join(dir, MEDIA_LOGO_NAME), args: (out) => logoArgs(out) }
    ]

    const files = []
    for (const target of targets) {
        const existed = existsSync(target.path)
        const keep = existed && !force && statSync(target.path).size > 0
        if (!keep) runFfmpeg(target.args(target.path), target.name)
        if (!existsSync(target.path)) throw new Error(`${target.name} was not written to ${target.path}`)
        const bytes = statSync(target.path).size
        if (bytes < 256) throw new Error(`${target.name} is too small to be a real media file (${bytes} bytes)`)
        files.push({ name: target.name, path: target.path, bytes, wrote: !keep, existedBefore: existed })
    }

    return { dir, duration, ffmpeg: FFMPEG, width: MEDIA_WIDTH, height: MEDIA_HEIGHT, files }
}

function parseCli(argv) {
    const options = {}
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === "--out") options.dir = argv[++i] || ""
        else if (arg === "--duration") options.duration = Number(argv[++i])
        else if (arg === "--force") options.force = true
        else if (arg === "--help" || arg === "-h") options.help = true
        else throw new Error(`unknown option: ${arg}`)
    }
    return options
}

function printUsage() {
    console.error(`Usage: node generate_media.mjs [--out <dir>] [--duration <seconds>] [--force]

Writes ${MEDIA_VIDEO_NAME} (VP9+Opus, ${MEDIA_WIDTH}x${MEDIA_HEIGHT}) and
${MEDIA_LOGO_NAME} (320x180) into ${MEDIA_DIR}.`)
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (invokedDirectly) {
    let options
    try {
        options = parseCli(process.argv.slice(2))
    } catch (err) {
        console.error(`generate_media: ${err.message}\n`)
        printUsage()
        process.exitCode = 2
    }
    if (options && options.help) {
        printUsage()
    } else if (options) {
        try {
            const result = generateMedia(options)
            console.log(`media fixtures in ${result.dir} (${result.duration}s clip, ffmpeg ${result.ffmpeg})`)
            for (const file of result.files) {
                console.log(`  ${file.wrote ? "wrote" : "kept "} ${file.path} (${file.bytes} bytes)`)
            }
        } catch (err) {
            console.error(`generate_media: ${err.message}`)
            process.exitCode = 1
        }
    }
}
