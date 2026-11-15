# Deck plan cabin positions

`src/deckPlans/cabins/<ship>.json` holds each cabin's pixel position on its deck plan image. It was read from the printed cabin numbers with OCR, so it has to be redone whenever the plan images in `public/deckplans` are replaced (for example with Princess's official plans).

1. In a scratch folder outside the repo, `npm i tesseract.js sharp` and put `ocr.mjs` there.
2. For each plan: `node ocr.mjs <deck-N.gif> raw2/<ship>-<N>.json <digits|letters>` (`digits` for Sun Princess, `letters` for Sky and Sapphire). Optionally repeat with `THRESH=80` and `THRESH=150` into `raw3/<ship>-<N>-t<threshold>.json` to catch labels the first pass misses.
3. Optional gap fill: `python3 -I gaps.py` lists cabins that look missing (the one opposite, a hole in a column, one past a column's end) and `node fill.mjs` OCRs a crop at each, keeping only exact matches in `fills/found.json`, which `extract.py` merges.
4. `python3 -I extract.py` writes `cabins/<ship>.json` and lists cabins that still look missing; fix those by eye.
5. `python3 -I convert.py <repo>/src/deckPlans/cabins` writes the compact files the app imports.

Decks with no cabin numbers (public decks) are left out. Positions marked with a trailing `1` were estimated from the cabins either side.
