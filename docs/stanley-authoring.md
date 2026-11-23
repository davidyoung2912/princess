# Teaching Stanley: adding a noun, a verb or a topic

Stanley's understanding of a question (`src/features/stanley/logic/understand/`) is plain data plus a small scorer. It runs on the device, with no model. This is the short way to widen it. Background and design: `docs/stanley-answers-plan.md`.

## 1. Find what to add

1. In **Settings, Diagnostics, Stanley**, turn on *Keep questions Stanley could not place*. It is off by default and stays on the device. Emails, links and numbers are blanked.
2. Use the app, or ask a few guests to. Press **Copy unanswered questions** and save the text to a file.
3. Run `STANLEY_EXPORT=path/to/export.json npm run stanley:misses`. It prints:
   - **Still not placed**, most asked first;
   - **Between topics**, the near-collisions with the topics they sit between;
   - **Concepts in the misses** and **Words the lexicon does not know**, the candidates to add;
   - **Placed now**, questions the engine already answers (the export is older than the lexicon).

Do not commit an export. Copy the *wording* of a few into the corpus by hand, rephrased so no one can be recognised.

## 2. Add a noun or a verb (`lexicon.ts`)

A word belongs to a **concept**. Nouns name things ("spa", "towel"), verbs are the asking acts ("where", "book", "cost"). Add the word, and its plural or spelling variants only if the stemmer (`stem.ts`) would not reach them, to the concept's line. If it is a new thing, add a new concept.

Rules the lexicon lint enforces: a word maps to one concept of a part of speech; a stop word is never evidence; every concept is used by at least one topic.

For a long tail topic (a line of `screenSpec.ts`) a guest recognised only by whole phrases, so new ways of saying it go in `screenSpecMore.ts` (the topic's id, then plain phrases of two or more words; one word only when it means one thing on a ship). Do not copy a held-out question into it.

## 3. Add a topic (`topics.ts`, and `screenSpec.ts` for a screen)

- **A screen to reach:** add one line to `screenSpec.ts` (id, nouns, plain questions, the screen). The lexicon, topic table, destinations and corpus are built from it, so it is added in one place.
- **A topic with its own pills:** add it to `topics.ts` with its concepts, the acts that fit, the stages it matters in, and its pill destinations (`destinations.ts`). At most three pills are ever shown.
- Give the pill words in `src/shared/i18n/locales/enCore.ts` (`understand.pill.<destination>`, `understand.topic.<id>`): short, sentence case, verbs first, no "AI" wording, no names.

## 4. Add corpus lines (`corpus/`)

For the topic add, as real phrases a guest would type: at least 8 paraphrases, 3 typos, 3 fragments or slang forms, and 4 near-miss negatives. Put 20 percent more in the **held-out** file, written without looking at the lexicon, and never tune against it. The held-out set is the honest measure. For the long tail, `corpus/heldoutFresh.ts` is the untouched measure (first score 0.52, gate 0.5) and `heldoutBlind.ts` is a regression guard; when a set has been tuned on, write a new one.

`stages.test.ts` holds typical questions for each of the eleven journey stages: add a line there when a question's best answer depends on the stage.

A filter a question can ask for (a diet the ship marks, a child's age) is a *qualifier* in `understand.ts`; its pill is a destination in `destinations.ts` listed in `QUALIFIED`.

## 5. Check

`npm run test` (the accuracy gates, reachability, lexicon lint and the golden file), `npm run lint`, `npx tsc -b`, `npm run build`. A change that lowers an accuracy gate, shows pills on a handoff, injection or permission case, or changes an existing `cases.json` decision fails the build. If the golden file changes, the diff in review should be the lines you meant to change.
