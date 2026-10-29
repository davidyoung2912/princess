# Princess Guest App — Design Language and Technical Foundation (v0.2, approved)

Status: **Approved on 2026-10-29: all eight decisions in §10 accepted as recommended. No code has been written.** Phase 0 step 0a (this document) is complete; step 0b (scaffold) begins when you ask.
Date: 2026-10-28
Inputs: `functional-requirements.md` (v0.9), `sun-princess-ship-profile.md`, a read-only review of the local `eclipse-court` app, and the live Princess stylesheet at princess.com (read 2026-10-28).

---

## 1. Summary of the proposal

1. **Look and feel: the Princess corporate system, made calmer and larger.** Light, airy surfaces (white and warm sand), Princess Blue as the single primary colour, pill-shaped buttons, a serif display face for headings and a clean sans for everything else, and tall photography. It must read as "the same company" next to princess.com and the real app.
2. **A correction to my earlier suggestion.** I earlier said "warm navy and gold". The real site is mostly **white and sand with Princess Blue**; navy is used for dark sections and gold is a small accent that **fails text contrast** on white (3.5:1). So the app is light by default, with a dark "Evening" theme for use in a cabin at night, and gold is decoration only.
3. **Technical foundation: adopt eclipse-court's approach, adapt where a guest app differs from a game.** Same stack, lint, test, PWA and CSS-token discipline; but with URL routing, IndexedDB, a mock API layer, selectable text, pinch zoom, and a desktop layout.
4. **UX rules from the research are design rules, not extras:** two-tap rule, task-first screens, offer restraint, three clocks, "last updated" everywhere, help always visible (requirements §23).

---

## 2. What the eclipse-court review tells us

eclipse-court is a mature reference for how you like projects built. I reviewed its configuration, stylesheets, accessibility plan, shared hooks and persistence code.

### 2.1 Adopt as is

| Area | eclipse-court practice | Why we keep it |
| --- | --- | --- |
| Stack | Vite 8, React 19, TypeScript (ES2023, `verbatimModuleSyntax`, `erasableSyntaxOnly`, unused checks), plain CSS | Matches `CLAUDE.md`; strict settings catch errors early |
| Lint | Oxlint with react, typescript, oxc, jsx-a11y plugins; a11y rules as warnings or errors | Required by `CLAUDE.md`; replaces browser testing as the accessibility guard |
| Tests | Vitest in node environment; logic in framework-free modules beside `.test.ts` files | Required by `CLAUDE.md`; keeps logic testable |
| Verification | `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` only | Project rule: no browser testing |
| PWA | `vite-plugin-pwa`, `registerType: autoUpdate`, precache of `js,css,html,svg,png,webp,woff2`, `navigateFallback`, maskable icon, `viewport-fit=cover`, safe-area insets | Required by `CLAUDE.md` |
| CSS structure | Tokens in `base.css` (colour, spacing, radius, elevation, motion, type scale), then one file per concern, imported by `index.css` | Easy to review; one source of truth |
| Motion tokens | One easing curve and three durations; ambient loops separate | Calm, consistent motion |
| Dialog hook | `useDialog`: focus moves in, Tab trapped, Escape closes, focus returns to opener, dialogs stack | Directly satisfies A11Y-01 |
| Contrast guard | A pure `contrast.ts` (WCAG maths) plus a test that fails if any theme drops below 4.5:1 text or 3:1 UI | We will do the same across Light, Dark and High-contrast |
| i18n | `t('screen.key', {name})` over an `en.ts` table, `_one`/`_other` plurals, and a test | Requirement: US English only, strings externalised |
| Backup | `exportSave`/`importSave`: prefixed keys, versioned format, tolerant import | Requirement §22.1 (export/import of "my data") |
| Settings applied to `<html>` | `applySettings()` sets data attributes (e.g. `data-motion="reduced"`) before first render | Avoids flash of wrong text size or theme |
| Boot splash | Inline CSS splash in `index.html`, removed after first paint, reduced-motion aware | Good first impression, offline friendly |
| Error boundary | App-level `ErrorBoundary` | Supports "no dead ends" |
| CSP plugin | Build-only Content-Security-Policy meta tag | Keep; widen only as needed (see 2.3) |
| Docs | A plan document per concern (`accessibility-plan.md`) with "done notes" | We keep `docs/` as the project memory |

### 2.2 Adapt

| eclipse-court | Princess app | Reason |
| --- | --- | --- |
| Single column, `max-width: 560px`, game-like | Mobile-first **plus** real desktop layout (§6) | Requirement: responsive for phone and desktop |
| `user-select: none`, touch-optimised for play | Text is selectable and copyable (booking numbers, addresses) | Guest utility |
| `screens.ts` state machine, no URLs | **URL routing** with deep links and a working Back button | Notifications, shared links, PWA reopening, WCAG 2.4 navigation |
| `localStorage` with a key prefix | **IndexedDB** for structured data, photos and documents; `localStorage` only for tiny settings | Requirement §22.1 (quota, photos, documents) |
| No network at all; CSP `connect-src 'self'` | Mock API in-process; CSP additionally allows the Anthropic API (concierge) and Princess image hosts | Requirements §22.2, §22.5 |
| Dark, saturated game palette | Light-first corporate palette with Dark and High-contrast themes | Princess brand |
| `largeUi` toggle | Three text sizes (Standard, Large, Extra large), Gerald defaults to Large | Requirement §22.7 |
| Fonts self-hosted via `@fontsource` (Cinzel, Nunito) | Same mechanism, different families (§5) | Offline use; Princess fonts are licensed and cannot be bundled |
| Pinch zoom disabled early on, later fixed | **Never disable zoom** | WCAG 1.4.4; eclipse-court's own plan lists this as a defect |

### 2.3 Deliberately not carried over

Game "juice" (tap ripples, parallax, sound cues, haptic taps, count-up flourishes, streaks, shards, shop), theatrical dark atmosphere, and the Cinzel/Nunito pairing. A guest app that people use to board a ship, find a child or pay a bill should feel calm and trustworthy.

---

## 3. Princess corporate system (extracted from princess.com)

Read from the live site's stylesheet on 2026-10-28. These are published values on a public site, but they are not an official brand guide; if Princess publishes one, we reconcile.

### 3.1 Brand tokens found

| Token (princess.com name) | Value | Used by Princess for |
| --- | --- | --- |
| `princess-blue` | **#003595** | Primary colour, badges, dark sections |
| `princess-blue-dark-200` | #002a77 | Darker blue |
| `black` | #020215 | Text (a blue-black, not pure black) |
| `sand` / `sand-light-500` | #f2efed / #f9f7f6 | Warm section backgrounds |
| `silver-blue` / `-light-300` | #cce7eb / #f0f8f9 | Cool tint backgrounds |
| `steel-gray` / `-light-100` / `-light-300` | #6c6c78 / #f0f0f2 / #d3d3d7 | Secondary text, dividers, borders |
| `gold` | #aa8247 | Accent |
| `passion-pink` | #e60060 | Promotions |
| `princess-focus` | #007cdb | Focus ring |
| `color-accent` | #b6254f | Accent (hover #7a4e2d) |
| (page) | #243e8c, #00205a | Gradient and dark-section blues |

Typography on the site: **Proxima Nova** (body, via Adobe Fonts), **Domaine Display** (headings), and **Lora** (secondary serif). Weights 400/500/600/700. Buttons are mostly **pill-shaped** (`border-radius: 100px`); cards and inputs use **4px or 8px** corners; some sections have a large **rounded top-left edge**. Photography is full-bleed hero banners and **4:5 portrait** destination cards, square tiles for categories, and lifestyle imagery of guests. Icons are simple line glyphs. The site shows call-to-actions in capitals.

### 3.2 Constraints on how we use them

- **Gold #aa8247 on white is 3.50:1 and on Princess Blue 3.08:1.** It fails 4.5:1 for normal text. It is used only for non-text decoration and large text (24px or 18.66px bold, which needs 3:1), plus a **darker text-gold** (§4.2) for small gold text.
- **Passion pink #e60060 is 4.63:1 on white**, barely passing; it is not used for body-size text and, with the offer-restraint rule, is reserved for urgent or attention states, never promotions.
- **Princess Focus #007cdb is only 4.28:1 on white**, below 4.5 but above the 3:1 needed for a focus indicator (WCAG 2.4.11/1.4.11). We use it as a **two-tone ring** (see §7) so it works on blue, white and photos.
- **Proxima Nova and Domaine Display are licensed fonts** (Adobe Fonts / Klim). We cannot bundle them. We use free open-licence families chosen to sit beside them (§5).
- Logo and photography follow the round-three decision: use real Princess imagery and the real wordmark unmodified, referenced or kept in a git-ignored folder with a source manifest, with the "unofficial concept" notice always visible.

---

## 4. Colour system

### 4.1 Principles

1. **Princess Blue is the only action colour.** Primary buttons, links, selected states and active tabs are blue. This makes "what can I tap?" a single rule.
2. Surfaces are **white and sand**; silver-blue tints mark information (not promotion).
3. **Colour never carries meaning alone** (A11Y-02): every status has an icon and a word.
4. Every colour pair used for text or controls is **declared in code and tested** (§9.3).

### 4.2 Tokens (Light theme, default)

| Role | Token | Value | Notes / contrast |
| --- | --- | --- | --- |
| Text | `--text` | #020215 | 20.6:1 on white, 17.9:1 on sand |
| Secondary text | `--text-muted` | #595965 | 6.0:1 on sand (the brand #6c6c78 is only 4.53:1 on sand, so we darken it) |
| Page | `--bg` | #ffffff | |
| Warm surface | `--surface-warm` | #f2efed | Cards, sections |
| Cool surface | `--surface-info` | #f0f8f9 | Information cards |
| Border | `--border` | #d3d3d7 | UI component boundary use needs a darker `--border-strong` #8a8a96 (3:1 on white) for inputs |
| Primary | `--primary` | #003595 | 10.8:1 with white text |
| Primary hover/pressed | `--primary-dark` | #002a77 | 13.1:1 with white text |
| Link | `--link` | #003595 | Underlined by default |
| Brand tint | `--brand-tint` | #cce7eb | Selected row background; 8.3:1 with `--primary` text |
| Gold (decoration) | `--gold` | #aa8247 | Rules, icons beside text, large text only |
| Gold (small text) | `--gold-text` | #7a5a24 | 6.3:1 on white, 5.5:1 on sand |
| Success | `--success` | #1b6b3a | 6.5:1 on white; always with a check icon |
| Warning | `--warning` | #8a4b00 | 6.8:1 on white; always with a warning icon |
| Danger | `--danger` | #b00020 | 7.3:1 on white; always with an alert icon |
| Urgent attention | `--attention` | #e60060 | Large badges and the all-aboard banner only |
| Focus ring | `--focus` | #007cdb with a 2px white inner ring | See §7 |

All values above were checked with the WCAG formula on 2026-10-28; the Phase 0 contrast test (`contrast.ts`) will assert them.

### 4.3 Dark theme ("Evening")

For cabins and sail-away at night; automatic with the OS or chosen in settings. Surfaces are blue-black rather than grey so it still feels like Princess.

