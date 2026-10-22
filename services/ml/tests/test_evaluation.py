import json
from pathlib import Path

from app.api.models import DescriptionRequest
from app.main import classify


CASES = json.loads((Path(__file__).parents[1] / "evaluation" / "classification_cases.json").read_text(encoding="utf-8"))


def test_labeled_keyword_baseline_evaluation() -> None:
    results = [classify(DescriptionRequest(description=item["description"])).category == item["expected"] for item in CASES]
    correct = sum(results)
    accuracy = correct / len(results)
    print(f"classification evaluation: {correct}/{len(results)} = {accuracy:.3f}")
    assert len(results) == 12
    assert correct == 12


def test_duplicate_similarity_explicit_cases() -> None:
    from app.main import duplicates
    from app.api.models import DuplicateRequest

    response = duplicates(DuplicateRequest(description="large pothole on Main Street", candidates=[
        {"id": "same", "text": "large pothole on Main Street"},
        {"id": "different", "text": "garbage collection near the market"},
    ]))
    assert [candidate.id for candidate in response.candidates] == ["same"]
    assert response.candidates[0].similarity == 1
