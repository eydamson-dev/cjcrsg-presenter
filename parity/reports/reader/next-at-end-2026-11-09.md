# Next at the end of a show — observed

- **Feature:** `nav.bounds.next-at-end`
- **Reference:** FreeShow `1.6.8-beta.3`, commit `ff784eb388c7baef60d67e6d4e7c504f4322bca3`
- **Method:** the reference was launched under Playwright's Electron support with
  the seeded profile, presented, started on a show, and driven with real Space key
  presses. State was read from the API (`POST http://127.0.0.1:5506`,
  `get_output`), and the main window and output window were captured at each step.
- **Observed:** 2026-11-09. This is the first `observed` entry in the reference set.

## The case

A project with two shows followed by a section:

```
Example (project)
  1. Welcome        one slide, one line
  2. Parity Fixture one slide, two lines
  3. Example        section with notes
```

The operator selects the project, clicks **Welcome**, presents, and presses
**Space** to start. Then presses Space repeatedly.

Two profiles differ only in `special.nextItemOnLastSlide`:

- `on`: `true` (FreeShow's default)
- `off`: `false`

The setting is at `src/frontend/components/settings/tabs/General.svelte:55` and is
read at `src/frontend/components/helpers/OutputHelper.ts:131`.

## Result — setting on (default)

| Step | Output slide | Main-window header | What happened |
| --- | --- | --- | --- |
| start | Welcome | Welcome | Show playing |
| press 1 | Welcome | **Parity Fixture** | Next project item **selected**, output unchanged |
| press 2 | **Parity Fixture** | Parity Fixture | Selected show **played** |
| press 3 | Parity Fixture | *(section)* | Section selected, output unchanged |
| press 4 | Parity Fixture | *(section)* | End of project: no change |

Evidence:

- `parity/reports/reader/next-at-end-2026-11-09/on-start-main.png`
- `parity/reports/reader/next-at-end-2026-11-09/on-after-1-main.png`
- `parity/reports/reader/next-at-end-2026-11-09/on-after-1-out.png`
- `parity/reports/reader/next-at-end-2026-11-09/on-after-2-main.png`
- `parity/reports/reader/next-at-end-2026-11-09/on-after-2-out.png`

## Result — setting off

| Step | Output slide | Main-window header |
| --- | --- | --- |
| start | Welcome | Welcome |
| press 1 | Welcome | Welcome |
| press 2 | Welcome | Welcome |
| press 3 | Welcome | Welcome |
| press 4 | Welcome | Welcome |

Evidence: `parity/reports/reader/next-at-end-2026-11-09/off-after-1-main.png`.

## Why the first press does not change the output

Reading the code after the run:

- `changeProjectItem` (`OutputHelper.ts:130-194`) opens the next project item with
  `openProjectItem` (`:180`).
- `openProjectItem` only sets `activeShow`; it does not play a slide
  (`src/frontend/components/show/project.ts:35-64`).
- It plays the new item directly only when `options.playNext` is true (`:183-193`),
  which is set for the next-slide timer and "next on media finished", not for
  Space or ArrowRight.
- On the following press, `getShow` returns the now-active show when the outputted
  show has reached its end (`OutputHelper.ts:240-264`), and `getNextSlide` resolves
  its first slide, which is then played.

So the two-step behaviour is a consequence of how project items are opened, not a
timing artefact. The header and output were stable for 2.5 s after the first press.

## What this corrects

The previous report (`parity/reports/navigation-end-behaviour-2026-11-09.md`) said
the code path had no configuration branch and that next at the end moves to the
next project item. Both parts need qualification:

1. The branch exists at `OutputHelper.ts:131` and the setting can stop the move.
2. With the setting on, one press does **not** output the next show. It selects it;
   a second press plays it.

The second point is not in the published docs either. The docs say space at the end
"will go to the next show"; they do not say it takes two presses.

## Open questions

- Does the same two-step rule hold when the next project item is a show in a
  project with many shows, or is it specific to this layout? The mechanism is in
  `changeProjectItem`, so it should generalise; a run with three shows would
  confirm it.
- What does the operator see in the output between press 1 and press 2? It stays on
  the previous show, which is what the captures show.
- Does the setting also affect the **active selection** (the header moved only when
  the setting was on), or only the output? The off run shows neither moves.
