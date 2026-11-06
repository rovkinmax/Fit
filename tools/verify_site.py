#!/usr/bin/env python3
"""Dependency-free static integrity checks; browser behavior needs separate tests."""

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import sys
import unittest
from urllib.parse import unquote, urlsplit


class SiteParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.references = []
        self.controls = []
        self.tabs = []
        self.panels = []
        self.errors = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        for key in ("src", "href"):
            if attrs.get(key):
                self.references.append(attrs[key])
        if attrs.get("aria-controls"):
            self.controls.extend(attrs["aria-controls"].split())
        if attrs.get("role") == "tab":
            self.tabs.append(attrs)
        if attrs.get("role") == "tabpanel":
            self.panels.append(attrs)
        if tag == "img" and "alt" not in attrs:
            self.errors.append("Image is missing an alt attribute")


def validate(root):
    root = Path(root).resolve()
    errors = []
    try:
        html = (root / "index.html").read_text(encoding="utf-8")
        domain = (root / "CNAME").read_text(encoding="utf-8").strip()
    except (OSError, UnicodeError) as error:
        return [str(error)]
    if domain != "fit.rovkin.fun":
        errors.append("CNAME must preserve the production domain fit.rovkin.fun")
    if not (root / ".nojekyll").is_file():
        errors.append("Missing .nojekyll")
    parser = SiteParser()
    parser.feed(html)
    errors.extend(parser.errors)
    counts = Counter(parser.ids)
    errors.extend(f"Duplicate id: {name}" for name, count in counts.items() if count > 1)
    ids = set(parser.ids)
    panels = {panel.get("id") for panel in parser.panels}
    for control in parser.controls:
        if control not in ids:
            errors.append(f"Missing aria-controls target: {control}")
    if not parser.tabs or not parser.panels:
        errors.append("Training tabs or panels are missing")
    for tab in parser.tabs:
        if tab.get("aria-controls") not in panels:
            errors.append(f"Tab has no matching panel: {tab.get('id')}")
    if sum(tab.get("aria-selected") == "true" for tab in parser.tabs) != 1:
        errors.append("Exactly one tab must be initially selected")
    if sum("active" in panel.get("class", "").split() for panel in parser.panels) != 1:
        errors.append("Exactly one panel must be initially active")
    selected = next((tab for tab in parser.tabs if tab.get("aria-selected") == "true"), {})
    active = next((panel for panel in parser.panels if "active" in panel.get("class", "").split()), {})
    if selected.get("aria-controls") != active.get("id"):
        errors.append("Initially selected tab and active panel disagree")
    for reference in sorted(set(parser.references)):
        parsed = urlsplit(reference)
        if parsed.scheme or parsed.netloc:
            continue
        if not parsed.path:
            if parsed.fragment and unquote(parsed.fragment) not in ids:
                errors.append(f"Missing local fragment: {reference}")
            continue
        target = (root / unquote(parsed.path).lstrip("/")).resolve()
        if not target.is_relative_to(root):
            errors.append(f"Reference escapes the site root: {reference}")
        elif not target.is_file():
            errors.append(f"Missing local resource: {reference}")
    return errors


def main():
    root = Path(__file__).resolve().parents[1]
    suite = unittest.defaultTestLoader.discover(str(root / "tests"))
    if suite.countTestCases() == 0:
        print("No verification tests were discovered", file=sys.stderr)
        return 1
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    errors = validate(root)
    for error in errors:
        print(f"FAIL: {error}", file=sys.stderr)
    if errors or not result.wasSuccessful():
        return 1
    print("PASS: site references, tab structure, deployment files, and verifier tests")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
