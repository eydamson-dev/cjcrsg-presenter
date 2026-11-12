// Observe the pinned FreeShow reference through its own windows.
//
// The reader cannot launch the reference, so an output-area behaviour can only
// become `observed` through a script like this: a fresh profile, named operator
// steps, and a JSON record plus a screenshot after every step. The steps are
// semantic (`present`, `start`, `lock`); the selectors that realise them live
// here and nowhere else, so a caller never learns what the reference's DOM is
// called.
//
// Usage:
//   cd parity/tools && node observe_reference.mjs <outdir> [--scenario <id>]
//
// Scenarios: outputs-basic, stage-multi-output, media-behaviour,
// styles-multi-output, nav-disabled-slides, nav-output-bindings,
// lock-and-layers.
//
// The scratch profile is deleted and reseeded on every run. The reference
// checkout is only read: its package.json and built public/index.html are
// inspected, and Electron is launched with cwd there. Media fixtures are
// generated into /tmp (see generate_media.mjs) and referenced by absolute path
// from a scratch copy of the fixture; the committed fixture is never edited.

import { createRequire } from "module"
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs"
import { homedir } from "os"
import { basename, dirname, join, resolve, sep } from "path"
import { fileURLToPath } from "url"
import { generateMedia, MEDIA_DIR as MEDIA_FIXTURE_DIR, MEDIA_VIDEO_NAME, MEDIA_LOGO_NAME } from "./generate_media.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, "..", "..")
const fixturesDir = join(repo, "parity", "fixtures")
const require = createRequire(join(here, "package.json"))
const { _electron } = require("playwright")

// The pin is what makes a run reproducible. HEAD is checked when the checkout
// exposes it; a different commit is a different reference, not a newer one.
const PINNED_COMMIT = "ff784eb388c7baef60d67e6d4e7c504f4322bca3"
const PROJECT_ID = "parity"
const PROJECT_NAME = "Parity Project"
const TARGET_SHOW = "Parity Fixture"

// Self-contained fixtures. Any fixture whose media paths are all present is
// added too; a fixture with missing media is recorded as skipped rather than
// seeded as a broken show.
const SHOW_FIXTURES = ["parity-three-slides.show", "parity-with-notes.show", "parity-transitions.show"]
const OPTIONAL_MEDIA_FIXTURE = "parity-with-media.show"

const CONTROLLER_VIEWPORT = { width: 1600, height: 900 }
const OUTPUT_WINDOW_TITLE = "Primary"
const FIXTURE_TEXT = ["Verse one", "Verse two", "line one", "line three"]

// The stage/multi-output scenario needs reference state that no committed fixture
// carries: two enabled normal outputs and a stage output bound to a layout.
// Outputs live in `settings.outputs` (src/electron/data/defaults.ts:19-30); stage
// layouts live in `stage.json` (src/electron/data/store.ts:38). Both are seeded
// into the scratch store only; the committed fixtures and the reference checkout
// are never written.
const OUTPUT_BOUNDS = { x: 0, y: 0, width: 1920, height: 1080 }
const OUTPUT_PRIMARY = { id: "primary", name: "Primary", color: "#F0008C" }
const OUTPUT_SECONDARY = { id: "secondary", name: "Secondary", color: "#0A84FF" }
const STAGE_LAYOUT_ID = "parity-stage"
const STAGE_LAYOUT_NAME = "Parity Stage"
const OUTPUT_STAGE = { id: "stage", name: STAGE_LAYOUT_NAME, color: "#555555" }
const STAGE_ITEM_CURRENT = "textCurrent"
const STAGE_ITEM_NEXT = "textNext"

// Media fixtures. `parity-with-media.show` references absolute paths that do not
// exist on a clean machine, so the scratch copy is repointed at files generated
// under /tmp. The layout-slide background is a *media id*, not an object: the
// reference's `showMedia` history handler adds the media entry to `show.media`
// and stores that entry's key in `layouts[layout].slides[i].background`
// (`components/helpers/history.ts:110-142`), and `checkNextAfterMedia` reads
// `layoutSlide.data.background` plus `layoutSlide.data.actions.nextAfterMedia`
// (`components/helpers/showActions.ts:690-716`).
const MEDIA_VIDEO = join(MEDIA_FIXTURE_DIR, MEDIA_VIDEO_NAME)
const MEDIA_LOGO = join(MEDIA_FIXTURE_DIR, MEDIA_LOGO_NAME)
const MEDIA_FOLDER_ID = "parity-media"
const MEDIA_FOLDER_NAME = "Parity Media"
const MEDIA_SHOW_NAME = "Parity With Media"
const MEDIA_VIDEO_MEDIA_ID = "m-bg"
const MEDIA_LOGO_MEDIA_ID = "m-logo"
const MEDIA_OUTPUT_ID = "default"

// Styles. `styles` is a synced setting (`electron/data/defaults.ts:108`,
// `store.ts:35`), so it lives in settings_synced.json. `settings.outputs[id].style`
// names an entry in it; an unknown id falls back to the built-in default
// (`helpers/output.ts:1856-1861`).
const STYLES_SHOW_ID = "fx-styles"
const STYLES_SHOW_NAME = "Parity Styles"
const STYLES_LAYOUT_ID = "lay-parity"
const STYLE_LINES2 = "style-lines2"
const STYLE_43 = "style-43"
const STYLE_NOBG = "style-nobg"
const STYLE_DEFINITIONS = {
    [STYLE_LINES2]: { name: "Two lines", lines: 2 },
    [STYLE_43]: { name: "Four-three", aspectRatio: { width: 4, height: 3 } },
    [STYLE_NOBG]: { name: "No background", layers: ["slide", "overlays"] }
}
// Slide text for the styles fixture. Four lines on slide one so a `lines: 2`
// style pages, and two on slide two so "the slide advanced" is distinguishable
// from "the line window paged".
const STYLES_SLIDE_1 = ["Slide one, line one", "Slide one, line two", "Slide one, line three", "Slide one, line four"]
const STYLES_SLIDE_2 = ["Slide two, line one", "Slide two, line two"]
const OUTPUT_TERTIARY = { id: "tertiary", name: "Tertiary", color: "#30D158" }

// The navigation/output-control slice: disabled slides (show.slides.disabled),
// specific-output bindings (out.multiple.specific), output lock (out.lock) and
// layer order/presence (out.layers). Every fixture below is built in memory and
// written only into the scratch profile; parity/fixtures is never edited.
//
// Every slide is its own group (`group: "."`) so FreeShow's loader keeps it: a
// `group: null` slide that no parent lists in `children` is deleted on load
// (converters/importHelpers.ts:268-290), and a layout that lists a parent *and*
// its children indexes the children twice (helpers/shows.ts:427-458). The
// seeded flags live on the *layout entry* (`layouts[layout].slides[i]`), which
// is what `getLayoutRef` exposes as `ref[i].data` (helpers/shows.ts:426) and
// what `slideCannotBeOutputted` / `setOutput` read.
const NAV_SHOW_ID = "fx-nav"
const NAV_SHOW_NAME = "Parity Nav"
const NAV_LAYOUT_ID = "lay-nav"
const NAV_SLIDE_TEXTS = ["Nav one", "Nav two", "Nav three", "Nav four", "Nav five"]
const NAV_DISABLED_INDICES = [0, 3]

const BIND_SHOW_ID = "fx-bind"
const BIND_SHOW_NAME = "Parity Bindings"
const BIND_LAYOUT_ID = "lay-bind"
const BIND_SLIDE_TEXTS = ["Bind one", "Bind two", "Bind three", "Bind four", "Bind five"]
const BIND_ITEM_ONLY_PRIMARY = "Bind one, primary only"
// Index 3 binds one output by id and the other by its *name*, which exercises
// `resolveOutputId`'s name fallback (helpers/output.ts:74-95). Index 4 binds an
// output that does not exist, which is the page's "sends nothing" edge case
// (multiple-outputs.md:149-151) against the code's active-output fallback
// (helpers/output.ts:151-153).
const BIND_SLIDE_BINDINGS = {
    1: [OUTPUT_PRIMARY.id],
    3: [OUTPUT_PRIMARY.id, OUTPUT_SECONDARY.name],
    4: ["ghost-output"]
}

const LOCKS_SHOW_ID = "fx-locks"
const LOCKS_SHOW_NAME = "Parity Locks"
const LOCKS_LAYOUT_ID = "lay-locks"
const LOCKS_SLIDE_ONE = "Layer one"
const LOCKS_SLIDE_TWO = "Layer two"
const LOCKS_BACKGROUND_MEDIA_ID = "l-bg"
const OVERLAY_UNDER_ID = "ov-under"
const OVERLAY_OVER_ID = "ov-over"
const OVERLAY_UNDER_TEXT = "Underlay text"
const OVERLAY_OVER_TEXT = "Overlay text"

// The two normal outputs the bindings and lock scenarios seed. A stage output is
// deliberately absent: it changes the fan-out (output.ts:699-703) and adds a
// third page to every assertion.
const TWO_OUTPUT_IDS = [OUTPUT_PRIMARY.id, OUTPUT_SECONDARY.id]
const TWO_OUTPUT_NAMES = [OUTPUT_PRIMARY.name, OUTPUT_SECONDARY.name]
// A scenario with no `outputs` key gets the reference's own default output
// (electron/data/defaults.ts:19-30): id "default", name "Primary".
const DEFAULT_OUTPUT_ID = "default"

// The English titles the reference gives the show view's disabled-slide control
// (Icons.svelte:115 -> translateText("actions.enable"), public/lang/en.json:715).
const TITLE_ENABLE_SLIDE = "Enable"

// The English titles the reference gives its own controls. They are the
// observable for state that is not in the DOM (`$dictionary` loaded from
// public/lang/en.json; `run.json` records the locale).
const TITLE_PLAY = "Play"
const TITLE_PAUSE = "Pause"
const TITLE_MUTE = "Mute"
const TITLE_UNMUTE = "Unmute"
const TITLE_LOOP = "Loop"
const TITLE_CLEAR_BACKGROUND_LAYER = "Background"

// Slide text of `parity-three-slides.show`, in layout order.
const SLIDE_ONE = "Verse one, line one"
const SLIDE_ONE_SECOND_LINE = "Verse one, line two"
const SLIDE_TWO = "Verse one, line three"
const SLIDE_THREE = "Verse two, line one"

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const firstLine = (err) => String(err && err.message ? err.message : err).split("\n")[0]
const describeError = (err) => (err instanceof StepFailure ? err.message : `${(err && err.name) || "Error"}: ${firstLine(err)}`)
const pad = (n) => String(n).padStart(2, "0")
const slug = (s) => String(s).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()

class StepFailure extends Error {}

function withTimeout(promise, ms, what) {
    let timer
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// Every check in the current step lands in the step record, so a pass is
// evidence rather than something the log merely claimed.
let currentAssertions = []

function check(condition, message, detail) {
    if (condition) {
        currentAssertions.push({ ok: true, check: message })
        return
    }
    currentAssertions.push({ ok: false, check: message, saw: detail })
    let suffix = ""
    if (detail !== undefined) {
        try {
            suffix = ` (saw ${JSON.stringify(detail)})`
        } catch {
            suffix = " (detail was not serialisable)"
        }
    }
    throw new StepFailure(message + suffix)
}

async function waitFor(what, fn, timeout = 20000, interval = 200) {
    const deadline = Date.now() + timeout
    let lastError = null
    while (Date.now() < deadline) {
        try {
            const value = await fn()
            if (value) return value
        } catch (err) {
            lastError = err
        }
        await wait(interval)
    }
    throw new StepFailure(`${what} did not happen within ${timeout} ms${lastError ? ` (last error: ${firstLine(lastError)})` : ""}`)
}

function writeJson(file, value) {
    writeFileSync(file, JSON.stringify(value, null, 2) + "\n")
}

function makeLog(outDir) {
    const file = join(outDir, "run.log")
    writeFileSync(file, "")
    return (message) => {
        console.log(message)
        try {
            appendFileSync(file, message + "\n")
        } catch {
            // The evidence files are what matter; a log write failure must not stop the run.
        }
    }
}

///////////////////////////////////////////////////////////////////////////////
// CLI and scratch profile
///////////////////////////////////////////////////////////////////////////////

function printUsage() {
    console.error(`Usage: node observe_reference.mjs <outdir> [options]

  <outdir>      write steps.json, run.json, seed.json, run.log and screenshots here
  --scenario    operator sequence to run (default: outputs-basic; known: ${Object.keys(SCENARIOS).join(", ")})
  --store       scratch electron-store directory (default: $FS_STORE or /tmp/opencode/fs-store)
  --data        scratch FreeShow data directory (default: $FS_DATA or /tmp/opencode/fs-data)
  --freeshow    reference checkout (default: $FREESHOW_PATH or ~/projects/reference/freeshow)

The scratch profile is deleted and reseeded on every run. The reference checkout
is never written to.`)
}

function parseArgs(argv) {
    const options = {
        outDir: "",
        scenario: "outputs-basic",
        store: process.env.FS_STORE || "/tmp/opencode/fs-store",
        dataPath: process.env.FS_DATA || "/tmp/opencode/fs-data",
        freeshow: process.env.FREESHOW_PATH || join(homedir(), "projects", "reference", "freeshow"),
        help: false
    }

    const positional = []
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === "--help" || arg === "-h") options.help = true
        else if (arg === "--scenario") options.scenario = argv[++i] || ""
        else if (arg === "--store") options.store = argv[++i] || ""
        else if (arg === "--data") options.dataPath = argv[++i] || ""
        else if (arg === "--freeshow") options.freeshow = argv[++i] || ""
        else if (arg.startsWith("-")) throw new Error(`unknown option: ${arg}`)
        else positional.push(arg)
    }

    if (positional.length > 1) throw new Error(`expected one output directory, got ${positional.length}`)
    options.outDir = positional[0] ? resolve(positional[0]) : ""
    if (options.help) return options
    if (!options.outDir) throw new Error("an output directory is required")
    if (!SCENARIOS[options.scenario]) throw new Error(`unknown scenario "${options.scenario}"; known: ${Object.keys(SCENARIOS).join(", ")}`)
    return options
}

// The profile lives in a delete-and-recreate area. Refusing other paths keeps a
// typo in --store from erasing something a person still needs.
function assertScratchPath(label, value) {
    const abs = resolve(value)
    const roots = ["/tmp", "/var/tmp"].map((root) => root + sep)
    if (!roots.some((root) => abs.startsWith(root))) {
        throw new Error(`${label} must be under /tmp or /var/tmp; refusing to delete ${abs}`)
    }
    return abs
}

function readFixture(file) {
    const path = join(fixturesDir, file)
    const parsed = JSON.parse(readFileSync(path, "utf8"))
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== "string" || !parsed[1] || typeof parsed[1] !== "object") {
        throw new Error(`fixture ${file} is not FreeShow's [id, show] shape`)
    }
    const show = parsed[1]
    const mediaPaths = Object.values(show.media || {})
        .map((media) => media && media.path)
        .filter(Boolean)
    return { file, path, id: parsed[0], name: show.name, show, mediaPaths }
}

// FreeShow stores a group as a parent slide plus its `children` ids. Its loader
// (fixShowIssues) deletes every slide whose `group` is null unless a preceding
// group lists it in `children`. The committed fixtures express groups only as
// `group: null`, so the reference sees a one-slide show and Next leaves the
// show. Repair the profile copy; the committed fixture is not edited.
function repairShowGroups(show) {
    const slides = show.slides || {}
    const repairs = []
    let parent = null

    for (const id of Object.keys(slides)) {
        const slide = slides[id]
        if (!slide || typeof slide !== "object") continue
        if (slide.group !== null) {
            parent = id
            continue
        }
        if (!parent) {
            repairs.push({ child: id, parent: null, action: "left unparented" })
            continue
        }

        const children = Array.isArray(slides[parent].children) ? slides[parent].children : []
        if (!children.includes(id)) {
            slides[parent].children = [...children, id]
            repairs.push({ child: id, parent, action: "added to parent children" })
        }
    }

    return repairs
}

// Two enabled normal outputs plus a stage output bound to one layout. Shapes come
// from the reference's own types and defaults:
//   output entry  src/types/Output.ts:8-39, defaults at src/electron/data/defaults.ts:19-30
//   stage output  src/frontend/components/helpers/output.ts:1202-1229 (`enableStageOutput`)
//   stage layout  src/types/Stage.ts:10-35, items from src/frontend/utils/createData.ts:17-38
// The first `slide_text` item is the current slide; the second is `slideOffset: 1`,
// the next one (src/frontend/components/stage/stage.ts:49-55).
function seedMultiOutput(store) {
    const outputs = {
        [OUTPUT_PRIMARY.id]: {
            enabled: true,
            active: true,
            name: OUTPUT_PRIMARY.name,
            color: OUTPUT_PRIMARY.color,
            bounds: { ...OUTPUT_BOUNDS },
            screen: null,
            style: "default",
            show: {}
        },
        [OUTPUT_SECONDARY.id]: {
            enabled: true,
            active: true,
            name: OUTPUT_SECONDARY.name,
            color: OUTPUT_SECONDARY.color,
            bounds: { ...OUTPUT_BOUNDS },
            screen: null,
            style: "default",
            show: {}
        },
        [OUTPUT_STAGE.id]: {
            enabled: true,
            active: true,
            stageOutput: STAGE_LAYOUT_ID,
            name: OUTPUT_STAGE.name,
            color: OUTPUT_STAGE.color,
            bounds: { ...OUTPUT_BOUNDS },
            screen: null
        }
    }

    const layout = {
        name: STAGE_LAYOUT_NAME,
        disabled: false,
        password: "",
        settings: {},
        items: {
            [STAGE_ITEM_CURRENT]: {
                type: "slide_text",
                style: "width:1870px;height:680px;left:25px;top:25px;font-family: Arial;font-weight:bold;",
                align: ""
            },
            [STAGE_ITEM_NEXT]: {
                type: "slide_text",
                slideOffset: 1,
                lineCount: 2,
                style: "width:1870px;height:330px;left:25px;top:725px;font-family: Arial;font-weight:bold;color:#aaaaaa;",
                align: ""
            }
        },
        itemOrder: [STAGE_ITEM_CURRENT, STAGE_ITEM_NEXT]
    }

    writeJson(join(store, "stage.json"), { [STAGE_LAYOUT_ID]: layout })
    return { outputs, layout }
}

function fixtureMediaPaths(show) {
    return Object.values(show.media || {})
        .map((media) => media && media.path)
        .filter(Boolean)
}

// Rewrite the committed fixture's scratch copy. The committed file keeps its
// `/srv/freeshow/media/...` paths; only the copy the reference loads is repointed.
// Slide one keeps the advance target: its layout entry gets the video as its
// background (a media id) and the next-after-media flag. Slide two is given its
// own background so the reference's "ghost background" rule (a slide without a
// background inherits the previous one's, `showActions.ts:372-383`) does not
// carry the video onto the advance target, which would make the drawer
// click/clear step start from an already-active background.
function transformMediaFixture(show) {
    const media = show.media || {}
    media[MEDIA_VIDEO_MEDIA_ID] = {
        ...(media[MEDIA_VIDEO_MEDIA_ID] || {}),
        path: MEDIA_VIDEO,
        name: (media[MEDIA_VIDEO_MEDIA_ID] && media[MEDIA_VIDEO_MEDIA_ID].name) || "background",
        type: "video",
        muted: true,
        loop: true
    }
    media[MEDIA_LOGO_MEDIA_ID] = {
        ...(media[MEDIA_LOGO_MEDIA_ID] || {}),
        path: MEDIA_LOGO,
        name: (media[MEDIA_LOGO_MEDIA_ID] && media[MEDIA_LOGO_MEDIA_ID].name) || "logo",
        type: "image"
    }
    show.media = media

    const layoutId = (show.settings && show.settings.activeLayout) || Object.keys(show.layouts || {})[0]
    const layout = (show.layouts || {})[layoutId]
    if (!layout || !Array.isArray(layout.slides) || !layout.slides.length) {
        throw new Error(`media fixture has no layout slides under "${layoutId}"`)
    }
    const first = layout.slides[0]
    first.background = MEDIA_VIDEO_MEDIA_ID
    first.actions = { ...(first.actions || {}), nextAfterMedia: true }
    const second = layout.slides[1] || null
    if (second) second.background = MEDIA_LOGO_MEDIA_ID
    // A layout that lists a following slide *and* that slide as a child of the
    // first entry indexes the child first (`helpers/shows.ts:393-460`: each entry's
    // `children` are expanded before the next entry). The child's layout data is
    // the object under the parent entry's `children[childId]`, and that is what
    // `playSlide` reads as `layout[index].data`, so the advance target's own
    // background belongs there.
    const childIds = layout.slides
        .slice(1)
        .map((slide) => slide && slide.id)
        .filter(Boolean)
    first.children = { ...(first.children || {}) }
    for (const childId of childIds) {
        first.children[childId] = { ...(first.children[childId] || {}), background: MEDIA_LOGO_MEDIA_ID }
    }

    return {
        media: {
            [MEDIA_VIDEO_MEDIA_ID]: { path: MEDIA_VIDEO, type: "video", muted: true, loop: true },
            [MEDIA_LOGO_MEDIA_ID]: { path: MEDIA_LOGO, type: "image" }
        },
        layoutId,
        layoutSlides: layout.slides.map((slide, index) => ({
            index,
            id: slide.id,
            background: slide.background === undefined ? null : slide.background,
            actions: slide.actions || null
        })),
        layoutChildren: childIds.map((childId) => ({ parent: first.id, id: childId, background: first.children[childId].background }))
    }
}

function textItem(lines) {
    return {
        style: "top:0;left:0;width:100%;height:100%;",
        align: "text-align: center;",
        lines: lines.map((value) => ({ align: "", text: [{ value, style: "" }] }))
    }
}

// A show with per-output-observable content, built in memory so no committed
// fixture changes. Every slide is its own group (`group: "."`): FreeShow's loader
// deletes `group: null` slides it cannot find in a preceding parent's `children`
// (`converters/importHelpers.ts:271-290`), and a layout that lists a parent *and*
// its children indexes the children twice. Two ungrouped slides give exactly two
// pages.
function createStylesFixture() {
    const show = {
        name: STYLES_SHOW_NAME,
        private: false,
        category: null,
        settings: { activeLayout: STYLES_LAYOUT_ID, template: null },
        timestamps: { created: 1730000000000, modified: null, used: null },
        quickAccess: {},
        meta: {},
        media: { [MEDIA_LOGO_MEDIA_ID]: { path: MEDIA_LOGO, name: "logo", type: "image" } },
        slides: {
            "st-1": { group: ".", color: "", settings: {}, notes: "", items: [textItem(STYLES_SLIDE_1)] },
            "st-2": { group: ".", color: null, settings: {}, notes: "", items: [textItem(STYLES_SLIDE_2)] }
        },
        layouts: {
            [STYLES_LAYOUT_ID]: {
                name: "Default",
                notes: "",
                slides: [{ id: "st-1", background: MEDIA_LOGO_MEDIA_ID }, { id: "st-2" }]
            }
        }
    }
    return { file: "(built in memory)", path: null, id: STYLES_SHOW_ID, name: STYLES_SHOW_NAME, show, mediaPaths: [MEDIA_LOGO], built: true }
}

// Three normal outputs, each bound to a different seeded style. Shapes as in
// seedMultiOutput; the only new field is `style`.
function seedStylesOutputs() {
    return {
        [OUTPUT_PRIMARY.id]: {
            enabled: true,
            active: true,
            name: OUTPUT_PRIMARY.name,
            color: OUTPUT_PRIMARY.color,
            bounds: { ...OUTPUT_BOUNDS },
            screen: null,
            style: STYLE_LINES2,
            show: {}
        },
        [OUTPUT_SECONDARY.id]: {
            enabled: true,
            active: true,
            name: OUTPUT_SECONDARY.name,
            color: OUTPUT_SECONDARY.color,
            bounds: { ...OUTPUT_BOUNDS },
            screen: null,
            style: STYLE_43,
            show: {}
        },
        [OUTPUT_TERTIARY.id]: {
            enabled: true,
            active: true,
            name: OUTPUT_TERTIARY.name,
            color: OUTPUT_TERTIARY.color,
            bounds: { ...OUTPUT_BOUNDS },
            screen: null,
            style: STYLE_NOBG,
            show: {}
        }
    }
}

// A flat show built in memory: one layout, every slide its own group
// (`group: "."`), so the layout index in a scenario is the array index here.
function createFlatShow({ id, name, layoutId, slides, entries, media }) {
    const show = {
        name,
        private: false,
        category: null,
        settings: { activeLayout: layoutId, template: null },
        timestamps: { created: 1730000000000, modified: null, used: null },
        quickAccess: {},
        meta: {},
        media: media || {},
        slides,
        layouts: { [layoutId]: { name: "Default", notes: "", slides: entries } }
    }
    const mediaPaths = Object.values(show.media)
        .map((entry) => entry && entry.path)
        .filter(Boolean)
    return { file: "(built in memory)", path: null, id, name, show, mediaPaths, built: true }
}

// `textItem` fills the whole slide; two items on one slide would sit on top of
// each other. The scenario's assertions read text, not pixels, but a bounded
// height keeps the recorded item boxes meaningful.
function textItemAt(lines, style) {
    return { ...textItem(lines), style }
}

// `Parity Nav`: five flat slides, entries 0 and 3 disabled. Entry 0 makes one
// Space from an empty output test the skip; entry 3 sits between two normal
// entries so "skip" cannot be confused with "end of show".
function createNavFixture() {
    const slides = {}
    const entries = NAV_SLIDE_TEXTS.map((text, index) => {
        const id = `nav-${index + 1}`
        slides[id] = { group: ".", color: "", settings: {}, notes: "", items: [textItem([text])] }
        const entry = { id }
        if (NAV_DISABLED_INDICES.includes(index)) entry.disabled = true
        return entry
    })
    return createFlatShow({ id: NAV_SHOW_ID, name: NAV_SHOW_NAME, layoutId: NAV_LAYOUT_ID, slides, entries })
}

// `Parity Bindings`: five flat slides. Index 0 carries an item bound to
// `primary` beside an unbound one (the item filter, output.ts:1958-1964);
// indices 1/3/4 carry slide-level bindings (id, id+name, stale id).
function createBindingsFixture() {
    const slides = {}
    const entries = BIND_SLIDE_TEXTS.map((text, index) => {
        const id = `bind-${index + 1}`
        const items =
            index === 0
                ? [
                      textItemAt([text], "top:0;left:0;width:100%;height:45%;"),
                      {
                          ...textItemAt([BIND_ITEM_ONLY_PRIMARY], "top:50%;left:0;width:100%;height:45%;"),
                          bindings: [OUTPUT_PRIMARY.id]
                      }
                  ]
                : [textItemAt([text], "top:0;left:0;width:100%;height:100%;")]
        slides[id] = { group: ".", color: "", settings: {}, notes: "", items }
        const entry = { id }
        if (BIND_SLIDE_BINDINGS[index]) entry.bindings = [...BIND_SLIDE_BINDINGS[index]]
        return entry
    })
    return createFlatShow({ id: BIND_SHOW_ID, name: BIND_SHOW_NAME, layoutId: BIND_LAYOUT_ID, slides, entries })
}

// `Parity Locks`: slide 0 has an image background and two overlays (one of them
// `placeUnderSlide`), slide 1 has neither. Everything the layer-order assertion
// needs is on slide 0; slide 1 is the "a locked click must not put this on the
// output" target.
function createLocksFixture() {
    const slides = {
        "lock-1": { group: ".", color: "", settings: {}, notes: "", items: [textItem([LOCKS_SLIDE_ONE])] },
        "lock-2": { group: ".", color: "", settings: {}, notes: "", items: [textItem([LOCKS_SLIDE_TWO])] }
    }
    const entries = [
        { id: "lock-1", background: LOCKS_BACKGROUND_MEDIA_ID, overlays: [OVERLAY_UNDER_ID, OVERLAY_OVER_ID] },
        { id: "lock-2" }
    ]
    const media = { [LOCKS_BACKGROUND_MEDIA_ID]: { path: MEDIA_LOGO, name: "logo", type: "image" } }
    return createFlatShow({ id: LOCKS_SHOW_ID, name: LOCKS_SHOW_NAME, layoutId: LOCKS_LAYOUT_ID, slides, entries, media })
}