| Role | Value | Contrast |
| --- | --- | --- |
| Page `--bg` | #020215 | |
| Surface | #0d1330 | text #f2efed is 15.9:1 |
| Primary (on dark) | #8fb0ff | 8.5:1 on the surface; button text is #020215 |
| Gold | #e8c98a | 11.4:1 on the surface |
| Muted text | #b5b5c0 | 9.0:1 |
| Success / warning / danger | #6fd495 / #f0b45c / #ff8a9a | 8.1–10.0:1 |

### 4.4 High-contrast theme

Pure white page, #020215 text, #00205a links (15.5:1), 2px solid borders on every control and card, no tints or translucency, no photography behind text. Available in both light and dark.

### 4.5 Photography and text

Text on photography always sits on a solid or gradient scrim tested at 4.5:1; never directly on an image. Hero imagery is decorative with empty alt text or described alt text when it carries information.

---

## 5. Typography

| Role | Princess uses | Proposed (open licence, self-hosted via `@fontsource`) | Notes |
| --- | --- | --- | --- |
| Display (page titles, hero, ship name) | Domaine Display | **Lora** 600 (Princess's own secondary serif) | Used for headings only, never small labels |
| Body and UI | Proxima Nova | **Figtree** (variable, 400–700) | Geometric humanist sans close to Proxima Nova; final pick after a side-by-side specimen in Phase 0 (alternative: Mulish) |
| Numerals (times, prices, cabin) | — | Figtree with tabular figures | So times and amounts align |

**Scale.** The root font size follows the text-size setting and every size is in `rem`, so the whole interface scales:

| Setting | Root size | Who it is for |
| --- | --- | --- |
| Standard | 18px | Default for most personas |
| Large | 22px | **Gerald's default** (requirement §22.7) |
| Extra large | 26px | Any guest; layout must still reflow at 320 CSS px |

Even "Standard" is 18px (larger than the usual 16px) because the audience skews older. Type steps (at 18px root): caption 0.875rem, body 1rem, lead 1.125rem, title 1.5rem, headline 2rem, display 2.5rem. Line height 1.5 for body; maximum measure about 70 characters. Capitals are used sparingly for buttons only if the user's font size allows; sentence case is the default for readability (a deliberate difference from the site's capitalised calls to action).

---

## 6. Layout and navigation

### 6.1 Breakpoints

Mobile-first, content-driven: **base** (320–599), **tablet** (≥600), **desktop** (≥1024), **wide** (≥1440). Everything works at 320 CSS px and at 200% zoom (WCAG 1.4.4, 1.4.10).

### 6.2 Phone: five-tab bottom bar

Primary actions live in the lower half of the screen (principle 1). Five tabs, each with an icon **and** a visible label:

| Tab | Contains |
| --- | --- |
| **Home** | Stage-aware home: next required action first (MNG-02); boarding pass; today; countdown or all-aboard |
| **Plan** | One planner: ship schedule plus my agenda plus excursions plus dining and shows (PRE-15, OB-02, OB-09) |
| **Ship** | Deck plans and venue directory, dining, spa, shops, kids' clubs, Find-My-Kid, stateroom, ports |
| **Chat** | Free messaging: family, friends, Guest Services (MSG-01/02) |
| **Me** | Bill/folio, bookings, documents, Captain's Circle, settings, accessibility, help centre |

A persistent **Help** button (a labelled circular control in the top bar, not a floating icon) opens the help sheet from anywhere: phone numbers (offline), Guest Services chat, emergency, "I need medical help now" (SUP-08). **Time** (ship, local, phone; POR-11) sits in the top bar on port days and is tappable.

The 15 top tasks (UX-01) map to two taps: e.g. boarding pass (Home, one tap), today's events (Plan), change a dining reservation (Plan, then the item), my bill (Me, one tap), find my family (Ship, one tap), emergency info (Help).

### 6.3 Desktop and tablet

At ≥1024 the tab bar becomes a **left rail** with the same five entries and labels; content sits in a centre column with an optional right-hand **"Today" panel** (next events, clocks, all-aboard, boarding pass). Content columns cap at about 72rem. Check-in, booking and the planner are the screens that use the extra space (planner shows a day timeline beside a detail pane). Nothing is desktop-only or phone-only: the same features exist at both sizes.

### 6.4 Shape language

- **Buttons:** pill-shaped (full radius) like princess.com, minimum height 48px, 56px at larger text sizes.
- **Cards and inputs:** 8px corners. A **large rounded top-left corner** on hero and section cards echoes the website's signature section edge.
- **Elevation:** almost none; sand surfaces and 1px borders separate content. One soft shadow for sheets and dialogs.
- **Spacing:** 4px base unit; page gutter 16px on phone, 24px tablet, 32px desktop; safe-area insets respected.

### 6.5 Sketch (phone, embarkation-day Home)

```
┌────────────────────────────┐
│ Princess            [Help] │  top bar: wordmark, Help
│ Sun Princess · Sun 21 Mar  │
├────────────────────────────┤
│  Your next step            │
│  ┌──────────────────────┐  │
│  │ Show boarding pass   │  │  one primary action
│  │ Arrive 12:30–1:00 pm │  │
│  └──────────────────────┘  │
│  Boarding pass works       │
│  offline · Updated 9:14 am │  "last updated" always shown
│                            │
│  Today                     │
│  3:00 pm  Muster drill     │
│  3:30 pm  Sail-away party  │
│  [ See the whole day ]     │
│                            │
│  Unofficial concept · Not  │  disclaimer
│  affiliated with Princess  │
├────────────────────────────┤
│ Home  Plan  Ship  Chat  Me │  five labelled tabs
└────────────────────────────┘
```

---

## 7. Components

Every component ships with: keyboard behaviour, focus style, hover/pressed/disabled states, error and loading states, reduced-motion behaviour, and a test for any logic it holds.

| Component | Key rules |
| --- | --- |
| **Button** | Primary (filled blue, white text), Secondary (blue outline), Tertiary (text with underline on hover/focus), Danger (outlined red until confirmation). Never disabled without a reason shown. Min 48px tall, full width on phones for the primary action |
| **Focus ring** | 3px `--focus` ring with a 2px white inner ring (and a dark ring in Evening), so it is visible on blue buttons, white, sand and photos; never removed |
| **Tab bar / rail** | Icon + label; active tab blue with a bar indicator and `aria-current` (not colour alone) |
| **Top bar** | Wordmark, Help, optional clocks, offline/sync status chip |
| **Card** | 8px corners, optional large top-left radius, image with 4:5 or 16:9 ratio, a single action |
| **List row** | 56px minimum, chevron for navigation, whole row is the target |
| **Banner** | Info, success, warning, danger, offline; icon + title + action; `role="status"`/`alert` |
| **Sync/age chip** | "Updated 9:14 am" on every cached view; changes to "Offline: showing saved copy from 9:14 am" (OB-08, PERF-06) |
| **Dialog / bottom sheet** | `useDialog` behaviour: focus trap, Escape, focus return, `aria-labelledby`; sheets drag-to-dismiss **and** have a Close button (2.5.7) |
| **Form field** | Visible label above the field, hint, inline error with icon, error summary at the top on submit, `autocomplete` tokens, input purpose, no placeholder-as-label |
| **Stepper** | Check-in progress per guest; shows "what's left"; resumable; saves each step (CHK-02, CHK-13) |
| **Timeline** | Planner day view with time column, "now" marker, changed/cancelled markers (struck through, with a word) |
| **Chip / filter** | Toggle with `aria-pressed` and a check icon when on |
| **Status badge** | Word + icon + colour (booked, waitlist, sold out, changed, cancelled, ready) |
| **Countdown / all-aboard** | Large numerals, ship time and local time side by side; never urgency-styled until the final hour; no animated flashing |
| **Boarding pass** | QR code on white, high contrast, "keep screen bright" prompt, printable PDF, offline badge (CHK-04, CHK-14) |
| **Chat** | Live region for incoming messages, delivery state words ("Sending", "Sent", "Waiting for signal"), age rules (MSG-05) |
| **Skeleton / empty / error** | Every list has a loading skeleton, a friendly empty state, and an error state with a next step and a human route |
| **Toast** | Only for confirmations that do not need action; also announced through a polite live region |
| **Deck map viewer** | Pan/zoom with buttons (no gesture-only), per-deck switcher, searchable, accessible-route toggle, text alternative list |
| **Offer card** | Single dedicated area plus at most one contextual card; always has "Not for this trip"; never countdown or scarcity text (UX-02) |

### 7.1 Iconography

Princess uses simple line glyphs. We use a **single consistent line-icon set** (24px grid, 2px rounded strokes, `currentColor`), rendered as inline SVG, always `aria-hidden` when beside a label and given an accessible name when alone. Proposed source: **lucide** (MIT licence, tree-shakeable) to avoid hand-drawing about 120 icons; the few ship-specific icons (tender boat, Medallion, deck) are drawn in the same style. No emoji in the interface. Decision for you in §10.

### 7.2 Motion

One easing curve and three durations (as in eclipse-court): fast 120ms, medium 220ms, slow 360ms. Motion is limited to state changes (sheet slide, tab indicator, skeleton shimmer, a gentle ocean-wave header accent on Home only). **No** parallax, ripples, confetti, autoplay or looping animation beyond the boot splash. Reduced motion is honoured through both the OS preference and an in-app setting (`data-motion="reduced"`), which also removes shimmer and the wave. Nothing flashes more than once per second.

---

## 8. Voice and content

- **Plain language** around grade 8, short sentences, verbs first ("Add your passport", not "Passport documentation submission").
- Princess's own product names are used where guests know them (Medallion, OceanReady-equivalent "Check-in", Plus, Premier, Captain's Circle), with a one-line explanation the first time.
- Tone: calm and reassuring, never urgent unless something is; no exclamation marks in errors.
- Error pattern: **what happened, what is safe, what to do next, how to reach a person.**
- Strings live in `en.ts` with keys like `checkin.passport.title`, plural pairs, and a test that every key is used and every referenced key exists.
- The **concept notice** ("Unofficial concept, not affiliated with Princess Cruises") appears on the boot splash, in the footer of Home and Me, and in About.

---

## 9. Technical foundation

### 9.1 Project layout

```
princess/
  CLAUDE.md                    (exists)
  docs/                        (requirements, ship profile, this document, per-phase notes)
  public/                      icons, manifest assets, favicon
  scripts/                     icon generation, contrast report, content-manifest check
  src/
    main.tsx  App.tsx  ErrorBoundary.tsx
    styles/                    tokens.css, base.css, layout.css, components/*.css, themes.css, print.css
    design/                    contrast.ts (+test), tokens.ts, themes.ts, textSize.ts
    i18n/                      en.ts, index.ts, i18n.test.ts
    routes/                    route table and per-stage screens
    ui/                        shared components (Button, Card, Dialog, Sheet, Field, Stepper, Timeline, ...)
    hooks/                     useDialog, useOnline, useDemoClock, ...
    domain/                    framework-free logic: clocks, entitlements, documents rules, schedule diff,
                               pricing, dining windows, queues (all unit-tested in node)
    mock/                      api client interface, fixtures (ship, venues, staterooms, itinerary, ports,
                               excursions, programme), personas, latency/failure injection, scenarios
    data/                      IndexedDB wrapper, schema versioning and migrations, backup/export/import
    auth/                      auth-provider interface + mock identity provider
    ai/                        concierge client (Phase 9) and scripted fallback
    settings/                  text size, theme, contrast, motion, simple mode, data-light mode
```

Framework-free modules (`domain`, `mock`, `data`, `design`) have no React imports and are tested in a node environment (`CLAUDE.md`).

