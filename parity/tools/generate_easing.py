#!/usr/bin/env python3
"""Generate CSS `linear()` approximations of Svelte's bounceInOut and elasticInOut.

FreeShow's easings are Svelte's, and two of them cannot be expressed by a single
cubic-bézier. CSS `linear()` takes a list of sampled points, which can follow any
curve. This tool samples the exact functions, prints the CSS strings, and reports
the worst error of the piecewise-linear interpolation against the real function.

Usage: generate_easing.py [points]
"""

import json
import math
import sys
from pathlib import Path

POINTS = int(sys.argv[1]) if len(sys.argv) > 1 else 41


def bounce_out(t: float) -> float:
    a, b, c = 4.0 / 11.0, 8.0 / 11.0, 9.0 / 10.0
    ca, cb, cc = 4356.0 / 361.0, 35442.0 / 1805.0, 16061.0 / 1805.0
    t2 = t * t
    if t < a:
        return 7.5625 * t2
    if t < b:
        return 9.075 * t2 - 9.9 * t + 3.4
    if t < c:
        return ca * t2 - cb * t + cc
    return 10.8 * t * t - 20.52 * t + 10.72


def bounce_in_out(t: float) -> float:
    if t < 0.5:
        return 0.5 * (1.0 - bounce_out(1.0 - t * 2.0))
    return 0.5 * bounce_out(t * 2.0 - 1.0) + 0.5


def elastic_in_out(t: float) -> float:
    if t < 0.5:
        return 0.5 * math.sin((13.0 * math.pi / 2) * 2.0 * t) * (2.0 ** (10.0 * (2.0 * t - 1.0)))
    return (
        0.5
        * math.sin((-13.0 * math.pi / 2) * (2.0 * t - 1.0 + 1.0))
        * (2.0 ** (-10.0 * (2.0 * t - 1.0)))
        + 1.0
    )


def linear_css(function, points: int) -> str:
    samples = [function(i / (points - 1)) for i in range(points)]
    samples[0] = 0.0
    samples[-1] = 1.0
    def format_number(value: float) -> str:
        if abs(value) < 0.00005:
            return "0"
        return f"{value:.4f}".rstrip("0").rstrip(".")

    body = ", ".join(format_number(value) for value in samples)
    return f"linear({body})"


def interpolate(samples: list[float], t: float) -> float:
    position = t * (len(samples) - 1)
    index = min(int(position), len(samples) - 2)
    fraction = position - index
    return samples[index] + (samples[index + 1] - samples[index]) * fraction


def worst_error(function, samples: list[float]) -> float:
    return max(
        abs(interpolate(samples, i / 1000) - function(i / 1000)) for i in range(1001)
    )


def main() -> int:
    curves = {}
    for name, function in (("bounce", bounce_in_out), ("elastic", elastic_in_out)):
        samples = [function(i / (POINTS - 1)) for i in range(POINTS)]
        samples[0], samples[-1] = 0.0, 1.0
        curves[name] = {
            "css": linear_css(function, POINTS),
            "points": POINTS,
            "max_error": round(worst_error(function, samples), 4),
            "sample_25": round(interpolate(samples, 0.25), 4),
            "sample_75": round(interpolate(samples, 0.75), 4),
        }

    out = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    if out:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(curves, indent=2) + "\n")
    print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk != "css"} for k, v in curves.items()}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
