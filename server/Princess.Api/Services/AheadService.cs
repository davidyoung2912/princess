using Microsoft.Extensions.Options;
using System.Security.Cryptography;
using System.Text;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Before-the-cruise services, ported from <c>src/api/aheadMock.ts</c>: travel advisors, marketing consent, Captain's Circle number and credit, upgrade bids, kids' clubs,
/// the medallion, luggage tags, fix-it and assisted-booking cases, and the health checklist. Things about a person (advisors, marketing, cases) belong to whoever is signed in;
/// the rest hang off a booking, where any guest may read and an adult guest may write.
/// </summary>
public sealed class AheadService(ScopeLoader scopes, IAheadStore store, IBookingStore bookings, ITripStore trips, IUserClock clock, IOptions<JwtOptions> jwt)
{
    private static long Ms(DateTime utc) => TripRules.ToMs(DateTime.SpecifyKind(utc, DateTimeKind.Utc));
    private static long? Ms(DateTime? utc) => utc is { } d ? Ms(d) : null;
    private static DateTime Utc(DateTime d) => DateTime.SpecifyKind(d, DateTimeKind.Utc);
    private static string Str(string? v, int max) => v is null ? "" : v.Trim() is var t && t.Length > max ? t[..max] : v.Trim();

    private static void RequireAdult(UserRecord actor)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
    }

    private static DateTime DepartureAt(Scope c) => Itinerary.LocalToUtc(c.Departure, new TimeOnly(12, 0), Itinerary.ShipHomeZone);

    private static DateTime EmbarkAt(Scope c) => Itinerary.LocalToUtc(c.Departure, new TimeOnly(11, 0), Itinerary.ShipHomeZone);

    /// <summary>When the embarkation stage ends and the first sea day begins.</summary>
    private static DateTime SeaDayAt(Scope c) => Itinerary.LocalToUtc(c.Departure.AddDays(1), new TimeOnly(8, 0), Itinerary.ShipHomeZone);

    private static bool BeforeSailing(Scope c) => c.Now < EmbarkAt(c);

    private static DateTime TripOverAt(Scope c) => Itinerary.LocalToUtc(c.Departure.AddDays(7), new TimeOnly(6, 0), Itinerary.ShipHomeZone);

    // ---- Travel advisors (DIS-15) ----

    private async Task<List<AdvisorRequestDto>> AdvisorViewAsync(UserRecord actor, CancellationToken ct) =>
        [.. (await store.ListAdvisorAsksAsync(actor.Id, ct)).OrderByDescending(r => r.At).Select(r =>
            new AdvisorRequestDto(r.PublicId, r.AdvisorId, AheadRules.AdvisorById(r.AdvisorId)?.Name ?? r.AdvisorId, r.Way, r.Question, Ms(r.At), r.Reply, Ms(r.CallbackBy)))];

    public async Task<List<AdvisorRequestDto>> AdvisorsAsync(UserRecord actor, CancellationToken ct) => await AdvisorViewAsync(actor, ct);

    public async Task<List<AdvisorRequestDto>> AskAdvisorAsync(UserRecord actor, AskAdvisorRequest? body, CancellationToken ct)
    {
        RequireAdult(actor);
        var problem = AheadRules.AdvisorProblem(body?.AdvisorId, body?.Way, body?.Phone, body?.Question);
        if (problem is not null) throw ApiException.Invalid(problem);
        var now = await clock.NowAsync(actor, ct);
        var question = Str(body!.Question, 500);
        var chat = body.Way == "chat";
        await store.AddAdvisorAskAsync(
            actor.Id, body.AdvisorId!, body.Way!, chat ? null : Str(body.Phone, 30), question,
            chat ? AheadRules.AdvisorReply(AheadRules.AdvisorById(body.AdvisorId)!.Name, question) : null, chat ? null : now.AddHours(AheadRules.CallbackHours), now, ct);
        return await AdvisorViewAsync(actor, ct);
    }

    // ---- Marketing consent (DIS-16) ----

    private string Code(UserRecord actor, string channel, string contact) => AheadRules.ConsentCode(jwt.Value.SigningKey, actor.Id, channel, contact);

    private async Task<MarketingViewDto> MarketingViewAsync(UserRecord actor, DateTime now, CancellationToken ct)
    {
        var rows = await store.ListConsentsAsync(actor.Id, ct);
        var choices = new List<MarketingChoiceDto>();
        foreach (var channel in new[] { "email", "sms" })
        {
            var r = rows.FirstOrDefault(x => x.Channel == channel);
            if (r is null) { choices.Add(new(channel, "", "us", "none", null, null, false, null)); continue; }
            var state = AheadRules.ConsentState(r.AskedAt, r.ConfirmedAt, now);
            var pending = state == "pending";
            choices.Add(new(channel, channel == "email" ? AheadRules.MaskEmail(r.Contact) : AheadRules.MaskPhone(r.Contact), r.Region, state, Ms(r.AskedAt), Ms(r.ConfirmedAt), pending, pending && actor.IsDemo ? Code(actor, channel, r.Contact) : null));
        }
        return new MarketingViewDto(choices, !actor.IsSupervised);
    }

    public async Task<MarketingViewDto> MarketingAsync(UserRecord actor, CancellationToken ct) => await MarketingViewAsync(actor, await clock.NowAsync(actor, ct), ct);

    public async Task<MarketingViewDto> SubscribeAsync(UserRecord actor, string channel, SubscribeRequest? body, CancellationToken ct)
    {
        RequireAdult(actor);
        if (!AheadRules.IsChannel(channel)) throw ApiException.Invalid("badChannel");
        var problem = AheadRules.ContactProblem(channel, body?.Contact);
        if (problem is not null) throw ApiException.Invalid(problem);
        if (!AheadRules.IsRegion(body!.Region)) throw ApiException.Invalid("badRegion");
        var now = await clock.NowAsync(actor, ct);
        var contact = body.Contact!.Trim();
        var twoStep = AheadRules.DoubleOptIn[body.Region!];
        await store.SaveConsentAsync(
            actor.Id, new MarketingConsentRow { Channel = channel, Contact = contact, Region = body.Region!, AskedAt = now, ConfirmedAt = twoStep ? null : now },
            twoStep ? AheadRules.CodeHash(Code(actor, channel, contact)) : null, twoStep ? now.AddHours(AheadRules.ConsentCodeHours) : null, ct);
        return await MarketingViewAsync(actor, now, ct);
    }

    public async Task<MarketingViewDto> ConfirmAsync(UserRecord actor, string channel, ConfirmConsentRequest? body, CancellationToken ct)
    {
        RequireAdult(actor);
        var now = await clock.NowAsync(actor, ct);
        var r = AheadRules.IsChannel(channel) ? (await store.ListConsentsAsync(actor.Id, ct)).FirstOrDefault(x => x.Channel == channel) : null;
        if (r is null || r.ConfirmedAt is not null) throw ApiException.Conflict("nothingPending");
        if (AheadRules.ConsentState(r.AskedAt, r.ConfirmedAt, now) == "expired") throw ApiException.Conflict("expired");
        var expected = Encoding.UTF8.GetBytes(Code(actor, channel, r.Contact));
        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes((body?.Code ?? "").Trim()), expected)) throw ApiException.Invalid("wrongCode");
        r.ConfirmedAt = now;
        await store.SaveConsentAsync(actor.Id, r, null, null, ct);
        return await MarketingViewAsync(actor, now, ct);
    }

    public async Task<MarketingViewDto> WithdrawAsync(UserRecord actor, string channel, CancellationToken ct)
    {
        RequireAdult(actor);
        if (!AheadRules.IsChannel(channel)) throw ApiException.Invalid("badChannel");
        await store.DeleteConsentAsync(actor.Id, channel, ct);
        return await MarketingViewAsync(actor, await clock.NowAsync(actor, ct), ct);
    }

    // ---- Captain's Circle number and credit (BOK-11, BOK-12) ----

    public async Task<LoyaltyDto> LoyaltyAsync(UserRecord actor, CancellationToken ct)
    {
        var l = await bookings.GetLoyaltyAsync(actor.Id, TripRules.Today(await clock.NowAsync(actor, ct)), ct);
        return new LoyaltyDto(l.Number ?? "", actor.Tier, l.CreditLeftCents);
    }

    // ---- Upgrade bids (MNG-06) ----

    private static List<UpgradeOffer> OffersFor(Scope c)
    {
        var guests = Math.Min(4, c.Party.Count);
        var current = c.Booking.CategoryId;
        var baseTotal = Pricing.Quote(c.Booking.SailingId, current, guests)?.Total ?? 0;
        return AheadRules.UpgradeOffers(current, cat => Pricing.Quote(c.Booking.SailingId, cat, guests) is { } q ? q.Total - baseTotal : null);
    }

    private static DateTime BidsDecidedAt(Scope c) => DepartureAt(c).AddDays(-AheadRules.BidDecidedDays);

    private static string BidStatus(Scope c, BidRow r)
    {
        if (r.Status == "withdrawn") return "withdrawn";
        if (r.BuyNow || r.Status == "accepted") return "accepted";
        if (c.Now < BidsDecidedAt(c)) return "open";
        var offer = OffersFor(c).FirstOrDefault(o => o.Category == r.CategoryId);
        return offer is not null && AheadRules.BidWins(offer, r.Cents, $"{c.Booking.Number}|{r.CategoryId}") ? "accepted" : "declined";
    }

    private async Task<UpgradesViewDto> UpgradesViewAsync(Scope c, CancellationToken ct)
    {
        var bids = (await store.ListBidsAsync(c.Booking.BookingId, ct))
            .Select(r => new UpgradeBidDto(r.PublicId, r.CategoryId, r.Cents, Ms(r.At), BidStatus(c, r), r.BuyNow)).OrderByDescending(b => b.At).ToList();
        return new UpgradesViewDto(c.Booking.CategoryId, OffersFor(c), bids, Ms(BidsDecidedAt(c)), c.Confirmed && c.Now < BidsDecidedAt(c) && BeforeSailing(c), !c.Actor.IsSupervised);
    }

    public async Task<UpgradesViewDto> UpgradesAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await UpgradesViewAsync(await scopes.LoadAsync(actor, number, false, ct), ct);

    public async Task<UpgradesViewDto> BidAsync(UserRecord actor, string? number, PlaceBidRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        var offer = OffersFor(c).FirstOrDefault(o => o.Category == body?.Category);
        var problem = AheadRules.BidProblem(offer, body?.Cents ?? 0);
        if (problem is not null) throw ApiException.Invalid(problem);
        if (!(await UpgradesViewAsync(c, ct)).Open) throw ApiException.Conflict("closed");
        if ((await trips.ListCardsAsync(actor.Id, ct)).Count == 0) throw ApiException.Conflict("noCard");
        var live = (await store.ListBidsAsync(c.Booking.BookingId, ct)).Any(r => r.CategoryId == offer!.Category && BidStatus(c, r) is not ("withdrawn" or "declined"));
        if (live) throw ApiException.Conflict("duplicate");
        await store.AddBidAsync(c.Booking.BookingId, offer!.Category, body!.Cents, body.Cents >= offer.BuyNow, c.Now, ct);
        return await UpgradesViewAsync(c, ct);
    }

    public async Task<UpgradesViewDto> WithdrawBidAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        var r = (await store.ListBidsAsync(c.Booking.BookingId, ct)).FirstOrDefault(x => x.PublicId == id) ?? throw ApiException.NotFound();
        if (BidStatus(c, r) != "open") throw ApiException.Conflict("closed");
        await store.WithdrawBidAsync(c.Booking.BookingId, r.Id, c.Now, ct);
        return await UpgradesViewAsync(c, ct);
    }

    // ---- Kids' and teens' clubs (PRE-08): health notes are held for the child's booker only (SEC-07, SEC-08) ----

    /// <summary>The child's booker, or for a child without an account of their own, the booking's booker.</summary>
    private static bool Manages(Scope c, ScopePerson child) => c.Actor.Id == (child.BookerUserId ?? c.Booking.BookerUserId) && !c.Actor.IsSupervised;

    private async Task<ClubsViewDto> ClubsViewAsync(Scope c, CancellationToken ct)
    {
        var saved = await store.ListClubsAsync(c.Booking.BookingId, ct);
        var children = c.Party.Where(p => p.Age < 18).Select(p =>
        {
            var row = saved.FirstOrDefault(s => s.ChildUserId == p.UserId);
            var form = row is not null && Manages(c, p)
                ? new ClubFormDto(p.Id, row.Allergies, row.Medical, row.Medication, row.PhotoConsent, row.Pickups, row.SelfSignOut, row.EmergencyPhone, true)
                : null;
            return new ClubChildDto(p.Id, p.Name, p.Age, AheadRules.ClubForAge(p.Age)?.Id, row is not null, form);
        }).ToList();
        return new ClubsViewDto(children, !c.Actor.IsSupervised, c.Now < TripOverAt(c));
    }

    public async Task<ClubsViewDto> ClubsAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ClubsViewAsync(await scopes.LoadAsync(actor, number, false, ct), ct);

    public async Task<ClubsViewDto> SaveClubAsync(UserRecord actor, string? number, Guid childId, SaveClubRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        if (c.Now >= TripOverAt(c) || !c.Confirmed) throw ApiException.Conflict("closed");
        var child = c.PersonById(childId);
        if (child is null || child.Age >= 18) throw ApiException.Invalid("noClub");
        if (!Manages(c, child)) throw ApiException.Forbidden();
        var form = new ClubForm(
            child.Id, body?.Allergies ?? "", body?.Medical ?? "", body?.Medication ?? "", body?.PhotoConsent == true,
            [.. (body?.Pickups ?? []).Select(p => new Pickup(p?.Name ?? "", p?.Relation ?? "", p?.Phone ?? ""))], body?.SelfSignOut == true, body?.EmergencyPhone ?? "", body?.Confirmed == true);
        var problem = AheadRules.ClubProblem(form, child.Age);
        if (problem is not null) throw ApiException.Invalid(problem);
        var booker = c.PersonByUser(actor.Id);
        await store.SaveClubAsync(
            c.Booking.BookingId, AheadRules.ClubForAge(child.Age)!.Id, booker?.Name ?? "", new ClubRow
            {
                ChildUserId = child.UserId, Allergies = Str(form.Allergies, 300), Medical = Str(form.Medical, 300), Medication = Str(form.Medication, 300), PhotoConsent = form.PhotoConsent,
                SelfSignOut = form.SelfSignOut, EmergencyPhone = Str(form.EmergencyPhone, 30), Pickups = form.Pickups,
            }, c.Now, ct);
        return await ClubsViewAsync(c, ct);
    }

    public async Task<ClubsViewDto> WithdrawClubAsync(UserRecord actor, string? number, Guid childId, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        var child = c.PersonById(childId) ?? throw ApiException.NotFound();
        if (!Manages(c, child)) throw ApiException.Forbidden();
        if (!await store.DeleteClubAsync(c.Booking.BookingId, child.UserId, ct)) throw ApiException.NotFound();
        return await ClubsViewAsync(c, ct);
    }

    // ---- Medallion (CHK-06) ----

    private static string Tracking(Scope c) => $"1Z{ExcursionRules.Hash(c.Booking.Number) % 1_000_000_000:000000000}";

    private async Task<MedallionViewDto> MedallionViewAsync(Scope c, MedallionStatus s, CancellationToken ct)
    {
        await Task.CompletedTask;
        return new MedallionViewDto(s.Stage, [.. s.Events.Select(e => new MedallionEventDto(e.Id, Ms(e.At)))], s.CanActivate, Ms(s.ActivatedAt), Ms(s.LostAt), s.Replacement, c.Named(c.Party.Select(p => p.UserId)), "The address on your booking", Tracking(c), !c.Actor.IsSupervised);
    }

    private async Task<MedallionStatus> MedallionOfAsync(Scope c, CancellationToken ct)
    {
        var m = await store.GetMedallionAsync(c.Booking.BookingId, ct);
        return AheadRules.Medallion(DepartureAt(c), Utc(c.Booking.ConfirmedAt), c.Now, m?.ActivatedAt, m?.LostAt);
    }

    public async Task<MedallionViewDto> MedallionAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, false, ct);
        return await MedallionViewAsync(c, await MedallionOfAsync(c, ct), ct);
    }

    public async Task<MedallionViewDto> ActivateMedallionAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        var s = await MedallionOfAsync(c, ct);
        if (s.LostAt is not null) throw ApiException.Conflict("lost");
        if (s.ActivatedAt is not null) throw ApiException.Conflict("already");
        if (!s.CanActivate) throw ApiException.Conflict("notDelivered");
        await store.SaveMedallionAsync(c.Booking.BookingId, s.Stage, Tracking(c), c.Now, null, ct);
        return await MedallionViewAsync(c, await MedallionOfAsync(c, ct), ct);
    }

    /// <summary>Switches off the lost medallion and orders a replacement for collection.</summary>
    public async Task<MedallionViewDto> LostMedallionAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        var s = await MedallionOfAsync(c, ct);
        if (s.LostAt is not null) throw ApiException.Conflict("already");
        await store.SaveMedallionAsync(c.Booking.BookingId, s.Stage, Tracking(c), null, c.Now, ct);
        return await MedallionViewAsync(c, await MedallionOfAsync(c, ct), ct);
    }

    // ---- Luggage tags (CHK-09) ----

    private async Task<TagsViewDto> TagsViewAsync(Scope c, CancellationToken ct)
    {
        var t = await store.GetTagsAsync(c.Booking.BookingId, ct);
        var cabin = c.Booking.CabinNumber ?? "";
        var deck = CabinRules.CabinsFor(c.Booking.SailingId, c.Booking.CategoryId).FirstOrDefault(x => x.Number == cabin)?.Deck ?? 0;
        var guests = c.Party.Select(p => new TagGuestDto(p.Id, p.Name, AheadRules.PassName(p.First, p.Last), cabin, deck)).ToList();
        var days = (int)Math.Ceiling((DepartureAt(c) - c.Now).TotalDays);
        return new TagsViewDto(
            t?.Way, guests, t is { Way: "order" } ? Ms(t.OrderedAt) : null, days, Ms(t?.HandedOverAt),
            t is null ? "none" : AheadRules.BagStage(t.HandedOverAt is { } h ? Utc(h) : null, c.Now), !c.Actor.IsSupervised);
    }

    public async Task<TagsViewDto> TagsAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await TagsViewAsync(await scopes.LoadAsync(actor, number, false, ct), ct);

    public async Task<TagsViewDto> ChooseTagsAsync(UserRecord actor, string? number, ChooseTagRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        var days = (int)Math.Ceiling((DepartureAt(c) - c.Now).TotalDays);
        var problem = AheadRules.TagProblem(body?.Way, days);
        if (problem == "badWay") throw ApiException.Invalid(problem);
        if (problem is not null) throw ApiException.Conflict(problem);
        if (!c.Confirmed || c.Now >= SeaDayAt(c)) throw ApiException.Conflict("closed");
        var t = await store.GetTagsAsync(c.Booking.BookingId, ct);
        await store.SaveTagsAsync(c.Booking.BookingId, body!.Way!, AheadRules.BagStage(t?.HandedOverAt is { } h ? Utc(h) : null, c.Now), c.Now, t?.HandedOverAt, ct);
        return await TagsViewAsync(c, ct);
    }

    /// <summary>Records that the bags were handed to porters, so their journey can be estimated.</summary>
    public async Task<TagsViewDto> HandedOverAsync(UserRecord actor, string? number, HandedOverRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        var t = await store.GetTagsAsync(c.Booking.BookingId, ct) ?? throw ApiException.Conflict("noTags");
        if (c.Now < EmbarkAt(c) || c.Now >= SeaDayAt(c)) throw ApiException.Conflict("notYet");
        var on = body?.On == true;
        await store.SaveTagsAsync(c.Booking.BookingId, t.Way, on ? AheadRules.BagStage(c.Now, c.Now) : "atHome", t.OrderedAt, on ? c.Now : null, ct);
        return await TagsViewAsync(c, ct);
    }

    // ---- Health and comfort checklist (MNG-19) ----

    public async Task<List<string>> PrepAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, false, ct);
        return [.. (await store.GetPrepAsync(c.Booking.BookingId, ct)).OrderBy(x => x, StringComparer.Ordinal)];
    }

    public async Task<List<string>> TickPrepAsync(UserRecord actor, string? number, string? id, TickRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        if (id is null || !AheadRules.PrepItems.Contains(id)) throw ApiException.Invalid("badItem");
        await store.SetPrepAsync(c.Booking.BookingId, id, body?.Done == true, c.Now, ct);
        return [.. (await store.GetPrepAsync(c.Booking.BookingId, ct)).OrderBy(x => x, StringComparer.Ordinal)];
    }

    // ---- Fix-it flows (MNG-18) ----

    private async Task<List<FixCaseDto>> FixViewAsync(UserRecord actor, DateTime now, CancellationToken ct) =>
        [.. (await store.ListFixCasesAsync(actor.Id, ct)).OrderByDescending(r => r.At).Select(r =>
            new FixCaseDto(r.PublicId, r.Flow, r.Note, Ms(r.At), r.Reference, AheadRules.FixStage(r.At, now), Ms(r.At.AddHours(AheadRules.FixContactHours))))];

    public async Task<List<FixCaseDto>> FixCasesAsync(UserRecord actor, CancellationToken ct) => await FixViewAsync(actor, await clock.NowAsync(actor, ct), ct);

    public async Task<List<FixCaseDto>> EscalateAsync(UserRecord actor, EscalateRequest? body, CancellationToken ct)
    {
        RequireAdult(actor);
        if (body?.Flow is null || !AheadRules.FixFlows.Contains(body.Flow)) throw ApiException.Invalid("badFlow");
        if (body.Note is null || body.Note.Trim().Length < 5 || body.Note.Length > 600) throw ApiException.Invalid("noNote");
        var now = await clock.NowAsync(actor, ct);
        var have = await FixViewAsync(actor, now, ct);
        if (have.Any(r => r.Flow == body.Flow && r.Stage == "received")) throw ApiException.Conflict("duplicate");
        await store.AddFixCaseAsync(actor.Id, body.Flow, body.Note.Trim(), AheadRules.FixReference(have.Count + 1), now.AddHours(AheadRules.FixContactHours), now, ct);
        return await FixViewAsync(actor, now, ct);
    }

    // ---- Assisted booking, bereavement and medical cancellation (SUP-07) ----

    private async Task<List<AssistCaseDto>> AssistViewAsync(UserRecord actor, DateTime now, CancellationToken ct)
    {
        var mine = await trips.ListForUserAsync(actor.Id, ct);
        return [.. (await store.ListAssistCasesAsync(actor.Id, ct)).OrderByDescending(r => r.At).Select(r =>
        {
            var stage = AheadRules.AssistStage(r.At, now);
            var paid = mine.FirstOrDefault(b => b.Number == r.BookingNumber)?.PaidCents ?? 0;
            return new AssistCaseDto(
                r.PublicId, r.Kind, r.Note, AheadRules.MaskPhone(r.Phone), Ms(r.At), stage, r.Reference, r.BookingNumber,
                r.Kind != "assistedBooking" && stage == "decided" ? AheadRules.Compassion(paid) : null, r.Choice);
        })];
    }

    public async Task<List<AssistCaseDto>> AssistCasesAsync(UserRecord actor, CancellationToken ct) => await AssistViewAsync(actor, await clock.NowAsync(actor, ct), ct);

    /// <summary>A bereavement or medical case is about the person's own next booking: the one they made that is confirmed and sails soonest.</summary>
    public async Task<List<AssistCaseDto>> AskAssistAsync(UserRecord actor, AskAssistCaseRequest? body, CancellationToken ct)
    {
        RequireAdult(actor);
        var now = await clock.NowAsync(actor, ct);
        var booking = (await trips.ListForUserAsync(actor.Id, ct)).Where(b => b.BookerUserId == actor.Id && b.Status == "confirmed" && b.Departure >= now.Date).OrderBy(b => b.Departure).FirstOrDefault();
        var problem = AheadRules.AssistProblem(body?.Kind, body?.Phone, body?.Note, booking is not null);
        if (problem is not null) throw ApiException.Invalid(problem);
        var about = body!.Kind == "assistedBooking" ? null : booking;
        await store.AddAssistCaseAsync(
            actor.Id, about?.BookingId,
            new AssistCaseRow { Kind = body.Kind!, Phone = Str(body.Phone, 30), Note = body.Note!.Trim(), BookingNumber = about?.Number, Reference = AheadRules.CaseReference(now), At = now }, ct);
        return await AssistViewAsync(actor, now, ct);
    }

    /// <summary>Once decided, how the money comes back. The choice is recorded; moving the money is for the desk that decided the case.</summary>
    public async Task<List<AssistCaseDto>> ChooseAssistAsync(UserRecord actor, Guid id, ChoiceRequest? body, CancellationToken ct)
    {
        RequireAdult(actor);
        if (body?.Choice is not ("refund" or "credit")) throw ApiException.Invalid("badChoice");
        var now = await clock.NowAsync(actor, ct);
        var r = (await store.ListAssistCasesAsync(actor.Id, ct)).FirstOrDefault(x => x.PublicId == id) ?? throw ApiException.NotFound();
        if (r.Kind == "assistedBooking" || AheadRules.AssistStage(r.At, now) != "decided") throw ApiException.Conflict("notDecided");
        if (r.Choice is not null) throw ApiException.Conflict("already");
        await store.SetAssistChoiceAsync(actor.Id, r.Id, body.Choice, ct);
        return await AssistViewAsync(actor, now, ct);
    }
}
