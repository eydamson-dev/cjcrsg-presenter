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
//   cd parity/tools && node observe_reference.mjs <outdir> [--scenario outputs-basic]
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

    writeJson(join(store, "config.json"), config)
    writeJson(join(store, "settings.json"), settings)
    writeJson(join(store, "projects.json"), projects)
    // Portable stores follow the same cwd rule; write empties so the profile is
    // self-describing rather than relying on defaults.
    writeJson(join(store, "themes.json"), {})
    writeJson(join(store, "templates.json"), {})

    const target = fixtures.find((fixture) => fixture.name === TARGET_SHOW)
    if (!target) throw new Error(`fixture named "${TARGET_SHOW}" was not seeded`)

    const seededShows = fixtures.map((fixture) => ({
        file: fixture.file,
        id: fixture.id,
        name: fixture.name,
        slides: Object.keys(fixture.show.slides || {}).length,
        mediaPaths: fixture.mediaPaths,
        groupRepairs: groupRepairs[fixture.id]
    }))

    // Read the files back. A seed that did not land is the difference between an
    // observation and an assertion about an empty profile.
    const projectCheck = JSON.parse(readFileSync(join(store, "projects.json"), "utf8"))
    const showFiles = readdirSync(join(dataPath, "Shows")).sort()

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
            projectButtons
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
        if (!root) return { root: false, text: "", lines: [], rootClass: null, mainBackground: null }

        const raw = root.innerText || (document.body ? document.body.innerText : "")
        const lines = raw
            .split(/\n+/)
            .map((line) => clean(line))
            .filter(Boolean)
        const main = document.querySelector("main")
        return {
            root: true,
            text: clean(raw),
            lines,
            rootClass: root.className,
            mainBackground: main ? getComputedStyle(main).backgroundColor : null
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
    const output = found.outputs[0] || null

    let controller = { error: "controller window not found" }
    if (main) {
        controller = await withTimeout(readController(main), 10000, "reading the controller").catch((err) => ({ error: firstLine(err) }))
    }

    let outputState = null
    if (output) {
        outputState = await withTimeout(readOutput(output), 10000, "reading the output").catch((err) => ({ error: firstLine(err) }))
    }

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
            : { present: false, text: null, lines: [] }
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
    console.log(`[${pad(record.index)}] ${record.step.padEnd(18)} ${status} windows=${record.windowCount ?? "?"} lock=${JSON.stringify(record.lockTitle)} output=${text}`)
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
            written: ctx.steps.reduce((count, step) => count + (step.screenshot && step.screenshot.controller ? 1 : 0) + (step.screenshot && step.screenshot.output ? 1 : 0), 0),
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
            profile: { store: seed.store, dataPath: seed.dataPath, project: seed.project, shows: seed.shows, skipped: seed.skipped },
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
