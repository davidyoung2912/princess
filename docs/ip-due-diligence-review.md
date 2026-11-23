# Independent pre-purchase review of the Princess codebase

Prepared as a buyer-side technical and IP due-diligence review (2026-11-23). Scope: the SQL Server schema and seeds (`db/`), the C# API (`server/`), the React front end (`src/`), the build, CI and documentation.

**Method and limits.** This is a static review of the repository: file counts, targeted searches, and reading the project's own plans, scorecards and CI file. I did not run the application, a browser, `dotnet test`, or a penetration test, and I did not audit every line. Figures below were measured from the repo at the time of writing. Findings that rest on the project's own documents are marked "per docs"; confirm them before relying on them. This is a technical opinion, not legal advice. Items in section 4 need a lawyer.

---

## 1. Executive summary

Princess is a large, unusually well-documented cruise-guest platform: a mobile-first PWA (React 19, Vite, TypeScript), an ASP.NET Core 9 REST API (Dapper) and a SQL Server schema, with an AI concierge ("Stanley") and a simulated set of external services behind interfaces.

| Measure | Value |
| --- | --- |
| Tracked files | about 2,890 |
| TypeScript/TSX under `src` | about 168k lines (487 test files) |
| C# (API plus tests) | about 105k lines (about 2,460 `[Fact]`/`[Theory]` tests) |
| SQL (schema and seeds) | about 23k lines (`01-schema.sql` is 4,245 lines) |
| REST endpoints | about 720 map calls |
| Docs | about 97 files |
| Git history | 925 commits, one author, 2026-10-28 to 2026-11-23 |

**Overall view.** The engineering discipline is better than most projects at this stage: strict compiler settings, provider seams, broad tests, content-integrity guards, honest scorecards. But as an IP asset it carries three kinds of risk that I would want resolved or priced before signing:

1. **Ownership and rights risk (highest).** No licence, an unresolved brand and trademark position, content drawn from a real company's public material, unrecorded provenance of the 80 MB of artwork, and about 917 of 925 commits carrying an AI co-author trailer.
2. **Readiness risk.** The product is a demonstrator. Almost every real-world integration is simulated, a fixed verification code is in the default config, and the API test suite is not run in CI and was last recorded failing.
3. **Maintainability risk.** A very large surface built in about four weeks by one person (with AI assistance). Bus factor is one. Several files are very large, and much content is "concept sample" data that is unverified.

**Recommendation.** Proceed only on conditions: fix the "must fix before signing" items in section 3, obtain the warranties and assignments in section 4, and price in the "fix before go-live" work. I would not describe the code as production-ready today.

---

## 2. Strengths

### 2.1 Architecture and design

- **Clean thin-client split.** The front end keeps no data store of its own (`CLAUDE.md`, `README.md`); it talks to the server through one module (`src/shared/api/httpApi.ts`). That makes the front end and back end separable assets.
- **Provider seams for every external service.** Weather, flights, telemetry, concierge, rates, email and SMS each sit behind an interface chosen in one place (`server/Princess.Api/Services/ProviderRegistration.cs`), default `sim`, with an unknown name failing at start-up and a shared `ProviderContractTests` run against every implementation. A buyer can swap in real vendors without front-end change.
- **Sensible source layout.** `app/`, `features/<name>/`, `shared/`, `domain/`, `gates/`. Framework-free logic is kept apart from React so it can be unit tested. The project is candid that about 80 `shared/` files still import from `features/`, and nothing enforces the direction.
- **Operational kill switches.** Stanley's routes (`Model`, `Tools`, `Actions`, `Resolver` and others) can be turned off by configuration with no code deploy, with daily call ceilings and per-guest limits (per `docs/runbook.md`).

### 2.2 Security posture (design level)

