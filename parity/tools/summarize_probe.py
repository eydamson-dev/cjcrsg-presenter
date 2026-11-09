#!/usr/bin/env python3
"""Summarise CJCRSG_MEDIA_PROBE output.

Reads the app's log lines:

    media probe output="Audience" report=[{"t":..,"total":..,"dropped":..}]

and reports, per output, the frame rate and dropped frames between the first and
last sample that had frames. Looping media resets Chromium's counters, so the
clip must not loop for this to mean anything.

Usage: summarize_probe.py <log> [out.json]
"""

import datetime
import json
import re
import sys
from pathlib import Path

LINE = re.compile(
    r"(\S+)Z\s+INFO .*media probe output=\"(?P<output>\w+)\" report=(?P<report>\[.*\])$"
)


def samples(path: Path):
    for raw in path.read_text(errors="replace").splitlines():
        line = re.sub(r"\x1b\[[0-9;]*m", "", raw)
        match = LINE.search(line)
        if not match:
            continue
        report = json.loads(match.group("report"))
        if not report:
            continue
        yield (
            datetime.datetime.fromisoformat(match.group(1)),
            match.group("output"),
            report[0],
        )


def summarise(path: Path) -> dict:
    by_output: dict[str, list] = {}
    for timestamp, output, video in samples(path):
        by_output.setdefault(output, []).append((timestamp, video))

    summary = {}
    for output, entries in by_output.items():
        playing = [(ts, v) for ts, v in entries if v["total"] > 0]
        if len(playing) < 2:
            summary[output] = {"samples": len(entries), "note": "no frames"}
            continue
        first_ts, first = playing[0]
        last_ts, last = playing[-1]
        seconds = (last_ts - first_ts).total_seconds()
        frames = last["total"] - first["total"]
        summary[output] = {
            "samples": len(entries),
            "seconds": round(seconds, 1),
            "frames": frames,
            "fps": round(frames / seconds, 2) if seconds else None,
            "dropped": last["dropped"] - first["dropped"],
            "size": f'{first["w"]}x{first["h"]}',
            "ended_paused": last["paused"],
            "final_t": round(last["t"], 2),
        }

    summary["_all_four_playing"] = all(
        summary.get(name, {}).get("fps", 0) > 20
        for name in ("Audience", "Stage", "Preview", "Confidence")
    )
    return summary


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    summary = summarise(Path(argv[1]))
    if len(argv) > 2:
        Path(argv[2]).write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))
    return 0 if summary["_all_four_playing"] else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
