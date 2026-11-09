// Capture FreeShow's main window surfaces for the reference documentation.
//
// It launches the pinned reference with the seeded profile from docs/reference.md
// and saves PNGs into docs/freeshow-reference/screenshots/.
//
// Usage:
//   cd parity/tools && node capture_freeshow_ui.mjs
//
// The selectors use FreeShow's own `data-title` attributes, so they do not depend
// on pixel coordinates. A failed step is reported and skipped; the script still
// closes the app.

import { createRequire } from "module"
import { mkdirSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(here, "package.json"))
const { _electron } = require("playwright")

const repo = join(here, "..", "..")
const outDir = join(repo, "docs", "freeshow-reference", "screenshots")
const freeshow = process.env.FREESHOW_PATH || join(process.env.HOME, "projects", "reference", "freeshow")
const store = process.env.FS_STORE || "/tmp/opencode/fs-store"

mkdirSync(outDir, { recursive: true })

const app = await _electron.launch({
    executablePath: join(freeshow, "node_modules", "electron", "dist", "electron"),
    args: ["."],
    cwd: freeshow,
    env: { ...process.env, FS_MOCK_STORE_PATH: store, NODE_ENV: "production" },
    timeout: 60000
})

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
await wait(8000)

const win = app.windows().find((w) => !w.url().includes("loading")) || app.windows()[0]
await win.setViewportSize({ width: 1600, height: 900 })
await win.waitForSelector('[data-title^="Presenting"]', { timeout: 30000 })
await wait(800)

const shots = []
async function shot(name) {
    const file = join(outDir, `${name}.png`)
    await wait(600)
    await win.screenshot({ path: file })
    shots.push(name)
    console.log("captured", name)
}

async function click(selector, label) {
    try {
        await win.click(selector, { timeout: 8000 })
        await wait(700)
        return true
    } catch (err) {
        console.log("SKIP", label, String(err).split("\n")[0])
        return false
    }
}

// Show view, then each drawer tab.
await shot("main-show-view")

const tabs = [
    ["Shows", "drawer-shows"],
    ["Media", "drawer-media"],
    ["Audio", "drawer-audio"],
    ["Overlays", "drawer-overlays"],
    ["Templates", "drawer-templates"],
    ["Scripture", "drawer-scripture"],
    ["Calendar", "drawer-calendar"],
    ["Functions", "drawer-functions"]
]
for (const [tab, name] of tabs) {
    // Drawer tab titles contain markup, e.g. <b>Media</b> plus a description.
    const ok = await click(`button[data-title*="<b>${tab}</b>"]`, `drawer ${tab}`)
    if (ok) await shot(name)
}

// Back to Shows, open a show, capture the grid, then the editor.
await click('button[data-title*="<b>Shows</b>"]', "drawer Shows")
try {
    await win.locator("button", { hasText: "Welcome" }).first().click({ timeout: 8000 })
    await wait(900)
    await shot("show-grid")
} catch (err) {
    console.log("SKIP open show", String(err).split("\n")[0])
}

await click('[data-title^="Editing"]', "edit view")
await shot("show-edit")

await click('[data-title^="Stage view"]', "stage view")
await shot("stage-view")

// Settings tabs.
await click('[data-title^="Settings"]', "settings")
await shot("settings-general")
for (const [label, name] of [
    ["Outputs", "settings-outputs"],
    ["Styles", "settings-styles"],
    ["Connection", "settings-connection"],
    ["Files", "settings-files"]
]) {
    const ok = await click(`button:has-text("${label}")`, `settings ${label}`)
    if (ok) await shot(name)
}

// New show dialog.
await click('[data-title^="Presenting"]', "back to show")
await click('button[data-title^="Create a new show"]', "new show")
await shot("new-show-dialog")
await win.keyboard.press("Escape")

// Output window: start the show, then present.
await click('button[data-title*="<b>Shows</b>"]', "drawer Shows")
try {
    await win.locator("button", { hasText: "Welcome" }).first().click({ timeout: 8000 })
    await wait(700)
    await win.keyboard.press("Space")
    await wait(1200)
} catch (err) {
    console.log("SKIP start show", String(err).split("\n")[0])
}
const before = app.windows().length
await click("#output_window_button", "present")
await wait(2500)
const output = app.windows().find((w) => w !== win && !w.url().includes("loading"))
if (output && app.windows().length > before) {
    await output.screenshot({ path: join(outDir, "output-window.png") })
    shots.push("output-window")
    console.log("captured output-window")
} else {
    console.log("SKIP output window (no new window)")
}

await app.close()
console.log(`captured ${shots.length} screenshots in ${outDir}`)