- **Deny by default.** A fallback authorisation policy requires an authenticated user (`Program.cs:276`); only 35 `AllowAnonymous` sites exist and a test asserts which routes are open to the world (`SwaggerCoverageTests`).
- **Auth hardening.** Short access tokens (15 minutes), refresh token as an httpOnly cookie served first-party through a proxy, refresh tokens stored only as hashes, CSRF guard and replay tests, lockouts with per-IP and per-account limits, rate limiter wired in, CORS restricted to configured origins with credentials.
- **Data protection.** ASP.NET Data Protection with a database-backed key ring for sensitive documents (health, family and similar), with the failure mode documented (fail the read, do not return empty).
- **Parameterised SQL.** I looked for string-built SQL with user input. The interpolated queries I sampled interpolate fixed column lists and table names, with values passed as Dapper parameters. I did not find a concatenated user value. (This is a sample, not proof; see 3.5.)
- **Data minimisation and retention.** A retention job blanks network data after 60 days and deletes Stanley logs after 180; the Stanley tier log stores counts and tokens, not message text (per docs).
- **Secrets hygiene.** Connection string, signing key and API keys are user-secrets or environment variables; the API refuses to start without a 32-character signing key. A scan for key-shaped strings and private-key headers found nothing in tracked files.

### 2.3 Quality engineering

- **Strict compilers and linters.** C# `Nullable` on and `TreatWarningsAsErrors`; TypeScript strict build in CI; Oxlint with react, typescript and jsx-a11y plugins; lint reported clean.
- **Breadth of tests.** About 487 front-end test files and about 2,460 C# tests, plus unusual and valuable **guard tests** that read the whole tree (security, audit, performance, wording, stale generated content, every API response guard exercised against bad input).
- **CI exists** (`.github/workflows/ci.yml`): lint, type-check, coverage with floors, build, bundle budget, `npm audit` for high severity, and a .NET build with a vulnerable-package check. Dependabot is configured.
- **Accessibility intent.** WCAG 2.2 AA target, a contrast report script, focus-trapped dialogs, reduced-motion support.
- **Generated data is checkable.** Seeds and catalogue content are produced by scripts with `:check` counterparts so drift fails a test.

### 2.4 Documentation and honesty

- About 97 documents: backend plan, data model, runbook, security plan, per-feature plans, a release scorecard and a self-review with letter grades. The project says plainly what is simulated, what is unverified and what is failing. That is rare and lowers diligence cost considerably.
- Housekeeping is documented: an index with "start here", an archive for finished plans, `CONTRIBUTING.md`, `CHANGELOG.md`, `SECURITY.md`, a PR template.

---

## 3. Weaknesses and what I would require

Priority key: **P0** must be fixed or resolved before signing; **P1** fix (or hold back part of the price) before go-live; **P2** should be on the post-sale plan.

### 3.1 Code and test health

| # | Finding | Evidence | Pri | Ask |
| --- | --- | --- | --- | --- |
| C1 | **API tests are not run in CI and were last recorded failing.** CI builds the API but deliberately skips `dotnet test`. The last recorded run failed 31 of 1,774 tests (2026-11-08). Since then roughly 700 more tests have been added, so the current state is unknown. | `ci.yml` comment; `docs/review-and-completeness-plan.md` Phase F | P0 | Seller runs the full API suite, fixes or removes the failures, and enables `dotnet test` in CI. Deliver a green run log. A buyer cannot rely on 2,460 tests nobody runs. |
| C2 | **The recorded failures include meaningful ones:** provider contract tests, a config-switching test, index-out-of-range in `Timeline.AllAboardAt`, and a swagger test about which routes are open to the world. | same | P0 | Treat the swagger open-route and contract failures as possible real defects until shown otherwise. |
| C3 | **Project working rules forbid `dotnet test` and browser testing.** The owner's own instructions say to verify with npm checks only. The back end therefore has had little recent verification by this team, and there is no end-to-end test at all. | `CLAUDE.md` | P1 | Add a CI job for API tests (against a containerised SQL Server or LocalDB) and a minimal smoke test of sign-in, one booking read and one write path. Lift the rule for release work. |
| C4 | **Front-end coverage is moderate.** Measured about 64% statements, 58% branches, 53% functions. Floors in CI sit just under. | Phase F notes | P2 | Raise floors on auth, payment-adjacent and data-protection code first. |
| C5 | **Very large files.** `enCore.ts` 6,403 lines (about 834 kB source), `enRest.ts` 7,132, `enLate.ts` 6,673, `PortsReference.cs` 5,588 lines of authored data in C#, `DapperAboardStore.cs` 1,289, `PlanService.cs` 935, `ChatService.cs` 827. | line counts | P2 | Move authored data out of C# into content files or the database; split the largest stores and services. |
| C6 | **Performance budget was failing unnoticed** and was re-baselined upward rather than fixed. First load 822 kB gzip against a stated aim of 630 kB; assets 5.9 MB. | Phase E notes | P1 | Deliver the planned lazy-loading of string groups and screens; restore a real budget. Mobile-first on ship Wi-Fi makes this matter commercially. |
| C7 | **Layering is not enforced.** `shared/` imports from `features/` in about 80 files; most code imports `app/runtime` directly. | `CLAUDE.md` | P2 | Add a lint or gate test for import direction. |
| C8 | **Planned work left half-wired.** Excursion catalogue wiring is partial; several code paths assume every tour's port is on the itinerary and would throw otherwise (`First` on an absent port). | Phase B notes | P1 | Finish or remove the half-integrated excursion data; add the `OnTimeline` guard at the listed call sites. |

