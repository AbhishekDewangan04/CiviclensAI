"""Accuracy check for the keyword classifier against the evaluation set."""

import json
from pathlib import Path

from app.core.intelligence import classify_text

CASES_PATH = Path(__file__).resolve().parent.parent / "evaluation" / "classification_cases.json"


def test_classification_accuracy() -> None:
    cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    assert len(cases) >= 24
    misses = []
    for case in cases:
        predicted, _ = classify_text(case["description"])
        if predicted != case["expected"]:
            misses.append(
                f"{case['description']!r}: expected {case['expected']}, got {predicted}"
            )
    accuracy = (len(cases) - len(misses)) / len(cases)
    assert accuracy >= 0.9, f"accuracy {accuracy:.3f}; misses:\n" + "\n".join(misses)