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
            .WithSummary("Prepares a change as a preview and does nothing else. Send { kind (order_item, add_excursion, move_dinner, reserve_dinner, draft_case, plan_change or remind_me), args (plain strings, for example item and qty), context { plan[{ id, title, start, day, listed }], allAboard { at, label }, sailingId } }. " +
                "Answers the action { id, kind, status (prepared), title, lines[], who[], cents, terms, expiresAt, onDevice, params }: the exact items, who is affected, any price, the cancellation terms and an expiry ten minutes ahead. " +
                "400 badAction for a kind or detail that is not allowed, 403 for a child account, 409 off when the actions switch is off, and the same 400, 404 and 409 codes the service behind the action gives.");
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
        memory.MapPut("/settings", async (StanleyMemorySettingsRequest body, ICurrentUser me, StanleyMemoryService svc, CancellationToken ct) => { await svc.SetEnabledAsync(await me.LoadAsync(ct), body.Enabled, ct); return Results.NoContent(); })
            .WithSummary("Switches Stanley's memory on or off { enabled }. Off, no remembered item is used in an answer; items stay listed until forgotten.");

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

/// <summary>Body of <c>POST /me/stanley/actions/prepare</c>.</summary>
public sealed record StanleyPrepareRequest(string? Kind, Dictionary<string, string>? Args, StanleyActionContext? Context);

/// <summary>Body of confirm and undo: the idempotency key (confirm only) and what the device knows of its own plan.</summary>
public sealed record StanleyConfirmRequest(string? Key, StanleyActionContext? Context);
