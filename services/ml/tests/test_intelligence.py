"""Unit tests for app.core.intelligence (no web framework involved)."""

import math
import random
import time

import pytest

from app.core.intelligence import (
    CATEGORY_KEYWORDS,
    CATEGORY_ORDER,
    EARTH_RADIUS_M,
    classify_text,
    find_duplicates,
    find_hotspots,
    grade_severity,
    haversine_m,
    similarity,
    stem,
    tokens,
)

M_PER_DEG = math.radians(1.0) * EARTH_RADIUS_M


def _point(pid: str, lat: float, lng: float, severity: str = "low") -> dict[str, object]:
    return {"id": pid, "lat": lat, "lng": lng, "severity": severity}


# --- tokens and stemming ---------------------------------------------------


def test_tokens_lowercases_and_splits() -> None:
    assert tokens("Pothole #5, on MG-Road!") == ["pothole", "5", "on", "mg", "road"]


@pytest.mark.parametrize(
    ("word", "expected"),
    [
        ("potholes", "pothole"),
        ("pothole", "pothole"),
        ("leaking", "leak"),
        ("leaks", "leak"),
        ("flooded", "flood"),
        ("flooding", "flood"),
        ("lights", "light"),
        ("dogs", "dog"),
        ("waterlogging", "waterlogg"),
        ("waterlogged", "waterlogg"),
        ("glass", "glass"),
        ("bus", "bus"),
        ("king", "king"),
        ("red", "red"),
    ],
)
def test_stem(word: str, expected: str) -> None:
    assert stem(word) == expected


def test_keywords_are_stemmed_at_load_time() -> None:
    assert "waterlogg" in CATEGORY_KEYWORDS["drainage"]
    assert "waterlogging" not in CATEGORY_KEYWORDS["drainage"]
    assert CATEGORY_KEYWORDS["pothole"]["pothole"] == 2
    assert tuple(CATEGORY_KEYWORDS) == CATEGORY_ORDER


# --- classification --------------------------------------------------------


def test_classify_inflected_forms() -> None:
    assert classify_text("Potholes and craters on the roads") == ("pothole", 1.0)
    assert classify_text("The pipes are leaking") [0] == "water_supply"
    assert classify_text("Flooded street")[0] == "drainage"
    assert classify_text("Street lights are off")[0] == "streetlight"


def test_classify_confidence_formula() -> None:
    assert classify_text("A deep pothole has opened in the roadway") == ("pothole", 0.75)
    assert classify_text("The water supply pipe is leaking") == ("water_supply", 1.0)


def test_classify_other() -> None:
    assert classify_text("The park gate is broken") == ("other", 0.0)
    assert classify_text("") == ("other", 0.0)


def test_classify_tie_breaks_by_category_order() -> None:
    assert classify_text("pothole garbage") == ("pothole", 0.25)
    assert classify_text("garbage near the pipe") == ("garbage", 0.25)
    assert classify_text("drain light")[0] == "streetlight"


def test_classify_is_deterministic() -> None:
    results = {classify_text("pothole garbage pipe lamp drain") for _ in range(25)}
    assert results == {("pothole", 0.1)}


# --- similarity and duplicates ---------------------------------------------


def test_similarity_edge_cases() -> None:
    assert similarity("", "pothole") == 0.0
    assert similarity("the is a", "pothole") == 0.0
    assert similarity("pothole on the road", "pothole on the road") == 1.0
    assert similarity("potholes on road", "pothole on road") == 1.0


def test_similarity_value() -> None:
    # Jaccard 2/3, cosine 2/sqrt(6) -> average 0.7416
    assert similarity("big pothole road", "pothole road") == pytest.approx(0.7416, abs=1e-4)


def test_duplicates_same_category_match() -> None:
    result = find_duplicates(
        "Large pothole on Station Road",
        [{"id": "1", "text": "Big pothole on Station Road near school"}],
    )
    assert [m["id"] for m in result] == ["1"]
    assert result[0]["similarity"] == pytest.approx(0.5854, abs=1e-4)


