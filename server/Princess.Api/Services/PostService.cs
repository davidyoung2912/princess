using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// After the cruise: trip history, feedback with service recovery, Captain's Circle progress and rebooking with the Future Cruise desk (POS-01 to POS-08, POS-11, POS-14).
/// Ports the <c>post</c> group of <c>src/api/finishMock.ts</c>. Feedback and holds belong to the booking; any guest reads, an adult guest writes.
/// The future cruise credit is the booker's, whichever adult acts.
/// </summary>
public sealed class PostService(ScopeLoader scopes, IFinishStore store, ITripStore trips, IAccountStore accounts, IUserClock clock, CaseService cases)
{
    private static long Ms(DateTime utc) => TripRules.ToMs(utc);
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");
    private static string Iso(DateTime d) => DateOnly.FromDateTime(d).ToString("yyyy-MM-dd");

    // ---- Trip history (POS-01) ----

    private static readonly string[] AllDocs = ["fareReceipt", "folioStatement", "gratuityStatement", "taxSummary"];

    public async Task<HistoryViewDto> HistoryAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        var sailed = FinishStages.Sailed(c);
        var past = (await store.ListHistoryTripsAsync(actor.Id, ct)).Select(p =>
        {
            List<(string Doc, bool Ready)> docs = p.Cancelled ? [] : p.Docs.Count > 0 ? p.Docs : [("fareReceipt", true), ("taxSummary", true)];
            return new HistoryTripDto(p.Id, p.Title, p.Ship, Iso(p.Departure), p.Nights, false, p.Cancelled, p.FareCents, [.. docs.Select(d => new HistoryDocDto(d.Doc, d.Ready))], [.. p.Ports.Select(x => new PortPlaceDto(x.Code, x.Name, x.Lat, x.Lon))]);
        });
        List<HistoryTripDto> current = sailed
            ? [new($"current-{c.Booking.SailingId}", c.Booking.SailingTitle, c.Booking.ShipName, Iso(c.Departure), c.Booking.Nights, true, false, c.Booking.TotalCents, [.. AllDocs.Select(d => new HistoryDocDto(d, true))], CallPorts(c.Timeline))]
            : [];
        return new HistoryViewDto([.. current, .. past], sailed ? Ms(FinishStages.EndOfDaysAfter(c, PhotoRules.RedownloadDays)) : null, sailed);
    }

    /// <summary>The ports of call of this cruise, each once, in order, with where each is.</summary>
    private static List<PortPlaceDto> CallPorts(Timeline timeline) =>
        [.. timeline.Days.Where(timeline.IsCall).Select(d => d.Port).Distinct().Select(id => Itinerary.PortById(id)).Select(p => new PortPlaceDto(p.Id, p.Name, p.Lat, p.Lon))];

    // ---- Feedback (POS-02, POS-11, POS-14) ----

    private async Task<FeedbackViewDto> FeedbackViewAsync(Scope c, CancellationToken ct)
    {
        var stored = await store.GetFeedbackAsync(c.Booking.BookingId, ct);
        var editUntil = FinishStages.EndOfDaysAfter(c, PostCruiseRules.FeedbackEditDays);
        var recovery = (await store.ListCasesAsync(c.Booking.BookingId, ct)).FirstOrDefault(x => x.FromFeedback && x.Kind == "recovery");
        var status = recovery is null ? null : CaseService.StatusOf(recovery, c.Now);
        var parsed = stored is null ? null : PostCruiseRules.ParseFeedback(stored.Json);
        var step = await Shipboard.NeedsStepFreeAsync(accounts, c, ct);
        return new FeedbackViewDto(
            FinishStages.Sailed(c) && !c.Actor.IsSupervised && c.Now <= editUntil, parsed is null ? null : new FeedbackDto(parsed.Overall, parsed.Areas, parsed.Comment, parsed.Crew, parsed.AllowContact, parsed.ShareName),
            stored is null ? null : Ms(stored.SubmittedAt), Ms(editUntil), [.. PostCruiseRules.Crew.Select(m => new CrewDto(m.Id, m.Name, m.Role))], RoomRules.StewardFor(Shipboard.Stateroom(c, step).Number),
            recovery is null ? null : new RecoveryDto(recovery.Number, Ms(status!.DueAt), status.Stage));
    }

    public async Task<FeedbackViewDto> FeedbackAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await FeedbackViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<FeedbackViewDto> SaveFeedbackAsync(UserRecord actor, string? number, FeedbackRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (!FinishStages.Sailed(c)) throw ApiException.Conflict("closed");
        var editUntil = FinishStages.EndOfDaysAfter(c, PostCruiseRules.FeedbackEditDays);
        if (c.Now > editUntil) throw ApiException.Conflict("expired");
        if (body is null) throw ApiException.Invalid("noOverall");
        if (PostCruiseRules.FeedbackProblem(body.Overall, body.Areas, body.Comment, body.Crew) is { } problem) throw ApiException.Invalid(problem);
        var areas = PostCruiseRules.Areas.Where(a => body.Areas?.ContainsKey(a) == true).ToDictionary(a => a, a => body.Areas![a]);
        var clean = new Feedback(body.Overall, areas, (body.Comment ?? "").Trim(), [.. (body.Crew ?? []).Select(n => n.Trim()).Distinct()], body.AllowContact, body.ShareName);
        var hasRecovery = (await store.ListCasesAsync(c.Booking.BookingId, ct)).Any(x => x.FromFeedback);
        if (PostCruiseRules.NeedsRecovery(clean) && clean.AllowContact && !hasRecovery)
            await cases.AddAsync(c, actor, "recovery", clean.Comment.Length >= 5 ? clean.Comment : "Low rating in the cruise feedback.", "", "", 0, fromFeedback: true, ct);
        await store.SaveFeedbackAsync(c.Booking.BookingId, PostCruiseRules.FeedbackJson(clean), c.Now, editUntil, ct);
        return await FeedbackViewAsync(c, ct);
    }

    // ---- Captain's Circle and referral (POS-05, POS-08) ----

    /// <summary>
    /// The person's loyalty progress. The cruise in hand is their latest confirmed one that has begun boarding; once the ship has tied up its nights count towards the days.
    /// <c>Loyalty.DaysCounted</c> is the days on the record <em>before</em> that cruise, and without a row the level's own minimum is used.
    /// </summary>
    public async Task<LoyaltyViewDto> LoyaltyAsync(UserRecord actor, CancellationToken ct)
    {
        var now = await clock.NowAsync(actor, ct);
        var row = await store.GetLoyaltyAsync(actor.Id, ct);
        var current = (await trips.ListForUserAsync(actor.Id, ct)).Where(b => b.Status == "confirmed" && Itinerary.LocalToUtc(DateOnly.FromDateTime(b.Departure), new TimeOnly(11, 0), Itinerary.ShipHomeZone) <= now)
            .OrderByDescending(b => b.Departure).FirstOrDefault();
        var counted = current is not null && now >= DisembarkRules.Times(TimelineBook.For(current.SailingId, DateOnly.FromDateTime(current.Departure))).ArrivalAt;
        var status = PostCruiseRules.Loyalty(actor.Tier, row?.DaysCounted ?? PostCruiseRules.TierDays(actor.Tier), current?.Nights ?? Pricing.Nights, counted);
        var perks = EntitlementRules.Compute(status.After, "none", false);
        var friends = (row?.Referrals ?? []).Select(r => new ReferralFriendDto(r.Id, r.Name, r.State)).ToList();
        var code = row?.ReferralCode ?? PostCruiseRules.ReferralCode(actor.FirstName ?? "");
        var today = DateOnly.FromDateTime(now);
        var credits = (await store.ListCreditsAsync(actor.Id, ct)).Select(x => new CreditDto(x.Id, x.Source, x.Original, x.Remaining, Iso(x.ExpiresOn), DateOnly.FromDateTime(x.ExpiresOn) < today, "booker")).ToList();
        var used = (await store.ListCreditUsesAsync(actor.Id, ct)).Select(x => new CreditUseDto(Ms(x.At), x.What, x.Cents)).ToList();
        var reports = (await store.ListLoyaltyReportsAsync(actor.Id, ct)).Select(x => new LoyaltyReportDto(x.Id, x.What, x.Note, x.Status, Ms(x.At))).ToList();
        return new LoyaltyViewDto(status, counted, perks.Perks, perks.WifiDevices, new ReferralDto(code, PostCruiseRules.ReferralCredit, friends.Count(f => f.State == "sailed") * PostCruiseRules.ReferralCredit, friends),
            Ms(now), "USD", credits, used, reports);
    }

    private static readonly string[] ReportKinds = ["tier", "days", "credit", "other"];
    private const int MaxOpenReports = 5;
    private const int MaxInvites = 10;

    /// <summary>REM-07: the guest says a level, day count or credit looks wrong. Kept for a person to answer; nothing on the record changes.</summary>
    public async Task<LoyaltyViewDto> ReportAsync(UserRecord actor, LoyaltyReportRequest? body, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden();
        var what = (body?.What ?? "").Trim();
        if (!ReportKinds.Contains(what)) throw ApiException.Invalid("badWhat");
        var note = (body?.Note ?? "").Trim();
        if (note.Length > 300) throw ApiException.Invalid("badNote");
        if ((await store.ListLoyaltyReportsAsync(actor.Id, ct)).Count(r => r.Status == "open") >= MaxOpenReports) throw ApiException.Conflict("tooManyReports");
        await store.AddLoyaltyReportAsync(actor.Id, what, note, await clock.NowAsync(actor, ct), ct);
        return await LoyaltyAsync(actor, ct);
    }

    /// <summary>REM-14: records an invited friend by first name only. The invitation can be taken back until the friend has booked.</summary>
    public async Task<LoyaltyViewDto> InviteAsync(UserRecord actor, ReferralRequest? body, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden();
        var name = (body?.Name ?? "").Trim();
        if (name.Length is < 1 or > 40) throw ApiException.Invalid("badName");
        var row = await store.GetLoyaltyAsync(actor.Id, ct) ?? throw ApiException.Conflict("noRecord");
        if (row.Referrals.Count(r => r.State == "invited") >= MaxInvites) throw ApiException.Conflict("tooManyInvites");
        await store.AddReferralAsync(actor.Id, name, ct);
        return await LoyaltyAsync(actor, ct);
    }

    public async Task<LoyaltyViewDto> RevokeInviteAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden();
        if (!await store.RevokeReferralAsync(actor.Id, id, ct)) throw ApiException.NotFound();
        return await LoyaltyAsync(actor, ct);
    }

    // ---- Rebooking (POS-06) ----

    private sealed record Option(string Id, DateOnly Departure, bool Bookable, long Total, long Deposit, long Credit, string[] Reasons);

    private static int Guests(Scope c) => Math.Min(4, c.Party.Count);

    private static bool Onboard(Scope c) => c.Confirmed && Shipboard.IsAboard(c);

    private static bool Bookable(SailingRow s, Scope c) => s.BookingOpen && Pricing.HasPrice(s.Id) && Pricing.Bookable(TripRules.DaysBetween(c.Today, DateOnly.FromDateTime(s.Departure)));

    /// <summary>REM-08: the cabin type and party size the dates are priced for. They start from this booking and the guest may change them; nothing about health or children is used.</summary>
    private static (string Category, int Guests) Inputs(Scope c, string? category, int? guests)
    {
        var cat = string.IsNullOrWhiteSpace(category) ? c.Booking.CategoryId : category;
        if (cat != c.Booking.CategoryId && !Pricing.Categories.Any(x => x.Id == cat)) throw ApiException.Invalid("badCategory");
        var n = guests ?? Guests(c);
        if (n is < 1 or > 4) throw ApiException.Invalid("badGuests");
        return (cat, n);
    }

    private async Task<List<Option>> OptionsAsync(Scope c, string category, int guests, CancellationToken ct)
    {
        var onboard = Onboard(c);
        var from = PostCruiseRules.EarliestRebook(c.Timeline.Days[^1].Date);
        var credit = onboard ? PostCruiseRules.BookingCredit + PostCruiseRules.LevelCredit(c.Actor.Tier) : 0;
        return [.. (await trips.ListSailingsAsync(ct)).Where(s => DateOnly.FromDateTime(s.Departure) >= from).OrderBy(s => s.Departure).SelectMany(s =>
            Pricing.Quote(s.Id, category, guests) is { } q ? [new Option(s.Id, DateOnly.FromDateTime(s.Departure), Bookable(s, c), q.Total, PostCruiseRules.HoldDeposit(q.Total, guests, onboard), credit, ReasonsFor(c, s.Id, credit))] : Array.Empty<Option>())];
    }

    private static string[] ReasonsFor(Scope c, string sailingId, long credit)
    {
        var reasons = new List<string> { "cabin", "party" };
        if (Pricing.NightsOf(sailingId) == c.Booking.Nights) reasons.Add("length");
        if (credit > 0) reasons.Add("credit");
        return [.. reasons];
    }

    /// <summary>Desk slots from now on: at least an hour away, not full (a slot this booking holds counts as free), the first twelve. Times are ship wall-clock, as seeded.</summary>
    private async Task<List<(long At, int Day, DateTime Local)>> DeskSlotsAsync(Scope c, CancellationToken ct)
    {
        var days = c.Timeline.Days;
        var all = new List<(long At, int Day, DateTime Local)>();
        foreach (var n in PostCruiseRules.DeskDays(c.Timeline))
        {
            var date = days[n - 1].Date;
            foreach (var time in PostCruiseRules.DeskTimes())
            {
                var utc = Itinerary.LocalToUtc(date, time, c.Timeline.ShipZoneOnDate(date));
                if (utc - c.Now >= TimeSpan.FromHours(1)) all.Add((Ms(utc), n, date.ToDateTime(time)));
            }
        }
        if (all.Count == 0) return [];
        var existing = (await store.ListDeskSlotsAsync(all.Min(s => s.Local), all.Max(s => s.Local), ct)).ToDictionary(s => s.At);
        var mine = await store.GetAppointmentAsync(c.Booking.BookingId, ct);
        return [.. all.Where(s => existing.TryGetValue(s.Local, out var slot) && (slot.Taken < slot.Capacity || mine == s.Local)).Take(12)];
    }

    private HoldDto HoldOf(HoldRow h, Scope c, Dictionary<string, SailingRow> sailings)
    {
        sailings.TryGetValue(h.SailingId, out var s);
        return new HoldDto(
            h.PublicId, s is null ? h.SailingId : Iso(s.Departure), h.CategoryId, h.Guests, h.TotalCents, h.DepositCents, h.CreditCents, h.FccAppliedCents, h.Onboard, Ms(h.PlacedAt), Ms(h.ExpiresAt),
            c.Now > h.ExpiresAt, s is not null && Bookable(s, c));
    }

    private async Task<RebookViewDto> RebookViewAsync(Scope c, CancellationToken ct, string? category = null, int? guests = null)
    {
        var (cat, n) = Inputs(c, category, guests);
        var sailings = (await trips.ListSailingsAsync(ct)).ToDictionary(s => s.Id);
        var holds = await store.ListHoldsAsync(c.Booking.BookingId, ct);
        var applied = holds.Where(h => c.Now <= h.ExpiresAt).Sum(h => h.FccAppliedCents);
        var left = Math.Max(0, await store.FccLeftAsync(c.Booking.BookerUserId, c.Today, ct) - applied);
        var local = await store.GetAppointmentAsync(c.Booking.BookingId, ct);
        AppointmentDto? appointment = null;
        if (local is { } l)
        {
            var date = DateOnly.FromDateTime(l);
            var at = Itinerary.LocalToUtc(date, TimeOnly.FromDateTime(l), c.Timeline.ShipZoneOnDate(date));
            if (at.AddMinutes(30) > c.Now) appointment = new AppointmentDto(Ms(at));
        }
        var onboard = Onboard(c);
        return new RebookViewDto(
            cat, n, c.Actor.Tier, onboard, [.. (await OptionsAsync(c, cat, n, ct)).Select(o => new RebookOptionDto(o.Id, Iso(o.Departure), o.Bookable, o.Total, o.Deposit, o.Credit, o.Reasons))],
            [.. holds.Select(h => HoldOf(h, c, sailings))], left, await store.FccConvertedAsync(c.Booking.BookingId, ct), appointment,
            onboard ? [.. (await DeskSlotsAsync(c, ct)).Select(s => new DeskSlotDto(s.At, s.Day))] : [], (onboard || FinishStages.Sailed(c)) && !c.Actor.IsSupervised,
            cat != c.Booking.CategoryId || n != Guests(c), [.. Pricing.Categories.Select(x => x.Id)]);
    }

    public async Task<RebookViewDto> RebookAsync(UserRecord actor, string? number, string? category, int? guests, CancellationToken ct) =>
        await RebookViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct, category, guests);

    public async Task<RebookViewDto> HoldAsync(UserRecord actor, string? number, HoldRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (!(Onboard(c) || FinishStages.Sailed(c))) throw ApiException.Conflict("closed");
        var (cat, n) = Inputs(c, body?.Category, body?.Guests);
        var option = (await OptionsAsync(c, cat, n, ct)).FirstOrDefault(o => o.Id == body?.DepartureId) ?? throw ApiException.Invalid("badDeparture");
        var live = (await store.ListHoldsAsync(c.Booking.BookingId, ct)).Where(h => c.Now <= h.ExpiresAt).ToList();
        if (live.Any(h => h.SailingId == option.Id)) throw ApiException.Conflict("alreadyHeld");
        if (live.Count >= PostCruiseRules.MaxHolds) throw ApiException.Conflict("tooManyHolds");
        var view = await RebookViewAsync(c, ct, cat, n);
        var onboard = view.OnboardOffer;
        var hold = new HoldRow
        {
            SailingId = option.Id, CategoryId = cat, Guests = view.Guests, TotalCents = option.Total, DepositCents = option.Deposit, CreditCents = option.Credit,
            FccAppliedCents = Math.Min(view.FccLeft, option.Deposit), Onboard = onboard, PlacedAt = c.Now, ExpiresAt = PostCruiseRules.HoldExpiry(c.Now),
        };
        FolioWrite[] folio = onboard && option.Credit > 0 ? [new(c.Booking.BookerUserId, Shipboard.DayAt(c, c.Now), "credit", "Onboard credit for holding a future cruise", -option.Credit, null, c.Now)] : [];
        await store.AddHoldAsync(c.Booking.BookingId, actor.Id, hold, folio, ct);
        return await RebookViewAsync(c, ct);
    }

    public async Task<RebookViewDto> ReleaseHoldAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (!await store.ReleaseHoldAsync(c.Booking.BookingId, id, ct)) throw ApiException.NotFound();
        return await RebookViewAsync(c, ct);
    }

    public async Task<RebookViewDto> ConvertFccAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        var left = (await RebookViewAsync(c, ct)).FccLeft;
        if (left <= 0) throw ApiException.Invalid("noCredit");
        FolioWrite[] folio = [new(c.Booking.BookerUserId, Shipboard.DayAt(c, c.Now), "credit", "Future cruise credit changed to onboard credit", -left, null, c.Now)];
        await store.ConvertFccAsync(c.Booking.BookingId, c.Booking.BookerUserId, left, c.Today, folio, ct);
        return await RebookViewAsync(c, ct);
    }

    public async Task<RebookViewDto> BookSlotAsync(UserRecord actor, string? number, SlotRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        var slots = await DeskSlotsAsync(c, ct);
        var index = slots.FindIndex(s => s.At == body?.At);
        if (index < 0) throw ApiException.Invalid("badSlot");
        if (!await store.BookSlotAsync(c.Booking.BookingId, slots[index].Local, ct)) throw ApiException.Conflict("taken");
        return await RebookViewAsync(c, ct);
    }

    public async Task<RebookViewDto> CancelSlotAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        await store.CancelSlotAsync(c.Booking.BookingId, ct);
        return await RebookViewAsync(c, ct);
    }
}
