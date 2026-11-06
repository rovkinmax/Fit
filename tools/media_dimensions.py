"""Read the JPEG and animated WebP canvas dimensions used by exercise media.

No image decoding/re-encoding or third-party dependency is needed. This is a
header reader, not a full image validity checker; Chrome also verifies the
declared dimensions against its decoded natural dimensions.
"""

from html.parser import HTMLParser
from pathlib import Path
import re
import sys


def dimensions(data):
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        if len(data) < 30 or int.from_bytes(data[4:8], "little") + 8 != len(data):
            raise ValueError("Truncated or malformed WebP container")
        # Animated WebP always declares its canvas in the first VP8X chunk.
        if data[12:16] != b"VP8X" or int.from_bytes(data[16:20], "little") != 10:
            raise ValueError("Expected extended WebP canvas")
        if not data[20] & 2:
            raise ValueError("Expected animated WebP")
        return (1 + int.from_bytes(data[24:27], "little"),
                1 + int.from_bytes(data[27:30], "little"))
    if data[:2] == b"\xff\xd8":
        position = 2
        while position < len(data):
            if data[position] != 0xFF:
                raise ValueError("Malformed JPEG marker")
            while position < len(data) and data[position] == 0xFF:
                position += 1
            if position >= len(data):
                break
            marker = data[position]
            position += 1
            if marker in (0xD9, 0xDA):
                break
            size = int.from_bytes(data[position:position + 2], "big")
            if size < 2 or position + size > len(data):
                raise ValueError("Truncated JPEG segment")
            if marker in (0xC0, 0xC1, 0xC2):
                if size < 8:
                    raise ValueError("Truncated JPEG frame")
                height = int.from_bytes(data[position + 3:position + 5], "big")
                width = int.from_bytes(data[position + 5:position + 7], "big")
                if not width or not height:
                    raise ValueError("Non-positive JPEG dimensions")
                return width, height
            position += size
        raise ValueError("Missing JPEG frame")
    raise ValueError("Unsupported exercise image format")


class ExerciseImages(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.images = []
        self.in_media = False
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "figure":
            self.in_media = "exercise-media" in attrs.get("class", "").split()
        if tag == "img" and self.in_media:
            self.images.append(attrs)

    def handle_endtag(self, tag):
        if tag == "figure":
            self.in_media = False


def validate_dimensions(root, html):
    errors = []
    for image in ExerciseImages(html).images:
        source = image.get("src", "")
        try:
            declared = tuple(image.get(key, "") for key in ("width", "height"))
            if not all(re.fullmatch(r"[1-9][0-9]*", value) for value in declared):
                raise ValueError("Expected positive integer width and height")
            actual = dimensions((root / source).read_bytes())
            if tuple(map(int, declared)) != actual:
                raise ValueError(f"Declared {declared} differs from intrinsic {actual}")
        except (OSError, ValueError) as error:
            errors.append(f"{source}: {error}")
    return errors


def main():
    root = Path(__file__).resolve().parents[1]
    path = root / "index.html"
    html = path.read_text(encoding="utf-8")
    if sys.argv[1:] == ["--write"]:
        inventory = {image["src"]: dimensions((root / image["src"]).read_bytes())
                     for image in ExerciseImages(html).images}

        def update(match):
            tag = match.group()
            attrs = dict(re.findall(r'([\w-]+)="([^"]*)"', tag))
            if attrs.get("src") not in inventory:
                return tag
            tag = re.sub(r'\s(?:width|height)="[^"]*"', "", tag)
            width, height = inventory[attrs["src"]]
            return tag[:-1] + f' width="{width}" height="{height}">'

        html = re.sub(r"<img\b[^>]*>", update, html)
        path.write_text(html, encoding="utf-8")
        print(f"Updated dimensions for {len(inventory)} distinct exercise sources")
    elif sys.argv[1:]:
        raise SystemExit("Usage: python3 tools/media_dimensions.py [--write]")
    errors = validate_dimensions(root, html)
    if errors:
        raise SystemExit("\n".join(errors))
    print(f"PASS: {len(ExerciseImages(html).images)} exercise image dimensions")


if __name__ == "__main__":
    main()
