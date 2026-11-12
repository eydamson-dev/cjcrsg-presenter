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
// styles-multi-output.
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
                styles: seed.styles ? { styles: seed.styles.styles, bindings: seed.styles.bindings } : null
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
