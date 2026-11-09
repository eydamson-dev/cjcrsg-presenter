#!/usr/bin/env python3
"""Report which inventory features are covered by a detail page, and how.

Reads docs/freeshow-reference/feature-inventory.md for the IDs, then scans every
other page in the directory for those IDs and for the evidence labels.

Usage:
    scripts/check_freeshow_coverage.py [--root docs/freeshow-reference]

Exit status is 1 when an inventory ID is not mentioned by any page.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROW = re.compile(r"^\|\s*([a-z][a-z0-9]*(?:\.[a-z0-9-]+)+)\s*\|", re.M)
LABEL = re.compile(r"\b(observed|code|doc|unknown)\b", re.I)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="docs/freeshow-reference")
    args = parser.parse_args()

    root = Path(args.root)
    inventory = root / "feature-inventory.md"
    if not inventory.is_file():
        print(f"no inventory at {inventory}", file=sys.stderr)
        return 2

    ids = ROW.findall(inventory.read_text(encoding="utf-8"))
    # The inventory's own tables also match the row shape; keep only the ID column
    # values that look like feature IDs (they contain a dot and are not headers).
    ids = [i for i in dict.fromkeys(ids) if i not in {"id"}]

    pages = [
        p
        for p in sorted(root.rglob("*.md"))
        if p != inventory and "/source/" not in str(p) and "/screenshots/" not in str(p)
    ]

    text_by_page = {p: p.read_text(encoding="utf-8", errors="replace") for p in pages}
    all_text = "\n".join(text_by_page.values())

    missing = [i for i in ids if i not in all_text]
    labels = {k: 0 for k in ("observed", "code", "doc", "unknown")}
    for text in text_by_page.values():
        for match in LABEL.finditer(text):
            labels[match.group(1).lower()] += 1

    print(f"inventory IDs: {len(ids)}")
    print(f"detail pages:  {len(pages)}")
    print(f"labels:        observed {labels['observed']}, code {labels['code']}, "
          f"doc {labels['doc']}, unknown {labels['unknown']}")
    if missing:
        print(f"\nnot mentioned by any page ({len(missing)}):")
        for i in missing:
            print(f"  {i}")
        return 1
    print("\nevery inventory ID is mentioned by at least one page")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
