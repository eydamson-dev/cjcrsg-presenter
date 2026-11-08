# Provenance and licence

## What this project is derived from

The CJCRSG Presenter is a rebranded fork of
[ChurchApps/FreeShow](https://github.com/ChurchApps/FreeShow), licensed
**GPL-3.0**. This repository is its Rust successor.

## Licence

**GPL-3.0-only.** Changing the implementation language does not change the
licence. A Rust reimplementation written with the original source open and
consulted is a derivative work unless proven otherwise, and nothing in this
repository is structured to make that claim.

Practical consequences:

- Source must remain available to anyone who receives the binary.
- Copyright and attribution notices are preserved.
- Modifications are stated, per GPL-3.0 §5.
- Any bundled dependency must be GPL-compatible. Check before adding one.

**Do not** relicense to MIT or Apache, and do not describe this as a clean-room
or independent implementation. Relicensing requires every relevant copyright
holder's consent and, realistically, an IP lawyer. It is not a technical
decision.

## History

The Electron + Svelte fork lived at `~/projects/cjcrsg-presenter` in its
original form. This directory was found **empty and without `.git`** on
2026-11-09, so the Rust work starts a new history.

**Recorded 2026-11-09:** the original fork history was not present in this
directory. A new repository was initialised here on that date. No upstream
commit is recorded as the branch point because none could be verified locally.

If the fork history is recovered later, do not rewrite, squash or re-init this
history to "tidy" provenance. Add the recovered history as a graft/remote and
record the relationship. The attribution trail is the licence compliance
evidence.

## Behavioural reference

FreeShow's source is read as a specification. Where a behaviour is ported:

- record the upstream file and the commit it was read at, in the commit message
  or the module doc comment;
- port the *behaviour*, not the identifiers — do not transliterate TypeScript
  structure into Rust;
- keep the original CSS as the visual contract and note its source file.

## Third-party assets

Fonts, icons, sample media and translations keep their own licences. Do not copy
assets from FreeShow or its dependencies without confirming the licence permits
redistribution. Logos, photographs and third-party content the user does not own
must be replaced.