### 3.2 Security and privacy

| # | Finding | Evidence | Pri | Ask |
| --- | --- | --- | --- | --- |
| S1 | **Fixed verification code `111111` is in the committed default `appsettings.json`.** If deployed with defaults, every email and phone confirmation and sign-in code is guessable. The code does log a warning at start-up, but only a warning. | `appsettings.json` (`Verification:FixedCode`), `Program.cs:124-130,407`, `PhoneRules.cs:35-37` | P0 | Remove from the default config. The setting should exist only in Development, and the server should refuse to start in Production with it set. Complete the real email/SMS provider (Pingram is documented) before any pilot. |
| S2 | **Demo accounts with a documented shared password** seeded as `<slug>@demo.princess.example`. Fine for demos; dangerous if the seed is ever run against a real database. | `README.md`, `server/README.md`, `db/seed/personas` | P0 | Gate persona seeding to non-production, add a start-up check that fails if demo users exist in Production. |
| S3 | **Security contact is a placeholder** (`security@example.invalid`) in `security.txt` and `SECURITY.md`. | `SECURITY.md` | P1 | Real monitored address and disclosure process. |
| S4 | **No independent penetration test** is on record; the "security review" is self-assessed (Phase D). | docs | P1 | Commission one before go-live; make the report a closing condition if the buyer plans a public launch. |
| S5 | **High-sensitivity data categories** (health, family, travellers, party, phone numbers, photos stored as database blobs in `dbo.GuestMedia.Data`) mean GDPR, UK GDPR, CCPA and children's-data obligations. No DPIA, privacy notice, DPA template or data-subject-request tooling was found in the docs I read. | schema and docs | P0 (legal) / P1 (build) | Seller supplies a data-protection inventory, lawful-basis analysis and any DPIA. Build export and erasure paths if absent. Move images to object storage. |
| S6 | **Single-process assumptions.** `UserCache` is per-process (up to 30 s stale across instances), the audit queue is bounded and can drop rows under load, and Data Protection keys live in the same database as the data unless a certificate is configured. | `server/README.md` | P1 | Decide the production topology; add a shared cache or accept the staleness in writing; require the key-ring certificate in Production. |
| S7 | **Dependency and supply-chain hygiene** is partial: `npm audit` gates only high severity on production dependencies; there is no SBOM and no .NET dependency scanning beyond `--vulnerable`. Several dependencies are very new major versions (for example React Router 8, Vite 8, TypeScript 6, Vitest 5, Microsoft.Data.SqlClient 7). | `package.json`, `.csproj` | P2 | Generate an SBOM; run a licence scan (see 4.4); pin and review. |
| S8 | **Token handling to confirm.** Access tokens are in memory or device storage and refresh is a cookie; I did not trace every path. | `src/app/runtime/index.ts` | P1 | Buyer's security reviewer to confirm no token reaches `localStorage` and that CSP is enforced as documented. |

