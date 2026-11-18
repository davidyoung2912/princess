#!/usr/bin/env python3
"""
Generates the catalogue of chat avatars a guest picks from, and writes it as a SQL seed.

Run this by hand, outside the app, whenever the set should change:

    python3 scripts/seed_avatars.py

It asks the DiceBear HTTP API (https://www.dicebear.com) for each avatar with fixed seeds and options, so the same run gives the same pictures.
It writes:
  db/seed/avatars/01-avatars.sql   MERGE statements for dbo.ChatAvatars (the pictures are stored in the database; the app never calls DiceBear)
  db/seed/avatars/avatars.json     the list without the pictures (id, label, group, style, seed, options, creator, licence), for review

Only styles that are free for commercial use with no attribution (CC0, or the creator's "free for personal and commercial use") are allowed;
the script reads the licence out of each picture's own metadata and stops if it is anything else. The metadata is then removed from the stored
picture (the creator and licence are kept in their own columns instead). The standard library only; no packages to install.
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://api.dicebear.com/9.x"
OUT = Path(__file__).resolve().parent.parent / "db" / "seed" / "avatars"
BACKGROUNDS = "b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,d3f0d0"
OK_LICENCES = ("CC0 1.0", "Free for personal and commercial use")

SHORT = ["shortFlat", "shortWaved", "shortCurly", "theCaesar", "theCaesarAndSidePart", "shortRound", "sides", "frizzle"]
LONG = ["longButNotTooLong", "straight01", "straight02", "bob", "curly", "bigHair", "bun", "curvy"]
BEARD = ["beardLight", "beardMedium", "moustacheFancy", "beardMajestic"]

# More people, added after the first fifty so every id a guest has already chosen stays the same (an id is its style and its place in this list).
# Skin and hair colours are DiceBear's own avataaars palette; the other looks (clothes, faces) come from the seed.
SKIN = ["ffdbb4", "edb98a", "d08b5b", "ae5d29", "614335", "fd9841", "f8d25c"]
HAIR = ["2c1b18", "4a312c", "724133", "a55728", "b58143", "d6b370", "c93305", "e8e1e1", "ecdcbf", "f59797"]
LOOKS = [
    ("shortFlat", "short hair"), ("longButNotTooLong", "long hair"), ("shortCurly", "short curly hair"), ("bob", "a bob"), ("frizzle", "frizzy hair"), ("bun", "hair in a bun"),
    ("shortWaved", "wavy hair"), ("curly", "long curly hair"), ("theCaesar", "a neat crop"), ("straight01", "long straight hair"), ("sides", "hair at the sides"), ("curvy", "long wavy hair"),
    ("dreads01", "dreadlocks"), ("fro", "an afro"), ("shortRound", "round short hair"), ("bigHair", "big hair"), ("shaggyMullet", "a shaggy mullet"), ("miaWallace", "a sleek bob"),
    ("hijab", "a headscarf"), ("turban", "a turban"), ("hat", "a hat"), ("winterHat1", "a woolly hat"), ("winterHat03", "a bobble hat"), ("froBand", "an afro with a headband"),
]
GLASSES = [None, None, None, "prescription01", None, "round", None, "sunglasses", None, "prescription02", None, "kurt"]


def more_people():
    rows = []
    for i in range(60):
        top, words = LOOKS[i % len(LOOKS)]
        glasses = GLASSES[i % len(GLASSES)]
        options = {"top": top, "skinColor": SKIN[(i * 3) % len(SKIN)], "hairColor": HAIR[(i * 7) % len(HAIR)], "facialHairProbability": "0"}
        label = f"Person {i + 21}, {words}"
        if glasses:
            options.update({"accessories": glasses, "accessoriesProbability": "100"})
            label += ", sunglasses" if glasses == "sunglasses" else ", glasses"
        else:
            options["accessoriesProbability"] = "0"
        if i % 5 == 4 and top not in ("hijab", "turban", "hat", "winterHat1", "winterHat03"):
            options.update({"facialHairProbability": "100", "facialHair": BEARD[(i // 5) % len(BEARD)]})
            label += ", beard"
        rows.append(("people", "avataaars", f"princess-more-{i + 1}", label, options))
    return rows


def build():
    """(group, style, seed, label, options) for every avatar, in the order they are shown."""
    rows = []
    for i, top in enumerate(SHORT, 1):
        rows.append(("people", "avataaars", f"princess-short-{i}", f"Person {i}, short hair", {"top": top, "facialHairProbability": "0"}))
    for i, top in enumerate(LONG, 1):
        rows.append(("people", "avataaars", f"princess-long-{i}", f"Person {i + 8}, long hair", {"top": top, "facialHairProbability": "0"}))
    for i, beard in enumerate(BEARD, 1):
        rows.append(("people", "avataaars", f"princess-beard-{i}", f"Person {i + 16}, beard", {"top": SHORT[i - 1], "facialHairProbability": "100", "facialHair": beard}))
    for i in range(1, 7):
        rows.append(("sketch", "open-peeps", f"princess-peep-{i}", f"Sketch person {i}", {}))
    for i in range(1, 5):
        rows.append(("sketch", "notionists", f"princess-doodle-{i}", f"Doodle person {i}", {}))
    for i in range(1, 13):
        rows.append(("robots", "bottts", f"princess-bot-{i}", f"Robot {i}", {}))
    for i in range(1, 9):
        rows.append(("critters", "thumbs", f"princess-critter-{i}", f"Critter {i}", {}))
    # Everything below is new: it goes after the first fifty so their ids do not move.
    rows.extend(more_people())
    for i in range(7, 27):
        rows.append(("sketch", "open-peeps", f"princess-peep-{i}", f"Sketch person {i}", {}))
    for i in range(5, 19):
        rows.append(("sketch", "notionists", f"princess-doodle-{i}", f"Doodle person {i}", {}))
    for i in range(1, 17):
        rows.append(("sketch", "lorelei", f"princess-portrait-{i}", f"Portrait {i}", {}))
    for i in range(13, 29):
        rows.append(("robots", "bottts", f"princess-bot-{i}", f"Robot {i}", {}))
    for i in range(1, 13):
        rows.append(("robots", "bottts-neutral", f"princess-botface-{i}", f"Robot face {i}", {}))
    for i in range(9, 31):
        rows.append(("critters", "thumbs", f"princess-critter-{i}", f"Critter {i}", {}))
    # Faces without bodies, in the same hands as the People and Sketches above, added to those groups.
    for i in range(1, 11):
        rows.append(("people", "avataaars-neutral", f"princess-face-{i}", f"Person {80 + i}, face only", {}))
    for i in range(1, 9):
        rows.append(("sketch", "lorelei-neutral", f"princess-portrait-face-{i}", f"Portrait face {i}", {}))
    for i in range(1, 9):
        rows.append(("sketch", "notionists-neutral", f"princess-doodle-face-{i}", f"Doodle face {i}", {}))
    # Two new groups: retro pixel people and faces, and abstract patterns for a guest who would rather not show a face.
    for i in range(1, 31):
        rows.append(("pixel", "pixel-art", f"princess-pixel-{i}", f"Pixel person {i}", {}))
    for i in range(1, 21):
        rows.append(("pixel", "pixel-art-neutral", f"princess-pixel-face-{i}", f"Pixel face {i}", {}))
    for i in range(1, 21):
        rows.append(("abstract", "shapes", f"princess-shape-{i}", f"Shapes {i}", {}))
    for i in range(1, 11):
        rows.append(("abstract", "rings", f"princess-ring-{i}", f"Rings {i}", {}))
    for i in range(1, 11):
        rows.append(("abstract", "glass", f"princess-glass-{i}", f"Glass {i}", {}))
    for i in range(1, 11):
        rows.append(("abstract", "identicon", f"princess-pattern-{i}", f"Pattern {i}", {}))
    return rows


def fetch(style, seed, options):
    params = {"seed": seed, "backgroundColor": BACKGROUNDS, "backgroundType": "solid", **options}
    url = f"{API}/{style}/svg?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read().decode("utf-8")


def tidy(svg):
    """(svg without the xml line and metadata and with plain ASCII only, creator, licence)."""
    meta = re.search(r"<metadata.*?</metadata>", svg, re.S)
    if not meta:
        sys.exit("a picture came back with no metadata, so its licence cannot be checked")
    creator = re.search(r"<dc:creator>(.*?)</dc:creator>", meta.group(0)).group(1)
    rights = re.search(r"<dc:rights>(.*?)</dc:rights>", meta.group(0)).group(1)
    licence = next((l for l in OK_LICENCES if l in rights), None)
    if licence is None:
        sys.exit(f"licence not allowed: {rights}")
    svg = re.sub(r"<\?xml.*?\?>", "", svg)
    svg = svg.replace(meta.group(0), "").strip()
    svg = re.sub(r">\s+<", "><", svg)
    svg = "".join(c if ord(c) < 128 else f"&#{ord(c)};" for c in svg)  # the seed files are plain ASCII
    if "<script" in svg.lower() or "onload" in svg.lower() or "<foreignObject" in svg:
        sys.exit("a picture contains something that is not plain drawing")
    return svg, creator, licence


def sql_text(s):
    return "N'" + s.replace("'", "''") + "'"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest, statements = [], []
    for n, (group, style, seed, label, options) in enumerate(build(), 1):
        ident = f"{style}-{n:02d}"
        svg, creator, licence = tidy(fetch(style, seed, options))
        manifest.append({"id": ident, "label": label, "group": group, "style": style, "seed": seed, "options": options, "creator": creator, "licence": licence, "bytes": len(svg)})
        statements.append(
            "MERGE dbo.ChatAvatars AS t USING (SELECT %s AS Id) AS s ON t.Id = s.Id\n"
            "WHEN MATCHED THEN UPDATE SET Label = %s, GroupName = %s, Style = %s, Seed = %s, Creator = %s, Licence = %s, SortOrder = %d, Svg = %s\n"
            "WHEN NOT MATCHED THEN INSERT (Id, Label, GroupName, Style, Seed, Creator, Licence, SortOrder, Svg) VALUES (%s, %s, %s, %s, %s, %s, %s, %d, %s);\n"
            % (sql_text(ident), sql_text(label), sql_text(group), sql_text(style), sql_text(seed), sql_text(creator), sql_text(licence), n, sql_text(svg),
               sql_text(ident), sql_text(label), sql_text(group), sql_text(style), sql_text(seed), sql_text(creator), sql_text(licence), n, sql_text(svg))
        )
        print(f"{ident:16} {label:28} {len(svg):6} bytes  {licence}")
    header = "-- Generated by scripts/seed_avatars.py (DiceBear, free for commercial use, no attribution needed). Do not edit by hand: change the script and run it again.\nSET NOCOUNT ON;\n"
    (OUT / "01-avatars.sql").write_text(header + "\n".join(statements), encoding="ascii")
    (OUT / "avatars.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"{len(manifest)} avatars, {sum(m['bytes'] for m in manifest)} bytes of drawing")


if __name__ == "__main__":
    main()
