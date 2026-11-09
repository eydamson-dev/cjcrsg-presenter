# Keyboard shortcuts

- **ID:** `tips.shortcuts`
- **Area:** advanced
- **Online docs:** <https://freeshow.app/docs/shortcuts>
- **Pinned code:** ff784eb
- **Confidence:** `code`

## Summary

The key map is not one table. There is a global handler, plus separate handlers
in the drawer, the output preview, the quick search and the scripture drawer,
each with its own guards. Several keys mean different things in different
panels, and the keys the app shows the user (the `Ctrl+?` popup) are a third
list, which differs from the published table in a few places.

`src/frontend/values/keys.ts` is **not** the shortcut source: it decodes API
keys (`getKey("bibleapi")` etc.). The shortcut code is
`src/frontend/utils/shortcuts.ts`, and the in-app list is
`src/frontend/components/main/popups/Shortcuts.svelte`.

## What the user sees

Press `Ctrl+?` (or use Help → Shortcuts) and a popup lists key bindings grouped
by separators: Ctrl, shift, ctrl+alt, alt, clear, then numbers. The list is built
from a literal object, so it is the app's own claim about its keys.

Screenshot: `../screenshots/advanced-shortcuts-popup.png` — not yet captured.
Shot list:

1. The Shortcuts popup at 1440×900, top half (Ctrl block).
2. Same, bottom half (clear and number blocks).
3. The same popup on macOS, to show `cmd` / `option` labels.
4. The drawer options and the preview, for context on which shortcuts are
   panel-local (two shots).

## How it behaves

Global handler, `src/frontend/utils/shortcuts.ts:148-271`:

| Keys | Action | Citation |
| --- | --- | --- |
| Ctrl/Cmd + A | Select all | `:38` |
| Ctrl/Cmd + B | Bold — only inside a text box, handled by the edit tools | `:196-197,325-330`; `src/frontend/components/edit/tools/BoxStyle.svelte:100-109` |
| Ctrl/Cmd + C | Copy | `:39` |
| Ctrl/Cmd + D | Duplicate the selection (deferred 0 ms so the drawer does not toggle) | `:43` |
| Ctrl/Cmd + E | Open the Export popup | `:45` |
| Ctrl/Cmd + F | Find & replace in the editor; otherwise focus the drawer search | `:40,144-146`; `src/frontend/components/drawer/Drawer.svelte:169-183` |
| Ctrl/Cmd + G | Toggle quick search | `src/frontend/components/quicksearch/QuickSearch.svelte:106-113` |
| Ctrl/Cmd + H | History popup, unless the drawer tab is scripture | `:48` |
| Ctrl/Cmd + I | Import popup; with Alt, import from clipboard | `:46` |
| Ctrl/Cmd + L | Lock/unlock outputs — **preview only** | `:340-341` |
| Ctrl/Cmd + M | Mute the main audio channel | `:49-54` |
| Ctrl/Cmd + N | Context-dependent create: scripture show, slide, section, item, template/overlay/action/timer, else the new-show popup | `:464-488` |
| Ctrl/Cmd + O | Toggle output windows | `:55` |
| Ctrl/Cmd + R | Refresh/update output — **preview only** | `:342-344` |
| Ctrl/Cmd + S | Save | `:56` |
| Ctrl/Cmd + T | Toggle panels | `:57` |
| Ctrl/Cmd + U | Underline — only inside a text box | `:325-330`; `BoxStyle.svelte:100-109` |
| Ctrl/Cmd + V | Paste | `:41` |
| Ctrl/Cmd + X | Cut | `:44` |
| Ctrl/Cmd + Y | Redo | `:58` |
| Ctrl/Cmd + Z | Undo; Ctrl/Cmd + Shift + Z is also redo | `:59,193-194` |
| Ctrl/Cmd + ? | Shortcuts popup | `:60` |
| Ctrl/Cmd + Shift + D | Next-timer popup, only on the show page with a real show active | `:64` |
| Ctrl/Cmd + Shift + F | Focus mode | `:78` |
| Ctrl/Cmd + Shift + N | New-show popup | `:79` |
| Ctrl/Cmd + Shift + T | Toggle text edit mode | `:66-77` |
| Ctrl/Cmd + Shift + V | Change slide view | `:80` |
| Alt/Option + Enter | Cut the selection in half | `:86` |
| Ctrl/Cmd + 1…8 | Switch drawer tab (order: shows, media, audio, overlays, templates, scripture, calendar, functions), refused when the profile denies access | `:180-189`; order from `src/frontend/values/tabs.ts:5-16` |
| 1…5 | Switch top-level page: show, edit, stage, draw, settings — only when `special.numberKeys` is off | `:35,256-265` |
| Esc | Close quick search, then context menu, then blur, then popup, then selection | `:91-126` |
| Enter | Open the most recent project at startup when nothing is open | `:127-135` |
| Delete / Backspace | Delete the selection | `:136-137` |
| F2 | Rename | `:139` |
| F11 | Fullscreen — **not on macOS** | `:141` |

