"""Build OFL-compliant, character-partitioned web fonts from installed source TTFs.

Usage: uv run --with fonttools --with brotli python scripts/build-webfonts.py FONT_DIR
Only public application sources influence the common subset; never read user bookmarks.
"""
import argparse
import hashlib
import json
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FAMILY = "Home Start Mono"  # Rename modified fonts to respect the source's reserved name.


def ranges(points):
    result = []
    for value in sorted(points):
        if result and value == result[-1][1] + 1:
            result[-1][1] = value
        else:
            result.append([value, value])
    return ",".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in result)


def rename(font, style):
    names = {1: FAMILY, 2: style, 3: f"HomeStartMono-{style}-web-subset",
             4: f"{FAMILY} {style}", 6: f"HomeStartMono-{style}",
             16: FAMILY, 17: style, 18: f"{FAMILY} {style}"}
    for record in font["name"].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding(), errors="replace")
    for name_id, value in names.items():
        font["name"].setName(value, name_id, 3, 1, 0x409)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("font_dir", type=Path)
    args = parser.parse_args()
    output = ROOT / "assets" / "fonts"
    output.mkdir(parents=True, exist_ok=True)
    public_text = "".join((ROOT / name).read_text(encoding="utf-8")
                          for name in ("index.html", "app.js", "bookmarks.js"))
    common = set(range(0x250)) | set(range(0x2000, 0x2070)) | set(range(0x3000, 0x3040))
    common |= {ord(c) for c in public_text if ord(c) > 127}
    entries, faces, attribution = [], [], []
    faces.append("/* Derived from Maple Mono NF CN under SIL OFL 1.1; see OFL.txt and README.md. */")
    for style, weight in (("Regular", "100 500"), ("Bold", "600 900")):
        source = args.font_dir / f"MapleMono-NF-CN-{style}.ttf"
        font = TTFont(source, recalcTimestamp=False)
        cmap = set(font.getBestCmap())
        attribution.append({"style": style, "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                            "copyright": font["name"].getDebugName(0),
                            "source_version": font["name"].getDebugName(5), "codepoints": len(cmap)})
        font.close()
        core = cmap & common
        parts = {"core": core}
        for code in sorted(cmap - core):
            parts.setdefault(f"u{code // 256:04x}", set()).add(code)
        covered = set()
        for label, points in parts.items():
            font = TTFont(source, recalcTimestamp=False)
            options = subset.Options()
            options.name_IDs = ["*"]
            options.name_legacy = True
            options.name_languages = ["*"]
            options.layout_features = ["*"]
            options.recalc_timestamp = False
            worker = subset.Subsetter(options=options)
            worker.populate(unicodes=points)
            worker.subset(font)
            rename(font, style)
            font.flavor = "woff2"
            name = f"home-mono-{style.lower()}-{label}.woff2"
            target = output / name
            font.save(target)
            font.close()
            check = TTFont(target)
            actual = set(check.getBestCmap())
            assert points <= actual, (name, points - actual)
            assert check["name"].getDebugName(1) == FAMILY
            check.close()
            covered |= points
            digest = hashlib.sha256(target.read_bytes()).hexdigest()
            entries.append({"file": name, "style": style, "bytes": target.stat().st_size,
                            "sha256": digest, "codepoints": len(points), "unicode_range": ranges(points)})
            local_name = "Maple Mono NF CN" if style == "Regular" else "Maple Mono NF CN Bold"
            faces.append(f'''@font-face {{
  font-family: "{FAMILY}";
  font-style: normal;
  font-weight: {weight};
  font-display: swap;
  src: local("{local_name}"), local("MapleMono-NF-CN-{style}"), url("./{name}?v={digest[:12]}") format("woff2");
  unicode-range: {ranges(points)};
}}''')
            print(f"{style} {label}: {len(points)} codepoints, {target.stat().st_size} bytes", flush=True)
        assert covered == cmap, (style, len(cmap - covered))
    (output / "fonts.css").write_text("\n\n".join(faces) + "\n", encoding="utf-8")
    manifest = {"family": FAMILY, "upstream": "https://github.com/subframe7536/maple-font",
                "sources": attribution, "files": entries, "total_bytes": sum(e["bytes"] for e in entries)}
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"files": len(entries), "total_bytes": manifest["total_bytes"],
                      "core_bytes": sum(e["bytes"] for e in entries if "-core." in e["file"])}, indent=2))


if __name__ == "__main__":
    main()