### 3.3 Product readiness and mocked functionality

| # | Finding | Pri | Ask |
| --- | --- | --- | --- |
| R1 | **Everything external is simulated:** ship telemetry, weather, flights, routes, staff queue, rates, concierge (unless a key is set), email and SMS, **card charging**. Real providers are optional config; the MCP providers are disabled by default. | P1 | Be explicit in the price: the build covers the seams, not the integrations. List which providers have ever run against a live service. |
| R2 | **Payments are mocked.** If the buyer expects to take money, PCI scope, a real gateway and reconciliation are unbuilt. | P1 | Require a statement of what the payment path does today and a plan to use a hosted checkout (to stay out of PCI card-data scope). |
| R3 | **Content is largely "concept sample" and unverified.** Ship deck plans for Sky and Sapphire, dining-room names, taxi fares, prices, hours, local laws, visa and passport rules for 36 countries, phrase cards in six languages, consulate phone numbers (fictional `555-01xx`) are all marked unverified. The project's own document says legal, safety, health, document and port-rule text "must not ship to a real pilot unchecked". The sign-off line is blank. | P0 for any public use | Do not let the buyer treat this as launch content. Either remove it or require a sourced, dated verification pass, with owner sign-off. Misstated visa or safety advice has real liability. |
| R4 | **Operational ownership is undefined.** The runbook says there is no incident owner or deputy until named. | P1 | Named operational contacts and an on-call arrangement belong in the buyer's plan. |
| R5 | **No schema migration runner.** Schema is one 4,245-line script plus seeds, "run by hand"; a version-table policy is written but not built. | P1 | Introduce numbered, idempotent migrations with a `SchemaVersion` table and test an upgrade from the previous version. A hand-run drop-and-create script is not an upgrade path for a database with real data. |
| R6 | **Deployment story is thin.** Vercel config for the front end exists; no infrastructure-as-code, container definition or deployment pipeline for the API and database was found. | P1 | Provide IaC or a deploy guide that a stranger has followed successfully. |
| R7 | **Localisation.** English only by decision; existing Spanish files are partial and frozen. | P2 | Fine if the buyer targets English markets only; otherwise a translation strategy is a cost item. |
| R8 | **Accessibility is claimed but unmeasured by humans.** The owner rule bars browser testing, so there is no recorded screen-reader or keyboard pass. | P1 | An independent WCAG 2.2 AA audit. |

### 3.4 Delivery, repo and documentation hygiene

- **Documentation volume is a liability as well as a strength.** About 97 documents, many overlapping plans, scorecards and research notes, some with out-of-date line numbers (acknowledged in `content-verification.md`). Ask the seller to mark the current set and archive the rest (a start has been made).
- **Large binary and generated assets.** `art/source` is about 80 MB of PNG originals in git; `db/seed` is about 4 MB; generated SQL and JSON are committed. Repo clones will be heavy and diffs noisy. Consider Git LFS or object storage for source art.
- **Git history is a single author in a four-week window.** That is a record of intent, not of maturity: there is no history of production incidents, upgrades or real users. Ask for the full repository history with no squashing, since it is the best provenance evidence (see 4.2).
- **`coverage/` and `dist/` are ignored and not tracked** (good); confirm no build output is shipped in the transfer.

### 3.5 Things I could not confirm and would ask the buyer's team to test

