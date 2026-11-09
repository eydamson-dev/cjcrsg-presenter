#!/usr/bin/env python3
"""Check every FreeShow code reference in the reference docs.

A reference is `src/path/file.ext:123` or `src/path/file.ext:12-34`, with or
without backticks. The script verifies that:

1. the file exists in the pinned FreeShow checkout;
2. every cited line number is inside the file;
3. the cited line is not blank.

It cannot verify that the citation supports the claim. It catches the cheaper
failure: a reference that does not exist or points past the end of a file.

Usage:
    scripts/check_freeshow_refs.py [--root docs/freeshow-reference]
                                   [--freeshow ~/projects/reference/freeshow]

Exit status is 1 when any reference fails.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REF = re.compile(r"(src/[A-Za-z0-9_./@+-]+\.(?:ts|svelte|js|json|css|html)):(\d+)(?:-(\d+))?")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="docs/freeshow-reference")
    parser.add_argument("--freeshow", default=str(Path.home() / "projects/reference/freeshow"))
    args = parser.parse_args()

    root = Path(args.root)
    freeshow = Path(args.freeshow)
    if not root.is_dir():
        print(f"no docs at {root}", file=sys.stderr)
        return 2
    if not freeshow.is_dir():
        print(f"no FreeShow checkout at {freeshow}", file=sys.stderr)
        return 2

    line_cache: dict[Path, list[str]] = {}
    failures: list[str] = []
    checked = 0

    for md in sorted(root.rglob("*.md")):
        if "/source/" in str(md):
            continue
        text = md.read_text(encoding="utf-8", errors="replace")
        for match in REF.finditer(text):
            rel, start, end = match.group(1), int(match.group(2)), match.group(3)
            checked += 1
            path = freeshow / rel
            if not path.is_file():
                failures.append(f"{md}: missing file {rel}")
                continue
            if path not in line_cache:
                line_cache[path] = path.read_text(encoding="utf-8", errors="replace").splitlines()
            lines = line_cache[path]
            last = int(end) if end else start
            if start < 1 or last > len(lines):
                failures.append(f"{md}: {rel}:{match.group(2)}{'-' + end if end else ''} beyond {len(lines)} lines")
                continue
            if not lines[start - 1].strip():
                failures.append(f"{md}: {rel}:{start} is a blank line")

    for failure in failures:
        print(failure)
    print(f"checked {checked} references, {len(failures)} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