Panel-local handlers:

| Context | Keys | Action | Citation |
| --- | --- | --- | --- |
| Output preview | Ctrl/Cmd + L, Ctrl/Cmd + R | Lock, refresh | `src/frontend/components/output/preview/Preview.svelte:45-49`; `shortcuts.ts:340-345` |
| Output preview | Space, →, ←, PgDn, PgUp, Home, End, F5 | Advance / navigate | `shortcuts.ts:394-445` |
| Output preview | F1 / F2 / F3 / F4 | Clear background / slide (double-press clears the group) / overlays / audio | `shortcuts.ts:359-388` |
| Output preview | Esc, "." | Clear all | `shortcuts.ts:351-358` |
| Output window | Esc when nothing is displayed | Hide the window | `shortcuts.ts:152-155` |
| Output window | Esc, ←/→, Space, PgUp/PgDn, Home/End, ".", F1–F5 | Forwarded to the main window as `MAIN_SHORTCUT` | `shortcuts.ts:157-159` |
| Drawer | Ctrl/Cmd + D when nothing is selected and no edit items | Toggle the drawer | `src/frontend/components/drawer/Drawer.svelte:184-185` |
| Drawer sections | Ctrl/Cmd + ↑/↓ | Change drawer sub-tab | `src/frontend/components/drawer/navigation/NavigationSections.svelte:48-70` |
| Shows drawer | Ctrl/Cmd + ←/→ | Change the active show | `src/frontend/components/drawer/pages/Shows.svelte:152-168` |
| Shows drawer search | ↑/↓ | Preview the previous/next search result | `Shows.svelte:133-149` |
| Project list | ↑/↓ | Change the active project item | `src/frontend/components/helpers/showActions.ts:89-100`; bound in `src/frontend/components/show/Projects.svelte:370` |
| Quick search | Ctrl/Cmd + G or F8 | Toggle quick search | `QuickSearch.svelte:106-113` |
| Quick search | ↑/↓, Enter, Backspace | Move, select, drop the category tag | `QuickSearch.svelte:117-130` |
| Scripture drawer | Ctrl/Cmd + R | Replay the current scripture | `src/frontend/components/drawer/bible/Scripture.svelte:909-914` |
| Scripture drawer | Ctrl/Cmd + H | Toggle the scripture history list | `Scripture.svelte:917-921` |
| Scripture drawer | Ctrl/Cmd + B | Toggle Bible content search | `Scripture.svelte:924-928` |
| Scripture drawer | Ctrl/Cmd + ←/→ | Previous/next verse | `Scripture.svelte:930-935` |
| Scripture drawer | Enter, Ctrl/Cmd + Enter | Add to project / play (swappable by `enterSwapped`) | `Scripture.svelte:866-887` |
| Drawer search | Enter | Open the first result; with Ctrl/Cmd, play it | `Drawer.svelte:186-226` |
| Media drawer | arrow keys, Ctrl/Cmd | Next/previous media, selection | `src/frontend/components/drawer/media/Media.svelte:384-390,424,450` |

