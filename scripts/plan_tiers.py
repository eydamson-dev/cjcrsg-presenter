#!/usr/bin/env python3
"""Assign every FreeShow feature ID to a delivery tier, and check the mapping.

The tiers are defined in docs/plan.md ("Delivery tiers"). This script holds the
assignment and writes docs/freeshow-reference/tiers.md from the inventory, so the
full list cannot drift from feature-inventory.md.

Usage:
    scripts/plan_tiers.py            # write tiers.md, check coverage
    scripts/plan_tiers.py --check    # check only; exit 1 on any unassigned ID

Tiers:
    1  needed to run a service
    2  needed to prepare a service, and content and automation
    3  deferred, or outside the current phases
"""
from __future__ import annotations

import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

INVENTORY = Path("docs/freeshow-reference/feature-inventory.md")
OUTPUT = Path("docs/freeshow-reference/tiers.md")

ROW = re.compile(r"^\|\s*([a-z][a-z0-9]*(?:\.[a-z0-9-]+)+)\s*\|", re.M)

# Exact assignments. These win over the prefix rules below.
EXACT: dict[str, int] = {
    # Presenting and navigation
    "nav.bounds.next-at-end": 1,
    "show.present": 1,
    "show.present.active": 1,
    "show.slides": 1,
    "show.slides.disabled": 1,
    "show.backgrounds": 1,
    "show.backgrounds.missing": 1,
    "show.views.grid": 1,
    "show.groups": 1,
    "show.layers": 1,
    "show.views.simple": 2,
    "show.views.list": 2,
    "show.views.lyrics": 2,
    "show.groups.none": 2,
    "show.groups.global": 2,
    "show.groups.numbers": 2,
    "show.arrangements": 2,
    "show.arrangements.create": 2,
    "show.actions": 2,
    "show.dynamic": 2,
    "show.itemactions": 2,
    # Outputs
    "out.transitions.priority": 1,
    "out.stage-window": 1,
    "out.multiple.specific": 2,
    "out.styles.template": 2,
    "out.styles.metadata": 2,
    "out.ndi": 3,
    "out.livestream": 3,
    "out.recorder": 3,
    # Projects
    "proj.model": 1,
    "proj.list": 1,
    "proj.create": 1,
    "proj.items": 1,
    "proj.reorder": 1,
    "proj.navigate": 1,
    "proj.sections": 1,
    "proj.folders": 2,
    "proj.template": 2,
    "proj.private": 2,
    "proj.search-add": 2,
    "proj.export": 2,
    "proj.import": 2,
    # Remote and clients
    "remote.connect": 1,
    "remote.password": 1,
    "remote.mobile": 1,
    "remote.show": 1,
    "remote.output": 1,
    "remote.tablet": 2,
    "controller.client": 1,
    "outputstream.client": 2,
    "companion.module": 3,
    # Drawer
    "drawer.shell": 1,
    "drawer.tabs": 1,
    "drawer.shortcuts": 1,
    "drawer.search": 2,
    # Media, audio
    "media.play": 1,
    "media.background": 1,
    "media.controls": 1,
    "media.next-finished": 1,
    "media.folders": 2,
    "media.filters": 2,
    "media.online": 3,
    "media.canva": 3,
    "media.screens": 3,
    "media.cameras": 3,
    "media.recording": 3,
    "media.markers": 3,
    "audio.play": 2,
    "audio.effects": 2,
    "audio.routing": 2,
    "audio.metronome": 3,
    "audio.mic": 3,
    "audio.stream": 3,
    "audio.nowplaying": 3,
    # Functions and actions
    "actions.emitters": 3,
    "actions.ccli-toggle": 3,
    "functions.interactions": 3,
    "functions.obs": 3,
    "functions.scenes": 3,
    # Calendar
    "calendar.events": 3,
    "calendar.show": 3,
    "calendar.schedule": 3,
    # Data and formats
    "data.paths": 1,
    "data.folders": 1,
    "data.config-in-data": 1,
    "data.backup": 2,
    "data.import-export-settings": 2,
    "data.profiles": 2,
    "data.log": 2,
    "data.hwaccel": 2,
    "data.kiosk": 3,
    "data.updates": 3,
    "fmt.show": 1,
    "fmt.project": 1,
    "fmt.bible": 2,
    # Internal behaviour
    "sys.arch": 1,
    "sys.ipc": 1,
    "sys.servers": 1,
    "sys.stores": 1,
    "sys.persistence": 1,
    "sys.settings": 1,
    "sys.security": 1,
    "sys.api": 2,
    "sys.action-data": 2,
    "sys.media": 2,
    "sys.i18n": 2,
    "sys.build": 3,
    # Integrations and cloud
    "integration.bible": 2,
    "integration.planningcenter": 3,
    "integration.churchapps": 3,
    "integration.pixabay": 3,
    "integration.unsplash": 3,
    # Tips and guidance
    "tips.shortcuts": 2,
    "tips.styling": 3,
    "tips.faq": 3,
}

