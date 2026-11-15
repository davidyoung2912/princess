# Usage: python3 -I gaps.py  — lists cabin numbers that are probably missing, with the spot to look at, as fills/candidates.json
import json, re, os, statistics
os.makedirs('fills', exist_ok=True)
cands = []
for ship in ('sun', 'sky', 'sapphire'):
    src = json.load(open(f'cabins/{ship}.json'))
    for deck, d in src.items():
        if not d['cabins']: continue
        W = d['width']
        have = {c[0]: (c[1], c[2]) for c in d['cabins']}
        def split(n):
            m = re.fullmatch(r'([A-Z]?)(\d+)', n); return m.group(1), int(m.group(2))
        def name(prefix, v): return prefix + str(v)
        found = {}
        # A) the cabin opposite on the other side of the ship (n and n+1, even number on the port side)
        for n, (x, y) in have.items():
            pre, v = split(n)
            partner = v - 1 if v % 2 == 0 else v + 1
            key = name(pre, partner)
            if key in have or partner % 100 == 13 or not (101 <= partner % 1000 or len(str(partner)) >= 4): continue
            if abs(x - W / 2) < 0.18 * W: continue
            found.setdefault(key, (W - x, y, 'mirror'))
        # B) row-sized holes in a column
        cols = {}
        for n, (x, y) in have.items():
            cols.setdefault(round(x / 24), []).append((y, n, x))
        for k, col in cols.items():
            col.sort()
            dys = [b[0] - a[0] for a, b in zip(col, col[1:])]
            if len(dys) < 4: continue
            pitch = statistics.median(dys)
            for a, b in zip(col, col[1:]):
                dy = b[0] - a[0]
                if dy < 1.6 * pitch: continue
                rows = round(dy / pitch) - 1
                pa, va = split(a[1]); pb, vb = split(b[1])
                if rows < 1 or rows > 4 or pa != pb: continue
                if (vb - va) % (rows + 1): continue
                step = (vb - va) // (rows + 1)
                for i in range(1, rows + 1):
                    vv = va + step * i
                    key = name(pa, vv)
                    if key in have or vv % 100 == 13: continue
                    found.setdefault(key, (a[2] + (b[2] - a[2]) * i / (rows + 1), a[0] + dy * i / (rows + 1), 'column'))
        # C) one row beyond each end of a column
        for k, col in cols.items():
            col.sort()
            if len(col) < 4: continue
            dys = [b[0] - a[0] for a, b in zip(col, col[1:])]
            pitch = statistics.median(dys)
            nums = [split(c[1]) for c in col]
            if len({p for p, _ in nums}) != 1: continue
            vs = [v for _, v in nums]
            steps = sorted(abs(b - a) for a, b in zip(vs, vs[1:]) if 0 < abs(b - a) <= 6)
            if not steps: continue
            step = steps[len(steps) // 2]
            sign = 1 if vs[-1] > vs[0] else -1
            pre = nums[0][0]
            xm = sum(c[2] for c in col) / len(col)
            for off, ref, yy in ((-1, vs[0], col[0][0] - pitch), (1, vs[-1], col[-1][0] + pitch)):
                for extra in (step, step * 2):
                    vv = ref + off * sign * extra
                    key = name(pre, vv)
                    if key in have or vv % 100 == 13 or vv % 1000 < 101: continue
                    found.setdefault(key, (xm, yy + off * (extra // step - 1) * pitch, 'end'))
        for key, (x, y, why) in found.items():
            cands.append({'ship': ship, 'deck': int(deck), 'cabin': key, 'x': round(x, 1), 'y': round(y, 1), 'why': why})
json.dump(cands, open('fills/candidates.json', 'w'))
from collections import Counter
print(len(cands), 'candidates', dict(Counter((c['ship'], c['why']) for c in cands)))