// The overlay store (`overlays.json`, portable, src/electron/data/store.ts:39).
// A slide carries its overlays through the *layout entry*: showActions.ts:461-470
// re-sends the overlay store and then `setOutput("overlays", data.overlays, …,
// add = true)` 200 ms after the slide is played. `placeUnderSlide` is
// types/Show.ts:544; it splits the rendered overlays across the underlay and
// overlay slots in Output.svelte:175-176, 434-438 vs 463-467.
function overlayStore() {
    return {
        [OVERLAY_UNDER_ID]: {
            name: "Underlay",
            color: null,
            category: null,
            items: [textItemAt([OVERLAY_UNDER_TEXT], "top:0;left:0;width:100%;height:100%;")],
            placeUnderSlide: true
        },
        [OVERLAY_OVER_ID]: {
            name: "Overlay",
            color: null,
            category: null,
            items: [textItemAt([OVERLAY_OVER_TEXT], "top:0;left:0;width:100%;height:100%;")],
            placeUnderSlide: false
        }
    }
}

// Two normal outputs, both enabled and active. The shape is seedMultiOutput's
// without the stage entry.
function seedTwoOutputs() {
    const outputs = {}
    for (const { id, name, color } of [OUTPUT_PRIMARY, OUTPUT_SECONDARY]) {
        outputs[id] = {
            enabled: true,
            active: true,
            name,
            color,
            bounds: { ...OUTPUT_BOUNDS },
            screen: null,
            style: "default",
            show: {}
        }
    }
    return outputs
}

function seedProfile(options) {
    const store = assertScratchPath("--store", options.store)
    const dataPath = assertScratchPath("--data", options.dataPath)
    if (store === dataPath) throw new Error("--store and --data must be different directories")
    if (dataPath.startsWith(store + sep) || store.startsWith(dataPath + sep)) {
        throw new Error("--store and --data must not contain each other")
    }

    rmSync(store, { recursive: true, force: true })
    rmSync(dataPath, { recursive: true, force: true })
    mkdirSync(store, { recursive: true })
    mkdirSync(join(dataPath, "Shows"), { recursive: true })

    // What the scenario's profile needs, declared on the scenario itself so the
    // default seeds (`outputs-basic`, `stage-multi-output`) stay byte-identical.
    const plan = (SCENARIOS[options.scenario] && SCENARIOS[options.scenario].seed) || {}
    const targetShowName = plan.targetShow || TARGET_SHOW

    const fixtures = SHOW_FIXTURES.map(readFixture)
    const skipped = []

    // Media: generated first, then the fixture's scratch copy is repointed at the
    // generated files. Nothing is written to parity/fixtures. `mediaFiles` covers a
    // scenario that needs the files but not the media fixture (the styles run only
    // needs the logo).
    let mediaFiles = null
    let mediaTransform = null
    if (plan.media || plan.mediaFiles) {
        mediaFiles = generateMedia({})
        const missing = mediaFiles.files.filter((file) => !existsSync(file.path))
        if (missing.length) throw new Error(`generated media is missing: ${missing.map((file) => file.path).join(", ")}`)
    }

    // FreeShow reads absolute media paths. If the machine has them, the media
    // fixture is a normal show; if not, seeding it would put a broken show in
    // front of the reader.
    if (existsSync(join(fixturesDir, OPTIONAL_MEDIA_FIXTURE))) {
        const mediaFixture = readFixture(OPTIONAL_MEDIA_FIXTURE)
        if (plan.media) {
            mediaTransform = transformMediaFixture(mediaFixture.show)
            mediaFixture.mediaPaths = fixtureMediaPaths(mediaFixture.show)
            const missing = mediaFixture.mediaPaths.filter((path) => !existsSync(path))
            if (missing.length) throw new Error(`the media fixture's generated files are missing: ${missing.join(", ")}`)
            fixtures.push(mediaFixture)
        } else {
            const missing = mediaFixture.mediaPaths.filter((path) => !existsSync(path))
            if (missing.length) {
                skipped.push({ file: mediaFixture.file, reason: `missing media: ${missing.join(", ")}` })
            } else {
                fixtures.push(mediaFixture)
            }
        }
    }

    // Styles: a show built in memory, so no committed fixture changes.
    let stylesSeed = null
    if (plan.styles) {
        const stylesFixture = createStylesFixture()
        fixtures.push(stylesFixture)
        stylesSeed = {
            show: { id: stylesFixture.id, name: stylesFixture.name, file: stylesFixture.file },
            slides: [
                { id: "st-1", background: MEDIA_LOGO_MEDIA_ID, lines: STYLES_SLIDE_1 },
                { id: "st-2", background: null, lines: STYLES_SLIDE_2 }
            ],
            styles: STYLE_DEFINITIONS
        }
    }

    // Navigation/output-control slice: one in-memory fixture per scenario, so the
    // committed fixtures keep their shape and the indices are explicit.
    let navFixture = null
    if (plan.nav === "disabled") navFixture = createNavFixture()
    else if (plan.nav === "bindings") navFixture = createBindingsFixture()
    else if (plan.nav === "locks") navFixture = createLocksFixture()
    else if (plan.nav) throw new Error(`unknown nav seed "${plan.nav}"; known: disabled, bindings, locks`)
    if (navFixture) fixtures.push(navFixture)

    const names = new Set()
    const groupRepairs = {}
    for (const fixture of fixtures) {
        if (!fixture.name) throw new Error(`fixture ${fixture.file} has no show name`)
        if (names.has(fixture.name)) throw new Error(`two fixtures are both named "${fixture.name}"`)
        names.add(fixture.name)

        groupRepairs[fixture.id] = repairShowGroups(fixture.show)
        // Write the repaired [id, show] pair into the scratch profile. The
        // committed fixture keeps its original shape.
        writeFileSync(join(dataPath, "Shows", `${fixture.name}.show`), JSON.stringify([fixture.id, fixture.show]))
    }

    // FreeShow's stores use the electron-store cwd (`FS_MOCK_STORE_PATH`), not
    // `config.dataPath`. Seeding projects.json under dataPath is silently ignored,
    // which shows up as an empty Projects panel. All stores go beside config.json.
    const config = {
        dataPath,
        loaded: false,
        maximized: true,
        bounds: { width: CONTROLLER_VIEWPORT.width, height: CONTROLLER_VIEWPORT.height, x: 0, y: 0 }
    }
    const settings = {
        initialized: true,
        // A server starts only when its value is exactly false.
        disabledServers: { remote: false, stage: false, controller: false, output_stream: false },
        outLocked: false
    }
    // A media project item's id is the media *path*: `togglePlayingMedia` resolves
    // whatever is selected with `getMedia(item.id)` (`examples` in
    // `utils/shortcuts.ts:531-542`), and MediaCard's own double-click adds
    // `{ id: path, name, type }` (`drawer/media/MediaCard.svelte:151-157`). `index`
    // is filled in by the project list.
    const projectShows = fixtures.map((fixture) => ({ id: fixture.id }))
    if (plan.media) projectShows.push({ id: MEDIA_VIDEO, name: "background", type: "video" })

    const projects = {
        projects: {
            [PROJECT_ID]: {
                name: PROJECT_NAME,
                created: 1730000000000,
                parent: "/",
                shows: projectShows
            }
        },
        folders: {},
        projectTemplates: {}
    }

    // Only the stage and styles scenarios seed outputs: a seed with three outputs
    // would change what `outputs-basic` observes, and that scenario is committed
    // evidence. The styles scenario also gets a stage-free set of three outputs,
    // each bound to one seeded style.
    const multiOutput = plan.outputs === "stage" ? seedMultiOutput(store) : null
    if (multiOutput) settings.outputs = multiOutput.outputs
    if (plan.outputs === "styles") settings.outputs = seedStylesOutputs()
    if (plan.outputs === "two") settings.outputs = seedTwoOutputs()

    // The Media drawer lists the files in `settings.mediaFolders` (folder shape
    // from `dropActions.ts:608-622`; listing through `Main.READ_FOLDER`).
    if (plan.media) {
        settings.mediaFolders = {
            [MEDIA_FOLDER_ID]: { name: MEDIA_FOLDER_NAME, icon: "folder", path: MEDIA_FIXTURE_DIR }
        }
    }

    writeJson(join(store, "config.json"), config)
    writeJson(join(store, "settings.json"), settings)
    writeJson(join(store, "projects.json"), projects)
    // Portable stores follow the same cwd rule; write empties so the profile is
    // self-describing rather than relying on defaults.
    writeJson(join(store, "themes.json"), {})
    writeJson(join(store, "templates.json"), {})
    // `styles` is a synced setting (`defaultSyncedSettings.styles`,
    // `electron/data/defaults.ts:108`) persisted in settings_synced.json.
    if (plan.styles) writeJson(join(store, "settings_synced.json"), { styles: STYLE_DEFINITIONS })
    // The overlay store the locks fixture's overlays are copied from
    // (`src/electron/data/store.ts:39`, portable).
    if (plan.nav === "locks") writeJson(join(store, "overlays.json"), overlayStore())

    const target = fixtures.find((fixture) => fixture.name === targetShowName)
    if (!target) throw new Error(`fixture named "${targetShowName}" was not seeded`)

    // Read back everything the seed claims. A seed that did not land is the
    // difference between an observation and an assertion about an empty profile.
    const projectCheck = JSON.parse(readFileSync(join(store, "projects.json"), "utf8"))
    const showFiles = readdirSync(join(dataPath, "Shows")).sort()

    let multiOutputRecord = null
    if (multiOutput) {
        const outputsOnDisk = JSON.parse(readFileSync(join(store, "settings.json"), "utf8")).outputs || {}
        const stageOnDisk = JSON.parse(readFileSync(join(store, "stage.json"), "utf8"))
        const outputIds = Object.keys(outputsOnDisk)
        const stageIds = Object.keys(stageOnDisk)
        if (outputIds.length !== 3 || !stageIds.includes(STAGE_LAYOUT_ID)) {
            throw new Error(`the multi-output seed did not land: outputs=${JSON.stringify(outputIds)}, stage layouts=${JSON.stringify(stageIds)}`)
        }
        const layoutOnDisk = stageOnDisk[STAGE_LAYOUT_ID]
        multiOutputRecord = {
            layout: {
                id: STAGE_LAYOUT_ID,
                name: layoutOnDisk.name,
                items: Object.entries(layoutOnDisk.items || {}).map(([id, item]) => ({
                    id,
                    type: item.type || null,
                    slideOffset: Number(item.slideOffset || 0)
                }))
            },
            outputs: Object.entries(outputsOnDisk).map(([id, output]) => ({
                id,
                name: output.name,
                enabled: output.enabled === true,
                active: output.active === true,
                stageOutput: output.stageOutput || null
            })),
            readBack: { settingsOutputs: outputIds, stageLayouts: stageIds }
        }
    }

    let mediaRecord = null
    if (mediaFiles && plan.media) {
        const settingsOnDisk = JSON.parse(readFileSync(join(store, "settings.json"), "utf8"))
        const folders = settingsOnDisk.mediaFolders || {}
        const folder = folders[MEDIA_FOLDER_ID]
        if (!folder || folder.path !== MEDIA_FIXTURE_DIR) {
            throw new Error(`the media folder seed did not land: ${JSON.stringify(folders)}`)
        }
        const showOnDisk = JSON.parse(readFileSync(join(dataPath, "Shows", `${MEDIA_SHOW_NAME}.show`), "utf8"))[1]
        const layoutId = showOnDisk.settings.activeLayout
        const first = showOnDisk.layouts[layoutId].slides[0]
        if (first.background !== MEDIA_VIDEO_MEDIA_ID) {
            throw new Error(`the layout-slide background did not land: ${JSON.stringify(first)}`)
        }
        if (!first.actions || first.actions.nextAfterMedia !== true) {
            throw new Error(`nextAfterMedia did not land on the layout slide: ${JSON.stringify(first)}`)
        }
        mediaRecord = {
            files: mediaFiles.files,
            durationSeconds: mediaFiles.duration,
            ffmpeg: mediaFiles.ffmpeg,
            folder: { id: MEDIA_FOLDER_ID, name: folder.name, path: folder.path },
            media: showOnDisk.media,
            layoutId,
            layoutSlides: showOnDisk.layouts[layoutId].slides.map((slide, index) => ({
                index,
                id: slide.id,
                background: slide.background === undefined ? null : slide.background,
                actions: slide.actions || null
            })),
            projectItem: { id: MEDIA_VIDEO, name: "background", type: "video" },
            transform: mediaTransform
        }
    }

    let stylesRecord = null
    if (plan.styles) {
        const synced = JSON.parse(readFileSync(join(store, "settings_synced.json"), "utf8"))
        const outputsOnDisk = JSON.parse(readFileSync(join(store, "settings.json"), "utf8")).outputs || {}
        const styleIds = Object.keys(synced.styles || {})
        const bindings = Object.entries(outputsOnDisk).map(([id, output]) => ({ id, name: output.name, style: output.style || null }))
        if (styleIds.length !== Object.keys(STYLE_DEFINITIONS).length) {
            throw new Error(`the style seed did not land: ${JSON.stringify(styleIds)}`)
        }
        if (bindings.length !== 3 || bindings.some((entry) => !styleIds.includes(entry.style))) {
            throw new Error(`the output style bindings did not land: ${JSON.stringify(bindings)}`)
        }
        stylesRecord = {
            show: stylesSeed.show,
            slides: stylesSeed.slides,
            styles: synced.styles,
            bindings
        }
    }

    // The navigation slice reads its fixture back from disk too: a layout flag
    // that did not land would turn every later assertion into a statement about
    // an empty profile.
    let navRecord = null
    if (navFixture) {
        const showOnDisk = JSON.parse(readFileSync(join(dataPath, "Shows", `${navFixture.name}.show`), "utf8"))[1]
        const layoutId = showOnDisk.settings && showOnDisk.settings.activeLayout
        const layoutOnDisk = showOnDisk.layouts && showOnDisk.layouts[layoutId]
        if (!layoutOnDisk || !Array.isArray(layoutOnDisk.slides)) {
            throw new Error(`the nav fixture's layout did not land: ${JSON.stringify({ layoutId, layouts: Object.keys(showOnDisk.layouts || {}) })}`)
        }
        const entries = layoutOnDisk.slides.map((slide, index) => ({
            index,
            id: slide.id,
            text: ((showOnDisk.slides[slide.id] || {}).items || [])
                .map((item) => (item.lines || []).map((line) => (line.text || []).map((part) => part.value).join("")).join(" "))
                .join(" | "),
            disabled: slide.disabled === true,
            bindings: slide.bindings || null,
            background: slide.background === undefined ? null : slide.background,
            overlays: slide.overlays || null,
            itemBindings: ((showOnDisk.slides[slide.id] || {}).items || []).map((item) => item.bindings || null)
        }))

        const expectedCount = plan.nav === "locks" ? 2 : 5
        if (entries.length !== expectedCount) {
            throw new Error(`the nav fixture has ${entries.length} layout entries, expected ${expectedCount}: ${JSON.stringify(entries.map((entry) => entry.id))}`)
        }
        if (plan.nav === "disabled") {
            for (const index of NAV_DISABLED_INDICES) {
                if (entries[index].disabled !== true) throw new Error(`slide ${index} did not land disabled: ${JSON.stringify(entries[index])}`)
            }
            for (const index of [1, 2, 4]) {
                if (entries[index].disabled !== false) throw new Error(`slide ${index} is unexpectedly disabled: ${JSON.stringify(entries[index])}`)
            }
        }
        if (plan.nav === "bindings") {
            for (const [index, bindings] of Object.entries(BIND_SLIDE_BINDINGS)) {
                const entry = entries[Number(index)]
                if (JSON.stringify(entry.bindings) !== JSON.stringify(bindings)) {
                    throw new Error(`slide ${index} did not keep its bindings: ${JSON.stringify(entry)}`)
                }
            }
            if (entries[0].bindings !== null) throw new Error(`slide 0 must have no slide-level bindings: ${JSON.stringify(entries[0])}`)
            if (JSON.stringify(entries[0].itemBindings[1]) !== JSON.stringify([OUTPUT_PRIMARY.id])) {
                throw new Error(`slide 0's second item did not keep its item binding: ${JSON.stringify(entries[0].itemBindings)}`)
            }
        }
        if (plan.nav === "locks") {
            if (entries[0].background !== LOCKS_BACKGROUND_MEDIA_ID) {
                throw new Error(`slide 0's background did not land: ${JSON.stringify(entries[0])}`)
            }
            if (JSON.stringify(entries[0].overlays) !== JSON.stringify([OVERLAY_UNDER_ID, OVERLAY_OVER_ID])) {
                throw new Error(`slide 0's overlays did not land: ${JSON.stringify(entries[0])}`)
            }
            if (entries[1].background !== null || entries[1].overlays !== null) {
                throw new Error(`slide 1 must have no background and no overlays: ${JSON.stringify(entries[1])}`)
            }
            const storedMedia = (showOnDisk.media || {})[LOCKS_BACKGROUND_MEDIA_ID]
            if (!storedMedia || storedMedia.path !== MEDIA_LOGO) {
                throw new Error(`the background media entry did not land: ${JSON.stringify(storedMedia)}`)
            }
            if (!existsSync(MEDIA_LOGO)) {
                throw new Error(`the background image the locks fixture points at does not exist: ${MEDIA_LOGO}`)
            }
        }

        let overlaysOnDisk = null
        if (plan.nav === "locks") {
            overlaysOnDisk = JSON.parse(readFileSync(join(store, "overlays.json"), "utf8"))
            if (!overlaysOnDisk[OVERLAY_UNDER_ID] || overlaysOnDisk[OVERLAY_UNDER_ID].placeUnderSlide !== true) {
                throw new Error(`the underlay did not land: ${JSON.stringify(overlaysOnDisk)}`)
            }
            if (!overlaysOnDisk[OVERLAY_OVER_ID] || overlaysOnDisk[OVERLAY_OVER_ID].placeUnderSlide === true) {
                throw new Error(`the overlay did not land without placeUnderSlide: ${JSON.stringify(overlaysOnDisk)}`)
            }
        }

        let outputsOnDisk = null
        if (plan.outputs === "two") {
            outputsOnDisk = JSON.parse(readFileSync(join(store, "settings.json"), "utf8")).outputs || {}
            const ids = Object.keys(outputsOnDisk)
            if (JSON.stringify(sortedNames(ids)) !== JSON.stringify(sortedNames(TWO_OUTPUT_IDS))) {
                throw new Error(`the two-output seed did not land: ${JSON.stringify(ids)}`)
            }
            for (const id of TWO_OUTPUT_IDS) {
                const output = outputsOnDisk[id]
                if (output.enabled !== true || output.active !== true || output.style !== "default") {
                    throw new Error(`output "${id}" is not enabled/active/default: ${JSON.stringify(output)}`)
                }
            }
        }

        navRecord = {
            kind: plan.nav,
            show: { id: navFixture.id, name: navFixture.name, file: navFixture.file },
            layoutId,
            entries,
            overlays: overlaysOnDisk,
            media: plan.nav === "locks" ? { id: LOCKS_BACKGROUND_MEDIA_ID, path: MEDIA_LOGO } : null,
            outputs: outputsOnDisk
                ? Object.entries(outputsOnDisk).map(([id, output]) => ({
                      id,
                      name: output.name,
                      enabled: output.enabled === true,
                      active: output.active === true,
                      style: output.style || null
                  }))
                : null,
            itemOnlyPrimary: plan.nav === "bindings" ? BIND_ITEM_ONLY_PRIMARY : null
        }
    }

    const seededShows = fixtures.map((fixture) => ({
        file: fixture.file,
        id: fixture.id,
        name: fixture.name,
        slides: Object.keys(fixture.show.slides || {}).length,
        mediaPaths: fixture.mediaPaths,
        groupRepairs: groupRepairs[fixture.id]
    }))

    return {
        seededAt: new Date().toISOString(),
        store,
        dataPath,
        settings,
        project: { id: PROJECT_ID, name: PROJECT_NAME, shows: projects.projects[PROJECT_ID].shows },
        projectCheck: { projectCount: Object.keys(projectCheck.projects || {}).length },
        shows: seededShows,
        showFiles,
        skipped,
        multiOutput: multiOutputRecord,
        media: mediaRecord,
        mediaFiles: mediaFiles ? { dir: mediaFiles.dir, duration: mediaFiles.duration, files: mediaFiles.files } : null,
        styles: stylesRecord,
        nav: navRecord,
        targetShow: { name: targetShowName, id: target.id, file: target.file }
    }
}

function inspectReference(freeshow) {
    const path = resolve(freeshow)
    const electron = join(path, "node_modules", "electron", "dist", "electron")
    if (!existsSync(electron)) {
        throw new Error(`Electron is not installed at ${electron}; run npm ci in the reference checkout`)
    }

    const pkg = JSON.parse(readFileSync(join(path, "package.json"), "utf8"))
    const indexHtml = readFileSync(join(path, "public", "index.html"), "utf8")
    // `vite build` alone leaves the renderer pointing at /src/frontend/main.ts;
    // the app then starts with no UI and looks healthy in the log.
    const built = indexHtml.includes("./build/bundle.js") && !indexHtml.includes("/src/frontend/main.ts")
    if (!built) {
        throw new Error("reference is not built: public/index.html does not load ./build/bundle.js (run `npm run build`, not `vite build`)")
    }

    let head = null
    try {
        const gitDir = join(path, ".git")
        if (existsSync(gitDir) && statSync(gitDir).isDirectory()) {
            const headFile = readFileSync(join(gitDir, "HEAD"), "utf8").trim()
            if (headFile.startsWith("ref: ")) {
                const refFile = join(gitDir, headFile.slice(5))
                head = existsSync(refFile) ? readFileSync(refFile, "utf8").trim() : null
            } else {
                head = headFile
            }
        }
    } catch {
        head = null
    }
    if (head && head !== PINNED_COMMIT) {
        throw new Error(`reference checkout is at ${head}, expected the pin ${PINNED_COMMIT}`)
    }

    return { path, version: pkg.version, commit: head, commitKnown: !!head, commitMatchesPin: head === PINNED_COMMIT, built, electron }
}

function attachProcessLog(app, file) {
    try {
        writeFileSync(file, "")
        const child = app.process()
        const write = (chunk) => {
            try {
                appendFileSync(file, chunk)
            } catch {
                // The app can outlive a log write; do not fail the run over it.
            }
        }
        if (child.stdout) child.stdout.on("data", write)
        if (child.stderr) child.stderr.on("data", write)
    } catch {
        // stdout/stderr are a convenience, not evidence.
    }
}

///////////////////////////////////////////////////////////////////////////////
// Reading the two windows
///////////////////////////////////////////////////////////////////////////////

async function findPages(app) {
    const pages = app.windows().filter((page) => !page.isClosed())
    const found = { all: pages, main: null, outputs: [], others: [] }

    for (const page of pages) {
        let kind = "unreadable"
        try {
            kind = await withTimeout(
                page.evaluate(() => {
                    // FreeShow uses `#name` class tokens as context-menu ids, not
                    // HTML ids. The output root is `class="... #output_window"`
                    // (MainOutput.svelte); `main.background` is set for output and
                    // media windows (App.svelte), so it is the fallback marker.
                    // The controller is tested before that fallback: it also draws
                    // a `main.background` while it re-renders, and calling it an
                    // output made "an output window exists" pass on the controller.
                    if (document.querySelector('[class~="#output_window"]')) return "output"
                    if (document.querySelector("#output_window_button")) return "controller"
                    if (document.querySelector("main.background")) return "output"
                    return "other"
                }),
                5000,
                "classifying a window"
            )
        } catch {
            kind = "unreadable"
        }
        if (kind === "output") found.outputs.push(page)
        else if (kind === "controller" && !found.main) found.main = page
        else found.others.push(page)
    }

    return found
}

async function waitForOutputPage(app, timeout = 30000) {
    return waitFor("an output window", async () => (await findPages(app)).outputs[0], timeout)
}

function readController(page) {
    return page.evaluate(() => {
        const clean = (value) =>
            String(value || "")
                .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
                .replace(/\u00a0/g, " ")
                .replace(/[ \t]+/g, " ")
                .replace(/\n\s*\n+/g, "\n")
                .trim()

        const fullText = clean(document.body ? document.body.innerText : "")
        const lockTitles = [...document.querySelectorAll("button[data-title]")]
            .map((button) => button.getAttribute("data-title") || "")
            .filter((title) => title.includes("[Ctrl+L]"))

        const clearRoot = document.querySelector("#previewArea .clear")
        const clearEntries = clearRoot
            ? [...clearRoot.querySelectorAll("button")]
                  .map((button) => ({
                      title: button.getAttribute("data-title") || "",
                      disabled: button.disabled === true,
                      active: button.classList.contains("isActive"),
                      text: clean(button.innerText)
                  }))
                  .filter((entry) => entry.title)
            : []
        // A cleared layer's own button loses its title ("$outLocked || xCleared
        // ? '' : 'clear.…'"), while its disclosure chevron keeps the layer name.
        // Group them so the per-layer entries survive a cleared state.
        const clearGroups = clearRoot
            ? [...clearRoot.querySelectorAll(".combinedButton")].map((group) => {
                  const buttons = [...group.querySelectorAll("button")]
                  const clearButton = buttons[0]
                  const disclosure = buttons[1]
                  return {
                      layer: disclosure ? disclosure.getAttribute("data-title") || "" : "",
                      clearTitle: clearButton ? clearButton.getAttribute("data-title") || "" : "",
                      clearDisabled: clearButton ? clearButton.disabled === true : null,
                      disclosureDisabled: disclosure ? disclosure.disabled === true : null
                  }
              })
            : []

        const projectItems = [...document.querySelectorAll("#projectArea div[id^='show_']")]
            .map((element) => clean(element.innerText))
            .filter(Boolean)
        const activeProjectItems = [...document.querySelectorAll("#projectArea button.isActive")]
            .map((element) => clean(element.innerText))
            .filter(Boolean)
        const projectButtons = [...document.querySelectorAll("#projectsArea button[data-title^='Open project']")]
            .map((element) => clean(element.innerText))
            .filter(Boolean)

        // One tile per enabled output (MultiOutputs.svelte:246-256). The tile's
        // title bar only exists while more than one output is enabled
        // (MultiOutputs.svelte:254-256), and its button carries the output id
        // (OutputPreviewLabel.svelte:49-55 via MaterialButton's `id`). The
        // indicator's `locked` class is the `active` state (line 51); a
        // deactivated output's name is struck through (line 54).
        const previewRoot = document.querySelector("#previewArea")
        const tiles = previewRoot
            ? [...previewRoot.querySelectorAll(".outputPreview")].map((tile) => {
                  const button = tile.querySelector(".outputTitle button")
                  const nameElem = tile.querySelector(".outputTitle p")
                  const indicator = tile.querySelector(".indicator")
                  const decoration = nameElem ? getComputedStyle(nameElem).textDecorationLine || "" : ""
                  return {
                      id: tile.id || null,
                      name: clean(nameElem ? nameElem.innerText : ""),
                      titleBar: !!button,
                      // A stage output's title-bar button has no title
                      // (OutputPreviewLabel.svelte:50: `title={output.stageOutput ? "" : ...}`).
                      buttonTitle: button ? button.getAttribute("data-title") || "" : null,
                      indicatorTitle: indicator ? indicator.getAttribute("data-title") || "" : null,
                      active: indicator ? !indicator.classList.contains("locked") : !decoration.includes("line-through"),
                      struck: decoration.includes("line-through")
                  }
              })
            : []

        const toast = document.querySelector(".toast")

        // The media control strip. MediaControls is rendered *beside* the clear
        // buttons, and only while its layer is the revealed one
        // (Preview.svelte:278-298), so the strip is read from `.clear-btns` and
        // everything inside `.clear` is excluded. The buttons it carries are the
        // only readable form of the player's `muted`/`loop` state: the output's
        // `<video>` is hardcoded muted (`media/Video.svelte:263`).
        const clearBtnsRoot = document.querySelector("#previewArea .clear-btns")
        const stripButtons = clearBtnsRoot
            ? [...clearBtnsRoot.querySelectorAll("button")].filter((button) => !button.closest(".clear"))
            : []
        const stripEntries = stripButtons.map((button) => ({
            title: button.getAttribute("data-title") || "",
            disabled: button.disabled === true
        }))
        const activeClearButton = document.querySelector("#previewArea .clear button.isActive")
        const muteButton = stripEntries.find((entry) => entry.title === "Mute" || entry.title === "Unmute") || null
        const playPauseButton = stripEntries.find((entry) => entry.title === "Play" || entry.title === "Pause") || null
        const loopButton = stripEntries.find((entry) => entry.title.startsWith("Loop")) || null
        const stripName = clearBtnsRoot ? clearBtnsRoot.querySelector(".name") : null
        const media = {
            strip: {
                present: !!(muteButton || playPauseButton || loopButton),
                layer: activeClearButton ? activeClearButton.getAttribute("data-title") || "" : null,
                name: clean(stripName ? stripName.innerText : ""),
                buttons: stripEntries,
                muteTitle: muteButton ? muteButton.title : null,
                muteDisabled: muteButton ? muteButton.disabled : null,
                playPauseTitle: playPauseButton ? playPauseButton.title : null,
                playPauseDisabled: playPauseButton ? playPauseButton.disabled : null,
                loopTitle: loopButton ? loopButton.title : null,
                loopDisabled: loopButton ? loopButton.disabled : null
            }
        }

        // The media drawer: its folder tabs and cards. The card's own `data-title`
        // is "Play" when the media is not on an output and "Clear" when it is
        // (`drawer/Card.svelte:41`), which is the observable for the click/clear
        // half of media.play. The card's path is the Label's `data-title`
        // (`drawer/Label.svelte:60`).
        const mediaCategories = document.querySelector('[class~="#category_media"]')
        const mediaDrawer = {
            open: !!mediaCategories,
            folders: [...document.querySelectorAll('[class~="#category_media_button"]')].map((button) => ({
                name: clean(button.innerText),
                active: button.classList.contains("isActive")
            })),
            cards: [...document.querySelectorAll('[class~="#media_card"]')].map((card) => {
                const label = card.querySelector(".label")
                const title = card.querySelector(".card")
                return {
                    path: label ? label.getAttribute("data-title") || "" : "",
                    label: clean(label ? label.innerText : ""),
                    actionTitle: title ? title.getAttribute("data-title") || "" : "",
                    active: !!card.querySelector(".main.active")
                }
            })
        }

        return {
            text: fullText.slice(0, 6000),
            textLength: fullText.length,
            textTruncated: fullText.length > 6000,
            lockTitles,
            clear: { root: !!clearRoot, entries: clearEntries, groups: clearGroups },
            projectsArea: !!document.querySelector("#projectsArea"),
            projectArea: !!document.querySelector("#projectArea"),
            projectItems,
            activeProjectItems,
            projectButtons,
            preview: { root: !!previewRoot, tiles },
            media,
            mediaDrawer,
            toast: clean(toast ? toast.innerText : "")
        }
    })
}

