using System.Security.Cryptography;
using System.Text.Json;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The booking funnel and what happens to a booking afterwards: pricing, drafts, booking and charging, paying the balance, changing the sailing and cancelling.
/// Ports <c>src/api/bookingMock.ts</c>. Every money rule runs here (D15); a charge goes through <see cref="IPaymentGateway"/> and is recorded only after it succeeds.
/// </summary>
public sealed class BookingService(
    AccessService access, IBookingStore bookings, ITripStore trips, IAccountStore accounts, TripService tripService, IUserClock clock, IPaymentGateway gateway)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private const string BookRoute = "book";
    private const string PayRoute = "pay-balance";

    private static DateOnly D(DateTime d) => DateOnly.FromDateTime(d);

    private static void RequireAdult(UserRecord actor)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
    }

    private async Task<(List<SailingRow> All, HashSet<string> Known)> SailingsAsync(CancellationToken ct)
    {
        var all = (await trips.ListSailingsAsync(ct)).Where(s => Pricing.HasPrice(s.Id)).ToList();
        return (all, [.. all.Select(s => s.Id)]);
    }

    // ---- Quote, fares, prefill ----

    private async Task<(Draft Draft, SailingRow Sailing, string Category, string Fare)> UsableAsync(Draft? raw, CancellationToken ct)
    {
        var (all, known) = await SailingsAsync(ct);
        var draft = DraftRules.Normalize(raw, known);
        var sailing = all.FirstOrDefault(s => s.Id == draft.SailingId);
        if (sailing is null || draft.Category.Length == 0 || draft.Fare.Length == 0) throw ApiException.Invalid("incomplete");
        return (draft, sailing, draft.Category, draft.Fare);
    }

    public async Task<List<FareOptionDto>> FaresAsync(Draft? raw, CancellationToken ct)
    {
        var (all, known) = await SailingsAsync(ct);
        var draft = DraftRules.Normalize(raw, known);
        if (all.All(s => s.Id != draft.SailingId) || draft.Category.Length == 0) throw ApiException.Invalid("incomplete");
        var options = Pricing.FareOptions(draft.Category)
            .Select(id => (Id: id, Total: Pricing.BookingQuote(draft.SailingId, draft.Category, draft.Guests, id)?.Total ?? 0)).ToList();
        var lowest = options.Min(o => o.Total);
        return options.Select(o => new FareOptionDto(o.Id, o.Total, o.Total - lowest, Pricing.FareIncluded(draft.Category) == o.Id, Pricing.Fare(o.Id)!.PerNight)).ToList();
    }

    private async Task<(bool NumberOk, string Tier, Pricing.PerkSums Sums, long CreditLeft)> PerksAsync(UserRecord actor, Draft draft, long total, DateOnly today, CancellationToken ct)
    {
        var loyalty = await bookings.GetLoyaltyAsync(actor.Id, today, ct);
        var numberOk = Pricing.LoyaltyNumberOk(draft.LoyaltyNumber);
        var tier = numberOk ? Pricing.TierForNumber(draft.LoyaltyNumber, loyalty.Number, actor.Tier) : "none";
        return (numberOk, tier, Pricing.ApplyPerks(total, draft.LoyaltyNumber, tier, draft.UseCredit, loyalty.CreditLeftCents), loyalty.CreditLeftCents);
    }

    public async Task<QuoteViewDto> QuoteAsync(UserRecord actor, Draft? raw, CancellationToken ct)
    {
        var (draft, sailing, category, fare) = await UsableAsync(raw, ct);
        var q = Pricing.BookingQuote(sailing.Id, category, draft.Guests, fare) ?? throw ApiException.Invalid("combination");
        var now = await clock.NowAsync(actor, ct);
        var today = TripRules.Today(now);
        var days = TripRules.DaysBetween(today, D(sailing.Departure));
        var p = await PerksAsync(actor, draft, q.Total, today, ct);
        return new QuoteViewDto(q, Pricing.PromotionsFor(category, days), TripRules.ToMs(now.AddHours(Pricing.PriceLockHours)), Pricing.PayPlanFor(p.Sums.Total, D(sailing.Departure), days), days,
            p.Sums.Total, new PerksDto(p.NumberOk, p.Tier, p.Sums.Discount, p.Sums.Credit, p.CreditLeft));
    }

    /// <summary>The person first, then the others on their current booking, up to four, filled from their profiles (ACT-03).</summary>
    public async Task<PrefillDto> PrefillAsync(UserRecord actor, CancellationToken ct)
    {
        var now = await clock.NowAsync(actor, ct);
        var ids = new List<long> { actor.Id };
        if (await tripService.CurrentAsync(actor, now, ct) is { } current)
            ids.AddRange((await accounts.GetPartyAsync(current.BookingId, ct)).Select(g => g.UserId).Where(id => id != actor.Id));

        var people = new List<GuestDraft>();
        LeadContact contact = new();
        foreach (var id in ids.Distinct().Take(4))
        {
            var p = await accounts.GetProfileAsync(id, ct);
            if (p is null) continue;
            people.Add(new GuestDraft
            {
                FirstName = p.FirstName, LastName = p.LastName, Dob = D(p.Dob).ToString("yyyy-MM-dd"), Citizenship = p.Citizenship, Needs = [.. p.Needs], Dietary = [.. p.Dietary],
                DietaryStatus = p.Dietary.Count > 0 ? "some" : "",
            });
            if (id == actor.Id) contact = new LeadContact { Email = p.Email ?? "", Phone = p.Phone ?? "" };
        }
        return new PrefillDto(people, contact);
    }

    // ---- Draft ----

    private static Draft ToDraft(DraftRecord r, IReadOnlySet<string> known) => DraftRules.Normalize(new Draft
    {
        Id = r.Id, SailingId = r.SailingId ?? "", Category = r.CategoryId ?? "", Guests = r.Guests, CabinMode = r.CabinMode, CabinNumber = r.CabinNumber ?? "", Fare = r.FareId ?? "",
        People = JsonSerializer.Deserialize<List<GuestDraft>>(r.PeopleJson, Json) ?? [], Contact = JsonSerializer.Deserialize<LeadContact>(r.ContactJson, Json) ?? new(),
        Dining = r.Dining ?? "", Occasion = r.Occasion, LoyaltyNumber = r.LoyaltyNumber ?? "", UseCredit = r.UseCredit,
        Accepted = JsonSerializer.Deserialize<Dictionary<string, bool>>(r.AcceptedJson, Json) ?? [], UpdatedAt = TripRules.ToMs(r.UpdatedAt),
    }, known);

    private static string NewDraftId() => Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();

    public async Task<Draft?> GetDraftAsync(UserRecord actor, CancellationToken ct)
    {
        var r = await bookings.GetDraftAsync(actor.Id, ct);
        return r is null ? null : ToDraft(r, (await SailingsAsync(ct)).Known);
    }

    /// <summary>Saves the one live draft. Its id is chosen here, at random, because it is also the secret in the resume link; the id comes back in the response.</summary>
    public async Task<Draft> SaveDraftAsync(UserRecord actor, Draft? raw, CancellationToken ct)
    {
        RequireAdult(actor);
        var now = await clock.NowAsync(actor, ct);
        var draft = DraftRules.Normalize(raw, (await SailingsAsync(ct)).Known);
        var saved = await bookings.SaveDraftAsync(actor.Id, new DraftRecord
        {
            SailingId = draft.SailingId.Length > 0 ? draft.SailingId : null, CategoryId = draft.Category.Length > 0 ? draft.Category : null, Guests = draft.Guests, CabinMode = draft.CabinMode,
            CabinNumber = draft.CabinNumber.Length > 0 ? draft.CabinNumber : null, FareId = draft.Fare.Length > 0 ? draft.Fare : null, Dining = draft.Dining.Length > 0 ? draft.Dining : null,
            Occasion = draft.Occasion, LoyaltyNumber = draft.LoyaltyNumber.Length > 0 ? draft.LoyaltyNumber : null, UseCredit = draft.UseCredit,
            AcceptedJson = JsonSerializer.Serialize(draft.Accepted, Json), PeopleJson = JsonSerializer.Serialize(draft.People, Json), ContactJson = JsonSerializer.Serialize(draft.Contact, Json),
        }, NewDraftId(), now, ct);
        draft.Id = saved.Id;
        draft.UpdatedAt = TripRules.ToMs(now);
        return draft;
    }

    public Task DiscardDraftAsync(UserRecord actor, CancellationToken ct) => bookings.DeleteDraftAsync(actor.Id, ct);

    public async Task<ResumeSentDto> SendResumeLinkAsync(UserRecord actor, SendResumeLinkRequest req, CancellationToken ct)
    {
        RequireAdult(actor);
        var draft = await bookings.GetDraftAsync(actor.Id, ct) ?? throw ApiException.NotFound();
        var address = (req.To ?? "").Trim();
        var email = req.Via == "email";
        if (req.Via is not ("email" or "sms") || (email ? !System.Text.RegularExpressions.Regex.IsMatch(address, @"^[^\s@]+@[^\s@]+\.[^\s@]+$") : !AccountRules.PhoneOk(address)))
            throw ApiException.Invalid("address");
        var now = await clock.NowAsync(actor, ct);
        var masked = email ? DraftRules.MaskEmail(address) : DraftRules.MaskPhone(address);
        await bookings.AddResumeLinkAsync(draft.Id, req.Via!, masked, Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant(), now, now.AddDays(30), ct);
        return new ResumeSentDto(req.Via!, masked, $"/book/resume/{draft.Id}", TripRules.ToMs(now));
    }

    // ---- Payment plumbing ----

    private Task<List<ChargePart>> ResolvePartsAsync(UserRecord actor, List<PaymentPartDto>? dtos, long due, DateOnly today, CancellationToken ct) =>
        PaymentPlumbing.ResolvePartsAsync(trips, actor, dtos, due, today, ct);

    private static NewBookingPayment PaymentOf(UserRecord actor, string label, string reference, DateTime at, ChargeResult result) =>
        PaymentPlumbing.PaymentOf(actor, label, reference, at, result);

    // ---- View ----

    private static string MethodOf(ReceiptPartRow p) => p.Method == "wallet" ? "Device wallet" : $"{TripService.BrandName(p.CardBrand ?? "")} ending {p.Last4}";

    public static BookingViewDto ViewOf(BookingDetail d, DateTime now)
    {
        var b = d.Row;
        var today = TripRules.Today(now);
        var departure = D(b.Departure);
        var days = TripRules.DaysBetween(today, departure);
        var cancelled = b.Status == "cancelled";
        var receipts = d.Receipts.Select((r, i) => new BookingReceiptDto($"RC-{b.Number}-{i + 1}", r.Label, r.AmountCents, TripRules.ToMs(r.At),
            r.Parts.Count > 0 ? [.. r.Parts.Select(MethodOf)] : [r.Label == "refund" ? "Refunded to the original payment" : "Card"])).ToList();
        var paid = d.Receipts.Sum(r => r.AmountCents);
        var balance = cancelled ? 0 : Math.Max(0, b.TotalCents - paid);
        var finalDue = D(b.FinalDueDate).ToString("yyyy-MM-dd");
        var plan = Pricing.PayPlanFor(b.TotalCents, departure, days, d.FinalPaymentDays);
        var state = TripRules.PaymentState(new TripRules.PaymentPlan(b.TotalCents, paid, balance, finalDue, ""), balance == 0, today);
        var people = d.Guests.Select(g => new GuestDraft
        {
            FirstName = g.FirstName, LastName = g.LastName, Dob = D(g.Dob).ToString("yyyy-MM-dd"), Gender = g.Gender, Citizenship = g.Citizenship, Needs = g.Needs,
            DietaryStatus = g.DietaryStatus, Dietary = g.Dietary, AllergyNote = g.AllergyNote,
        }).ToList();
        var terms = PolicyRules.CancelTermsFor(b.TotalCents, paid, plan.Deposit, days, (now - b.ConfirmedAt).TotalHours);
        return new BookingViewDto(
            b.Number, b.Status, b.SailingId, departure.ToString("yyyy-MM-dd"), departure.AddDays(b.Nights).ToString("yyyy-MM-dd"), b.CategoryId, b.CategoryName, b.CabinNumber, b.FareId,
            people, new LeadContact { Email = d.ContactEmail ?? "", Phone = d.ContactPhone ?? "" }, d.Dining, d.Occasion, b.TotalCents, paid, balance, finalDue, state, receipts,
            [.. d.Acceptances.Select(a => new AcceptanceDto(a.LegalId, PolicyRules.VersionLabel(a.Version), TripRules.ToMs(a.At)))],
            [.. d.Notified.Select(n => new NotifiedDto(n.Via, n.ToMasked))], days, TripRules.ToMs(b.ConfirmedAt), terms, !cancelled && days >= 1,
            !cancelled && PolicyRules.ChangeCheck(days, int.MaxValue, false, d.FinalPaymentDays) == "ok",
            d is { CancelledAt: { } at } ? new CancelledDto(TripRules.ToMs(at), d.CancelFeeCents ?? 0, d.CancelRefundCents ?? 0) : null);
    }

    private async Task<BookingDetail> DetailAsync(long bookingId, CancellationToken ct) => await bookings.GetDetailAsync(bookingId, ct) ?? throw ApiException.NotFound();

    public async Task<BookingViewDto> GetAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var m = await access.RequireMemberAsync(actor, number, ct);
        return ViewOf(await DetailAsync(m.BookingId, ct), await clock.NowAsync(actor, ct));
    }

    // ---- Book ----

    private async Task<string> NewNumberAsync(string draftId, CancellationToken ct)
    {
        var h = 5381u;
        foreach (var ch in draftId) h = unchecked(h * 33 + ch);
        for (uint n = 0; ; n++)
        {
            var number = $"PB{100_000 + unchecked(h + n * 7919) % 900_000}";
            if (!await bookings.NumberTakenAsync(number, ct)) return number;
        }
    }

    private async Task<BookingViewDto> ReplayAsync(UserRecord actor, string draftId, DateTime now, CancellationToken ct)
    {
        var existing = await bookings.FindByDraftAsync(draftId, ct);
        if (existing is null || existing.BookerUserId != actor.Id) throw ApiException.Conflict("draftTaken");
        return ViewOf(await DetailAsync(existing.BookingId, ct), now);
    }

    /// <summary>
    /// Books and charges. Booking the same draft twice, or the same <paramref name="idempotencyKey"/> twice, returns the first booking and charges nothing.
    /// Failures: invalid (incomplete answers, bad payment), conflict (priceChanged, cabinTaken, closed), challenge, declined.
    /// </summary>
    public async Task<BookingViewDto> BookAsync(UserRecord actor, BookRequest req, string? idempotencyKey, CancellationToken ct)
    {
        RequireAdult(actor);
        var now = await clock.NowAsync(actor, ct);
        var (all, known) = await SailingsAsync(ct);
        var draft = DraftRules.Normalize(req.Draft, known);
        if (draft.Id.Length == 0) throw ApiException.Invalid("draft");

        if (idempotencyKey is not null && await bookings.FindIdempotentAsync(idempotencyKey, actor.Id, BookRoute, ct) is { } first)
            return await ReplayAsync(actor, first, now, ct);
        if (await bookings.FindByDraftAsync(draft.Id, ct) is not null) return await ReplayAsync(actor, draft.Id, now, ct);

        var today = TripRules.Today(now);
        var sailing = all.FirstOrDefault(s => s.Id == draft.SailingId);
        var departureText = sailing is null ? null : D(sailing.Departure).ToString("yyyy-MM-dd");
        if (DraftRules.Steps.Any(step => DraftRules.StepProblems(draft, step, departureText, today.ToString("yyyy-MM-dd"), known).Count > 0)) throw ApiException.Invalid("incomplete");
        if (sailing is null) throw ApiException.Invalid("incomplete");

        var departure = D(sailing.Departure);
        var days = TripRules.DaysBetween(today, departure);
        if (!sailing.BookingOpen || !Pricing.Bookable(days)) throw ApiException.Conflict("closed");
        var q = Pricing.BookingQuote(sailing.Id, draft.Category, draft.Guests, draft.Fare) ?? throw ApiException.Invalid("combination");
        var p = await PerksAsync(actor, draft, q.Total, today, ct);
        if (p.Sums.Total != req.ExpectedTotal) throw ApiException.Conflict("priceChanged");

        if (draft.CabinMode == "pick")
        {
            var taken = await bookings.TakenCabinsAsync(sailing.Id, ct);
            if (!CabinRules.Available(sailing.Id, draft.Category, draft.CabinNumber, taken)) throw ApiException.Conflict("cabinTaken");
        }

        var plan = Pricing.PayPlanFor(p.Sums.Total, departure, days);
        var option = req.Option ?? "";
        if (!plan.Options.Contains(option)) throw ApiException.Invalid("option");
        var due = Pricing.DueNow(plan, option);
        var parts = await ResolvePartsAsync(actor, req.Parts, due, today, ct);

        var number = await NewNumberAsync(draft.Id, ct);
        var reference = $"PAY-{number}-{(option == "full" ? "F" : "D")}-{now:yyMMddHHmmss}";
        var charged = await gateway.ChargeAsync(reference, parts, req.Challenge, ct);

        var profile = await accounts.GetProfileAsync(actor.Id, ct);
        var lead = draft.People[0];
        var printed = $"{(profile?.LastName ?? lead.LastName).Trim().ToUpperInvariant()}/{(profile?.FirstName ?? lead.FirstName).Trim().ToUpperInvariant()}";
        var booking = new NewBooking
        {
            Number = number, DraftId = draft.Id, BookerUserId = actor.Id, BookerPrinted = printed.Length > 80 ? printed[..80] : printed,
            SailingId = sailing.Id, CategoryId = draft.Category, CabinNumber = draft.CabinMode == "pick" ? draft.CabinNumber : null, FareId = draft.Fare,
            Dining = draft.Dining, Occasion = draft.Occasion, TotalCents = p.Sums.Total, DepositCents = plan.Deposit, FinalDueDate = departure.AddDays(-Pricing.DefaultFinalPaymentDays).ToDateTime(TimeOnly.MinValue),
            FinalPaymentDays = Pricing.DefaultFinalPaymentDays, LoyaltyNumber = p.NumberOk ? draft.LoyaltyNumber : null, DiscountCents = p.Sums.Discount, CreditUsedCents = p.Sums.Credit,
            ContactEmail = draft.Contact.Email.Trim(), ContactPhone = draft.Contact.Phone.Trim(), ConfirmedAt = now,
            Guests = [.. draft.People.Select((g, i) => new GuestDetailRow
            {
                Seq = i + 1, FirstName = g.FirstName.Trim(), LastName = g.LastName.Trim(), Dob = DateOnly.ParseExact(g.Dob, "yyyy-MM-dd").ToDateTime(TimeOnly.MinValue), Gender = g.Gender,
                Citizenship = g.Citizenship, DietaryStatus = g.DietaryStatus, AllergyNote = g.AllergyNote, Dietary = g.Dietary, Needs = g.Needs,
            })],
            Acceptances = [.. PolicyRules.Accepted(draft.Accepted).Select(id => new AcceptanceRow(id, PolicyRules.LegalVersion, now))],
            Notified = [new NotifiedRow("email", DraftRules.MaskEmail(draft.Contact.Email.Trim()), now), new NotifiedRow("sms", DraftRules.MaskPhone(draft.Contact.Phone), now)],
            Payment = PaymentOf(actor, option == "full" ? "full" : "deposit", reference, now, charged),
        };

        long id;
        try
        {
            id = await bookings.CreateBookingAsync(booking, ct);
        }
        catch (ApiException e) when (e.Title == "duplicate")
        {
            // A second request for the same draft got there first; its booking is the answer.
            return await ReplayAsync(actor, draft.Id, now, ct);
        }

        await bookings.DeleteDraftAsync(actor.Id, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "booking", $"{number}: booked", now, ct);
        if (idempotencyKey is not null) await bookings.SaveIdempotentAsync(idempotencyKey, actor.Id, BookRoute, draft.Id, now, ct);
        return ViewOf(await DetailAsync(id, ct), now);
    }

    // ---- After booking ----

    /// <summary>Pays the rest of the balance with one or two methods. A repeated <paramref name="idempotencyKey"/> returns the booking without charging again.</summary>
    public async Task<BookingViewDto> PayBalanceAsync(UserRecord actor, string? number, PayBalancePartsRequest req, string? idempotencyKey, CancellationToken ct)
    {
        var m = await access.RequireAdultMemberAsync(actor, number, ct);
        var now = await clock.NowAsync(actor, ct);
        if (idempotencyKey is not null && await bookings.FindIdempotentAsync(idempotencyKey, actor.Id, PayRoute, ct) is not null)
            return ViewOf(await DetailAsync(m.BookingId, ct), now);

        var d = await DetailAsync(m.BookingId, ct);
        var view = ViewOf(d, now);
        if (d.Row.Status != "confirmed" || view.Balance == 0) throw ApiException.Conflict("nothingDue");

        var parts = await ResolvePartsAsync(actor, req.Parts, view.Balance, TripRules.Today(now), ct);
        var reference = $"PAY-{d.Row.Number}-B-{now:yyMMddHHmmss}";
        var charged = await gateway.ChargeAsync(reference, parts, req.Challenge, ct);
        await bookings.AddPaymentAsync(m.BookingId, PaymentOf(actor, "balance", reference, now, charged), ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "payment", $"{d.Row.Number}: balance paid", now, ct);
        if (idempotencyKey is not null) await bookings.SaveIdempotentAsync(idempotencyKey, actor.Id, PayRoute, d.Row.Number, now, ct);
        return ViewOf(await DetailAsync(m.BookingId, ct), now);
    }

    private sealed record ChangeFacts(string Check, QuoteResult Quote, SailingRow Next, bool CabinKept, BookingDetail Detail, BookingViewDto View);

    private async Task<ChangeFacts> ChangeFactsAsync(UserRecord actor, long bookingId, string? sailingId, DateTime now, CancellationToken ct)
    {
        var d = await DetailAsync(bookingId, ct);
        var (all, _) = await SailingsAsync(ct);
        var next = all.FirstOrDefault(s => s.Id == sailingId) ?? throw ApiException.Invalid("sailing");
        var q = Pricing.BookingQuote(next.Id, d.Row.CategoryId, d.Row.GuestCount, d.Row.FareId) ?? throw ApiException.Invalid("sailing");
        var today = TripRules.Today(now);
        var currentDays = TripRules.DaysBetween(today, D(d.Row.Departure));
        var nextDays = TripRules.DaysBetween(today, D(next.Departure));
        var check = next.BookingOpen && Pricing.Bookable(nextDays) ? PolicyRules.ChangeCheck(currentDays, nextDays, next.Id == d.Row.SailingId, d.FinalPaymentDays) : "newTooSoon";
        var kept = d.Row.CabinNumber is null || CabinRules.Available(next.Id, d.Row.CategoryId, d.Row.CabinNumber, await bookings.TakenCabinsAsync(next.Id, ct));
        return new ChangeFacts(check, q, next, kept, d, ViewOf(d, now));
    }

    public async Task<ChangePreviewDto> ChangePreviewAsync(UserRecord actor, string? number, string? sailingId, CancellationToken ct)
    {
        var m = await access.RequireBookerAsync(actor, number, ct);
        var f = await ChangeFactsAsync(actor, m.BookingId, sailingId, await clock.NowAsync(actor, ct), ct);
        return new ChangePreviewDto(f.Check, f.Quote.Total, f.Quote.Total - f.Detail.Row.TotalCents, f.CabinKept);
    }

    /// <summary>Moves to another sailing at its price. A guest who has paid more than the new total is refunded the difference; a stateroom picked earlier is kept only if it is free on the new sailing.</summary>
    public async Task<BookingViewDto> ChangeAsync(UserRecord actor, string? number, string? sailingId, CancellationToken ct)
    {
        var m = await access.RequireBookerAsync(actor, number, ct);
        var now = await clock.NowAsync(actor, ct);
        var f = await ChangeFactsAsync(actor, m.BookingId, sailingId, now, ct);
        if (f.Detail.Row.Status != "confirmed") throw ApiException.Invalid("sailing");
        if (f.Check != "ok") throw ApiException.Conflict(f.Check);

        var b = f.Detail.Row;
        var paid = f.View.Paid;
        var newDeparture = D(f.Next.Departure);
        var refund = paid > f.Quote.Total
            ? new NewBookingPayment(actor.Id, "refund", f.Quote.Total - paid, $"RFD-{b.Number}-{now:yyMMddHHmmss}", now, [])
            : null;
        await bookings.ChangeSailingAsync(new SailingChange(m.BookingId, f.Next.Id, f.Quote.Total, Math.Min(b.DepositCents, f.Quote.Total),
            newDeparture.AddDays(-f.Detail.FinalPaymentDays).ToDateTime(TimeOnly.MinValue), f.CabinKept ? b.CabinNumber : null, refund, now), ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "booking", $"{b.Number}: moved to {newDeparture:yyyy-MM-dd}", now, ct);
        return ViewOf(await DetailAsync(m.BookingId, ct), now);
    }

    public async Task<BookingViewDto> CancelAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var m = await access.RequireBookerAsync(actor, number, ct);
        var now = await clock.NowAsync(actor, ct);
        var d = await DetailAsync(m.BookingId, ct);
        var v = ViewOf(d, now);
        if (!v.CanCancel) throw ApiException.Conflict("closed");

        var refund = v.Cancel.Refund > 0 ? new NewBookingPayment(actor.Id, "refund", -v.Cancel.Refund, $"RFD-{d.Row.Number}-{now:yyMMddHHmmss}", now, []) : null;
        await bookings.CancelAsync(new Cancellation(m.BookingId, now, v.Cancel.Fee, v.Cancel.Refund, refund), ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "booking", $"{d.Row.Number}: cancelled", now, ct);
        return ViewOf(await DetailAsync(m.BookingId, ct), now);
    }
}
