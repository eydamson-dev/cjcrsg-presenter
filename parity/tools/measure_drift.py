#!/usr/bin/env python3
"""Drift between outputs playing the same clip.

Reads a CJCRSG_MEDIA_PROBE log and compares each output's media clock against
the Audience output's, at times where both have a sample within a small window.

Two things are reported:

- **offset**: media time difference at the first and last comparable sample.
- **drift**: how much that offset changed over the run. A constant offset is
  just a later start; growing drift is outputs disagreeing about where they are.

Usage: measure_drift.py <log> [out.json]
"""

import datetime
import json
import re
import sys
from pathlib import Path

LINE = re.compile(
    r"(\S+)Z\s+INFO .*media probe output=\"(?P<output>\w+)\" report=(?P<report>\[.*\]|\{.*\})$"
)
WINDOW_SECONDS = 1.5
REFERENCE = "Audience"


def load(path: Path) -> dict[str, list[tuple[datetime.datetime, float]]]:
    by_output: dict[str, list[tuple[datetime.datetime, float]]] = {}
    for raw in path.read_text(errors="replace").splitlines():
        line = re.sub(r"\x1b\[[0-9;]*m", "", raw)
        match = LINE.search(line)
        if not match:
            continue
        report = json.loads(match.group("report"))
        videos = report.get("videos") if isinstance(report, dict) else report
        if not videos:
            continue
        video = videos[0]
        if video["w"] == 0 or video["total"] == 0:
            continue
        by_output.setdefault(match.group("output"), []).append(
            (datetime.datetime.fromisoformat(match.group(1)), video["t"])
        )
    return by_output


def reference_at(samples, when):
    """Media time of the reference, interpolated at `when`.

    A nearest-sample comparison would carry up to a sample interval of error;
    interpolating between the two samples that bracket `when` does not.
    """
    before = None
    after = None
    for timestamp, value in samples:
        if timestamp <= when:
            before = (timestamp, value)
        elif after is None:
            after = (timestamp, value)
    if before is None or after is None:
        return None
    span = (after[0] - before[0]).total_seconds()
    if span <= 0:
        return before[1]
    fraction = (when - before[0]).total_seconds() / span
    return before[1] + (after[1] - before[1]) * fraction


def analyse(path: Path) -> dict:
    by_output = load(path)
    reference = by_output.get(REFERENCE, [])
    if not reference:
        return {"error": f"no samples for {REFERENCE}"}
    # Skip the ramp-up and the end of the clip, where an output stops advancing.
    last_reference = max(value for _, value in reference)
    low, high = 2.0, last_reference - 2.0

    comparison = {}
    for output, samples in by_output.items():
        if output == REFERENCE:
            continue
        offsets = []
        for timestamp, value in samples:
            reference_value = reference_at(reference, timestamp)
            if reference_value is None:
                continue
            if reference_value < low or reference_value > high:
                continue
            offsets.append((timestamp, value - reference_value))
        if len(offsets) < 3:
            comparison[output] = {"samples": len(offsets), "note": "too few"}
            continue
        first_ts, first = offsets[0]
        last_ts, last = offsets[-1]
        comparison[output] = {
            "samples": len(offsets),
            "seconds": round((last_ts - first_ts).total_seconds(), 1),
            "offset_start_ms": round(first * 1000, 1),
            "offset_end_ms": round(last * 1000, 1),
            "drift_ms": round((last - first) * 1000, 1),
            "max_abs_offset_ms": round(max(abs(offset) for _, offset in offsets) * 1000, 1),
        }
    return {"reference": REFERENCE, "outputs": comparison}


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    report = analyse(Path(argv[1]))
    if len(argv) > 2:
        Path(argv[2]).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return 0 if "error" not in report else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
