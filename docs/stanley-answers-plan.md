# Stanley understands: topics, pills and direct answers, with no model

Status: **plan, written 2026-11-17. Nothing here is built except what section 2 lists as existing. Phase 1 is the first thing to build.**

Goal: make asking Stanley as useful as possible **without calling any AI model**, in the Ask Stanley dialog and in the Stanley chat conversation alike. A guest types a question in their own words, with typos and slang; Stanley works out what it is about and either answers it from data the app already holds, or says plainly where to look and puts one-tap **pill buttons** under the reply that open the right screens (above all the explorers, with the search already filled in).

Follows `CLAUDE.md`: Vite + React + TypeScript, plain CSS, framework-free logic in plain TypeScript modules under `src` (unit tested in node), English only, WCAG 2.2 AA, no browser testing, verified with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` only, never a full `dotnet test`, phases that commit and stop.

---

## 1. Principles

1. **No model anywhere in this plan.** Every step is deterministic: the same words give the same reply on every device, offline included. A model, where one is set up on the server, is untouched and still answers what it answers today; this plan makes the app good when it is switched off, and makes the model's answers more useful by adding pills.
2. **Safety first, unchanged.** The order stays: word filter, emergency and medical screen (`screen()` and `ConciergeRules.Screen`), muster, the never-do refusals (pay, cancel a booking, change a cabin, share data). The understanding engine runs only after them and can never override one. A question the safety screen takes gets **no topic pills** (a handoff is not a shopping list).
3. **A wrong pill is worse than no pill.** Pills appear only above a confidence threshold, never more than three, and only for screens that exist and make sense for this guest right now (stage, booking, aboard or ashore). When unsure the engine says so honestly and offers its two closest guesses as "Did you mean" pills, or search.
4. **Never invent.** A direct answer is built only from authored or served data, with its source named. A missing fact is a pill to the screen that has it, never a guess. Personal facts (bill, bookings, all aboard time) are never answered here: they stay with the server's resolvers, which read the account.
5. **Additive.** The authored library, ship facts, the server's action previews and resolver cards keep working and keep their order. The engine adds pills to every reply, and answers only what would otherwise fall through to the generic "I can only give short general answers" text.
6. **One engine, two surfaces.** The dialog and the chat share the same hook (`useStanleyAsk`) and, after Phase 1, the same reply renderer, so they cannot drift apart.
7. **Private.** Only counts are kept, on the device (the `stanleyTiers` pattern). Question text is never stored by the engine and never sent anywhere for this feature.
8. **English only** for now (CLAUDE.md). Guest-facing wording lives in a locale file, not in code, and never says "AI" (owner decision 2026-11-10; the existing `mentionsAI` test covers new strings).

---

## 2. What exists today (checked against the code, 2026-11-17)

**The order a question takes** (`useStanleyAsk.ts`, `decideStanley`, `Stanley.cs`):

1. Device: away from the ship, answered on the phone (`awayTopic`, `awayAnswer`).
2. Device: `decideStanley` = emergency screen, muster, the authored **library** (`stanleyLibrary`, about 130 entries, matched by `matchQuestion`: bag of words, plural stripping, at least two shared words, 0.6 score and 0.6 cover), then **ship facts** (`shipFactFor`: two keywords).
3. Server (`StanleyService.AskAsync`): word filter, handoff screen, muster, which-trip question, never-do refusals, typed **action** previews (nine kinds, regex `StanleyIntents.Parse`), **money** card, **resolver** cards (bill, plan, next, what changed), entry/visa refusal, router (`StanleyRouter`: trip, before or open), the tool route and model if available, otherwise the **scripted** fallback.
4. Device: `answerActions` adds up to three pills (Show me, Open <citation>, Ask the group) **only from `link` or `citations`**.

**What the research found** (these set the plan's priorities):

| # | Finding | Consequence |
|---|---|---|
| F1 | **The Stanley chat thread drops everything but plain text.** `StanleyItems` in `ChatConversations.tsx` renders a device answer as `<p>{item.text}</p>`. Cards, pills, action previews (the Confirm card), follow-up chips, the handoff card and any answer with empty text (resolver cards, refusals) are not shown there at all (`threadItems` filters empty text). Only `StanleyDialog.tsx` renders them. | Phase 1 must extract one shared reply renderer and use it in both. Without this, no pill could appear in the chat. |
| F2 | Pills depend on what an answer happened to carry. Free-text answers from the scripted fallback or the open model carry no `link` or `citations`, so they get none. | The engine must derive pills from the **question**, not only from the answer. |
| F3 | The server's no-model fallback (`StanleyRules.Scripted`) is six regexes with Caribbean text hard-coded (Cozumel, Belize, Roatan). It is wrong for any other itinerary. The final fallback is "I can only give short general answers right now". | Replace with the engine's reply on the device (Phase 1) and remove the hard-coded text (Phase 6). |
| F4 | The library matcher has no typo tolerance, no synonyms beyond a per-entry `words` string, no notion of what the guest wants to *do*, and needs two shared words. "wheres the spa" or "book massage" miss. | Phase 1 engine. |
| F5 | The app already holds the entities a guest names: `DIRECTORY` (venues), `EXCURSIONS`, `PORTS`, `EVENTS`, `ITEMS` (services, spa) in `src/domain`, already indexed by `searchIndex.ts`. | Phase 2 entity recognition costs no new data. |
| F6 | `src/routes/screenWords.ts` already maps every screen to plain phrases, and `SCREEN_LIST` has 258 screens with titles and subtext. | The topic table is checked against these, so no screen is orphaned. |
| F7 | Several explorers read search parameters already (`?reserve=`, `?book=`, `?treatment=`, `?view=trip`, `?sailing=`, `?view=calendar`), most do not take a search or filter. | Phase 2 adds a small, uniform set (`?q=`, and per-explorer filters) so a pill can arrive pre-filtered. |
| F8 | Away mode has its own tiny topic matcher (`awayTopic`) and the library its own. | Phase 5 folds both into the engine so there is one vocabulary. |
| F9 | `enLate.ts` is a large file that is often edited by hand. | New strings go in a new locale file (`enAnswers.ts`) so this work does not collide with it. |

---

## 3. Where it lives (a change of mind from the earlier discussion)

I first suggested a server module. After reading the code I recommend the **device**, as plain TypeScript under `src/ai/understand/`:

- The things pills point at (the 258 screens, `routeForPath`, the stage tabs, the explorers' parameters) are **client knowledge**. A server table would duplicate every path in C# and drift (the server already hard-codes `/me/bill`, `/ship/muster` and friends).
- The catalogue data the engine needs for entities already sits in `src/domain`. The library, ship facts and away mode are already device-side for the same reason: free, instant, offline.
- It is testable in node with no server, which is how the project tests logic.
- It still respects "thin client": the engine holds **no guest data and no store of its own**; it reads the screens' own catalogue and the context the hook already passes (stage, booking, screen). Personal answers stay on the server.
- It bundles as a **separate lazy chunk** (loaded with the Stanley text, like `enLate`), target under 60 KB gzipped, so the main script does not grow.

The server changes only in Phase 6 (remove the hard-coded Caribbean fallback and say "not answered" cleanly so the device can fill in).

---

## 4. Architecture

```
question
  │
  ├─ (unchanged) away mode ─ safety screen ─ muster ─ authored library (exact / strong) ─ ship fact
  │
  ├─ server (unchanged): refusals, action previews, money and resolver cards, model, scripted
  │
  └─ understand(question, context)            ← NEW, pure, deterministic, ≈ a few ms
        1. normalise   2. correct typos   3. stem   4. phrases   5. concepts
        6. frame (what do they want to DO, about WHAT, with which qualifiers)
        7. entities (Phase 2)      8. context carry-over (Phase 4)
        9. score topics → confidence, margin
       10. applicability filter (stage, booking, aboard)
       11. build reply: direct answer (Phase 3) | pills | "did you mean" | honest miss
