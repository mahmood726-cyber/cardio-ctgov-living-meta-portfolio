"""Smoke test for the cardio CT.gov living-meta portfolio.

Validates the structural invariants of the committed output without requiring
the sibling shared app or a network connection:

* the portfolio manifest is valid JSON and lists at least one topic
* every project folder present on disk carries index.html, plan.html and a
  valid validation.json whose slug matches the folder name
* per-study event counts in each validation.json are non-negative integers
  that never exceed their denominator (the core data-integrity contract that
  the meta-analysis engine relies on)

Run directly (``python tests/test_smoke.py``) or under pytest. Exits non-zero
on the first failure so it can gate ``npm run test:smoke``.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECTS_DIR = ROOT / "projects"
MANIFEST_PATH = ROOT / "generated" / "portfolio-manifest.json"


def _fail(message):
    raise AssertionError(message)


def test_manifest_is_valid():
    assert MANIFEST_PATH.exists(), "generated/portfolio-manifest.json is missing"
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    topics = manifest.get("topics")
    assert isinstance(topics, list) and topics, "manifest has no topics"


def test_project_folders_are_structurally_complete():
    assert PROJECTS_DIR.is_dir(), "projects/ directory is missing"
    project_dirs = sorted(p for p in PROJECTS_DIR.iterdir() if p.is_dir())
    assert project_dirs, "no project folders found on disk"

    for project_dir in project_dirs:
        slug = project_dir.name
        for name in ("index.html", "plan.html", "validation.json"):
            target = project_dir / name
            if not target.exists():
                _fail(f"{slug}: missing {name}")

        validation = json.loads((project_dir / "validation.json").read_text(encoding="utf-8"))
        topic = validation.get("topic") or {}
        if topic.get("slug") != slug:
            _fail(f"{slug}: validation slug mismatch (got {topic.get('slug')!r})")

        included = topic.get("includedStudies")
        if not isinstance(included, list):
            _fail(f"{slug}: validation missing includedStudies list")

        for study in included:
            outcome = study.get("outcome")
            if not outcome:
                continue
            for group in outcome.get("groups") or []:
                events = group.get("events")
                if events is None:
                    continue
                if not isinstance(events, int) or isinstance(events, bool):
                    _fail(f"{slug}: {study.get('nctId')}: non-integer event count {events!r}")
                if events < 0:
                    _fail(f"{slug}: {study.get('nctId')}: negative event count {events}")
                n = group.get("n")
                if n is not None and events > n:
                    _fail(f"{slug}: {study.get('nctId')}: events {events} exceed denominator {n}")


def main():
    test_manifest_is_valid()
    test_project_folders_are_structurally_complete()
    sys.stdout.write("smoke: manifest + project folders validated OK\n")


if __name__ == "__main__":
    main()
