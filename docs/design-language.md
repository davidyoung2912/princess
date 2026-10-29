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
