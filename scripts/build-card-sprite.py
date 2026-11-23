#!/usr/bin/env python3
"""
Builds src/assets/cards/cards.svg from SVG-cards (https://github.com/htdebeer/SVG-cards, LGPL-2.1, by David Bellot, Huub de Beer and contributors).

Usage: python3 -I scripts/build-card-sprite.py path/to/svg-cards.svg

What it changes (the LGPL asks that changes are marked): keeps the 52 card faces and the parts they use and drops the jokers, backs and spare shapes; changes the numeral font
stack to one every phone has; and adds `edge_<suit>_<rank>` groups (card base plus corner index only) so the overlapped cards in a column are cheap to draw.
"""
import re, sys, xml.etree.ElementTree as ET

SVG = 'http://www.w3.org/2000/svg'
XL = 'http://www.w3.org/1999/xlink'
ET.register_namespace('', SVG)
ET.register_namespace('xlink', XL)
HREF = '{%s}href' % XL

root = ET.parse(sys.argv[1]).getroot()
defs = root[0]
by = {c.attrib.get('id'): c for c in defs}
SUITS = ['spade', 'heart', 'diamond', 'club']
need = set()
cards = [f'{s}_{r}' for s in SUITS for r in ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king']]


def walk(el):
    for e in el.iter():
        h = e.attrib.get(HREF)
        if h and h.startswith('#') and h[1:] not in need:
            need.add(h[1:])
            walk(by[h[1:]])


for c in cards:
    need.add(c)
    walk(by[c])

edges = []
for c in cards:
    g = by[c]
    uses = [u for u in g if u.tag == '{%s}use' % SVG]
    e = ET.Element('{%s}g' % SVG, {'id': 'edge_' + c})
    if 'transform' in g.attrib:
        e.set('transform', g.attrib['transform'])
    for k in (0, 1, 3):
        e.append(uses[k])
    edges.append(e)

out = ET.Element('{%s}svg' % SVG, {'viewBox': '0 0 169.075 244.64', 'width': '169.075', 'height': '244.64'})
d = ET.SubElement(out, '{%s}defs' % SVG)
for i, c in by.items():
    if i in need:
        d.append(c)
for e in edges:
    d.append(e)

text = ET.tostring(out, encoding='unicode')
text = text.replace('font-family="DejaVu Serif"', 'font-family="Georgia, \'Times New Roman\', \'DejaVu Serif\', serif"')
text = re.sub(r'\s(?:width|height)="100%"', '', text)
header = ('<?xml version="1.0" encoding="UTF-8"?>\n<!-- Card faces from SVG-cards 4.0.2, Copyright (C) 2005 David Bellot, (C) 2016, 2017 Huub de Beer and contributors.\n'
          '     Licensed under the GNU Lesser General Public License v2.1 (see public/licenses/svg-cards-LGPL-2.1.txt). Source: https://github.com/htdebeer/SVG-cards\n'
          '     MODIFIED: trimmed to the 52 card faces, numeral font stack changed, edge_* groups added (scripts/build-card-sprite.py). -->\n')
open('src/assets/cards/cards.svg', 'w').write(header + text + '\n')
print(len(cards), 'cards,', len(need), 'parts,', len(header + text) // 1024, 'KB')
