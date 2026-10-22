"""Deterministic, pure-Python civic-complaint intelligence.

Keyword classification, severity grading, duplicate detection and hotspot
detection. This module intentionally imports neither FastAPI nor Pydantic so
it can be unit-tested on its own.
"""

import itertools
import math
import re
from collections import Counter
from collections.abc import Mapping, Sequence
from typing import Any

EARTH_RADIUS_M = 6_371_000.0
OTHER_CATEGORY = "other"

CATEGORY_ORDER: tuple[str, ...] = (
    "pothole",
    "garbage",
    "water_supply",
    "streetlight",
    "drainage",
)

_RAW_KEYWORDS: dict[str, dict[str, int]] = {
    "pothole": {
        "pothole": 2, "crater": 2, "asphalt": 2,
        "road": 1, "roadway": 1, "crack": 1,
    },
    "garbage": {
        "garbage": 2, "trash": 2, "waste": 2, "dump": 2,
        "litter": 2, "rubbish": 2, "dustbin": 2,
    },
    "water_supply": {
        "pipe": 2, "pipeline": 2, "leak": 2, "tap": 2,
        "water": 1, "supply": 1,
    },
    "streetlight": {
        "streetlight": 2, "lamp": 2, "lamppost": 2, "bulb": 2,
        "light": 2, "dark": 1,
    },
    "drainage": {
        "drain": 2, "drainage": 2, "sewer": 2, "sewage": 2, "flood": 2,
        "waterlogging": 2, "waterlogged": 2, "manhole": 2,
    },
}

_STOPWORDS = frozenset(
    "a an the is are was were be been and or of to in on at by for with from "
    "near has have had it its this that there here very some my our please".split()
)

_STEM_SUFFIXES = ("ing", "ed", "s")

CRITICAL_SIGNALS: tuple[str, ...] = (
    "fire", "collapse", "collapsed", "electrocution", "live wire",
    "exposed wire", "sparking", "accident", "injury", "injured", "gas leak",
    "sinkhole", "burst", "hospital", "school", "children", "open manhole",
    "flooded",
)
MEDIUM_SIGNALS: tuple[str, ...] = (
    "blocked", "overflow", "broken", "not working", "no water", "dark",
    "pothole", "leak", "smell", "stench", "overflowing",
)
LOW_SIGNALS: tuple[str, ...] = (
    "garbage", "trash", "waste", "litter", "rubbish", "dustbin", "dump",
    "road", "crack", "crater", "asphalt", "streetlight", "lamp", "lamppost",
    "bulb", "light", "drain", "drainage", "sewer", "sewage", "manhole",
    "pipe", "tap", "water", "supply", "flood", "flooding", "noise", "tree",
)
_SIGNAL_GROUPS: tuple[tuple[tuple[str, ...], int], ...] = (
    (CRITICAL_SIGNALS, 3),
    (MEDIUM_SIGNALS, 2),
    (LOW_SIGNALS, 1),
)

_Cell = tuple[int, int, int]
_NEIGHBOUR_OFFSETS = tuple(itertools.product((-1, 0, 1), repeat=3))


def tokens(text: str) -> list[str]:
    """Split text into lowercase alphanumeric tokens."""
    return re.findall(r"[a-z0-9]+", text.lower())


def stem(token: str) -> str:
    """Strip one of the suffixes "ing", "ed" or "s" (first match only).

    A suffix is removed only when at least three characters remain, and "s"
    is never stripped from words ending in "ss".
    """
    for suffix in _STEM_SUFFIXES:
        if not token.endswith(suffix):
            continue
        if suffix == "s" and token.endswith("ss"):
            return token
        if len(token) - len(suffix) >= 3:
            return token[: -len(suffix)]
        return token
    return token


CATEGORY_KEYWORDS: dict[str, dict[str, int]] = {
    category: {stem(word): weight for word, weight in _RAW_KEYWORDS[category].items()}
    for category in CATEGORY_ORDER
}