function readOutput(page) {
    return page.evaluate(() => {
        const clean = (value) =>
            String(value || "")
                .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
                .replace(/\u00a0/g, " ")
                .replace(/[ \t]+/g, " ")
                .replace(/\n\s*\n+/g, "\n")
                .trim()

        const root = document.querySelector('[class~="#output_window"]') || document.querySelector("main.background")
        if (!root) {
            return {
                root: false,
                text: "",
                lines: [],
                rootClass: null,
                mainBackground: null,
                outputId: null,
                stageArea: false,
                videos: [],
                images: [],
                contentBox: null,
                viewportBox: null
            }
        }

        const raw = root.innerText || (document.body ? document.body.innerText : "")
        const lines = raw
            .split(/\n+/)
            .map((line) => clean(line))
            .filter(Boolean)
        const main = document.querySelector("main")
        // `Zoomed` renders the output id as its element id
        // (slide/Zoomed.svelte:156), and both output branches use it: the slide
        // (output/Output.svelte:408) and the stage layout
        // (stage/StageLayout.svelte:164). It is the only place a page names
        // itself, and it is what joins a window to a preview tile.
        const zoomed = document.querySelector(".zoomed[id]")

        const box = (element) => {
            if (!element) return null
            const rect = element.getBoundingClientRect()
            return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
        }
        // Both background kinds are rendered as real elements with class "media":
        // `<video class="media" ... loop={videoData.loop}>` for a video
        // (media/Video.svelte:263) and `<img class="media" ...>` for an image
        // (media/Image.svelte:26-28). `loop` is bound to the player's
        // `videoData.loop`, so it is the reliable DOM signal; the element's
        // `muted` is hardcoded and is recorded only to show that it is not the
        // player's muted state.
        const videos = [...root.querySelectorAll("video.media")].map((video) => ({
            src: video.currentSrc || video.getAttribute("src") || "",
            loop: video.loop === true,
            paused: video.paused === true,
            muted: video.muted === true,
            currentTime: Number(video.currentTime) || 0,
            duration: Number.isFinite(video.duration) ? Number(video.duration) : null,
            readyState: video.readyState,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight
        }))
        const images = [...root.querySelectorAll("img.media")].map((image) => image.currentSrc || image.getAttribute("src") || "")

        return {
            root: true,
            text: clean(raw),
            lines,
            rootClass: root.className,
            mainBackground: main ? getComputedStyle(main).backgroundColor : null,
            outputId: zoomed ? zoomed.id : null,
            // A stage output renders StageLayout (MainOutput.svelte:143-144),
            // whose root is `.stageArea` (stage/StageLayout.svelte:147).
            stageArea: !!document.querySelector(".stageArea"),
            videos,
            images,
            // The slide/content container carries the style's aspect ratio
            // (`Zoomed.svelte:166-179`: `aspect-ratio: resolution.width/height`),
            // so its box is where a 4:3 style is visible without pixels.
            contentBox: box(document.querySelector(".zoomed .slide")),
            viewportBox: box(document.querySelector(".zoomed"))
        }
    })
}

// The show view's slide cards. `#showArea .grid` is the grid
// (show/Slides.svelte:517-543) and each card is a `Slide`, whose content div
// carries `class:disabled` (slide/Slide.svelte:287) and the CSS `opacity: 0.2`
// (Slide.svelte:566-568). The card is `.main > .slide` — NOT any `.slide`, because
// `Zoomed` (slide/Zoomed.svelte:171) renders its own `.slide` container inside the
// card, so a bare `.grid .slide` matches twice per slide. The icon strip is a
// sibling of the content div inside `div.main` (Slide.svelte:276-287) and its
// "Enable" button is Icons.svelte:112-120, which is why the button titles are
// read from the wrapper.
//
// A step-local reader: the controller record stays as the four committed
// scenarios left it.
const SHOW_SLIDE_CARD_SELECTOR = "#showArea .grid > .main > .slide"

function readShowSlides(page) {
    return page.evaluate(() => {
        const clean = (value) =>
            String(value || "")
                .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
                .replace(/\u00a0/g, " ")
                .replace(/[ \t]+/g, " ")
                .replace(/\s*\n\s*/g, " ")
                .trim()

        const area = document.querySelector("#showArea")
        if (!area) return { root: false, grid: false, gridChildCount: 0, cards: [] }
        const grid = area.querySelector(".grid")
        const wrappers = grid ? [...grid.querySelectorAll(":scope > .main")] : []
        const cards = wrappers.map((wrapper, index) => {
            const card = wrapper.querySelector(":scope > .slide")
            const buttons = [...wrapper.querySelectorAll("button[data-title]")].map((button) => button.getAttribute("data-title") || "")
            if (!card) {
                return { index, present: false, classes: "", disabled: null, opacity: null, text: "", hasEnableButton: false, buttons, box: null }
            }
            const rect = card.getBoundingClientRect()
            const style = getComputedStyle(card)
            return {
                index,
                present: true,
                classes: [...card.classList].join(" "),
                disabled: card.classList.contains("disabled"),
                opacity: style.opacity,
                text: clean(card.innerText).slice(0, 200),
                hasEnableButton: buttons.includes("Enable"),
                buttons,
                box: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
            }
        })

        return { root: true, grid: !!grid, gridChildCount: grid ? grid.children.length : 0, cards }
    })
}

// The output page's layer containers, in document order. `Zoomed` renders one
// `.slide` (slide/Zoomed.svelte:166-188) and `Output.svelte:408-485` puts the
// layers inside it: style background, background, effects-under, underlays,
// slide, metadata, effects-over, overlays, attribution, draw. The only stable
// discriminators are the media `src` and the item text (Background.svelte:152
// renders `div.media`, Overlays.svelte:66-71 an unclassed div, and slide and
// overlay items are both `div.item`, Textbox.svelte:815). So this records the
// whole child tree and the ordered marker list; an assertion compares the
// relative order of known markers rather than class names.
function readLayerTree(page) {
    return page.evaluate(() => {
        const clean = (value) =>
            String(value || "")
                .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
                .replace(/\u00a0/g, " ")
                .replace(/[ \t]+/g, " ")
                .replace(/\s*\n\s*/g, " ")
                .trim()

        const zoomed = document.querySelector(".zoomed")
        const slide = zoomed ? zoomed.querySelector(".slide") : null
        if (!slide) {
            return { root: false, markers: [], tree: [], treeTruncated: false, counts: { items: 0, media: 0, mediaWrappers: 0, elements: 0 } }
        }

        const markers = []
        const tree = []
        let elements = 0

        const visit = (element, depth) => {
            if (elements > 400) return
            elements++
            const tag = element.tagName.toLowerCase()
            const classList = element.classList ? [...element.classList] : []
            const entry = { depth, tag, class: classList.join(" "), text: null, src: null }
            if (tag === "img" || tag === "video") entry.src = element.currentSrc || element.getAttribute("src") || null
            if (classList.includes("item")) entry.text = clean(element.innerText).slice(0, 120)
            if (depth > 0) tree.push(entry)

            if ((tag === "img" || tag === "video") && classList.includes("media")) {
                markers.push({ kind: "media", tag, src: entry.src })
            }
            if (classList.includes("item")) markers.push({ kind: "item", text: entry.text })

            for (const child of element.children) visit(child, depth + 1)
        }

        visit(slide, 0)

        return {
            root: true,
            markers,
            tree: tree.slice(0, 240),
            treeTruncated: elements > 400,
            counts: {
                items: markers.filter((marker) => marker.kind === "item").length,
                media: markers.filter((marker) => marker.kind === "media").length,
                // Background.svelte nests its wrapper and its fading layers in
                // `div.media`, so this count is not the number of backgrounds.
                mediaWrappers: slide.querySelectorAll("div.media").length,
                elements
            }
        }
    })
}

async function windowInventory(app, pages) {
    const list = []
    for (const page of pages) {
        let info
        try {
            info = await withTimeout(
                page.evaluate(() => ({
                    documentTitle: document.title,
                    readyState: document.readyState,
                    hasController: !!document.querySelector("#output_window_button"),
                    hasOutput: !!document.querySelector('[class~="#output_window"]') || !!document.querySelector("main.background"),
                    bodyChars: (document.body ? document.body.innerText : "").length
                })),
                5000,
                "reading a window's title"
            )
        } catch (err) {
            info = { error: firstLine(err) }
        }
        list.push({ url: page.url(), ...info })
    }

    let browserWindows = []
    try {
        browserWindows = await withTimeout(
            app.evaluate(({ BrowserWindow }) =>
                BrowserWindow.getAllWindows()
                    .filter((window) => !window.isDestroyed())
                    .map((window) => ({
                        id: window.id,
                        title: window.getTitle(),
                        visible: window.isVisible(),
                        // `visible` alone cannot tell "FreeShow hid it" from "FreeShow
                        // never created a real window": capture-only outputs are
                        // offscreen, and an offscreen page still renders and still
                        // screenshots. Record both.
                        offscreen: window.webContents.isOffscreen(),
                        minimized: window.isMinimized(),
                        focused: window.isFocused(),
                        opacity: window.getOpacity(),
                        alwaysOnTop: window.isAlwaysOnTop(),
                        bounds: window.getBounds(),
                        url: window.webContents.getURL()
                    }))
            ),
            10000,
            "reading the OS windows"
        )
    } catch (err) {
        browserWindows = [{ error: firstLine(err) }]
    }

    return { pages: list, browserWindows }
}

function settlePage(page, timeout = 8000) {
    return page.evaluate(async (timeoutMs) => {
        const start = performance.now()
        await document.fonts.ready
        const isInfinite = (animation) => {
            try {
                const timing = animation.effect && animation.effect.getComputedTiming ? animation.effect.getComputedTiming() : null
                return !!timing && timing.iterations === Infinity
            } catch {
                return false
            }
        }
        const finiteRunning = () => document.getAnimations().filter((animation) => animation.playState === "running" && !isInfinite(animation))
        while (finiteRunning().length && performance.now() - start < timeoutMs) {
            await new Promise((resolve) => setTimeout(resolve, 50))
        }
        // Two frames so the compositor has painted the settled state.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const infinite = document
            .getAnimations()
            .filter((animation) => animation.playState === "running" && isInfinite(animation))
            .map((animation) => String(animation.animationName || "unknown"))
        return {
            // An endless status wave never "finishes"; requiring it would fail a
            // correct step. Finite transitions are what must complete.
            settled: finiteRunning().length === 0,
            runningAnimations: finiteRunning()
                .map((animation) => String(animation.animationName || animation.transitionProperty || "unknown"))
                .slice(0, 10),
            infiniteAnimations: [...new Set(infinite)].slice(0, 10),
            fonts: document.fonts.status
        }
    }, timeout)
}

async function settleAll(ctx) {
    const found = await findPages(ctx.app)
    const main = found.main || ctx.win
    const results = {}

    if (main) {
        results.controller = await withTimeout(settlePage(main), 12000, "settling the controller").catch((err) => ({
            settled: false,
            error: firstLine(err)
        }))
    }
    for (let i = 0; i < found.outputs.length; i++) {
        results[`output${i}`] = await withTimeout(settlePage(found.outputs[i]), 12000, "settling an output").catch((err) => ({
            settled: false,
            error: firstLine(err)
        }))
    }

    return results
}

async function captureState(ctx) {
    const found = await findPages(ctx.app)
    const inventory = await windowInventory(ctx.app, found.all)
    const main = found.main || ctx.win

    let controller = { error: "controller window not found" }
    if (main) {
        controller = await withTimeout(readController(main), 10000, "reading the controller").catch((err) => ({ error: firstLine(err) }))
    }

    // Every output page, not just the first. `output` below keeps its original
    // meaning (the first page found) so `outputs-basic` reads exactly as before;
    // `outputs` is the per-output view the multi-output scenario needs.
    const pageStates = []
    for (const page of found.outputs) {
        const state = await withTimeout(readOutput(page), 10000, "reading an output").catch((err) => ({ error: firstLine(err) }))
        pageStates.push({ url: page.url(), ...state })
    }

    const output = found.outputs[0] || null
    const outputState = pageStates[0] || null

    const lockTitle = (controller.lockTitles || [])[0] || null
    // The Present control's own state: a present that never flips it is still a
    // present, and the record has to show which of the two happened.
    const presentButton = main ? await readPresentState(main).catch(() => null) : null

    return {
        timestamp: new Date().toISOString(),
        windowCount: found.all.length,
        windows: inventory.pages,
        browserWindows: inventory.browserWindows,
        lockTitle,
        controller: {
            present: !!main,
            text: controller.text || "",
            textLength: controller.textLength || 0,
            textTruncated: !!controller.textTruncated,
            lockTitles: controller.lockTitles || [],
            lockTitle,
            clear: controller.clear || { root: false, entries: [], groups: [] },
            projectsArea: !!controller.projectsArea,
            projectArea: !!controller.projectArea,
            projectItems: controller.projectItems || [],
            activeProjectItems: controller.activeProjectItems || [],
            projectButtons: controller.projectButtons || [],
            preview: controller.preview || { root: false, tiles: [] },
            media: controller.media || { strip: { present: false, layer: null, buttons: [] } },
            mediaDrawer: controller.mediaDrawer || { open: false, folders: [], cards: [] },
            toast: controller.toast || "",
            presentButton,
            error: controller.error || null
        },
        output: output
            ? {
                  present: true,
                  url: output.url(),
                  text: outputState.text || "",
                  lines: outputState.lines || [],
                  mainBackground: outputState.mainBackground || null,
                  rootClass: outputState.rootClass || null,
                  error: outputState.error || null
              }
            : { present: false, text: null, lines: [] },
        outputs: pageStates
            .map((page) => ({
                id: page.outputId || null,
                url: page.url,
                text: page.text || "",
                lines: page.lines || [],
                stageArea: !!page.stageArea,
                rootClass: page.rootClass || null,
                mainBackground: page.mainBackground || null,
                videos: page.videos || [],
                images: page.images || [],
                contentBox: page.contentBox || null,
                viewportBox: page.viewportBox || null,
                error: page.error || null
            }))
            .sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")))
    }
}

///////////////////////////////////////////////////////////////////////////////
// Screenshots
///////////////////////////////////////////////////////////////////////////////

async function shoot(ctx, page, file, windowTitle) {
    try {
        await withTimeout(page.screenshot({ path: file, timeout: 15000 }), 20000, "a Playwright screenshot")
        return { ok: true, method: "playwright" }
    } catch (err) {
        const firstError = firstLine(err)
        if (!windowTitle) return { ok: false, error: firstError }

        // FreeShow's output windows are frameless panel windows. Playwright has
        // failed to capture one before; ask the main process for the pixels and
        // record which route produced the file.
        try {
            const base64 = await withTimeout(
                ctx.app.evaluate(async ({ BrowserWindow }, title) => {
                    const windows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed() && window.isVisible())
                    let target = windows.find((window) => window.getTitle() === title)
                    if (!target) target = windows.find((window) => window.getTitle() !== "FreeShow")
                    if (!target) return ""
                    const image = await target.webContents.capturePage()
                    return image.isEmpty() ? "" : image.toPNG().toString("base64")
                }, windowTitle),
                20000,
                "a main-process capturePage"
            )
            if (!base64) return { ok: false, error: `${firstError}; capturePage returned no image` }
            writeFileSync(file, Buffer.from(base64, "base64"))
            return { ok: true, method: "main-process capturePage" }
        } catch (fallbackError) {
            return { ok: false, error: `${firstError}; fallback failed: ${firstLine(fallbackError)}` }
        }
    }
}

async function takeScreenshots(ctx, index, name) {
    const prefix = `${pad(index)}-${slug(name)}`
    const result = { controller: null, output: null, outputMethod: null, errors: [] }
    const found = await findPages(ctx.app).catch(() => ({ main: ctx.win, outputs: [] }))

    const main = found.main || ctx.win
    if (main) {
        // Park the pointer so a hover tooltip does not sit in the screenshot.
        await main.mouse.move(1, 1).catch(() => {})
        await wait(120)
        const file = join(ctx.outDir, `${prefix}-controller.png`)
        const shot = await shoot(ctx, main, file, null)
        if (shot.ok) result.controller = basename(file)
        else result.errors.push(`controller: ${shot.error}`)
    }

    const output = found.outputs[0]
    if (output) {
        const file = join(ctx.outDir, `${prefix}-output.png`)
        let shot = await shoot(ctx, output, file, OUTPUT_WINDOW_TITLE)
        if (!shot.ok) {
            // FreeShow can replace the output window while its capture surface
            // starts up; the page handle found a moment ago may already be
            // closed. Re-find it and try once more before recording a failure.
            result.outputRetried = true
            await wait(600)
            const retry = await findPages(ctx.app).catch(() => ({ outputs: [] }))
            if (retry.outputs[0]) shot = await shoot(ctx, retry.outputs[0], file, OUTPUT_WINDOW_TITLE)
        }
        if (shot.ok) {
            result.output = basename(file)
            result.outputMethod = shot.method
        } else {
            result.errors.push(`output: ${shot.error}`)
        }
    }

    // Every further output window is captured too, under its own file. They are
    // additional evidence only: `outputs-basic` has one output and its record is
    // unchanged.
    const extraOutputs = found.outputs.slice(1)
    if (extraOutputs.length) {
        result.otherOutputs = []
        for (let i = 0; i < extraOutputs.length; i++) {
            const file = join(ctx.outDir, `${prefix}-output-${i + 2}.png`)
            const shot = await shoot(ctx, extraOutputs[i], file, null)
            result.otherOutputs.push({ file: basename(file), ok: shot.ok, method: shot.method || null, error: shot.error || null })
            if (!shot.ok) result.errors.push(`${basename(file)}: ${shot.error}`)
        }
    }

    return result
}

///////////////////////////////////////////////////////////////////////////////
// Step plumbing
///////////////////////////////////////////////////////////////////////////////

function outputText(state) {
    if (!state || !state.output || !state.output.present) return ""
    return String(state.output.text || "")
}

function hasFixtureText(text) {
    const value = String(text || "")
    return FIXTURE_TEXT.some((phrase) => value.includes(phrase))
}

async function readOutputNow(ctx) {
    const found = await findPages(ctx.app)
    const output = found.outputs[0]
    if (!output) return null
    return readOutput(output).catch(() => null)
}

// Clearing can be instant or run a transition. Poll rather than sample once:
// otherwise a 500 ms fade is indistinguishable from a blocked Escape.
async function waitForOutputCleared(ctx, timeout) {
    const deadline = Date.now() + timeout
    let last = null
    while (Date.now() < deadline) {
        last = await readOutputNow(ctx)
        if (last && last.root && !hasFixtureText(last.text)) return { cleared: true, state: last }
        await wait(150)
    }
    return { cleared: false, state: last }
}

async function waitForOutputText(app, predicate, timeout) {
    const deadline = Date.now() + timeout
    let last = ""
    while (Date.now() < deadline) {
        const found = await findPages(app)
        const output = found.outputs[0]
        if (output) {
            const state = await readOutput(output).catch(() => null)
            last = state ? state.text : last
            if (state && predicate(state.text)) return state
        }
        await wait(200)
    }
    throw new StepFailure(`output text did not match within ${timeout} ms (last text: ${JSON.stringify(last)})`)
}

async function waitForLocator(locator, what, timeout = 20000) {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
        const count = await locator.count().catch(() => 0)
        if (count > 0) return locator.first()
        await wait(200)
    }
    throw new StepFailure(`${what} was not found within ${timeout} ms`)
}

async function runStep(ctx, step) {
    const index = ctx.steps.length + 1
    const startedAt = new Date().toISOString()
    const started = Date.now()
    let record = { index, step: step.name, purpose: step.purpose, status: "running", startedAt }
    let extra = {}
    currentAssertions = []

    try {
        extra = (await step.run(ctx)) || {}
        const settled = await settleAll(ctx)
        const state = await captureState(ctx)
        record = { ...record, ...state, ...extra, settled }
        for (const [target, result] of Object.entries(settled)) {
            check(result && result.settled !== false, `${target} animations reached completion`, result)
        }
        if (step.verify) step.verify(record, ctx)
        record.status = "ok"
    } catch (err) {
        const state = await captureState(ctx).catch(() => ({}))
        record = { ...record, ...state, ...extra }
        record.status = "failed"
        record.error = describeError(err)
        if (err instanceof StepFailure && !record.error.includes("saw ")) {
            record.error = err.message
        }
    } finally {
        if (!record.timestamp) record.timestamp = new Date().toISOString()
        record.assertions = currentAssertions
        record.screenshot = await takeScreenshots(ctx, index, step.name).catch((err) => ({ controller: null, output: null, errors: [`screenshots failed: ${firstLine(err)}`] }))
        record.durationMs = Date.now() - started
        record.finishedAt = new Date().toISOString()

        ctx.steps.push(record)
        writeJson(join(ctx.outDir, `${pad(index)}-${slug(step.name)}.json`), record)
        writeJson(join(ctx.outDir, "steps.json"), {
            scenario: ctx.options.scenario,
            startedAt: ctx.startedAt,
            updatedAt: new Date().toISOString(),
            steps: ctx.steps
        })
        logStep(record)
    }

    return record
}

function logStep(record) {
    const status = record.status === "ok" ? "ok  " : "FAIL"
    const text = record.output && record.output.present ? JSON.stringify((record.output.text || "").slice(0, 60)) : "-"
    const extra = Array.isArray(record.outputs) && record.outputs.length > 1 ? ` outputs=${record.outputs.length}` : ""
    console.log(`[${pad(record.index)}] ${record.step.padEnd(18)} ${status} windows=${record.windowCount ?? "?"}${extra} lock=${JSON.stringify(record.lockTitle)} output=${text}`)
    if (record.status !== "ok") console.error(`       ${record.error}`)
    if (record.screenshot && record.screenshot.errors && record.screenshot.errors.length) {
        console.error(`       screenshot: ${record.screenshot.errors.join(" | ")}`)
    }
}

function printSummary(ctx) {
    const failed = ctx.steps.filter((step) => step.status !== "ok")
    const screenshotErrors = ctx.steps.flatMap((step) => (step.screenshot && step.screenshot.errors ? step.screenshot.errors.map((error) => `${step.step}: ${error}`) : []))
    console.log("")
    for (const step of ctx.steps) {
        const text = step.output && step.output.present ? (step.output.text || "").replace(/\s+/g, " ").slice(0, 70) : "-"
        console.log(`${pad(step.index)}  ${step.step.padEnd(18)} ${String(step.windowCount).padEnd(8)} ${String(step.lockTitle || "-").padEnd(28)} ${text}`)
    }
    console.log("")
    console.log(`${ctx.steps.length} steps, ${failed.length} failed; evidence in ${ctx.outDir}`)
    if (failed.length) console.log(`failed: ${failed.map((step) => step.step).join(", ")}`)
    if (screenshotErrors.length) console.log(`screenshot problems: ${screenshotErrors.length} (recorded in each step)`)
}

///////////////////////////////////////////////////////////////////////////////
// Output-window basics
///////////////////////////////////////////////////////////////////////////////

async function stepReady(ctx) {
    const project = ctx.win
        .locator('#projectsArea button[data-title^="Open project"]')
        .filter({ hasText: PROJECT_NAME })
    await waitForLocator(project, `the seeded project "${PROJECT_NAME}" in the left panel`, 45000)

    // Close a startup popup without touching the output: nothing is presented yet.
    await ctx.win.keyboard.press("Escape")
    await wait(300)
}

function verifyReady(state) {
    check(state.controller.present, "the controller window was found", state.windows)
    check(state.controller.projectsArea, "the left panel is the project list", state.controller.projectButtons)
    check(
        state.controller.projectButtons.some((text) => text.includes(PROJECT_NAME)),
        `the seeded project "${PROJECT_NAME}" is listed (the profile's projects.json is read from the store path)`,
        state.controller.projectButtons
    )
    check(!state.output.present, "no output window is open before presenting", state.windows)
    check(state.lockTitle === "Lock output [Ctrl+L]", "the lock control starts as Lock output [Ctrl+L]", state.lockTitle)
}

// FreeShow raises a startup popup on a machine without hardware acceleration or
// hardware video decoding. It is a modal across the controller, and while it is
// up a pointer click never dispatches while keyboard steps still work, so a
// swallowed click reads as a wrong selector. Escape closes it.
const STARTUP_POPUPS = ["Graphics acceleration is unavailable", "Hardware video decoding is unavailable"]

async function dismissStartupPopups(win, log) {
    const bodyText = () => win.evaluate(() => document.body.innerText).catch(() => "")
    const found = []
    for (const marker of STARTUP_POPUPS) {
        if (!(await bodyText()).includes(marker)) continue
        found.push(marker)
        await win.keyboard.press("Escape")
        await wait(400)
    }
    if (!found.length) return null
    const after = await bodyText()
    const remaining = found.filter((marker) => after.includes(marker))
    log(`startup popup: dismissed ${found.length} (${found.join("; ")})${remaining.length ? `; STILL UP: ${remaining.join("; ")}` : ""}`)
    return { dismissed: found, remaining }
}

// The Present button is a toggle whose state is the `on` class. Clicking it
// while it is already on presents *off*, and the output page survives that; the
// run then records a present it did not cause and no window on the display.
async function readPresentState(win) {
    return win.evaluate(() => {
        const button = document.querySelector("#output_window_button")
        if (!button) return null
        const classes = String(button.className || "").split(/\s+/)
        return {
            on: classes.includes("on"),
            className: String(button.className || ""),
            title: button.getAttribute("data-title") || button.getAttribute("title") || "",
            text: (button.textContent || "").trim().slice(0, 40)
        }
    })
}

// A pointer click is only reliable with no startup popup over the controller.
// Keyboard steps do not need this; they reach the page even under the modal.
async function clickUnobstructed(ctx, target, timeout = 20000) {
    const popups = await dismissStartupPopups(ctx.win, ctx.log)
    if (popups) ctx.popupsSeen = (ctx.popupsSeen || 0) + popups.dismissed.length
    if (typeof target === "string") await ctx.win.click(target, { timeout })
    else await target.click({ timeout })
    if (ctx.popupsSeen) ctx.log(`popups dismissed so far: ${ctx.popupsSeen}`)
}

