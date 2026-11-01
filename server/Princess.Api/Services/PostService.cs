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
            return new HistoryTripDto(p.Id, p.Title, p.Ship, Iso(p.Departure), p.Nights, false, p.Cancelled, p.FareCents, [.. docs.Select(d => new HistoryDocDto(d.Doc, d.Ready))]);
        });
        List<HistoryTripDto> current = sailed
            ? [new($"current-{c.Booking.SailingId}", c.Booking.SailingTitle, c.Booking.ShipName, Iso(c.Departure), c.Booking.Nights, true, false, c.Booking.TotalCents, [.. AllDocs.Select(d => new HistoryDocDto(d, true))])]
            : [];
        return new HistoryViewDto([.. current, .. past], sailed ? Ms(FinishStages.EndOfDaysAfter(c, PhotoRules.RedownloadDays)) : null, sailed);
    }

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
        var counted = current is not null && now >= DisembarkRules.Times(DateOnly.FromDateTime(current.Departure)).ArrivalAt;
        var status = PostCruiseRules.Loyalty(actor.Tier, row?.DaysCounted ?? PostCruiseRules.TierDays(actor.Tier), current?.Nights ?? Pricing.Nights, counted);
        var perks = EntitlementRules.Compute(status.After, "none", false);
        var friends = (row?.Referrals ?? []).Select(r => new ReferralFriendDto(r.Name, r.State)).ToList();
        var code = row?.ReferralCode ?? PostCruiseRules.ReferralCode(actor.FirstName ?? "");
        return new LoyaltyViewDto(status, counted, perks.Perks, perks.WifiDevices, new ReferralDto(code, PostCruiseRules.ReferralCredit, friends.Count(f => f.State == "sailed") * PostCruiseRules.ReferralCredit, friends));
    }

    // ---- Rebooking (POS-06) ----

    private sealed record Option(string Id, DateOnly Departure, bool Bookable, long Total, long Deposit, long Credit);

    private static int Guests(Scope c) => Math.Min(4, c.Party.Count);

    private static bool Onboard(Scope c) => c.Confirmed && Shipboard.IsAboard(c);

    private static bool Bookable(SailingRow s, Scope c) => s.BookingOpen && Pricing.HasPrice(s.Id) && Pricing.Bookable(TripRules.DaysBetween(c.Today, DateOnly.FromDateTime(s.Departure)));

    private async Task<List<Option>> OptionsAsync(Scope c, CancellationToken ct)
    {
        var onboard = Onboard(c);
        var guests = Guests(c);
        var from = PostCruiseRules.EarliestRebook(Itinerary.Days(c.Departure)[7].Date);
        var credit = onboard ? PostCruiseRules.BookingCredit + PostCruiseRules.LevelCredit(c.Actor.Tier) : 0;
        return [.. (await trips.ListSailingsAsync(ct)).Where(s => DateOnly.FromDateTime(s.Departure) >= from).OrderBy(s => s.Departure).SelectMany(s =>
            Pricing.Quote(s.Id, c.Booking.CategoryId, guests) is { } q ? [new Option(s.Id, DateOnly.FromDateTime(s.Departure), Bookable(s, c), q.Total, PostCruiseRules.HoldDeposit(q.Total, guests, onboard), credit)] : Array.Empty<Option>())];
    }

    /// <summary>Desk slots from now on: at least an hour away, not full (a slot this booking holds counts as free), the first twelve. Times are ship wall-clock, as seeded.</summary>
    private async Task<List<(long At, int Day, DateTime Local)>> DeskSlotsAsync(Scope c, CancellationToken ct)
    {
        var days = Itinerary.Days(c.Departure);
        var all = new List<(long At, int Day, DateTime Local)>();
        foreach (var n in PostCruiseRules.DeskDays)
        {
            var date = days[n - 1].Date;
            foreach (var time in PostCruiseRules.DeskTimes())
            {
                var utc = Itinerary.LocalToUtc(date, time, Itinerary.ShipZoneOnDate(c.Departure, date));
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

    private async Task<RebookViewDto> RebookViewAsync(Scope c, CancellationToken ct)
    {
        var sailings = (await trips.ListSailingsAsync(ct)).ToDictionary(s => s.Id);
        var holds = await store.ListHoldsAsync(c.Booking.BookingId, ct);
        var applied = holds.Where(h => c.Now <= h.ExpiresAt).Sum(h => h.FccAppliedCents);
        var left = Math.Max(0, await store.FccLeftAsync(c.Booking.BookerUserId, c.Today, ct) - applied);
        var local = await store.GetAppointmentAsync(c.Booking.BookingId, ct);
        AppointmentDto? appointment = null;
        if (local is { } l)
        {
            var date = DateOnly.FromDateTime(l);
            var at = Itinerary.LocalToUtc(date, TimeOnly.FromDateTime(l), Itinerary.ShipZoneOnDate(c.Departure, date));
            if (at.AddMinutes(30) > c.Now) appointment = new AppointmentDto(Ms(at));
        }
        var onboard = Onboard(c);
        return new RebookViewDto(
            c.Booking.CategoryId, Guests(c), c.Actor.Tier, onboard, [.. (await OptionsAsync(c, ct)).Select(o => new RebookOptionDto(o.Id, Iso(o.Departure), o.Bookable, o.Total, o.Deposit, o.Credit))],
            [.. holds.Select(h => HoldOf(h, c, sailings))], left, await store.FccConvertedAsync(c.Booking.BookingId, ct), appointment,
            onboard ? [.. (await DeskSlotsAsync(c, ct)).Select(s => new DeskSlotDto(s.At, s.Day))] : [], (onboard || FinishStages.Sailed(c)) && !c.Actor.IsSupervised);
    }

    public async Task<RebookViewDto> RebookAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await RebookViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<RebookViewDto> HoldAsync(UserRecord actor, string? number, HoldRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (!(Onboard(c) || FinishStages.Sailed(c))) throw ApiException.Conflict("closed");
        var option = (await OptionsAsync(c, ct)).FirstOrDefault(o => o.Id == body?.DepartureId) ?? throw ApiException.Invalid("badDeparture");
        var live = (await store.ListHoldsAsync(c.Booking.BookingId, ct)).Where(h => c.Now <= h.ExpiresAt).ToList();
        if (live.Any(h => h.SailingId == option.Id)) throw ApiException.Conflict("alreadyHeld");
        if (live.Count >= PostCruiseRules.MaxHolds) throw ApiException.Conflict("tooManyHolds");
        var view = await RebookViewAsync(c, ct);
        var onboard = view.OnboardOffer;
        var hold = new HoldRow
        {
            SailingId = option.Id, CategoryId = c.Booking.CategoryId, Guests = view.Guests, TotalCents = option.Total, DepositCents = option.Deposit, CreditCents = option.Credit,
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
