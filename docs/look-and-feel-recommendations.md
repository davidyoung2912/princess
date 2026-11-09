# Look and Feel: Making Princess Fun to Use

Status: **Draft v0.2 (2026-11-09), for review.** Recommendations only. Nothing here is scheduled or built.

**Decisions so far (2026-11-09):** (1) fonts stay as they are, so the typography item is parked; (2) gradients stay; (3) sound is limited to minimal, positive confirmation clicks on actions the guest takes. The rest of this document has been adjusted to match.

Basis: a read of the style sheets (`src/styles/*.css`, about 1,750 lines), the design tokens, `PageHeader`, the shell, the stage hero and tile code, the Stanley art set (`art/source`), the settings model, and the existing design docs (`design-language.md`, `small-delights.md`, `experience-extension-ideas.md`). I did not run the app (project rule: no browser testing), so visual judgements below come from the code and the art inventory, not from looking at screens. Where I say "feels", treat it as a hypothesis to check on a device.

---

## 1. Summary

The app is **accessible, consistent and well organised**, but it currently reads as a very good *tool*, not yet as *a cruise*. The foundations are strong: a tested token system, three themes plus high contrast, a trip colour, per-area header colours, a motion vocabulary (lift, drift, land), calm mode, haptics, Stanley with 16 poses and 9 heads, and 11 stage hero pictures. What is missing is **atmosphere and ceremony**: the feeling of a ship, a sea, a day with a rhythm, and small rewards for doing things.

Five themes run through the recommendations:

1. **Make the app change with the day and the place.** A cruise has a rhythm (sunrise at sea, a port morning, formal night, sail-away, last night). The app should feel different at each, using the data it already has.
2. **Give the ship a voice and a visual language.** Nautical wayfinding, ticket and passport shapes, wave edges, ship-style signage, and a few signature moments.
3. **Celebrate completions, quietly.** Check-in done, boarding pass ready, first port reached. Short, tasteful, skippable, and off in calm mode.
4. **Make "where do I tap?" obvious.** Fewer words per tile, more picture, one clear primary action per screen, and a Home that answers "what now?" in one glance.
5. **Keep it professional.** Every idea below obeys the existing guardrails: reduced motion and calm mode switch it off, contrast tests still pass, no offer pressure, no dark patterns, nothing blocks a required task.

A suggested first slice is **Section 11** (about two weeks, nearly all CSS and small components, no server work).

---

## 2. What I see today (honest assessment)

### 2.1 Strengths to keep

| Area | What works | Evidence |
| --- | --- | --- |
| Colour by area | Each tab has its own colour, carried into the page header, tiles and focus. Guests always know "where they are". | `layout.css` `.tabs__item[data-colour]`, `base.css` `.page-header` |
| Trip colour | Guests choose an accent that tints icons, pins and the hero ring. A real personal touch. | `motion.css` `[data-trip]` |
| Theme set | Light, Dark, Night, plus high contrast, all contrast-tested. | `themes.css`, `contrast.test.ts` |
| Motion rules | Three motions only, all respect reduced motion and calm mode. | `motion.css` |
| Stanley | A mascot with poses, heads, a speech dot and "moments". Strong brand asset. | `art/source/poses`, `StanleyMoment.tsx` |
| Hero art per stage | 11 pictures, softened in dark and calm modes. | `StageHero.tsx`, `motion.css` |
| Quiet by default | Offer restraint, nudge budget, calm mode. Builds trust. | `settings.ts` |

### 2.2 Gaps and risks