# Prefix rules, used when no exact assignment exists. Order matters.
PREFIX: list[tuple[str, int]] = [
    ("gs.", 3),          # getting started: documentation, not behaviour
    ("cloud.", 3),
    ("midi.", 3),
    ("smart.", 3),
    ("ccli.", 3),
    ("import.", 2),
    ("export.", 2),
    ("overlay.", 2),
    ("template.", 2),
    ("scripture.", 2),
    ("audio.", 2),
    ("media.", 2),
    ("calendar.", 3),
    ("functions.", 2),
    ("actions.", 2),
    ("stage.", 1),
    ("remote.", 1),
    ("proj.", 2),
    ("out.", 1),
    ("show.", 2),
    ("data.", 2),
    ("fmt.", 2),
    ("sys.", 2),
    ("integration.", 3),
    ("tips.", 3),
]


def tier_of(feature_id: str) -> tuple[int, str]:
    """Return (tier, how it was assigned): 'exact', 'prefix' or 'none'."""
    if feature_id in EXACT:
        return EXACT[feature_id], "exact"
    for prefix, tier in PREFIX:
        if feature_id.startswith(prefix):
            return tier, "prefix"
    return 0, "none"


TITLES = {
    1: "Tier 1 — needed to run a service",
    2: "Tier 2 — needed to prepare a service, and content and automation",
    3: "Tier 3 — deferred, or outside the current phases",
}


def main() -> int:
    check_only = "--check" in sys.argv
    text = INVENTORY.read_text(encoding="utf-8")
    ids = list(dict.fromkeys(ROW.findall(text)))

    assigned: dict[str, tuple[int, str]] = {}
    unassigned: list[str] = []
    for feature_id in ids:
        tier, how = tier_of(feature_id)
        if tier == 0:
            unassigned.append(feature_id)
        else:
            assigned[feature_id] = (tier, how)

    stale = sorted(set(EXACT) - set(ids))
    if unassigned:
        print("unassigned feature IDs:")
        for feature_id in unassigned:
            print(f"  {feature_id}")
    if stale:
        print("exact entries that match no inventory ID (remove or fix):")
        for feature_id in stale:
            print(f"  {feature_id}")

    counts = Counter(tier for tier, _ in assigned.values())
    print(f"inventory IDs: {len(ids)}  assigned: {len(assigned)}  unassigned: {len(unassigned)}")
    for tier in (1, 2, 3):
        print(f"  tier {tier}: {counts.get(tier, 0)}")

    if check_only:
        return 1 if unassigned or stale else 0
    if unassigned or stale:
        print("tiers.md not written until the mapping is complete")
        return 1

    # Group rows by tier, then by inventory area, keeping inventory order.
    by_tier: dict[int, list[str]] = defaultdict(list)
    for feature_id in ids:
        by_tier[assigned[feature_id][0]].append(feature_id)

    lines = [
        "# Delivery tiers",
        "",
        "Generated by `scripts/plan_tiers.py` from `feature-inventory.md`. Edit the",
        "assignment in that script, then regenerate; do not edit this file by hand.",
        "The rules are in `docs/plan.md`, section \"Delivery tiers\".",
        "",
        f"Total: {len(ids)} features. "
        f"Tier 1: {counts.get(1, 0)}. Tier 2: {counts.get(2, 0)}. Tier 3: {counts.get(3, 0)}.",
        "",
    ]
    for tier in (1, 2, 3):
        lines += [f"## {TITLES[tier]}", "", "| ID | Assigned by |", "| --- | --- |"]
        for feature_id in by_tier[tier]:
            how = assigned[feature_id][1]
            lines.append(f"| `{feature_id}` | {how} |")
        lines.append("")
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