def test_duplicates_exclude_different_category() -> None:
    result = find_duplicates(
        "Large pothole on Station Road",
        [{"id": "g", "text": "Garbage piled on Station Road"}],
    )
    assert result == []


def test_duplicates_other_category_is_not_excluded() -> None:
    both_other = find_duplicates(
        "Station area problem", [{"id": "1", "text": "Station area problem again"}]
    )
    assert [m["id"] for m in both_other] == ["1"]
    one_other = find_duplicates(
        "Station area problem near", [{"id": "2", "text": "Station area pothole problem"}]
    )
    assert [m["id"] for m in one_other] == ["2"]


def test_duplicates_threshold_excludes_unrelated() -> None:
    assert find_duplicates("Pothole on Station Road", [{"id": "x", "text": "Completely unrelated"}]) == []


def test_duplicates_limit_and_tie_order() -> None:
    candidates = [{"id": f"c{n}", "text": "Pothole on Station Road"} for n in range(8, 0, -1)]
    result = find_duplicates("Pothole on Station Road", candidates)
    assert [m["id"] for m in result] == ["c1", "c2", "c3", "c4", "c5"]
    assert all(m["similarity"] == 1.0 for m in result)


def test_duplicates_sorted_by_similarity_then_id() -> None:
    candidates = [
        {"id": "a", "text": "Big pothole on Station Road near school"},
        {"id": "z", "text": "Pothole on Station Road"},
    ]
    result = find_duplicates("Pothole on Station Road", candidates)
    assert [m["id"] for m in result] == ["z", "a"]


def test_duplicates_deterministic_for_any_input_order() -> None:
    candidates = [{"id": name, "text": "Pothole on Station Road"} for name in "bdace"]
    expected = find_duplicates("Pothole on Station Road", candidates)
    shuffled = list(candidates)
    random.Random(3).shuffle(shuffled)
    assert find_duplicates("Pothole on Station Road", shuffled) == expected
    assert [m["id"] for m in expected] == ["a", "b", "c", "d", "e"]


# --- severity --------------------------------------------------------------


def test_severity_low_medium_critical() -> None:
    assert grade_severity("Garbage lying near the road") == ("low", 1.0, ["garbage", "road"])
    severity, score, signals = grade_severity("The streetlight is not working and the road is dark")
    assert (severity, score) == ("medium", 2.0)
    assert {"not working", "dark"} <= set(signals)
    severity, score, signals = grade_severity("Exposed wire sparking near the school")
    assert (severity, score) == ("critical", 3.0)
    assert {"exposed wire", "sparking", "school"} <= set(signals)


def test_severity_no_signals() -> None:
    assert grade_severity("The weather is nice") == ("low", 0.0, [])


def test_severity_phrase_and_whole_word_matching() -> None:
    severity, _, signals = grade_severity("There is a gas leak in the lane")
    assert severity == "critical"
    assert "gas leak" in signals and "leak" in signals
    assert "fire" not in grade_severity("Firewood stored near the road")[2]
    assert grade_severity("FIRE in the market")[0] == "critical"


# --- haversine -------------------------------------------------------------


def test_haversine_basics() -> None:
    assert haversine_m(21.25, 81.63, 21.25, 81.63) == 0.0
    assert haversine_m(0, 0, 1, 0) == pytest.approx(M_PER_DEG, rel=1e-9)
    assert haversine_m(0, 0, 0, 180) == pytest.approx(math.pi * EARTH_RADIUS_M, rel=1e-9)
    assert haversine_m(10, 20, 11, 22) == pytest.approx(haversine_m(11, 22, 10, 20))


def test_haversine_longitude_shrinks_with_latitude() -> None:
    assert haversine_m(60, 0, 60, 1) == pytest.approx(M_PER_DEG * 0.5, rel=1e-3)


# --- hotspots --------------------------------------------------------------


def test_hotspots_empty_and_too_few_points() -> None:
    assert find_hotspots([], 300, 3) == []
    assert find_hotspots([_point("a", 10, 20), _point("b", 10, 20)], 300, 3) == []


def test_hotspots_validate_parameters() -> None:
    with pytest.raises(ValueError):
        find_hotspots([_point("a", 0, 0)], 0, 1)
    with pytest.raises(ValueError):
        find_hotspots([_point("a", 0, 0)], 100, 0)


