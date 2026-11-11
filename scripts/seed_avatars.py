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