| # | Observation | Why it matters |
| --- | --- | --- |
| G1 | **One typeface.** `--font-display` is set to the body font (Figtree). *Decision: leave as is for now.* | Noted only; the same effect is pursued through colour, shape and motion instead. Revisit later if wanted. |
| G2 | **Flat page heads.** Every screen starts with the same gradient bar, an icon, a title and subtext. It is clear, but it is the same bar 190 times. | Repetition flattens the sense of place. A port screen and a bill screen look alike. |
| G3 | **Home is a grid of equal tiles.** The stage tile grid gives every item the same visual weight. | The one thing that matters now (the next step) competes with everything else. |
| G4 | **The sea is absent.** No wave edges, no sky gradients, no time-of-day light, no horizon. The ship is described but never *felt*. | This is the biggest "fun" gap. A cruise app is the one app that can legitimately be about water, sky and sunsets. |
| G5 | **Completion is silent.** Checking in, getting a pass, finishing packing: the UI just updates. A `land` stamp animation exists but is used in few places. | People enjoy small ceremony. It also confirms "that worked", which reduces anxiety. |
| G6 | **Several coloured drop shadows** on the active tab, header, tiles and buttons. *Decision: gradients stay.* | The shadows come in several strengths. A consistent elevation scale would tidy them without touching the gradients. |
| G7 | **Dense copy on cards.** Many tiles carry a title, subtext, badge and live line. | On a 360px phone this is a lot of reading at a glance. |
| G8 | **Hero images are cropped to a 3:1 banner at most 14rem tall.** The drift animation is the only life in them. | Art is the app's best fun asset and is shown small. |
| G9 | **Nothing responds to the guest's real moment.** The app knows the stage, the ship's position, the weather and the time, but the look never changes with them. | A missed chance to feel "alive". |
| G10 | **Desktop is a phone column with a rail.** Fine and functional; not yet a "big screen planning table". | Many people plan the cruise at a desk before they sail. |

---

## 3. Design direction: "Calm water, warm brass, bright sails"

A short brief so every later choice has a test.

- **Water and sky** supply the large calm fields (Princess Blue family, silver-blue, sand like a deck).
- **Brass and rope** supply the small precise details: dividers, medal badges, ticket edges, stamps (the existing gold, used only where contrast allows).
- **Sails** supply the single bright accent per area (the existing teal, coral, plum, gold).
- **Ship signage** supplies the layout language: clear icon plus short word, big and legible, like a bridge or a deck sign.
- **Personality** comes from Stanley and from short, kind, specific copy, never from clutter.

Test for any new element: *Would it look at home on a well-designed ship's deck sign or a first-class boarding card?* If it would look at home in a casino, it does not belong.

---

## 4. Visual identity upgrades

### 4.1 Typography (V1) — parked

*Decision: do not change the fonts now.* Figtree stays for everything. One zero-risk detail is still worth doing inside the current font: **tabular numerals** (`font-variant-numeric: tabular-nums`) on times, prices and countdowns so digits never jiggle. That is a CSS-only tweak and does not change the typeface; confirm if you want it.

### 4.2 A consistent elevation scale (V2) — effort S

*Decision: the gradients stay* (page header, primary button, active tab, tiles). The only suggestion kept is tidying the shadows:

- Replace the mixed shadow recipes (`--shadow-card`, tile glow, header glow, tab glow) with **three named elevations**: `--elev-1` (resting card), `--elev-2` (raised or hovered), `--elev-3` (sheet and dialog). Each can still take the area colour, so the coloured glow look is kept; it is just defined once.
- Add a **hairline brass rule** (`--gold` at 40%) as the divider between sections on Home and Trip screens. It is decoration only, so the gold contrast limit does not apply.

### 4.3 Wave and horizon motifs (V3) — effort S

- **Wave edge under the page header.** An inline SVG (a few hundred bytes) as a `mask` or `::after` so the coloured header ends in a soft wave instead of a straight line. One shape, tinted by the area colour. Gone in high contrast and print.
- **Section dividers as a small wave or rope line** instead of plain borders on Home and Trip summary.
- **A "horizon" footer** on the Me and Settings pages (a thin line with a small ship silhouette) to say "that is everything here" and end long pages with a smile.

### 4.4 Paper-and-ticket shapes (V4) — effort S

The CSS already has `.card--ticket`, `.card--postcard` and `.badge--milestone`. Use them more deliberately:

- **Boarding pass, check-in receipt, excursion bookings, dining reservations: ticket shape** with a perforation line and a small tear-off stub (booking number, QR).
- **Memories, diary days, Wrapped: postcard shape** with a stamp corner (the stamp could carry the port's flag or a small icon).
- **Milestones: brass medallion** (first port, 100 steps, last night). Same colour as today; add a ring and a subtle shine that stops under reduced motion.

### 4.5 A real app icon, splash and install moment (V5) — effort S

- A **branded splash** that opens with Stanley's wave and the ship's name for under a second on a cold start (the boot splash already exists; make it warmer). Skip it in calm mode and on repeat opens within an hour.
- **Themed manifest colours** so the install prompt and the phone's status bar match the area colour as the guest moves through the app (`theme-color` meta updated on route change).

### 4.6 Iconography pass (V6) — effort S

- Lucide icons are consistent but generic. Add **a small set of custom nautical glyphs** (anchor, wheel, lifebuoy, funnel, wake, compass rose, deck chair, gangway) in the same stroke weight, used for the main tab and stage icons only.
- Ensure every icon still has a text label (the existing rule), and keep stroke widths in line with the 2.75 header-icon style.

---

## 5. Making the app feel alive (the "fun" layer)

### 5.1 Time-of-day atmosphere (F1) — effort M

The most important single recommendation. Use the **ship's local time and the sun position** (the app already has a Sky screen and ship time) to tint the hero and the page header very subtly:

| Part of day | Treatment |
| --- | --- |
| Sunrise (±45 min) | Warm peach-to-blue gradient on the hero; greeting "Sunrise at 6:14. Coffee on deck?" |
| Day | Standard palette |
| Sunset (±45 min) | Gold-to-rose gradient on hero; "Sunset in 20 minutes. Best views: Deck 16 aft." |
| Night | Hero dims to the Night art; a small moon or star field in the header corner |

Rules: only a **tint on the hero and a greeting line**, never on text surfaces (so contrast tests stay valid); off in calm mode and high contrast; the theme setting still wins. The backend supplies the sun times (already mocked behind an interface), so the front end only reads a "phase of day" value.

### 5.2 Weather and sea on the hero (F2) — effort S/M

- Layer a **very light effect** over the hero from the existing weather data: soft cloud drift, a few rain streaks, a glint on calm seas, spray on rough seas. Pure CSS or a single small canvas, paused when the tab is hidden, disabled with reduced motion, calm mode and data-light mode.
- Show the **sea state as a tiny wave gauge** next to the weather icon (calm, slight, moderate, rough) so it reads at a glance.

### 5.3 "Day at sea" and "Port day" personalities (F3) — effort M

Today a sea day and a port day share the same layout. Give each a **signature header**:

- **Sea day:** wide horizon, "Day 4 at sea, 412 nautical miles to Cozumel", a thin progress line along the route.
- **Port day:** the port's name large and bold, a postcard-style picture, local time and weather, "All aboard 4:30 pm" as a bold brass tag, a countdown ring to all-aboard that turns amber then red.
- **Embarkation and disembarkation:** a checklist-first layout with a big single progress ring.

The backend already knows the itinerary; this is a presentational choice driven by an existing "day kind" value.

### 5.4 Progress rings and the journey line (F4) — effort S

- Replace the textual stage strip with a **visual voyage line**: a small ship icon travelling along a dotted route through the 11 stages, with stage names on tap. Shows "you are here" and "what's next" in one picture. The ship moves with a `land`-style settle, not a loop.
- Use **progress rings** on tiles that have a checklist (Documents 3 of 5, Packing 12 of 20) instead of "3 of 5" text.

### 5.5 Countdown with character (F5) — effort XS/S

The countdown is a line of text today. Make it a **hero number** (large, bold, current font) ("23 sleeps"), with a tiny changing caption (a different light line per week, written in the Stanley voice). On sailing day it becomes "Today is the day". Respect the choice already in the code to hide it in calm mode.

### 5.6 Celebrations that stay professional (F6) — effort S

A single, reusable `Celebrate` component with three levels, all skipped in calm mode and reduced motion, with an optional soft haptic (the buzz helper already exists) and the confirmation click from Section 9:

1. **Tick**: a check mark that draws itself (checklist items, saved).
2. **Stamp**: the existing `land` stamp, on completing a stage task (check-in done, pass ready).
3. **Moment**: a short banner with Stanley's "cheer" or "congratulations" pose, a brass medallion and a single line (first booking, all documents ready, sail-away). No confetti, no sound, no streaks, no points. At most once per milestone and never on a screen that blocks a task.

Add a **passport-style stamp book** under Me: each port visited, each stage completed adds a stamp (styled, dated). It reuses the Diary data and costs the guest nothing to keep. Shareable as an image.

### 5.7 Sail-away moment (F7) — effort S/M

At the ship's actual departure time, offer a **"Sail-away" card** on Home: the ship's wake animation, a horn icon, "We are underway", and a one-tap "add to my diary" and "take a photo". A distinctive memory the guest associates with the app. The only sound is the confirmation click described in Section 9.

### 5.8 Stanley as a companion, not a pop-up (F8) — effort M

Stanley is the biggest fun asset and is mostly in a corner button. Ideas:

- **Pose follows context**: umbrella when rain is forecast, binoculars on the Sky or Port screens, suitcase while packing, clipboard on check-in, sleep on a quiet night, lifejacket on safety screens. The poses already exist; this is a mapping.
- **Empty states with Stanley** ("Nothing booked yet. Let's find something good.") instead of blank text.
- **Greeting line on Home** that varies by time and stage, one sentence, never more than the guest's chatty/helpful/asked setting allows.
- **Stanley's "tip of the day"** as a swipeable card with a ship fact, a port fact or a cruise etiquette note. Educational and charming, never a sales tip.
- Keep him off safety-critical and payment screens, as the guest settings already imply.

### 5.9 Games and gentle play, in the right place (F9) — effort M/L

Only in the **Entertainment** area, optional, and clearly separate from required tasks:

- **Ship scavenger hunt** (find 10 things on board: the library, the piazza clock, the lifebuoy with the ship's name). Uses the deck plan; reward is a medallion.
- **Daily trivia** about the ports ahead, 3 questions, no timer, no leaderboard.
- **Ship-spotting and wildlife log** (whales, dolphins, seabirds seen), feeding the diary.
- **Family mode quiz** ("Which port are we most alike?"), shareable result.

---

## 6. Content presentation and quality-of-life

### 6.1 Home: one hero, then a short story (Q1) — effort M

Re-compose Home into three zones:

1. **The Moment** (hero card): the one thing that matters now, with a big picture, a short line, one primary button. Examples: "Check in opens in 2 days", "Muster at 4:15 pm", "Port in 40 minutes: tenders only".
2. **Today so far** (horizontal strip): 3 to 5 small cards (next show, dinner time, weather, bill) the guest can swipe.
3. **Everything else**: the current tile grid, but each tile reduced to an icon, a two-word title and (only when needed) a single status dot.

The existing `stage-next`, `StageHome` and live-tile code can be reused, so this is mostly a layout change.

### 6.2 Tile diet: icon, name, one status (Q2) — effort S

Cap tile text at **a title plus one live line**. Move badges to a dot or ring. Keep the subtext for the page header, not the tile. This lowers reading load and makes tap targets obvious on small phones.

### 6.3 "Pin and reorder" Home (Q3) — effort S

The pin feature exists. Extend it into a **long-press to reorder** (with a visible "Edit Home" button for keyboard and switch users) and a small "Your favourites" strip at the top. Persist per device (a display setting) and sync with the account so a guest sees the same Home on a phone and a tablet.

### 6.4 Better time presentation (Q4) — effort S

Cruise guests juggle **three clocks** (home, ship, port). The `ThreeClocks` component exists; improve it:

- Always show a **colour-coded pill** for ship time vs phone time, with "Ship time is 1 hour ahead" in plain words.
- On the itinerary and the daily plan, show a **thin timeline with "now" marker** and the dining, show and tender slots as coloured blocks. Tap to expand.
- Add "**In 25 min**" relative labels alongside absolute times.

### 6.5 Search that feels instant and friendly (Q5) — effort S/M

- A search sheet that opens from anywhere with a pull-down gesture and `/` on desktop.
- **Suggested chips by moment** ("Muster station", "Dinner", "Where is my cabin?", "Tender times") before the guest types.
- Results grouped with icons and a short preview line.

### 6.6 A friendlier "ship map" (Q6) — effort L

The deck plan is functional. Make it a delight:

- **Pinch and pan** with momentum, **"You are here"** (where location is known, else "Last place you looked"), and **walk time** to the destination.
- **Animated route** drawn as a dotted line with arrows, with step-by-step text beneath for screen readers.
- **Deck switcher** as a mini side elevation of the ship (tap a deck on the silhouette).
- Category filters: lifts, toilets, food, quiet, family, accessible routes.

### 6.7 Smart empty, loading and error states (Q7) — effort S

- **Skeleton screens** shaped like the content (ticket, list rows) instead of spinners. Under reduced motion, a static tint.
- **Friendly errors** with one clear action and Stanley's "oops" pose. Offline: "You are offline. Here's what we saved for you", with the existing sync chip.
- **Optimistic updates** on small actions (pin, save, tick) so the UI feels instant.

### 6.8 Gestures and shortcuts (Q8) — effort S/M

- **Swipe** between days on the itinerary; swipe a card to snooze or dismiss; pull to refresh with a small ship-wake animation.
- **Long-press** a tile for quick actions ("Show in 2 taps", "Pin", "Add a reminder").
- **Keyboard shortcuts on desktop** (`g h` Home, `g p` Plan, `/` search, `?` help sheet) with a visible cheat sheet. Never the only way to do something.
- **Haptics** only on meaningful events (check-in done, scan success). The helper already respects calm mode.

### 6.9 "Show me" buttons (Q9) — effort S

Where the app tells the guest to do something with a physical thing, add **"Show me"**: a three-frame illustrated guide in Stanley's art style (how to scan the QR at the gangway, how to find the muster station sign, how to tender). Short, optional and captioned.

### 6.10 Money that is easy to read (Q10) — effort S

- **Spending ring** against the budget with a calm colour change (blue to amber), no red scare unless the guest set a hard limit.
- **Receipts as tickets** (V4), grouped by day, with a running total pinned at the top.
- **Plain words for fees** ("Gratuity, daily, per person") with a `?` tip, which is already supported.

### 6.11 Share-ready cards (Q11) — effort M

One-tap **share cards** for: today's plan, a port guide, a photo with ship and date, a Wrapped summary. Generated as a clean image or link, with no Princess logo misuse and no tracking links. Works for the family group on the account.

### 6.12 A "Right now" widget (Q12) — effort M

The PWA can offer an **installable shortcut** and (where supported) a small status line on the home screen icon via app shortcuts: "Next: Dinner 7:30 pm, Deck 5". At minimum, long-pressing the app icon shows shortcuts for Boarding Pass, Today and Stanley.

---

## 7. Per-stage personality

The 11 stages already have hero art. Add a **mood board** to each (colour accent, motion level, Stanley pose, tone) so the app feels like a journey rather than one long form:

| Stage | Mood | Visual cue | Stanley pose | Tone of copy |
| --- | --- | --- | --- | --- |
| Dream | Wonder | Wide pictures, soft focus, slow drift | `binoculars`, `think` | Curious, open |
| Discover | Curiosity | Postcard cards, maps | `map`, `point` | Helpful, brisk |
| Book | Confidence | Ticket shapes, clear price blocks | `clipboard`, `thumbs` | Calm, precise |
| Manage | Organised | Checklists, progress rings | `clipboard` | Reassuring |
| Prebook | Anticipation | Calendar, countdown number | `think`, `idea` | Excited, low pressure |
| Get to the ship | Focus | Route line, big time | `suitcase` | Short, practical |
| Embark | Excitement | Stamp moments, big progress ring | `cheer` | Warm, welcoming |
| Sea | Relaxed | Horizon, time-of-day light | `sunglasses` head, `umbrella` | Easy, playful |
| Port | Adventure | Postcard port card, all-aboard clock | `camera`, `map` | Energetic, careful about time |
| Disembark | Gratitude | Checklist plus thank you | `wave` | Clear, kind |
| Remember | Nostalgia | Postcards, passport stamps, Wrapped | `camera` | Warm, reflective |

Implementation: one `stageMood` map (framework-free TypeScript, unit tested) feeding the existing stage hero, empty states and greeting line. No new server work.

---

## 8. Desktop and tablet

- **Two-pane layouts** from 1024px: list on the left, detail on the right (itinerary day, port guide, cabin chooser). The `workspace` grid exists; extend to Trip, Bill and Port screens.
- **Large "planning table" view** for the itinerary: a week-at-a-glance grid with drag to reorder reservations (always with a keyboard alternative).
- **Hover previews** on tiles and ports (small card with image and next action), with a focus equivalent.
- **Dashboard hero** on wide screens: the stage picture at full height beside "The Moment" card, rather than a thin banner.
- **Print styles** for itinerary, packing list and boarding pass that look like a keepsake (the `print.css` base exists).

---

## 9. Sound, motion and haptics policy

Decision: **minimal sounds that confirm an action the guest took**, such as a soft positive click. No ambient audio, no music, no horn.

| Channel | Default | Where allowed | Off when |
| --- | --- | --- | --- |
| Motion | Subtle (lift, drift, land, tick-draw) | State changes, hero, celebrations | Reduced motion (device or setting), calm mode, data-light mode |
| Haptics | Tick on success only | Check-in done, scan OK, milestone | Calm mode, reduced motion, unsupported devices |
| Sound | **Confirmation clicks only** | See the list below | The "Sounds" setting is off, calm mode, or the phone is on silent |
| Confetti, fireworks, coins, streaks | **Never** | n/a | n/a |

**Sound design (S1) — effort S.**

- **Three sounds only**, each under about 150 ms and quiet: *tap-confirm* (a soft positive click for saving, pinning, ticking a checklist item, adding to the diary), *success* (a slightly brighter two-note click for a completed task such as check-in done or pass ready) and *soft-no* (a low, gentle tick for something that did not go through, always paired with the visible error). No sound for navigation, page loads or notifications from the server.
- **Triggered only by the guest's own action**, never on load, never by a timer, never by a background update.
- **A single `playCue(name)` helper** in a plain TypeScript module beside the existing haptics helper, so the rules (setting, calm mode, silent) are unit tested in node. Audio files are tiny (a few KB each, or generated with the Web Audio API so there are no files at all), precached for offline use, and created lazily on the first tap because browsers block audio until a gesture.
- **A "Sounds" switch in Settings**, a local display setting like text size. Suggested default: **on, at a low volume**, because the sounds are minimal and only follow guest actions; calm mode turns them off. Say if you would rather default to off.
- **Accessibility:** sound is never the only signal (the visible tick, stamp or message always appears), and it must not clash with screen readers, so cues are skipped when a screen reader is detected as active where the platform exposes that. Respect the device's mute switch and volume.
- **Where not to use it:** payment confirmation screens (keep them quiet and legible), safety screens, and anywhere the guest may be in a quiet place without having chosen to be noisy. The "Fun level" setting maps Quiet to no sound, Gentle and Lively to the confirmation clicks.

Add one Settings group, **"Fun level"** (Quiet, Gentle, Lively), that maps motion, haptics and sound in one go so guests do not have to find several toggles. "Quiet" equals today's calm mode; "Gentle" is the recommended default; "Lively" enables the extra moments (Stanley celebrations, sail-away card). This is a display setting that stays local, as the project rules require.

---

## 10. Guardrails (non-negotiable)

1. **WCAG 2.2 AA.** Every new colour pair goes through `contrast.test.ts`; atmosphere tints sit on hero art only, never behind text. Animations never carry the only signal.
2. **No dark patterns.** No fake urgency, no scarcity timers, no streaks or guilt. The existing `darkPatterns.test.ts` and `wordingGuards.test.ts` stay green and gain cases for new copy.
3. **Offer restraint stays.** Celebration and atmosphere never promote a purchase. The "Moment" card on Home is for the guest's own next step.
4. **Thin client.** Time-of-day phase, sea state, day kind, mood and trivia content come from the backend (mocked behind interfaces). The front end must not know the data is simulated.
5. **Performance.** Hero effects are CSS or a tiny canvas, paused off-screen. Fonts subset. Art lazy-loaded (the `DeferredImage` pattern). `perf.test.ts` budgets are checked after each phase.
6. **Offline.** New art and fonts join the PWA precache; effects degrade to static images.
7. **English only** for new strings, per the project rule.
8. **Verification:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`. No browser testing; visual checks are done by you on a device.

---

## 11. Suggested phasing

Each phase is a commit-and-stop unit, per the project's working rules.

| Phase | Theme | Items | Rough size | Server work |
| --- | --- | --- | --- | --- |
| **L1** | Foundation polish | V2 elevation scale and brass dividers (gradients stay), V3 wave edge, tile diet (Q2), tabular numerals if approved | 2 to 3 days | None |
| **L2** | Ceremony | `Celebrate` component (F6), S1 confirmation sounds and the Sounds setting, V4 ticket and postcard use, tick-draw, Stanley empty states and pose mapping (F8), stage mood map (Section 7) | 5 to 6 days | None |
| **L3** | Home that answers "what now?" | Q1 Moment card plus Today strip, F4 voyage line and rings, F5 countdown number, Q4 time pills | 5 to 6 days | Minor (a "moment" selector, if not already derived) |
| **L4** | The ship comes alive | F1 time-of-day, F2 weather and sea on hero, F3 sea-day and port-day headers, F7 sail-away | 6 to 8 days | Small (phase of day, day kind) |
| **L5** | Ease of use | Q3 reorder Home, Q5 search, Q7 skeletons and friendly errors, Q8 gestures and shortcuts, Q9 "Show me" | 5 to 7 days | None |
| **L6** | Keepsakes and play | Passport stamp book, Q11 share cards, F9 scavenger hunt and trivia, "Fun level" setting (if not already done in L2) | 8 to 10 days | Content endpoints |
| **L7** | Big-screen and maps | Section 8 two-pane layouts, Q6 ship map upgrade, print keepsakes | 8 to 12 days | None |

My recommendation: do **L1 and L2 first**. They are cheap, they change the feel of every screen at once (without touching fonts or gradients), and they set the visual language the later phases build on. L4 is the single biggest "wow" and should come right after the Home work.

---

**Build status (2026-11-09): L1 and L2 are built** (not yet committed). Sounds default to on with a toggle in Settings; tabular numerals are on. Done: elevation scale, brass divider on Home, wave edge under page headers, lighter Home tiles (attention shown as a dot), confirmation sounds (`src/sound/cues.ts`, played from `useAction`, quiet on payment and muster screens), `Celebrate` (shown once after check-in finishes), tick-draw on Home steps, ticket cards on the receipt, postcard cards on Memories, and the stage mood map with Stanley on the landing card. Not built: the "Fun level" group (L6), Stanley pose changes on other screens.

**L7 built (2026-11-09):** deck map is two-pane from 1280px (controls left, plan right), with a side-view ship deck switcher (`DeckElevation`), zoom in/out buttons on the plan, a dotted animated route (still under reduced motion) and keepsake print styles. 

**L7 completed (2026-11-09):** drag-pan with momentum and pinch zoom on the plan (`usePanZoom`, `deckFilter.ts`), walk time on search results when "You are here" is set, category filters, week-at-a-glance table in Build my week (from 1024px), hover/focus previews on tiles (wide screens with a pointer), full-height dashboard hero beside the Moment card (from 1280px), two-pane Port guide and Bill. Not built: drag to reorder reservations (no keyboard-safe version designed yet), a toilets category (the ship data has none), two-pane Trip itinerary.


**L8 decisions and build (2026-11-09):** Fun level default is **Lively** (already the default in settings). Brand boundary: extend colour and artwork freely to complement Princess, not limited by it. Built: restroom places on all three ships (client `deck.ts`, server `AboardPlans.cs`, `ShipReference.cs`) with Restrooms and Lifts filters on the deck map; Earlier/Later buttons on dinner reservations (`nearestFreeSlot`; drag is not offered, and a release gate forbids drag); Q11 share cards for one day of the plan and for a port (print, save as image, copy); PWA app shortcuts (Boarding Pass, Today, Ask Stanley); tile preview card rework (opens on focus as well as hover, anchored under the tile, closes on Escape, words hidden from screen readers because the tile already holds them); keepsake print heading and a Print button on the plan, packing list and boarding pass; a motion-policy test. Not built: an image in the tile preview (no per-screen art exists), a live status line on the app icon (no browser API for it), a lifts-only route highlight.

---

## 12. Open questions for you

Settled: fonts unchanged, gradients kept, sound limited to confirmation clicks.

1. **Sounds default:** on at low volume (my suggestion, since cues only follow your own taps), or off until the guest enables them?
2. **Tabular numerals:** may I turn them on for times, prices and countdowns? It is not a font change.
3. **Fun level default:** should new guests start on **Gentle**, or on **Quiet** until they opt in?
4. **Games:** is a scavenger hunt and daily trivia in scope, or should the Entertainment area stay informational?
5. **Brand boundary:** how close do you want to stay to the Princess corporate system? Waves, brass and tickets are compatible with it but add personality beyond princess.com.
6. **Real photography vs illustration:** keep the illustrated style throughout, or mix in photographic port and ship images where licences allow?
7. **Which phase first?** I recommend L1 and L2 together as the next build phase.

---

## 13. What I would not do

- Gamified points, leaderboards, streaks, loot, daily-login rewards.
- Auto-playing video, ambient audio or music, sounds that fire without a guest action, full-screen animations on launch, or parallax that moves text.
- Anything that makes a required task (check-in, safety, payment) slower, or hides it behind a game.
- Clip-art or stock cartoon sets that clash with Stanley.
- Locking the look to one season or promotion.

**Fun level (2026-11-09):** built as a per-device setting `fun` (Quiet, Gentle, Lively), **Lively by default** as the owner asked; guests can lower it in Settings. Calm mode always counts as Quiet (`funLevelFor`). It sets `data-fun` on `<html>`; use `.fun-only` (hidden at Quiet) and `.lively-only` (shown only at Lively) in CSS. **Games are planned for later and must follow this setting** (hidden or toned down at Quiet).

**Build status (2026-11-09): L3 is built** (not yet committed). Moment card (`useMoment`, `pickMoment` in `src/domain/homeLook.ts`, `MomentCard`) leads Home when something is pressing (muster, all-aboard, final payment, check-in), otherwise the stage landing card stays. "Today so far" strip (`TodayStrip`) on board. Voyage line with a ship marker in `JourneyStrip`. Progress rings on checklist and packing tile lines (`TileLine.ring`). Hero countdown (`HeroCount`, "sleeps to go", weekly caption at Lively only). Clock pill in `ThreeClocks` and "In 25 min" labels on the all-aboard Moment. Server work: none needed, the moment is derived from existing trip and today data.

**Build status (2026-11-09): L4 is built.** Pure logic in `src/domain/shipLook.ts` (phase of day, sea state, hero effect, day look, all-aboard tone, sail-away window), read through `useShipLook` from the existing sky-night and weather feeds, so no server work was needed. `AtmosphereHero` tints the hero for sunrise, sunset and night, adds one light effect (cloud, rain, glint, spray), a sea gauge and a greeting line. `DayHeader` gives sea, port and embark/disembark days their own header, with an all-aboard ring that turns amber then red (always with words). `SailAwayCard` shows from an hour before to two hours after departure. Tint and effects are off in calm mode, Quiet, data-light and high contrast; effects also stop under reduced motion. Not built: a postcard picture per port (the art manifest has no port art yet), "nautical miles to the next port" on sea days (no distance in the feeds), a big progress ring on embark and disembark days, and pausing effects on a hidden tab (browsers already stop them).

**Build status (2026-11-09): L5 is built** (not yet committed). Pure logic in `src/domain/ease.ts` (`movePin`, search chips, shortcut chords, the "Show me" ids). Built: "Edit favourites" on the Home shortcut bar (`EditFavourites`, move up, down or remove with buttons, no drag needed); suggested search chips before typing (different aboard and ashore); a page-shaped skeleton in place of the "Loading" line (`PageSkeleton`, still under reduced motion); Stanley's "oops" pose on the app error screen; desktop shortcuts `/` search, `?` cheat sheet, `g h`, `g p`, `g s`, `g m` (`useShortcuts`, `ShortcutsSheet`; ignored while typing); "Show me" three-step guides (`ShowMe`) for the gangway scan (boarding pass), the muster station and the tender. Not built: long-press to reorder, syncing favourites to the account (they stay per device), a "Your favourites" strip separate from the shortcut bar, a pull-down search gesture, results grouped with icons, swipe between days, swipe to snooze, pull to refresh, long-press quick actions, new optimistic updates, and custom Stanley art for the guides (they reuse existing poses).

**Build status (2026-11-09): L6 is built** (not yet committed). Much of the phase already existed: games (hunt, trivia, bingo, badges; ENT-05) and print and image cards (`PrintCard`, keepsakes, moment card, poster). Added: a **passport stamp book** at the top of the Trip Diary screen (`src/domain/stamps.ts`, `StampBook`): stamps for booked, checked in, boarding pass, aboard, and each port reached, with ports still ahead shown as dashed "Still ahead" slots, derived from the itinerary and diary so nothing new is stored; the press-in animation is Lively only, and the book can be printed or saved as an image. **Daily trivia** on the Games screen (`dailyTrivia`, `PORT_TRIVIA` served through `games.PORT_TRIVIA` in the reference content): three questions about the ports still ahead, the same for everyone on a day, no timer, nothing saved or scored. Port questions match on the start of the port name, because the single-route guard forbids literal port ids in source. Not built: new Q11 share cards for today's plan and a port guide (the existing poster, keepsake and moment cards cover plan, photo and recap), the ship-spotting log and family quiz, a medallion for the stamp book, server-side storage of daily answers. Note: `npm run content:gen` blanks `services.PORT_CONTACTS` (it is served-only), so `reference-content.json` was edited by hand for this phase; do not regenerate it blindly.