def test_hotspots_cluster_and_noise() -> None:
    points = [
        _point("p1", 21.2514, 81.6296),
        _point("p2", 21.2516, 81.6297, "critical"),
        _point("p3", 21.2515, 81.6299),
        _point("p4", 21.2513, 81.6295),
        _point("far", 21.3514, 81.7296),
    ]
    result = find_hotspots(points, 300, 3)
    assert len(result) == 1
    hotspot = result[0]
    assert hotspot["count"] == 4
    assert hotspot["report_ids"] == ["p1", "p2", "p3", "p4"]
    assert hotspot["critical_count"] == 1
    assert hotspot["center_lat"] == pytest.approx(21.25145, abs=1e-6)
    assert 0 < hotspot["radius_m"] < 100


def test_hotspots_border_point_joins_but_does_not_expand() -> None:
    def at(meters: float) -> float:
        return 10.0 + meters / M_PER_DEG

    points = [
        _point("A", at(0), 20.0),
        _point("B", at(100), 20.0),
        _point("C", at(200), 20.0),
        _point("D", at(400), 20.0),
        _point("E", at(700), 20.0),
    ]
    result = find_hotspots(points, 250, 3)
    assert len(result) == 1
    assert result[0]["report_ids"] == ["A", "B", "C", "D"]
    assert result[0]["center_lat"] == pytest.approx(at(175), abs=1e-6)
    assert result[0]["radius_m"] == pytest.approx(225.0, abs=0.2)


def test_hotspots_sorted_by_critical_then_count() -> None:
    def cluster(prefix: str, base_lat: float, size: int, critical: int = 0) -> list[dict[str, object]]:
        return [
            _point(f"{prefix}{k}", base_lat + (k * 10) / M_PER_DEG, 20.0,
                   "critical" if k < critical else "low")
            for k in range(size)
        ]

    points = cluster("P", 10.0, 3) + cluster("Q", 11.0, 4) + cluster("R", 12.0, 3, critical=1)
    result = find_hotspots(points, 100, 3)
    assert [h["report_ids"][0][0] for h in result] == ["R", "Q", "P"]
    assert [h["critical_count"] for h in result] == [1, 0, 0]


def test_hotspots_deterministic_for_any_input_order() -> None:
    rng = random.Random(11)
    points = [
        _point(f"p{n}", 21.25 + rng.uniform(0, 0.01), 81.63 + rng.uniform(0, 0.01))
        for n in range(150)
    ]
    expected = find_hotspots(points, 300, 3)
    shuffled = list(points)
    random.Random(5).shuffle(shuffled)
    assert find_hotspots(shuffled, 300, 3) == expected
    assert find_hotspots(points, 300, 3) == expected


def test_hotspots_work_across_the_antimeridian() -> None:
    points = [_point("w", 0.0, 179.9995), _point("e", 0.0, -179.9995)]
    result = find_hotspots(points, 300, 2)
    assert len(result) == 1
    assert result[0]["count"] == 2
    assert abs(abs(result[0]["center_lng"]) - 180.0) < 0.01
    assert result[0]["radius_m"] < 100


def test_hotspots_performance_spread_points() -> None:
    rng = random.Random(42)
    points = [
        _point(f"p{n}", rng.uniform(21.20, 21.30), rng.uniform(81.55, 81.70))
        for n in range(2000)
    ]
    start = time.perf_counter()
    result = find_hotspots(points, 300, 3)
    elapsed = time.perf_counter() - start
    assert elapsed < 1.0
    assert all(h["count"] >= 3 for h in result)


def test_hotspots_performance_dense_points() -> None:
    rng = random.Random(7)
    points = [
        _point(f"p{n}", rng.uniform(21.250, 21.251), rng.uniform(81.630, 81.631))
        for n in range(2000)
    ]
    start = time.perf_counter()
    result = find_hotspots(points, 300, 3)
    elapsed = time.perf_counter() - start
    assert elapsed < 1.0
    assert len(result) == 1
    assert result[0]["count"] == 2000