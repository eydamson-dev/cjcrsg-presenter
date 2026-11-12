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
//   cd parity/tools && node observe_reference.mjs <outdir> [--scenario outputs-basic|stage-multi-output]
//
// The scratch profile is deleted and reseeded on every run. The reference
// checkout is only read: its package.json and built public/index.html are
// inspected, and Electron is launched with cwd there.

import { createRequire } from "module"
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs"
import { homedir } from "os"
import { basename, dirname, join, resolve, sep } from "path"
import { fileURLToPath } from "url"

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

    const fixtures = SHOW_FIXTURES.map(readFixture)
    const skipped = []

    // FreeShow reads absolute media paths. If the machine has them, the media
    // fixture is a normal show; if not, seeding it would put a broken show in
    // front of the reader.
    if (existsSync(join(fixturesDir, OPTIONAL_MEDIA_FIXTURE))) {
        const mediaFixture = readFixture(OPTIONAL_MEDIA_FIXTURE)
        const missing = mediaFixture.mediaPaths.filter((path) => !existsSync(path))
        if (missing.length) {
            skipped.push({ file: mediaFixture.file, reason: `missing media: ${missing.join(", ")}` })
        } else {
            fixtures.push(mediaFixture)
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
    const projects = {
        projects: {
            [PROJECT_ID]: {
                name: PROJECT_NAME,
                created: 1730000000000,
                parent: "/",
                shows: fixtures.map((fixture) => ({ id: fixture.id }))
            }
        },
        folders: {},
        projectTemplates: {}
    }

    // Only the stage/multi-output scenario gets outputs and a stage layout: a seed
    // with three outputs would change what `outputs-basic` observes, and that
    // scenario is committed evidence.
    const multiOutput = options.scenario === "stage-multi-output" ? seedMultiOutput(store) : null
    if (multiOutput) settings.outputs = multiOutput.outputs

    writeJson(join(store, "config.json"), config)
    writeJson(join(store, "settings.json"), settings)
    writeJson(join(store, "projects.json"), projects)
    // Portable stores follow the same cwd rule; write empties so the profile is
    // self-describing rather than relying on defaults.
    writeJson(join(store, "themes.json"), {})
    writeJson(join(store, "templates.json"), {})

    const target = fixtures.find((fixture) => fixture.name === TARGET_SHOW)
    if (!target) throw new Error(`fixture named "${TARGET_SHOW}" was not seeded`)

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
        targetShow: { name: TARGET_SHOW, id: target.id, file: target.file }
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
        if (!root) return { root: false, text: "", lines: [], rootClass: null, mainBackground: null, outputId: null, stageArea: false }

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
        return {
            root: true,
            text: clean(raw),
            lines,
            rootClass: root.className,
            mainBackground: main ? getComputedStyle(main).backgroundColor : null,
            outputId: zoomed ? zoomed.id : null,
            // A stage output renders StageLayout (MainOutput.svelte:143-144),
            // whose root is `.stageArea` (stage/StageLayout.svelte:147).
            stageArea: !!document.querySelector(".stageArea")
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
    await waitForLocator(showItem, `the show "${TARGET_SHOW}" in the project`, 20000)
    await waitFor(
        `the name of "${TARGET_SHOW}" to load in the project`,
        async () => (await showItem.innerText()).includes(TARGET_SHOW),
        20000
    )
}

function verifyOpenProject(state) {
    check(state.controller.projectArea, "the project's show list opened", state.controller.projectItems)
    check(
        state.controller.projectItems.some((text) => text.includes(TARGET_SHOW)),
        `the project lists the show "${TARGET_SHOW}"`,
        state.controller.projectItems
    )
}

async function stepOpenShow(ctx) {
    const show = ctx.win.locator(`#projectArea div[id="show_${ctx.seed.targetShow.id}"] button`).first()
    const button = await waitForLocator(show, `the show "${TARGET_SHOW}" in the project`, 20000)
    await clickUnobstructed(ctx, button)
    // ShowButton.click loads the show asynchronously before it can be played.
    await wait(800)
}

function verifyOpenShow(state) {
    check(state.controller.projectArea, "the project is still open", state.controller.projectItems)
    check(
        state.controller.activeProjectItems.some((text) => text.includes(TARGET_SHOW)),
        `"${TARGET_SHOW}" is the active project item`,
        state.controller.activeProjectItems
    )
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
        list.push({ id: state.outputId || null, text: state.text || "", stageArea: !!state.stageArea })
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

async function stepPresentOutputs(ctx) {
    ctx.popups = await dismissStartupPopups(ctx.win, ctx.log)
    const before = await readPresentState(ctx.win)
    if (!before) throw new StepFailure("the Present button is not in the controller")
    if (before.on) throw new StepFailure(`the outputs were already presenting before the step: ${JSON.stringify(before)}`)

    // One click, three enabled outputs: `toggleOutputs(null)` fans out to every
    // enabled output, stage included (helpers/output.ts:115-134).
    await clickInController(ctx, "#output_window_button")

    await waitForOutputPages(ctx, 3)
    const expected = [OUTPUT_PRIMARY.name, OUTPUT_SECONDARY.name, OUTPUT_STAGE.name]
    await waitFor(
        `the three output windows to take their seeded titles`,
        async () => {
            const titles = await windowTitles(ctx.app)
            return expected.every((name) => titles.includes(name))
        },
        45000
    )
    await waitFor(
        "the three output pages to finish loading",
        async () => {
            const pages = (await findPages(ctx.app)).outputs
            if (pages.length !== 3) return false
            const states = await Promise.all(pages.map((page) => page.evaluate(() => document.readyState).catch(() => "")))
            return states.every((state) => state === "complete")
        },
        45000
    )
    // MainOutput only mounts the slide after its own 2 s "loaded" delay
    // (MainOutput.svelte:55-61), and it needs its own output data from the main
    // process first. Wait until every page names the output it renders.
    await waitFor(
        "the three output pages to name the output they render",
        async () => {
            const ids = await readOutputSnapshot(ctx)
            return ids.length === 3 && ids.every((output) => !!output.id)
        },
        60000
    )

    // The reference hides an output it cannot place on a display and opens the
    // screen picker instead. Record the popup, then close it so later clicks land.
    const dismissed = await dismissOverlayPopups(ctx)
    const after = await readPresentState(ctx.win)
    return { presentButton: after, overlayPopupsDismissed: dismissed }
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
// Scenarios
///////////////////////////////////////////////////////////////////////////////

const SCENARIOS = {
    "outputs-basic": {
        description:
            "Open a project show in the output window, read it, lock and unlock it, advance, and clear it. Record every step.",
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
            profile: { store: seed.store, dataPath: seed.dataPath, project: seed.project, shows: seed.shows, skipped: seed.skipped, multiOutput: seed.multiOutput },
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