Guards that change what a key does:

- In a typing target, Ctrl shortcuts are ignored except `e, i, n, o, s, a, x`
  (and `c, v` on macOS). `code` — `shortcuts.ts:199-205`.
- Inside a text box, B/I/U are left to the edit tools, and Ctrl+V is intercepted
  by the paste helper. `code` — `shortcuts.ts:196-197`;
  `src/frontend/components/edit/editbox/EditboxLines.svelte:671-676`.
- Physical-key normalisation makes Ctrl+Z/C/V work on Cyrillic layouts; the
  layout map is preferred when the browser exposes it. `code` —
  `shortcuts.ts:285-323`.
- Alt+F4 is passed through untouched. `code` — `shortcuts.ts:150`.
- IME composition cancels shortcuts. `code` — `shortcuts.ts:164,333-336`.
- Ctrl/Cmd is accepted interchangeably (`e.ctrlKey || e.metaKey`), so Ctrl works
  on macOS too; only the labels differ (`cmd`, `option`) in the popup.
  `code` — `shortcuts.ts:179`; `Shortcuts.svelte:6-7`.

## State and persistence

Shortcuts have no stored state. The only related setting is
`special.numberKeys`, which decides whether digits play slides instead of
switching pages (`src/frontend/stores.ts:360`;
`Preview.svelte:80-93` vs `shortcuts.ts:256-265`).

## Settings

| Setting | Key and location | Default | Effect |
| --- | --- | --- | --- |
| Number keys play slides | `special.numberKeys` | off | Digits index slides instead of switching page |

## Code

- `src/frontend/utils/shortcuts.ts` — global handler, preview handlers, layout normalisation.
- `src/frontend/components/main/popups/Shortcuts.svelte:9-94` — the in-app list.
- `src/frontend/components/drawer/Drawer.svelte:164-227` — drawer search and Ctrl+D.
- `src/frontend/components/output/preview/Preview.svelte:41-118` — preview keys.
- `src/frontend/components/quicksearch/QuickSearch.svelte:106-131` — Ctrl+G/F8.
- `src/frontend/components/drawer/bible/Scripture.svelte:853-935` — scripture keys.
- `src/frontend/values/keys.ts` — **not** shortcuts; API-key decoding.

## Online docs