async function stepPresent(ctx) {
    ctx.popups = await dismissStartupPopups(ctx.win, ctx.log)
    const before = await readPresentState(ctx.win)
    if (!before) throw new StepFailure("the Present button is not in the controller")
    if (before.on) throw new StepFailure(`the output was already presenting before the step: ${JSON.stringify(before)}`)
    // One click, the operator's own action. The control is a state-dependent
    // toggle (helpers/output.ts: `state = force || !currentOutputState`), and on
    // a single display the reference creates the output window and leaves it
    // hidden either way — so the click is asserted, the control's answer is
    // recorded, and neither is dressed up as "a window appeared".
    await clickUnobstructed(ctx, "#output_window_button", 15000)
    await waitForOutputPage(ctx.app, 45000)
    // The page can appear while it is still loading and re-render before it is
    // an output again, so a single read after a fixed wait says nothing. Require
    // three consecutive reads of a loaded output page.
    const deadline = Date.now() + 30000
    let stable = 0
    while (Date.now() < deadline && stable < 3) {
        const output = (await findPages(ctx.app)).outputs[0]
        const ready = output ? await output.evaluate(() => document.readyState).catch(() => "") : ""
        stable = output && ready === "complete" ? stable + 1 : 0
        await wait(300)
    }
    if (stable < 3) throw new StepFailure("the output page never became a loaded, stable window after the present click")
    const after = await readPresentState(ctx.win)
    if (!after) throw new StepFailure("the Present button disappeared after the click")
    if (after.on !== true) ctx.log(`present: the button still reports off after the click (${JSON.stringify(after)})`)
}

function verifyPresent(state) {
    check(state.output.present, "the output page exists", state.windows)
    check(state.browserWindows.length >= 2, "a second OS window exists", state.browserWindows)
    const output = state.browserWindows.find((window) => window.title === OUTPUT_WINDOW_TITLE)
    check(!!output, `an OS window titled "${OUTPUT_WINDOW_TITLE}" exists`, state.browserWindows)
    if (!output) return
    // A page that exists is not a window that is on screen, and neither of those
    // is an offscreen surface. All three are recorded; only the last is asserted,
    // because on one display the reference presents to a window it keeps hidden
    // (observed 2026-11-11 on a GPU desktop and a GPU-less X11 workspace alike).
    check(output.offscreen === false, "the output is a real window in the process, not an offscreen surface", {
        visible: output.visible,
        offscreen: output.offscreen,
        minimized: output.minimized,
        bounds: output.bounds,
        buttonOn: state.controller.presentButton && state.controller.presentButton.on
    })
}

async function stepOpenProject(ctx) {
    const project = ctx.win
        .locator('#projectsArea button[data-title^="Open project"]')
        .filter({ hasText: PROJECT_NAME })
    const button = await waitForLocator(project, `the project "${PROJECT_NAME}"`, 20000)
    await clickUnobstructed(ctx, button)

    // The show list renders before the show metadata arrives; wait for the name
    // so the next step clicks a project item that is fully known.
    const showItem = ctx.win.locator(`#projectArea div[id="show_${ctx.seed.targetShow.id}"]`)
    await waitForLocator(showItem, `the show "${ctx.seed.targetShow.name}" in the project`, 20000)
    await waitFor(
        `the name of "${ctx.seed.targetShow.name}" to load in the project`,
        async () => (await showItem.innerText()).includes(ctx.seed.targetShow.name),
        20000
    )
}

function verifyOpenProject(state, ctx) {
    const name = ctx.seed.targetShow.name
    check(state.controller.projectArea, "the project's show list opened", state.controller.projectItems)
    check(
        state.controller.projectItems.some((text) => text.includes(name)),
        `the project lists the show "${name}"`,
        state.controller.projectItems
    )
}

async function stepOpenShow(ctx) {
    const show = ctx.win.locator(`#projectArea div[id="show_${ctx.seed.targetShow.id}"] button`).first()
    const button = await waitForLocator(show, `the show "${ctx.seed.targetShow.name}" in the project`, 20000)
    await clickUnobstructed(ctx, button)
    // ShowButton.click loads the show asynchronously before it can be played.
    await wait(800)
}

function verifyOpenShow(state, ctx) {
    const name = ctx.seed.targetShow.name
    check(state.controller.projectArea, "the project is still open", state.controller.projectItems)
    check(
        state.controller.activeProjectItems.some((text) => text.includes(name)),
        `"${name}" is the active project item`,
        state.controller.activeProjectItems
    )
}

// The "the component only renders when the output has a background" half of
// media.controls, observed before the show starts: the clear controls are there,
// the media strip is not.
function verifyOpenShowNoBackground(state, ctx) {
    verifyOpenShow(state, ctx)
    check(state.controller.clear.root, "the clear controls are present before anything is on the output", state.controller.clear)
    check(stripOf(state).present === false, "no media control strip is rendered while the output has no background", stripOf(state))
}

async function stepStart(ctx) {
    await ctx.win.keyboard.press("Space")
    await waitForOutputText(ctx.app, (text) => text.includes("Verse one, line one"), 30000)
}

function verifyStart(state) {
    check(state.output.present, "the output window is still open after starting the show")
    check(state.output.text.includes("Verse one, line one"), "the first slide's text is on the output", state.output.text)
    check(state.lockTitle === "Lock output [Ctrl+L]", "the output is unlocked by default", state.lockTitle)
}

async function stepLock(ctx) {
    await ctx.win.keyboard.press("Control+l")
    await wait(250)
}

function verifyLock(state) {
    check(state.controller.lockTitles.length === 1, "exactly one lock control is in the controller", state.controller.lockTitles)
    check(state.lockTitle === "Unlock output [Ctrl+L]", "Ctrl+L flips the lock control to Unlock output [Ctrl+L]", state.lockTitle)
    check(state.output.present, "the output window stays open when locked")
}

async function stepNextWhileLocked(ctx) {
    await ctx.win.keyboard.press("Space")
    await wait(700)
}

function verifyNextWhileLocked(state, ctx) {
    const before = ctx.steps[ctx.steps.length - 1]
    const beforeText = outputText(before)
    check(beforeText.length > 0, "there was slide text before the locked next", beforeText)
    check(state.output.text === beforeText, "Space while locked does not change the output", { before: beforeText, after: state.output.text })
    check(state.lockTitle === "Unlock output [Ctrl+L]", "the output is still locked", state.lockTitle)
}

async function stepUnlock(ctx) {
    await ctx.win.keyboard.press("Control+l")
    await wait(250)
}

function verifyUnlock(state) {
    check(state.lockTitle === "Lock output [Ctrl+L]", "Ctrl+L flips the lock control back to Lock output [Ctrl+L]", state.lockTitle)
}

async function stepNext(ctx) {
    await ctx.win.keyboard.press("Space")
    await waitForOutputText(ctx.app, (text) => text.includes("Verse one, line three"), 30000)
}

function verifyNext(state, ctx) {
    const before = ctx.steps.find((step) => step.step === "start")
    const beforeText = outputText(before)
    check(state.output.text.includes("Verse one, line three"), "Space after unlocking advances to the second slide", state.output.text)
    check(state.output.text !== beforeText, "the output changed after unlocking", { before: beforeText, after: state.output.text })
    check(state.lockTitle === "Lock output [Ctrl+L]", "the output is unlocked", state.lockTitle)
}

async function stepClearEntries(ctx) {
    // 1.6.8-beta.3 has no Clear-all popup in the controller: ClearButtons.svelte
    // renders the per-layer entries inline in the preview column. The enumeration
    // is the "open the menu" observation for this version.
    await wait(200)
}

function verifyClearEntries(state) {
    const clear = state.controller.clear
    check(clear.root, "the clear controls are in the preview column", clear)

    // The per-layer controls are grouped as "clear button + disclosure" and the
    // disclosure carries the stable layer name even when the layer is cleared.
    const groups = clear.groups || []
    for (const layer of ["Background", "Slide", "Overlays", "Audio", "Next slide timer"]) {
        check(
            groups.some((group) => group.layer === layer),
            `the "${layer}" per-layer entry is present`,
            groups
        )
    }

    const clearAll = clear.entries.find((entry) => entry.title.startsWith("Clear all"))
    check(!!clearAll, "the Clear all entry is present", clear.entries.map((entry) => entry.title))
    check(clearAll.disabled === false, "Clear all is enabled while a slide is shown", clearAll)

    const slideGroup = groups.find((group) => group.layer === "Slide")
    check(!!slideGroup && slideGroup.clearDisabled === false, "the Clear slide entry is enabled while a slide is shown", slideGroup)
}

async function stepClear(ctx) {
    let presses = 0
    await ctx.win.keyboard.press("Escape")
    presses++

    const first = await waitForOutputCleared(ctx, 2500)
    let result = first
    if (!first.cleared) {
        // Clicking a show in the project sets FreeShow's `selected` store. The
        // global Escape handler clears that selection 20 ms after the preview's
        // Escape handler calls clearAll, so the first press deselects and the
        // second clears. Record both presses rather than hide the quirk.
        await ctx.win.keyboard.press("Escape")
        presses++
        result = await waitForOutputCleared(ctx, 2500)
    }

    return { escapePresses: presses, firstEscapeCleared: first.cleared, cleared: result.cleared }
}

function verifyClear(state) {
    check(state.output.present, "the output window stays open when cleared")
    check(state.cleared === true, "Escape emptied the output within the wait", { escapePresses: state.escapePresses, text: state.output.text })
    check(!hasFixtureText(state.output.text), "the output no longer shows the fixture text", state.output.text)
    check(state.controller.clear.entries.length > 0, "the clear controls are still readable after clearing", state.controller.clear)

    const clearAll = state.controller.clear.entries.find((entry) => entry.title.startsWith("Clear all"))
    const restore = state.controller.clear.entries.find((entry) => entry.title.startsWith("Restore output"))
    check(!!(restore || (clearAll && clearAll.disabled)), "Clear all is disabled or Restore output is offered", state.controller.clear.entries)
}

///////////////////////////////////////////////////////////////////////////////
// Stage output and multiple outputs
// (out.multiple, out.multiple.select, out.stage-window, stage.items)
///////////////////////////////////////////////////////////////////////////////

function outputById(state, id) {
    return (state.outputs || []).find((output) => output.id === id) || null
}

function tileById(state, id) {
    return (state.controller.preview.tiles || []).find((tile) => tile.id === id) || null
}

function tileNames(state) {
    return (state.controller.preview.tiles || []).map((tile) => tile.name)
}

function outputTitles(state) {
    return (state.browserWindows || []).map((window) => window.title).filter((title) => !!title)
}

function sortedNames(names) {
    return [...names].sort((a, b) => String(a).localeCompare(String(b)))
}

// The OS window titles, straight from the main process. A window takes its title
// from the output name (OutputLifecycle.ts:1575), which is how a page is matched
// to a seeded output before it has rendered anything.
function windowTitles(app) {
    return withTimeout(
        app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()
                .filter((window) => !window.isDestroyed())
                .map((window) => window.getTitle())
        ),
        10000,
        "reading the window titles"
    )
}

