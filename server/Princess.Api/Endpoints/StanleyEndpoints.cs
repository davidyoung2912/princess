using System.Text.Json.Nodes;
using Princess.Api.Auth;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Stanley, the one conversational surface (docs/stanley-gap-analysis-and-plan.md, phase 1). The model key never leaves the server.</summary>
public static class StanleyEndpoints
{
    public static void MapStanleyEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapPost("/me/stanley", async (StanleyRequestDto body, ICurrentUser me, StanleyService svc, CancellationToken ct) =>
                Results.Ok(await svc.AskAsync(await me.LoadAsync(ct), body, ct)))
            .WithTags("Stanley")
            .WithSummary("Asks Stanley, the cruise chat helper and the app's only conversational surface. Send the thread so far (oldest first, ending with the guest's message, at most 60 messages, the guest's message at most 500 characters; only the latest 10 clean round trips are used), " +
                "optionally the context packet { stage (one of the eleven journey stages), screen, sailingId, level } and the device's mobility (any, easy, wheelchair) and up to five tour likes. " +
                "Answers { kind, text, handoff, source, fallback, tier, blocks[{ type, text }], sources[{ label, path }], degraded[], card? }: blocked (a listed word; no model was called), handoff (emergency, medical, legal or person; no model was called), offtopic (not about cruising), " +
                "unavailable (fallback limit, auth, rate, network, bad or off) or answer (source claude, or scripted when no model can be used; fallback says why when it was meant to be a model). " +
                "tier says which route handled it: blocked, handoff, offtopic, unavailable, entry (a question about visas, passports, immigration or customs: no rule is stated, only the official sources), resolver (a question about the guest's own trip answered with no model, as a card), trip (the guest's own booking, plan and bill, with the tools), before (facts for someone still choosing, with the tools) or model (open chat). " +
                "card is set when a resolver answered: { id, title, lines[], abstained, links[], provenance { chips[] (Your booking, Ship schedule, Princess policy, Estimated, Cached), owner, dataTime (when the data was read or published, not when the reply was made), freshness (live, cached, estimated, provisional), checkWithPerson, note } }; a deadline, tender, payment, access or safety question with stale or missing data says it cannot confirm (abstained) and never guesses. " +
                "Text is set only for an answer; the front end words the rest. The server picks the route and the model (small for the prescan, default for answers, large only to plan a day, week or itinerary), " +
                "adds PII-free facts about the guest's own trip to the instructions, caps model calls per request (3 for chat, 5 for planning) and per guest per day (60), and writes one tier log row per reply with no message text. " +
                "degraded lists any route an operator has switched off. 400 badStanley for a thread it cannot answer.");

        api.MapGet("/me/stanley/status", (ICurrentUser me, StanleyService svc) => Results.Ok(svc.Status()))
            .WithTags("Stanley")
            .WithSummary("Which Stanley routes are switched off: { library, actions, handoff, degraded[] }. The device honours library (its authored answers), actions (previews and confirms) and handoff (making a case) itself; the other routes are applied on the server.");