- [Keyboard Shortcuts](https://freeshow.app/docs/shortcuts) — the published
  table. It gives one key per command and does not say which panel a key applies
  to, which is where it diverges from the code.

## Doc vs code

Every row of the published table, checked against the handler:

| Published row | Code reality |
| --- | --- |
| Select All `Ctrl+A` | Matches (`shortcuts.ts:38`) |
| Bold `Ctrl+B` | Only inside a text item, and the handler deliberately steps aside for the edit tool (`:196-197`); in the scripture drawer Ctrl+B toggles Bible content search (`Scripture.svelte:924`) |
| Copy `Ctrl+C` | Matches (`:39`) |
| Duplicate `Ctrl+D` | Matches (`:43`) — but Ctrl+D also toggles the drawer when nothing is selected (`Drawer.svelte:184`); the docs list both rows with no condition |
| Toggle Drawer `Ctrl+D` | Conditional, as above |
| Export `Ctrl+E` | Matches (`:45`) |
| Search `Ctrl+F` | Drawer search globally; find & replace only in the editor (`:40`, `:144-146`). The docs have no Find & Replace row |
| Quick Search `Ctrl+G` | Matches (`QuickSearch.svelte:109`) |
| History `Ctrl+H` | Matches, except on the scripture tab, where it toggles the scripture history list (`:48`; `Scripture.svelte:917`) |
| Italic `Ctrl+I` | Text box only (`BoxStyle.svelte:100-109`) |
| Import `Ctrl+I` | Matches globally (`:46`); the two meanings are separated by focus |
| Lock Output `Ctrl+L` | **Preview only** (`shortcuts.ts:341`); not a global shortcut |
| Mute `Ctrl+M` | Matches (`:49-54`) |
| New Show `Ctrl+N` | Context-dependent create, not specifically a show (`:464-488`) |
| Toggle Output Screen `Ctrl+O` | Matches (`:55`) |
| Update Output `Ctrl+R` | **Preview only** (`:343`); in the scripture drawer it replays the verse (`Scripture.svelte:909`) |
| Save `Ctrl+S` | Matches (`:56`) |
| Toggle Panels `Ctrl+T` | Matches (`:57`) |
| Underline `Ctrl+U` | Text box only |
| Paste / Cut / Redo / Undo | Match (`:41,44,58,59`); redo also on Ctrl+Shift+Z |
| Shortcuts `Ctrl+?` | Matches (`:60`) |
| Toggle Focus Mode `Ctrl+Shift+F` | Matches (`:78`) |
| Change Slide View `Ctrl+Shift+V` | Matches (`:80`) |
| Show Import from Clipboard `Ctrl+Alt+I` | Matches (`:46`) |
| Remove Selection `Esc` | Matches, first in a chain of Esc meanings (`:91-126`) |
| Clear All `Esc` | Only in the output preview/window (`:354`, `:155`) |
| Clear Background `F1` | Preview only (`:359-363`) |
| Rename `F2` | Matches globally (`:139`) |
| Clear Slide `F2` | Preview only, double-press clears the whole group (`:364-377`) |
| Clear Overlays `F3` | Preview only (`:378-383`) |
| Clear Audio `F4` | Preview only (`:384-388`) |
| Quick Search `F8` | Matches (`QuickSearch.svelte:109`) |
| Toggle Fullscreen `F11` | Matches, **but disabled on macOS** (`:141`); the in-app list hides the row there (`Shortcuts.svelte:74`) |
| Change Tab `NUM` | 1–5 map to show/edit/stage/draw/settings, and only when `special.numberKeys` is off (`:256-265`) |
| Change Drawer Tab `Ctrl+NUM` | Ctrl+1…8 map to drawer tabs (`:180-189`) |
| Change Slide `←/→` | Preview/preview-window only (`:403-416`) |
| Change Project Item `↑/↓` | Project list only (`showActions.ts:93-99`) |
| Change Drawer Item `Ctrl+←/→` | Matches (`Shows.svelte:152-168`) |
| Change Drawer Category `Ctrl+↑/↓` | Code changes the drawer **sub-tab**, not a category (`NavigationSections.svelte:54-69`) |

Shortcuts in code but **not** in the published table: Ctrl+Shift+D (next timer),
Ctrl+Shift+N (new show popup), Ctrl+Shift+T (text edit), Ctrl+Shift+Z (redo),
Ctrl+Alt+I is listed but the code's Alt+Enter (cut in half) is not, Delete /
Backspace, Enter (open last project / add search result), F5 (next slide in
preview), "." (clear all in preview), PageUp/PageDown/Home/End.

## Open questions

- Whether Ctrl+D "toggle drawer" and "duplicate" can both fire in one keypress
  depends on event ordering between two window listeners
  (`src/frontend/App.svelte` global vs `Drawer.svelte:255`). No ordering was
  established; the guards look mutually exclusive by state, but that was not
  run. `unknown`.
- The `Ctrl+?` binding depends on the "?" character being produced (often
  Ctrl+Shift+/); whether it works on layouts without a "?" key was not traced.
  `unknown`.
- The in-app popup and the docs are two different lists; which one the project
  treats as canonical for parity is a contract decision, not a reader finding.
