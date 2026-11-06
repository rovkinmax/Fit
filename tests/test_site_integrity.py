from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from verify_site import validate


HTML = """
<button id="day-1" role="tab" aria-controls="panel-1" aria-selected="true">Day 1</button>
<section id="panel-1" role="tabpanel" class="active"><img src="image.webp" alt="Exercise"></section>
"""


class SiteIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.write("index.html", HTML)
        self.write("CNAME", "fit.rovkin.fun\n")
        self.write(".nojekyll", "")
        self.write("image.webp", "fixture: existence check only")

    def write(self, name, content):
        (self.root / name).write_text(content, encoding="utf-8")

    def test_valid_structure(self):
        self.assertEqual(validate(self.root), [])

    def test_missing_resource(self):
        self.write("index.html", HTML.replace("image.webp", "missing.webp"))
        self.assertIn("Missing local resource: missing.webp", validate(self.root))

    def test_missing_tab_target(self):
        self.write("index.html", HTML.replace('aria-controls="panel-1"', 'aria-controls="absent"'))
        self.assertIn("Missing aria-controls target: absent", validate(self.root))

    def test_duplicate_id(self):
        self.write("index.html", HTML + '<div id="panel-1"></div>')
        self.assertIn("Duplicate id: panel-1", validate(self.root))

    def test_deployment_domain(self):
        self.write("CNAME", "other.invalid")
        self.assertTrue(any("production domain" in error for error in validate(self.root)))

    def test_resource_cannot_escape_root(self):
        self.write("index.html", HTML.replace("image.webp", "../outside.webp"))
        self.assertIn("Reference escapes the site root: ../outside.webp", validate(self.root))

    def test_encoded_filename(self):
        self.write("my image.webp", "fixture")
        self.write("index.html", HTML.replace("image.webp", "my%20image.webp"))
        self.assertEqual(validate(self.root), [])

    def test_selected_panel_mismatch(self):
        self.write("index.html", HTML.replace('class="active"', 'class=""') +
                   '<section id="other" role="tabpanel" class="active"></section>')
        self.assertIn("Initially selected tab and active panel disagree", validate(self.root))

    def test_missing_image_alt(self):
        self.write("index.html", HTML.replace(' alt="Exercise"', ""))
        self.assertIn("Image is missing an alt attribute", validate(self.root))

    def test_missing_fragment(self):
        self.write("index.html", HTML + '<a href="#absent">Jump</a>')
        self.assertIn("Missing local fragment: #absent", validate(self.root))

    def test_missing_index(self):
        self.root.joinpath("index.html").unlink()
        self.assertTrue(validate(self.root))


if __name__ == "__main__":
    unittest.main()