### 9.2 Dependencies (kept minimal)

| Package | Purpose | Note |
| --- | --- | --- |
| react, react-dom | UI | Same as peer |
| vite, @vitejs/plugin-react, vite-plugin-pwa, vitest, oxlint, typescript | Build, PWA, tests, lint | Same as peer |
| `@fontsource/lora`, `@fontsource/figtree` | Self-hosted fonts | Offline-safe |
| `react-router` | URL routing, deep links, Back button | **Decision §10** |
| `lucide-react` | Line icons | **Decision §10** |
| `idb` (tiny) | Promise wrapper for IndexedDB | Or our own 100-line wrapper; **Decision §10** |
| `qrcode` (or similar small generator) | Boarding-pass QR codes | On-device, no network |
| `sharp` (dev) | Icon generation script | As in peer |
| ~~`@anthropic-ai/sdk`~~ | Concierge | Not added: Phase 9 calls the Messages API with plain `fetch` (smaller bundle, testable in node) |

No CSS framework, no state library (React state plus small context providers and `useSyncExternalStore` over the data layer), no component library.

### 9.3 Quality gates built in Phase 0

1. **Design-token contrast test**: every declared text/background and UI/background pair in Light, Evening and High-contrast themes is asserted (4.5:1 text, 3:1 UI), as in eclipse-court.
2. **i18n test**: no missing or unused keys; plural pairs complete.
3. **Lint**: Oxlint with react, typescript, oxc, jsx-a11y.
4. **Task-path test**: a pure route/navigation table asserts the top-15 tasks are within two taps (UX-01); this is a unit test over the navigation model, not browser testing.
5. **Persistence tests**: schema migration, quota-error handling, export/import round trip.
6. **Mock layer tests**: latency and failure injection are deterministic (seeded) so scenarios replay identically.

### 9.4 Mock API, clock and scenarios (the foundation of the demo)

- **Typed API client interface** (`bookings`, `checkin`, `dining`, `queues`, `orders`, `messages`, `photos`, `folio`, `requests`, `ports`, `help`, `auth`). The mock implements it with async responses, seeded latency, seeded intermittent failure, and an offline switch. A real service could replace it later without touching screens.
- **Demo clock**: one source of "now" for the whole app, with ship time, local port time and phone time modelled separately (POR-11). Controls: jump to a stage, step time, run at speed.
- **Scenario switcher**: loads any of the 12 personas into a stage and optionally triggers the failure scenarios from requirements §23.5.
- **Persona switcher** (demo only): signs in as any of the 12 people; chat and shared plans sync between tabs through `BroadcastChannel`.
- **Persistence**: IndexedDB with a versioned schema; "Reset demo", "Export my data", "Wipe everything" in Me → Settings.

### 9.5 PWA and security headers

`vite-plugin-pwa` (autoUpdate, versioned precache, offline fallback, update prompt that never discards work), manifest with Princess-blue `theme_color` and `background_color`, maskable icon, `display: standalone`. The CSP is the peer's plus `connect-src` for the Anthropic API (Phase 9) and `img-src` for the Princess image host(s); locally bundled key images are preferred for offline use (decision §22.5).

### 9.6 Print

A `print.css` provides clean, black-on-white layouts for the daily plan, boarding pass, itinerary, excursion tickets and receipts, honouring a large-print option (INC-01).

---

## 10. Decisions (all eight approved as recommended, 2026-10-29)

| # | Question | Decision (recommendation adopted) |
| --- | --- | --- |
| 1 | **Light-first with a dark "Evening" theme** (instead of my earlier "warm navy and gold") | Yes, because princess.com is light with Princess Blue and gold fails contrast |
| 2 | **Fonts**: Lora (display) + Figtree (body), self-hosted, as stand-ins for Domaine Display and Proxima Nova | Yes; I will show a specimen of Figtree against Mulish and pick |
| 3 | **Routing**: add `react-router` (library mode) | Yes: deep links and Back button are needed for notifications, shared plans and accessibility |
| 4 | **Icons**: `lucide-react` plus a few custom ship icons | Yes; or tell me to hand-draw a smaller set |
| 5 | **IndexedDB wrapper**: use `idb` | Yes; small and well known (or I write one) |
| 6 | **Navigation**: five tabs Home / Plan / Ship / Chat / Me, with a persistent Help button | Yes; the alternative is a hamburger menu, which fails the two-tap rule |
| 7 | **Sentence case buttons** instead of the website's capitals | Yes, for legibility at large text sizes |
| 8 | **Phase 0 split into stopping points** (see below) | Yes |

### Proposed Phase 0 sub-steps (each ends with a commit and a stop)

| Step | Contents | Verified by |
| --- | --- | --- |
| **0a** | This design-language document, reviewed and amended | Your approval |
| **0b** | Scaffold: Vite/React/TS, Oxlint config, Vitest, PWA shell, CSP, `.env.example`, tokens, themes, fonts, text-size and motion settings, `contrast.ts` with its test, i18n scaffold, boot splash, concept notice | test, lint, tsc, build |
| **0c** | App shell and component kit: routes, tab bar/rail, top bar, Help sheet, Button, Card, Dialog/Sheet, Field, Banner, Sync chip, Stepper, Timeline, print stylesheet; a simple in-app "kit" page to review the components | test, lint, tsc, build |
| **0d** | Data foundation: IndexedDB layer and migrations, backup, mock API contract with latency/failure injection, demo clock with three time zones, scenario and persona switchers, auth-provider abstraction with the 12 mock identities, entitlement model | test, lint, tsc, build |

Per `CLAUDE.md`, I will stop after each step and not begin the next until you ask.

---

## Appendix — Evidence for the brand extraction

- Princess stylesheet variables (colour tokens, `proxima-nova`, `DomaineDisplay`, `Lora`, 100px/8px/4px radii) read from `princess.com/etc.clientlibs/princess/clientlibs/…` on 2026-10-28.
- Homepage structure (header strip, booking quick links, four-menu main navigation, 4:5 cards, mobile accordion) from the live page.
- Contrast figures computed with the WCAG relative-luminance formula; they will be re-asserted by the Phase 0 contrast test.
- eclipse-court review: `package.json`, `vite.config.ts`, `index.html`, `.oxlintrc.json`, `tsconfig.app.json`, `src/styles/base.css`, `src/hooks/useDialog.ts`, `src/contrast.ts`, `src/backup.ts`, `src/appMotion.ts`, `src/i18n/en.ts`, `docs/accessibility-plan.md`.

---

## 11. Phase 0 progress notes

### 0b done (2026-10-29): scaffold and foundations

