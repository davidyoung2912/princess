using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public sealed class TripService(AccessService access, SubjectAccess subjects, ITripStore trips, IAccountStore accounts, IAccessStore grants, IUserStore users, IUserClock clock)
{
    private static DateOnly D(DateTime d) => DateOnly.FromDateTime(d);
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");

    public static string BrandName(string brand) => brand switch
    {
        "visa" => "Visa",
        "mastercard" => "Mastercard",
        "amex" => "American Express",
        _ => "Discover",
    };

    private static bool Sailed(BookingRow b, DateOnly today) => D(b.Departure).AddDays(b.Nights) < today;

    private static bool Upcoming(BookingRow b, DateOnly today) => b.Status == "confirmed" && !Sailed(b, today);

    /// <summary>A booking as the My Trips cards show it. <paramref name="current"/> marks the one the rest of the app opens on.</summary>
    public async Task<TripViewDto> BuildAsync(BookingRow b, bool current, DateTime now, CancellationToken ct)
    {
        var today = TripRules.Today(now);
        var departure = D(b.Departure);
        var plan = new TripRules.PaymentPlan(b.TotalCents, b.DepositCents, b.TotalCents - b.DepositCents, Iso(D(b.FinalDueDate)), Iso(TripRules.Today(b.ConfirmedAt)));
        var payment = TripRules.PaymentState(plan, b.PaidCents >= b.TotalCents, today);

        // A travel agent handles the documents on an agent booking, so the card shows none.
        TripDocumentsDto? documents = null;
        var missing = 0;
        if (b.Kind != "agent")
        {
            var party = await accounts.GetPartyAsync(b.BookingId, ct);
            var checks = party.Select(g => DocumentService.Check(g, b.Departure, b.Nights)).ToList();
            missing = checks.Sum(c => c.Blocking);
            documents = new TripDocumentsDto(party.Count, missing, checks.Count(DocumentRules.PassportProblem));
        }

        var opensAt = TripRules.CheckinOpensAt(departure);
        var closesAt = TripRules.CheckinClosesAt(departure);
        var state = b.CheckinFinishedAt is not null ? "done" : TripRules.CheckinWindow(now, opensAt, closesAt);

        return new TripViewDto(
            b.Number, b.Kind == "agent" ? "linked" : current ? "current" : "booked", b.SailingId, Iso(departure), b.CategoryName, b.GuestCount,
            TripRules.DaysBetween(today, departure), new PlanDto(plan.Total, plan.Deposit, plan.Balance, plan.FinalDue, plan.Booked), payment, documents,
            new CheckinStatusDto(state, TripRules.ToMs(opensAt), TripRules.ToMs(closesAt)), TripRules.NextAction(payment, missing, state == "open", state == "done"),
            b.Kind == "agent" ? b.AgentName : null);
    }

    public async Task<TripsViewDto> ListAsync(UserRecord actor, CancellationToken ct)
    {
        var now = await clock.NowAsync(actor, ct);
        var today = TripRules.Today(now);
        var all = await trips.ListForUserAsync(actor.Id, ct);

        var currentNumber = all.Where(b => Upcoming(b, today) && b.Kind != "agent").OrderBy(b => b.Departure).FirstOrDefault()?.Number;
        var upcoming = new List<TripViewDto>();
        foreach (var b in all.Where(b => Upcoming(b, today)).OrderBy(b => b.Departure))
            upcoming.Add(await BuildAsync(b, b.Number == currentNumber, now, ct));

        var past = new List<PastTripDto>();
        foreach (var b in all.Where(b => b.Status == "cancelled"))
            past.Add(new PastTripDto(b.Number, b.SailingTitle, b.ShipName, Iso(D(b.Departure)), b.Nights, true));
        foreach (var b in all.Where(b => b.Status == "confirmed" && Sailed(b, today)))
            past.Add(new PastTripDto(b.SailingId, b.SailingTitle, b.ShipName, Iso(D(b.Departure)), b.Nights, null));
        foreach (var p in await trips.ListPastTripsAsync(actor.Id, ct))
            past.Add(new PastTripDto(p.Id, p.Title, p.Ship, Iso(D(p.Departure)), p.Nights, p.Cancelled ? true : null));
        return new TripsViewDto(upcoming, past.OrderByDescending(p => p.Departure).ToList());
    }

    /// <summary>The booking the person is on or has linked. Anything else, including a number that does not exist, is the same notFound.</summary>
    public async Task<TripViewDto> GetAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var n = AccessRules.NormalizeBookingNumber(number) ?? throw ApiException.NotFound();
        var now = await clock.NowAsync(actor, ct);
        var today = TripRules.Today(now);
        var all = await trips.ListForUserAsync(actor.Id, ct);
        var hit = all.FirstOrDefault(b => b.Number == n && Upcoming(b, today)) ?? throw ApiException.NotFound();
        var current = all.Where(b => Upcoming(b, today) && b.Kind != "agent").OrderBy(b => b.Departure).FirstOrDefault()?.Number == hit.Number;
        return await BuildAsync(hit, current, now, ct);
    }

    /// <summary>Links a travel-agent booking after checking the number, lead guest's last name and sailing date together. Every mismatch is the same notFound.</summary>
    public async Task<TripViewDto> LinkAsync(UserRecord actor, LinkTripRequest req, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        if (!TripRules.LinkFormatOk(req.Number, req.LastName, req.Departure, out var number)) throw ApiException.Invalid("format");
        var departure = DateOnly.ParseExact(req.Departure!, "yyyy-MM-dd").ToDateTime(TimeOnly.MinValue);
        var booking = await trips.FindAgentBookingAsync(number, req.LastName!.Trim(), departure, ct) ?? throw ApiException.NotFound("noMatch");
        if (await trips.IsLinkedOrMemberAsync(actor.Id, booking.BookingId, ct)) throw ApiException.Conflict("alreadyLinked");
        var now = await clock.NowAsync(actor, ct);
        await trips.LinkAsync(actor.Id, booking.BookingId, now, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "trip", booking.Number, now, ct);
        return await BuildAsync(booking, current: false, now, ct);
    }

    public async Task<BookingCoreDto> CoreAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var m = await access.RequireMemberAsync(actor, number, ct);
        var b = await trips.GetAsync(m.BookingId, ct) ?? throw ApiException.NotFound();
        var party = await accounts.GetPartyAsync(m.BookingId, ct);
        var booker = party.FirstOrDefault(g => g.UserId == b.BookerUserId)?.PublicId ?? actor.PublicId;
        return new BookingCoreDto(b.Number, actor.PublicId, booker, b.SailingId, Iso(D(b.Departure)), party.Select(g => g.PublicId).ToList(),
            b.CategoryId, b.CategoryId, b.CabinNumber, actor.Tier, b.FareId == "standard" ? "none" : b.FareId);
    }

    public async Task<List<SailingDto>> SailingsAsync(CancellationToken ct) =>
        (await trips.ListSailingsAsync(ct)).Where(s => Pricing.HasPrice(s.Id)).Select(s => new SailingDto(s.Id, Iso(D(s.Departure)), s.IsHoliday, s.IsReference)).ToList();

    // ---- Payments ----

    public async Task<PaymentsViewDto> PaymentsAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var m = await access.RequireMemberAsync(actor, number, ct);
        return await PaymentsViewAsync(actor, m.BookingId, ct);
    }

    private async Task<PaymentsViewDto> PaymentsViewAsync(UserRecord actor, long bookingId, CancellationToken ct)
    {
        var now = await clock.NowAsync(actor, ct);
        var b = await trips.GetAsync(bookingId, ct) ?? throw ApiException.NotFound();
        var current = (await trips.ListForUserAsync(actor.Id, ct)).Where(x => Upcoming(x, TripRules.Today(now)) && x.Kind != "agent").OrderBy(x => x.Departure).FirstOrDefault()?.Number == b.Number;
        var trip = await BuildAsync(b, current, now, ct);
        var receipts = (await trips.ListPaymentsAsync(bookingId, ct))
            .Where(p => p.Status == "captured")
            .Select(p => new ReceiptDto($"RC-{b.Number}-{p.PublicId.ToString("N")[..8]}", p.Label == "deposit" ? "deposit" : "balance", p.AmountCents, TripRules.ToMs(p.At), Method(p)))
            .ToList();
        var cards = (await trips.ListCardsAsync(actor.Id, ct)).Select(CardOf).ToList();
        return new PaymentsViewDto(trip, receipts, cards, !actor.IsSupervised);
    }

    private static string Method(PaymentRow p) =>
        (p.Method == "card" && p.CardBrand is not null && p.Last4 is not null ? $"{BrandName(p.CardBrand)} ending {p.Last4}" : "Wallet")
        + (p.RelatedType == "helper" ? ", paid by your helper" : "");

    private static CardDto CardOf(CardRow c) => new(c.PublicId, c.Brand, c.Last4, c.Expiry);

    public async Task<List<CardDto>> AddCardAsync(UserRecord actor, AddCardRequest req, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var now = await clock.NowAsync(actor, ct);
        if (AccountRules.ValidateCard(req.Brand, req.Last4, req.Expiry, TripRules.Today(now)) is { } problem) throw ApiException.Invalid(problem);
        await trips.AddCardAsync(actor.Id, req.Brand!, req.Last4!, req.Expiry!, now, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "card", $"{BrandName(req.Brand!)} ending {req.Last4}: added", now, ct);
        return (await trips.ListCardsAsync(actor.Id, ct)).Select(CardOf).ToList();
    }

    public async Task<List<CardDto>> RemoveCardAsync(UserRecord actor, Guid cardId, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var card = (await trips.ListCardsAsync(actor.Id, ct)).FirstOrDefault(c => c.PublicId == cardId) ?? throw ApiException.NotFound();
        if (!await trips.RemoveCardAsync(actor.Id, cardId, ct)) throw ApiException.NotFound();
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "card", $"{BrandName(card.Brand)} ending {card.Last4}: removed", await clock.NowAsync(actor, ct), ct);
        return (await trips.ListCardsAsync(actor.Id, ct)).Select(CardOf).ToList();
    }

    /// <summary>
    /// Pays the rest of the balance with a saved card. The charge itself is recorded as captured: card charging goes behind <c>IPaymentGateway</c> in Phase 7,
    /// which also adds idempotency keys so a double submit cannot charge twice.
    /// </summary>
    public async Task<PaymentsViewDto> PayBalanceAsync(UserRecord actor, string? number, PayBalanceRequest req, CancellationToken ct)
    {
        var m = await access.RequireAdultMemberAsync(actor, number, ct);
        return await PayAsync(actor, actor, m.BookingId, req, helper: null, ct);
    }

    /// <summary>The guests who have made this person a live helper, with the current booking of each one this helper may pay for.</summary>
    public async Task<List<HelpedGuestDto>> HelpedGuestsAsync(UserRecord helper, CancellationToken ct)
    {
        var now = await clock.NowAsync(helper, ct);
        var list = new List<HelpedGuestDto>();
        foreach (var g in await grants.ListHelpedGuestsAsync(helper.Id, ct))
        {
            var guest = await users.FindByIdAsync(g.GuestUserId, ct);
            if (guest is null) continue;
            var held = g.Permissions.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            var canPay = AccessRules.HelperAllows(new HelperGrant { Permissions = g.Permissions, Status = "active" }, HelperPermission.Payments);
            var booking = canPay && !helper.IsSupervised ? (await CurrentAsync(guest, now, ct))?.Number : null;
            list.Add(new HelpedGuestDto(guest.PublicId, $"{guest.FirstName} {guest.LastName}".Trim(), g.Relationship, held, TripRules.ToMs(g.ChangedAt), booking));
        }
        return list;
    }

    /// <summary>What a helper with view and Payments sees of a guest's booking: the trip, receipts and the guest's cards (brand and last four only).</summary>
    public async Task<PaymentsViewDto> PaymentsForGuestAsync(UserRecord helper, Guid guestId, string? number, CancellationToken ct)
    {
        if (helper.IsSupervised) throw ApiException.Forbidden("supervised");
        var s = await subjects.ResolveAsync(helper, guestId, HelperPermission.Payments, write: false, ct);
        if (!s.ViaHelper || s.Target.Id == helper.Id) throw ApiException.Forbidden();
        var m = await access.RequireAdultMemberAsync(s.Target, number, ct);
        return await PaymentsViewAsync(s.Target, m.BookingId, ct);
    }

    /// <summary>
    /// A helper the guest consented to, with the Payments permission (and view), pays the guest's balance with one of the guest's saved cards. The guest
    /// stays the owner of the booking and the card; the payment records the helper as payer and the history shows it on both people's accounts.
    /// Someone with no live grant gets notFound; a grant without Payments gets forbidden. A booker or party member uses the normal endpoint, not this one.
    /// </summary>
    public async Task<PaymentsViewDto> PayBalanceForGuestAsync(UserRecord helper, Guid guestId, string? number, PayBalanceRequest req, CancellationToken ct)
    {
        if (helper.IsSupervised) throw ApiException.Forbidden("supervised");
        var s = await subjects.ResolveAsync(helper, guestId, HelperPermission.Payments, write: true, ct);
        if (!s.ViaHelper || s.Target.Id == helper.Id) throw ApiException.Forbidden();
        var m = await access.RequireAdultMemberAsync(s.Target, number, ct);
        return await PayAsync(helper, s.Target, m.BookingId, req, helper, ct);
    }

    /// <summary>The charge shared by both paths. <paramref name="owner"/> holds the booking and the card; <paramref name="payer"/> is who pressed pay.</summary>
    private async Task<PaymentsViewDto> PayAsync(UserRecord payer, UserRecord owner, long bookingId, PayBalanceRequest req, UserRecord? helper, CancellationToken ct)
    {
        var b = await trips.GetAsync(bookingId, ct) ?? throw ApiException.NotFound();
        if (b.Status != "confirmed") throw ApiException.Conflict("cancelled");
        var owed = b.TotalCents - b.PaidCents;
        if (owed <= 0) throw ApiException.Conflict("paid");

        var now = await clock.NowAsync(payer, ct);
        var card = req.CardId is { } id ? (await trips.ListCardsAsync(owner.Id, ct)).FirstOrDefault(c => c.PublicId == id) : null;
        if (card is null || AccountRules.CardExpired(card.Expiry, TripRules.Today(now))) throw ApiException.Invalid("card");

        await trips.InsertPaymentAsync(new NewPayment(b.BookingId, payer.Id, "balance", owed, $"PAY-{b.Number}-B-{now:yyyyMMddHHmmss}", card.Id, card.Brand, card.Last4, now, helper?.Id), ct);
        var detail = $"{owed / 100m:0.00} paid by {BrandName(card.Brand)} ending {card.Last4}";
        await accounts.AddHistoryAsync(owner.Id, payer.Id, "payment", helper is null ? detail : detail + ", paid by your helper", now, ct);
        if (helper is not null) await accounts.AddHistoryAsync(helper.Id, helper.Id, "payment", $"Paid {owed / 100m:0.00} for a guest you help", now, ct);
        return await PaymentsViewAsync(owner, b.BookingId, ct);
    }

    /// <summary>The booking the app opens on for this person (as TripView.kind = current), or null.</summary>
    public async Task<BookingRow?> CurrentAsync(UserRecord actor, DateTime now, CancellationToken ct)
    {
        var today = TripRules.Today(now);
        return (await trips.ListForUserAsync(actor.Id, ct)).Where(b => Upcoming(b, today) && b.Kind != "agent").OrderBy(b => b.Departure).FirstOrDefault();
    }
}
