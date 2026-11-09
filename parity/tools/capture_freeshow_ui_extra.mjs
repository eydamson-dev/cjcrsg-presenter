// Extra FreeShow main-window captures: item menu, chords mode, transitions, quick search.
//
// Uses the same seeded profile and Playwright Electron setup as
// capture_freeshow_ui.mjs. Each panel is opened by its own data-title, so the
// capture does not depend on coordinates.

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

async function shot(name) {
    await wait(700)
    await win.screenshot({ path: join(outDir, `${name}.png`) })
    console.log("captured", name)
}
async function click(selector) {
    try {
        await win.click(selector, { timeout: 8000 })
        await wait(600)
        return true
    } catch (err) {
        console.log("SKIP", selector, String(err).split("\n")[0])
        return false
    }
}

// Open a show.
await click('button[data-title*="<b>Shows</b>"]')
try {
    await win.locator("button", { hasText: "Welcome" }).first().click({ timeout: 8000 })
    await wait(700)
} catch (err) {
    console.log("SKIP open show", String(err).split("\n")[0])
}

// Edit > Add items.
await click('[data-title^="Editing"]')
if (await click('[data-title="Add items"]')) await shot("edit-add-items")
await win.keyboard.press("Escape")
await wait(400)

// Edit > Chords mode.
if (await click('[data-title="Chords"]')) await shot("show-chords-mode")

// Show > Groups and Metadata panels.
await click('[data-title^="Presenting"]')
if (await click('button:has-text("Groups")')) await shot("show-groups-panel")
if (await click('button:has-text("Metadata")')) await shot("show-metadata-panel")

// Show > Transition popup.
if (await click('[data-title="Transition"]')) await shot("outputs-transitions")
await win.keyboard.press("Escape")
await wait(500)

// Quick search.
try {
    await win.keyboard.press("Control+g")
    await wait(1200)
    await shot("quick-search")
} catch (err) {
    console.log("SKIP quick search", String(err).split("\n")[0])
}

await app.close()
console.log("done")
