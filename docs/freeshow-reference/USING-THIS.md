# Using this reference as a contract

This directory is the written description of FreeShow that the Rust port is checked
against. It is not a second README and it is not a wish list. A page states what the
reference does and how confidently that is known.

## The rule that matters

**A feature is not understood because a page exists.** It is understood when the page
has a behaviour statement with a citation, and the label says how that statement was
obtained:

| Label | What it permits |
| --- | --- |
| `observed` | Can become a requirement. Someone ran the reference and recorded what happened. |
| `code` | Can become a requirement only after a scenario confirms it at runtime, unless the user accepts it as provisional. |
| `doc` | Not a requirement. It is a claim from the online docs, and must be checked in code or at runtime. |
| `unknown` | Not a requirement. It is a question with a named way to answer it. |

`code` is strong evidence for most behaviour, but it is not the same as `observed`.
Two things can differ from the code: configuration (a setting not set in the test
profile) and the environment (display, audio device, platform). That is why a
contract that rests only on `code` still needs a scenario before acceptance.

## This reference is living

The pages are a working record, not a finished specification. They will be wrong
in places, and they are corrected during development.

- **Source of truth:** the reference code at the pinned commit, and what the
  running reference actually does. When a page and either of those disagree, the
  page is wrong.
- **Not the source of truth:** our Rust port. If the port differs from FreeShow on
  purpose, record it in `docs/deviations.md`. Do not change a reference page to
  match the port.
- **Correcting a page:** fix the claim and keep its label honest; add an entry to
  `audit.md` with the next `A-nnn` number (what the page said, what the code or run
  shows, the citation, the fix); add a line to the page's changelog.
- **Who corrects:** the reader owns the pages. Other roles report a suspected error
  to the orchestrator, who routes it to the reader. Nobody else edits
  `docs/freeshow-reference/`.
- **Nothing is deleted silently.** A corrected claim stays visible in the audit log,
  so a later reader can see why the page changed.

## Per role

### Reader

1. Start from `feature-inventory.md`, find the ID.
2. Open the feature page. If it does not exist, create it from `TEMPLATE.md`.
3. Record what the code does, with `path:line` at the pinned commit. Do not describe
   the component tree; describe the state change and the visible result.
4. If the online docs disagree, keep both in "Doc vs code".
5. If a behaviour cannot be traced, write `unknown` and say what would establish it.
   Never fill a gap with what a similar presenter does.

### Scenario author

- Every scenario cites the feature ID and the page it came from.
- A scenario has preconditions, actions, expected state, and the boundary/repeat
  cases. "Next slide works" is not a scenario.
- A scenario may not assume a behaviour that the page labels `doc` or `unknown`.
- If the page is wrong, the scenario records the mismatch; it does not silently
  encode a different expectation.

### Implementer

- Implement the behaviour the page describes, not the UI shape alone.
- Keep the repository invariants: the engine owns the show, outputs are consumers,
  unknown file fields round-trip.
- If the page is ambiguous, stop and record the question. A guess that passes tests
  is still a guess if the reference was not checked.

### Verifier

- Run the scenario against the reference and the port.
- Compare observable behaviour: domain state, slide identity, output content,
  persistence, events, restart recovery. Not internal structures.
- A page with only `code` evidence is a risk to flag, not a pass to grant.
- Report mismatches with the page ID and the citation that was contradicted.

## How to cite

- Code: `src/frontend/components/helpers/OutputHelper.ts:80`
- Docs: `source/docs/output.md` and the public URL
- Screenshot: `screenshots/<file>.png`, with the state described in the caption
- Contract: `docs/contracts/<name>.md`
- Scenario: `parity/scenarios/<name>`

## Checking the citations

```bash
scripts/check_freeshow_refs.py
```

It verifies that every `src/...:line` reference in this directory exists at the
pinned commit and does not point at a blank line. It does not verify that the cited
line supports the claim; that remains a reader's job.

## When the pin moves

1. Re-run `scripts/check_freeshow_refs.py`.
2. Re-read every page whose citations changed.
3. Re-capture the screenshots affected by a visual change.
4. Update the pin in `README.md` and in each page's header.
5. Record the old pin in `docs/decisions.md` if the move changes a contract.

## What this set is not

- It is not a substitute for running the reference.
- It is not a port plan; it does not choose phases or crates.
- It is not complete. `feature-inventory.md` lists every published feature, but
  many pages still say `unknown` where the code path was not traced.
