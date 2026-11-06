from collections import Counter
from pathlib import Path
import struct
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from media_dimensions import ExerciseImages, dimensions, validate_dimensions


ROOT = Path(__file__).resolve().parents[1]


def jpeg(width, height, marker=0xC0):
    return b"\xff\xd8\xff" + bytes([marker]) + struct.pack(">HBHHB", 8, 8, height, width, 0)


def webp(width, height):
    canvas = b"\x02\0\0\0" + (width - 1).to_bytes(3, "little") + (height - 1).to_bytes(3, "little")
    return b"RIFF" + struct.pack("<I", 22) + b"WEBPVP8X" + struct.pack("<I", 10) + canvas


class MediaDimensionTests(unittest.TestCase):
    def test_all_exercise_images_match_actual_assets(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertEqual(validate_dimensions(ROOT, html), [])
        images = ExerciseImages(html).images
        self.assertEqual(len(images), 165)
        sources = {image["src"] for image in images}
        self.assertEqual(Counter(Path(source).suffix for source in sources),
                         {".webp": 123, ".jpg": 25})
        self.assertTrue(all(image.get("loading") == "lazy" for image in images))
        self.assertTrue(all(image.get("alt") for image in images))

    def test_baseline_and_progressive_jpeg(self):
        for marker in (0xC0, 0xC1, 0xC2):
            self.assertEqual(dimensions(jpeg(1200, 763, marker)), (1200, 763))

    def test_animated_canvas(self):
        self.assertEqual(dimensions(webp(700, 394)), (700, 394))
        self.assertEqual(dimensions(webp(16777216, 1)), (16777216, 1))

    def test_jpeg_metadata_before_frame(self):
        data = jpeg(400, 300)
        self.assertEqual(dimensions(data[:2] + b"\xff\xe0\0\x06abcd" + data[2:]), (400, 300))

    def test_malformed_headers_fail(self):
        valid_webp = webp(700, 394)
        for data in (b"", b"GIF89a", b"RIFF", b"\xff\xd8", b"\xff\xd8\xff",
                     jpeg(0, 40), jpeg(20, 0), jpeg(20, 40)[:-1],
                     b"\xff\xd8\xff\xe0\0\x01",
                     b"\xff\xd8\xff\xda\0\x02",
                     valid_webp[:-1], valid_webp + b"x",
                     valid_webp[:12] + b"VP8 " + valid_webp[16:],
                     valid_webp[:20] + b"\0" + valid_webp[21:]):
            with self.subTest(data=data), self.assertRaises(ValueError):
                dimensions(data)

    def test_reject_missing_incorrect_and_malformed_attributes(self):
        source = next((ROOT / "assets-fixed-v3").glob("*.jpg")).relative_to(ROOT)
        width, height = dimensions((ROOT / source).read_bytes())
        valid = f'<figure class="exercise-media"><img src="{source}" width="{width}" height="{height}"></figure>'
        self.assertEqual(validate_dimensions(ROOT, valid), [])
        for invalid in (valid.replace(f' width="{width}"', ""),
                        valid.replace(f'height="{height}"', 'height="0"'),
                        valid.replace(f'width="{width}"', 'width="700.0"'),
                        valid.replace(f'width="{width}"', 'width="999"'),
                        valid.replace(f'width="{width}"', 'width="-1"'),
                        valid.replace(f'width="{width}"', 'width="1e3"')):
            with self.subTest(html=invalid):
                self.assertEqual(len(validate_dimensions(ROOT, invalid)), 1)

    def test_unrelated_images_are_not_exercise_media(self):
        self.assertEqual(ExerciseImages('<img src="other.jpg">').images, [])


if __name__ == "__main__":
    unittest.main()
