using System.Text.Json;
using Microsoft.Extensions.Options;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Online check-in, the boarding passes and embarkation day. Ports the <c>checkin</c> and <c>boarding</c> groups of <c>src/api/checkinMock.ts</c>.
/// Any guest on the booking may read; an adult guest writes (a parent completes every step for a child). Check-in opens three days before sailing and closes
/// at 10:00 on sailing day, on the person's own clock (D4). The pass lookup is public and answers a uniform <c>notFound</c>.
/// </summary>
public sealed class CheckinService(
    ScopeLoader scopes, ICheckinStore store, IAccountStore accounts, ITripStore trips, IPlanStore plan, PlanService planService, IUserStore users, IUserClock clock, IOptions<JwtOptions> jwt)
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
    private static long Ms(DateTime utc) => TripRules.ToMs(utc);
    private static DateTime Utc(DateTime d) => DateTime.SpecifyKind(d, DateTimeKind.Utc);
    private static DateOnly D(DateTime d) => DateOnly.FromDateTime(d);
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");

    private string Key => jwt.Value.SigningKey;

    // ---- State ----

    /// <summary>The check-in window on the clock, whether or not check-in was finished.</summary>
    private static string WindowOf(Scope c) => TripRules.CheckinWindow(c.Now, TripRules.CheckinOpensAt(c.Departure), TripRules.CheckinClosesAt(c.Departure));

    private static CheckinStatusDto StatusOf(DateOnly departure, DateTime now, CheckinBookingRow? bk) =>
        new(CheckinRules.State(bk?.FinishedAt is not null, now, TripRules.CheckinOpensAt(departure), TripRules.CheckinClosesAt(departure)),
            Ms(TripRules.CheckinOpensAt(departure)), Ms(TripRules.CheckinClosesAt(departure)));

    /// <summary>Writes need an adult guest on a confirmed booking while the window is open. A finished check-in can still be corrected until it closes.</summary>
    private async Task<Scope> OpenAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (!c.Confirmed) throw ApiException.Conflict("closed");
        var w = WindowOf(c);
        if (w != "open") throw ApiException.Conflict(w);
        return c;
    }

    private static Dictionary<long, Dictionary<string, CheckinStepRow>> ByGuest(IEnumerable<CheckinStepRow> rows) =>
        rows.GroupBy(r => r.UserId).ToDictionary(g => g.Key, g => g.ToDictionary(r => r.Step));

    private static string? S(JsonElement e, string name) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    /// <summary>Reads one guest's stored answers. Unreadable data reads as not answered, so a damaged row never blocks the screen.</summary>
    private static GuestRecordDto RecordOf(IReadOnlyDictionary<string, CheckinStepRow>? steps)
    {
        if (steps is null) return new GuestRecordDto(null, null, null, null, null, null);
        JsonElement Data(string step)
        {
            try { return JsonDocument.Parse(steps[step].Data).RootElement.Clone(); }
            catch (JsonException) { return default; }
        }
        long At(string step) => Ms(Utc(steps[step].DoneAt));
        StepAtDto? Plain(string step) => steps.ContainsKey(step) ? new StepAtDto(At(step)) : null;

        DocumentStepDto? doc = null;
        if (steps.ContainsKey("document") && Data("document") is { ValueKind: JsonValueKind.Object } d && S(d, "kind") is "passport" or "birthCertificate")
            doc = new DocumentStepDto(S(d, "kind")!, S(d, "country") ?? "", S(d, "last4") ?? "", S(d, "expires") ?? "", At("document"));
        EmergencyStepDto? emergency = null;
        if (steps.ContainsKey("emergency") && Data("emergency") is { ValueKind: JsonValueKind.Object } e)
            emergency = new EmergencyStepDto(S(e, "name") ?? "", S(e, "phone") ?? "", S(e, "relationship") ?? "", At("emergency"));
        ContractStepDto? contract = null;
        if (steps.ContainsKey("contract") && Data("contract") is { ValueKind: JsonValueKind.Object } k)
            contract = new ContractStepDto(S(k, "version") ?? "", At("contract"), S(k, "by") ?? "");
        HealthStepDto? health = null;
        if (steps.ContainsKey("health") && Data("health") is { ValueKind: JsonValueKind.Object } h && h.TryGetProperty("answers", out var a) && a.ValueKind == JsonValueKind.Object)
        {
            var answers = a.EnumerateObject().Where(p => p.Value.ValueKind is JsonValueKind.True or JsonValueKind.False).ToDictionary(p => p.Name, p => p.Value.GetBoolean());
            if (CheckinRules.HealthQuestions.All(answers.ContainsKey)) health = new HealthStepDto(answers, answers.Values.Any(v => v), At("health"));
        }
        return new GuestRecordDto(Plain("confirm"), doc, Plain("photo"), emergency, contract, health);
    }

    private static HashSet<string> DoneSteps(GuestRecordDto r)
    {
        var done = new HashSet<string>();
        if (r.Confirm is not null) done.Add("confirm");
        if (r.Document is not null) done.Add("document");
        if (r.Photo is not null) done.Add("photo");
        if (r.Emergency is not null) done.Add("emergency");
        if (r.Contract is not null) done.Add("contract");
        if (r.Health is not null) done.Add("health");
        return done;
    }

    private async Task<TravelPlan> TravelAsync(long bookingId, bool priority, CancellationToken ct)
    {
        var t = await plan.GetTravelAsync(bookingId, ct);
        return PlanRules.Normalize(t is null ? null : new TravelPlan(t.Window, t.Mode, t.Hotel), priority);
    }

    // ---- The check-in view ----

    private async Task<CheckinViewDto> BuildViewAsync(Scope c, CancellationToken ct)
    {
        var bk = await store.GetBookingAsync(c.Booking.BookingId, ct);
        var priority = await planService.HasPriorityAsync(c.Actor, c.Booking, ct);
        var travel = await TravelAsync(c.Booking.BookingId, priority, ct);
        var cards = await trips.ListCardsAsync(c.Actor.Id, ct);
        var steps = ByGuest(await store.ListStepsAsync(c.Booking.BookingId, ct));
        var party = await accounts.GetPartyAsync(c.Booking.BookingId, ct);
        var bookerProfile = await accounts.GetProfileAsync(c.Booking.BookerUserId, ct);

        var guests = new List<CheckinGuestDto>();
        foreach (var g in party)
        {
            var profile = await accounts.GetProfileAsync(g.UserId, ct);
            var record = RecordOf(steps.GetValueOrDefault(g.UserId));
            var own = profile is { EmergencyName.Length: > 0 } && !string.IsNullOrWhiteSpace(profile.EmergencyName) ? profile : bookerProfile;
            var birthCertificateOnly = g.Citizenship == "us" && !g.Held.ContainsKey("passport") && g.Held.ContainsKey("birthCertificate");
            var passport = g.Held.TryGetValue("passport", out var exp) && exp is { } e ? Iso(D(e)) : "";
            guests.Add(new CheckinGuestDto(
                g.PublicId, AccountService.FullName(g), g.FirstName, AccountRules.AgeOn(D(g.Dob), c.Departure), g.IsSupervised, g.Citizenship, record, CheckinRules.GuestProgressOf(DoneSteps(record)),
                new GuestDefaultsDto(new EmergencyDto(own?.EmergencyName ?? "", own?.EmergencyPhone ?? "", own?.EmergencyRelationship ?? ""), birthCertificateOnly ? "birthCertificate" : "passport", passport)));
        }

        var progress = CheckinRules.ProgressOf([.. guests.Select(g => (g.Id, g.Progress))], bk?.PaymentCardId is not null, travel.Window is not null);
        var payment = bk is { PaymentCardId: { } cardId, PaymentLabel: { } label, PaymentAt: { } at }
            ? new CheckinPaymentDto(cards.FirstOrDefault(x => x.Id == cardId)?.PublicId, label, Ms(Utc(at)))
            : null;
        return new CheckinViewDto(
            StatusOf(c.Departure, c.Now, bk), guests, payment, travel.Window, [.. cards.Select(x => new CardDto(x.PublicId, x.Brand, x.Last4, x.Expiry))], PlanRules.ArrivalWindows(priority), priority,
            PlanRules.SuggestedWindow(priority), progress, Iso(DocumentService.ReturnDate(c.Booking.Departure, c.Booking.Nights)), !c.Actor.IsSupervised && WindowOf(c) != "closed",
            bk?.FinishedAt is { } f ? Ms(Utc(f)) : null);
    }

    public async Task<CheckinStatusDto> StatusAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        return StatusOf(c.Departure, c.Now, await store.GetBookingAsync(c.Booking.BookingId, ct));
    }

    public async Task<CheckinViewDto> ViewAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await BuildViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    // ---- Saving a step ----

    private static string Trim(string? s, int max) => AccountRules.Trunc((s ?? "").Trim(), max);

    public async Task<CheckinViewDto> SaveAsync(UserRecord actor, string? number, string step, CheckinSaveRequest? req, CancellationToken ct)
    {
        if (!CheckinRules.StepOrder.Contains(step)) throw ApiException.Invalid("step");
        var c = await OpenAsync(actor, number, ct);
        if (req is null) throw ApiException.Invalid("step");
        var party = await accounts.GetPartyAsync(c.Booking.BookingId, ct);
        var bookingId = c.Booking.BookingId;
        var names = (IEnumerable<ScopePerson> people) => string.Join(", ", people.Select(p => p.First));

        switch (step)
        {
            case "confirm":
            {
                var people = c.GuestsIn(req.Guests);
                await store.SaveStepAsync(bookingId, step, [.. people.Select(p => p.UserId)], c.Now, "{}", ct);
                await Log(c, $"Details confirmed for {names(people)}", ct);
                break;
            }
            case "document":
            {
                var person = c.GuestsIn(req.Guest is { } g ? [g] : null)[0];
                var citizenship = party.First(x => x.UserId == person.UserId).Citizenship;
                var problem = CheckinRules.ValidateDocument(req.Kind, req.Country, req.Number, req.Expires, citizenship, DocumentService.ReturnDate(c.Booking.Departure, c.Booking.Nights));
                if (problem is not null) throw ApiException.Invalid($"document:{problem}");
                var passport = req.Kind == "passport";
                var data = JsonSerializer.Serialize(new
                {
                    kind = req.Kind,
                    country = passport ? req.Country!.Trim() : "United States",
                    last4 = passport ? CheckinRules.NormalizePassportNumber(req.Number!)[^4..] : "",
                    expires = passport ? req.Expires : "",
                }, Web);
                await store.SaveStepAsync(bookingId, step, [person.UserId], c.Now, data, ct);
                await Log(c, $"{(passport ? "Passport" : "Birth certificate")} for {person.First}", ct);
                break;
            }
            case "photo":
            {
                var person = c.GuestsIn(req.Guest is { } g ? [g] : null)[0];
                var problems = CheckinRules.JudgePhoto(req.Metrics);
                if (problems.Count > 0) throw ApiException.Invalid($"photo:{string.Join(',', problems)}");
                await store.SaveStepAsync(bookingId, step, [person.UserId], c.Now, "{}", ct);
                await Log(c, $"Security photo for {person.First}", ct);
                break;
            }
            case "emergency":
            {
                var people = c.GuestsIn(req.Guests);
                var (name, phone, relationship) = (Trim(req.Name, 80), Trim(req.Phone, 30), Trim(req.Relationship, 40));
                var problem = CheckinRules.ValidateEmergency(name, phone, relationship, party.Select(AccountService.FullName));
                if (problem is not null) throw ApiException.Invalid($"emergency:{problem}");
                await store.SaveStepAsync(bookingId, step, [.. people.Select(p => p.UserId)], c.Now, JsonSerializer.Serialize(new { name, phone, relationship }, Web), ct);
                await Log(c, "Emergency contact", ct);
                break;
            }
            case "contract":
            {
                var people = c.GuestsIn(req.Guests);
                await store.SaveStepAsync(bookingId, step, [.. people.Select(p => p.UserId)], c.Now, JsonSerializer.Serialize(new { version = CheckinRules.ContractVersion, by = c.Actor.PublicId }, Web), ct);
                await Log(c, $"Contract accepted for {names(people)}", ct);
                break;
            }
            case "health":
            {
                var person = c.GuestsIn(req.Guest is { } g ? [g] : null)[0];
                var v = CheckinRules.ValidateHealth(req.Answers) ?? throw ApiException.Invalid("health:answers");
                await store.SaveStepAsync(bookingId, step, [person.UserId], c.Now, JsonSerializer.Serialize(new { answers = v.Answers, v.Flagged }, Web), ct);
                await Log(c, $"Health questions for {person.First}", ct);
                break;
            }
            case "payment":
            {
                var card = (await trips.ListCardsAsync(c.Actor.Id, ct)).FirstOrDefault(x => x.PublicId == req.CardId);
                if (card is null || AccountRules.ValidateCard(card.Brand, card.Last4, card.Expiry, c.Today) is not null) throw ApiException.Invalid("payment:card");
                var label = $"{TripService.BrandName(card.Brand)} ending {card.Last4}";
                if (card.Last4 == Pricing.DeclinedLast4) throw ApiException.Declined(label);
                await store.SavePaymentAsync(bookingId, card.Id, label, c.Now, ct);
                await Log(c, $"Onboard account card {label}", ct);
                break;
            }
            case "arrival":
            {
                var priority = await planService.HasPriorityAsync(c.Actor, c.Booking, ct);
                if (!PlanRules.IsWindow(req.Window, priority)) throw ApiException.Invalid("arrival:window");
                var stored = await plan.GetTravelAsync(bookingId, ct);
                await plan.SaveTravelAsync(bookingId, new TravelRow { Window = req.Window, Mode = stored?.Mode, Hotel = stored?.Hotel }, ct);
                await store.SaveArrivalAsync(bookingId, PlanRules.WindowId(req.Window!), c.Now, ct);
                await accounts.AddHistoryAsync(c.Actor.Id, c.Actor.Id, "travel", $"Arrive {req.Window}", c.Now, ct);
                break;
            }
        }
        return await BuildViewAsync(c, ct);
    }

    private Task Log(Scope c, string detail, CancellationToken ct) => accounts.AddHistoryAsync(c.Actor.Id, c.Actor.Id, "checkin", detail, c.Now, ct);

    // ---- Finishing ----

    public async Task<CheckinStatusDto> SubmitAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var bk = await store.GetBookingAsync(c.Booking.BookingId, ct);
        if (bk?.FinishedAt is not null) return StatusOf(c.Departure, c.Now, bk);
        await OpenAsync(actor, number, ct);
        if (!(await BuildViewAsync(c, ct)).Progress.Complete) throw ApiException.Conflict("incomplete");
        await store.FinishAsync(c.Booking.BookingId, c.Now, ct);
        await Log(c, "Online check-in finished", ct);
        await IssuePassesAsync(c.Actor, c.Booking, c.Now, ct);
        return StatusOf(c.Departure, c.Now, await store.GetBookingAsync(c.Booking.BookingId, ct));
    }

    // ---- The receipt: what we have on file (CHK-13) ----

    public async Task<ReceiptViewDto> ReceiptAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        var v = await BuildViewAsync(c, ct);
        var bk = await store.GetBookingAsync(c.Booking.BookingId, ct);
        static ReceiptItemDto Item(string step, long? at, string? detail) => new(step, at is null ? null : detail, at);
        var guests = v.Guests.Select(g =>
        {
            var r = g.Record;
            return new ReceiptGuestDto(g.Id, g.Name,
            [
                Item("confirm", r.Confirm?.At, null),
                Item("document", r.Document?.At, r.Document is null ? null : r.Document.Kind == "passport" ? $"Passport ending {r.Document.Last4}, {r.Document.Country}" : "Birth certificate (certified copy)"),
                Item("photo", r.Photo?.At, "Photo accepted"),
                Item("emergency", r.Emergency?.At, r.Emergency is null ? null : $"{r.Emergency.Name}, {r.Emergency.Phone}"),
                Item("contract", r.Contract?.At, r.Contract is null ? null : $"Version {r.Contract.Version}"),
                Item("health", r.Health?.At, r.Health?.Flagged == true ? "Answered; a nurse will talk with you at the terminal" : "Answered"),
            ]);
        }).ToList();
        // The window may have been chosen on the travel screen, which keeps no time of its own, so the detail is shown with no time when there is none.
        var arrival = new ReceiptItemDto("arrival", v.Arrival is null ? null : $"Arrive {v.Arrival}", bk?.ArrivalAt is { } a ? Ms(Utc(a)) : null);
        return new ReceiptViewDto(c.Booking.Number, guests, [Item("payment", v.Payment?.At, v.Payment?.Label), arrival], v.Progress.Complete, v.FinishedAt);
    }

    // ---- Boarding pass ----

    private async Task<List<PassRow>> IssuePassesAsync(UserRecord viewer, BookingRow booking, DateTime now, CancellationToken ct)
    {
        var view = await BoardingAsync(viewer, booking, now, ct);
        var party = await accounts.GetPartyAsync(booking.BookingId, ct);
        var rows = view.Passes.Where(p => p.Ready).Select(p => new PassRow { UserId = party.First(g => g.PublicId == p.Id).UserId, Seq = p.Seq, Code = p.Code }).ToList();
        if (rows.Count > 0) await store.SavePassesAsync(booking.BookingId, rows, now, ct);
        return rows;
    }

    /// <summary>The passes for a booking. The QR text is worked out from the booking each time (the signature makes it the same for the same details) and kept on first issue.</summary>
    private async Task<BoardingViewDto> BoardingAsync(UserRecord viewer, BookingRow booking, DateTime now, CancellationToken ct)
    {
        var bk = await store.GetBookingAsync(booking.BookingId, ct);
        var done = bk?.FinishedAt is not null;
        var priority = await planService.HasPriorityAsync(viewer, booking, ct);
        var travel = await TravelAsync(booking.BookingId, priority, ct);
        var needsStepFree = (await accounts.GetProfileAsync(booking.BookerUserId, ct))?.Needs.Contains("mobility") == true;
        var place = BoardingRules.AssignmentFor(booking.Number, booking.SailingId, booking.CategoryId, booking.CabinNumber, needsStepFree);
        var group = BoardingRules.BoardingGroup(priority, travel.Window);
        var departure = Iso(D(booking.Departure));
        var party = (await accounts.GetPartyAsync(booking.BookingId, ct)).OrderBy(g => g.Seq).ToList();
        var passes = party.Select(g =>
        {
            var printed = BoardingRules.PassName(g.FirstName, g.LastName);
            var code = done ? BoardingRules.EncodePass(Key, new PassData(booking.Number, g.Seq, printed, departure, place.Number, group)) : "";
            return new GuestPassDto(g.PublicId, AccountService.FullName(g), printed, g.Seq, done, code, place.Number, place.Deck, place.Muster, group);
        }).ToList();
        var window = BoardingRules.WindowFor(travel.Window, priority);
        var stored = await store.ListPassesAsync(booking.BookingId, ct);
        var embark = await store.GetEmbarkAsync(booking.BookingId, ct);
        return new BoardingViewDto(
            booking.Number, departure, done, BoardingRules.LaneFor(done), BoardingRules.TerminalFor(embark?.Terminal), window, window is null ? null : BoardingRules.WaitMinutes(window.Crowd), passes,
            stored.Count > 0 && stored.All(p => p.InWallet), Ms(now));
    }

    public async Task<BoardingViewDto> PassAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        return await BoardingAsync(c.Actor, c.Booking, c.Now, ct);
    }

    /// <summary>The pass for a booking number and any guest's last name, with no sign-in. Every mismatch is the same <c>notFound</c>, so a stranger learns nothing.</summary>
    public async Task<BoardingViewDto> LookupAsync(string? number, string? lastName, CancellationToken ct)
    {
        var n = AccessRules.NormalizeBookingNumber(number);
        var last = lastName?.Trim().ToLowerInvariant();
        if (n is null || string.IsNullOrEmpty(last)) throw ApiException.NotFound();
        var id = await store.FindBookingIdAsync(n, ct) ?? throw ApiException.NotFound();
        var booking = await trips.GetAsync(id, ct) ?? throw ApiException.NotFound();
        if (booking.Status != "confirmed") throw ApiException.NotFound();
        var party = await accounts.GetPartyAsync(id, ct);
        if (!party.Any(g => g.LastName.Trim().ToLowerInvariant() == last)) throw ApiException.NotFound();
        var booker = await users.FindByIdAsync(booking.BookerUserId, ct) ?? throw ApiException.NotFound();
        return await BoardingAsync(booker, booking, await clock.NowAsync(booker, ct), ct);
    }

    public async Task<BoardingViewDto> AddToWalletAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if ((await store.GetBookingAsync(c.Booking.BookingId, ct))?.FinishedAt is null) throw ApiException.Conflict("notDone");
        await IssuePassesAsync(c.Actor, c.Booking, c.Now, ct);
        await store.SetWalletAsync(c.Booking.BookingId, ct);
        return await BoardingAsync(c.Actor, c.Booking, c.Now, ct);
    }

    // ---- Embarkation day ----

    private async Task<EmbarkViewDto> EmbarkViewAsync(Scope c, CancellationToken ct)
    {
        var bookingId = c.Booking.BookingId;
        var priority = await planService.HasPriorityAsync(c.Actor, c.Booking, ct);
        var boarding = await BoardingAsync(c.Actor, c.Booking, c.Now, ct);
        var embark = await store.GetEmbarkAsync(bookingId, ct);
        var carry = await store.ListTicksAsync(bookingId, "carryOn", ct);
        var companion = await store.ListTicksAsync(bookingId, "companion", ct);
        var party = (await accounts.GetPartyAsync(bookingId, ct)).OrderBy(g => g.Seq).ToList();
        var steps = ByGuest(await store.ListStepsAsync(bookingId, ct));
        var readyAt = BoardingRules.DepartureAt(c.Departure, BoardingRules.Staterooms);
        var dropped = embark?.LuggageDroppedAt is { } d ? Utc(d) : (DateTime?)null;
        return new EmbarkViewDto(
            boarding, Ms(BoardingRules.DepartureAt(c.Departure, priority ? BoardingRules.PriorityOpens : BoardingRules.TerminalOpens)),
            Ms(BoardingRules.DepartureAt(c.Departure, BoardingRules.GangwayCloses)), Ms(readyAt), c.Now >= readyAt,
            boarding.Arrival is null ? null : BoardingRules.TrafficFor(boarding.Arrival.Crowd),
            new LuggageDto(BoardingRules.LuggageStatus(dropped, c.Now, readyAt), dropped is { } t ? Ms(t) : null),
            [.. BoardingRules.CarryOn.Select(id => new TickDto(id, carry.Contains(id)))],
            [.. BoardingRules.Companion.Select(id => new TickDto(id, companion.Contains(id)))],
            BoardingRules.CurrentCompanion(companion),
            [.. party.Select(g => new DocumentReadyDto(g.PublicId, AccountService.FullName(g), DocumentService.Check(g, c.Booking.Departure, c.Booking.Nights).Blocking == 0))],
            [.. BoardingRules.Afternoon.Select(a => new AfternoonDto(a.Id, Ms(BoardingRules.DepartureAt(c.Departure, a.Time))))],
            [.. party.Where(g => RecordOf(steps.GetValueOrDefault(g.UserId)).Health?.Flagged == true).Select(AccountService.FullName)],
            !c.Actor.IsSupervised);
    }

    public async Task<EmbarkViewDto> EmbarkAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await EmbarkViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<EmbarkViewDto> SetCompanionAsync(UserRecord actor, string? number, string id, TickRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (!BoardingRules.Companion.Contains(id) || body is null) throw ApiException.Invalid("step");
        await store.SetTickAsync(c.Booking.BookingId, "companion", id, body.Done, ct);
        return await EmbarkViewAsync(c, ct);
    }

    public async Task<EmbarkViewDto> SetCarryOnAsync(UserRecord actor, string? number, string id, TickRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (!BoardingRules.CarryOn.Contains(id) || body is null) throw ApiException.Invalid("item");
        await store.SetTickAsync(c.Booking.BookingId, "carryOn", id, body.Done, ct);
        return await EmbarkViewAsync(c, ct);
    }

    public async Task<EmbarkViewDto> SetBagsAsync(UserRecord actor, string? number, BagsRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (body is null) throw ApiException.Invalid("bags");
        await store.SetBagsAsync(c.Booking.BookingId, body.Dropped ? c.Now : null, ct);
        return await EmbarkViewAsync(c, ct);
    }
}