        api.MapGet("/me/stanley/capabilities", async (ICurrentUser me, StanleyService svc, CancellationToken ct) => Results.Ok(await svc.CapabilitiesAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley")
            .WithSummary("What Stanley can do, for the signed-in guest: { groups[{ id (answer, do, watch, value), title, intro }], items[{ id, group, title, summary, example (a sentence Stanley really handles), stages[] (empty: every stage), rung (0 tells, 1 notices, 2 prepares and the guest confirms), appliesWhen (always or booking), state (available, or needsBooking until a booking is linked) }] }. " +
                "An ability whose operator switch is off is left out, and a supervised account is not shown the ones that prepare. The app renders what it is given, so a new ability needs no front-end change.");

        var permissions = api.MapGroup("/me/stanley/permissions").WithTags("Stanley");
        permissions.MapGet("", async (ICurrentUser me, StanleyPermissionService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("What the guest lets Stanley do on his own: { level (1 to 4: just answer, keep watch, do the legwork, handle the small stuff; a new guest is at 2), effectiveLevel (what is in force: 1 for a child account or when Stanley's voice is off), voiceLimited, childLimited, paused, pausedUntil (epoch ms in the guest's clock, or null), wordingVersion, " +
                "levels[{ id, name, line, available }] (3 and 4 are not available until the operator switch Authority is on), rows[{ id (CL-01 to CL-10), group (watching, preparing, handling), wording, example, never, needsLevel, state (on, off, needsLevel, soon) }] }. A row whose ability is not built yet is soon and claims nothing. Level 1 and a paused account stop Stanley's own unprompted suggestions; safety and deadline alerts and answers are never stopped.");
        permissions.MapPut("/level", async (StanleyLevelRequest body, ICurrentUser me, StanleyPermissionService svc, CancellationToken ct) => Results.Ok(await svc.SetLevelAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Chooses the level { level (1 to 4), source (welcome, settings or stage), stepUp (the token from the emailed code; needed only to raise to 3 or 4) }. Lowering switches off the rows above the new level at once. Writes one consent line (ability, state, wording version, source, time). " +
                "400 level or source, 403 for a child account, 403 stepUp for a missing, wrong, used or old token, 409 notYet while levels 3 and 4 are not switched on. Answers the permissions as above.");
        permissions.MapPut("/rows/{id}", async (string id, StanleyRowRequest body, ICurrentUser me, StanleyPermissionService svc, CancellationToken ct) => Results.Ok(await svc.SetRowAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Switches one checklist row { on, source, stepUp (needed only to switch on a handling row, CL-08 to CL-10) }. 400 on or source, 403 child account, 403 stepUp, 404 no such row, 409 notYet for a row whose ability is not built, 409 needsLevel when the chosen level does not reach it. Writes one consent line.");
        permissions.MapPost("/pause", async (StanleyPauseRequest body, ICurrentUser me, StanleyPermissionService svc, CancellationToken ct) => Results.Ok(await svc.PauseAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Pause everything Stanley does unprompted { until: today (to the end of the guest's day) or forever (until resumed) }. Answers and notices carry on. 400 until, 403 child account.");
        permissions.MapDelete("/pause", async (ICurrentUser me, StanleyPermissionService svc, CancellationToken ct) => Results.Ok(await svc.ResumeAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("Resumes after a pause.");
        permissions.MapGet("/history", async (ICurrentUser me, StanleyPermissionService svc, CancellationToken ct) => Results.Ok(await svc.HistoryAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The consent history, newest first (up to 50): [{ ability (level, CL-01 to CL-10, pause), state, wordingVersion, source, at (epoch ms) }]. Never any text the guest typed.");
        permissions.MapPost("/stepup", async (ICurrentUser me, StanleyPermissionService svc, CancellationToken ct) => Results.Ok(await svc.SendStepUpAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("Emails a six-digit code to the address on the account, to confirm a change that gives Stanley more to do. 400 email, 403 child account, 409 tooSoon (a minute between codes) or emailUnavailable.");
        permissions.MapPost("/stepup/verify", async (StanleyStepUpVerifyRequest body, ICurrentUser me, StanleyPermissionService svc, CancellationToken ct) => Results.Ok(await svc.VerifyStepUpAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Checks the code { code } and answers { sent, token }: a token that works once, for ten minutes, on the level or row change. 400 wrongCode, expiredCode, tooManyTries (5 tries) or noCode, 403 child account.");

        api.MapGet("/me/stanley/facts", async (ICurrentUser me, StanleyService svc, CancellationToken ct) => Results.Ok(await svc.FactsAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley")
            .WithSummary("The guest's own trip facts as cards the device may keep to show with no signal: { cards[] } (tours, dinners, packages, ports, countdown, stateroom, party), each with its provenance and the time the booking was read. " +
                "Nothing that goes stale within a day (tender, all aboard, deadlines, bill) is included. Empty when there is no current trip or the resolver switch is off.");

        var actions = api.MapGroup("/me/stanley/actions").WithTags("Stanley");
        actions.MapPost("/prepare", async (StanleyPrepareRequest body, ICurrentUser me, StanleyActionService svc, CancellationToken ct) =>
            {
                var ctx = (body.Context ?? new StanleyActionContext()).Clean(body.Context?.SailingId);
                var input = new JsonObject { ["kind"] = body.Kind ?? "" };
                foreach (var (k, v) in (body.Args ?? new Dictionary<string, string>()).Take(20)) if (k != "kind") input[k] = v;
                var read = StanleyIntents.Validate(input, ctx);
                if (read.Intent is null) throw ApiException.Invalid("badAction");
                return Results.Ok(await svc.PrepareAsync(await me.LoadAsync(ct), read.Intent, ctx, ct));
            })
            .WithSummary("Prepares a change as a preview and does nothing else. Send { kind (order_item, add_excursion, move_dinner, reserve_dinner, draft_case, plan_change, remind_me, create_poll (args question, options joined with |, days) or change_seating (args plan: early, late or anytime)), args (plain strings, for example item and qty), context { plan[{ id, title, start, day, listed }], allAboard { at, label }, sailingId } }. " +
                "Answers the action { id, kind, status (prepared), title, lines[], who[], cents, terms, expiresAt, onDevice, params }: the exact items, who is affected, any price, the cancellation terms and an expiry ten minutes ahead. " +
                "400 badAction for a kind or detail that is not allowed, 403 for a child account, 409 off when the actions switch is off, and the same 400, 404 and 409 codes the service behind the action gives.");
        actions.MapGet("/waiting", async (ICurrentUser me, StanleyActionService svc, CancellationToken ct) => Results.Ok(await svc.WaitingFromHelperAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("What a helper has prepared for the guest that is still waiting, newest first, each with preparedBy (the helper's name). Nothing has happened: confirm one with the usual confirm, or ignore it and it expires after a day.");
        var helping = api.MapGroup("/me/stanley/helping").WithTags("Stanley");
        helping.MapGet("", async (ICurrentUser me, StanleyHelperService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The guests who have let this person prepare Stanley previews for them: { guestId, name, relationship, until }. A guest allows it with the stanley permission on their helper link; it lasts 30 days from when they last saved the link.");
        helping.MapPost("/{guestId:guid}/actions/prepare", async (Guid guestId, StanleyPrepareRequest body, ICurrentUser me, StanleyHelperService svc, CancellationToken ct) =>
            {
                var input = new JsonObject { ["kind"] = body.Kind ?? "" };
                foreach (var (k, v) in (body.Args ?? new Dictionary<string, string>()).Take(20)) if (k != "kind") input[k] = v;
                var read = StanleyIntents.Validate(input, new StanleyActionContext());
                if (read.Intent is null) throw ApiException.Invalid("badAction");
                return Results.Ok(await svc.PrepareAsync(await me.LoadAsync(ct), guestId, read.Intent, ct));
            })
            .WithSummary("A helper prepares a preview for a guest who allowed it. Kinds: add_excursion, reserve_dinner, move_dinner, change_seating, create_poll. The preview is the guest's, names the helper and waits a day; only the guest can confirm it. " +
                "404 when the guest has not allowed this helper, 400 badAction for any other kind, 403 for a child account.");
        actions.MapPost("/{id:guid}/confirm", async (Guid id, StanleyConfirmRequest body, ICurrentUser me, StanleyActionService svc, CancellationToken ct) =>
                Results.Ok(await svc.ConfirmAsync(await me.LoadAsync(ct), id, body.Key, body.Context, ct)))
            .WithSummary("Confirms a prepared action. Send { key (an idempotency key of 8 to 64 letters, digits, dash or underscore), context (as for prepare, needed for plan_change and remind_me) }. " +
                "Checks again that the preview has not expired, that the guest may still do it and that the price and availability are what was shown, then carries it out through the existing service and answers the action with status done and a receipt number, " +
                "failed with a reason (the service refused; nothing was done) or pending (the outcome is not known yet; ask again later and it is settled before anything is retried). The same key and preview always give the same answer. " +
                "404 for a preview that is not yours, 409 expired, 409 changed (the preview is void; ask again), 409 keyUsed for a key already used for another preview, 400 badKey, 403 for a child account.");
        actions.MapGet("/{id:guid}", async (Guid id, ICurrentUser me, StanleyActionService svc, CancellationToken ct) =>
                Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), id, null, ct)))
            .WithSummary("One action as it stands now, settling an outcome that was not known. 404 for one that is not yours.");
        actions.MapPost("/{id:guid}/undo", async (Guid id, StanleyConfirmRequest? body, ICurrentUser me, StanleyActionService svc, CancellationToken ct) =>
                Results.Ok(await svc.UndoAsync(await me.LoadAsync(ct), id, body?.Context, ct)))
            .WithSummary("Undoes a done action for two hours after it was confirmed: the request is cancelled, the tour leaves the cart, the dinner goes back to its old time, the case is withdrawn. A device action is only marked here; the device undoes it. 409 tooLate afterwards.");
        api.MapGet("/me/stanley/receipts", async (ICurrentUser me, StanleyActionService svc, CancellationToken ct) => Results.Ok(await svc.ReceiptsAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley")
            .WithSummary("The guest's receipts for what Stanley did, newest first (up to 50): done, failed, pending and undone actions with their receipt number and times. The Trust Ledger lists them.");

        api.MapGet("/me/stanley/checkup", async (ICurrentUser me, StanleyCheckupService svc, CancellationToken ct) => Results.Ok(await svc.RunAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("Trip check-up, plan lint and deadline radar for the guest's current or next trip: { hasTrip, findings[{ id, rule (CHK-01 trip, CHK-02 plan), consequence (safety, lostReservation, conflict, improvement, optional), title, detail, day, due, fix{ label, route } }] ranked most serious first, " +
                "deadlines[{ id, consequence, title, date, daysLeft, fix }], notChecked[] (what it cannot see; it never reports silence as all clear), clean, asOf }. Read-only: it changes nothing and a fix is only a screen to open.");

        api.MapGet("/me/stanley/value", async (ICurrentUser me, StanleyValueService svc, CancellationToken ct) => Results.Ok(await svc.RunAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("Value and bill for the guest's current or next trip: { hasTrip, findings[{ id, rule (CHK-04 bill watch, VAL-01 included value, CHK-05 forgot something), consequence, title, detail, fix{ label, route } }] ranked most serious first, notChecked[], clean, asOf }. " +
                "Read-only: it never buys, charges, disputes or refunds; value findings only name what the guest already has.");

        api.MapGet("/me/stanley/checklist", async (ICurrentUser me, StanleyChecklistService svc, CancellationToken ct) => Results.Ok(await svc.RunAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("The trip checklist (ACT-02) with smart defaults (ACT-04): { hasTrip, items[{ id, traveller (position, 0 for the booking), kind (checkin, dining, excursions), title, route, default { label, source } or null }], done, total, complete, notChecked[], asOf }. " +
                "Read-only: it ticks off by being recomputed from the real state and applies no default; a default is only shown, with where it came from.");
        api.MapGet("/me/stanley/trip-so-far", async (ICurrentUser me, StanleyTripSoFarService svc, CancellationToken ct) => Results.Ok(await svc.RunAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("Stanley's trip so far (19.5) and level suggestions (19.3): { enabled, done, confirmed, undone, suggestions[{ id, direction (more, ask-first), kind, text, route }], notMeasured[], asOf }. " +
                "Read-only, counted from the ledger only: a suggestion is words and a screen to open, never a change of level or switch.");
        var standing = api.MapGroup("/me/stanley/rules").WithTags("Stanley");
        standing.MapGet("", async (ICurrentUser me, StanleyStandingService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The guest's standing rules (RUL-01 to RUL-06) and availability watches (VAL-03): { enabled, hasTrip, templates[{ id, wording, trigger, rung, row (the permission row that must be on), param (none, time, day, table, tour) }], rules[{ id, template, wording, rung, practice, target, day, time, state (on, practice, needsPermission) }], items[{ id, ruleId, template, kind (notice, prepared), critical, title, detail, route }], practice[the same with kind would], rolled (prepared items beyond five), maxRules, notChecked[], asOf }. " +
                "Rules are read when asked, not in the background. A rule never books, pays, cancels, holds a place or messages anyone; the rung 3 rows need level 3.");
        standing.MapPost("", async (StandingRequest body, ICurrentUser me, StanleyStandingService svc, CancellationToken ct) => Results.Ok(await svc.AddAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Makes a rule from a template { template, target, day, time, practice }. 400 template, full (ten rules), time, day, target or duplicate; 403 child account.");
        standing.MapDelete("/{id}", async (string id, ICurrentUser me, StanleyStandingService svc, CancellationToken ct) => Results.Ok(await svc.RemoveAsync(await me.LoadAsync(ct), id, ct)))
            .WithSummary("Removes a rule. 404 for a rule that is not the guest's.");
        standing.MapPut("/{id}/practice", async (string id, StandingPracticeRequest body, ICurrentUser me, StanleyStandingService svc, CancellationToken ct) => Results.Ok(await svc.SetPracticeAsync(await me.LoadAsync(ct), id, body.Practice, ct)))
            .WithSummary("Puts a rule in practice (it lists what it would have offered and offers nothing) or graduates it { practice: false } with one tap.");

        api.MapPut("/me/stanley/trip-so-far/answer", async (PaceRequest body, ICurrentUser me, StanleyStandingService svc, CancellationToken ct) => { await svc.SetPaceAsync(await me.LoadAsync(ct), body.Answer, ct); return Results.NoContent(); })
            .WithTags("Stanley").WithSummary("The guest's answer to \"More, the same, or less?\" { answer: more, same, less }. It moves when a level suggestion comes and never changes a level. 400 answer, 403 child account.");

        var control = api.MapGroup("/me/stanley/control").WithTags("Stanley");
        control.MapPost("", async (ControlRequest body, ICurrentUser me, StanleyControlService svc, CancellationToken ct) => Results.Ok(await svc.ProposeAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Reads a sentence as one of six controls and shows it back { text }: { understood, id, label, detail, needsConfirm, route, examples[] }. Changes nothing and stores nothing. 403 child account.");
        control.MapPost("/confirm", async (ControlConfirmRequest body, ICurrentUser me, StanleyControlService svc, CancellationToken ct) => Results.Ok(await svc.ConfirmAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Applies a control the guest confirmed { id }: { applied, message, route }. 400 id, 403 child account.");

        api.MapGet("/me/stanley/ship-group", async (ICurrentUser me, StanleyShipGroupService svc, CancellationToken ct) => Results.Ok(await svc.RunAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("The missed-ship guard (CHK-03) and group gaps (CHK-07): { hasTrip, findings[{ id, severity (critical, soon, ok), title, detail, route }], notChecked[], clear, asOf }. Read-only: it sends nothing, contacts nobody and answers no poll; the guard only speaks about a guest who said they are ashore or leaving.");
        api.MapGet("/me/stanley/prebook", async (ICurrentUser me, StanleyPrebookService svc, CancellationToken ct) => Results.Ok(await svc.RunAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("The Manage and Prebook pack, first part: { hasTrip, findings[{ id, rule (SR-4.5, SR-5.4), title, detail, route }], notChecked[], asOf }. Read-only: it starts no poll, books nothing and sends nothing; each finding is a screen to open.");
        api.MapGet("/me/stanley/embark", async (ICurrentUser me, StanleyEmbarkService svc, CancellationToken ct) => Results.Ok(await svc.RunAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("The Get to the ship and Embark pack, first part: { hasTrip, findings[{ id, rule (SR-6.1, SR-6.6, SR-7.2), title, detail, route }], notChecked[], asOf }. Read-only: it fills in and submits no check-in and sends nothing; each finding is a screen to open.");
        api.MapGet("/me/stanley/disembark", async (ICurrentUser me, StanleyDisembarkService svc, CancellationToken ct) => Results.Ok(await svc.RunAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("The Disembark pack, first part: { hasTrip, findings[{ id, rule (SR-10.1, SR-10.3, SR-10.6), title, detail, route }], notChecked[], asOf }. Read-only: it tags no bag, fills in and submits no customs form, picks no exit time and sends nothing; each finding is a screen to open.");
        api.MapPost("/me/stanley/auto/deadlines", async (ICurrentUser me, StanleyAutoService svc, CancellationToken ct) => Results.Ok(await svc.RunAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("AUT-02, deadline reminders (rung 4): { on, class, made[{ key, text, dueAt, receipt }], waiting[], notChecked[], asOf }. Does something only when permission row CL-08 is on (level 4, not paused, not a child account, the Authority switch on): sets plain reminders for check-in opening and the final payment on the guest's own list, once each, at most 30 per trip, each with a ledger receipt that can be undone for two hours. Sets nothing else and sends nothing.");
        api.MapPost("/me/stanley/auto/lists", async (ICurrentUser me, StanleyAutoService svc, CancellationToken ct) => Results.Ok(await svc.ListsAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("AUT-05, lists kept current (rung 4, packing list first): { on, firstLook, changes[{ list, added[], removed[] }], notChecked[], asOf }. Works only when permission row CL-08 is on. Says what the suggested packing items added or dropped since the last run and records where the list stands; changes no list, tick, hidden item or item the guest added.");
        api.MapPost("/me/stanley/auto/plan", async (ICurrentUser me, StanleyAutoService svc, CancellationToken ct) => Results.Ok(await svc.PlanAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("AUT-03, my plan topped up (rung 4): { on, picks[{ id, day, title, start, minutes, place }], added[], removed[], notChecked[], asOf }. Works only when permission row CL-09 is on (level 4). Adds free events on sea days and in port-day evenings to the guest's own plan as Stanley's picks, at most 4 a day for the next 3 days, clear of anything booked, dinner and other picks; drops his own picks that no longer fit. Never touches what the guest added, never re-adds a removed pick, holds and books nothing.");
        api.MapGet("/me/stanley/auto/plan", async (ICurrentUser me, StanleyAutoService svc, CancellationToken ct) => Results.Ok(await svc.PicksAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("Stanley's picks as they stand (same shape as POST, added and removed empty).");
        api.MapDelete("/me/stanley/auto/plan/{day:int}/{id}", async (int day, string id, ICurrentUser me, StanleyAutoService svc, CancellationToken ct) => Results.Ok(await svc.RemovePickAsync(await me.LoadAsync(ct), day, id, ct)))
            .WithTags("Stanley").WithSummary("Removes one of Stanley's picks; it is not added again. 404 when it is not one of his picks.");
        api.MapPost("/me/stanley/auto/drafts", async (ICurrentUser me, StanleyAutoService svc, CancellationToken ct) => Results.Ok(await svc.DraftsAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("AUT-06, drafts saved (rung 4): { on, drafts[{ kind, text, savedAt }], saved[], notChecked[], asOf }. Works only when permission row CL-06 is on and the level in force is 4. Saves one plan note for tonight and one may-be-late note for the guest to read, change and send themselves. Sends and submits nothing.");
        api.MapGet("/me/stanley/auto/drafts", async (ICurrentUser me, StanleyAutoService svc, CancellationToken ct) => Results.Ok(await svc.SavedDraftsAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("The saved drafts as they stand.");
        api.MapGet("/me/stanley/family", async (ICurrentUser me, StanleyFamilyService svc, CancellationToken ct) => Results.Ok(await svc.RunAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("The Family pack, first part: { hasTrip, findings[{ id, rule (SR-F.1, SR-F.4), title, detail, route }], notChecked[], asOf }. Only when a traveller is under 18. Read-only: it registers no child, messages nobody and marks nothing done; each finding is a screen to open.");
        api.MapGet("/me/stanley/remember", async (ICurrentUser me, StanleyRememberService svc, CancellationToken ct) => Results.Ok(await svc.RunAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("The Remember pack: { hasTrip, findings[{ id, rule (SR-11.1 to SR-11.6), title, detail, route }], notChecked[], asOf }. On the day the ship gets in. Read-only: it builds no album, drafts and sends no feedback and reads no loyalty balance; each finding is a screen to open.");
        api.MapGet("/me/stanley/planning", async (ICurrentUser me, StanleyPlanningService svc, CancellationToken ct) => Results.Ok(await svc.RunAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("The Dream, Discover and Book pack, first part: { planning, findings[{ id, rule (SR-1.1, SR-1.2, SR-1.3, SR-2.1, SR-2.4, SR-2.5, SR-3.3, SR-3.4, SR-3.5), title, detail, route }], notChecked[], asOf }. Only for a guest with no confirmed trip still to sail. Read-only: it reads no fare or cabin, holds, books and sends nothing; each finding is a screen to open.");
        api.MapGet("/me/stanley/bundle", async (string? scope, string? pace, int? day, ICurrentUser me, StanleyBundleService svc, CancellationToken ct) => Results.Ok(await svc.PreviewAsync(await me.LoadAsync(ct), scope, pace, day, ct)))
            .WithTags("Stanley").WithSummary("A bundle (ACT-01) for ?scope=evening|day, ?pace=relaxed|balanced|packed and ?day (default today, or day 1 before sailing): { hasPlan, scope, pace, day, port, backBy, steps[{ id, start, minutes, kind, title, status (booked, suggested), why, route }] in time order, clashes[], notChecked[] }. " +
                "Read-only: nothing is booked, held, paid or sent; each step is a screen to open. 400 invalid for an unknown scope, pace or day.");
        api.MapGet("/me/stanley/draft", async (string? kind, string? scope, string? pace, int? day, ICurrentUser me, StanleyBundleService svc, CancellationToken ct) => Results.Ok(await svc.DraftAsync(await me.LoadAsync(ct), kind, scope, pace, day, ct)))
            .WithTags("Stanley").WithSummary("A draft note (ACT-03) for ?kind=party-plan|late-note: { kind, text, inputs[] }, or null when there is no plan. It is for the guest to read, change and send themselves; Stanley never sends it. 400 invalid for an unknown kind.");

        api.MapGet("/me/stanley/brief", async (ICurrentUser me, StanleyBriefService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Stanley").WithSummary("The guest's brief choices: { settings { morning, morningAt, evening, eveningAt } (24-hour ship-clock times; both off until chosen), allowed (the CL-04 permission is on), nextMorning, nextEvening (epoch ms, or null when off) }.");
        api.MapPut("/me/stanley/brief", async (BriefSettingsRequest? body, ICurrentUser me, StanleyBriefService svc, CancellationToken ct) => Results.Ok(await svc.PutAsync(await me.LoadAsync(ct), body, ct)))
            .WithTags("Stanley").WithSummary("Sets the morning and evening briefs (only the fields sent change; times are HH:mm). Turning a brief on switches the CL-04 permission on and queues the next brief; both off switches it off. 400 with morningQuiet or eveningQuiet when the time is inside the guest's quiet hours. Not for a supervised account.");
        api.MapGet("/me/stanley/brief/{kind}", async (string kind, ICurrentUser me, StanleyBriefService svc, CancellationToken ct) => await svc.ComposeAsync(await me.LoadAsync(ct), kind, ct) is { } brief ? Results.Ok(brief) : Results.NoContent())
            .WithTags("Stanley").WithSummary("A preview of the morning or evening brief as it would be sent now: { kind, date, title, lines[{ text, route }] }. 204 when the guest has no sailing day it covers. Sends nothing.");

        var ledger = api.MapGroup("/me/stanley/ledger").WithTags("Stanley");
        ledger.MapGet("", async (ICurrentUser me, StanleyActivityService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("What Stanley did, is watching and remembers, for the signed-in guest: { paused, pausedUntil, undoableNow, did[{ id, number, kind, status (done, failed, pending, undone), at, what, why, facts, affects, undo (in words), undoUntil, canUndo, stop }], watching[{ id (checklist row), wording, example, never }], remembers { enabled, count, items[{ id, text, reason }] } }. " +
                "Each receipt has the six fields: what he did, why, the facts he used, who it affects, how to undo it and how to stop this kind of thing. Typed fields and the server's own words only; nothing the guest typed. Undo one with POST /me/stanley/actions/{id}/undo, switch a watch off with PUT /me/stanley/permissions/rows/{id}, forget an item with DELETE /me/stanley/memory/items/{id}.");
        ledger.MapPost("/undo-today", async (ICurrentUser me, StanleyActivityService svc, CancellationToken ct) => Results.Ok(await svc.UndoAllAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("Undoes every act still inside its two-hour window that the server can reverse: { undone, kept }. An act that cannot be undone now (for example a case the team has picked up) is kept and counted. A plan change and a reminder are undone on the device.");

        var rem = api.MapGroup("/me/stanley/reminders").WithTags("Stanley");
        rem.MapGet("", async (ICurrentUser me, StanleyReminderService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The guest's own reminders, soonest first: { id, text, dueAt, when (the moment in words, with weekday, date and ship time), kind (clock, relative or anchored), anchor (what it follows), lead (\"45 minutes before\"), state (scheduled or cancelled), note (one line: it moved, or its anchor went), private, past }. " +
                "Upcoming ones and those that were due in the last 12 hours.");
        rem.MapPost("/sync", async (StanleyPrepareRequest body, ICurrentUser me, StanleyReminderService svc, CancellationToken ct) =>
            {
                var user = await me.LoadAsync(ct);
                await svc.FollowAsync(user, (body.Context ?? new StanleyActionContext()).Clean(body.Context?.SailingId), ct);
                return Results.Ok(await svc.ListAsync(user, ct));
            })
            .WithSummary("Sends the plan as the device lists it (context { plan[{ id, title, start, day, listed }], allAboard { at, label }, sailingId }) so reminders anchored to a plan item or to all aboard follow it: one that moved moves with a line saying so, and one whose item was dropped ends with a line and an offer to keep it as a plain reminder. Answers the list, as GET does.");
        rem.MapPatch("/{id:guid}", async (Guid id, StanleyReminderEdit body, ICurrentUser me, StanleyReminderService svc, CancellationToken ct) => Results.Ok(await svc.UpdateAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Edits one of the guest's reminders: { text } the words, { at (HH:mm), date (yyyy-MM-dd) } a new time for a clock reminder, { leadMin } a new lead for an anchored one, { keepAsClock: true } to keep one whose anchor went as a plain reminder at the moment it had. 400 time, text, past or tooFar, 403 for a child account, 404 for one that is not yours.");
        rem.MapDelete("/{id:guid}", async (Guid id, ICurrentUser me, StanleyReminderService svc, CancellationToken ct) => { if (!await svc.CancelAsync(await me.LoadAsync(ct), id, ct)) throw ApiException.NotFound(); return Results.NoContent(); })
            .WithSummary("Removes one of the guest's reminders. 404 for one that is not yours.");

        var memory = api.MapGroup("/me/stanley/memory").WithTags("Stanley");
        memory.MapGet("", async (ICurrentUser me, StanleyMemoryService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("What Stanley remembers about the signed-in guest: { enabled, items[{ id, kind, value, text, reason, scope (trip or future), sailingId, sensitive, shared, updatedAt }], kinds[{ kind, values[], multiple, sensitive }] }. Only the guest's own items; booking facts are not here.");
        memory.MapPut("/items", async (StanleyMemoryItemRequest body, ICurrentUser me, StanleyMemoryService svc, CancellationToken ct) => Results.Ok(await svc.RememberAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Remembers one thing { kind, value, scope, sailingId (for trip), source (told, quiz, plan or carried), share (for the sensitive kinds) }. The same thing twice is one item; a single-valued kind such as pace is replaced. " +
                "400 kind, value, scope, sailing or source, 403 for a child account, 409 tooMany after 40 items.");
        memory.MapPatch("/items/{id:guid}", async (Guid id, StanleyMemoryUpdateRequest body, ICurrentUser me, StanleyMemoryService svc, CancellationToken ct) => Results.Ok(await svc.UpdateAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Carries an item forward to future trips ({ scope: future }) or switches a sensitive item's use in answers ({ share }). 404 for one that is not yours.");
        memory.MapDelete("/items/{id:guid}", async (Guid id, ICurrentUser me, StanleyMemoryService svc, CancellationToken ct) => { await svc.ForgetAsync(await me.LoadAsync(ct), id, ct); return Results.NoContent(); })
            .WithSummary("Forgets one item. It is gone from every device and from the next answer. 404 for one that is not yours.");
        memory.MapDelete("", async (ICurrentUser me, StanleyMemoryService svc, CancellationToken ct) => { await svc.ForgetAllAsync(await me.LoadAsync(ct), ct); return Results.NoContent(); })
            .WithSummary("Forgets everything Stanley remembers about the guest.");
        memory.MapPut("/settings", async (StanleyMemorySettingsRequest body, ICurrentUser me, StanleyMemoryService svc, CancellationToken ct) => { await svc.SetSettingsAsync(await me.LoadAsync(ct), body, ct); return Results.NoContent(); })
            .WithSummary("Switches Stanley's memory on or off { enabled } and/or keeps how much Stanley speaks up { level: chatty, helpful, asked or off } so every device shows the same choice (the get returns it as level, or null before one is chosen). At least one is needed. Off, no remembered item is used in an answer; items stay listed until forgotten. 400 settings or level, 403 for a child account setting a level.");

        api.MapPut("/me/stanley/plan", async (StanleyPlanSnapshotRequest body, ICurrentUser me, IStanleyPlanSnapshotStore store, IClock clock, CancellationToken ct) =>
            {
                var user = await me.LoadAsync(ct);
                var ctx = new StanleyActionContext(body.Plan, null, body.SailingId).Clean(body.SailingId);
                await store.PutAsync(user.Id, ctx.SailingId ?? "", ctx.Plan ?? [], clock.UtcNow, ct);
                return Results.NoContent();
            })
            .WithTags("Stanley")
            .WithSummary("Tells the server the day plan as the device lists it { sailingId, plan[{ id, title, start (HH:MM), day, listed }] }, up to 60 entries (titles and times only), so a plan change is checked against one saved plan. An empty plan clears it.");
        api.MapGet("/me/stanley/plan", async (string? sailing, ICurrentUser me, IStanleyPlanSnapshotStore store, CancellationToken ct) =>
                Results.Ok((await store.GetAsync((await me.LoadAsync(ct)).Id, sailing ?? "", ct)) ?? new StanleyPlanSnapshot([], default)))
            .WithTags("Stanley")
            .WithSummary("The day plan the server holds for the guest and sailing: { plan[], updatedAt }. Empty when none has been sent.");

        var polls = api.MapGroup("/me/stanley/polls").WithTags("Stanley");
        polls.MapGet("", async (string? booking, ICurrentUser me, StanleyPollService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), booking, ct)))
            .WithSummary("The group polls on a booking (the query `booking` is its number; the current trip when omitted), newest first: { id, question, options[{ id, label }], createdAt, closesAt, closed, mine, owner, myAnswers, status }. " +
                "status is the group status: totals per option, who is silent (a count, never names), the suggestion, whether a reminder is due and what remains. Nobody sees another person's answer.");
        polls.MapPost("", async (string? booking, StanleyPollRequest body, ICurrentUser me, StanleyPollService svc, CancellationToken ct) => Results.Ok(await svc.CreateAsync(await me.LoadAsync(ct), booking, body, ct)))
            .WithSummary("Makes a poll { question (up to 120), options (two to six, up to 40 characters each), days (1, 3 or 7) }. 400 question, options or days, 403 for a child account, 409 tooMany after five open polls.");
        polls.MapPut("/{id:guid}/answer", async (Guid id, string? booking, StanleyPollAnswerRequest body, ICurrentUser me, StanleyPollService svc, CancellationToken ct) => Results.Ok(await svc.AnswerAsync(await me.LoadAsync(ct), booking, id, body, ct)))
            .WithSummary("Answers one choice { optionId, answer (yes, maybe or no) } for the signed-in adult. 409 closed once the poll is closed or past its closing time; 404 for a poll on another booking.");
        polls.MapPost("/{id:guid}/{action}", async (Guid id, string action, string? booking, ICurrentUser me, StanleyPollService svc, CancellationToken ct) => Results.Ok(await svc.ControlAsync(await me.LoadAsync(ct), booking, id, action, ct)))
            .WithSummary("The maker closes a poll now (close) or gives it another day (extend). 404 for anyone else.");
        polls.MapDelete("/{id:guid}", async (Guid id, string? booking, ICurrentUser me, StanleyPollService svc, CancellationToken ct) => { await svc.DeleteAsync(await me.LoadAsync(ct), booking, id, ct); return Results.NoContent(); })
            .WithSummary("The maker removes a poll and every answer to it. 404 for anyone else.");

        var discover = api.MapGroup("/stanley/discover").WithTags("Stanley").AllowAnonymous();
        discover.MapPost("/interview", (DiscoverInterviewRequest body, StanleyDiscoverService svc) => Results.Ok(svc.Interview(body)))
            .WithSummary("Turns a free-text cruise wish (at most 500 characters) into editable filters by plain rules, with no model and nothing stored: { filters { months, nightsMin, nightsMax, regions, warm, maxTender, maxPerNightCents }, chips[{ key, label, assumed }], assumptions[], understood }. " +
                "Every gap Stanley filled is listed in assumptions and its chip is marked assumed, so the guest can change it. 400 text for nothing to read, 400 tooLong.");
        discover.MapPost("/directions", async (DiscoverDirectionsRequest body, StanleyDiscoverService svc, CancellationToken ct) => Results.Ok(await svc.DirectionsAsync(body, ct)))
            .WithSummary("Two to four distinct directions from the catalogue for the filters (edited or not): { directions[{ kind (bestFit, lowestPrice, mostPorts, calmest, another), label, sailingId, title, departure, nights, perNightCents, met[], missed[], noData[], tradeOffs[] }], considered, note (none or onlyOne) }. " +
                "Only sailings that have not departed and fit at least half of the checks with an answer are used; a check with no data is listed in noData, never counted as met or missed. 400 filters.");
        discover.MapPost("/compare", async (DiscoverCompareRequest body, StanleyDiscoverService svc, CancellationToken ct) => Results.Ok(await svc.CompareAsync(body, ct)))
            .WithSummary("Compares two to four sailings by criteria the guest weights from 0 to 5 (price, ports, seaDays, tender, fit; the default is 3 each): { rows[{ sailingId, title, score (0 to 100, or null with too little data), cells[{ key, text, known, fit }], missing[], portNotes[] }], weights, criteria[], ifYouValue[{ criterion, label, sailingIds[] }], priceBasis, note }. " +
                "Every figure is calculated from the catalogue; a criterion with no data is labelled and left out of the score; nothing is ranked by commercial preference. 400 sailings, weights or filters.");
        discover.MapPost("/booking-check", (BookingCheckRequest body, StanleyDiscoverService svc) => Results.Ok(svc.CheckBooking(body)))
            .WithSummary("Hints about likely slips in a name or date of birth before booking: { flags[{ field, code, text }], authority }. Nothing is stored. The booking validator stays the authority.");

        var brief = api.MapGroup("/me/stanley/discover/brief").WithTags("Stanley");
        brief.MapGet("", async (ICurrentUser me, StanleyDiscoverService svc, CancellationToken ct) => Results.Ok(await svc.GetBriefAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The signed-in guest's saved decision brief { brief { text, filters, shortlist[], weights, needs[], title }, updatedAt }, the same on every device. Empty with a null updatedAt when none is saved.");
        brief.MapPut("", async (DiscoverBrief body, ICurrentUser me, StanleyDiscoverService svc, CancellationToken ct) => Results.Ok(await svc.PutBriefAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Saves the brief, replacing the last one. At most 5 shortlisted sailings that exist, 6 needs of 60 characters, text of 500 and a title of 60. 400 brief, tooLong, filters, shortlist, weights or needs, 403 for a child account.");
        brief.MapDelete("", async (ICurrentUser me, StanleyDiscoverService svc, CancellationToken ct) => { await svc.DeleteBriefAsync(await me.LoadAsync(ct), ct); return Results.NoContent(); })
            .WithSummary("Deletes the saved brief.");
        brief.MapGet("/share", async (bool? includeNeeds, ICurrentUser me, StanleyDiscoverService svc, CancellationToken ct) => Results.Ok(new { text = await svc.ShareAsync(await me.LoadAsync(ct), includeNeeds == true, ct) }))
            .WithSummary("The \"our ideal cruise\" text of the saved brief { text } for sharing. Needs such as access or diet are left out unless includeNeeds is true. 404 when no brief is saved.");

        var planner = api.MapGroup("/me/stanley/plan").WithTags("Stanley");
        planner.MapPost("/shape", async (PlannerShapeRequest body, ICurrentUser me, StanleyPlannerService svc, CancellationToken ct) => Results.Ok(await svc.ShapeAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Shapes one day of the guest's own trip for a scenario (relaxed, active, family, culture, food, mixed) on top of the tours and dinner tables already booked: { day, scenario, segments[{ id, title, kind (tour, event, dinner), source (reserved, suggested), start, end, clock (port or ship), startAt, endAt, placeId, cost (free, included, paid), cents }], " +
                "conflicts[{ severity (hard, soft), code, ids[], text }], ready, backBy, windows[{ start, end, minutes }], notes[], traveller? }. Everything is placed in time on the right clock (a tour on the port's, the rest on the ship's); tender and landing buffers and walking times are counted. " +
                "A suggestion that overlaps, has no places left, is off, or would cause a hard conflict is left out and noted; what the guest holds is never moved; ready is false while any hard conflict stands. " +
                "Send mobility (any, easy, wheelchair) and optionally a saved travellerId, or traveller { name, mobility, pace (relaxed, steady, active), source (verified, reported, unknown), checkedOn } to get traveller { name, source, confidence (high, medium, low), changes[{ id, severity (change, check), text }], humanCheck, note }; a verification older than 180 days is treated as a report. Nothing is booked. 400 day, scenario, mobility or traveller, 404 without a confirmed trip.");
        planner.MapPost("/hour", async (PlannerHourRequest body, ICurrentUser me, StanleyPlannerService svc, CancellationToken ct) => Results.Ok(await svc.HourAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Up to three ways to spend the hour from a ship-time HH:mm: { from, to, options[{ kind (event, place), id, title, start, minutes, place, cost (free, included, paid), cents, walk, meets[] (quiet, nearby, childFriendly), why }], occupancy }. " +
                "Events are only those on and starting in time to walk there; places are only those with no event during the hour. Quiet means exactly that: there is no live crowd data and the answer says so. 400 badPlanner, day or mobility.");
        planner.MapPost("/evening", async (PlannerEveningRequest body, ICurrentUser me, StanleyPlannerService svc, CancellationToken ct) => Results.Ok(await svc.EveningAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Plan my evening: dinner (the guest's own table when booked), then a show, then a quiet last drink, in order with the walk between each: { steps[{ kind, title, start, end, place, walkFromPrevious, cost, source (reserved, suggested), route }], notes[], complete }. Booking dinner is done on the dining screen; nothing is booked here.");
        planner.MapPost("/preview", async (PlannerPreviewRequest body, ICurrentUser me, StanleyPlannerService svc, CancellationToken ct) => Results.Ok(await svc.PreviewAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("What adding a tour does to its whole day, before the guest adds it: { day, excursion, problem (alreadyBooked, soldOut, closed or null), readyBefore, readyAfter, newConflicts[], lost[] (suggestions it displaces), priceChangeCents (for the party), freeCancelUntil, freeCancelOpen }. 400 excursion.");
        planner.MapPost("/meeting", async (PlannerMeetingRequest body, ICurrentUser me, StanleyPlannerService svc, CancellationToken ct) => Results.Ok(await svc.MeetingAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Drafts the message \"meet at the atrium at 5:10, deck 5\" for a deck-plan place id and a ship-time HH:mm, with an optional note (100 characters) and, for a port day, the all-aboard reminder: { text, placeName, deck, section }. The guest sends it. 400 meeting.");
        planner.MapPost("/compare-tours", async (PlannerCompareRequest body, ICurrentUser me, StanleyPlannerService svc, CancellationToken ct) => Results.Ok(await svc.CompareAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Compares two excursions side by side for the guest's own party: { nameA, nameB, rows[{ key, a, b, differs }] (when, start, duration, exertion, transport, return, price, included, stepFree, places), risks[] (age, adult, timing, tender, sold out), missing[] (what the listing does not say) }. 400 excursion.");

        var travel = api.MapGroup("/me/stanley/travel").WithTags("Stanley");
        travel.MapGet("/flight", async (string? sailingId, ICurrentUser me, StanleyTravelService svc, CancellationToken ct) => Results.Ok(await svc.FlightAsync(await me.LoadAsync(ct), sailingId, ct)))
            .WithSummary("Rechecks the guest's saved onward flight (Onward travel screen) against the flight status feed on the last morning: { state (ok, noPlan, unknown), flight, status (onTime, delayed, cancelled, unknown, none), delayMinutes, provider, asOf (epoch ms), confidence (provider, none), flightAt, newFlightAt, clock, " +
                "verdict (ok, tight, tooEarly, noFlight, cancelled, noPlan, unknown), spare, leaveBy, offAt, alternatives[{ offOption, mode, offAt, leaveBy, spare, text }] (the ways off the ship that still work, only when the verdict is not ok), message (a draft for the guest to send), notes[] }. " +
                "Every time names its clock. A cancelled flight is never rebooked and the walk-off choice is never changed here. 404 when the guest has no current trip.");
        travel.MapPost("/traffic", async (TravelTrafficRequest body, ICurrentUser me, StanleyTravelService svc, CancellationToken ct) => Results.Ok(await svc.TrafficAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Traffic and weather on the way to the port on the sailing date for how busy the arrival window is (crowd: quiet, busy, busiest): { traffic, sky, leaveEarlierMinutes, provider, asOf, confidence, message (a draft for the driver or party), notes[] }. 400 crowd.");
        travel.MapPost("/port", async (TravelPortRequest body, ICurrentUser me, StanleyTravelService svc, CancellationToken ct) => Results.Ok(await svc.PortAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("An independent shore plan for a port day from interests (culture, nature, beach, shopping, quiet, family, food), mode (walk, taxi), minutes (60 to 720, default 240), distance (near or any) and mobility: { port, portName, day, clock, ashoreFrom, stops[{ id, kind, title, start, end, mode, travelMinutes, cost, cents, opens, closes, hours (typical), why }], " +
                "return { backBy, allAboard, bufferMinutes, clock, leaveLastStopBy, text }, notes[], complete }. Stops sit inside the day's real window and typical opening hours (never live ones) and never past the back-by time. 400 interests, mode, distance, mobility or day (not a port call).");
        travel.MapPost("/phrases", async (TravelPhraseRequest body, ICurrentUser me, StanleyTravelService svc, CancellationToken ct) => Results.Ok(await svc.PhrasesAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Phrases for a port day from the reviewed port guide: { port, language, phrases[{ id, say, means, sounds, label (reviewed), language }], showPerson? { text, language, label (Not translated) }, note }. With a query that matches no reviewed phrase nothing is machine-translated: showPerson holds the guest's own words in English to show to a person. 400 day or badTravel.");
        travel.MapPost("/read", async (TravelReadRequest body, ICurrentUser me, StanleyTravelService svc, CancellationToken ct) => Results.Ok(await svc.ReadAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Reads a sign or menu from a photo the guest chose to send (image: base64 of a JPEG, PNG or WebP of at most about 2 MB; contentType; day of the port): { state (read, unclear, refused), kind (sign, menu, document, unknown), lines[{ original, english, confidence (high, medium, low) }], label, note, cautions[] }. " +
                "A document (passport, ticket, ID) is refused whatever was asked and nothing of it is shown; nothing is stored, logged or kept. When no line is at least medium the state is unclear. Menus always carry the caution that Stanley cannot say what is in a dish. 400 image or day.");
        travel.MapPost("/connection", async (TravelConnectionRequest body, ICurrentUser me, StanleyTravelService svc, CancellationToken ct) => Results.Ok(await svc.ConnectionAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Whether a train, ferry or flight (kind) at a typed HH:mm on the last morning (the port's clock) can be made, from the way off the ship (offOption, default the guest's choice) and the way there (mode: airportTransfer, rideshare, hotelShuttle, parking): { kind, departAt, clock, bufferMinutes (3 hours flight, 60 ferry, 45 train), verdict (ok, tight, tooEarly), spare, leaveBy, offAt, earliestDeparture, message, notes[] }. No live status is given for trains or ferries. 400 connection.");
        travel.MapPost("/port-pack", async (TravelPackRequest body, ICurrentUser me, StanleyTravelService svc, CancellationToken ct) => Results.Ok(await svc.PackAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("The offline port pack for a port day, one document the device can keep with no signal: { version, port, portName, day, clock, allAboard, backBy, tender, contacts[], takeMeBack?, phrases[], notes[], laws[], basis }. version changes when the content does. 400 day (not a port call).");
        travel.MapPost("/embark-tour", async (TravelEmbarkRequest body, ICurrentUser me, StanleyTravelService svc, CancellationToken ct) => Results.Ok(await svc.EmbarkAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("A short tour of the guest's ship by goal (essentials, family, dining, quiet, access; at most five) and mobility: { goals[], steps[{ placeId, name, deck, section, goal, why, walkFromPrevious, stepFree, note }] (walking order, at most eight), notes[] }. 400 goals or mobility.");
        travel.MapGet("/entry", async (string? sailingId, ICurrentUser me, StanleyTravelService svc, CancellationToken ct) => Results.Ok(await svc.EntryAsync(await me.LoadAsync(ct), sailingId, ct)))
            .WithSummary("The official sources for entry, immigration and customs in each country the sailing touches: { sources[{ jurisdiction, authority, role, links[{ label, url }], note }], reviewedOn, note, modelAnswers (always false) }. Stanley never states an entry rule; the chat answers such questions with this list.");

        var travellers = api.MapGroup("/me/stanley/travellers").WithTags("Stanley");
        travellers.MapGet("", async (ICurrentUser me, StanleyTravellerService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The travellers the signed-in guest plans for, each as a sourced, dated access record: { travellers[{ id, name, mobility (any, easy, wheelchair), pace (relaxed, steady, active), source (verified, reported, unknown), checkedOn, note, asOf (set by the server when saved), confidence (high, medium, low), stale }], staleAfterDays, max }. " +
                "High confidence needs a verification no older than staleAfterDays; an older one counts as medium and a person is asked to check again. Only the guest's own, the same on every device.");
        travellers.MapPut("/{id}", async (string id, TravellerRecord body, ICurrentUser me, StanleyTravellerService svc, CancellationToken ct) => Results.Ok(await svc.SaveAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Saves one traveller (new or changed) and answers the list. A verified source needs checkedOn (yyyy-MM-dd, not in the future); other sources keep no date. At most 8 travellers, name of 30 characters, note of 100. 400 id, name, mobility, pace, source, note or checkedOn, 403 for a child account, 409 tooMany.");
        travellers.MapDelete("/{id}", async (string id, ICurrentUser me, StanleyTravellerService svc, CancellationToken ct) => Results.Ok(await svc.DeleteAsync(await me.LoadAsync(ct), id, ct)))
            .WithSummary("Forgets one traveller and answers the list. 404 when there is no such traveller.");

        var changes = api.MapGroup("/me/stanley/changes").WithTags("Stanley");
        changes.MapGet("", async (string? sailingId, string? saved, ICurrentUser me, StanleyChangeService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), sailingId, SavedList(saved), ct)))
            .WithSummary("The changes that matter to the guest's own trip now, most serious first: { asOf (epoch ms), asOfText (ship time), cards[{ id, fingerprint, kind (itinerary, portCall, venue, tender, weather, flight, reservation, order, case, spend), status (verified, provisional, forecast), source, sourceAt, sourceAtText, " +
                "consequence (safety, lostReservation, conflict, improvement, optional), critical, day, title, what, why, recommended { id, label, detail, action? { kind, args }, route? }, others[] (same shape, always ending with Ask a person), affects[{ kind, name, day, time }], ifNothing, tip, where[], noticedAt }], unread[] (sources that could not be read) }. " +
                "Only things the guest holds or has saved are reported (saved: comma-separated programme event ids, at most 30, added to those on the guest's phone alerts). A forecast is never critical. An option that would change something is a phase 5 action to prepare and confirm; nothing is cancelled, rebooked or paid from here. Empty with no current trip or with the changes switch off. 400 saved.");
        changes.MapGet("/missed", async (string? sailingId, string? saved, ICurrentUser me, StanleyChangeService svc, CancellationToken ct) => Results.Ok(await svc.MissedAsync(await me.LoadAsync(ct), sailingId, SavedList(saved), ct)))
            .WithSummary("\"What did I miss?\": the changes first noticed since the guest last caught up, ranked by the same order as the list: { since (epoch ms or null), cards[] (at most 5), total }. The first time there is nothing to compare with, so since is null and nothing is claimed as missed. Dismissed changes are left out. 400 saved.");
        changes.MapPost("/caught-up", async (ICurrentUser me, StanleyChangeService svc, CancellationToken ct) => { await svc.CaughtUpAsync(await me.LoadAsync(ct), ct); return Results.NoContent(); })
            .WithSummary("Marks the guest as caught up now, so what was new is no longer new.");
        changes.MapPost("/deliver", async (ChangeDeliveryRequest body, ICurrentUser me, StanleyChangeService svc, CancellationToken ct) => Results.Ok(await svc.DeliverAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("What to show on a screen now under the delivery rules. Send { screen (home, ship, port, plan, travel), level (off, affects, suggest, guide: the guest's proactivity), shown[] (suggestion ids already shown this session, at most 20), saved[], sailingId }. " +
                "Answers { alerts[] (safety or deadline risks and lost reservations, at most 3: they ignore quiet hours and the session count and only an acknowledgement hides them), suggestion (at most one, or null), held[{ id, reason (off, dismissed, level, screen, shown, sessionCap, quiet, oneOnScreen, alertCap) }] }. " +
                "A suggestion needs the guest's level, no quiet hours (their own notification setting), fewer than three shown this session and a card that suits the screen. A dismissed card stays dismissed until its facts change. 400 screen, level, shown or saved.");
        changes.MapGet("/{id}/explain", async (string id, string? sailingId, string? saved, ICurrentUser me, StanleyChangeService svc, CancellationToken ct) => Results.Ok(await svc.ExplainAsync(await me.LoadAsync(ct), id, sailingId, SavedList(saved), ct)))
            .WithSummary("Explain this change: the six questions answered from the change card alone, never from chat history: { id, title, questions[{ key (what, sure, affects, recommend, others, nothing), question, answer }] }. 404 when there is no such change now.");
        changes.MapPost("/{id}/dismiss", async (string id, ChangeDismissRequest body, ICurrentUser me, StanleyChangeService svc, CancellationToken ct) => Results.Ok(await svc.DismissAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Dismisses one change in the form the guest saw (send its fingerprint). It stays dismissed until its facts change, when it comes back as a new card. Answers the list without it. 400 fingerprint, 404 when there is no such change.");

        var money = api.MapGroup("/me/stanley/money").WithTags("Stanley");
        money.MapGet("/budget", async (ICurrentUser me, StanleyMoneyService svc, CancellationToken ct) => Results.Ok(await svc.GetBudgetAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The trip budget the guest let Stanley watch: { cents } (null when none). It is only used to compare the guest's spending with it; nothing is blocked by it.");
        money.MapPut("/budget", async (BudgetRequest body, ICurrentUser me, StanleyMoneyService svc, CancellationToken ct) => Results.Ok(await svc.SetBudgetAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Sets (cents, 1 to 100,000,000) or clears (cents null) the budget Stanley watches. Setting it is what lets the mid-week spend pace card appear, under the same delivery rules and proactivity level as every other suggestion. 400 budget, 403 for a child account, 409 off.");
        money.MapPost("/entitlement", async (EntitlementRequest body, ICurrentUser me, StanleyMoneyService svc, CancellationToken ct) => Results.Ok(await svc.EntitlementAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Is this included for me? Send { item (drink, wifi, specialty, excursion, gratuity, laundry, priority), traveller (a first name or id on the booking, default the guest), everyone (true for the whole booking), priceCents (a drink price the guest gives, 1 to 500,000), alcohol }. " +
                "Answers { asOf, answers[{ item, traveller, verdict (included, partly, notIncluded, allUsed), lines[], basis, youPayCents (set only when the rule can work it out) }], note }. Worked out from each traveller's own entitlements and what is left of them; a person under 21 is never offered alcohol. " +
                "400 item, price or traveller, 403 child account, 404 no current trip, 409 off.");
        money.MapPost("/scenario", async (ScenarioRequest body, ICurrentUser me, StanleyMoneyService svc, CancellationToken ct) => Results.Ok(await svc.ScenarioAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("If we book this, what will the family total be? Send { items[1 to 5] { kind (addOn, upgrade, excursion), id, guests[] (party ids; default everyone eligible) } }. " +
                "Answers { now { packages, tours, dining }, adds[{ kind, id, label, units, unitCents, totalCents, basis }], addedCents, newTotalCents, budgetCents, leftCents, state (noBudget, within, near, over), lines[], notCounted[], illustrative (always true) }. " +
                "It sums today's prices, counts extras only (never the fare or onboard spending), and books nothing. 400 items, item, guests or kind.");
        money.MapGet("/pace", async (string? sailingId, ICurrentUser me, StanleyMoneyService svc, CancellationToken ct) => Results.Ok(await svc.PaceAsync(await me.LoadAsync(ct), sailingId, ct)))
            .WithSummary("Spending pace against the guest's budget: { state (noBudget, tooEarly, onTrack, near, over), budgetCents, committedCents, onboardCents, pendingCents, day, nights, projectedOnboardCents, projectedTotalCents, overCents, lines[], illustrative }. " +
                "A straight line from what the onboard account has charged so far, plus what was planned before sailing; always labelled illustrative, and not given for the first two days.");
        money.MapGet("/folio", async (string? sailingId, ICurrentUser me, StanleyMoneyService svc, CancellationToken ct) => Results.Ok(await svc.FolioAsync(await me.LoadAsync(ct), sailingId, ct)))
            .WithSummary("Explains the onboard account with posted, pending, questioned, adjusted and refunded lines kept apart: { asOf, final, throughDay, postedCents, pendingCents, creditsCents, coveredCents, groups[{ state, heading, meaning, cents, count, lines[{ id, short, day, at, description, guest, category, cents, state, why, caseReference }] }], estimate? { cents, text, illustrative } (kept apart from posted and pending), lines[] }. " +
                "final is true on the last day of the cruise. A line the guest has questioned shows its case reference and is never shown as settled.");
        money.MapPost("/dispute", async (DisputeRequest body, ICurrentUser me, StanleyMoneyService svc, CancellationToken ct) => Results.Ok(await svc.DisputeAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("The guest questions one charge. Send { lineId (an id or short code from the folio explanation), note (up to 300 characters), consent (must be true) }. The line is read from their own account on the server; a billing case is opened through the handoff and the answer is that case (reference, owner, status, next update). " +
                "The charge is not changed and the case is never marked resolved: a person answers. 400 line, consent or tooLong, 404 no such line, 409 alreadyQuestioned, tooManyCases or off.");
        money.MapPost("/package-value", async (PackageUseRequest body, ICurrentUser me, StanleyMoneyService svc, CancellationToken ct) => Results.Ok(await svc.PackageValueAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Compares each add-on with paying as you go, for the use the guest chose: send { drinksPerDay (0 to 12), wifiDays (0 to 30), specialtyDinners (0 to 10), guests[] }. Answers { asOf, rows[{ id, name, people, packageCents, payAsYouGoCents, differenceCents, verdict (worth, notWorth, even, nobody), basis, lines[] }], lines[], illustrative }. " +
                "People already covered are left out. An illustration of the chosen use, not a prediction or a recommendation.");
        money.MapGet("/loyalty", async (ICurrentUser me, StanleyMoneyService svc, CancellationToken ct) => Results.Ok(await svc.LoyaltyAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("Captain's Circle progress and credits from the loyalty record: { asOf, tier, days, nextTier, daysToNext, counted, credits[{ source, remainingCents, expiresOn, daysLeft, expired, expiresSoon }], usableCreditCents, perks[], lines[] }. " +
                "Never a promise of a level: what would follow if this cruise is counted is worded as such, and Princess confirms levels and credits.");

        api.MapPost("/stanley/group/status", (GroupStatusRequest body, StanleyPlannerService svc) => Results.Ok(svc.GroupStatus(body)))
            .WithTags("Stanley").AllowAnonymous()
            .WithSummary("The state of a group poll from the answers sent (2 to 6 options, 1 to 20 members, each answer yes, maybe or no; no reasons are accepted): { state (open, expired, closed), answered, silent, tally[], suggestion { kind (clear, leading, tie, compromise, none), optionIds[], text }, reminderDue, reminderText, remains[], controls[], note }. " +
                "Silence is never counted as a yes. Nothing is stored. 400 question, options, members, answers or times.");

        var handoffs = api.MapGroup("/me/stanley/handoffs").WithTags("Stanley");
        handoffs.MapPost("/photo", async (HttpRequest req, ICurrentUser me, StanleyHandoffPhotoService svc, CancellationToken ct) =>
            {
                // The picture is the request body (image/jpeg or image/png). No more than the limit plus one byte is read, so a huge body is refused without being kept.
                if (req.ContentLength > StanleyHandoffPhotoRules.MaxBytes) throw ApiException.Invalid("size");
                using var buffer = new MemoryStream();
                var chunk = new byte[16 * 1024];
                int n;
                while ((n = await req.Body.ReadAsync(chunk, ct)) > 0)
                {
                    buffer.Write(chunk, 0, n);
                    if (buffer.Length > StanleyHandoffPhotoRules.MaxBytes) throw ApiException.Invalid("size");
                }
                return Results.Ok(await svc.UploadAsync(await me.LoadAsync(ct), buffer.ToArray(), ct));
            })
            .WithSummary("Keeps a photo for a handoff case (a lost item, a receipt): the request body is a JPEG or PNG of at most 5 MB. The metadata (place, time, camera) is removed before it is kept. Answers { id, type, bytes }; send the id as the case's attachment. " +
                "400 empty, size, type, unreadable or scan, 403 for a child account, 409 tooMany when three are already waiting. A photo is deleted with its case, and one never attached is deleted after a day.");
        handoffs.MapGet("/photo/{id}", async (string id, ICurrentUser me, StanleyHandoffPhotoService svc, CancellationToken ct) =>
            {
                var (data, type) = await svc.OpenAsync(await me.LoadAsync(ct), id, ct);
                return Results.File(data, type);
            })
            .WithSummary("The photo itself, for the guest who sent it. 404 for anyone else's or one that is gone.");
        handoffs.MapDelete("/photo/{id}", async (string id, ICurrentUser me, StanleyHandoffPhotoService svc, CancellationToken ct) => { await svc.DeleteAsync(await me.LoadAsync(ct), id, ct); return Results.NoContent(); })
            .WithSummary("Deletes one of the guest's photos at once. 404 for anyone else's.");
        handoffs.MapPost("", async (StanleyHandoffRequest body, ICurrentUser me, StanleyHandoffService svc, CancellationToken ct) =>
                Results.Ok(await svc.CreateAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Hands the guest to a person and opens a case. Send { topic (person, cabin, lostProperty, billing, allergy, special, disruption or missedShip), issue (at most 1000 characters), outcome (what the guest wants, at most 200), reference (booking or order number, at most 40), tried (what was tried, at most 300), attachment (a note naming an attachment the guest approved, at most 120), role (guest, organiser or caregiver), consent (must be true: the guest saw the exact text) }. " +
                "Answers { id, topic, reference (GS- and six characters), owner, status (submitted, acknowledged or fulfilled), openedAt, nextUpdateAt, overdue, escalated, issue, outcome, source }. The device says it has handed the guest over only from this answer. An emergency is not a topic: it only shows the numbers. " +
                "400 consent, topic, issue, tooLong or role, 403 for a child account, 409 off when the handoff switch is off, 409 tooManyCases after ten in a day.");
        handoffs.MapGet("", async (ICurrentUser me, StanleyHandoffService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The guest's handoff cases, newest first (up to 50), each with its owner, status, next update time and whether it is overdue or escalated.");
        handoffs.MapGet("/{id:guid}", async (Guid id, ICurrentUser me, StanleyHandoffService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), id, ct)))
            .WithSummary("One handoff case as it stands now. 404 for one that is not yours.");

        api.MapGet("/me/stanley/handoff-outcomes", async (ICurrentUser me, IStanleyHandoffStore store, IClock clock, int? days, CancellationToken ct) =>
            {
                var user = await me.LoadAsync(ct);
                if (user.Role != "admin") throw ApiException.Forbidden();
                var now = clock.UtcNow;
                var since = now.AddDays(-Math.Clamp(days ?? 7, 1, 90));
                var rows = await store.SinceAsync(since, 5000, ct);
                return Results.Ok(StanleyHandoffRules.Outcomes(rows.Select(r => (r.Topic, r.OpenedAt)), since, now));
            })
            .WithTags("Stanley")
            .WithSummary("Administrators only (403 otherwise): handed-over cases of the last days (default 7, 1 to 90) by topic, with how many are fulfilled, overdue or escalated and the share not overdue. Counts only: no guest and no words. The desk is simulated, so this is a proxy for how handoffs fare, not the precision of the decision to hand over.");

        api.MapGet("/me/stanley/tiers", async (ICurrentUser me, IStanleyTierLog tiers, IClock clock, int? days, CancellationToken ct) =>
            {
                var user = await me.LoadAsync(ct);
                if (user.Role != "admin") throw ApiException.Forbidden();
                return Results.Ok(await tiers.SummaryAsync(clock.UtcNow.AddDays(-Math.Clamp(days ?? 7, 1, 90)), ct));
            })
            .WithTags("Stanley")
            .WithSummary("Administrators only (403 otherwise): Stanley's replies over the last days (default 7, 1 to 90), counted by tier, source, stage, topic, outcome and model tier, with model calls and tokens. Counts only: no message text and no guest. cards lists the resolver cards answered at least twice with how often each said it could not answer (top 10).");
    }

    /// <summary>The comma-separated <c>saved</c> query as a list of ids (checked by the service); null when none is sent.</summary>
    private static List<string>? SavedList(string? saved) =>
        string.IsNullOrWhiteSpace(saved) ? null : [.. saved.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Take(StanleyChangeRules.MaxSaved + 1)];
}

/// <summary>Body of <c>PUT /me/stanley/plan</c>.</summary>
public sealed record StanleyPlanSnapshotRequest(string? SailingId, List<StanleyPlanEntry>? Plan);

/// <summary>Body of <c>POST /me/stanley/actions/prepare</c>.</summary>
public sealed record StanleyPrepareRequest(string? Kind, Dictionary<string, string>? Args, StanleyActionContext? Context);

/// <summary>Body of confirm and undo: the idempotency key (confirm only) and what the device knows of its own plan.</summary>
public sealed record StanleyConfirmRequest(string? Key, StanleyActionContext? Context);
