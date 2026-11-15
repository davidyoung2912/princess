# Usage: python3 -I extract.py  — turns raw2/*.json OCR into cabins/<ship>.json plus a gap report.
import json, re, glob, collections, os
os.makedirs('cabins', exist_ok=True)
SHIPS = ['sun', 'sky', 'sapphire']

def matches(ship, text, deck):
    if ship == 'sun':
        return [(m.group(), m.start(), m.end()) for m in re.finditer(r'\d{4,5}', text)]
    return [(m.group(), m.start(), m.end()) for m in re.finditer(r'[A-Z]\d{3}', text)]

def valid_sun(n, deck):
    return (deck >= 10 and len(n) == 5 and n.startswith(str(deck))) or (deck < 10 and len(n) == 4 and n.startswith(str(deck)))

report = {}
for ship in SHIPS:
    out = {}
    for f in sorted(glob.glob(f'raw2/{ship}-*.json'), key=lambda p: int(p.split('-')[-1][:-5])):
        deck = int(f.split('-')[-1][:-5])
        d = json.load(open(f))
        for extra in sorted(glob.glob(f'raw3/{ship}-{deck}-t*.json')):
            d['words'] += json.load(open(extra))['words']
        dets = []
        for w in d['words']:
            t = w['text']
            for n, a, b in matches(ship, t, deck):
                L = max(len(t), 1)
                fa, fb = a / L, b / L
                if w['rot'] == 0:
                    x = w['x0'] + (w['x1'] - w['x0']) * (fa + fb) / 2; y = (w['y0'] + w['y1']) / 2
                elif w['rot'] == 90:  # reads bottom to top
                    x = (w['x0'] + w['x1']) / 2; y = w['y1'] - (w['y1'] - w['y0']) * (fa + fb) / 2
                else:
                    x = (w['x0'] + w['x1']) / 2; y = w['y0'] + (w['y1'] - w['y0']) * (fa + fb) / 2
                dets.append((n, x, y, w['conf'], w['rot']))
        if os.path.exists('fills/found.json'):
            dets += [(x['cabin'], x['x'], x['y'], 99, x['rot']) for x in json.load(open('fills/found.json')) if x['ship'] == ship and x['deck'] == deck]
        if ship == 'sun':
            dets = [x for x in dets if valid_sun(x[0], deck)]
        else:
            pref = collections.Counter(x[0][0] for x in dets).most_common(1)
            pref = pref[0][0] if pref and pref[0][1] >= 8 else None
            dets = [x for x in dets if pref and x[0][0] == pref]
        # Real cabin numbers end in 101 to 799; anything else is OCR noise.
        dets = [x for x in dets if re.fullmatch(r'[1-7]\d\d', x[0][-3:]) and x[0][-3:] != '100']
        best = {}
        for n, x, y, c, r in dets:
            if n not in best or c > best[n][2]:
                best[n] = (x, y, c, r)
        # Estimate cabins the OCR missed: n-2 and n+2 are in one column and the gap between them is two rows tall (never a number ending in 13).
        def num(c): return int(re.sub(r'\D', '', c))
        prefix = '' if ship == 'sun' else next(iter(best))[0] if best else ''
        pos = {num(n): (v[0], v[1]) for n, v in best.items()}
        steps = sorted(abs(pos[n + 2][1] - pos[n][1]) for n in pos if n + 2 in pos and abs(pos[n + 2][0] - pos[n][0]) < 12 and pos[n + 2][1] != pos[n][1])
        pitch = steps[len(steps) // 2] if steps else 0
        est = set()
        for n in sorted(pos):
            m = n + 2
            if m in pos or (m + 2) not in pos or m % 100 == 13 or not pitch: continue
            (x0, y0), (x1, y1) = pos[n], pos[m + 2]
            if abs(x0 - x1) < 12 and 1.6 * pitch <= abs(y1 - y0) <= 2.4 * pitch:
                key = (prefix + str(m)) if ship != 'sun' else str(m)
                best[key] = ((x0 + x1) / 2, (y0 + y1) / 2, 0, -1)
                est.add(key)
        cabins = sorted(((n, round(v[0], 1), round(v[1], 1)) + ((1,) if n in est else ()) for n, v in best.items()), key=lambda c: c[2])
        out[deck] = {'width': d['width'], 'height': d['height'], 'cabins': cabins}
        # suspicious gaps: n-2 and n+2 present but n absent (13 is never used on a cabin number)
        have = set(best)
        pre = (lambda c: c[0]) if ship != 'sun' else (lambda c: '')
        nums = {num(c) for c in have}
        sample = next(iter(have), None)
        gaps = []
        for n in sorted(nums):
            m = n + 2
            if m not in nums and (m + 2) in nums and (m % 100) != 13:
                gaps.append(m)
        report[(ship, deck)] = (len(cabins), gaps, len(est))
    json.dump({str(k): v for k, v in out.items()}, open(f'cabins/{ship}.json', 'w'), separators=(',', ':'))
for (ship, deck), (n, gaps, e) in report.items():
    if n: print(f'{ship:9} deck {deck:2}: {n:4} cabins ({e} estimated); still possibly missing: {gaps}')