def classify_text(text: str) -> tuple[str, float]:
    """Return ``(category, confidence)`` for a complaint.

    Every token occurrence adds its keyword weight to a category. Ties are
    broken by ``CATEGORY_ORDER``. A text with no keyword hits is ``"other"``
    with confidence ``0.0``. Confidence is
    ``(top / sum_of_all_scores) * min(1, top / 4)`` rounded to 3 decimals.
    """
    stems = [stem(token) for token in tokens(text)]
    scores = {
        category: sum(CATEGORY_KEYWORDS[category].get(s, 0) for s in stems)
        for category in CATEGORY_ORDER
    }
    best: str | None = None
    best_score = 0
    for category in CATEGORY_ORDER:
        if scores[category] > best_score:
            best, best_score = category, scores[category]
    if best is None:
        return OTHER_CATEGORY, 0.0
    total = sum(scores.values())
    confidence = (best_score / total) * min(1.0, best_score / 4)
    return best, round(confidence, 3)


def _content_stems(text: str) -> list[str]:
    """Tokenise, drop stopwords, then stem."""
    return [stem(token) for token in tokens(text) if token not in _STOPWORDS]


def similarity(a: str, b: str) -> float:
    """Average of token Jaccard and bag-of-words cosine similarity (4 decimals).

    Returns ``0.0`` when either side has no content tokens.
    """
    stems_a = _content_stems(a)
    stems_b = _content_stems(b)
    if not stems_a or not stems_b:
        return 0.0
    set_a, set_b = set(stems_a), set(stems_b)
    jaccard = len(set_a & set_b) / len(set_a | set_b)
    counts_a, counts_b = Counter(stems_a), Counter(stems_b)
    dot = sum(counts_a[t] * counts_b[t] for t in counts_a.keys() & counts_b.keys())
    norm = math.sqrt(sum(v * v for v in counts_a.values())) * math.sqrt(
        sum(v * v for v in counts_b.values())
    )
    cosine = dot / norm
    return round((jaccard + cosine) / 2, 4)