async function readOutputSnapshot(ctx) {
    const found = await findPages(ctx.app)
    const list = []
    for (const page of found.outputs) {
        const state = await readOutput(page).catch(() => null)
        if (!state) continue
        list.push({
            id: state.outputId || null,
            text: state.text || "",
            stageArea: !!state.stageArea,
            lines: state.lines || [],
            videos: state.videos || [],
            images: state.images || [],
            contentBox: state.contentBox || null,
            viewportBox: state.viewportBox || null
        })
    }
    return list.sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

async function waitForOutputPages(ctx, count, timeout = 45000) {
    await waitFor(
        `${count} output window${count === 1 ? "" : "s"}`,
        async () => (await findPages(ctx.app)).outputs.length === count,
        timeout
    )
}

// The preview tile for one output. MultiOutputs.svelte:246-256 renders one
// `.outputPreview` per enabled output and OutputPreviewLabel.svelte:49-55 puts
// the output's name inside the title-bar button.
function tileLocator(ctx, name) {
    return ctx.win.locator("#previewArea .outputPreview").filter({ hasText: name })
}

// A popup is a full-window backdrop (main/Popup.svelte:94-110) and swallows
// pointer clicks. FreeShow opens "choose_screen" when an output could not be put
// on a display (OutputVisibility.ts:71 -> ToMain.ALERT "error.display"), which is
// what happens on a single display, so the multi-output run has to close it
// before it clicks anything. Clicking the backdrop itself closes it
// (Popup.svelte:13-19); Escape would too, but Escape also clears the output.
async function dismissOverlayPopups(ctx) {
    const popup = ctx.win.locator(".popup")
    let dismissed = 0
    await wait(300)
    for (let attempt = 0; attempt < 3; attempt++) {
        const count = await popup.count().catch(() => 0)
        if (!count) break
        await popup.first().click({ position: { x: 4, y: 4 }, timeout: 15000 })
        dismissed++
        await wait(400)
    }
    if (dismissed) ctx.log(`dismissed ${dismissed} overlay popup${dismissed === 1 ? "" : "s"}`)
    return dismissed
}

async function clickInController(ctx, target) {
    await dismissOverlayPopups(ctx)
    if (typeof target === "string") await ctx.win.click(target, { timeout: 20000 })
    else await target.click({ timeout: 20000 })
}

function readEnabledToggle(page) {
    return page.evaluate(() => {
        const toggle = document.querySelector('[role="switch"][data-title="Enabled"]')
        if (!toggle) return null
        return { checked: toggle.getAttribute("aria-checked"), disabled: toggle.classList.contains("disabled") }
    })
}

// Settings > Outputs. The top-bar Settings button is `menu._title_settings`
// (components/main/Top.svelte:118), the left panel lists the settings sections
// (settings/SettingsTabs.svelte:50-56) and "Outputs" is `settings.display_settings`
// (public/lang/en.json:1356).
async function openOutputsSettings(ctx) {
    const settingsButton = await waitForLocator(ctx.win.locator('button[data-title^="Settings"]'), "the Settings button in the top bar", 15000)
    await clickInController(ctx, settingsButton)

    const section = await waitForLocator(ctx.win.locator('[id="button"]').filter({ hasText: /^\s*Outputs\s*$/ }), 'the "Outputs" settings section', 20000)
    await clickInController(ctx, section)

    await waitForLocator(ctx.win.locator(".tabs button.tab").first(), "the output tab strip", 20000)
}

// Select one output's tab and return the Enabled switch's state, so the step can
// prove which output the next click will apply to.
async function selectOutputTab(ctx, name) {
    const tab = ctx.win.locator(".tabs button.tab").filter({ hasText: name })
    const button = await waitForLocator(tab, `the "${name}" output tab`, 15000)
    await clickInController(ctx, button)
    await waitFor(
        `the "${name}" output tab to become the selected one`,
        async () => button.evaluate((element) => element.classList.contains("active")).catch(() => false),
        15000
    )
    await waitForLocator(ctx.win.locator('[role="switch"][data-title="Enabled"]'), "the Enabled switch for the selected output", 15000)
    await wait(200)
    const state = await readEnabledToggle(ctx.win)
    if (!state) throw new StepFailure(`the Enabled switch is not readable for "${name}"`)
    return state
}

async function clickEnabledToggle(ctx) {
    const toggle = await waitForLocator(ctx.win.locator('[role="switch"][data-title="Enabled"]'), "the Enabled switch", 15000)
    await clickInController(ctx, toggle)
    await wait(900)
}

// One Present click fans out to every enabled output (`toggleOutputs(null)`,
// helpers/output.ts:115-134). `expectedNames` are the seeded output names, which
// are also the OS window titles (OutputLifecycle.ts:1575).
async function presentOutputs(ctx, expectedNames) {
    const count = expectedNames.length
    ctx.popups = await dismissStartupPopups(ctx.win, ctx.log)
    const before = await readPresentState(ctx.win)
    if (!before) throw new StepFailure("the Present button is not in the controller")
    if (before.on) throw new StepFailure(`the outputs were already presenting before the step: ${JSON.stringify(before)}`)

    await clickInController(ctx, "#output_window_button")

    await waitForOutputPages(ctx, count)
    await waitFor(
        `the ${count} output windows to take their seeded titles`,
        async () => {
            const titles = await windowTitles(ctx.app)
            return expectedNames.every((name) => titles.includes(name))
        },
        45000
    )
    await waitFor(
        `the ${count} output pages to finish loading`,
        async () => {
            const pages = (await findPages(ctx.app)).outputs
            if (pages.length !== count) return false
            const states = await Promise.all(pages.map((page) => page.evaluate(() => document.readyState).catch(() => "")))
            return states.every((state) => state === "complete")
        },
        45000
    )
    // MainOutput only mounts the slide after its own 2 s "loaded" delay
    // (MainOutput.svelte:55-61), and it needs its own output data from the main
    // process first. Wait until every page names the output it renders.
    await waitFor(
        `the ${count} output pages to name the output they render`,
        async () => {
            const ids = await readOutputSnapshot(ctx)
            return ids.length === count && ids.every((output) => !!output.id)
        },
        60000
    )

    // The reference hides an output it cannot place on a display and opens the
    // screen picker instead. Record the popup, then close it so later clicks land.
    const dismissed = await dismissOverlayPopups(ctx)
    const after = await readPresentState(ctx.win)
    return { presentButton: after, overlayPopupsDismissed: dismissed, expectedOutputs: expectedNames }
}

async function stepPresentOutputs(ctx) {
    return presentOutputs(ctx, [OUTPUT_PRIMARY.name, OUTPUT_SECONDARY.name, OUTPUT_STAGE.name])
}

function verifyPresentOutputs(state) {
    const ids = sortedNames(state.outputs.map((output) => output.id))
    check(state.outputs.length === 3, "three output pages exist", state.outputs.map((output) => output.id))
    check(
        JSON.stringify(ids) === JSON.stringify(sortedNames([OUTPUT_PRIMARY.id, OUTPUT_SECONDARY.id, OUTPUT_STAGE.id])),
        "the three pages render the three seeded outputs (each page names its own output id)",
        ids
    )

    const normal = state.outputs.filter((output) => !output.stageArea)
    const stage = state.outputs.filter((output) => output.stageArea)
    check(normal.length === 2, "two output pages render a slide", normal.map((output) => output.id))
    check(
        stage.length === 1 && stage[0].id === OUTPUT_STAGE.id,
        "the third output's page renders a stage layout, not a slide",
        stage.map((output) => output.id)
    )

    const titles = outputTitles(state)
    for (const name of [OUTPUT_PRIMARY.name, OUTPUT_SECONDARY.name, OUTPUT_STAGE.name]) {
        check(titles.includes(name), `an OS window titled "${name}" exists`, titles)
    }
    const outputWindows = (state.browserWindows || []).filter((window) =>
        [OUTPUT_PRIMARY.name, OUTPUT_SECONDARY.name, OUTPUT_STAGE.name].includes(window.title)
    )
    check(outputWindows.length === 3, "each enabled output has its own OS window", outputWindows.map((window) => window.title))
    check(
        new Set(outputWindows.map((window) => window.id)).size === 3,
        "the three output windows are distinct windows",
        outputWindows.map((window) => window.id)
    )
    check(
        outputWindows.every((window) => window.offscreen === false),
        "every output is a real window in the process, not an offscreen surface",
        outputWindows.map((window) => ({ title: window.title, offscreen: window.offscreen, visible: window.visible }))
    )

    const tiles = state.controller.preview.tiles || []
    check(tiles.length === 3, "the preview draws one tile per enabled output", tileNames(state))
    check(
        tiles.every((tile) => tile.titleBar),
        "every tile has a title bar while more than one output is enabled",
        tiles.map((tile) => ({ name: tile.name, titleBar: tile.titleBar }))
    )
    check(
        JSON.stringify(sortedNames(tileNames(state))) === JSON.stringify(sortedNames([OUTPUT_PRIMARY.name, OUTPUT_SECONDARY.name, OUTPUT_STAGE.name])),
        "the tiles are named after the seeded outputs",
        tileNames(state)
    )
    check(
        tiles.every((tile) => tile.active === true),
        "all three seeded outputs are active",
        tiles.map((tile) => ({ name: tile.name, active: tile.active }))
    )
    // A stage tile's title-bar button has no title (OutputPreviewLabel.svelte:50),
    // so the tile itself reports which output renders a stage layout.
    const stageTiles = tiles.filter((tile) => tile.buttonTitle === "")
    check(
        stageTiles.length === 1 && stageTiles[0].name === STAGE_LAYOUT_NAME,
        "exactly one tile is the stage output (its title bar offers no output lock)",
        tiles.map((tile) => ({ name: tile.name, buttonTitle: tile.buttonTitle }))
    )
}

async function stepStartMultiple(ctx) {
    await ctx.win.keyboard.press("Space")
    await waitFor(
        "both normal outputs to show the first slide",
        async () => {
            const snapshot = await readOutputSnapshot(ctx)
            const primary = snapshot.find((output) => output.id === OUTPUT_PRIMARY.id)
            const secondary = snapshot.find((output) => output.id === OUTPUT_SECONDARY.id)
            return !!(primary && secondary && primary.text.includes(SLIDE_ONE) && secondary.text.includes(SLIDE_ONE))
        },
        30000
    )
    await waitFor(
        "the stage output to follow the first slide",
        async () => {
            const stage = (await readOutputSnapshot(ctx)).find((output) => output.id === OUTPUT_STAGE.id)
            return !!(stage && stage.text.includes(SLIDE_ONE) && stage.text.includes(SLIDE_TWO))
        },
        30000
    )
}

function verifyStartMultiple(state) {
    const primary = outputById(state, OUTPUT_PRIMARY.id)
    const secondary = outputById(state, OUTPUT_SECONDARY.id)
    const stage = outputById(state, OUTPUT_STAGE.id)
    check(!!primary && !!secondary && !!stage, "all three output pages are still open", state.outputs.map((output) => output.id))

    check(
        primary.text.includes(SLIDE_ONE) && primary.text.includes(SLIDE_ONE_SECOND_LINE),
        "the first output shows the first slide",
        primary.text
    )
    check(
        secondary.text.includes(SLIDE_ONE) && secondary.text.includes(SLIDE_ONE_SECOND_LINE),
        "starting the show fans out to the second output as well",
        secondary.text
    )
    check(!primary.text.includes(SLIDE_TWO), "a normal output shows the current slide only, never the next one", primary.text)

    check(stage.stageArea === true, "the stage output is showing a stage layout, not a slide", stage.text)
    check(
        stage.text.includes(SLIDE_ONE) && stage.text.includes(SLIDE_ONE_SECOND_LINE),
        "the stage's current-slide item shows the current slide's text",
        stage.text
    )
    check(
        stage.text.includes(SLIDE_TWO),
        "the stage's slideOffset 1 item shows the next slide's text",
        stage.text
    )
}

async function stepAdvanceMultiple(ctx) {
    await ctx.win.keyboard.press("Space")
    await waitFor(
        "both normal outputs to advance",
        async () => {
            const snapshot = await readOutputSnapshot(ctx)
            const primary = snapshot.find((output) => output.id === OUTPUT_PRIMARY.id)
            const secondary = snapshot.find((output) => output.id === OUTPUT_SECONDARY.id)
            return !!(primary && secondary && primary.text.includes(SLIDE_TWO) && secondary.text.includes(SLIDE_TWO))
        },
        30000
    )
    await waitFor(
        "the stage output to follow the advance",
        async () => {
            const stage = (await readOutputSnapshot(ctx)).find((output) => output.id === OUTPUT_STAGE.id)
            return !!(stage && stage.text.includes(SLIDE_TWO) && stage.text.includes(SLIDE_THREE))
        },
        30000
    )
}

function verifyAdvanceMultiple(state, ctx) {
    const before = ctx.steps.find((step) => step.step === "start")
    const primary = outputById(state, OUTPUT_PRIMARY.id)
    const secondary = outputById(state, OUTPUT_SECONDARY.id)
    const stage = outputById(state, OUTPUT_STAGE.id)

    check(
        !!before && before.outputs.some((output) => output.id === OUTPUT_PRIMARY.id && output.text.includes(SLIDE_ONE)),
        "the first output showed the first slide before the advance",
        before ? before.outputs.map((output) => output.id) : null
    )
    check(primary.text.includes(SLIDE_TWO), "the first output advanced to the second slide", primary.text)
    check(!primary.text.includes(SLIDE_ONE_SECOND_LINE), "the first output no longer shows the previous slide", primary.text)
    check(secondary.text.includes(SLIDE_TWO), "the second active output advanced too (fan-out to every active normal output)", secondary.text)
    check(stage.text.includes(SLIDE_TWO), "the stage's current-slide item followed the advance", stage.text)
    check(stage.text.includes(SLIDE_THREE), "the stage's next-slide item moved to the third slide", stage.text)
    check(!stage.text.includes(SLIDE_ONE_SECOND_LINE), "the stage output no longer shows the first slide", stage.text)
}

async function stepStageTileClick(ctx) {
    const dismissed = await dismissOverlayPopups(ctx)
    const tile = tileLocator(ctx, STAGE_LAYOUT_NAME)
    const button = await waitForLocator(tile.locator(".outputTitle button"), `the "${STAGE_LAYOUT_NAME}" title bar`, 15000)
    await button.click({ timeout: 20000 })
    await wait(500)
    return { overlayPopupsDismissed: dismissed }
}

function verifyStageTileClick(state, ctx) {
    const before = ctx.steps.find((step) => step.step === "advance")
    const stageBefore = before ? tileById(before, OUTPUT_STAGE.id) : null
    check(!!stageBefore && stageBefore.active === true, "the stage tile was active before the click", stageBefore)

    const stage = tileById(state, OUTPUT_STAGE.id)
    check(!!stage && stage.active === true, "clicking the stage tile's title bar leaves it active (a stage output is always active)", stage)
    const primary = tileById(state, OUTPUT_PRIMARY.id)
    const secondary = tileById(state, OUTPUT_SECONDARY.id)
    check(!!primary && primary.active === true, "the first normal output's active state is unchanged", primary)
    check(!!secondary && secondary.active === true, "the second normal output's active state is unchanged", secondary)
}

async function stepDeselectSecondary(ctx) {
    const dismissed = await dismissOverlayPopups(ctx)
    const tile = tileLocator(ctx, OUTPUT_SECONDARY.name)
    const button = await waitForLocator(tile.locator(".outputTitle button"), `the "${OUTPUT_SECONDARY.name}" title bar`, 15000)
    await button.click({ timeout: 20000 })
    await wait(500)
    return { overlayPopupsDismissed: dismissed }
}

function verifyDeselectSecondary(state) {
    const secondary = tileById(state, OUTPUT_SECONDARY.id)
    check(!!secondary && secondary.active === false, "a plain click deactivates that output's tile", secondary)
    const primary = tileById(state, OUTPUT_PRIMARY.id)
    check(!!primary && primary.active === true, "the other normal output stays active", primary)
    const stage = tileById(state, OUTPUT_STAGE.id)
    check(!!stage && stage.active === true, "the stage output stays active", stage)
    check(state.outputs.length === 3, "deactivating an output does not close its window", state.outputs.map((output) => output.id))
    const secondaryPage = outputById(state, OUTPUT_SECONDARY.id)
    check(!!secondaryPage, "the deactivated output's page is still readable", state.outputs.map((output) => output.id))
}

async function stepAdvanceWithInactive(ctx) {
    const before = await readOutputSnapshot(ctx)
    await ctx.win.keyboard.press("Space")
    await waitFor(
        "the active output to advance",
        async () => {
            const primary = (await readOutputSnapshot(ctx)).find((output) => output.id === OUTPUT_PRIMARY.id)
            return !!(primary && primary.text.includes(SLIDE_THREE))
        },
        30000
    )
    await wait(600)
    return { before }
}

function verifyAdvanceWithInactive(state) {
    const before = state.before || []
    const beforeSecondary = before.find((output) => output.id === OUTPUT_SECONDARY.id)
    const primary = outputById(state, OUTPUT_PRIMARY.id)
    const secondary = outputById(state, OUTPUT_SECONDARY.id)
    const stage = outputById(state, OUTPUT_STAGE.id)

    check(!!beforeSecondary, "the inactive output's page was readable before the advance", before.map((output) => output.id))
    check(primary.text.includes(SLIDE_THREE), "the active normal output advanced", primary.text)
    check(
        secondary.text === beforeSecondary.text,
        "the inactive normal output did not advance: the command fans out to active outputs only",
        { before: beforeSecondary.text, after: secondary.text }
    )
    check(secondary.text !== primary.text, "the two normal outputs are now on different slides", { primary: primary.text, secondary: secondary.text })
    check(stage.text.includes(SLIDE_THREE), "the stage output followed the source output it mirrors", stage.text)
}

async function stepLastActiveGuard(ctx) {
    const dismissed = await dismissOverlayPopups(ctx)
    const tile = tileLocator(ctx, OUTPUT_PRIMARY.name)
    const button = await waitForLocator(tile.locator(".outputTitle button"), `the "${OUTPUT_PRIMARY.name}" title bar`, 15000)
    const toastBefore = await ctx.win.evaluate(() => {
        const toast = document.querySelector(".toast")
        return toast ? String(toast.innerText || "").trim() : ""
    })
    await button.click({ timeout: 20000 })
    // Read the toast here: it clears itself after 4 s (main/Toast.svelte:9), which
    // a full settle of three output pages can outlast.
    await wait(500)
    const toastAfter = await ctx.win.evaluate(() => {
        const toast = document.querySelector(".toast")
        return toast ? String(toast.innerText || "").trim() : ""
    })
    return { overlayPopupsDismissed: dismissed, toastBefore, toastAfter }
}

function verifyLastActiveGuard(state) {
    const primary = tileById(state, OUTPUT_PRIMARY.id)
    check(
        !!primary && primary.active === true,
        "the last active normal output cannot be deactivated: the tile snaps back to active",
        primary
    )
    check(state.toastAfter && state.toastAfter.length > 0, "the reference toasts when the last active output is deactivated", {
        toastBefore: state.toastBefore,
        toastAfter: state.toastAfter
    })
    const secondary = tileById(state, OUTPUT_SECONDARY.id)
    check(!!secondary && secondary.active === false, "the already-inactive output is unaffected", secondary)
    const stage = tileById(state, OUTPUT_STAGE.id)
    check(!!stage && stage.active === true, "the stage output is still active", stage)
}

async function stepReselectSecondary(ctx) {
    const dismissed = await dismissOverlayPopups(ctx)
    const tile = tileLocator(ctx, OUTPUT_SECONDARY.name)
    const button = await waitForLocator(tile.locator(".outputTitle button"), `the "${OUTPUT_SECONDARY.name}" title bar`, 15000)
    await button.click({ timeout: 20000 })
    await wait(500)
    return { overlayPopupsDismissed: dismissed }
}

function verifyReselectSecondary(state) {
    const primary = tileById(state, OUTPUT_PRIMARY.id)
    const secondary = tileById(state, OUTPUT_SECONDARY.id)
    const stage = tileById(state, OUTPUT_STAGE.id)
    check(!!secondary && secondary.active === true, "a second plain click activates the output again", secondary)
    check(!!primary && primary.active === true, "the first normal output is still active", primary)
    check(!!stage && stage.active === true, "the stage output is still active", stage)
}

async function stepDisableOutput(ctx) {
    const before = await readOutputSnapshot(ctx)
    await dismissOverlayPopups(ctx)
    await openOutputsSettings(ctx)
    const toggleBefore = await selectOutputTab(ctx, OUTPUT_SECONDARY.name)
    await clickEnabledToggle(ctx)
    await waitForOutputPages(ctx, 2)
    const after = await readOutputSnapshot(ctx)
    const toggleAfter = await readEnabledToggle(ctx.win)
    return { before, after, toggleBefore, toggleAfter }
}

function verifyDisableOutput(state) {
    const before = state.before || []
    const after = state.after || []
    check(state.toggleBefore && state.toggleBefore.checked === "true", "the Enabled switch showed the output as enabled before the click", state.toggleBefore)
    check(before.length === 3, "all three outputs were enabled before the switch was turned off", before.map((output) => output.id))
    check(after.length === 2, "disabling one output removes its window and leaves the other two", after.map((output) => output.id))
    check(
        !after.some((output) => output.id === OUTPUT_SECONDARY.id),
        "the disabled output's page is gone",
        after.map((output) => output.id)
    )
    check(
        after.some((output) => output.id === OUTPUT_PRIMARY.id) && after.some((output) => output.id === OUTPUT_STAGE.id),
        "the other outputs are untouched by disabling one",
        after.map((output) => output.id)
    )

    const beforePrimary = before.find((output) => output.id === OUTPUT_PRIMARY.id)
    const afterPrimary = after.find((output) => output.id === OUTPUT_PRIMARY.id)
    check(
        !!afterPrimary && !!beforePrimary && afterPrimary.text === beforePrimary.text,
        "the remaining normal output still shows the same slide",
        { before: beforePrimary ? beforePrimary.text : null, after: afterPrimary ? afterPrimary.text : null }
    )
    const beforeStage = before.find((output) => output.id === OUTPUT_STAGE.id)
    const afterStage = after.find((output) => output.id === OUTPUT_STAGE.id)
    check(
        !!afterStage && afterStage.stageArea === true && !!beforeStage && afterStage.text === beforeStage.text,
        "the stage output is unaffected and still renders its layout",
        { before: beforeStage ? beforeStage.text : null, after: afterStage ? afterStage.text : null }
    )

    const titles = outputTitles(state)
    check(!titles.includes(OUTPUT_SECONDARY.name), `the "${OUTPUT_SECONDARY.name}" OS window is gone`, titles)
    check(titles.includes(OUTPUT_PRIMARY.name) && titles.includes(STAGE_LAYOUT_NAME), "the other two OS windows remain", titles)
    check(state.controller.preview.tiles.length === 2, "the preview now draws two tiles", tileNames(state))
}

async function stepEnableOutput(ctx) {
    const before = await readOutputSnapshot(ctx)
    const toggleBefore = await readEnabledToggle(ctx.win)
    if (!toggleBefore) throw new StepFailure("the Enabled switch is not readable before re-enabling the output")
    if (toggleBefore.checked !== "false") {
        throw new StepFailure(`the Enabled switch did not read as off before re-enabling: ${JSON.stringify(toggleBefore)}`)
    }
    await clickEnabledToggle(ctx)
    await waitForOutputPages(ctx, 3)
    await waitFor(
        `the "${OUTPUT_SECONDARY.name}" window to be titled`,
        async () => (await windowTitles(ctx.app)).includes(OUTPUT_SECONDARY.name),
        45000
    )
    // The new page asks the main process for its own data on mount
    // (utils/startup.ts:225-233), and MainOutput mounts the slide 2 s after that
    // (MainOutput.svelte:55-61). Wait for it to name itself rather than guess.
    await waitFor(
        `the "${OUTPUT_SECONDARY.name}" page to render its output`,
        async () => {
            const snapshot = await readOutputSnapshot(ctx)
            return snapshot.length === 3 && snapshot.some((output) => output.id === OUTPUT_SECONDARY.id)
        },
        45000
    )
    await wait(400)
    const after = await readOutputSnapshot(ctx)
    const toggleAfter = await readEnabledToggle(ctx.win)
    return { before, after, toggleBefore, toggleAfter }
}

function verifyEnableOutput(state) {
    const before = state.before || []
    const after = state.after || []
    check(state.toggleBefore && state.toggleBefore.checked === "false", "the Enabled switch read as off before re-enabling", state.toggleBefore)
    check(before.length === 2, "two output pages existed before re-enabling", before.map((output) => output.id))
    check(after.length === 3, "re-enabling the output recreates its window", after.map((output) => output.id))
    const secondary = after.find((output) => output.id === OUTPUT_SECONDARY.id)
    check(!!secondary, "the re-enabled output renders its own page again", after.map((output) => output.id))
    check(secondary.stageArea === false, "the re-enabled output renders a slide, not a stage layout", secondary)

    const beforePrimary = before.find((output) => output.id === OUTPUT_PRIMARY.id)
    const afterPrimary = after.find((output) => output.id === OUTPUT_PRIMARY.id)
    check(
        !!afterPrimary && !!beforePrimary && afterPrimary.text === beforePrimary.text,
        "re-enabling one output does not change the other output",
        { before: beforePrimary ? beforePrimary.text : null, after: afterPrimary ? afterPrimary.text : null }
    )
    const titles = outputTitles(state)
    check(titles.includes(OUTPUT_SECONDARY.name), `the "${OUTPUT_SECONDARY.name}" OS window exists again`, titles)
    check(state.controller.preview.tiles.length === 3, "the preview draws three tiles again", tileNames(state))
    // `toggleAfter` is recorded, not asserted: re-enabling can open the screen
    // picker, which moves the selected output tab (IPC/responsesMain.ts:167-172),
    // so the switch may no longer be showing this output.
}

async function stepBackToShow(ctx) {
    const dismissed = await dismissOverlayPopups(ctx)
    const showButton = await waitForLocator(ctx.win.locator('button[data-title^="Presenting"]'), "the Presenting button in the top bar", 15000)
    await clickInController(ctx, showButton)
    // With a project open the left panel is the project's show list
    // (`#projectArea`); `#projectsArea`, the project list, is not present.
    await waitFor("the show page to come back", async () => (await ctx.win.locator("#projectArea").count()) === 1, 20000)
    await waitFor(
        "the show page's preview to draw its three tiles",
        async () => (await ctx.win.locator("#previewArea .outputPreview").count()) === 3,
        20000
    )
    return { overlayPopupsDismissed: dismissed }
}

function verifyBackToShow(state) {
    check(state.controller.present, "the controller window is still the controller")
    check(state.controller.projectArea, "the left panel is the project's show list again (the show page)", state.controller.projectButtons)
    check(state.controller.preview.tiles.length === 3, "the preview draws three tiles again", tileNames(state))
    check(
        state.controller.preview.tiles.every((tile) => tile.titleBar),
        "every tile still has a title bar",
        state.controller.preview.tiles.map((tile) => tile.name)
    )
    check(
        state.controller.preview.tiles.every((tile) => tile.active),
        "both normal outputs and the stage output end the run active",
        state.controller.preview.tiles.map((tile) => ({ name: tile.name, active: tile.active }))
    )
    check(state.outputs.length === 3, "the three output windows are still open at the end of the run", state.outputs.map((output) => output.id))
}

///////////////////////////////////////////////////////////////////////////////
// Media behaviour (media.play, media.background, media.controls,
// media.next-finished)
///////////////////////////////////////////////////////////////////////////////

// A background's rendered form is an element with class "media"; the output's
// own `<video>` is the only reliable DOM signal for `loop`, and its buttons live
// in the controller's media strip.
function outputVideos(state, id) {
    const output = outputById(state, id)
    return output && Array.isArray(output.videos) ? output.videos : []
}

function outputImages(state, id) {
    const output = outputById(state, id)
    return output && Array.isArray(output.images) ? output.images : []
}

function primaryVideo(state) {
    const videos = outputVideos(state, MEDIA_OUTPUT_ID)
    return videos.length ? videos[0] : null
}

function stripOf(state) {
    return (state.controller && state.controller.media && state.controller.media.strip) || { present: false }
}

async function readOutputById(ctx, id) {
    const found = await findPages(ctx.app)
    for (const page of found.outputs) {
        const state = await readOutput(page).catch(() => null)
        if (state && state.outputId === id) return state
    }
    return null
}

async function readPrimaryVideo(ctx) {
    const state = await readOutputById(ctx, MEDIA_OUTPUT_ID)
    if (!state || !state.videos || !state.videos.length) return null
    return state.videos[0]
}

async function readStrip(ctx) {
    const state = await readController(ctx.win).catch(() => null)
    return state && state.media ? state.media.strip : { present: false }
}

// The strip is not always on screen: Preview.svelte renders MediaControls in the
// clear-control section only when the revealed layer is "background"
// (Preview.svelte:278-298). That is the control the reference docs could not
// name; selecting the layer's own disclosure (it carries data-title
// "preview.background") is what reveals it. Revealing is idempotent.
async function revealMediaStrip(ctx) {
    const disclosure = ctx.win.locator(`#previewArea .clear .combinedButton button[data-title="${TITLE_CLEAR_BACKGROUND_LAYER}"]`)
    const count = await disclosure.count().catch(() => 0)
    if (!count) throw new StepFailure(`the "${TITLE_CLEAR_BACKGROUND_LAYER}" layer disclosure is not in the clear controls`)
    const button = disclosure.first()
    if (await button.isDisabled().catch(() => false)) {
        throw new StepFailure(`the "${TITLE_CLEAR_BACKGROUND_LAYER}" layer disclosure is disabled: the output has no background to show controls for`)
    }
    const alreadyOpen = await button.evaluate((element) => element.classList.contains("isActive")).catch(() => false)
    if (!alreadyOpen) {
        await clickInController(ctx, button)
        await waitFor(
            "the Background clear layer to become the selected one",
            async () => button.evaluate((element) => element.classList.contains("isActive")).catch(() => false),
            8000
        )
    }
    await waitFor("the media control strip to render", async () => (await readStrip(ctx)).present, 8000)
    return { revealed: !alreadyOpen }
}

// Pause through the strip so a 3 s clip's remaining time is still available to
// the next-finished step. The click is only made once the strip reports the
// player as playing ("Pause"), so it cannot toggle the wrong way.
async function pauseViaStrip(ctx) {
    const reveal = await revealMediaStrip(ctx)
    const pause = await waitForLocator(ctx.win.locator(`#previewArea .clear-btns button[data-title="${TITLE_PAUSE}"]`), "the media strip's Pause button", 10000)
    const before = await readPrimaryVideo(ctx)
    await clickInController(ctx, pause)
    await waitFor("the media strip to report the player as paused", async () => (await readStrip(ctx)).playPauseTitle === TITLE_PLAY, 8000)
    const after = await readPrimaryVideo(ctx)
    return { reveal, wasPlaying: before ? before.paused === false : false, pausedAt: after ? after.currentTime : null }
}

// The show file the seed wrote. The strip's loop/mute toggles must change the
// live player only (`MediaControls.svelte:74-88` calls VideoPlayer.toggleLoop /
// toggleMute and keeps no write), so the stored media entry is read back from
// disk, not from the UI.
function readStoredMediaEntry(ctx, mediaId) {
    const file = join(ctx.seed.dataPath, "Shows", `${MEDIA_SHOW_NAME}.show`)
    if (!existsSync(file)) throw new StepFailure(`the seeded show file is missing: ${file}`)
    const parsed = JSON.parse(readFileSync(file, "utf8"))
    const show = parsed[1]
    if (!show || !show.media) throw new StepFailure(`the seeded show has no media: ${file}`)
    return show.media[mediaId] || null
}

async function openMediaDrawer(ctx) {
    const tab = await waitForLocator(ctx.win.locator("button#media"), "the Media drawer tab", 15000)
    // Clicking a drawer tab switches to it, and the drawer's own handler opens
    // the drawer if it was closed.
    await clickInController(ctx, tab)
    await waitFor("the Media drawer's categories", async () => (await ctx.win.locator('[class~="#category_media"]').count()) > 0, 20000)
}

async function selectMediaFolder(ctx) {
    const folder = ctx.win.locator('[class~="#category_media_button"]').filter({ hasText: MEDIA_FOLDER_NAME })
    const button = await waitForLocator(folder, `the "${MEDIA_FOLDER_NAME}" media folder`, 20000)
    await clickInController(ctx, button)
    await waitFor(
        `the "${MEDIA_FOLDER_NAME}" folder to become the active media tab`,
        async () => button.evaluate((element) => element.classList.contains("isActive")).catch(() => false),
        15000
    )
    await waitFor("the media folder's cards", async () => (await ctx.win.locator('[class~="#media_card"]').count()) >= 2, 20000)
    return { folder: MEDIA_FOLDER_NAME }
}

function mediaCard(ctx, filePath) {
    return ctx.win.locator(`[class~="#media_card"]:has(.label[data-title="${filePath}"])`)
}

async function cardLocator(ctx, filePath) {
    return waitForLocator(mediaCard(ctx, filePath), `the media card for ${filePath}`, 20000)
}

async function cardActionTitle(card) {
    return card.locator(".card").getAttribute("data-title").catch(() => null)
}

async function stepStartPaused(ctx) {
    await ctx.win.keyboard.press("Space")
    await waitForOutputText(ctx.app, (text) => text.includes(SLIDE_ONE), 30000)
    await waitFor("the background video on the output", async () => !!(await readPrimaryVideo(ctx)), 15000)
    const paused = await pauseViaStrip(ctx)
    return { wasPlaying: paused.wasPlaying, pausedAt: paused.pausedAt }
}

function verifyStartPaused(state) {
    check(state.output.present, "the output page exists")
    check(state.output.text.includes(SLIDE_ONE), "the show started on the first slide", state.output.text)
    check(state.wasPlaying === true, "the background clip was playing before the step paused it", state.wasPlaying)
    const video = primaryVideo(state)
    check(!!video, "the output renders the seeded background video", video)
    check(video.paused === true, "the clip is paused, so the next-finished step still has time to run", video)
    check(stripOf(state).present === true, "selecting the Background layer reveals a media control strip", stripOf(state))
}

async function stepMediaBackground(ctx) {
    // The seeded state is read, not changed. Reveal the strip so its buttons are
    // part of this step's record.
    const reveal = await revealMediaStrip(ctx)
    const video = await readPrimaryVideo(ctx)
    return { reveal, pausedAt: video ? video.currentTime : null }
}

function verifyMediaBackground(state, ctx) {
    const video = primaryVideo(state)
    check(!!video, "the output renders a background <video>", video)
    if (!video) return
    check(String(video.src).endsWith(MEDIA_VIDEO_NAME), `the background is ${MEDIA_VIDEO_NAME}`, video.src)
    check(video.loop === true, "the layout-slide background's loop:true is honoured by the player (video.loop)", video)
    check(Number.isFinite(video.duration) && video.duration > 0, "the clip reports a finite duration (decoded, not treated as a live stream)", video)
    const expected = state.mediaDurationSeconds || (ctx.seed.media && ctx.seed.media.durationSeconds) || null
    if (expected) {
        check(Math.abs(video.duration - expected) <= 0.75, `the clip's duration matches the generated clip (${expected}s)`, { duration: video.duration, expected })
    }
    check(video.readyState >= 2, "the clip has decoded enough to render a frame (readyState >= 2)", video)
    check(video.videoWidth === 1280 && video.videoHeight === 720, "the decoded frame is 1280x720", { width: video.videoWidth, height: video.videoHeight })
    check(video.paused === true, "the clip is still paused", video)
    // This is a property of the reference's markup, not of the player's state:
    // asserting it documents why the muted observation has to come from a button.
    check(video.muted === true, "the output <video> is hardcoded muted, so video.muted is NOT evidence of the stored muted state", video)

    const strip = stripOf(state)
    check(strip.present, "the media control strip is present while a background exists", strip)
    check(String(strip.layer || "").toLowerCase() === "background", 'the strip is the revealed "Background" layer', { layer: strip.layer })
    check(String(strip.name || "").includes("video-bg"), "the strip names the background media", strip.name)
    check(strip.muteTitle === TITLE_UNMUTE, "the strip's mute button reports the player as muted (title Unmute)", strip)
    check(strip.playPauseTitle === TITLE_PLAY, "the strip's play button reports the player as paused (title Play)", strip)
    check(state.pausedAt !== null && state.pausedAt !== undefined, "the pause recorded the player's position", state.pausedAt)
}

async function stepMediaPlayPause(ctx) {
    await revealMediaStrip(ctx)
    const before = await readPrimaryVideo(ctx)
    if (!before) throw new StepFailure("no video background before the play/pause step")
    if (before.paused !== true) throw new StepFailure(`the clip was not paused before the play click: ${JSON.stringify(before)}`)
    const startedAt = before.currentTime

    const play = await waitForLocator(ctx.win.locator(`#previewArea .clear-btns button[data-title="${TITLE_PLAY}"]`), "the media strip's Play button", 8000)
    await clickInController(ctx, play)
    const resumed = await waitFor(
        "the clip to resume",
        async () => {
            const video = await readPrimaryVideo(ctx)
            return video && video.paused === false && video.currentTime > startedAt + 0.05 ? video : null
        },
        8000,
        100
    )
    const pause = await waitForLocator(ctx.win.locator(`#previewArea .clear-btns button[data-title="${TITLE_PAUSE}"]`), "the media strip's Pause button", 8000)
    await clickInController(ctx, pause)
    const paused = await waitFor(
        "the clip to pause",
        async () => {
            const video = await readPrimaryVideo(ctx)
            return video && video.paused === true ? video : null
        },
        8000,
        100
    )
    return { playStartedAt: startedAt, playResumedTo: resumed.currentTime, playPausedAt: paused.currentTime }
}

function verifyMediaPlayPause(state) {
    check(typeof state.playResumedTo === "number" && state.playResumedTo > state.playStartedAt + 0.02, "clicking Play resumed the clip and its clock advanced", {
        from: state.playStartedAt,
        to: state.playResumedTo
    })
    check(typeof state.playPausedAt === "number" && state.playPausedAt >= state.playResumedTo, "clicking Pause stopped the clock", {
        resumedTo: state.playResumedTo,
        pausedAt: state.playPausedAt
    })
    const video = primaryVideo(state)
    check(!!video && video.paused === true, "the player is paused after the second click", video)
    check(stripOf(state).playPauseTitle === TITLE_PLAY, "the strip flips back to Play", stripOf(state))
}

async function stepMediaLoopMute(ctx) {
    await revealMediaStrip(ctx)
    const before = await readPrimaryVideo(ctx)
    if (!before) throw new StepFailure("no video background before the loop/mute step")
    if (before.loop !== true) throw new StepFailure(`the player did not report loop before the toggle: ${JSON.stringify(before)}`)

    const loopBefore = await readStrip(ctx)
    const loopButton = await waitForLocator(ctx.win.locator(`#previewArea .clear-btns button[data-title^="${TITLE_LOOP}"]`), "the media strip's loop button", 8000)
    const loopTitleBefore = await loopButton.getAttribute("data-title")
    await clickInController(ctx, loopButton)
    const loopOff = await waitFor(
        "the player to report loop off",
        async () => {
            const video = await readPrimaryVideo(ctx)
            return video && video.loop === false ? video : null
        },
        10000
    )
    // Read the stored entry between the toggles: if the strip persisted, the
    // file would already say loop:false here.
    const storedAfterToggle = readStoredMediaEntry(ctx, MEDIA_VIDEO_MEDIA_ID)

    const muteButton = await waitForLocator(ctx.win.locator(`#previewArea .clear-btns button[data-title="${TITLE_UNMUTE}"]`), "the media strip's mute button (the player is muted)", 8000)
    await clickInController(ctx, muteButton)
    await waitFor("the strip to report the player as unmuted", async () => (await readStrip(ctx)).muteTitle === TITLE_MUTE, 8000)
    const stripUnmuted = await readStrip(ctx)

    // Restore the seeded player state: media.next-finished is the claim that a
    // *looping* background advances, so the loop must be on when that step runs.
    const loopBack = await waitForLocator(ctx.win.locator(`#previewArea .clear-btns button[data-title^="${TITLE_LOOP}"]`), "the loop button", 8000)
    await clickInController(ctx, loopBack)
    await waitFor(
        "the player to report loop on again",
        async () => {
            const video = await readPrimaryVideo(ctx)
            return video && video.loop === true ? video : null
        },
        10000
    )
    const muteBack = await waitForLocator(ctx.win.locator(`#previewArea .clear-btns button[data-title="${TITLE_MUTE}"]`), "the mute button (the player is unmuted)", 8000)
    await clickInController(ctx, muteBack)
    await waitFor("the strip to report the player as muted again", async () => (await readStrip(ctx)).muteTitle === TITLE_UNMUTE, 8000)

    return {
        loopTitleBefore,
        loopTitleBeforeState: loopBefore.loopTitle,
        loopAfterToggle: loopOff.loop,
        muteTitleAfterToggle: stripUnmuted.muteTitle,
        muteTitleAfterRestore: (await readStrip(ctx)).muteTitle,
        storedLoopAfterToggle: storedAfterToggle ? storedAfterToggle.loop : null,
        storedMutedAfterToggle: storedAfterToggle ? storedAfterToggle.muted : null
    }
}

function verifyMediaLoopMute(state) {
    check(state.loopAfterToggle === false, "clicking the strip's loop button turned the live player's loop off (video.loop)", state.loopAfterToggle)
    check(state.muteTitleAfterToggle === TITLE_MUTE, "clicking the strip's mute button unmuted the live player (the button then offers Mute)", state.muteTitleAfterToggle)
    check(state.muteTitleAfterRestore === TITLE_UNMUTE, "the strip was left reporting the seeded muted state", state.muteTitleAfterRestore)
    check(state.storedLoopAfterToggle === true, "the show's stored media entry still says loop:true after the live toggle (the strip does not persist)", {
        stored: state.storedLoopAfterToggle
    })
    check(state.storedMutedAfterToggle === true, "the show's stored media entry still says muted:true after the live toggle", { stored: state.storedMutedAfterToggle })
    check(stripOf(state).present === true, "the strip is still present", stripOf(state))
}

async function stepMediaLock(ctx) {
    await revealMediaStrip(ctx)
    await ctx.win.keyboard.press("Control+l")
    await waitFor(
        "the lock control to report Unlock",
        async () => {
            const controller = await readController(ctx.win)
            return (controller.lockTitles || []).includes("Unlock output [Ctrl+L]")
        },
        10000
    )
    // Selecting the layer is not gated by the lock, and re-revealing keeps the
    // strip in this step's record.
    await revealMediaStrip(ctx)
}

function verifyMediaLock(state) {
    check(state.lockTitle === "Unlock output [Ctrl+L]", "the output is locked", state.lockTitle)
    const strip = stripOf(state)
    check(strip.present, "the strip is still readable while the output is locked", strip)
    check(strip.playPauseDisabled === true, "play/pause is disabled while the output is locked", strip)
    check(strip.muteDisabled === true, "mute is disabled while the output is locked", strip)
    check(strip.loopDisabled === false, "loop is NOT disabled while the output is locked", strip)
}

async function stepMediaUnlock(ctx) {
    await ctx.win.keyboard.press("Control+l")
    await waitFor(
        "the lock control to report Lock",
        async () => {
            const controller = await readController(ctx.win)
            return (controller.lockTitles || []).includes("Lock output [Ctrl+L]")
        },
        10000
    )
    await revealMediaStrip(ctx)
}

function verifyMediaUnlock(state) {
    check(state.lockTitle === "Lock output [Ctrl+L]", "the output is unlocked again", state.lockTitle)
    const strip = stripOf(state)
    check(strip.present, "the strip is still present", strip)
    check(strip.playPauseDisabled === false && strip.muteDisabled === false, "play/pause and mute are enabled again", strip)
}

async function stepMediaNextFinished(ctx) {
    await revealMediaStrip(ctx)
    const before = await readPrimaryVideo(ctx)
    if (!before) throw new StepFailure("no video background before the next-finished observation")
    if (before.paused !== true) throw new StepFailure(`the clip was not paused before the next-finished observation: ${JSON.stringify(before)}`)
    if (before.loop !== true) throw new StepFailure(`the clip was not looping before the next-finished observation: ${JSON.stringify(before)}`)
    if (!Number.isFinite(before.duration) || before.duration <= 0) {
        throw new StepFailure(`the clip's duration is not finite, so the end cannot be timed: ${JSON.stringify(before)}`)
    }

    const play = await waitForLocator(ctx.win.locator(`#previewArea .clear-btns button[data-title="${TITLE_PLAY}"]`), "the media strip's Play button", 8000)
    const startedAt = Date.now()
    const playFrom = before.currentTime
    await clickInController(ctx, play)

    const remainingMs = Math.max(0, Math.round((before.duration - playFrom) * 1000))
    const timeout = remainingMs + 20000
    const advanced = await waitFor(
        `the output to advance to the second slide (the clip had ${remainingMs} ms left)`,
        async () => {
            const state = await readOutputById(ctx, MEDIA_OUTPUT_ID)
            return state && state.root && String(state.text || "").includes(SLIDE_TWO) ? state : null
        },
        timeout
    )
    // The background cross-fades to the advance target's own image; the outgoing
    // video element is unmounted once the new one has loaded
    // (`output/layers/Background.svelte:87-126`). Wait for that rather than
    // sampling during the cross-fade.
    const settledAfterAdvance = await waitFor(
        "the outgoing video background to be replaced by the advance target's image",
        async () => {
            const state = await readOutputById(ctx, MEDIA_OUTPUT_ID)
            if (!state) return null
            const videos = (state.videos || []).filter((video) => String(video.src).endsWith(MEDIA_VIDEO_NAME))
            const images = state.images || []
            return videos.length === 0 && images.some((src) => String(src).endsWith(MEDIA_LOGO_NAME)) ? state : null
        },
        10000
    )
    return {
        nextAfterMedia: {
            duration: before.duration,
            playFrom,
            remainingMs,
            advancedAfterMs: Date.now() - startedAt,
            text: settledAfterAdvance.text
        }
    }
}

function verifyMediaNextFinished(state, ctx) {
    const output = outputById(state, MEDIA_OUTPUT_ID)
    check(!!output, "the output page is present", state.outputs.map((entry) => entry.id))
    if (!output) return
    check(output.text.includes(SLIDE_TWO), "the looping background's end advanced the output to the second slide", output.text)
    check(!output.text.includes(SLIDE_ONE), "the output left the first slide", output.text)
    check(!output.text.includes(SLIDE_THREE), "exactly one slide advance happened (not two)", output.text)

    const before = ctx.steps.find((step) => step.step === "media_background")
    const beforeVideo = before ? (outputVideos(before, MEDIA_OUTPUT_ID)[0] || null) : null
    check(!!beforeVideo && beforeVideo.loop === true, "the background was looping before it advanced (the ordering claim: the next-after-media check runs before the loop branch)", beforeVideo)

    const timing = state.nextAfterMedia || {}
    const lower = Math.max(0, (timing.remainingMs || 0) - 1500)
    const upper = (timing.remainingMs || 0) + 8000
    check(
        typeof timing.advancedAfterMs === "number" && timing.advancedAfterMs >= lower && timing.advancedAfterMs <= upper,
        `the advance happened when the clip's remaining time ran out (${timing.remainingMs} ms), not on a fixed wait`,
        timing
    )
    // The advance target carries its own image background, so the video is no
    // longer the background after the advance.
    check(outputVideos(state, MEDIA_OUTPUT_ID).length === 0, "the video background is no longer rendered after the advance", output.videos)
    check(
        outputImages(state, MEDIA_OUTPUT_ID).some((src) => String(src).endsWith(MEDIA_LOGO_NAME)),
        "the advance target renders its own image background",
        output.images
    )
}

async function stepMediaDrawerPlay(ctx) {
    await openMediaDrawer(ctx)
    const folder = await selectMediaFolder(ctx)
    const card = await cardLocator(ctx, MEDIA_VIDEO)
    const cardTitleBefore = await cardActionTitle(card)
    await clickInController(ctx, card.locator(".over"))
    await waitFor(
        "a video background to appear on the output",
        async () => {
            const video = await readPrimaryVideo(ctx)
            return video && String(video.src).endsWith(MEDIA_VIDEO_NAME) ? video : null
        },
        15000
    )
    const paused = await pauseViaStrip(ctx)
    return { cardTitleBefore, folder: folder.folder, pausedAt: paused.pausedAt }
}

function verifyMediaDrawerPlay(state) {
    check(state.cardTitleBefore === TITLE_PLAY, "the drawer card reports the media as not on any output before the click", state.cardTitleBefore)
    const video = primaryVideo(state)
    check(!!video, "one click on the drawer card put the media on the output", video)
    if (!video) return
    check(String(video.src).endsWith(MEDIA_VIDEO_NAME), "the background is the clicked file", video.src)
    check(video.loop === true, "a file with no folder/file type loops when clicked in the drawer (loop = true)", video)
    check(stripOf(state).muteTitle === TITLE_MUTE, "the same click leaves it unmuted (the strip offers Mute, i.e. the player is unmuted)", stripOf(state))
    check(video.paused === true, "the step paused the clip so the captured state is stable", video)
}

async function stepMediaDrawerClear(ctx) {
    await openMediaDrawer(ctx)
    const card = await cardLocator(ctx, MEDIA_VIDEO)
    const cardTitleBefore = await cardActionTitle(card)
    if (cardTitleBefore !== "Clear") {
        throw new StepFailure(`the card does not report the background as active before the clear click: ${JSON.stringify(cardTitleBefore)}`)
    }
    await clickInController(ctx, card.locator(".over"))
    await waitFor("the video background to be cleared", async () => (await readPrimaryVideo(ctx)) === null, 15000)
    return { cardTitleBefore }
}

function verifyMediaDrawerClear(state) {
    check(state.cardTitleBefore === "Clear", "the card reported the media as already on the output before the click", state.cardTitleBefore)
    check(
        outputVideos(state, MEDIA_OUTPUT_ID).length === 0,
        "clicking the same card cleared the background: no <video> remains on the output",
        outputVideos(state, MEDIA_OUTPUT_ID)
    )
    const card = ((state.controller.mediaDrawer && state.controller.mediaDrawer.cards) || []).find((entry) => entry.path === MEDIA_VIDEO) || null
    check(!!card, "the drawer is still open and its cards are readable", state.controller.mediaDrawer)
    if (card) check(card.actionTitle === TITLE_PLAY, "the card reports the media as no longer on the output", card)
}

async function stepMediaProjectItem(ctx) {
    const item = ctx.win.locator('#projectArea div[id^="show_"]').filter({ hasText: "background" })
    const row = await waitForLocator(item, "the seeded project media item", 15000)
    await clickInController(ctx, row.locator("button").first())
    await wait(400)
    // Space plays the selected item (`togglePlayingMedia`, shortcuts.ts:491-548);
    // for a media item it calls setOutput with the project's loop/muted defaults.
    await ctx.win.keyboard.press("Space")
    await waitFor("a video background for the project item", async () => !!(await readPrimaryVideo(ctx)), 15000)
    const paused = await pauseViaStrip(ctx)
    return { pausedAt: paused.pausedAt }
}

function verifyMediaProjectItem(state) {
    const video = primaryVideo(state)
    check(!!video, "playing the project media item put a video on the output", video)
    if (!video) return
    check(String(video.src).endsWith(MEDIA_VIDEO_NAME), "the background is the project media file", video.src)
    check(video.loop === false, "a project media item with no loop flag does not loop (loop = false)", video)
    check(stripOf(state).muteTitle === TITLE_MUTE, "a project media item with no muted flag plays unmuted (the strip offers Mute)", stripOf(state))
    check(video.paused === true, "the step paused the clip so the captured state is stable", video)
}

///////////////////////////////////////////////////////////////////////////////
// Output styles (out.styles, out.styles.aspect, out.styles.lines,
// out.styles.layers)
///////////////////////////////////////////////////////////////////////////////

function normalStyledOutputs(state) {
    return [OUTPUT_PRIMARY.id, OUTPUT_SECONDARY.id, OUTPUT_TERTIARY.id].map((id) => outputById(state, id))
}

function textRatio(box) {
    if (!box || !box.width || !box.height) return null
    return box.width / box.height
}

async function stepPresentStylesOutputs(ctx) {
    return presentOutputs(ctx, [OUTPUT_PRIMARY.name, OUTPUT_SECONDARY.name, OUTPUT_TERTIARY.name])
}

function verifyPresentStylesOutputs(state) {
    const ids = sortedNames(state.outputs.map((output) => output.id))
    check(state.outputs.length === 3, "three output pages exist", state.outputs.map((output) => output.id))
    check(
        JSON.stringify(ids) === JSON.stringify(sortedNames([OUTPUT_PRIMARY.id, OUTPUT_SECONDARY.id, OUTPUT_TERTIARY.id])),
        "the three pages render the three seeded normal outputs",
        ids
    )
    check(state.outputs.every((output) => output.stageArea !== true), "none of them is a stage output", state.outputs.map((output) => output.stageArea))
    const titles = outputTitles(state)
    for (const name of [OUTPUT_PRIMARY.name, OUTPUT_SECONDARY.name, OUTPUT_TERTIARY.name]) {
        check(titles.includes(name), `an OS window titled "${name}" exists`, titles)
    }
    check(state.controller.preview.tiles.length === 3, "the preview draws one tile per output", tileNames(state))
}

async function stepStylesStart(ctx) {
    await ctx.win.keyboard.press("Space")
    const firstLine = STYLES_SLIDE_1[0]
    await waitFor(
        "the three styled outputs to show the first slide",
        async () => {
            const snapshot = await readOutputSnapshot(ctx)
            return [OUTPUT_PRIMARY.id, OUTPUT_SECONDARY.id, OUTPUT_TERTIARY.id].every((id) => {
                const output = snapshot.find((entry) => entry.id === id)
                return !!(output && output.text.includes(firstLine))
            })
        },
        30000
    )
}

function verifyStylesStart(state) {
    for (const output of normalStyledOutputs(state)) {
        check(!!output, `output ${output ? output.id : "?"} is present`, state.outputs.map((entry) => entry.id))
        if (output) check(output.text.includes(STYLES_SLIDE_1[0]), `${output.id} renders the first slide`, output.text)
    }
}

async function stepStylesAspect(ctx) {
    // Read only: the aspect comes from the seeded style, so the step's record is
    // the observation.
    return { note: "read the seeded per-output style's rendered content box" }
}

function verifyStylesAspect(state) {
    const primary = outputById(state, OUTPUT_PRIMARY.id)
    const secondary = outputById(state, OUTPUT_SECONDARY.id)
    check(!!primary && !!secondary, "both styled outputs are present", state.outputs.map((entry) => entry.id))
    if (!primary || !secondary) return

    for (const output of [primary, secondary]) {
        check(!!output.contentBox && output.contentBox.width > 0 && output.contentBox.height > 0, `${output.id} renders a content box`, output.contentBox)
        check(!!output.viewportBox && output.viewportBox.width > 0, `${output.id} renders an output viewport`, output.viewportBox)
    }
    const wide = textRatio(primary.contentBox)
    const fourThree = textRatio(secondary.contentBox)
    check(wide !== null && Math.abs(wide - 16 / 9) < 0.02, "the output with no aspectRatio renders 16:9 (the default)", { ratio: wide, box: primary.contentBox })
    check(fourThree !== null && Math.abs(fourThree - 4 / 3) < 0.02, "the output bound to aspectRatio 4:3 renders 4:3", { ratio: fourThree, box: secondary.contentBox })

    // "contain" fit (`getStyleResolution(..., "fit")`, slide/getStyleResolution.ts:20-26)
    // sizes the content box to one axis of the output. Which axis depends on
    // whether the window itself is wider than the style's ratio, so the check is
    // "touches at least one edge" rather than a fixed axis.
    const touches = (box, viewport) =>
        Math.min(Math.abs(box.width - viewport.width), Math.abs(box.height - viewport.height))
    check(touches(primary.contentBox, primary.viewportBox) <= 1, "the 16:9 content box fits inside the output on one axis", {
        box: primary.contentBox,
        viewport: primary.viewportBox
    })
    check(touches(secondary.contentBox, secondary.viewportBox) <= 1, "the 4:3 content box fits inside the output on one axis", {
        box: secondary.contentBox,
        viewport: secondary.viewportBox
    })
    check(
        secondary.contentBox.width < primary.contentBox.width,
        "the 4:3 content box is narrower than the 16:9 one on the same output bounds",
        { fourThree: secondary.contentBox, sixteenNine: primary.contentBox }
    )
    check(
        Math.abs(primary.contentBox.height - secondary.contentBox.height) <= 2,
        "both content boxes are the output's full height (4:3 is letterboxed horizontally)",
        { fourThree: secondary.contentBox, sixteenNine: primary.contentBox }
    )
}

async function stepStylesLinesWindow(ctx) {
    return { note: "read the per-output line window" }
}

function verifyStylesLinesWindow(state) {
    const primary = outputById(state, OUTPUT_PRIMARY.id)
    const secondary = outputById(state, OUTPUT_SECONDARY.id)
    check(!!primary && !!secondary, "both styled outputs are present", state.outputs.map((entry) => entry.id))
    if (!primary || !secondary) return
    const primaryLines = primary.lines || []
    check(
        primaryLines.length === 2 && primaryLines[0].includes(STYLES_SLIDE_1[0]) && primaryLines[1].includes(STYLES_SLIDE_1[1]),
        "the lines:2 output shows exactly lines 1-2 of the four-line slide",
        primaryLines
    )
    check(
        !primary.text.includes(STYLES_SLIDE_1[2]),
        "the lines:2 output does not show line 3 yet",
        primaryLines
    )
    const secondaryLines = secondary.lines || []
    check(
        STYLES_SLIDE_1.every((line) => secondaryLines.some((visible) => visible.includes(line))),
        "the lines:0 output shows the whole slide (all four lines)",
        secondaryLines
    )
}

async function stepStylesPaging(ctx) {
    const before = await readOutputSnapshot(ctx)
    await ctx.win.keyboard.press("Space")
    await waitFor(
        "the lines:2 output to page to lines 3-4",
        async () => {
            const snapshot = await readOutputSnapshot(ctx)
            const primary = snapshot.find((entry) => entry.id === OUTPUT_PRIMARY.id)
            return !!(primary && primary.text.includes(STYLES_SLIDE_1[2]) && !primary.text.includes(STYLES_SLIDE_1[0]))
        },
        30000
    )
    await wait(600)
    return { before }
}

function verifyStylesPaging(state) {
    const primary = outputById(state, OUTPUT_PRIMARY.id)
    const secondary = outputById(state, OUTPUT_SECONDARY.id)
    check(!!primary && !!secondary, "both styled outputs are present", state.outputs.map((entry) => entry.id))
    if (!primary || !secondary) return
    const primaryLines = primary.lines || []
    check(
        primaryLines.length === 2 && primaryLines[0].includes(STYLES_SLIDE_1[2]) && primaryLines[1].includes(STYLES_SLIDE_1[3]),
        "one advance moved the lines:2 output to lines 3-4 of the same slide",
        primaryLines
    )
    check(!primary.text.includes(STYLES_SLIDE_1[0]), "the lines:2 output no longer shows line 1", primary.text)

    const secondaryLines = secondary.lines || []
    check(
        STYLES_SLIDE_1.every((line) => secondaryLines.some((visible) => visible.includes(line))),
        "the lines:0 output still shows the whole slide: its window is null/null, so the page does not change it",
        secondaryLines
    )
    check(
        !secondary.text.includes(STYLES_SLIDE_2[0]),
        "the shared paging step kept the presentation on slide one: the 2-line output set the page size, so the advance did not leave the slide",
        secondary.text
    )
}

async function stepStylesLayers(ctx) {
    return { note: "read the per-output layer set" }
}

function verifyStylesLayers(state) {
    const secondary = outputById(state, OUTPUT_SECONDARY.id)
    const tertiary = outputById(state, OUTPUT_TERTIARY.id)
    check(!!secondary && !!tertiary, "the default-layer and no-background outputs are present", state.outputs.map((entry) => entry.id))
    if (!secondary || !tertiary) return
    check(
        outputImages(state, OUTPUT_SECONDARY.id).some((src) => String(src).endsWith(MEDIA_LOGO_NAME)),
        "the output with all layers renders the slide's image background",
        outputImages(state, OUTPUT_SECONDARY.id)
    )
    check(
        outputImages(state, OUTPUT_TERTIARY.id).length === 0,
        'the layers:["slide","overlays"] output does not render the background layer',
        outputImages(state, OUTPUT_TERTIARY.id)
    )
    check(
        outputVideos(state, OUTPUT_TERTIARY.id).length === 0,
        "nor a video background",
        outputVideos(state, OUTPUT_TERTIARY.id)
    )
    check(tertiary.text.includes(STYLES_SLIDE_1[0]), "the no-background output still renders the slide layer's text", tertiary.text)
}

async function stepStylesSummary(ctx) {
    return { note: "compare the three outputs' rendered state" }
}

function verifyStylesSummary(state, ctx) {
    const primary = outputById(state, OUTPUT_PRIMARY.id)
    const secondary = outputById(state, OUTPUT_SECONDARY.id)
    const tertiary = outputById(state, OUTPUT_TERTIARY.id)
    check(!!primary && !!secondary && !!tertiary, "all three outputs are still open", state.outputs.map((entry) => entry.id))
    if (!primary || !secondary || !tertiary) return

    // One show, one slide, three looks: the differences come from
    // `outputs[id].style`, not from different content.
    check(
        [primary, secondary, tertiary].every((output) => output.text.includes(STYLES_SLIDE_1[2])),
        "the three outputs are showing the same page of the same slide",
        [primary.text, secondary.text, tertiary.text]
    )
    check((primary.lines || []).length === 2, "the lines:2 output still shows a 2-line window", primary.lines)
    check((secondary.lines || []).length === 4, "the lines:0 output still shows the whole slide", secondary.lines)
    check(
        Math.abs(textRatio(primary.contentBox) - 16 / 9) < 0.02 && Math.abs(textRatio(secondary.contentBox) - 4 / 3) < 0.02,
        "the 16:9 and 4:3 outputs still render their own aspect",
        { primary: primary.contentBox, secondary: secondary.contentBox }
    )
    check(
        outputImages(state, OUTPUT_SECONDARY.id).length > 0 && outputImages(state, OUTPUT_TERTIARY.id).length === 0,
        "the background layer is still visible on one output and hidden on the other",
        { secondary: outputImages(state, OUTPUT_SECONDARY.id), tertiary: outputImages(state, OUTPUT_TERTIARY.id) }
    )
    check(primary.contentBox.width !== secondary.contentBox.width, "the two aspect styles render different geometry", {
        primary: primary.contentBox,
        secondary: secondary.contentBox
    })
}

///////////////////////////////////////////////////////////////////////////////
// Navigation, output bindings, lock and layers
// (show.slides.disabled, out.multiple.specific, out.lock, out.layers)
///////////////////////////////////////////////////////////////////////////////

function snapshotOf(list, id) {
    return (list || []).find((entry) => entry.id === id) || null
}

// `waitForOutputs` returns its samples keyed by output id; a step may also
// record a plain array. Both shapes are readable here so "the output never
// showed X" cannot silently become an assertion about `undefined`.
function observedTexts(state, id) {
    const observed = state.observed
    if (!observed) return []
    if (Array.isArray(observed)) return observed
    return observed[id] || []
}

// What "the output did not change" is measured on. The controller's media strip
// and the reference's slide timers are not part of it; text, the rendered
// background and the player's own flags are. `currentTime` is excluded because a
// playing clip would never hold still.
function outputFingerprint(output) {
    return {
        text: output.text || "",
        lines: output.lines || [],
        images: output.images || [],
        videos: (output.videos || []).map((video) => ({ src: video.src, paused: video.paused === true }))
    }
}

async function readOutputPageById(ctx, id, what) {
    const found = await findPages(ctx.app)
    for (const page of found.outputs) {
        const state = await readOutput(page).catch(() => null)
        if (state && state.outputId === id) return { page, state }
    }
    throw new StepFailure(`the "${id}" output page was not found${what ? ` while ${what}` : ""} (open pages: ${found.outputs.length})`)
}

// `settlePage` only sees Web Animations. FreeShow's slide/item transitions are
// Svelte JS transitions that write inline styles from rAF callbacks, so it
// returns while the old and new item are both mounted (transitions.ts imports
// fade/fly/scale/blur/spin from svelte/transition). "Nothing changed" therefore
// has to be *measured*: two equal reads at least `gap` ms apart (>= 300 ms, as
// docs/parity-workflow.md §6 and the reader's spec require).
async function stableOutputFingerprint(ctx, id, what, { timeout = 20000, gap = 400, interval = 120 } = {}) {
    const deadline = Date.now() + timeout
    let anchor = null
    while (Date.now() < deadline) {
        const { state } = await readOutputPageById(ctx, id, `waiting for a stable read (${what})`)
        const value = outputFingerprint(state)
        const json = JSON.stringify(value)
        const now = Date.now()
        if (!anchor || anchor.json !== json) {
            anchor = { json, value, at: now }
        } else if (now - anchor.at >= gap) {
            return { stable: true, value, heldForMs: now - anchor.at }
        }
        await wait(interval)
    }
    throw new StepFailure(
        `the "${id}" output never held still for ${gap} ms (${what}); last text ${JSON.stringify(anchor && anchor.value.text)}`
    )
}

async function stableOutputs(ctx, ids, what, options) {
    const result = {}
    for (const id of ids) result[id] = await stableOutputFingerprint(ctx, id, what, options)
    return result
}

function checkOutputUnchanged(before, after, id, what) {
    const a = (before || {})[id]
    const b = (after || {})[id]
    check(!!a && !!b, `the "${id}" output was readable before and after (${what})`, { before: !!a, after: !!b })
    if (!a || !b) return
    check(a.stable === true && b.stable === true, `both "${id}" reads were stable across two reads >= 400 ms apart (${what})`, {
        beforeHeldForMs: a.heldForMs,
        afterHeldForMs: b.heldForMs
    })
    check(JSON.stringify(a.value) === JSON.stringify(b.value), `${what}: the "${id}" output did not change`, { before: a.value, after: b.value })
}

// Poll every output until `predicate(id, text)` holds for all of them, keeping
// the texts seen so "it never showed X" is a claim about the run, not about one
// sample taken after a fixed wait.
async function waitForOutputs(ctx, ids, predicate, what, timeout = 30000) {
    const deadline = Date.now() + timeout
    const samples = {}
    for (const id of ids) samples[id] = []
    let last = {}
    while (Date.now() < deadline) {
        const snapshot = await readOutputSnapshot(ctx)
        last = {}
        let ok = true
        for (const id of ids) {
            const output = snapshotOf(snapshot, id)
            const text = output ? output.text || "" : ""
            last[id] = text
            if (!samples[id].length || samples[id][samples[id].length - 1] !== text) samples[id].push(text.slice(0, 200))
            if (samples[id].length > 20) samples[id].shift()
            if (!predicate(id, text)) ok = false
        }
        if (ok) return { texts: last, samples }
        await wait(150)
    }
    throw new StepFailure(`${what} did not happen within ${timeout} ms (last output text: ${JSON.stringify(last)})`)
}

function waitForOutputsText(ctx, ids, needles, what, timeout = 30000) {
    // `needles` is one string for every output, or a map of output id -> string.
    const byId = typeof needles === "string" ? Object.fromEntries(ids.map((id) => [id, needles])) : needles
    return waitForOutputs(ctx, ids, (id, text) => text.includes(byId[id]), what, timeout)
}

// The complement: the previous slide's text must have left the output before a
// "the output no longer shows X" assertion is made from a single read. Svelte's
// outro transition keeps the outgoing item mounted for a moment, and settlePage
// cannot see it.
function waitForOutputsWithout(ctx, ids, needle, what, timeout = 15000) {
    return waitForOutputs(ctx, ids, (id, text) => !text.includes(needle), what, timeout)
}

// Pointer steps must not run with a modal over the controller: a startup popup
// ("Graphics acceleration is unavailable") swallows pointer clicks while
// keyboard steps still reach the page, and the screen picker is a `.popup`.
async function preparePointer(ctx) {
    const startup = await dismissStartupPopups(ctx.win, ctx.log)
    if (startup) ctx.popupsSeen = (ctx.popupsSeen || 0) + startup.dismissed.length
    const overlays = await dismissOverlayPopups(ctx)
    return { startupPopups: startup, overlayPopups: overlays }
}

// Click a slide card's *body*, never its icon strip: the icons sit at the top of
// the card and their buttons bubble to the card's own click handler
// (inputs/Button.svelte:15 does not stop propagation), so a click there would
// both act on the icon and play the slide. The icons only render in grid mode
// without Alt and outside focus mode (slide/Slide.svelte:282), which is also why
// the card count is asserted here: a different view mode renders fewer cards.
async function clickSlideCard(ctx, index, expectedCount, expectedText) {
    const pointers = await preparePointer(ctx)
    const cards = ctx.win.locator(SHOW_SLIDE_CARD_SELECTOR)
    const count = await cards.count()
    if (count !== expectedCount) {
        throw new StepFailure(
            `the show view draws ${count} slide cards, expected ${expectedCount}; the scenario assumes the default grid view (slidesOptions.mode "grid", columns 4)`
        )
    }
    if (index >= count) throw new StepFailure(`card ${index} does not exist (the show view draws ${count})`)
    const card = cards.nth(index)
    const box = await card.boundingBox()
    if (!box) throw new StepFailure(`card ${index} has no box on screen`)
    const text = await card.innerText().catch(() => "")
    if (expectedText && !String(text).includes(expectedText)) {
        throw new StepFailure(`card ${index} does not show ${JSON.stringify(expectedText)} before the click: ${JSON.stringify(String(text).slice(0, 200))}`)
    }
    await card.click({ position: { x: Math.round(box.width / 2), y: Math.round(box.height * 0.78) }, timeout: 20000 })
    return { index, expectedText: expectedText || null, pointers, box: { width: Math.round(box.width), height: Math.round(box.height) } }
}

async function clickOutputTile(ctx, name, what) {
    const pointers = await preparePointer(ctx)
    const tile = tileLocator(ctx, name)
    const button = await waitForLocator(tile.locator(".outputTitle button"), `the "${name}" output title bar (${what})`, 15000)
    await button.click({ timeout: 20000 })
    await wait(400)
    return { pointers }
}

async function stepLayerOrder(ctx) {
    const trees = {}
    for (const id of TWO_OUTPUT_IDS) {
        const { page } = await readOutputPageById(ctx, id, "reading the output's layer containers")
        trees[id] = await readLayerTree(page)
    }
    return { layerTrees: trees }
}

// The per-layer clear buttons come from `readController` — this step changes
// nothing and records the controller state the presence claim is read from.
async function stepLayerButtons(ctx) {
    return { note: "read the per-layer clear buttons beside the preview" }
}

// The marker sequence an output page renders for the locks fixture, in document
// order: the background image, then the `placeUnderSlide` overlay, then the
// slide's own text, then the ordinary overlay. `Output.svelte:408-485` puts the
// underlay slot before the slide and the overlay slot after it.
function checkLayerOrder(tree, id) {
    check(!!tree && tree.root === true, `the "${id}" page renders the output's slide container (.zoomed .slide)`, tree && tree.root)
    if (!tree || !tree.root) return
    const markers = tree.markers || []
    const indexOf = (predicate) => markers.findIndex(predicate)
    const background = indexOf((marker) => marker.kind === "media" && String(marker.src || "").endsWith(MEDIA_LOGO_NAME))
    const underlay = indexOf((marker) => marker.kind === "item" && marker.text === OVERLAY_UNDER_TEXT)
    const slide = indexOf((marker) => marker.kind === "item" && marker.text === LOCKS_SLIDE_ONE)
    const overlay = indexOf((marker) => marker.kind === "item" && marker.text === OVERLAY_OVER_TEXT)
    const detail = { markers, counts: tree.counts }

    check(background >= 0, `the "${id}" page renders the slide's background image (${MEDIA_LOGO_NAME})`, detail)
    check(underlay >= 0, `the "${id}" page renders the placeUnderSlide overlay's text`, detail)
    check(slide >= 0, `the "${id}" page renders the slide layer's text`, detail)
    check(overlay >= 0, `the "${id}" page renders the ordinary overlay's text`, detail)
    check(tree.counts.media === 1, `the "${id}" page renders exactly one background media element (no style background was seeded)`, detail)
    if (background < 0 || underlay < 0 || slide < 0 || overlay < 0) return

    check(underlay > background, `the "${id}" page draws the underlay after the background`, { order: { background, underlay, slide, overlay }, markers })
    check(slide > underlay, `the "${id}" page draws the slide after the placeUnderSlide overlay (the underlay slot is below the slide)`, {
        order: { background, underlay, slide, overlay },
        markers
    })
    check(overlay > slide, `the "${id}" page draws the ordinary overlay after the slide`, { order: { background, underlay, slide, overlay }, markers })
}

function clearGroupByName(groups, layer) {
    return (groups || []).find((group) => group.layer === layer) || null
}

///////////////////////////////////////////////////////////////////////////////
// A. nav-disabled-slides (show.slides.disabled)
///////////////////////////////////////////////////////////////////////////////

async function stepDisabledMarkers(ctx) {
    // The show view mounts its cards through a lazy loader (show/Slides.svelte:361-455),
    // so wait for the whole grid instead of reading a half-mounted one.
    await waitFor(
        "the show view to draw five slide cards",
        async () => (await ctx.win.locator(SHOW_SLIDE_CARD_SELECTOR).count()) === 5,
        20000
    )
    // The output page names itself only once MainOutput has mounted the slide
    // (2 s after its own data arrives). Every later step reads by that id, so
    // establish it here rather than fail obscurely later.
    await waitFor(
        "the output page to name the output it renders",
        async () => {
            const snapshot = await readOutputSnapshot(ctx)
            return snapshot.length === 1 && snapshot[0].id === DEFAULT_OUTPUT_ID
        },
        60000
    )
    return { showSlides: await readShowSlides(ctx.win) }
}

function verifyDisabledMarkers(state, ctx) {
    const read = state.showSlides
    check(!!read && read.root === true, "the show view is on screen (#showArea exists)", read && read.root)
    if (!read || !read.root) return
    check(state.outputs.length === 1 && state.outputs[0].id === DEFAULT_OUTPUT_ID, "the run uses the reference's single default output", state.outputs.map((output) => output.id))
    check(read.grid === true, "the show view still uses its grid container", { grid: read.grid, gridChildCount: read.gridChildCount })
    check(read.cards.length === 5, "the show view draws one card per layout entry", (read.cards || []).map((card) => card.index))
    if (read.cards.length !== 5) return
    check(
        read.cards.every((card) => card.present === true),
        "every grid entry has mounted its slide (no skeleton card is left)",
        read.cards.map((card) => ({ index: card.index, present: card.present }))
    )

    read.cards.forEach((card, index) => {
        check(card.text.includes(NAV_SLIDE_TEXTS[index]), `card ${index} holds the slide text "${NAV_SLIDE_TEXTS[index]}"`, card.text)
    })
    for (const index of NAV_DISABLED_INDICES) {
        const card = read.cards[index]
        check(card.disabled === true, `card ${index} carries the "disabled" class`, card)
        check(
            card.opacity !== "" && Math.abs(Number(card.opacity) - 0.2) < 0.001,
            `card ${index} is dimmed to the .slide.disabled opacity 0.2`,
            { opacity: card.opacity, classes: card.classes }
        )
        check(
            card.hasEnableButton === true,
            `card ${index} offers the Enable button the disabled-slide marker pairs with (its title is the dictionary's actions.enable label, ${JSON.stringify(TITLE_ENABLE_SLIDE)} in public/lang/en.json; the record keeps every button title)`,
            card.buttons
        )
    }
    for (const index of [1, 2, 4]) {
        const card = read.cards[index]
        check(card.disabled === false, `card ${index} is not marked disabled`, card)
        check(card.hasEnableButton === false, `card ${index} offers no Enable button`, card.buttons)
    }
}

async function stepNavStartSkipsDisabled(ctx) {
    // Nothing is on the output yet, so this is the "start" path: getNextSlide
    // begins at index -1 and skips every disabled entry it walks over
    // (helpers/OutputHelper.ts:348, :366-368).
    await ctx.win.keyboard.press("Space")
    const result = await waitForOutputsText(ctx, [DEFAULT_OUTPUT_ID], "Nav two", "one Space from an empty output", 30000)
    return { observed: result.samples }
}

function verifyNavStartSkipsDisabled(state) {
    const output = outputById(state, DEFAULT_OUTPUT_ID)
    check(!!output, "the default output page is open", state.outputs.map((entry) => entry.id))
    if (!output) return
    check(output.text.includes("Nav two"), "one Space from an empty output put entry 1 on the output (entry 0 is disabled)", output.text)
    check(!output.text.includes("Nav one"), "the disabled first entry's text is not on the output", output.text)
    check(!observedTexts(state, DEFAULT_OUTPUT_ID).some((text) => text.includes("Nav one")), "no read taken during the step ever showed the disabled first entry", observedTexts(state, DEFAULT_OUTPUT_ID))
}

async function stepNavNext(ctx) {
    await ctx.win.keyboard.press("Space")
    const result = await waitForOutputsText(ctx, [DEFAULT_OUTPUT_ID], "Nav three", "Space from entry 1", 30000)
    await waitForOutputsWithout(ctx, [DEFAULT_OUTPUT_ID], "Nav two", "the previous slide's text to leave the output")
    return { observed: result.samples }
}

function verifyNavNext(state) {
    const output = outputById(state, DEFAULT_OUTPUT_ID)
    check(!!output, "the default output page is open", state.outputs.map((entry) => entry.id))
    if (!output) return
    check(output.text.includes("Nav three"), "Space advanced to entry 2", output.text)
    check(!output.text.includes("Nav two"), "the output left entry 1", output.text)
}

async function stepNavNextSkipsDisabled(ctx) {
    await ctx.win.keyboard.press("Space")
    const result = await waitForOutputsText(ctx, [DEFAULT_OUTPUT_ID], "Nav five", "Space over the disabled entry 3", 30000)
    return { observed: result.samples }
}

function verifyNavNextSkipsDisabled(state) {
    const output = outputById(state, DEFAULT_OUTPUT_ID)
    check(!!output, "the default output page is open", state.outputs.map((entry) => entry.id))
    if (!output) return
    check(output.text.includes("Nav five"), "one Space skipped the disabled entry 3 and landed on entry 4", output.text)
    check(!output.text.includes("Nav four"), "the disabled entry's text is not on the output after the advance", output.text)
    check(
        !observedTexts(state, DEFAULT_OUTPUT_ID).some((text) => text.includes("Nav four")),
        "no read taken during the step ever showed the disabled entry",
        observedTexts(state, DEFAULT_OUTPUT_ID)
    )
}

async function stepNavPreviousSkipsDisabled(ctx) {
    await ctx.win.keyboard.press("ArrowLeft")
    const result = await waitForOutputsText(ctx, [DEFAULT_OUTPUT_ID], "Nav three", "ArrowLeft over the disabled entry 3", 30000)
    return { observed: result.samples }
}

function verifyNavPreviousSkipsDisabled(state) {
    const output = outputById(state, DEFAULT_OUTPUT_ID)
    check(!!output, "the default output page is open", state.outputs.map((entry) => entry.id))
    if (!output) return
    check(output.text.includes("Nav three"), "ArrowLeft skipped back over the disabled entry 3 to entry 2", output.text)
    check(!output.text.includes("Nav four"), "the disabled entry's text is not on the output after going back", output.text)
    check(
        !observedTexts(state, DEFAULT_OUTPUT_ID).some((text) => text.includes("Nav four")),
        "no read taken during the step ever showed the disabled entry",
        observedTexts(state, DEFAULT_OUTPUT_ID)
    )
}

async function stepNavClickDisabled(ctx) {
    const click = await clickSlideCard(ctx, 3, 5, "Nav four")
    await waitForOutputsText(ctx, [DEFAULT_OUTPUT_ID], "Nav four", "the click on the disabled card", 30000)
    const showSlidesAfterClick = await readShowSlides(ctx.win)
    return { click, showSlidesAfterClick }
}

function verifyNavClickDisabled(state) {
    const output = outputById(state, DEFAULT_OUTPUT_ID)
    check(!!output, "the default output page is open", state.outputs.map((entry) => entry.id))
    if (!output) return
    check(output.text.includes("Nav four"), "clicking the disabled card's body played it: the click path has no disabled check (show/Slides.svelte:96-145)", output.text)
    const card = ((state.showSlidesAfterClick && state.showSlidesAfterClick.cards) || [])[3] || null
    check(!!card, "the show view's cards are still readable after the click", state.showSlidesAfterClick)
    if (card) check(card.disabled === true, "the card is still marked disabled after the click (playing it does not enable it)", card)
}

async function stepNavClickFirstDisabled(ctx) {
    const click = await clickSlideCard(ctx, 0, 5, "Nav one")
    await waitForOutputsText(ctx, [DEFAULT_OUTPUT_ID], "Nav one", "the click on the first disabled card", 30000)
    return { click }
}

function verifyNavClickFirstDisabled(state) {
    const output = outputById(state, DEFAULT_OUTPUT_ID)
    check(!!output, "the default output page is open", state.outputs.map((entry) => entry.id))
    if (!output) return
    check(output.text.includes("Nav one"), "clicking the disabled entry 0 played it, so the skip is not a rule about entry 0 only", output.text)
}

async function stepNavAdvanceFromDisabled(ctx) {
    await ctx.win.keyboard.press("Space")
    const result = await waitForOutputsText(ctx, [DEFAULT_OUTPUT_ID], "Nav two", "Space from a disabled slide that is being played", 30000)
    await waitForOutputsWithout(ctx, [DEFAULT_OUTPUT_ID], "Nav one", "the disabled slide's text to leave the output")
    return { observed: result.samples }
}

function verifyNavAdvanceFromDisabled(state) {
    const output = outputById(state, DEFAULT_OUTPUT_ID)
    check(!!output, "the default output page is open", state.outputs.map((entry) => entry.id))
    if (!output) return
    check(output.text.includes("Nav two"), "playing a disabled slide does not wedge navigation: Space moved on to entry 1", output.text)
    check(!output.text.includes("Nav one"), "the output left the disabled entry 0", output.text)
}

///////////////////////////////////////////////////////////////////////////////
// B. nav-output-bindings (out.multiple.specific)
///////////////////////////////////////////////////////////////////////////////

async function stepNavPresentTwo(ctx) {
    return presentOutputs(ctx, TWO_OUTPUT_NAMES)
}

function verifyTwoOutputsPresent(state) {
    check(state.outputs.length === 2, "two output pages exist", state.outputs.map((output) => output.id))
    const ids = sortedNames(state.outputs.map((output) => output.id))
    check(
        JSON.stringify(ids) === JSON.stringify(sortedNames(TWO_OUTPUT_IDS)),
        "the pages render the two seeded outputs (each page names its own output id)",
        ids
    )
    check(
        state.outputs.every((output) => output.stageArea !== true),
        "neither page renders a stage layout",
        state.outputs.map((output) => output.stageArea)
    )
    const titles = outputTitles(state)
    for (const name of TWO_OUTPUT_NAMES) check(titles.includes(name), `an OS window titled "${name}" exists`, titles)
    const windows = (state.browserWindows || []).filter((window) => TWO_OUTPUT_NAMES.includes(window.title))
    check(windows.length === 2, "each enabled output has its own OS window", windows.map((window) => window.title))
    check(new Set(windows.map((window) => window.id)).size === 2, "the two output windows are distinct windows", windows.map((window) => window.id))
    check(
        windows.every((window) => window.offscreen === false),
        "both outputs are real windows in the process, not offscreen surfaces",
        windows.map((window) => ({ title: window.title, offscreen: window.offscreen, visible: window.visible }))
    )
    const tiles = state.controller.preview.tiles || []
    check(tiles.length === 2, "the preview draws one tile per enabled output", tileNames(state))
    check(
        JSON.stringify(sortedNames(tileNames(state))) === JSON.stringify(sortedNames(TWO_OUTPUT_NAMES)),
        "the tiles are named after the seeded outputs",
        tileNames(state)
    )
    check(tiles.every((tile) => tile.titleBar), "both tiles have a title bar (the per-output lock)", tiles.map((tile) => ({ name: tile.name, titleBar: tile.titleBar })))
    check(tiles.every((tile) => tile.active === true), "both outputs start active", tiles.map((tile) => ({ name: tile.name, active: tile.active })))
}

async function stepBindingsStart(ctx) {
    await ctx.win.keyboard.press("Space")
    const result = await waitForOutputsText(ctx, TWO_OUTPUT_IDS, "Bind one", "one Space from an empty pair of outputs", 30000)
    return { observed: result.samples }
}

function verifyBindingsStart(state) {
    for (const id of TWO_OUTPUT_IDS) {
        const output = outputById(state, id)
        check(!!output, `the "${id}" output page is open`, state.outputs.map((entry) => entry.id))
        if (!output) continue
        check(output.text.includes("Bind one"), `the unbound first slide reached "${id}"`, output.text)
    }
    const primary = outputById(state, OUTPUT_PRIMARY.id)
    const secondary = outputById(state, OUTPUT_SECONDARY.id)
    check(
        !!primary && primary.text.includes(BIND_ITEM_ONLY_PRIMARY),
        "the output an item is bound to renders that item",
        primary && primary.text
    )
    check(
        !!secondary && !secondary.text.includes(BIND_ITEM_ONLY_PRIMARY),
        "the other output does not render the item bound to its sibling (the per-output item filter)",
        secondary && secondary.text
    )
    check(
        !!secondary && secondary.text.includes("Bind one"),
        "the unbound item on the same slide reaches both outputs, so the difference is attributable to the item binding",
        secondary && secondary.text
    )
    check(
        !observedTexts(state, OUTPUT_SECONDARY.id).some((text) => text.includes(BIND_ITEM_ONLY_PRIMARY)),
        "the output the item is not bound to never showed it, at any read taken during the step",
        observedTexts(state, OUTPUT_SECONDARY.id)
    )
}

async function stepClickBoundSlide(ctx) {
    const before = await stableOutputs(ctx, TWO_OUTPUT_IDS, "before clicking a slide bound to one output")
    const click = await clickSlideCard(ctx, 1, 5, "Bind two")
    await waitForOutputsText(ctx, [OUTPUT_PRIMARY.id], "Bind two", "the click on the slide bound to primary", 30000)
    const after = await stableOutputs(ctx, TWO_OUTPUT_IDS, "after clicking a slide bound to one output")
    return { before, after, click }
}

function verifyClickBoundSlide(state) {
    const primary = outputById(state, OUTPUT_PRIMARY.id)
    const secondary = outputById(state, OUTPUT_SECONDARY.id)
    check(!!primary && !!secondary, "both output pages are open", state.outputs.map((entry) => entry.id))
    if (!primary || !secondary) return
    check(primary.text.includes("Bind two"), "the output the slide is bound to played it", primary.text)
    check(!secondary.text.includes("Bind two"), "the output the slide is not bound to never received it", secondary.text)
    checkOutputUnchanged(state.before, state.after, OUTPUT_SECONDARY.id, "a slide bound to primary only")
}

async function stepAdvanceSkipsBound(ctx) {
    const before = await readOutputSnapshot(ctx)
    await ctx.win.keyboard.press("Space")
    const result = await waitForOutputsText(ctx, TWO_OUTPUT_IDS, "Bind three", "one Space from the bound slide", 30000)
    return { before, observed: result.samples }
}

function verifyAdvanceSkipsBound(state) {
    const primary = outputById(state, OUTPUT_PRIMARY.id)
    const secondary = outputById(state, OUTPUT_SECONDARY.id)
    check(!!primary && !!secondary, "both output pages are open", state.outputs.map((entry) => entry.id))
    if (!primary || !secondary) return
    check(primary.text.includes("Bind three"), "the bound output advanced from entry 1 to entry 2", primary.text)
    check(
        secondary.text.includes("Bind three"),
        "the unbound output jumped entry 0 -> 2: one advance skipped the slide bound to another output (OutputHelper.ts:414-425)",
        secondary.text
    )
    check(!secondary.text.includes("Bind two"), "the unbound output never showed the slide bound to its sibling", secondary.text)
    const beforeSecondary = snapshotOf(state.before, OUTPUT_SECONDARY.id)
    check(!!beforeSecondary && beforeSecondary.text.includes("Bind one"), "the unbound output was on entry 0 before the advance", beforeSecondary && beforeSecondary.text)
}

async function stepDeactivateSecondary(ctx) {
    const click = await clickOutputTile(ctx, OUTPUT_SECONDARY.name, "deactivate the second output")
    await waitFor("the second output's tile to report itself inactive", async () => {
        const controller = await readController(ctx.win).catch(() => null)
        const tile = controller ? ((controller.preview && controller.preview.tiles) || []).find((entry) => entry.id === OUTPUT_SECONDARY.id) : null
        return !!(tile && tile.active === false)
    }, 15000)
    return click
}

function verifyDeactivateSecondary(state) {
    const secondary = tileById(state, OUTPUT_SECONDARY.id)
    const primary = tileById(state, OUTPUT_PRIMARY.id)
    check(!!secondary && secondary.active === false, "a plain click on the tile deactivates that output", secondary)
    check(!!primary && primary.active === true, "the other output stays active", primary)
    check(state.outputs.length === 2, "deactivating an output does not close its window", state.outputs.map((entry) => entry.id))
}

async function stepBoundSlideToInactiveOutput(ctx) {
    // The contradiction test: the slide is bound to both outputs and one of them
    // is inactive. The page's parenthetical (multiple-outputs.md:217-219) says
    // setOutput skips the locked one; the bound branch (output.ts:151-155) never
    // consults `active`, so the prediction is that *both* pages change. Either
    // outcome is a finding: the step records both pages and the assertion below
    // names the claim being tested.
    const before = await stableOutputs(ctx, TWO_OUTPUT_IDS, "before playing a slide bound to both outputs")
    const click = await clickSlideCard(ctx, 3, 5, "Bind four")
    const after = await stableOutputs(ctx, TWO_OUTPUT_IDS, "after playing a slide bound to both outputs")
    return { before, after, click }
}

function verifyBoundSlideToInactiveOutput(state) {
    const primary = outputById(state, OUTPUT_PRIMARY.id)
    const secondary = outputById(state, OUTPUT_SECONDARY.id)
    check(!!primary && !!secondary, "both output pages are open", state.outputs.map((entry) => entry.id))
    if (!primary || !secondary) return
    check(primary.text.includes("Bind four"), "the active output the slide is bound to played it", primary.text)
    check(
        secondary.text.includes("Bind four"),
        "the inactive output the slide is also bound to received it too: the bound branch does not consult `active` (output.ts:151-155 vs :699-714); if this failed, the page's parenthetical is right and the run is the finding",
        {
            before: (state.before || {})[OUTPUT_SECONDARY.id] || null,
            after: (state.after || {})[OUTPUT_SECONDARY.id] || null,
            text: secondary.text
        }
    )
}

async function stepBindingsReselectSecondary(ctx) {
    const click = await clickOutputTile(ctx, OUTPUT_SECONDARY.name, "reactivate the second output")
    await waitFor("the second output's tile to report itself active again", async () => {
        const controller = await readController(ctx.win).catch(() => null)
        const tile = controller ? ((controller.preview && controller.preview.tiles) || []).find((entry) => entry.id === OUTPUT_SECONDARY.id) : null
        return !!(tile && tile.active === true)
    }, 15000)
    return click
}

function verifyBindingsReselectSecondary(state) {
    check(tileById(state, OUTPUT_SECONDARY.id)?.active === true, "a second click activates the output again", tileById(state, OUTPUT_SECONDARY.id))
    check(tileById(state, OUTPUT_PRIMARY.id)?.active === true, "the first output is still active", tileById(state, OUTPUT_PRIMARY.id))
}

async function stepStaleBinding(ctx) {
    // Second contradiction test: bindings that name an output which does not
    // exist. The page says setOutput then "sends nothing" (multiple-outputs.md:149-151);
    // output.ts:152-153 falls back to the active outputs, so the prediction is
    // that every active page takes the slide.
    const before = await stableOutputs(ctx, TWO_OUTPUT_IDS, "before playing a slide with a stale binding")
    const click = await clickSlideCard(ctx, 4, 5, "Bind five")
    const after = await stableOutputs(ctx, TWO_OUTPUT_IDS, "after playing a slide with a stale binding")
    return { before, after, click }
}

function verifyStaleBinding(state) {
    for (const id of TWO_OUTPUT_IDS) {
        const output = outputById(state, id)
        check(!!output, `the "${id}" output page is open`, state.outputs.map((entry) => entry.id))
        if (!output) continue
        check(
            output.text.includes("Bind five"),
            `a stale binding fell back to the active outputs, so "${id}" received the slide (output.ts:152-153); if this failed, the page's "sends nothing" is right and the run is the finding`,
            output.text
        )
    }
}

///////////////////////////////////////////////////////////////////////////////
// C. lock-and-layers (out.lock, out.layers)
///////////////////////////////////////////////////////////////////////////////

async function stepLocksStart(ctx) {
    await ctx.win.keyboard.press("Space")
    const slide = await waitForOutputsText(ctx, TWO_OUTPUT_IDS, LOCKS_SLIDE_ONE, "one Space from an empty pair of outputs", 30000)
    // The overlays arrive 200 ms after the slide (showActions.ts:461-470), so the
    // slide text alone is not evidence that the layer tree is complete.
    const overlays = await waitForOutputs(
        ctx,
        TWO_OUTPUT_IDS,
        (id, text) => text.includes(OVERLAY_UNDER_TEXT) && text.includes(OVERLAY_OVER_TEXT),
        "both overlays on both outputs",
        30000
    )
    return { observed: overlays.samples, slideSamples: slide.samples }
}

function verifyLocksStart(state) {
    for (const id of TWO_OUTPUT_IDS) {
        const output = outputById(state, id)
        check(!!output, `the "${id}" output page is open`, state.outputs.map((entry) => entry.id))
        if (!output) continue
        check(output.text.includes(LOCKS_SLIDE_ONE), `the slide layer's text is on "${id}"`, output.text)
        check(output.text.includes(OVERLAY_UNDER_TEXT), `the placeUnderSlide overlay's text reached "${id}" through the layout entry`, output.text)
        check(output.text.includes(OVERLAY_OVER_TEXT), `the ordinary overlay's text reached "${id}" through the layout entry`, output.text)
        check(!output.text.includes(LOCKS_SLIDE_TWO), `"${id}" is on the first slide only`, output.text)
    }
}

function verifyLayerOrderStep(state) {
    for (const id of TWO_OUTPUT_IDS) {
        checkLayerOrder((state.layerTrees || {})[id], id)
    }
}

function verifyLayerButtons(state) {
    const groups = (state.controller.clear && state.controller.clear.groups) || []
    const named = groups.filter((group) => !!group.layer)
    const order = named.map((group) => group.layer)
    check(order.length >= 5, "the clear controls still group one entry per layer", { groups, order })
    for (const layer of ["Background", "Slide", "Overlays", "Audio", "Next slide timer"]) {
        check(order.includes(layer), `the "${layer}" per-layer entry is present`, { order, groups })
    }
    const indexOf = (layer) => order.indexOf(layer)
    if (order.includes("Background") && order.includes("Slide") && order.includes("Overlays") && order.includes("Audio") && order.includes("Next slide timer")) {
        check(
            indexOf("Background") < indexOf("Slide") &&
                indexOf("Slide") < indexOf("Overlays") &&
                indexOf("Overlays") < indexOf("Audio") &&
                indexOf("Audio") < indexOf("Next slide timer"),
            "the layer entries are listed Background, Slide, Overlays, Audio, Next slide timer (ClearButtons.svelte:141-213)",
            order
        )
    }

    // The observable is enabled + titled vs disabled. ClearButtons.svelte:144-205
    // computes the title conditionally for Background/Slide/Overlays and
    // unconditionally for Audio/Next slide timer, so "titled" is asserted for all
    // five and the enabled/disabled flag is what carries the presence signal.
    const expectations = [
        { layer: "Background", disabled: false, title: "Clear background" },
        { layer: "Slide", disabled: false, title: "Clear slide" },
        { layer: "Overlays", disabled: false, title: "Clear overlays" },
        { layer: "Audio", disabled: true, title: "Clear audio" },
        { layer: "Next slide timer", disabled: true, title: "Clear next slide timer" }
    ]
    for (const expectation of expectations) {
        const group = clearGroupByName(named, expectation.layer)
        check(!!group, `the "${expectation.layer}" group is readable`, { order })
        if (!group) continue
        check(
            group.clearDisabled === expectation.disabled,
            `the "${expectation.layer}" clear button is ${expectation.disabled ? "disabled (the layer is empty)" : "enabled (the layer has content)"}`,
            group
        )
        check(
            String(group.clearTitle).startsWith(expectation.title),
            `the "${expectation.layer}" clear button is titled ${JSON.stringify(expectation.title)}…`,
            group
        )
    }
}

async function stepLockBlocksClick(ctx) {
    const before = await stableOutputs(ctx, TWO_OUTPUT_IDS, "before the locked click")
    // Card 1 is a different slide, so a working click would change both pages.
    // Two stable reads after the click are the measurement (settlePage cannot see
    // Svelte's transitions).
    const click = await clickSlideCard(ctx, 1, 2, LOCKS_SLIDE_TWO)
    const after = await stableOutputs(ctx, TWO_OUTPUT_IDS, "after the locked click")
    return { before, after, click }
}

function verifyLockBlocksClick(state) {
    check(state.lockTitle === "Unlock output [Ctrl+L]", "the output is still locked after the click", state.lockTitle)
    for (const id of TWO_OUTPUT_IDS) {
        const output = outputById(state, id)
        check(!!output, `the "${id}" output page is open`, state.outputs.map((entry) => entry.id))
        if (output) check(!output.text.includes(LOCKS_SLIDE_TWO), `the locked click did not put the other slide on "${id}"`, output.text)
        checkOutputUnchanged(state.before, state.after, id, "a click on a slide card while the output is locked")
    }
}

async function stepLockBlocksF3(ctx) {
    const before = await stableOutputs(ctx, TWO_OUTPUT_IDS, "before F3 while locked")
    await ctx.win.keyboard.press("F3")
    const after = await stableOutputs(ctx, TWO_OUTPUT_IDS, "after F3 while locked")
    return { before, after }
}

function verifyLockBlocksF3(state) {
    check(state.lockTitle === "Unlock output [Ctrl+L]", "the output is still locked after F3", state.lockTitle)
    for (const id of TWO_OUTPUT_IDS) {
        const output = outputById(state, id)
        check(!!output, `the "${id}" output page is open`, state.outputs.map((entry) => entry.id))
        check(
            !!output && output.text.includes(OVERLAY_OVER_TEXT),
            `F3 did not clear the overlays while the output is locked (the F3 handler returns on outLocked alone, utils/shortcuts.ts:378-383) on "${id}"`,
            output && output.text
        )
        checkOutputUnchanged(state.before, state.after, id, "F3 while the output is locked")
    }
}

async function stepLockAllowsOutputLock(ctx) {
    const click = await clickOutputTile(ctx, OUTPUT_PRIMARY.name, "toggle the first output's own lock while the global lock is on")
    await waitFor("the first output's tile to report itself inactive", async () => {
        const controller = await readController(ctx.win).catch(() => null)
        const tile = controller ? ((controller.preview && controller.preview.tiles) || []).find((entry) => entry.id === OUTPUT_PRIMARY.id) : null
        return !!(tile && tile.active === false)
    }, 15000)
    return click
}

function verifyLockAllowsOutputLock(state) {
    const primary = tileById(state, OUTPUT_PRIMARY.id)
    const secondary = tileById(state, OUTPUT_SECONDARY.id)
    check(!!primary && primary.active === false, "the per-output lock still works while the global lock is on (OutputPreviewLabel.svelte:13-38 has no outLocked guard)", primary)
    check(!!primary && primary.struck === true, "the deactivated output's name is struck through", primary)
    check(!!secondary && secondary.active === true, "the other output is still active", secondary)
    check(state.lockTitle === "Unlock output [Ctrl+L]", "the global lock is untouched by the per-output toggle", state.lockTitle)
}

async function stepClearSkipsInactiveOutput(ctx) {
    const pointers = await preparePointer(ctx)
    const button = await waitForLocator(ctx.win.locator("#previewArea .clear .clearAll"), "the Clear all button in the preview column", 15000)
    const before = await button.evaluate((element) => ({ disabled: element.disabled === true, title: element.getAttribute("data-title") || "" }))
    if (before.disabled) throw new StepFailure(`Clear all is disabled before the click: ${JSON.stringify(before)}`)
    if (!before.title.startsWith("Clear all")) {
        throw new StepFailure(`the .clearAll button is not "Clear all": ${JSON.stringify(before)} (Restore output would mean the output was already clear)`)
    }
    const beforeState = await stableOutputs(ctx, TWO_OUTPUT_IDS, "before Clear all")
    await clickInController(ctx, button)
    // The active output empties; wait for that rather than for a fixed time.
    await waitForOutputs(
        ctx,
        [OUTPUT_SECONDARY.id],
        (id, text) => !text.includes(LOCKS_SLIDE_ONE) && !text.includes(OVERLAY_OVER_TEXT) && !text.includes(OVERLAY_UNDER_TEXT),
        "the active output to be cleared",
        20000
    )
    const after = await stableOutputs(ctx, TWO_OUTPUT_IDS, "after Clear all")
    return { pointers, clearAll: before, before: beforeState, after }
}

function verifyClearSkipsInactiveOutput(state) {
    const inactive = state.after && state.after[OUTPUT_PRIMARY.id]
    const active = state.after && state.after[OUTPUT_SECONDARY.id]
    check(!!inactive && !!active, "both output pages were readable after Clear all", { inactive: !!inactive, active: !!active })
    if (!inactive || !active) return
    // The step deactivated `primary` and left `secondary` active; assert that
    // rather than trusting the narrative, so a wrong click cannot be read as a
    // passing "clear skipped the inactive output".
    check(tileById(state, OUTPUT_PRIMARY.id)?.active === false, "the first output is the inactive one", tileById(state, OUTPUT_PRIMARY.id))
    check(tileById(state, OUTPUT_SECONDARY.id)?.active === true, "the second output is the active one", tileById(state, OUTPUT_SECONDARY.id))

    // The inactive output keeps everything: it was removed from
    // getAllActiveOutputs, which is what clearAll/clearBackground/clearSlide/
    // clearOverlays iterate (clear.ts:13-34, :86-156).
    check(inactive.value.text.includes(LOCKS_SLIDE_ONE), "the inactive output still shows the slide", inactive.value)
    check(inactive.value.text.includes(OVERLAY_OVER_TEXT), "the inactive output still shows its overlays", inactive.value)
    check(inactive.value.text.includes(OVERLAY_UNDER_TEXT), "the inactive output still shows its underlay", inactive.value)
    check(
        inactive.value.images.some((src) => String(src).endsWith(MEDIA_LOGO_NAME)),
        "the inactive output still renders its background image",
        inactive.value.images
    )
    checkOutputUnchanged(state.before, state.after, OUTPUT_PRIMARY.id, "Clear all while the output is inactive")

    check(!active.value.text.includes(LOCKS_SLIDE_ONE), "the active output's slide was cleared", active.value)
    check(!active.value.text.includes(OVERLAY_OVER_TEXT), "the active output's overlays were cleared", active.value)
    check(!active.value.images.some((src) => String(src).endsWith(MEDIA_LOGO_NAME)), "the active output's background was cleared", active.value.images)
}

async function stepReselectAndPlay(ctx) {
    const click = await clickOutputTile(ctx, OUTPUT_PRIMARY.name, "reactivate the first output")
    await waitFor("the first output's tile to report itself active again", async () => {
        const controller = await readController(ctx.win).catch(() => null)
        const tile = controller ? ((controller.preview && controller.preview.tiles) || []).find((entry) => entry.id === OUTPUT_PRIMARY.id) : null
        return !!(tile && tile.active === true)
    }, 15000)
    const card = await clickSlideCard(ctx, 0, 2, LOCKS_SLIDE_ONE)
    await waitForOutputsText(ctx, TWO_OUTPUT_IDS, LOCKS_SLIDE_ONE, "playing the first slide after reactivating the output", 30000)
    const overlays = await waitForOutputs(
        ctx,
        TWO_OUTPUT_IDS,
        (id, text) => text.includes(OVERLAY_UNDER_TEXT) && text.includes(OVERLAY_OVER_TEXT),
        "both overlays after replaying the slide",
        30000
    )
    return { click, card, observed: overlays.samples }
}

function verifyReselectAndPlay(state) {
    check(tileById(state, OUTPUT_PRIMARY.id)?.active === true, "the first output is active again", tileById(state, OUTPUT_PRIMARY.id))
    for (const id of TWO_OUTPUT_IDS) {
        const output = outputById(state, id)
        check(!!output, `the "${id}" output page is open`, state.outputs.map((entry) => entry.id))
        if (!output) continue
        check(output.text.includes(LOCKS_SLIDE_ONE), `the fan-out is restored: "${id}" got the slide again`, output.text)
        check(output.text.includes(OVERLAY_OVER_TEXT), `"${id}" got the overlays again`, output.text)
    }
}

///////////////////////////////////////////////////////////////////////////////
// Scenarios
///////////////////////////////////////////////////////////////////////////////

const SCENARIOS = {
    "outputs-basic": {
        description:
            "Open a project show in the output window, read it, lock and unlock it, advance, and clear it. Record every step.",
        seed: { targetShow: TARGET_SHOW },
        steps: [
            { name: "ready", purpose: "controller up, seeded project listed", run: stepReady, verify: verifyReady },
            { name: "present", purpose: "open the physical output window", run: stepPresent, verify: verifyPresent },
            { name: "open_project", purpose: "open the seeded project", run: stepOpenProject, verify: verifyOpenProject },
            { name: "open_show", purpose: "select the fixture show in the project", run: stepOpenShow, verify: verifyOpenShow },
            { name: "start", purpose: "start the show with Space", run: stepStart, verify: verifyStart },
            { name: "lock", purpose: "lock the output with Ctrl+L", run: stepLock, verify: verifyLock },
            { name: "next_while_locked", purpose: "Space must not advance a locked output", run: stepNextWhileLocked, verify: verifyNextWhileLocked },
            { name: "unlock", purpose: "unlock the output with Ctrl+L", run: stepUnlock, verify: verifyUnlock },
            { name: "next", purpose: "Space advances to the second slide", run: stepNext, verify: verifyNext },
            { name: "clear_entries", purpose: "enumerate the per-layer clear entries", run: stepClearEntries, verify: verifyClearEntries },
            { name: "clear", purpose: "Escape empties the output", run: stepClear, verify: verifyClear }
        ]
    },
    "stage-multi-output": {
        description:
            "Two enabled normal outputs plus one stage output, seeded into the scratch profile. Open all three, start and advance the show, read each output's own text, toggle outputs in the preview, and disable/enable one output from Settings > Outputs. Records out.multiple, out.multiple.select, out.stage-window and stage.items.",
        seed: { targetShow: TARGET_SHOW, outputs: "stage" },
        steps: [
            { name: "ready", purpose: "controller up, seeded project listed", run: stepReady, verify: verifyReady },
            { name: "open_project", purpose: "open the seeded project", run: stepOpenProject, verify: verifyOpenProject },
            { name: "open_show", purpose: "select the fixture show in the project", run: stepOpenShow, verify: verifyOpenShow },
            {
                name: "present_outputs",
                purpose: "one Present click must open a window for every enabled output",
                run: stepPresentOutputs,
                verify: verifyPresentOutputs
            },
            { name: "start", purpose: "start the show and read all three outputs", run: stepStartMultiple, verify: verifyStartMultiple },
            { name: "advance", purpose: "advance: every active normal output follows", run: stepAdvanceMultiple, verify: verifyAdvanceMultiple },
            {
                name: "stage_tile_click",
                purpose: "a click on the stage tile's title bar must not deactivate it",
                run: stepStageTileClick,
                verify: verifyStageTileClick
            },
            {
                name: "deselect_secondary",
                purpose: "a plain click on a tile toggles that output's active state",
                run: stepDeselectSecondary,
                verify: verifyDeselectSecondary
            },
            {
                name: "advance_inactive",
                purpose: "an advance must skip an inactive output and still follow on stage",
                run: stepAdvanceWithInactive,
                verify: verifyAdvanceWithInactive
            },
            {
                name: "last_active_guard",
                purpose: "the last active normal output cannot be deactivated",
                run: stepLastActiveGuard,
                verify: verifyLastActiveGuard
            },
            {
                name: "reselect_secondary",
                purpose: "activating the output again restores the fan-out target",
                run: stepReselectSecondary,
                verify: verifyReselectSecondary
            },
            {
                name: "disable_output",
                purpose: "Settings > Outputs: disabling one output must not disturb the others",
                run: stepDisableOutput,
                verify: verifyDisableOutput
            },
            {
                name: "enable_output",
                purpose: "Settings > Outputs: re-enabling an output recreates its window",
                run: stepEnableOutput,
                verify: verifyEnableOutput
            },
            { name: "back_to_show", purpose: "return to the show page with all three outputs live", run: stepBackToShow, verify: verifyBackToShow }
        ]
    },
    "media-behaviour": {
        description:
            "One normal output, the media fixture with a looping background video and nextAfterMedia on its first slide, and a seeded media folder. Start the show, pause the clip through the media strip, exercise play/pause/loop/mute and the lock, play it out to observe the next-after-media advance, then click the drawer card to set and clear a background and play the project media item. Records media.play, media.background, media.controls and media.next-finished.",
        seed: { targetShow: MEDIA_SHOW_NAME, media: true },
        steps: [
            { name: "ready", purpose: "controller up, seeded project listed", run: stepReady, verify: verifyReady },
            { name: "present", purpose: "open the physical output window", run: stepPresent, verify: verifyPresent },
            { name: "open_project", purpose: "open the seeded project", run: stepOpenProject, verify: verifyOpenProject },
            {
                name: "open_show",
                purpose: "select the media fixture; no background exists yet, so no media strip",
                run: stepOpenShow,
                verify: verifyOpenShowNoBackground
            },
            {
                name: "start",
                purpose: "start the show, reveal the Background strip and pause the clip before it ends",
                run: stepStartPaused,
                verify: verifyStartPaused
            },
            {
                name: "media_background",
                purpose: "the seeded layout-slide background: loop, duration, decode, muted from the strip",
                run: stepMediaBackground,
                verify: verifyMediaBackground
            },
            {
                name: "media_playpause",
                purpose: "the strip's play/pause drives the live player",
                run: stepMediaPlayPause,
                verify: verifyMediaPlayPause
            },
            {
                name: "media_loop_mute",
                purpose: "loop and mute change the live player and not the stored media style",
                run: stepMediaLoopMute,
                verify: verifyMediaLoopMute
            },
            {
                name: "media_lock",
                purpose: "locking the output disables play/pause and mute but not loop",
                run: stepMediaLock,
                verify: verifyMediaLock
            },
            { name: "media_unlock", purpose: "unlocking restores the strip's buttons", run: stepMediaUnlock, verify: verifyMediaUnlock },
            {
                name: "media_next_finished",
                purpose: "a looping background with nextAfterMedia advances once at the end, timed against the clip",
                run: stepMediaNextFinished,
                verify: verifyMediaNextFinished
            },
            {
                name: "media_drawer_play",
                purpose: "one click on the drawer card sets the video background with the no-type defaults",
                run: stepMediaDrawerPlay,
                verify: verifyMediaDrawerPlay
            },
            {
                name: "media_drawer_clear",
                purpose: "clicking the same card again clears the background",
                run: stepMediaDrawerClear,
                verify: verifyMediaDrawerClear
            },
            {
                name: "media_project_item",
                purpose: "a project media item plays without looping and unmuted",
                run: stepMediaProjectItem,
                verify: verifyMediaProjectItem
            }
        ]
    },
    "styles-multi-output": {
        description:
            "Three normal outputs bound to three seeded styles (lines:2, aspectRatio 4:3, layers without background), showing one four-line slide whose background is an image. Present, start, then read each output's content box, line window and layers before and after one advance. Records out.styles, out.styles.aspect, out.styles.lines and out.styles.layers.",
        seed: { targetShow: STYLES_SHOW_NAME, mediaFiles: true, styles: true, outputs: "styles" },
        steps: [
            { name: "ready", purpose: "controller up, seeded project listed", run: stepReady, verify: verifyReady },
            { name: "open_project", purpose: "open the seeded project", run: stepOpenProject, verify: verifyOpenProject },
            { name: "open_show", purpose: "select the styles fixture", run: stepOpenShow, verify: verifyOpenShow },
            {
                name: "present_outputs",
                purpose: "one Present click opens a window for each of the three styled outputs",
                run: stepPresentStylesOutputs,
                verify: verifyPresentStylesOutputs
            },
            { name: "start", purpose: "start the show on all three outputs", run: stepStylesStart, verify: verifyStylesStart },
            {
                name: "styles_aspect",
                purpose: "the 4:3 style renders a 4:3 content box, the default style 16:9",
                run: stepStylesAspect,
                verify: verifyStylesAspect
            },
            {
                name: "styles_lines_window",
                purpose: "each output computes its own visible line window from its style",
                run: stepStylesLinesWindow,
                verify: verifyStylesLinesWindow
            },
            {
                name: "styles_lines_paging",
                purpose: "the paging step is shared: the 2-line output sets the page size for every output",
                run: stepStylesPaging,
                verify: verifyStylesPaging
            },
            {
                name: "styles_layers",
                purpose: "a style without the background layer does not render the slide's image background",
                run: stepStylesLayers,
                verify: verifyStylesLayers
            },
            {
                name: "styles_attach",
                purpose: "the three looks come from outputs[id].style, all reading the same slide",
                run: stepStylesSummary,
                verify: verifyStylesSummary
            }
        ]
    },
    "nav-disabled-slides": {
        description:
            "One default output and a show built in memory whose entries 0 and 3 are disabled. Read the show view's disabled markers (class + opacity + Enable button), then prove sequential navigation skips a disabled entry in both directions and that a click on its card still plays it. Records show.slides.disabled.",
        seed: { targetShow: NAV_SHOW_NAME, nav: "disabled" },
        steps: [
            { name: "ready", purpose: "controller up, seeded project listed", run: stepReady, verify: verifyReady },
            { name: "open_project", purpose: "open the seeded project", run: stepOpenProject, verify: verifyOpenProject },
            { name: "open_show", purpose: "select the Parity Nav show", run: stepOpenShow, verify: verifyOpenShow },
            { name: "present", purpose: "open the single default output window", run: stepPresent, verify: verifyPresent },
            {
                name: "disabled_markers",
                purpose: "the show view marks exactly entries 0 and 3 disabled (class, opacity 0.2, Enable button)",
                run: stepDisabledMarkers,
                verify: verifyDisabledMarkers
            },
            {
                name: "start_skips_disabled",
                purpose: "one Space from an empty output skips disabled entry 0 and lands on entry 1",
                run: stepNavStartSkipsDisabled,
                verify: verifyNavStartSkipsDisabled
            },
            { name: "next", purpose: "Space from entry 1 moves to entry 2", run: stepNavNext, verify: verifyNavNext },
            {
                name: "next_skips_disabled",
                purpose: "Space from entry 2 skips disabled entry 3 and lands on entry 4",
                run: stepNavNextSkipsDisabled,
                verify: verifyNavNextSkipsDisabled
            },
            {
                name: "previous_skips_disabled",
                purpose: "ArrowLeft from entry 4 skips disabled entry 3 and lands on entry 2",
                run: stepNavPreviousSkipsDisabled,
                verify: verifyNavPreviousSkipsDisabled
            },
            {
                name: "click_disabled_plays",
                purpose: "clicking the disabled entry 3's card body puts its text on the output",
                run: stepNavClickDisabled,
                verify: verifyNavClickDisabled
            },
            {
                name: "click_first_disabled_plays",
                purpose: "clicking the disabled entry 0's card body puts its text on the output",
                run: stepNavClickFirstDisabled,
                verify: verifyNavClickFirstDisabled
            },
            {
                name: "advance_from_disabled",
                purpose: "Space from a disabled slide that is being played still advances normally",
                run: stepNavAdvanceFromDisabled,
                verify: verifyNavAdvanceFromDisabled
            }
        ]
    },
    "nav-output-bindings": {
        description:
            "Two enabled normal outputs and a show built in memory with slide-level and item-level bindings (id, id+name, and a stale id). Present both, start, then click a slide bound to one output, advance across a bound slide, and run the two contradiction steps the reader's spec names: a slide bound to both outputs while one is inactive, and a binding that names an output which does not exist. Records out.multiple.specific.",
        seed: { targetShow: BIND_SHOW_NAME, nav: "bindings", outputs: "two" },
        steps: [
            { name: "ready", purpose: "controller up, seeded project listed", run: stepReady, verify: verifyReady },
            { name: "open_project", purpose: "open the seeded project", run: stepOpenProject, verify: verifyOpenProject },
            { name: "open_show", purpose: "select the Parity Bindings show", run: stepOpenShow, verify: verifyOpenShow },
            {
                name: "present_outputs",
                purpose: "one Present click opens a window for each of the two seeded outputs",
                run: stepNavPresentTwo,
                verify: verifyTwoOutputsPresent
            },
            {
                name: "start",
                purpose: "an unbound slide fans out to both outputs; an item bound to primary reaches only primary",
                run: stepBindingsStart,
                verify: verifyBindingsStart
            },
            {
                name: "click_bound_slide",
                purpose: "clicking a slide bound to primary changes primary and leaves secondary untouched",
                run: stepClickBoundSlide,
                verify: verifyClickBoundSlide
            },
            {
                name: "advance_skips_bound",
                purpose: "one advance skips the slide bound to another output on the unbound output",
                run: stepAdvanceSkipsBound,
                verify: verifyAdvanceSkipsBound
            },
            {
                name: "deactivate_secondary",
                purpose: "deactivate the second output from its tile title bar",
                run: stepDeactivateSecondary,
                verify: verifyDeactivateSecondary
            },
            {
                name: "bound_slide_to_inactive_output",
                purpose: "contradiction test: a slide bound to both outputs, one inactive — does the inactive one still receive it?",
                run: stepBoundSlideToInactiveOutput,
                verify: verifyBoundSlideToInactiveOutput
            },
            {
                name: "reselect_secondary",
                purpose: "reactivate the second output",
                run: stepBindingsReselectSecondary,
                verify: verifyBindingsReselectSecondary
            },
            {
                name: "stale_binding",
                purpose: "contradiction test: a binding that names a nonexistent output — nothing, or the active outputs?",
                run: stepStaleBinding,
                verify: verifyStaleBinding
            }
        ]
    },
    "lock-and-layers": {
        description:
            "Two enabled normal outputs and a show built in memory whose first slide has an image background and two overlays (one placeUnderSlide). Start, read the layer containers' presence and document order, read the per-layer clear buttons, then prove the lock guards: Ctrl+L blocks a slide click and F3, the per-output lock still works under the global lock, and Clear all skips the inactive output. Records out.lock and out.layers.",
        seed: { targetShow: LOCKS_SHOW_NAME, nav: "locks", outputs: "two", mediaFiles: true },
        steps: [
            { name: "ready", purpose: "controller up, seeded project listed", run: stepReady, verify: verifyReady },
            { name: "open_project", purpose: "open the seeded project", run: stepOpenProject, verify: verifyOpenProject },
            { name: "open_show", purpose: "select the Parity Locks show", run: stepOpenShow, verify: verifyOpenShow },
            {
                name: "present_outputs",
                purpose: "one Present click opens a window for each of the two seeded outputs",
                run: stepNavPresentTwo,
                verify: verifyTwoOutputsPresent
            },
            {
                name: "start",
                purpose: "Space puts slide 0 on both outputs; the overlays arrive 200 ms later through the layout entry",
                run: stepLocksStart,
                verify: verifyLocksStart
            },
            {
                name: "layer_order",
                purpose: "each page renders background, placeUnderSlide overlay, slide, overlay in that document order",
                run: stepLayerOrder,
                verify: verifyLayerOrderStep
            },
            {
                name: "layer_buttons",
                purpose: "the controller lists the five layers in order and enables a clear button only for a layer with content",
                run: stepLayerButtons,
                verify: verifyLayerButtons
            },
            { name: "lock_global", purpose: "lock the output with Ctrl+L", run: stepLock, verify: verifyLock },
            {
                name: "lock_blocks_click",
                purpose: "a locked output ignores a click on a different slide card",
                run: stepLockBlocksClick,
                verify: verifyLockBlocksClick
            },
            {
                name: "lock_blocks_f3",
                purpose: "a locked output ignores F3 (the per-layer clear whose only guard is outLocked)",
                run: stepLockBlocksF3,
                verify: verifyLockBlocksF3
            },
            {
                name: "lock_allows_output_lock",
                purpose: "the global lock does not guard the per-output lock toggle",
                run: stepLockAllowsOutputLock,
                verify: verifyLockAllowsOutputLock
            },
            { name: "unlock", purpose: "unlock the output with Ctrl+L", run: stepUnlock, verify: verifyUnlock },
            {
                name: "clear_skips_inactive_output",
                purpose: "Clear all empties the active output and leaves the inactive one untouched",
                run: stepClearSkipsInactiveOutput,
                verify: verifyClearSkipsInactiveOutput
            },
            {
                name: "reselect_and_play",
                purpose: "reactivating the output and replaying the slide restores the fan-out",
                run: stepReselectAndPlay,
                verify: verifyReselectAndPlay
            }
        ]
    }
}

///////////////////////////////////////////////////////////////////////////////
// Main
///////////////////////////////////////////////////////////////////////////////

async function closeApp(app, log) {
    if (!app) return
    try {
        await withTimeout(app.close(), 20000, "app.close()")
        log("reference closed through Playwright")
    } catch (err) {
        log(`app.close() failed: ${describeError(err)}; asking the app to quit`)
        try {
            await withTimeout(app.evaluate(({ app }) => app.quit()), 10000, "app.quit()")
            log("reference asked to quit")
        } catch (quitError) {
            log(`app.quit() failed: ${describeError(quitError)}`)
        }
    }
}

async function main() {
    let options
    try {
        options = parseArgs(process.argv.slice(2))
    } catch (err) {
        console.error(`observe_reference: ${err.message}\n`)
        printUsage()
        return 2
    }
    if (options.help) {
        printUsage()
        return 0
    }

    mkdirSync(options.outDir, { recursive: true })
    const log = makeLog(options.outDir)
    const scenario = SCENARIOS[options.scenario]
    const startedAt = new Date().toISOString()

    let reference
    let seed
    try {
        reference = inspectReference(options.freeshow)
        log(`reference: FreeShow ${reference.version} at ${reference.path} (commit ${reference.commit || "unknown"})`)
        seed = seedProfile(options)
        writeJson(join(options.outDir, "seed.json"), seed)
        log(`profile reseeded: ${seed.store} (data ${seed.dataPath})`)
        log(`seeded shows: ${seed.shows.map((show) => `${show.name} [${show.id}]`).join(", ")}`)
        if (seed.multiOutput) {
            log(
                `seeded outputs: ${seed.multiOutput.outputs
                    .map((output) => `${output.name}${output.stageOutput ? ` (stage layout ${output.stageOutput})` : ""}`)
                    .join(", ")}`
            )
            log(
                `seeded stage layout: ${seed.multiOutput.layout.name} [${seed.multiOutput.layout.id}] with ${seed.multiOutput.layout.items
                    .map((item) => `${item.id} (${item.type}, slideOffset ${item.slideOffset})`)
                    .join(", ")}`
            )
        }
        const repaired = seed.shows.filter((show) => show.groupRepairs && show.groupRepairs.length)
        if (repaired.length) {
            log(`repaired fixture groups for FreeShow's loader: ${repaired.map((show) => `${show.name} (${show.groupRepairs.length} child slides)`).join(", ")}`)
        }
        if (seed.media) {
            log(
                `media fixtures: ${seed.media.files
                    .map((file) => `${file.path} (${file.bytes} bytes, ${file.wrote ? "generated" : "kept"})`)
                    .join(", ")}; folder ${seed.media.folder.name} -> ${seed.media.folder.path}`
            )
            log(
                `media layout slide ${seed.media.layoutSlides[0].id}: background=${seed.media.layoutSlides[0].background}, actions=${JSON.stringify(
                    seed.media.layoutSlides[0].actions
                )}`
            )
        } else if (seed.mediaFiles) {
            log(`media fixtures: ${seed.mediaFiles.files.map((file) => `${file.path} (${file.bytes} bytes, ${file.wrote ? "generated" : "kept"})`).join(", ")}`)
        }
        if (seed.styles) {
            log(
                `seeded styles: ${Object.entries(seed.styles.styles)
                    .map(([id, style]) => `${id} (${JSON.stringify(style)})`)
                    .join(", ")}`
            )
            log(`seeded style bindings: ${seed.styles.bindings.map((binding) => `${binding.name}=${binding.style}`).join(", ")}`)
        }
        if (seed.nav) {
            log(`seeded nav fixture (${seed.nav.kind}): ${seed.nav.show.name} [${seed.nav.show.id}], layout ${seed.nav.layoutId}`)
            log(
                `nav entries: ${seed.nav.entries
                    .map(
                        (entry) =>
                            `${entry.index}:${entry.text || entry.id}${entry.disabled ? " disabled" : ""}${
                                entry.bindings ? ` bindings=${JSON.stringify(entry.bindings)}` : ""
                            }${entry.background ? ` background=${entry.background}` : ""}${entry.overlays ? ` overlays=${JSON.stringify(entry.overlays)}` : ""}`
                    )
                    .join(" | ")}`
            )
            if (seed.nav.overlays) {
                log(
                    `nav overlays: ${Object.entries(seed.nav.overlays)
                        .map(([id, overlay]) => `${id} (${overlay.name}, placeUnderSlide=${overlay.placeUnderSlide === true})`)
                        .join(", ")}`
                )
            }
            if (seed.nav.outputs) log(`nav outputs: ${seed.nav.outputs.map((output) => `${output.name} (${output.id}, active=${output.active})`).join(", ")}`)
        }
        if (seed.skipped.length) log(`skipped fixtures: ${seed.skipped.map((item) => `${item.file} (${item.reason})`).join(", ")}`)
    } catch (err) {
        const message = describeError(err)
        log(`FAILED before launch: ${message}`)
        writeJson(join(options.outDir, "run.json"), { status: "failed", scenario: options.scenario, startedAt, finishedAt: new Date().toISOString(), error: message })
        return 1
    }

    let app = null
    const ctx = {
        app: null,
        win: null,
        outDir: options.outDir,
        options,
        steps: [],
        startedAt,
        seed,
        // Steps log through the run's own writer so the helpers do not need it
        // threaded through every signature.
        log
    }

    try {
        app = await _electron.launch({
            executablePath: reference.electron,
            args: ["."],
            cwd: reference.path,
            env: { ...process.env, FS_MOCK_STORE_PATH: seed.store, NODE_ENV: "production" },
            timeout: 60000
        })
        ctx.app = app
        attachProcessLog(app, join(options.outDir, "electron.log"))

        const main = await waitFor("the controller window", async () => (await findPages(app)).main, 90000)
        ctx.win = main

        await main.setViewportSize(CONTROLLER_VIEWPORT).catch((err) => log(`could not set the controller viewport: ${describeError(err)}`))
        await withTimeout(main.waitForSelector("#output_window_button", { timeout: 30000 }), 40000, "waiting for the controller UI")
        await withTimeout(main.waitForSelector('[data-title^="Presenting"]', { timeout: 30000 }), 40000, "waiting for the show page")

        const viewport = await withTimeout(
            main.evaluate(() => ({ innerWidth: window.innerWidth, innerHeight: window.innerHeight, devicePixelRatio: window.devicePixelRatio })),
            5000,
            "reading the controller viewport"
        ).catch(() => null)
        const displays = await withTimeout(
            app.evaluate(({ screen }) => ({ primary: screen.getPrimaryDisplay(), all: screen.getAllDisplays() })),
            10000,
            "reading the displays"
        ).catch(() => null)
        const fonts = await withTimeout(
            main.evaluate(() => ({ status: document.fonts.status, families: [...new Set([...document.fonts].map((font) => font.family))].sort() })),
            10000,
            "reading the fonts"
        ).catch(() => null)

        log(`scenario: ${options.scenario} (${scenario.steps.length} steps) — ${scenario.description}`)
        for (const step of scenario.steps) {
            await runStep(ctx, step)
        }

        const failed = ctx.steps.filter((step) => step.status !== "ok")
        const screenshots = {
            written: ctx.steps.reduce(
                (count, step) =>
                    count +
                    (step.screenshot && step.screenshot.controller ? 1 : 0) +
                    (step.screenshot && step.screenshot.output ? 1 : 0) +
                    ((step.screenshot && step.screenshot.otherOutputs) || []).filter((entry) => entry.ok).length,
                0
            ),
            problems: ctx.steps.flatMap((step) => ((step.screenshot && step.screenshot.errors) || []).map((error) => ({ step: step.step, error })))
        }
        const run = {
            status: failed.length ? "failed" : "passed",
            scenario: options.scenario,
            startedAt,
            finishedAt: new Date().toISOString(),
            reference: {
                path: reference.path,
                version: reference.version,
                commit: reference.commit,
                commitMatchesPin: reference.commitMatchesPin,
                pinnedCommit: PINNED_COMMIT,
                built: reference.built
            },
            profile: {
                store: seed.store,
                dataPath: seed.dataPath,
                project: seed.project,
                shows: seed.shows,
                skipped: seed.skipped,
                multiOutput: seed.multiOutput,
                media: seed.media ? { files: seed.media.files, folder: seed.media.folder, projectItem: seed.media.projectItem } : null,
                mediaFiles: seed.mediaFiles ? seed.mediaFiles.files : null,
                styles: seed.styles ? { styles: seed.styles.styles, bindings: seed.styles.bindings } : null,
                nav: seed.nav || null
            },
            harness: {
                script: "parity/tools/observe_reference.mjs",
                node: process.version,
                platform: process.platform,
                playwright: require.resolve("playwright"),
                display: process.env.DISPLAY || null,
                waylandDisplay: process.env.WAYLAND_DISPLAY || null,
                locale: Intl.DateTimeFormat().resolvedOptions().locale
            },
            controller: { viewport, displays, fonts },
            steps: ctx.steps.map((step) => ({ index: step.index, step: step.step, status: step.status, error: step.error || null })),
            screenshots,
            failed: failed.map((step) => step.step)
        }
        writeJson(join(options.outDir, "run.json"), run)
        printSummary(ctx)
        return failed.length ? 1 : 0
    } catch (err) {
        const message = describeError(err)
        log(`FAILED: ${message}`)
        writeJson(join(options.outDir, "run.json"), {
            status: "failed",
            scenario: options.scenario,
            startedAt,
            finishedAt: new Date().toISOString(),
            error: message,
            steps: ctx.steps.map((step) => ({ index: step.index, step: step.step, status: step.status }))
        })
        return 1
    } finally {
        await closeApp(app, log)
    }
}

main()
    .then((code) => {
        process.exitCode = code
    })
    .catch((err) => {
        console.error(`observe_reference: ${describeError(err)}`)
        process.exitCode = 1
    })
