// Capture FreeShow's output window and its four browser clients.
//
// Requires the seeded profile from docs/reference.md. The app is launched with
// Playwright's Electron support, then Chromium opens each client port. The remote
// password is read from the profile's settings.json; if a client asks for it, the
// script fills it in.
//
// Usage:
//   cd parity/tools && node capture_freeshow_clients.mjs

import { createRequire } from "module"
import { mkdirSync, readFileSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(here, "package.json"))
const { _electron, chromium } = require("playwright")

const repo = join(here, "..", "..")
const outDir = join(repo, "docs", "freeshow-reference", "screenshots")
const freeshow = process.env.FREESHOW_PATH || join(process.env.HOME, "projects", "reference", "freeshow")
const store = process.env.FS_STORE || "/tmp/opencode/fs-store"

mkdirSync(outDir, { recursive: true })

let remotePassword = ""
try {
    const settings = JSON.parse(readFileSync(join(store, "settings.json"), "utf8"))
    remotePassword = settings?.serverData?.remote?.password || ""
} catch {
    // The clients can still be captured with an empty password.
}

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

// Open the first show and start it, so the output has content.
try {
    await win.click('button[data-title*="<b>Shows</b>"]', { timeout: 8000 })
    await wait(500)
    await win.locator("button", { hasText: "Welcome" }).first().click({ timeout: 8000 })
    await wait(800)
    await win.keyboard.press("Space")
    await wait(1200)
} catch (err) {
    console.log("SKIP starting a show:", String(err).split("\n")[0])
}

const before = app.windows().length
try {
    await win.click("#output_window_button", { timeout: 8000 })
    await wait(3000)
} catch (err) {
    console.log("SKIP presenting:", String(err).split("\n")[0])
}

// Playwright does not attach to FreeShow's output windows (they are panel-type
// windows), so ask the main process to capture the page directly.
try {
    const base64 = await app.evaluate(async ({ BrowserWindow }) => {
        const target = BrowserWindow.getAllWindows().find((w) => w.getTitle() !== "FreeShow" && w.isVisible())
        if (!target) return ""
        const image = await target.webContents.capturePage()
        return image.toPNG().toString("base64")
    })
    if (base64) {
        writeFileSync(join(outDir, "output-window.png"), Buffer.from(base64, "base64"))
        console.log("captured output-window")
    } else {
        console.log("SKIP output window (no visible output window)")
    }
} catch (err) {
    console.log("SKIP output window:", String(err).split("\n")[0])
}

// The four clients.
const browser = await chromium.launch({ headless: true })
const clients = [
    ["remote", 5510, "client-remote"],
    ["stage", 5511, "client-stage"],
    ["controller", 5512, "client-controller"],
    ["output stream", 5513, "client-output-stream"]
]

for (const [name, port, file] of clients) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    try {
        await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "domcontentloaded", timeout: 15000 })
        await wait(3500)
        // A client may ask for the remote password before showing its UI.
        const passwordInput = page.locator('input[type="password"]')
        if ((await passwordInput.count()) > 0 && remotePassword) {
            await passwordInput.first().fill(remotePassword)
            await page.keyboard.press("Enter")
            await wait(2500)
        }
        const text = (await page.locator("body").innerText().catch(() => "")).trim().replace(/\s+/g, " ").slice(0, 120)
        console.log(`${name} ${port}: ${text}`)
        await page.screenshot({ path: join(outDir, `${file}.png`) })
    } catch (err) {
        console.log(`SKIP ${name}:`, String(err).split("\n")[0])
    }
    await page.close()
}

await browser.close()
await app.close()
