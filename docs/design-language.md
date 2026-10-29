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
| `@anthropic-ai/sdk` | Concierge | Added in Phase 9 only |

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