```

How its result is used (decided in `useStanleyAsk`, after the existing steps):

| Situation | What the guest gets |
|---|---|
| Server returned a **resolver card, money card, action preview, refusal or handoff** | That reply exactly as today, plus up to two topic pills **after** the answer's own, never for a handoff. |
| Authored library or ship-fact answer | Same, plus topic pills (the entry's own `link` and `related` first). |
| Server returned a model or scripted answer | That answer, plus topic pills. |
| Server returned `offtopic`, `unavailable`, or the generic scripted fallback, and the engine is **confident** | The engine's reply instead (a short sentence naming the topic, direct answer when Phase 3 has one, and pills). |
| Same, engine **not confident** | "I am not sure I understood" with up to three "Did you mean" pills, plus Search the app, plus a person (Guest Services). Counted as a miss. |
| Offline or away | Same engine, since it needs no network. |

The engine **never** short-circuits the server for a question about the guest's own trip. Personal words ("my", "mine", "booked", "I have", "our") with a booking route to the server first.

---

## 5. The understanding engine

All of this lives in plain modules under `src/ai/understand/`, each pure and unit tested.

### 5.1 Normalise (`normalise.ts`)

Lower case; strip accents (NFD); curly quotes to straight; expand contractions ("what's" to "what is", "can't" to "cannot", "wanna", "gonna", "gotta", "ain't", "i'd like" to "i would like"); collapse whitespace; drop punctuation except inside numbers and times (`7:30`, `5pm`); spell out digits for ordinals and times; British and American spellings to one form (colour, programme, centre, theatre, favourite); common compounds ("wi-fi", "wifi", "wi fi"; "check-in", "check in", "checkin"; "e-ticket"); text-speak ("pls", "thx", "tix", "u", "r"); emoji and symbols removed; hard length cap (the existing 500 characters, then the first 300 words) so a paste cannot slow it.

### 5.2 Typo tolerance (`spell.ts`)

The vocabulary is every word of the lexicon plus every entity name. For an unknown word of at least four letters:

- candidates within Damerau-Levenshtein distance 1 (length 4 to 6) or 2 (length 7 or more), found with a symmetric-delete index (fast, no scan);
- the first letter must match, or the two letters at the start be swapped (guards "teh", "wehre");
- an **ambiguity guard**: if two candidates tie, leave the word alone;
- never correct to a word in a **risk** vocabulary (medical, emergency) from a different word, so a typo cannot create a safety topic, and never correct a word the safety screen already reads as is;
- never correct a number, a time or a word of three letters or fewer;
- doubled or dropped letters and keyboard-neighbour slips are the common cases and have their own cheap rule before edit distance.

A phonetic fallback (a small Metaphone-style key) catches "resturant", "excurtion", "sudoko" only when edit distance finds nothing.

### 5.3 Stem (`stem.ts`)

A small, deterministic suffix stemmer (plural, -ing, -ed, -er, -est, -ly, -ion, -ment) with an **irregular table** (ate and eaten to eat, went to go, paid to pay, booked and booking to book, drinks and drank to drink, swam and swimming to swim). Both the lexicon and the input are stemmed the same way, so authors write natural words. Not Porter: it is small enough to review and cannot surprise.

### 5.4 Phrases (`phrases.ts`)

Longest match first over multi-word units that mean something other than their parts: "all aboard", "sea day", "room service", "check in", "lost and found", "dress code", "formal night", "drinks package", "specialty dining", "shore excursion", "main dining", "kids club", "turn down", "wake up call", "port day", "gift shop", "future cruise credit", "onboard credit". A phrase becomes one concept token.

### 5.5 The lexicon (`lexicon/*.ts`)

The "very robust and detailed list of nouns and verbs". It is **data**, one concept per line, grouped by domain, each with its synonyms, informal words and known misspellings:

```ts
{ id: 'n.restaurant', pos: 'noun', domain: 'dining', words: ['restaurant', 'eatery', 'place to eat', 'diner', 'dining room', 'grill', 'bistro', 'cafe'] }
{ id: 'v.reserve',    pos: 'verb', act: 'BOOK',   words: ['book', 'reserve', 'secure', 'grab', 'get me', 'sign up', 'put me down', 'schedule', 'arrange', 'organise'] }
```

**Nouns (target 700 to 900 concepts in the full build, 250 in Phase 1),** by domain: dining (meals, restaurants, courses, diets, allergies, drinks, bars, coffee, desserts, kids menu, room service, cover charge, packages), entertainment (shows, theatre, movies, music, comedy, karaoke, trivia, bingo, deck parties, shows' timing and seats), activities (pool, slides, mini golf, sports court, climbing, bike, library, arts and crafts, games, challenges), spa and fitness (massage, facial, treatments, sauna, gym, classes, salon, barber, nails, thermal suite), kids and teens (club, age rules, babysitting, family), shopping (duty free, boutiques, jewellery, logo gifts, pharmacy), places and ship (deck, stairs, lift, midship, forward, aft, atrium, casino, chapel, library, laundry, medical centre, guest services, photo gallery, art auction), the cabin (balcony, steward, towels, bed, safe, mini bar, television, lights, thermostat, noise, laundry), ports and shore (port names, tender, dock, taxi, beach, tour, excursion types, currency, language, weather), travel (flight, airport, taxi, parking, hotel, luggage, passport, visa, ID), money (bill, charge, tip, gratuity, onboard credit, deposit, refund, price, free, included, loyalty), tech (Wi-Fi, app, phone, charger, plug, television, call, text), paperwork (boarding pass, check-in, documents, muster, health form, customs), health and access (seasick, medicine, wheelchair, mobility, hearing, allergy), people (kids, baby, group, friend, family, partner, solo), time (tonight, tomorrow, morning, day names, "next port").

**Verbs and question acts (target 120 canonical acts, 40 in Phase 1),** each with many surface words:

| Act | Examples of surface words and frames |
|---|---|
| `FIND` | where, find, locate, get to, how do I get to, which deck, directions, map |
| `WHEN` | what time, when does, opening hours, schedule, open, close, until, from when |
| `BOOK` | book, reserve, sign up, grab, secure, schedule, I want to, can I get |
| `CHANGE` | change, move, swap, reschedule, modify, edit |
| `CANCEL` | cancel, drop, remove, no longer want, undo |
| `PRICE` | how much, cost, price, charge, fee, expensive, cheap, free, included |
| `ORDER` | order, send up, deliver, bring me, I need more |
| `WHAT_IS` | what is, what are, explain, mean, tell me about |
| `LIST` | what is there to do, options, choices, show me, what's on |
| `RECOMMEND` | best, should I, worth it, favourite, suggest, recommend, good for |
| `ALLOWED` | can I, am I allowed, is it okay, may I, are pets/drones/etc. allowed |
| `REQUIRE` | do I need, bring, wear, dress code, pack, required |
| `COMPARE` | versus, difference, which is better |
| `STATUS` | is it open, is it working, any update, delayed |
| `PROBLEM` | lost, missing, broken, stuck, not working, locked out, complaint |
| `CONTACT` | call, speak to, talk to, reach, phone number |
| `REMIND` | remind me, don't let me forget, alert me |
| `PLAN` | plan, itinerary, what should we do, organise a day |

The **act** is what picks between pills for the same noun. "Spa" with `BOOK` goes to the spa booking page; with `PRICE` to the treatments list; with `WHEN` to opening hours; with `PROBLEM` to Guest Services.

### 5.6 The frame (`frame.ts`)

A question is reduced to a small structure:

```ts
{ acts: ['BOOK'], concepts: ['n.massage', 'n.tomorrow'], entities: [], quals: { when: 'tomorrow', who: 'me', diet: null, budget: null },
  negated: false, personal: false, form: 'imperative' | 'wh' | 'yesno' | 'fragment' }
```

Handled: question words and auxiliaries to find the act; **negation** ("I don't want", "not", "never", "without", "no" before a noun) which flips `BOOK` to `CANCEL` or removes a topic ("dinner without gluten" keeps dinner and adds a diet); time words ("tonight", "tomorrow", "Tuesday", "after dinner", "at 7"); people ("my kids", "we", "my wife", "for two"); budget ("cheap", "free", "under $50"); diets and access needs; the **personal** flag ("my", "mine", "I have booked", "our") which routes to the server first; fragments ("spa", "wifi price", "late checkout?") treated as `WHAT_IS` or `LIST` with that noun.

### 5.7 The topic table (`topics/*.ts`)

A **topic** is something a guest wants help with, with how to recognise it and where to send them. Target 150 topics in the full build, 45 in Phase 1.

```ts
{
  id: 'dining.book',
  evidence: [ { c: 'n.restaurant', w: 3 }, { c: 'n.dinner', w: 3 }, { c: 'n.table', w: 2 }, { c: 'n.reservation', w: 3 }, { c: 'n.eat', w: 1 } ],
  acts: { BOOK: +3, WHEN: +1, FIND: +1, LIST: +1, PROBLEM: -1 },
  stages: { prebook: +1, sea: +1, port: 0, dream: -2 },        // prior, not a rule
  needs: [],                                                   // 'booking' | 'aboard' | 'ashore' | 'adult' ...
  risk: 'low',                                                 // 'high' topics never carry an authored claim, only official pills
  pills: [
    { when: { act: 'BOOK' },  label: 'pill.dining.book', to: '/dining-today?reserve=new', needs: ['booking'] },
    { when: { act: 'LIST' },  label: 'pill.dining.browse', to: '/dining-today' },
    { when: 'any',            label: 'pill.dining.mine',   to: '/dining-today?view=trip', needs: ['booking'] },
  ],
  fallbackPills: ['pill.dining.browse'],
  related: ['dining.package', 'dining.diet'],
}
```

Phase 1 topics (the explorers first, then the journey): **Explorers:** dining (find, book, change, menu, diet and allergy, package, cover charge, room service, bars and drinks), shows and entertainment (what is on, book, times), activities (what is there to do, sports, kids, quiet), spa and wellness (treatments, book, prices), exercise and fitness (classes, gym), shops and shopping, excursions and tours (browse, by port, book, my tours, accessible, with kids), games (puzzles and challenges), ship and deck map, ports and countries, cabins and ships. **Journey:** check-in, boarding pass, embarkation, muster, documents and passport, disembarkation and bags, customs, plan the day, my reminders, the bill and charges, Wi-Fi and phone, laundry, medical and accessibility, lost item, Guest Services, chat and friends, group plans and polls, settings and notifications, sailings and booking, cabins choice, saved sailings, loyalty.

### 5.8 Scoring (`score.ts`)

For each topic: the sum of its matched **evidence weights** (each concept counted once, weighted by inverse frequency across topics so a rare, specific noun outweighs a common one), plus **act agreement** (the act's bonus or penalty), plus a **stage and screen prior** (small: the guest being on the dining screen nudges dining, never decides), plus a **co-occurrence bonus** for pairs that are strong together ("book" + "table"), minus a **conflict penalty** (a concept that belongs to a different topic's exclusive group). The score is normalised to 0 to 1 against the topic's own maximum, so topics with long evidence lists are not favoured.

Decision thresholds (constants in one file, covered by tests, tuned against the corpus):

- **confident**: top score at least `T_HIGH` and a **margin** over the second of at least `M`;
- **ambiguous**: top at least `T_LOW` but margin below `M`: show the two as "Did you mean";
- **miss**: below `T_LOW`.

Ties are broken in a fixed order (risk-lower first, then stage fit, then topic id), so results never flicker.

### 5.9 Applicability (`applies.ts`)

A pill is dropped, or swapped for its fallback, when it does not make sense now: it needs a booking and there is none ("Open my reservations" becomes "Find a cruise"), needs the guest to be aboard, ashore or past a date, or the stage tab list does not include the screen (the existing `stageNav` and `stageHome` functions say which screens are reachable at which stage). Supervised child accounts get none of the topic pills for adult-only screens (the existing account rules decide).

### 5.10 Pills (`pills.ts`)

- Labels are generic and short, from the locale file: "Open dining", "See tours in {port}", "Book a treatment", "Plan my evening", "Open the bill", "Search for {words}".
- Every pill path is checked against `routeForPath`; a path that does not resolve is dropped at runtime and fails a test at build time.
- Dedupe by destination path, order: the answer's own links, then the act-specific pill, then the topic's general pill. **At most three** in total. A short, labelled group (`aria-label`), real links (`LinkButton`), so keyboard and screen readers work as for the existing pills.

### 5.11 Risk handling

Topics flagged `risk: 'high'` (medical, health, visas and entry rules, customs, safety, money disputes, legal) never get an authored claim from the engine. They give only the official pill (Medical Centre, Customs, Guest Services, Privacy) and the existing library entries and handoffs remain the only authored words, as today (`governance.ts` is respected: `mentionsRiskTopic`, `riskOf`).

---

## 6. Phase 3: direct answers with no model

Once entities exist (Phase 2), a question with an **entity** and an **attribute** is answered by a template from the data, with a source line ("From the ship guide"):

| Attribute | Answered from | Example |
|---|---|---|
| hours | venue opening times | "The Horizon Court is open 6:00 am to 11:00 pm. Open it for the menu." |
| where | place deck and section | "The Atrium is on Deck 5, midship." |
| price or cover charge | venue `price`, catalogue item price | "The Crown Grill has a cover charge of $39. It is also on Dining." |
| what is it | blurb | one authored sentence |
| duration, age, fitness (tours) | excursion record | "About 4 hours, ages 6 and over, easy walking." |
| what is on (day) | `EVENTS` for the ship day | the next three events with times |
| dress code, diets | venue tags | the tag and the venue |

Rules: only data that is **authored or served**, never inferred; a missing attribute is a pill, not a guess; times are shown on the **ship clock** using the existing helpers; anything that depends on the guest (their booking, their bill, whether a table is free) goes to the server or to the screen. Each answer is a `StanleyCard` with provenance chips, as the server's cards already are, so the dialog and chat render it the same way.

---

## 7. Phase 4: context and clarification

- **Carry-over.** The last topic and entity are kept in the in-memory thread state for the next two turns, so "and how much?", "what about Belize?", "is it open tomorrow?", "book it" and "the first one" resolve. It resets on a stage change, after ten minutes, or when the guest changes subject by a confident new topic. Never stored.
- **Clarification.** An ambiguous result asks one short question with up to three pills ("Do you mean dining, or the room service menu?"). Answers by tapping a pill, or typing "the first one", "yes", "no".
- **Honest miss.** One sentence, then three fixed pills: **Search the app for "{words}"** (the existing global search with the question prefilled), **Browse by stage** (the stage's home tab), **Talk to a person**. The miss is counted (no text).

---

## 8. Robustness: how we know it works

**The corpus** (`src/ai/understand/corpus/`): a JSON file per topic group with, for every topic, at least **8 natural paraphrases**, **3 typo variants**, **3 slang or fragment forms**, and **4 near-miss negatives** (looks like the topic, is not). Written to be read: "where can i get a massage", "wheres the spa", "any good places to eat tonight", "tomorrow's tours in cozumel".

**Held-out set.** A second file written *separately from the lexicon* (never used to tune it) holds 20 percent more phrasings. Tuning against the corpus is allowed; the held-out set is the honest measure.

**Gates, enforced by `vitest` so a change that regresses fails the build:**

| Gate | Threshold |
|---|---|
| Top-1 topic accuracy, corpus | 95 percent or more |
| Top-1 topic accuracy, held-out | 85 percent or more |
| Top-1 under automatic typo injection (seeded: swap, drop, double, neighbour key) | 85 percent or more |
| Pills shown on a **neutral and off-topic set** (greetings, jokes, "what is two plus two", gibberish) | 2 percent or less, and zero on gibberish |
| Pills on every question in `cases.json` tagged `must-handoff`, `injection`, `permission` | **zero** |
| Every existing `cases.json` and library decision | **unchanged** (the engine only adds) |
| Every pill path | resolves with `routeForPath`; label key exists; no "AI" wording |
| Every topic | at least 8 corpus phrases; at least one applicable pill at every stage it is meant for |
| Every screen in `SCREEN_LIST` | reachable by at least one topic's pill, or on an explicit `notReachableByQuestion` list with a reason |
| `screenWords` phrases | each phrase for a screen resolves to a topic that offers that screen |
| Determinism and purity | same input, same output; input never mutated |
| Fuzz | random Unicode, emoji, 100,000 characters, null bytes, prompt-injection strings, right-to-left text: never throws, finishes under a time budget, returns at most three pills |
| Speed | median under 5 ms and worst case under 50 ms on the full lexicon, measured in the test with a generous ceiling |
| Lexicon lint | no word maps to two concepts of the same part of speech; no stop word used as evidence; every concept used by at least one topic; typo-index collision report is empty or listed |

A **golden file** of about 150 "question to topic and pills" lines is committed; a change to it shows in review as a plain diff, as the server's rule-card goldens do.

**Bundle and performance.** The engine and data are a separate chunk; `npm run build` output is compared against a size budget in a test.

---

## 9. Surfaces and accessibility

- **One renderer.** `StanleyReply` (a shared component) draws everything a reply can carry: text or card, source line, pills, action preview, follow-up chips, handoff card, read aloud. The dialog and the chat both use it. In the chat, answers with empty text (cards, refusals) are no longer dropped.
- **Pills** are real links inside a labelled group, reachable by keyboard in reading order after the answer, with the existing focus ring and contrast of `LinkButton` secondary; they do not take focus or move it when a reply arrives (the log is a polite live region, as now). Tapping one in the dialog closes the dialog first, as the current pills do; in the chat it navigates.
- **Reduced motion**: nothing here animates.
- **Wording**: short, generic, sentence case, verbs first ("Open dining", "See tours"). No guest names or trip details appear in a label.

---

## 10. Privacy and learning

- Counted on the device only (extending `stanleyTiers`): per topic id, per outcome (`confident`, `ambiguous`, `miss`), per pill kind shown and tapped. **No question text.**
- Tuning comes from the corpus and, at the owner's choice, a guest-initiated **Copy unanswered questions** button in Diagnostics settings (opt-in, device only, the guest sends it themselves or not). This is an open decision (section 12), not part of Phase 1.

---

## 11. Phases

Each phase ends with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` passing, one commit, and a stop so the owner can `/clear`.

**Three surfaces, one engine.** (1) The Ask Stanley dialog and (2) the Stanley chat share `useStanleyAsk`. (3) `@Stanley` in a normal group chat is answered by the server (`ChatAskStanleyService`) as one plain message everyone sees, built from the same scripted fallback or the model, with no pills. Because every member's booking and stage differ, pills for it are made **on each viewer's device**: when a group thread shows a Stanley answer, the client reads the asker's `@Stanley` message just before it, runs the engine, and shows pills for that viewer. The group's shared text is not replaced on the device; Phase 6 changes what the server posts when it cannot answer (no hard-coded Caribbean text, a neutral line that points at the pills). Never in a conversation with a supervised child, where Stanley is off.

### Phase 1: one reply renderer, the engine core and pills for the explorers and top journey topics
1. **Shared renderer.** Extract the dialog's reply drawing into `StanleyReply`; use it in `StanleyDialog` and in the chat's `StanleyItems`; extend the chat's `DeviceTurn` so it carries cards, pills, actions, follow-up chips and handoff; stop `threadItems` dropping answers that have a card but no text. Tests for `threadItems`.
2. **Engine core**: `normalise`, `spell`, `stem`, `phrases`, `frame`, `score`, `applies`, `pills`, `understand` (the entry point). Lexicon v1 (about 250 concepts, 40 acts) and topic table v1 (about 45 topics) as above.
3. **Wiring** in `useStanleyAsk`: run `understand` after the existing steps; merge pills (cap three); replace `offtopic`, `unavailable` and the generic scripted fallback with the engine's reply when confident, or the honest miss with search and person pills; never for a handoff or refusal; personal questions still go to the server first.
4. **Strings** in `src/i18n/locales/enAnswers.ts` (merged into `en.ts`, `index.ts`'s late loader and `testing/setup.ts`), so `enLate.ts` is untouched.
5. **Corpus v1**, held-out set v1, golden file, lint and every gate in section 8 that applies to the topics built.
6. **Diagnostics counters** for outcomes and pills.

Exit: asking in either surface "where can I book a massage", "wheres the spa", "any tours in cozumel", "i lost my boarding pass", "wifi" gives a sensible reply and one to three working pills; a misspelt or slangy version gives the same; gibberish gives the honest miss; the chat shows cards and pills like the dialog.

### Phase 2: entities and deep links, and pills for group `@Stanley` answers

> **Built 2026-11-17.** **Done:** `src/ai/understand/entities.ts` indexes venues, shows, tours, ports, countries, spa and shop services and ship places from `src/domain` (rebuilt when the catalogue's size changes, since ports arrive from the server); a name matches whole, or by one word found nowhere else, with one or two slips allowed in long words; ordinary lexicon words ("grill", "dinner") never identify a place. `understand` returns `entities` and puts their pills first ("See the Crown Grill", "About Cozumel", "Tours in Cozumel" opening that cruise day's tours through `portDays`); a question that is only a name is understood and answered with the thing itself ("Here is ..."). **Group `@Stanley`:** `askBefore` (domain) finds the asker's message within five messages; `GroupStanleyPills` makes the pills on each viewer's device and never replaces the shared text. **Deep links:** `?q=` and `?type=` (`domain/explorer/urlFilter.ts`) start the filters of the venue Explorers (dining takes `q` as its dish search) and `?type=` an interest on the tours list. **Follow-up the same day:** ships are entities (`/home/ships/:id`) and the tours list has a search box that `?q=` starts. **Not done / decisions:** no `port` parameter (tours already open on the port's day through `?day=`); `diet` and `age` filters move to Phase 5 (they need new controls, and diets touch the allergy safety side); `?q=` and `?type=` are start values only, the guest can change or clear them.
Group `@Stanley` answers get the same pills, made on the viewer's device from the asker's message (see the three surfaces in section 11).

Entity recognition over the catalogue (venues, shows, excursions, ports, countries, spa items, ship places, ships) with aliases and fuzzy matching, built from `src/domain` at first use. Explorers accept a uniform `?q=` plus their own filters (`port`, `type`, `diet`, `day`, `age`), so "tours in Cozumel", "vegetarian places" and "the Crown Grill" arrive filtered or on the venue page. Pill labels name the entity ("See the Crown Grill", "Tours in Cozumel"). Tests that every entity alias resolves to a real route.

### Phase 3: direct answers (section 6)
Attribute questions answered from data as cards with provenance; the answer-or-pill rule; ship-clock times; tests per attribute and per missing-data case.

### Phase 3b: short live ship answers, long ones by pill
The engine names a live topic (next port, all-aboard time, today's weather at the next port, what is on in the next hour, sea state). A server resolver, in the style of `StanleyResolvers`, reads the live facts the backend already holds (ship telemetry, weather and the day's program are mocked behind interfaces, so a real provider needs no front-end change) and returns a card with its source and the time it was read. **Short** (about three lines, all facts fresh) is shown in the reply; **long**, stale or missing becomes one plain sentence plus the pill to the full screen (Today, Weather, Port, Itinerary). The front end does not know whether a source is simulated. A stale or unreadable source abstains, as the existing cards do. No model is involved.

### Phase 4: context and clarification (section 7)
Carry-over, "Did you mean", the honest miss reply, follow-up resolution; tests of multi-turn scripts.

### Phase 5: coverage and unification
Grow the lexicon to about 800 nouns and 120 acts and the topic table to about 150 topics until **every screen is reachable**; fold `matchQuestion` and `awayTopic` into the engine so there is one vocabulary (the authored library entries become topic answers); stage-specific depth (what a guest asks in each of the eleven stages).

### Phase 6: server alignment
When to use a model: the order is safety, authored library, resolvers over the guest's account, then the engine, and a model last, only for open-ended or reasoning questions the engine is not confident about (planning, judging between options, advice that combines facts). Pointer and lookup questions (where, when, how much, how do I, what does X mean) never need one. The device sends the engine's outcome and topic as a hint so the server can skip the model for a confident pointer topic; the server still enforces the daily ceiling, per-turn call limits and switches, and a hint can never raise a cap or turn on a model that is switched off.

Remove the hard-coded Caribbean text from `StanleyRules.Scripted`; make "not answered" an explicit server reply the device fills in; keep every existing server test passing (written, not run here; the owner runs targeted tests). Update the shared eval cases so the server and browser agree.

### Phase 7: the learning loop
Optional opt-in export of unanswered questions; a script (run as a test helper) that reads an export and prints top misses and near-collisions; a short authoring guide for adding a noun, a verb or a topic.

---

## 12. Risks and open decisions

| Risk | Mitigation |
|---|---|
| A confident wrong topic (pill to the wrong screen) | Margin rule, held-out gate, near-miss negatives in the corpus, at most three pills, "Did you mean" for ambiguity |
| A typo "corrected" into the wrong word | Ambiguity guard, first-letter anchor, never correct short words, never into a risk word, typo-injection gate |
| Engine shadows a better answer | It only adds, except where the server said it could not answer; every `cases.json` decision is asserted unchanged |
| Safety regression | Runs after the screen; zero pills on handoff, injection and permission cases; risk topics carry no authored claim |
| Dead or irrelevant pills | `routeForPath` check at build and runtime; applicability by stage, booking and where the guest is |
| Lexicon rot as screens change | Reachability test over `SCREEN_LIST` and `screenWords` fails when a screen is added without a topic |
| Slow or large | Lazy chunk, symmetric-delete index, size and time budgets in tests |
| Wrong for a child account | Supervised accounts follow the existing account rules; adult-only screens are not offered |

**Open decisions (my recommendation first):**
1. Engine on the **device** (recommended) rather than the server.
2. At most **three** pills per reply (recommended).
3. Counts only, no question text kept, in Phases 1 to 6 (recommended); opt-in "Copy unanswered questions" in Phase 7.
4. Remove the server's hard-coded Caribbean fallback text in Phase 6 (recommended).
5. Where a model **is** set up, keep it answering as today and add pills (recommended), rather than skipping it when the engine is confident, so personal and open questions keep their quality.
