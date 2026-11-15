# Usage: python3 -I convert.py <outdir>  — writes the app's compact cabin files from cabins/<ship>.json
import json, sys, os
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
for ship in ('sun', 'sky', 'sapphire'):
    src = json.load(open(f'cabins/{ship}.json'))
    decks, cabins = {}, {}
    for deck, d in src.items():
        if not d['cabins']: continue
        decks[deck] = [d['width'], d['height']]
        for c in d['cabins']:
            cabins[c[0]] = [int(deck), round(c[1]), round(c[2])] + ([1] if len(c) > 3 else [])
    json.dump({'decks': decks, 'cabins': dict(sorted(cabins.items()))}, open(f'{out}/{ship}.json', 'w'), separators=(',', ':'))
    print(ship, len(cabins), 'cabins', os.path.getsize(f'{out}/{ship}.json'), 'bytes')