def find_duplicates(
    description: str,
    candidates: Sequence[Mapping[str, Any]],
    threshold: float = 0.3,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Return likely duplicates of ``description`` among ``candidates``.

    Each candidate needs ``"id"`` and ``"text"`` keys. A candidate is skipped
    when both texts have a known category and the categories differ. Results
    are sorted by ``(-similarity, str(id))`` and truncated to ``limit``.
    """
    base_category, _ = classify_text(description)
    matches: list[dict[str, Any]] = []
    for candidate in candidates:
        text = str(candidate["text"])
        candidate_category, _ = classify_text(text)
        if (
            base_category != OTHER_CATEGORY
            and candidate_category != OTHER_CATEGORY
            and base_category != candidate_category
        ):
            continue
        score = similarity(description, text)
        if score >= threshold:
            matches.append({"id": str(candidate["id"]), "similarity": score})
    matches.sort(key=lambda m: (-m["similarity"], m["id"]))
    return matches[:limit]


def grade_severity(text: str) -> tuple[str, float, list[str]]:
    """Grade severity from keyword signals.

    Signals are matched as whole words or phrases after lowercasing. The score
    is the highest weight among matched signals (critical 3, medium 2, other
    recognised civic words 1, none 0). Severity is ``"critical"`` for a score
    of at least 3, ``"medium"`` for at least 2, otherwise ``"low"``. Matched
    signals are returned critical first, then medium, then low.
    """
    padded = " " + " ".join(tokens(text)) + " "
    matched = [
        (signal, weight)
        for signals, weight in _SIGNAL_GROUPS
        for signal in signals
        if f" {signal} " in padded
    ]
    score = float(max((weight for _, weight in matched), default=0))
    if score >= 3:
        severity = "critical"
    elif score >= 2:
        severity = "medium"
    else:
        severity = "low"
    return severity, score, [signal for signal, _ in matched]


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres between two lat/lng points in degrees."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = phi2 - phi1
    delta_lambda = math.radians(lng2 - lng1)
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return 2.0 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def _cell_of(lat: float, lng: float, cell_size: float) -> _Cell:
    """Bucket a point on the unit sphere into a 3-D grid cell."""
    phi = math.radians(lat)
    lam = math.radians(lng)
    cos_phi = math.cos(phi)
    return (
        math.floor(cos_phi * math.cos(lam) / cell_size),
        math.floor(cos_phi * math.sin(lam) / cell_size),
        math.floor(math.sin(phi) / cell_size),
    )


def _mean_longitude(values: Sequence[float]) -> float:
    """Mean longitude that stays correct across the antimeridian."""
    reference = values[0]
    offset = math.fsum(((v - reference + 180.0) % 360.0) - 180.0 for v in values)
    result = reference + offset / len(values)
    if result > 180.0:
        result -= 360.0
    elif result < -180.0:
        result += 360.0
    return result


def find_hotspots(
    points: Sequence[Mapping[str, Any]],
    radius_m: float,
    min_points: int,
) -> list[dict[str, Any]]:
    """Cluster reports with DBSCAN-style density clustering.

    Each point needs ``"id"``, ``"lat"``, ``"lng"`` and optionally
    ``"severity"``. A point is a core point when at least ``min_points``
    points (itself included) lie within ``radius_m`` metres by haversine
    distance. Clusters grow from core points; noise is ignored. Neighbour
    candidates come from a 3-D grid over unit-sphere coordinates whose cell
    size is at least the chord length of ``radius_m``, which is exact near
    the poles and across the antimeridian. Every candidate is then confirmed
    with the haversine distance. Hotspots are sorted by
    ``(-critical_count, -count)`` with report ids as a final tie-break, so
    output is deterministic.
    """
    if radius_m <= 0:
        raise ValueError("radius_m must be positive")
    if min_points < 1:
        raise ValueError("min_points must be at least 1")
    total = len(points)
    if total < min_points:
        return []

    ids = [str(p["id"]) for p in points]
    lats = [float(p["lat"]) for p in points]
    lngs = [float(p["lng"]) for p in points]
    severities = [str(p.get("severity", "low")) for p in points]

    angle = min(radius_m / EARTH_RADIUS_M, math.pi)
    cell_size = 2.0 * math.sin(angle / 2.0) * 1.001
    cells = [_cell_of(lat, lng, cell_size) for lat, lng in zip(lats, lngs)]

    full_grid: dict[_Cell, list[int]] = {}
    for index, cell in enumerate(cells):
        full_grid.setdefault(cell, []).append(index)
    free_grid: dict[_Cell, set[int]] = {c: set(v) for c, v in full_grid.items()}

    def within(i: int, j: int) -> bool:
        return haversine_m(lats[i], lngs[i], lats[j], lngs[j]) <= radius_m

    def nearby(cell: _Cell) -> list[_Cell]:
        cx, cy, cz = cell
        return [(cx + dx, cy + dy, cz + dz) for dx, dy, dz in _NEIGHBOUR_OFFSETS]

    core_cache: dict[int, bool] = {}

    def is_core(i: int) -> bool:
        if i not in core_cache:
            hits = 0
            result = False
            for cell in nearby(cells[i]):
                for j in full_grid.get(cell, ()):
                    if within(i, j):
                        hits += 1
                        if hits >= min_points:
                            result = True
                            break
                if result:
                    break
            core_cache[i] = result
        return core_cache[i]

    def claim_unassigned_neighbours(i: int) -> list[int]:
        found: list[int] = []
        for cell in nearby(cells[i]):
            bucket = free_grid.get(cell)
            if not bucket:
                continue
            found.extend(j for j in bucket if within(i, j))
        for j in found:
            free_grid[cells[j]].discard(j)
        return sorted(found)

    clusters: list[list[int]] = []
    assigned = [False] * total
    for seed in sorted(range(total), key=lambda i: (ids[i], i)):
        if assigned[seed] or not is_core(seed):
            continue
        assigned[seed] = True
        free_grid[cells[seed]].discard(seed)
        members = [seed]
        stack = [seed]
        while stack:
            current = stack.pop()
            if not is_core(current):
                continue
            for neighbour in claim_unassigned_neighbours(current):
                assigned[neighbour] = True
                members.append(neighbour)
                stack.append(neighbour)
        clusters.append(members)

    hotspots: list[dict[str, Any]] = []
    for members in clusters:
        members.sort(key=lambda i: (ids[i], i))
        size = len(members)
        center_lat = math.fsum(lats[i] for i in members) / size
        center_lng = _mean_longitude([lngs[i] for i in members])
        farthest = max(haversine_m(center_lat, center_lng, lats[i], lngs[i]) for i in members)
        hotspots.append(
            {
                "center_lat": round(center_lat, 6),
                "center_lng": round(center_lng, 6),
                "count": size,
                "radius_m": round(farthest, 1),
                "report_ids": sorted(ids[i] for i in members),
                "critical_count": sum(1 for i in members if severities[i] == "critical"),
            }
        )
    hotspots.sort(key=lambda h: (-h["critical_count"], -h["count"], h["report_ids"]))
    return hotspots