- **Project:** Vite 8, React 19, TypeScript 6 (same strict settings as eclipse-court), Oxlint (react, typescript, oxc, jsx-a11y), Vitest in a node environment, `vite-plugin-pwa` (autoUpdate, precache, maskable icon), build-only CSP, `viewport-fit=cover`, zoom never disabled. `.env.example` added; `.env.local` stays git-ignored.
- **Design tokens:** `src/styles/themes.css` (colour: Light, Evening, and high contrast for each), `tokens.css` (type, spacing, shape, motion, three text sizes as a percentage of the browser's own size), `base.css`, `motion.css` (device and in-app reduced motion), `print.css`.
- **Contrast guard:** `src/design/contrast.ts` and `palettes.ts` parse `themes.css` itself, so the stylesheet is the single source of truth. 28 colour pairs are asserted in all four palettes (4.5:1 text and 3:1 controls; 7:1 text in high contrast). `npm run contrast` prints the table. Negative tests prove the guard fails when it should.
- **Settings:** text size, theme (auto/light/Evening), contrast, reduce motion; validated on load, saved to `localStorage` (`princess:settings`), applied to `<html>` before first render, "auto" follows the device. Persona defaults (Gerald on Large) arrive in 0d through the `defaults` argument.
- **i18n:** `t()` over `en.ts` with plural pairs and a test that fails on any catalog key that is unused or any `t('key')` that is undefined.
- **Shell:** `ErrorBoundary` (reloads once on a stale installed copy), `ConceptNotice`, boot splash with the concept notice, and a throwaway **Foundations preview** page (type sample, display settings, colour swatches) to judge the design language. It is replaced in 0c.
- **Not yet built (later steps):** routing, tab bar and rail, components (0c); IndexedDB, mock API, demo clock, personas, auth, entitlements (0d). Dependencies `react-router`, `lucide-react` and `idb` are added when first used.
- **Verified:** `npm run test` (30 tests), `npm run lint`, `npx tsc -b`, `npm run build`.

### 0c done (2026-10-29): app shell and component kit

- **Routing:** `react-router` (library mode) with deep links. One route table (`src/routes/routes.ts`) drives the router, the tab bar and the placeholders; each screen not yet built shows its title, the phase that builds it, and links to the screens below it, so the two-tap paths can be walked now.
- **Shell:** skip link; top bar with a persistent **Help** button; five labelled tabs (bottom bar on phones, left rail from 1024px) with `aria-current`; on every change of screen the page title updates, the new screen is announced, and focus moves to the main area.
- **Help sheet (SUP-08):** guest services number (`tel:` link), chat, emergency text; all plain text so it works offline. Numbers are fictional 555-01xx samples.
- **Navigation model (UX-01):** the top 15 tasks and their tap paths are data in `src/routes/nav.ts`; a unit test fails if any task needs more than two taps, uses an unknown screen, or does not start at a tab or Help.
- **Components (`src/ui`):** Button / LinkButton, Card, Dialog (focus trap, Escape, Close button, focus return), Field and ErrorSummary, Banner, SyncChip (words from `src/domain/syncAge.ts`), StatusBadge, Chip, Stepper, Timeline (changed and cancelled events stay visible, struck through and labelled), DisplaySettings. Icons come from one file (`icons.ts`, lucide).
- **Component kit:** `/kit`, linked from Me → Settings, shows every component in each state and the colour tokens.
- **Print:** `print.css` hides the frame and prints cards plainly.
- **Test without a browser:** `src/ui/render.test.tsx` server-renders every route and checks the title, tabs, Help, main landmark, the current-tab marker, and that the concept notice appears on Home and Me only.
- **Choices made:** tapping outside a dialog does not close it (a stray tap should not discard work); sheet drag-to-dismiss is not built (the Close button satisfies 2.5.7); the desktop "Today" panel waits for real data in Phase 6; text wordmark in the top bar until the Princess logo asset is handled; the Help button on the rail layout stays in the top bar.
- **Verified:** `npm run test` (61 tests), `npm run lint`, `npx tsc -b`, `npm run build`.

### 0d done (2026-10-29): data foundation

- **Storage (`src/data`):** IndexedDB through `idb` behind a small `DataStore` interface (records by kind and owner, plus meta), with a memory twin for tests; both pass the same contract tests. Versioned schema with ordered upgrade steps run in one transaction (tested by upgrading a populated database). Raw failures become `StorageError` (quota, blocked, corrupt, unavailable) with plain-words messages. Backup export/import (`backup.ts`) validates untrusted files and round-trips one person's data or everything. `BroadcastChannel` wrapper (`sync.ts`) tells other tabs when records, demo controls or sign-in change.
- **Reset and wipe (`lifecycle.ts`):** Reset demo clears records and demo controls and keeps display settings and sign-in; Wipe everything removes every `princess:` key, the sign-in and the database, then reloads. Both ask first. Me → Settings has Export my data, Reset demo and Wipe everything. There is no import screen yet; `parseBackup`/`restoreBackup` are ready for one.
- **Mock API (`src/api`):** typed `Api` with the twelve groups; the mock runs every call through one gate: offline switch, seeded delay, scenario faults (fail the first N calls, then recover), seeded random failure. Same seed and calls give the same outcome (tested). Groups start with the calls the first screens need and grow per phase.
- **Demo clock and sailings (`src/domain`):** one source of "now" (anchor plus speed, survives reload). Eight Sunday sailings Nov 2026 to Mar 2027 (reference 21 Mar 2027), the reference itinerary, twelve journey stages, and the ship clock changes (Eastern to Belize time overnight into day 4, back on day 7). Daylight saving comes from the tz database: on the reference sailing the ship clock moves two hours and Cozumel is an hour behind the ship, while on the 28 Feb sailing the move is one hour. `ThreeClocks` shows ship, port and phone time with the differences in words. Ship-clock timing is authored (verify).
- **Personas, auth and entitlements:** the twelve people with tier, package, stateroom and default text size; solo people see no one, families see only each other. Auth is an `AuthProvider` interface with a demo implementation (sign in as any of the twelve; per-tab session, last person remembered on the device). Each person keeps their own settings (`princess:settings:<id>`), so Gerald starts on Large and others on Standard. The entitlement engine (`computeEntitlements`, `balances`) combines package, Captain's Circle tier and Sanctuary class; figures are authored mock values.
- **Scenarios:** the fifteen §23.5 scenarios as a catalogue (stage, requirement ids, who it can be steered at; every person has at least two). Their fault rules work now; data effects arrive with the features in later phases.
- **Demo controls screen:** Me → Settings → Demo controls (`/me/demo`): switch person, three clocks, sailing and stage jump, step and speed, phone zone, scenario switches with "Show it", offline switch, response time and random failures.
- **Choices made:** demo controls and sign-in are not in the five tabs; the app signs in as Gerald on first run; data sync between tabs is by messages, with the database as the source of truth.
- **Verified:** `npm run test` (131 tests), `npm run lint`, `npx tsc -b`, `npm run build`.

## 12. Phase 1 progress notes

### Phase 1 done (2026-10-29): Discover the cruise and ship

- **Scope (requirements §22.6):** DIS-01 landing, DIS-02 seasonality, DIS-03 ship (one ship plus an "other Princess ships" teaser), DIS-04 sailing dates (no search, one cruise), DIS-05 itinerary detail, DIS-08 save and share (no compare list), DIS-11 price transparency. Quiz, alerts, reviews and the AI concierge stay in later phases.
- **Screens (all under the Home tab):** `/` landing (no account needed); `/home/cruise` route sketch, day-by-day plan with dock or tender, best time to go; `/home/sailings` eight dates with "from" prices and a "Lowest fare" tag; `/home/sailings/:id` dated plan and an estimate by room type and party size; `/home/ports/:id` port guide with "Getting ashore" (access, tender warning) first, things to do and sample excursions; `/home/ship` accessibility first, facts, highlights, stateroom types, other ships; `/home/saved`.
- **Content (`src/domain`):** `ship.ts` (profile facts, six illustrative room types), `ports.ts` (port guides, sample excursions), `cruise.ts` (cruise facts, date and time wording, route sketch positions), `pricing.ts`, `favourites.ts`. Prices and codes are authored mock values; the lowest interior fare is the profile's $1,539.
- **Pricing (DIS-11):** money is whole cents; every estimate is a list of lines (fare, third and fourth guest at 75%, solo supplement at 2x, taxes and fees, gratuities) that add up to the total, shown as a table with the per-person figure. Suites pay the higher gratuity. Unknown sailings, room types and party sizes are refused.
- **API:** new `discover` group: `offers`, `quote`, `favourites`, `toggleFavourite`. Prices work without signing in; saving needs a person (the app signs in as Gerald on first run). Saved lists are per person and sync between tabs.
- **No dead ends:** a failed price load says what happened, offers Try again and points to Help. A missing sailing or port says so and offers the way on.
- **Choices made:** the route sketch uses numbered stops with the legend in words (map text would not follow the text-size setting); Save uses `aria-pressed` with a fixed label; share uses the device share sheet where there is one, else copies the link, else shows it; there is no Book button until phase 3; the screens under Home before booking are replaced by the booked Home in phase 5.
- **Verified:** `npm run test` (162 tests), `npm run lint`, `npx tsc -b`, `npm run build`.

## 13. Phase 3 progress notes

### Phase 3 done (2026-10-29): Book

- **Scope:** BOK-01…08, BOK-18 and BOK-19, against the mock API. Not built (by the requirements): multi-cabin, insurance, FCC, promo codes, waitlist, agent handoff.
- **The funnel (`/book/:step`):** seven steps with a progress list and a screen-reader announcement: date, room, fare, guests, dining, review, pay. The step is in the address, so the browser Back button works. A step opens only when every step before it is complete; `/book` goes to the first unfinished one. Back never loses anything: every answer is a draft saved a moment after the last change (and on every Back or Continue). A failed save keeps the answers on screen and says so.
- **Finish later (BOK-01):** "Email me a link to finish later" sends a link by email or text (shown on screen, since nothing is really sent); `/book/resume/:id` reopens the draft, or says plainly when the link no longer matches (old, used, or another person's account). "Start again" asks first.
- **Date and room (BOK-03):** sailings that have left are shown but cannot be chosen, with the reason. Six room types with from-prices; a Signature Suite holds three. Guaranteed room or pick a stateroom from sample cabins grouped by deck with position, view obstruction and a step-free filter. The Sanctuary and Signature suites include Premier, so that is their only fare.
- **Fares (BOK-04):** Standard, Princess Plus, Princess Premier side by side with each all-in total and the difference. What each includes is read from the entitlement engine, so the two cannot disagree. A package replaces the gratuities line.
- **Guests (BOK-02):** names as on the passport, date of birth, gender marker, citizenship, needs, and contact and address. Checked against the sailing: babies at least 6 months, the person booking 18 or older, at least one guest 21 or older. Guests start from the account and are never overwritten. **Not built:** scan-to-fill passport; it needs on-device text recognition, which means a library, and a camera cannot be tested here.
- **Dining (BOK-18):** Anytime or fixed early or late, a special occasion, and an explicit dietary answer for every guest (none, or the list plus a note), so a skipped allergy is never just an empty box.
- **Review (BOK-05, BOK-08, BOK-19):** each choice with a Change link, the full price as lines, onboard credit shown apart from the price, the price held for 24 hours, the deposit or full plan, the cancellation table, and four documents (terms and ticket contract, health, minimum age, pregnancy) each with its own unticked box. Acceptances are logged with the document version and time, and shown on the confirmation.
- **Payment (BOK-06):** deposit (a fifth) or full; inside 90 days only full. One card, or two ways to pay (split), saved or new cards, and a device wallet button that appears only where the Payment Request API exists (it simulates the payment). The bank check (3-D Secure) opens only when the bank asks: for a new card or $3,000 or more. Demo values: code `123456`; a card ending `0002` is declined. Nothing is charged until the last button.
- **Safe booking:** the price the guest saw is sent with the booking, and a moved price is refused with nothing charged. Booking the same draft twice returns the first booking, so a retry cannot charge twice. A taken stateroom or closed sailing is refused with a way on.
- **Confirmation (BOK-07):** `/book/confirmed/:id` has the booking number, summary, receipts, where the email and text went (middle hidden), print or save as PDF, an add-to-calendar file (`.ics`, built in `domain/calendar.ts`), and what was accepted. **Add to wallet:** a boarding pass needs check-in, so the page says when it can be added.
- **Manage (BOK-08):** a booking made here shows as a trip (My Trips, trip page). The trip page has cancellation terms with today's row marked, **change the date** (free until the final payment date, repriced, paid amount kept, chosen stateroom kept if free) and **cancel** (fee and refund stated first; refund recorded; shown in Past trips as cancelled). `/book/pay/:id` pays the balance with the same payment panel.
- **API:** new `booking` group (`dates`, `rooms`, `cabins`, `fares`, `quote`, `prefill`, `draft`, `saveDraft`, `discardDraft`, `sendResumeLink`, `book`, `get`, `payBalance`, `changePreview`, `change`, `cancel`). Two new error codes, `challenge` (the bank's code is missing or wrong) and `declined`. Per-person drafts and bookings; changes appear in Recent changes.
- **Domain (`src/domain`):** `fares.ts` (fares, quote, pay plan, payment parts, bank-check rule), `booking.ts` (draft, step rules, validation), `cabins.ts`, `policy.ts` (cancellation, change, legal), `calendar.ts`; `parseMoney` in `pricing.ts`. Prices, fees and legal text are authored concept values.
- **Choices made:** the funnel is under `/book`, in the Home tab; "Book this cruise" is on Home, and "Book this date" on each sailing; a demo clock that has passed every date shows a banner with a link to demo controls; the cancellation schedule is authored (verify before real use); a date change is the only change offered (room, fare and guests changes go through cancel and rebook, or Guest Services).
- **Verified:** `npm run test` (285 tests), `npm run lint`, `npx tsc -b`, `npm run build`.

## 14. Phase 4 progress notes

### Phase 4 done (2026-10-29): Pre-book and personalise

- **Scope:** PRE-01, PRE-02, PRE-03, PRE-06, PRE-15, PRE-16, PRE-17, DIN-12, MNG-07, MNG-08, MNG-10 and the MNG-12 deadline tracker. Not built: PRE-04/05 (shows, spa), PRE-07 to PRE-14, MNG-06, MNG-09 as its own screen (weather is on the packing list), reminders as real notifications (the reminder date is shown, nothing is sent).
- **Where it lives:** `/plan` is the Plan tab (PRE-15): a checklist summary, links to every tool, and eight day cards showing booked tours and dinners with a gap line ("No excursion booked for this port") where nothing is booked. Tools: `/plan/excursions`, `/plan/dining`, `/plan/checklist`, `/plan/packing`, `/plan/travel`, `/plan/assistance`, and `/me/packages`. The trip page links to the Plan.
- **Excursions (PRE-01, PRE-02):** 12 tours over Cozumel, Belize City and Roatán, filtered by port, interest, activity level, price, family and wheelchair access. Each shows the time to be back at the landing; the check uses the all-aboard time and a longer buffer at the Belize tender port, so a tour that does not fit the ship's day is not offered. Cart, then checkout with the excursion credit first and the rest through the same payment panel as booking. Clashes (same person, overlapping hours), sold-out tours, duplicates, children without an adult and minimum ages are refused with the reason. Cancel is free until two days before the port day; guests can come off a tour, with a refund to the card first, then to the credit.
- **Dining (PRE-03, DIN-12):** five reservable restaurants and a table grid by night and time that fills at peak. The window rule is explained, not hidden: Platinum and Elite reserve from booking, everyone else after full payment, and the screen says when. Anytime Dining guests see no assigned time; a fixed-seating guest (Gerald) sees the Soleil time and cannot reserve the main room. Party members are chosen as companions; their saved dietary needs are passed on with the reservation. Package specialty dinners cover people first, and the rest is a cover charge paid on board.
- **Packages (PRE-06, PRE-16, PRE-17):** "What is included for me" per guest, with used and remaining dinners and the shared excursion credit, from the entitlement engine. Buying a package or add-on changes what the engine returns everywhere (the `folio` call uses it). Add-on prices move on a date; a purchase made before a rise shows "Your price is locked" and what it saves; before a drop it offers the credit once. "Is it worth it?" compares each option with paying as you go from the guest's own numbers. Add-ons cancel for a full refund until three days before sailing. Marcus and Gerald hold seeded purchases so both price states can be seen.
- **Checklist (MNG-07):** 14 items on the 90/60/30/14/7/1-day timeline. The app marks what it can see (payment, documents, tours, dining, assistance, travel plan, check-in); the guest ticks the rest.
- **Packing (MNG-08):** built from the season, the dress codes, the tender port, the booked tours, the party's ages and health needs. Ticks are saved, and the list can be shared as text or printed.
- **Travel (MNG-10):** port facts, four ways to get there, three suggested hotels (fictional), and arrival windows with a crowd level; priority guests get an earlier window.
- **Assistance (MNG-12):** nine kinds of request, each with its notice period and a countdown; a request made after the cut-off is passed on and marked "not guaranteed". A request records the need in the guest's profile and is confirmed a demo-day later.
- **API:** new `plan` group (overview, excursions, dining, packages, checklist, packing, travel, assistance). `createAuthoriser` is shared with booking. Shared by the whole booking (owner is the booker); supervised children can read but not change.
- **Choices made:** pre-booking works on the demo sailing's booking, not on a booking made through Phase 3; prices, cover charges, notice periods and hotels are authored (verify before real use); tour cancel terms are two days, add-on terms three.
- **Verified:** `npm run test` (345 tests), `npm run lint`, `npx tsc -b`, `npm run build`.


## 15. Phase 5 progress notes

### Phase 5 done (2026-10-29): Check-in and embarkation

- **Scope:** CHK-01 to CHK-05, CHK-08, CHK-12, and the promoted CHK-13, CHK-14 and CHK-15. Not built: CHK-06 (keycard tracking), CHK-07 (live terminal queue and push), CHK-09 (luggage tags), CHK-10 (immigration forms), CHK-11. **Passport scan is not built** (it needs on-device text recognition, which means a library, and a camera cannot be tested here); the document step is manual entry, which CHK-01 names as the fallback, and says so on screen.
- **Check-in (`/home/check-in`, `/home/check-in/:id`):** eight steps, six answered per guest (confirm, travel document, security photo, emergency contact, agreement, health questions) and two once for the booking (onboard card, arrival time), then Review and finish. Opens at midnight three days before sailing and closes at 10:00 on sailing day; before and after, the screen says why and points to the terminal. Every step saves on its own, so a lost connection loses nothing (the form stays filled and says it was not saved). A parent or guardian completes every step for a child; supervised child accounts can read progress but not change it. Shared answers (confirm, emergency contact, agreement) take a "do this for" list defaulting to everyone left, and the emergency contact is prefilled from the profile and then the person booking, so a family enters it once (A11Y-05). The arrival time is the same record as Travel to port.
- **Plain-language checks (CHK-03):** the domain says exactly what is wrong. Passport: kind, country, number shape, expiry, expired, or under six months past the return (offering a birth certificate and photo ID to US citizens, which is what Gerald meets). Photo: too small, wrong shape, too dark, too bright, blurry, all named together. Emergency contact: name, phone, relationship, or someone who is sailing. Only the last four characters of a passport number are kept.
- **Security photo:** measured on the device (`measurePhoto`: size, mean brightness, mean edge strength on a shrunken copy) and judged by `judgePhoto`; the API judges the same numbers again. The picture is never uploaded or kept. Demo buttons stand in for a good, dark and blurry photo because a laptop may have no camera. **The file picker and canvas measuring are not covered by tests** (no browser testing); the judging logic is.
- **Boarding pass (`/home/boarding-pass`, CHK-04, CHK-14):** one pass per guest with a QR code drawn on the device (`qrcode` package, one SVG path, always black on white), boarding group (Priority, or by arrival window), lane (Green when check-in is finished, else Blue), stateroom, muster station and terminal. A full-screen bright view keeps the screen awake where the browser allows; **a web page cannot raise screen brightness**, so it asks the guest to. "Add to wallet" is a pretend wallet (a saved flag). Print or save as PDF uses the browser print dialog. A "what if my phone dies" card covers saved copy, paper, booking number, desk and keycard.
- **Offline (CHK-04, CHK-13, CHK-14):** every good pass, receipt and embarkation answer is kept in `localStorage` with its time (`domain/offlineCache.ts`, `hooks/useSavedCopy.ts`). If the call fails and a copy exists, the copy shows with an "offline since" chip; the contents are checked (`api/guards.ts`) before being trusted. The `phoneDead` scenario therefore leaves a pass that was opened earlier still showing.
- **Pass without signing in (`/home/find-pass`):** booking number plus the last name of any guest, the same answer for any mismatch. It works for the demo people's bookings on the demo sailing. The last pass found is kept on the phone.
- **What we have on file (`/home/check-in/receipt`, CHK-13):** each item per guest and for the booking, with what it was ("Passport ending 4567, United States"), when it was saved, and a Correct or Add link. A "Not saved" badge shows where something is missing.
- **Terminal fallback (`/home/check-in/terminal`, CHK-08):** what to bring, what happens in order, and what the Blue lane is.
- **Embarkation day (`/home/embarkation`, `/home/embarkation/steps`, CHK-05, CHK-12, CHK-15):** arrival window with a wait guide and traffic guess (from how busy the window usually is), terminal and change alert, address and a map link (opens an external map), bags with the porters (delivered three hours later and not before the staterooms open), "your stateroom is ready" at 1:00 pm, document readiness per guest, a nurse note when someone answered yes to a health question, a carry-on checklist, and the first afternoon. The companion shows one card at a time (terminal, security, photo, gangway, muster, cabin) and remembers where the guest is. Priority guests get the terminal from 10:30.
- **Home (`/`):** replaced the Discover landing for a booked guest with "Your next step": the existing next action (payment, documents, check-in), the boarding pass once check-in is done, or the terminal when check-in has closed; the cruise to browse sits below. Check-in is now the target of the trip's "Check in" action.
- **API:** `checkin` group grows (`view`, `save`, `receipt`; `submit` now refuses until everything is done: `conflict:incomplete`), new `boarding` group (`pass`, `lookup`, `addToWallet`, `embark`, `setCompanion`, `setCarryOn`, `setBags`). Check-in state `closed` added. Scenario `checkinDrop` now drops the first step save as well as the final submit; new scenario `terminalChange` moves the terminal to Terminal 4.
- **Domain (`src/domain`):** `checkin.ts` (steps, validation, progress), `boarding.ts` (assignment, group, pass text, embarkation rules), `offlineCache.ts`. Terminal, times, wait guides, groups and the stateroom pick are authored concept values (verify before real use).
- **Choices made:** check-in applies to the demo sailing's booking, not to a booking made in Phase 3; the agreement is the booking terms in the version in force; a health "yes" never blocks check-in; the stateroom for a booking is a stable pick from the free sample staterooms of its room type (a step-free one for a guest with a mobility need).
- **Verified:** `npm run test` (403 tests), `npm run lint`, `npx tsc -b`, `npm run build`.


## 16. Phase 6 progress notes

### Phase 6 done (2026-10-29): Onboard core

- **Scope:** OB-01 to OB-04, OB-08, OB-09, SAF-01, SAF-02, DIN-01, DIN-02, DIN-10, POR-01 to POR-04, POR-11, POR-12 (links and tender assistance), ACC-01, MSG-01, MSG-02, SUP-08 and offline for all of them. Not built: OB-05 to OB-07 (busyness, ship info, content search), SAF-03 onward (Phase 7), waitlists and virtual queues (the screen says so), photos in chat, push notifications (reminders are set and shown; nothing is sent to the phone, and the screens say so), a graphic deck plan, the muster video file, "you are here" (a web page cannot know where on the ship it is; the deck map says so first).
- **Home on board (`/`, OB-01):** once the stage is embarkation to the last evening, Home becomes today: day, place, weather, sail-away time, a clock-change warning the evening before (two hours in March, because the US is on daylight time and Belize is not), the muster banner until everyone has checked in, the all-aboard card on port days, what is on now and next, tonight's table, and quick links. Before and after the cruise Home is unchanged.
- **Planner (`/plan`, OB-02, OB-09):** while aboard, the Plan tab opens with today's plan: any of the eight days, "on now" and "next up", filters (interest, kids/teens/adults, step-free, included or extra cost, not over yet, only my plan), sort by time, place or deck, add to my plan (a fixed-label toggle with `aria-pressed`), an overlap warning and a banner for changes (OB-08: in the plan-change scenario a show moves 45 minutes and trivia is cancelled, each with its reason). One column, ship time throughout. A supervised child can read but not change the plan.
- **All aboard and port day (`/ship/port`, POR-02, POR-04, POR-11):** the deadline in ship time with the local equivalent, a countdown that changes level at two hours and 30 minutes and after the deadline (past it but before sailing, then "the ship has left"), the three clocks, reminder points, and four steps if running late. Tender: ticket group (ship tours first, then priority and assistance, then four numbered groups), call time in ship and local time, status and wait estimate, last tender back, a delay in the Belize scenario (every group moves, all-aboard does not), and "may switch to tender" for Roatán in the weather scenario. The day's booked tours show meeting point, return time and a QR code per guest, drawn on the device. A skipped port (scenario) is said first, with a way to Guest Services.
- **Reservations (`/plan/reservations`, `/plan/reservations/:id`, DIN-02, DIN-10):** dinners and tours in one list; each dinner opens to change, cancel, or "running late". A move checks everything about the new table first (full, clash with another table, closed, unchanged) and then writes once, in place, so the original is never lost or doubled and a refusal says "Nothing was changed. Your table is still…". The first move fails once in the reschedule scenario and works on retry. Each change appears in a list the guest can read (the account history). Dining stays open for booking on board until the night itself has passed; dinner times are on the ship's clock for that night.
- **Restaurants and bars (`/ship/venues`, `/ship/venues/:id`, DIN-01, DIN-03):** twelve places with hours for a sea day and a port day, open now, price (included, specialty cover charge, or small charge), dress code and a menu where every dish says what it contains. The guest's saved diets hide what does not suit; halal and kosher cannot be promised from a label, so the screen says to ask the maître d'. All of it is bundled, so it works offline.
- **Deck map (`/ship/map`, OB-04):** search by name, kind or deck; each deck as a table of forward, midship and aft; the six elevator banks, the six muster stations and step-free marks with notes where a place is not step-free. Text first, so it works with a screen reader, at the largest text size and offline.
- **Safety (`/ship/muster`, `/ship/emergency`, SAF-01, SAF-02, SUP-08):** the muster page names the station (the same as the boarding pass), the nearest lift bank (the letters match), opens check-in an hour before the drill and checks in every adult and child on the booking (a parent does it for children), the briefing in English, Spanish, French, German and Chinese with the right `lang`, and ways to take part if the usual way does not work. The emergency card shows the numbers to call, what to say, stateroom, deck and station, Medical Center hours by sea or port day, and the four urgent non-medical problems (key fails, locked out, missing child, lost documents), each with its own number and none relying on chat. The Help sheet carries the same list and links to the card. The card is also kept on the phone with its time. The 911 shown is for a ship phone only; the button calls the ship's line, never a real emergency number.
- **Chat (`/chat`, MSG-01, MSG-02):** "My group" is free chat with the booking and linked people, with optional read receipts that work both ways (you see who has read your messages only if you share yours). "Guest Services" has five topics, each with its usual reply time and a queue position while waiting; replies are simulated by time on the demo clock; medical says plainly it is not for emergencies. In the slow scenario the first send times out and keeps the text, replies take five times as long, and a phone-call form appears; asking for a call records a call-back and says so in the thread. Supervised accounts can read but not write to the crew.
- **My bill (`/me/bill`, ACC-01):** every charge, credit and package saving with a running total, search, and filters by type, person and "paid by a package". Gratuities run each night unless a package covers them; a package pays a drink up to its cap and the guest pays the difference; the bar service charge shows as its own line; specialty dinners add the cover charge once the dinner time has passed; Ruby and above get a welcome credit. Amounts are authored and the same every time for the same booking. A supervised child cannot see the account.
- **Offline (OB-03):** today, the day's plan, reservations, port day, muster, emergency card and bill are kept on the phone after every good answer (`useSavedCopy`) and shown with their age and an "Offline" banner when the call fails; the copies are vetted by `api/guards.ts` before they are trusted, and "no more port days" is stored as a real answer so the screen never waits for it. The deck map, menus, hours and the emergency numbers are bundled in the app.
- **API:** new `onboard` group (`today`, `program`, `togglePlan`, `portDay`, `muster`, `confirmMuster`, `emergency`, `folio`) and `service` group (`channels`, `thread`, `send`, `escalate`); `plan.dining` gains `move` and `late`; `messages` gains `receipts`, `setReceipts`, `markSeen`. The reschedule and slow-chat scenarios now also fail the new calls.
- **Domain (`src/domain`):** `deck.ts`, `program.ts`, `menus.ts`, `allaboard.ts`, `safety.ts`, `folio.ts`, `chat.ts`; `shipZoneOnDate` in `sailings.ts`. Events, hours, dishes, groups, waits, reply times and prices are authored concept values (verify before real use).
- **Found while testing:** the next-reminder point was the wrong one, a delayed tender showed "not started", and a dinner's time was read on New York's clock instead of the ship's; all three are fixed and covered.
- **Choices made:** the planner is on the Plan tab and Home, not a tab of its own, to keep the two-tap budget; the Ship tab leads with safety; a reservation keeps its address when moved; chat with the crew needs an adult account; "Locked out" and "missing child" are phone-first on purpose.
- **Verified:** `npm run test` (507 tests), `npm run lint`, `npx tsc -b`, `npm run build`.

## 17. Phase 7 progress notes

### Phase 7 done (2026-10-29): Onboard extended

- **Scope:** DIN-04, DIN-05, DIN-11 (ordering), SAF-03, SAF-05 and ENT-04 (family and clubs), SAF-08 (medical help now), ROM-01 to ROM-03 and ROM-05, SHP-02, SHP-03, SHP-07, NET-02. **Not built:** ENT-01 ticketing, ENT-02, ENT-03 (spa), ENT-05 to ENT-09, SHP-01, SHP-04 to SHP-06, ROM-04 (a web page cannot unlock a door), ROM-06, NET-03 (offline outbox) and NET-04 (data-light mode). Chat already keeps unsent text on failure.
- **Ordering (`/ship/order`):** three kinds: deck and stateroom delivery, room service, and scheduled breakfast (two hours' notice, cancellable before it starts). Customise with extras, order for any guest on the booking (alcohol only for 21+), drinks packages pay up to their cap per drink and say so, bar service charge on alcohol, delivery fee away from the stateroom, optional tip. Location is the stateroom, a deck place, or described in words (a web page cannot find the guest). Status runs received, preparing, on the way, delivered with an ETA from the demo clock. **Resilience (DIN-11):** an item out of stock is flagged on the menu with a swap offered; in the `orderStock` scenario another item runs out in the kitchen, the order's clock stops, and the guest swaps it or takes it off without losing the rest. Cancel gives a full refund until cooking starts. The location can be corrected until delivery. "Contact Guest Services about this order" is recorded. While anyone on the booking is isolating for illness, meals and delivery are free. Orders appear on the bill, cancelled ones with a refund line.
- **Family (`/ship/family`):** per child: last seen (club check-in or the simulated band), parent-set allowed places with an outside-the-places notice, club check-in and check-out by age and opening hours, who may collect, whether the child may sign out alone (only from the club's age), photo consent, a log, and a meeting plan with a backup. In the `childMissing` scenario the youngest child is overdue and the screen is phone-first. Supervised children can read, and can sign themselves out only where allowed.
- **Health (`/ship/health`, `/ship/help-now`):** Medical Center hours by sea or port day with open-now, fees and insurance reminder, an illness notice in the `illness` scenario, a report flow with isolation guidance, and requests for seasickness help, medicine and device power. Reports are stored under the reporter, never in the shared account history. Help-now has very large buttons, the numbers, the words to say with stateroom and deck, and steps for chest pain or a fall.
- **Stateroom (`/ship/room`):** card kept on the phone, steward, Do Not Disturb and Make Up Room (a steward check after 24 hours of Do Not Disturb), cleaning time and turndown, and demonstration controls for lights, temperature, TV and shades. Settings belong to the stateroom.
- **Photos (`/ship/photos`):** browse by day, place and person, favourites, photographer schedule, choose first, then see each way of buying priced for the choice with the cheapest marked; Premier's included photos are used first. Downloads are in batches of five, retried automatically, kept across failures (`photoFail`), counted ("12 of 12 saved") and checked, with a re-download window of 14 days after the cruise. No picture previews exist, so photos are described in words.
- **Laundry (`/ship/laundry`):** wash and fold, pressing, dry cleaning with pick-up windows that return in time, tracking, cancel before collection, and a free first bag for the laundry perk. Charged when collected.
- **Wi-Fi (`/ship/wifi`):** plans, devices, a usage meter, upgrades priced for the days left, included devices from the package or tier, and sign-in help. The app itself never needs a paid plan.
- **API:** new groups `family`, `health`, `room`, `laundry`, `wifi`; `orders` and `photos` replace their placeholders. Everything sold on board needs the ship to be boarded (`conflict: closed`). Folio gets `extraLines`.
- **Domain (`src/domain`):** `orders.ts`, `family.ts`, `health.ts`, `room.ts`, `photos.ts`, `laundry.ts`, `wifi.ts`. Menus, prices, hours, ages and plans are authored concept values (verify before real use).
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`.

## 18. Phase 8 progress notes

### Phase 8 done (2026-10-29): Disembark and post-cruise

- **Scope:** DEB-01 to DEB-08, POS-01, POS-02, POS-04 (link to the photo window), POS-05, POS-06 and its §23 extension, POS-07, POS-08, POS-11, POS-12, POS-14. **Not built:** POS-03 (trip recap, Phase 9), POS-09, POS-10 and POS-13 (could-haves).
- **Getting off (`/home/disembark`):** the key times (ship ties up, stateroom empty, bags out and choose by 10:00 pm, last time to change the gratuity), three ways to leave: bags outside the stateroom with a tag colour and number, carry your own bags (from 7:30), or an early walk-off (from 6:30). Priority-disembarkation guests are Gold 1; everyone else gets a steady Blue to Purple group. Bags are counted per guest, the tag text is shown ("GOLD 1 · HARPER/DANIEL · 8421"), and the guest says when the tags are on. A guest who asked for help getting around is pointed to the tag option. The choice closes at 10:00 pm; after that the screen shows the choice made.
- **Customs (`/home/disembark/customs`):** what to carry and what to declare, and one digital declaration per family (food, cash over $10,000, goods against $800 each). It says what to tell the officer.
- **Onward (`/home/disembark/onward`):** cruise transfer, ride-share, hotel shuttle or the garage, a flight time and number, and a check of whether the flight can be made from when the guest leaves the ship (45 minutes to clear, the ride, three hours at the airport). It says "works", "tight" or "too early" with the earliest flight that works and a way to change how they get off.
- **Final night (`/home/disembark/final-night`):** nine items with due times; choice, customs and tags tick themselves; the rest the guest ticks. Late and due-soon are words, not colour alone. Home shows the next item from the farewell day on.
- **Final bill (`/me/bill/final`):** what is owed and to which card, the daily gratuity (keep all, 75%, 50% or none until 8:00 pm; the credit appears on the bill), a way to query a charge (opens a bill case), receipts to print or email, and whether anything is still being queried.
- **Cases (`/me/cases`):** lost items, damage claims, complaints and bill queries share one flow. A case has a number ("PC-LF-48213"), a due date (72 hours for a lost item or complaint, 5 days for a bill query, 10 for a claim, 48 hours for service recovery), a stage by the clock, and an answer that is the same every time for the same case: an item found or not, a refund sent to the card three days after the answer, half of a claim offered, or a credit.
- **Feedback (`/me/feedback`):** one overall rating, then optional ratings by area, a comment and up to three crew to thank by name (the stateroom steward is suggested). The two consents (the ship's team may see the comment with the name; a person may contact the guest) both start off, and the data-use disclosure is on the screen. A rating of 2 or below, overall or in any area, opens a service-recovery case only if the guest allows contact. Changes allowed for 14 days.
- **Loyalty (`/me/loyalty`):** level before and after this cruise (days to Gold 5, Ruby 30, Platinum 90, Elite 150), progress to the next, what the level gives, and a referral code with a share button. A level is never lost.
- **Rebook (`/me/rebook`):** dates after this cruise, priced for the same room type and party. Holding on board gets a $100 deposit each and onboard credit (a $100 booking credit plus a credit for the level), posted to the bill and taken off again if the hold is released. A hold keeps its price for 7 days and can be released. Future cruise credit pays toward the deposit, or is changed to onboard credit on board. A Future Cruise desk appointment can be booked on a sea day, moved and cancelled. Price protection is stated.
- **Also:** trip history with receipts and tax summaries (`/me/history`), caring for the sea (`/me/sustainability`). The Home screen shows a "Welcome home" list after the cruise, and Me has an "After your cruise" group.
- **Offline (DEB-08):** the plan, customs, onward and checklist screens are kept on the phone and open with no signal, with the age of the copy shown.
- **API:** new groups `disembark`, `cases` and `post` (`src/api/finishMock.ts`; shapes in `src/api/finishTypes.ts`). Folio gets the gratuity credit, converted credit and onboard booking credit. Deadlines answer `conflict: deadline`; an action before boarding or before leaving the ship answers `conflict: closed`.
- **Domain (`src/domain`):** `disembark.ts` and `postcruise.ts`. Four next-season departures (`FUTURE_DEPARTURES` in `pricing.ts`) can be held but not booked; they are not in the sailings list.
- **Choices made:** a hold keeps a price and an offer but does not take a payment; the "Continue to book" link goes to the Phase 3 funnel for dates that are open to book. Query amounts are sent by the screen from the bill line (the mock does not look the line up again). The photo download window stays at 14 days (Phase 7); POS-04 is a link to it from the history. Tax summaries, receipts and the other documents are listed, not generated as files. Hours, groups, allowances, credits and the sustainability figures are authored concept values (verify before real use).
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`.

## 19. Phase 9 progress notes

### Phase 9 done (2026-10-29): AI concierge and delight

- **Scope:** DIS-09, SUP-03, PRE-12 and POS-03. No new dependency.
- **Ask the concierge (`/home/concierge`):** a chat that is labelled as AI at the top and on every answer ("Concierge (AI)", "built-in helper", or "please talk to a person"), says it can be wrong and cannot book, pay or change anything, and shows which screens an answer came from as links. The conversation is kept on the device for the signed-in person, trimmed to 60 messages, and cleared from a confirm dialog. Linked from Home and from Contact us.
- **Grounding (`src/ai/tools.ts`):** seven tools over app data (sailings and prices, itinerary, port guide, excursions, restaurants, build a day, the guest's own trip). Each returns its screen as a citation. Bad input answers with an error the model can read. The prompt tells the model the app has one cruise, so a request such as a 7-night Alaska trip gets an honest "this app covers one cruise".
- **Guardrails (`src/ai/guard.ts`):** a message about an emergency, a medical or legal question, or a request for a person never reaches a model: the app answers with the right numbers and links (emergency card, Health Center, Contact us, chat). A handoff offers "Send this conversation to Guest Services", which opens a support request with the last eight messages, so the history travels with the guest. Messages are capped at 500 characters, 12 are sent as context, and 20 questions an hour go to the model.
- **The key (`src/ai/concierge.ts`):** `VITE_ANTHROPIC_API_KEY` from a git-ignored `.env.local`, and `VITE_ANTHROPIC_MODEL` (default `claude-sonnet-5-5`). The key is visible in the browser bundle of any build that has one; a server-side proxy remains the later hardening step (requirements §22.2). With no key, offline, over the limit, or on any API failure, the scripted helper (`src/ai/scripted.ts`) answers from the same tools and the screen says why. The CSP allows `https://api.anthropic.com` in `connect-src`.
- **Client (`src/ai/client.ts`):** the Messages API over `fetch` with the tool loop (at most 5 steps). The SDK was not added.
- **Build my day (`/plan/day`, PRE-12):** pick a day, tour interests, ship interests, how you get around and whether children are along. A port day gets the best-rated tour that fits the all-aboard time (with the time to be back), one ship event and dinner; a sea day gets up to three events at least an hour apart. Wheelchair and easy settings use the same access data as the Excursions screen. The same planner is the concierge's `build_day` tool (`src/domain/day.ts`).
- **Trip memories (`/me/recap`, POS-03):** the route map, nights, ports, sea days, nautical miles, photos, tours taken, dinners and the favourite table, with a share-or-copy button (Web Share where it exists, else the clipboard) and a text that carries first names only (`src/domain/recap.ts`). Linked from Me and from the Home "Welcome home" list. **Not built:** a video or story export.
- **Choices made:** history lives in the shared IndexedDB store under kind `concierge`; the hourly limit counts the guest's own messages on the demo clock; the tools never return the guest’s email, phone or card, so the model sees only what the guest types; a model-written answer is plain text, not formatted.
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`. The real API call was not run (no key, and no network testing here); it is covered by tests with a stubbed `fetch`.

### Phase 10 done (2026-10-29): Hardening

- **Scope:** performance, accessibility audit, security review, observability, and the UX-01 task-path check. No new dependency.
- **Performance:** every screen except Home loads on its first visit (`src/screens.ts`, `src/screen.tsx`), behind one "Loading…" status in the shell. The first-load script fell from 1,062 kB (304 kB gzip) to 269 kB (82 kB gzip). The service worker still precaches every file, so each screen works offline once the app has been opened online. A visited screen never suspends again. Tests call `preload()` so screens render in one pass.
- **Accessibility audit (`src/ui/a11y.test.tsx`):** on all 75 screens: one `h1`, one `main`, the skip link, no duplicate ids, every `aria-labelledby` resolves, images have `alt`, and buttons, links and form fields have names. It found a real fault, a duplicate `trip-h` id on Me, now fixed. Contrast (`contrast.test.ts`), dialog focus and Escape, text size and reduced motion were already covered. **Not done:** a screen-reader pass on a device and a keyboard walk in a browser (the project rules exclude browser testing), so those remain to do by hand.
- **Security review:** no `innerHTML`, `eval` or `dangerouslySetInnerHTML` anywhere; the one new-tab link has `rel="noreferrer"`; the CSP allows scripts from this origin only and two other hosts (Princess images, the Anthropic API); and the key is read in one file. `src/security.test.ts` keeps these true. **Open, as before:** the `VITE_` key is readable in any build that has one, so a server-side proxy is needed before this is public (requirements §22.2). Model output is shown as plain text.
- **Observability (`src/diagnostics`):** uncaught errors, unhandled promise failures, a screen that crashes and a page load over 4 seconds are noted in a 30-entry log on the device. Web addresses, e-mail addresses and long numbers are removed from each line, and no stack is kept. Settings has a "Problem log" card to read, copy for Guest Services and clear. Nothing is sent, because there is no backend; the log is wiped with "Wipe everything".
- **Task paths (UX-01):** the existing check in `render.test.tsx` and `navProblems()` still holds for all 15 tasks within two taps.
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`.

## 20. Phase 11 progress notes

### Phase 11 done (2026-10-29): Close the Must gaps that need only code

- **Scope (from `docs/gap-analysis-plan.md`):** ACC-02, ACS-01, ACS-02, ACS-06, DIN-02, ENT-01, INC-01, SUP-06 with SAF-06 and MNG-15, ACT-06 with SEC-03 and SEC-04 (part), PERF-02, PERF-04 and NET-03 (part), PERF-08. **Deferred by your answers:** the offers area (UX-02, CNT-02, NOT-04), any server (Phase 15), and media (the muster video and a graphic deck plan stay text). No new dependency.
- **Spending budget (`/me/bill`, ACC-02):** a limit for the booking, a warning level (50, 80 or 100%), and an optional limit for each child. It only warns: a note on the bill and on Home when spending is close or over, and the screen says the ship still takes every charge. What a package or the fare paid, and credits, are not spending. Only an adult changes it (`src/domain/budget.ts`, `BudgetCard.tsx`).
- **Changes to your trip (`/home/updates`, SUP-06, SAF-06, MNG-15):** each active scenario that changes the trip (port skipped, tender, plan change, clock change, terminal, health notice) is a notice with what changed (was and now), the choices, any offer, and a record of what the guest chose and when. The record stays after the change ends. A banner on Home shows the most serious unacknowledged notice. A supervised child can read but not choose. Notice texts are authored (`src/domain/disruption.ts`).
- **Show and class seats (planner, ENT-01):** eleven shows and classes have seats. The planner shows seats left, sold out, your own seats, and reserve or give back until the event starts. Children cannot take seats for adults-only events; nobody holds two seats for the same event. Three events are always full so the sold-out state can be seen. Seats are free (`src/domain/tickets.ts`).
- **Virtual queue and waitlist (DIN-02):** walk-in places that are open now have a virtual queue (about six minutes per party, a ten-minute hold, then released). A full table time can be waitlisted: after three hours (sooner if the time is near) the table is offered, the offer lasts two hours or until 15 minutes before, and taking it books through the normal reservation path. The reservations screen lists both. Positions move with the demo clock (`src/domain/queue.ts`).
- **Find the way (deck map, ACS-02):** directions between two places in words: walk, lift bank and decks, walk again, with a minute estimate and a "step-free only" switch that names the place with steps and suggests a step-free one of the same kind. Ports are linked (the port screens already hold the accessible routes) (`src/domain/route.ts`).
- **Paper copies (`/me/print`, INC-01, ACS-06):** daily plan for any day, itinerary, excursion tickets, and a "without the app" sheet that gives a desk or phone way for each of the 15 top tasks (a test fails if one is missing), each with a large-print option and the browser's own print or save as PDF. Only the chosen sheet prints.
- **Simple view and captions (Settings, ACS-01):** simple view gives one column, bigger targets and hides secondary links. Captions and transcripts is saved and applied wherever media has them; the app has no video yet, so today it has no visible effect and says so.
- **Privacy and data (`/me/privacy`, ACT-06, SEC-03, SEC-04):** what is kept and for how long (ID details and the security photo 30 days after the cruise, health reports 90 days, the rest until deleted), with the date for each. Past a date, the records are deleted on the next visit, once, and noted. An access log notes passport, photo and document views, saves and deletions. Consents all start off; an adult decides for themselves, a parent for a child, and a child under 13 is asked for nothing but photographers and a parent's agreement. A storage notice says there are no cookies or trackers. "Delete my data" is the existing wipe with a confirm. **Not done:** encryption at rest, region rules, a real parental-consent flow (the agreement is recorded, and nothing yet depends on it).
- **Resilience (PERF-02, PERF-04, NET-03, PERF-08):** a new version downloads quietly and a banner asks before switching (`registerType: 'prompt'`), so nothing is lost. Every screen load and every action now stops waiting after 20 seconds with a retryable timeout, so the saved copy shows instead of a spinner. Chat messages and Guest Services messages that cannot be sent are held (with backoff of 2 s doubling to 60 s, and at once when the phone comes back online) and shown as "waiting to send"; they survive a reload. All repeating timers now go through one visibility-aware interval, so polling stops when the page is hidden, and a test checks it. **Not done:** retries for loads (they are manual), optimistic updates, the outbox for requests other than messages.
- **API:** new groups `budget`, `shows`, `waits`, `updates` and `privacy` (`src/api/careMock.ts`, shapes in `src/api/careTypes.ts`). The dining reserve has an internal path that the waitlist uses to take an offered table.
- **Choices made:** the print rule that hides everything but the chosen sheet is scoped to the Paper copies page, so other screens print as before; a waitlisted table is taken through the normal reservation rules (window, clashes, age) except that it may be full; a call that times out may still have finished on the server, so retried actions are written to be safe to repeat (messages are the only deferred action today).
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`.

## 21. Phase 12 progress notes

### Phase 12 done (2026-10-29): Should gaps, on board

- **Scope (from `docs/gap-analysis-plan.md`):** OB-06, OB-07, SAF-04, MSG-01 (photos), MSG-03, MSG-05, DIN-06, DIN-09, ENT-03, ENT-05, ENT-06, POR-05, POR-07, POR-13, ACC-03, ACC-05, ACC-07, SHP-01, SHP-04, SHP-06, ROM-06, ACS-04, SUP-04, SUP-05, NET-04 and PERF-05 (part). No new dependency.
- **Ship news (`/ship/info`, OB-06):** the captain's announcement for the day and a noon report: position (miles to the next port, or in port), speed, sky, air and water temperature, wind and waves. Every figure is an authored value, the same for the same day, and the screen says so (`src/domain/shipInfo.ts`).
- **Search (`/ship/search`, OB-07):** one box over venues and their dishes, events, places, services and shops, tours, ports and screen names. Every word must match; accents and case are ignored; title matches come first; fewer than two letters shows nothing (`src/domain/searchIndex.ts`).
- **Bookings and orders (`/ship/spa`, `/ship/shops`, `/ship/community`, `/ship/access`, ENT-03, SHP-01, SHP-04, SHP-06, ACS-04):** one catalogue (`src/domain/catalogue.ts`) with three modes: book a day and time (spa, salon, fitness), order for pickup (shop goods, gift cards, bingo books), or mark "I'm going" (auctions, services, meet-ups, captioned and signed shows). Places left are the same every time and reduce as you book; a time that has passed, an age limit and a sold-out slot each give their own message. Paid picks go on the onboard account (`spa` or `shops` lines on the bill). A supervised child can read but not pick. Product sales at the spa are a note, not a catalogue.
- **Cabin requests (`/ship/requests`, MSG-03):** ten one-tap requests (towels, pillows, bedding, toiletries, ice, turn-down, light, air conditioning, plumbing, TV). Status moves with the clock (received, on the way after half the usual time, done) and a request can be cancelled only while it is merely received. One open request per item, six at a time.
- **Security report (`/ship/report`, SAF-04):** five kinds. "Someone may have gone overboard" opens with the emergency number first and cannot be anonymous. Others may ask for the name to be withheld. A reference is shown. A supervised child may report.
- **Drinks tracker (`/ship/drinks`, DIN-06):** a bar menu with a "I had this" button, drinks today, how many the package covers (up to its price limit, 15 a day), what was not covered, and a nudge at four alcoholic drinks in three hours and a stop at six. It does not charge anything: the bar's own bill does. Alcohol is refused for under 21s.
- **Group table (reservation detail, DIN-09):** friends are added by name and cabin (up to eight at the table) and the bill can be split evenly with shares that add up to the cent. Friends are notes, not linked accounts, and nothing is sent to them.
- **Money (`/me/money`, ACC-03, ACC-05, ACC-07):** top up by card (at once) or cash (counts two hours after it is handed in), both as credits on the bill, to $2,000 a cruise; set or change a four-digit PIN that is not stored as typed and rejects easy ones, with "I forgot" asking the desk; prepay gratuities by card (a credit equal to the amount due) or ask to remove them with a reason, which waits for a manager; show amounts in USD, EUR, GBP, CAD, MXN, BZD or HNL at sample rates, with an "about" note on the bill total. **Not done:** a real reset of a forgotten PIN, real exchange rates, and the manager's reply to a removal request.
- **Port day (`/ship/port`, POR-05, POR-07, POR-13):** last-minute tours on the day of the port (open until two hours before the start, with places left and a "sold out" state, charged to the onboard account and shown with the other tours), the consulate, local emergency number and ship's agent for each port, and a ready-for-the-port checklist per day with one-tap sharing (the share sheet, or copy).
- **Games (`/ship/games`, ENT-05):** a six-clue scavenger hunt, six trivia questions (one answer each), a bingo card that is the same for the same person with the numbers called so far marked, and four badges. Progress is kept per person.
- **Cabin TV (`/ship/tv`, ENT-06):** a remote (power, channel, volume, mute), a channel guide by time of day, six on-demand titles with age ratings, and a casting form. It changes a saved setting; it does not reach a real TV.
- **Cabin parties (Services and meet-ups, ROM-06):** up to six cabins, no later than 11 pm or earlier than 8 am, by an adult 21 or over. Each cabin's answer is worked out the same way every time (the invitees do not have accounts here).
- **Status and feedback (`/me/status`, `/me/report-problem`, SUP-04, SUP-05):** a status page that reads the demo scenarios (and the offline switch), with what to do meanwhile; and a note form with a kind, text, the problem log (only if ticked) and a screenshot picked from the phone (JPEG, PNG or WebP under 1 MB). Notes are kept on the device in the concept.
- **Chat (MSG-01, MSG-05):** photos (JPEG, PNG or WebP under 1 MB, adults only) show in the party chat; any message from someone else can be reported (four reasons) or the person hidden, with a way to bring them back; under-18s cannot pass on a phone number or a link; messages are kept for 30 days after the cruise, which is said on the screen. **Not done:** server-side moderation, scanning of photos, age checks beyond the account, and enforcement of the 30 days.
- **Data-light mode (Settings, NET-04, PERF-05):** one switch. Chat photos wait until asked for, animation and background images stop, and every repeating refresh runs a quarter as often. Images use `loading="lazy"` and `decoding="async"`. **Not done:** image-format conversion (the app has one kind of image, the chat photo), and automatic switching on a "save data" signal.
- **API:** one new group, `aboard` (`src/api/aboardMock.ts`, shapes in `src/api/aboardTypes.ts`), with `selections`, `requests`, `reports`, `drinks`, `money`, `parties`, `groups`, `games`, `tv`, `lastMinute`, `ready`, `chat` and `feedback`. Folio gains an `excursions` category. Last-minute tours are saved as ordinary tours, so the port day, tickets and cancellation treat them like any other.
- **Choices made:** drinks are a diary, not a charge, so nothing is billed twice; prepaid gratuities are a credit on the bill rather than a change to the daily lines; the catalogue, bar menu, games and TV guide are authored in the domain modules, as the venues and events already are.
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`. Not tried in a browser, by the project rule.

## 22. Phase 13 progress notes

### Phase 13 done (2026-10-29): Should gaps, before and after booking

- **Scope (from `docs/gap-analysis-plan.md`):** DIS-06, DIS-15, DIS-16, BOK-11, BOK-12, MNG-06, MNG-09, MNG-13, MNG-18, MNG-19, PRE-04, PRE-05, PRE-07, PRE-08, PRE-10, PRE-11, PRE-14, CHK-06, CHK-09, CHK-10, SEC-07, SEC-08, CNT-05, ACT-08 and SUP-07. No new dependency.
- **Find my cruise (`/home/quiz`, DIS-06):** five questions (vibe, spend, who, mobility, must-haves) give a ranked shortlist of up to three room types with the reasons, a package and notes (accessible rooms, the Belize tender port, the clubs). Same answers, same list. Adults-only suites are never offered to a family (`recommend` in `src/domain/ahead.ts`).
- **Travel advisors (`/home/advisors`, DIS-15):** five made-up advisors, filtered by speciality and language. A chat gets a scripted reply at once; a call-back is promised within 24 hours and also raises the usual call-back ticket.
- **Marketing consent (`/me/marketing`, DIS-16):** off by default, per person and per channel. Where the region needs it (Canada, the UK, the EU) the first step only sends a six-digit code and nothing is on until it is entered; the code lapses after 24 hours. The demo shows the code on the page. Region is a Setting. Booking, safety and payment messages are not marketing.
- **Captain's Circle and credit in the booking (BOK-11, BOK-12):** the review step has a number field (CC and seven digits, the last a check digit; the signed-in person's own number is one tap away) and a "use my future cruise credit" tick. Your own number gives your level (Gold 2%, Ruby 3%, Platinum 5%, Elite 7% off the whole price); any other valid number joins at Gold. Credit never takes the price under $100. `quote` now returns `total` (what to send back as `expectedTotal`) and `perks`; the booking stores the reduced total and the credit is spent once.
- **Room upgrades (`/plan/upgrades`, MNG-06):** up to two room types above the current one, a bid floor of 40% of the price difference, a fixed "upgrade now" price at 90%. Bids are decided three days before sailing: the fixed price always wins, a bid in between wins or loses the same way every time. Nothing is charged for a bid that does not win. The demo does not move the guest to the new room.
- **Weather (`/plan/weather`, MNG-09):** the typical high, low, sea temperature, rain days, UV and hurricane-season warning for each stop on each date, in the units chosen in Settings. Authored monthly averages, not a forecast.
- **Gifts and celebrations (`/plan/ahead`, PRE-07, MNG-13):** flowers, champagne, cake, decorating and a kids' welcome package in the existing catalogue, with suggestions for the occasion; the booking-confirmed screen links to it when an occasion was given.
- **Fix a problem (`/me/fix-it`, MNG-18):** three guided flows (no booking, name mismatch, lost documents), each a tick list with links to the screens that fix it, then a case with a reference and a promise of contact within 24 hours if the steps did not help. One open case per flow.
- **Health and comfort (`/plan/health-prep`, MNG-19):** motion-sickness tips, medicines to pack, and insurance reminders with a start date for each, a progress count, and a note that this is not medical advice. Ticks are kept per person.
- **Book ahead (`/plan/ahead`, PRE-04, PRE-05):** show tickets, spa, salon and fitness can be reserved before sailing. The same rules apply (seat counts, age, one seat each); the gate that said "once you are on board" now only closes after the cruise.
- **Kids' and teens' clubs (`/plan/clubs`, PRE-08, SEC-07, SEC-08):** per child 3 to 17: allergies, medical needs and medicines (each optional, 300 characters), a phone number, up to four people who may collect them, teens may sign themselves out, a separate photo consent, and a tick that the details are right. Held under the booker only; a supervised child sees the club but never the details and cannot change them. Deleted 90 days after the cruise (the `health` retention rule now names `clubReg`).
- **Prepay and credit (`/plan/prepay`, PRE-10):** the top-up and gratuity controls from Money now also work before sailing; they close after the cruise.
- **Saved items and basket (`/plan/cart`, PRE-11):** tours in the basket, spa and gift bookings and their total, and a "save for later" list across tours, bookings, restaurants and packages (a save button on each tour and booking). Each kind keeps its own checkout.
- **Waitlist that books for you (dining, PRE-14):** a tick on the waitlist form; when the table is offered it is booked at once through the normal rules and noted on the waits list. If it cannot be booked, the offer stays for the guest to take.
- **Medallion (`/home/medallion`, CHK-06):** made at booking, posted 14 days before sailing, delivered 8 days before; booked later than that it is collected at the terminal. It can be switched on once it has arrived; "lost" switches it off and sends the guest to collect a replacement.
- **Luggage tags (`/home/luggage`, CHK-09):** print, show on the phone, or post a set (up to 14 days before sailing), with the printed name, cabin and deck for each guest, and an estimated bag journey from when the bags are handed over on embarkation day (five steps; the screen says it is an estimate).
- **Port entry rules (`/home/clearance`, CHK-10):** what to carry, forms and fees, and notes for each stop, for a U.S. passport and for another country's, with a reminder to check the official page.
- **Extra support (`/me/assist`, SUP-07):** a person phones to book with you; or a bereavement or serious-illness cancellation, with the fee waived once papers are seen, a decision within two days and a choice of refund to the card or future cruise credit at 110%.
- **Region and units (Settings, ACT-08):** temperatures and lengths in Fahrenheit/inches or Celsius/millimetres (used by the packing list, ship news, onboard home and the weather screen), and where the guest lives (used for marketing consent). Currency stays on the Money screen.
- **Health and children's data rules (privacy centre, SEC-07, SEC-08):** written in `src/domain/dataRules.ts` and shown in the privacy centre: who can see each kind, what is collected and left out, and what the person can do. Tests check each health record has a deletion date, that under-13s are never asked about marketing, that other bookings and supervised children cannot read club registrations.
- **Search and sharing tags (CNT-05):** Open Graph and Twitter tags and a robots tag in `index.html`; on each change of screen the title, description, robots and share tags are rewritten (`src/seo.ts`). Only discovery pages are indexable; everything with a person's booking or account says `noindex`; `public/robots.txt` agrees. **Not done:** server rendering or prerendering, which needs a server.
- **API:** one new group, `ahead` (`src/api/aheadMock.ts`, shapes in `src/api/aheadTypes.ts`), with `advisors`, `marketing`, `perks`, `upgrades`, `clubs`, `medallion`, `tags`, `fix`, `assist`, `prep` and `saved`. The booking draft gains `loyaltyNumber` and `useCredit`; waitlist joins gain `auto`.
- **Choices made:** nothing is posted, emailed or texted, and the advisors, medallion tracking and upgrade decisions are simulated; stage times for requests that change (support, fix-it) come from the time the request was made, not the last time it was saved; upgrade and booking credit are not returned if the booking is cancelled in the demo.
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`. Not tried in a browser, by the project rule.