- A full injection and authorisation review of the 720 endpoints, particularly object-level authorisation (a guest reaching another guest's booking, chat group or media by id). The `SubjectAccess` and `AccessService` classes suggest a deliberate model; I did not verify every route uses them.
- Real concurrency behaviour of the chat hub and scheduler under load.
- Whether the Stanley prompt-injection defences (word filter, safety screen, tool and action confirm/undo) hold against adversarial input. Prepared actions with confirm and undo is the right design; it needs red-teaming.
- Cost exposure of the model calls (`Stanley` ceilings are per-guest; there is no global spend cap that I saw).

---

## 4. Intellectual-property and legal diligence (the part that decides the price)

I am not giving legal advice. These are the technical facts a lawyer will need, and the conditions I would ask for.

### 4.1 Licence and ownership of the code

- **No licence has been chosen** (`CONTRIBUTING.md`: "all rights are reserved"). That is acceptable for a sale, but the transfer must be an explicit written **assignment of copyright** from the author (and any contractor or other contributor) to the buyer, not a licence.
- Git shows one committer. Confirm there were **no other contributors, contractors, employers or clients** whose terms or employment contracts could claim the work. If the author was employed or contracted elsewhere during 2026-10-28 to 2026-11-23, an employer's invention-assignment clause may reach this work.
- **Moral rights waiver** where the jurisdiction recognises them.

### 4.2 AI-assisted authorship

- About **917 of 925 commits carry a `Co-Authored-By: Claude` trailer**, so most code, documents, content and probably art prompts were produced with an AI assistant. Copyright in purely machine-generated material is uncertain or unavailable in several jurisdictions (the US Copyright Office requires human authorship). The buyer may therefore acquire less exclusive protection than for hand-written code.
- Ask for: a written statement of which parts were human-authored and which AI-generated; the terms of the AI service used (output ownership, any usage restrictions); and a warranty that no known third-party code was reproduced. The commit history and prompts, if retained, are the best evidence of human creative direction.
- Trade secret and contract protection become more important than copyright for this asset. Keep seeds, content pipelines and prompts confidential on transfer.

### 4.3 Trademark and brand: the central risk

- The product is named **"Princess"**, and the content draws heavily on **Princess Cruises**, a real company whose names and marks are registered: ship names (Sun, Sky and Sapphire Princess), venue and programme names (the project itself notes it "borrows Princess's public vocabulary": Piazza, Lido, SeaWalk, Movies Under the Stars, Crown Grill, Sabatini's, Princess Live!), a UI string says "Every notice from Princess Cruises and your ship", and about 100 files in docs, server and src mention Princess Cruises. The server's own provider config attributes data to **"Princess Voyages"**, so the project has itself used two names.
- The research documents (`docs/princess-*.md` and similar) describe the real company's restaurants, entertainment, cabins, spa and policies, apparently from public sources. Provenance and licence of that source material is **not recorded**.
- **Consequence.** Unless the seller is, or has a written licence from, Princess Cruises (Carnival Corporation), the IP being sold is a *concept* with a brand that the buyer probably cannot use, and the content may include copyrighted text and trademarked names. If the seller is working for or with the cruise line, the **contract with that company** decides who owns what and must be produced.
- **Asks (P0):**
  1. Written disclosure of the seller's relationship, if any, to Princess Cruises / Carnival, with any agreement.
  2. A trademark clearance opinion on the name, and a plan to **rename and de-brand** (product name, UI strings, ship and venue names, provider attribution) if no licence exists. The code is well enough structured that most brand text lives in the i18n catalogue and content files, but it is spread over about 20,000 lines of strings and thousands of data rows, so budget for it.
  3. Remove or replace real ship names and real venue names in the seed data unless licensed.

### 4.4 Third-party content, art and data

- **Artwork:** `art/source` holds about 80 MB of originals (hero images, "poses" and "heads" for the Stanley character, avatars). Provenance is not recorded: hand-drawn, commissioned, stock, or AI-generated? The build script calls them "drawn originals". Ask for: signed assignments from every artist, or generation records and tool terms for AI images, and a statement on whether any depicts real people or real branded property.
- **Deck plans** (`public/deckplans`) and **photos**: confirm origin. Real company deck plans are copyrighted.
- **Fonts:** `@fontsource/figtree` is open source (check licence text ships with the product).
- **Open-source dependencies:** run an automated licence scan (npm and NuGet). Nothing obviously problematic stands out from the manifests, but nothing has been recorded. Deliver the scan output and an SBOM. Watch for copyleft in transitive dependencies; `Swashbuckle`, `Dapper`, `jsQR`, `qrcode` and `idb` are commonly permissive.
- **External data services (MCP):** the config names GoVisit and an Open-Meteo MCP mirror at a personal domain (`open-meteo.caseyjhand.com`), both disabled by default and flagged `Commercial: false`. Open-Meteo's free tier is non-commercial; a commercial product needs a paid plan or another source. Remove or replace non-commercial providers and any third-party-hosted endpoint before sale.
- **Content generated by scripts from the author's research:** the 99 port guides, 36 country rows, excursions and phrase cards are "authored from general knowledge". Ask for source notes and a warranty about non-infringement.

### 4.5 Contractual protections to request

- Assignment of all IP with a **full-title warranty** and a warranty of originality to the seller's knowledge.
- **Indemnity** for third-party claims (trademark, copyright, privacy) arising from material delivered, with an escrow or holdback sized to the brand and art risks.
- **Disclosure schedule** of all third-party code, content, services, accounts, domains and keys.
- **Transfer of accounts and credentials** (repository, domains, Vercel project, any AI vendor, Pingram, app-store or push keys), with rotation of every secret at closing; the buyer should assume every secret ever used in development is burned.
- **Transition support** (for example 40 to 80 hours of knowledge transfer) given the single-author bus factor.
- **Non-compete or exclusivity** so the author cannot re-sell near-identical code or content.

---

## 5. Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Brand/trademark claim by the real cruise company | High (if no licence) | Very high | 4.3: relationship disclosure, clearance, rename |
| Weak copyright due to AI authorship | Medium | Medium | 4.2: statements, warranties, rely on contract and trade secret |
| Art or content infringing third-party rights | Medium | High | 4.4: provenance, assignments, replace unknowns |
| Fixed code or demo accounts reach production | Medium | High | S1, S2 |
| Misleading travel, visa or safety content causes harm | Medium | High | R3: verify or remove |
| Hidden defects behind unrun API tests | Medium-High | Medium | C1, C2 |
| Personal-data breach or regulatory breach | Medium | High | S4, S5, S6 |
| Key-person dependency | High | Medium | Transition support, docs index, history preserved |
| Underestimated cost to reach a real launch | High | Medium | R1, R2, R5, R6 |

---

## 6. Pre-sale checklist

**Must be done before signing (P0)**

1. Written copyright assignment from the author; confirm no other contributors or employer claims.
2. Disclosure of any relationship to Princess Cruises / Carnival and the governing agreement; trademark clearance; agreed de-branding plan.
3. Provenance records and assignments for all artwork, deck plans, photos and fonts.
4. Statement on AI-generated content and the AI vendor's output terms.
5. Remove `Verification:FixedCode` from default config and block it in Production; gate demo-persona seeding away from Production.
6. A green, current `dotnet test` run, with the failures from the 2026-11-08 run fixed or explained; enable it in CI.
7. Verify or remove the unverified legal, visa, safety, health and port-rule content, or label the whole content set clearly as sample data in the sale terms.
8. Licence scan and SBOM for all dependencies; remove non-commercial third-party services from defaults.
9. Data-protection inventory covering what personal data the system holds and how deletion and export work.

**Before go-live (P1)**

10. Independent penetration test and WCAG 2.2 AA audit.
11. Numbered migrations with an upgrade test; backup and restore proven.
12. Deployment automation for the API and database; Production configuration checklist (key-ring certificate, signing key, CORS, secrets).
13. Real email and SMS providers, and a decision on payments (hosted checkout).
14. Real security contact and incident owner.
15. Restore a true performance budget; lazy-load strings and screens.
16. Finish or remove the half-wired excursion catalogue.
17. A minimal end-to-end smoke suite in CI.

**Post-sale (P2)**

18. Enforce import direction between layers; split the largest files; move authored data out of C#.
19. Raise coverage floors; prune the documentation set; move source art out of git.
20. Translation strategy if non-English markets are in scope.

---

## 7. Closing opinion

The code is clearly the work of someone who values tests, documentation and honest self-assessment, and the architecture (thin client, provider seams, deny-by-default API, guard tests) is a sound base. Its value to a buyer, however, depends less on the code than on three things the repository cannot answer: **who owns the brand and content, how much of it is protectable given AI authorship, and how much of the simulated system the buyer must build before it earns money.** I would sign only with the rights conditions in section 4 met and a price that reflects the readiness work in section 3.
