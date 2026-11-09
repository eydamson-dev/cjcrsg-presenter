#!/usr/bin/env python3
"""CPU and memory of a process and all its descendants.

Dioxus desktop spawns WebKit/WebView processes as children, so measuring the
main PID alone under-reports a presentation. Samples /proc and reports the whole
tree.

Usage: measure_process_tree.py <pid> <seconds> [out.json]
"""

import json
import os
import sys
import time
from pathlib import Path

CLOCK_TICKS = os.sysconf("SC_CLK_TCK")


def processes():
    """pid -> (ppid, utime, stime, rss_pages)."""
    table = {}
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        try:
            stat = (entry / "stat").read_text()
        except OSError:
            continue
        # The command can contain spaces and parentheses; split after the last ')'.
        fields = stat.rsplit(")", 1)[1].split()
        pid = int(entry.name)
        ppid = int(fields[1])
        utime = int(fields[11])
        stime = int(fields[12])
        rss = int(fields[21])
        table[pid] = (ppid, utime, stime, rss)
    return table


def tree(pid: int, table: dict) -> list[int]:
    children = {}
    for child, (parent, *_rest) in table.items():
        children.setdefault(parent, []).append(child)

    found = []
    stack = [pid]
    while stack:
        current = stack.pop()
        found.append(current)
        stack.extend(children.get(current, []))
    return found


def sample(pid: int):
    table = processes()
    ticks = 0
    rss_pages = 0
    names = {}
    for member in tree(pid, table):
        ppid, utime, stime, rss = table[member]
        ticks += utime + stime
        rss_pages += rss
        try:
            names[member] = Path(f"/proc/{member}/comm").read_text().strip()
        except OSError:
            names[member] = "?"
    return ticks, rss_pages, names


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    pid = int(argv[1])
    seconds = float(argv[2])

    first_ticks, first_rss, names = sample(pid)
    started = time.monotonic()
    time.sleep(seconds)
    last_ticks, last_rss, _ = sample(pid)
    elapsed = time.monotonic() - started

    cpu = (last_ticks - first_ticks) / CLOCK_TICKS / elapsed * 100
    page_size = os.sysconf("SC_PAGE_SIZE")
    report = {
        "pid": pid,
        "seconds": round(elapsed, 1),
        "cpu_percent": round(cpu, 1),
        "rss_mb": round(last_rss * page_size / 1024 / 1024, 1),
        "processes": sorted(names.values()),
        "process_count": len(names),
    }
    if len(argv) > 3:
        Path(argv[3]).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
