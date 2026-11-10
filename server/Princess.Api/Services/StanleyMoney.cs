using System.Text.Json;
using Microsoft.Extensions.Options;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Stanley's entitlement, spend and loyalty coach (docs/stanley-gap-analysis-and-plan.md, phase 12) for the signed-in guest's own booking. Every figure comes from the services that already hold it (the package and entitlement
/// records in <see cref="PlanService"/>, the onboard account in <see cref="OnboardService"/>, the Captain's Circle record in <see cref="PostService"/>) and is worked out by <see cref="StanleyMoneyRules"/>.
/// No model reads, writes or rounds a figure here, and nothing is bought, charged, refunded or settled: a dispute only opens a tracked billing case through the phase 6 handoff, and never marks it resolved.
/// </summary>
public sealed class StanleyMoneyService(
    IStanleyTrips trips, ITripStore tripStore, IAccountStore accounts, PlanService plan, OnboardService onboard, PostService post, IStanleyHandoffStore handoffStore, StanleyHandoffService handoffs,
    IStanleyChangeStore changeStore, IUserClock clock, IClock serverClock, IOptions<StanleyOptions> options)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private sealed record Ctx(UserRecord User, StanleyTrip Trip, BookingRow Booking, DateTime Now);

    private static long Ms(DateTime utc) => new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeMilliseconds();

    private async Task<Ctx> LoadAsync(UserRecord user, string? sailingId, CancellationToken ct)
    {
        if (!options.Value.Switches.Money) throw ApiException.Conflict("off");
        if (user.IsSupervised) throw ApiException.Forbidden();
        var trip = await trips.LoadAsync(user, sailingId, ct) ?? throw ApiException.NotFound();
        var sailing = trip.SailingId ?? throw ApiException.NotFound();
        var booking = (await tripStore.ListForUserAsync(user.Id, ct)).FirstOrDefault(b => b.Status == "confirmed" && b.SailingId == sailing) ?? throw ApiException.NotFound();
        return new(user, trip, booking, await clock.NowAsync(user, ct));
    }

    // ---- the budget the guest lets Stanley watch ----

    private async Task<ChangeMemory> MemoryAsync(long userId, CancellationToken ct)
    {
        if (await changeStore.GetAsync(userId, ct) is not { } json) return ChangeMemory.Empty;
        try { return JsonSerializer.Deserialize<ChangeMemory>(json, Json) ?? ChangeMemory.Empty; }
        catch (JsonException) { return ChangeMemory.Empty; }
    }

    public async Task<long?> BudgetAsync(long userId, CancellationToken ct) => (await MemoryAsync(userId, ct)).BudgetCents;

    /// <summary>The guest says what budget Stanley may compare their spending with, or clears it (null). Only they can set it; it is kept with their change memory and deleted with it.</summary>
    public async Task<BudgetDto> SetBudgetAsync(UserRecord user, BudgetRequest? body, CancellationToken ct)
    {
        if (!options.Value.Switches.Money) throw ApiException.Conflict("off");
        if (user.IsSupervised) throw ApiException.Forbidden();
        if (body is null || !StanleyMoneyRules.ValidBudget(body.Cents)) throw ApiException.Invalid("budget");
        var memory = await MemoryAsync(user.Id, ct);
        await changeStore.PutAsync(user.Id, JsonSerializer.Serialize(memory with { BudgetCents = body.Cents }, Json), serverClock.UtcNow, ct);
        return new(body.Cents);
    }

    public async Task<BudgetDto> GetBudgetAsync(UserRecord user, CancellationToken ct) => new(user.IsSupervised ? null : await BudgetAsync(user.Id, ct));

    // ---- entitlement ----

    private sealed record PartyView(IReadOnlyList<GuestRow> Guests, PackagesViewDto View, Guid? Me);

    private async Task<PartyView> PartyAsync(Ctx c, CancellationToken ct)
    {
        var guests = await accounts.GetPartyAsync(c.Booking.BookingId, ct);
        var view = await plan.PackagesAsync(c.User, c.Booking.Number, ct);
        return new(guests, view, guests.FirstOrDefault(g => g.UserId == c.User.Id)?.PublicId);
    }

    private static string First(PartyView p, Guid id) => p.Guests.FirstOrDefault(g => g.PublicId == id)?.FirstName is { Length: > 0 } n ? n : "A traveller";

    /// <summary>Whose answer is wanted: everyone, the named traveller (by id or first name), or the signed-in guest. An unknown traveller is a 400, never a guess.</summary>
    private static IReadOnlyList<PersonEntitlementsDto> Who(PartyView p, string? traveller, bool everyone)
    {
        if (everyone) return p.View.People;
        if (!string.IsNullOrWhiteSpace(traveller))
        {
            var t = traveller.Trim();
            var match = p.View.People.FirstOrDefault(x => x.Id.ToString() == t || string.Equals(First(p, x.Id), t, StringComparison.OrdinalIgnoreCase)) ?? throw ApiException.Invalid("traveller");
            return [match];
        }
        var me = p.View.People.FirstOrDefault(x => x.Id == p.Me) ?? p.View.People.FirstOrDefault();
        return me is null ? [] : [me];
    }

    private static List<EntitlementAnswer> Answers(PartyView p, IEnumerable<PersonEntitlementsDto> who, string item, long? price, bool alcohol) =>
        [.. who.Select(x => StanleyMoneyRules.Entitlement(item, First(p, x.Id), p.View.Party.FirstOrDefault(m => m.Id == x.Id)?.Age ?? 30, x.Package, x.Entitlements, x.Balances, price, alcohol, p.View.Credit.Remaining))];

    public async Task<EntitlementAnswerDto> EntitlementAsync(UserRecord user, EntitlementRequest? body, CancellationToken ct)
    {
        var item = StanleyMoneyRules.CleanItem(body?.Item) ?? throw ApiException.Invalid("item");
        if (body!.PriceCents is { } price && price is <= 0 or > 500_000) throw ApiException.Invalid("price");
        var c = await LoadAsync(user, body.SailingId, ct);
        var party = await PartyAsync(c, ct);
        return new(Ms(c.Now), Answers(party, Who(party, body.Traveller, body.Everyone == true), item, body.PriceCents, body.Alcohol == true), StanleyMoneyRules.EntitlementNote);
    }

    // ---- what is committed, the scenario and the pace ----

    private async Task<MoneyCommitted> CommittedAsync(Ctx c, PackagesViewDto packages, CancellationToken ct)
    {
        var excursions = await plan.ExcursionsAsync(c.User, c.Booking.Number, ct);
        var dining = await plan.DiningAsync(c.User, c.Booking.Number, ct);
        var pkg = packages.Purchases.Where(p => p.Status == "active").Sum(p => p.Total);
        var tours = excursions.Booked.Where(b => b.Status == "booked").Sum(b => b.Total - b.Credit) + Math.Max(0, excursions.CartTotal - excursions.CreditApplied);
        return new(pkg, tours, dining.Reservations.Sum(r => r.Charge));
    }

    public async Task<ScenarioResult> ScenarioAsync(UserRecord user, ScenarioRequest? body, CancellationToken ct)
    {
        if (body?.Items is not { Count: > 0 and <= StanleyMoneyRules.MaxScenarioItems } items) throw ApiException.Invalid("items");
        var c = await LoadAsync(user, body.SailingId, ct);
        var party = await PartyAsync(c, ct);
        var excursions = await plan.ExcursionsAsync(c.User, c.Booking.Number, ct);
        var committed = await CommittedAsync(c, party.View, ct);
        var budget = await BudgetAsync(user.Id, ct);
        var credit = excursions.CreditLeft;
        var adds = new List<ScenarioLine>();
        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.Id) || item.Id.Length > 60) throw ApiException.Invalid("item");
            var asked = item.Guests is { Count: > 0 } g ? g.Distinct().Take(20).ToHashSet() : null;
            switch (item.Kind)
            {
                case "addOn":
                {
                    var offer = party.View.AddOns.FirstOrDefault(a => a.Id == item.Id) ?? throw ApiException.Invalid("item");
                    var who = offer.Eligible.Where(m => asked is null || asked.Contains(m.Id)).ToList();
                    if (who.Count == 0) throw ApiException.Invalid("guests");
                    var info = PackageRules.AddOn(item.Id)!;
                    var units = PackageRules.Units(info.Unit, who.Count, c.Trip.Nights);
                    adds.Add(new("addOn", item.Id, PackageRules.NameOf(item.Id) ?? item.Id, units, offer.Price, offer.Price * units, $"The price now for {who.Count} {(who.Count == 1 ? "person" : "people")}"));
                    break;
                }
                case "upgrade":
                {
                    var rows = party.View.Upgrades.Where(u => asked is null || asked.Contains(u.Guest)).Select(u => (u, option: u.Options.FirstOrDefault(o => o.To == item.Id))).Where(x => x.option is not null).ToList();
                    if (rows.Count == 0) throw ApiException.Invalid("guests");
                    var total = rows.Sum(x => x.option!.Price);
                    adds.Add(new("upgrade", item.Id, $"Upgrade to {StanleyMoneyRules.PackageName(item.Id)}", rows.Count, total / rows.Count, total, $"The price now for {rows.Count} {(rows.Count == 1 ? "person" : "people")}"));
                    break;
                }
                case "excursion":
                {
                    var offer = excursions.Offers.FirstOrDefault(o => o.Item.Id == item.Id) ?? throw ApiException.Invalid("item");
                    var who = party.View.Party.Where(m => asked is null || asked.Contains(m.Id)).ToList();
                    if (who.Count == 0) throw ApiException.Invalid("guests");
                    var gross = who.Sum(m => ExcursionRules.GuestPrice(offer.Item, m.Age));
                    var used = Math.Min(credit, gross);
                    credit -= used;
                    adds.Add(new("excursion", item.Id, offer.Item.Name, who.Count, gross / who.Count, gross - used, used > 0 ? $"The price now, less {StanleyMoneyRules.Money(used)} of the booking's shared excursion credit" : "The price now"));
                    break;
                }
                default: throw ApiException.Invalid("kind");
            }
        }
        return StanleyMoneyRules.Scenario(committed, adds, budget);
    }

    /// <summary>The spending pace of a guest who is aboard, against <paramref name="budget"/> (or with none, only the pace). Reads the onboard account; nothing is stored.</summary>
    public async Task<PaceResult> PaceForAsync(UserRecord user, StanleyTrip trip, BookingRow booking, long? budget, CancellationToken ct)
    {
        var c = new Ctx(user, trip, booking, await clock.NowAsync(user, ct));
        var folio = await onboard.FolioAsync(user, booking.Number, ct);
        var packages = await plan.PackagesAsync(user, booking.Number, ct);
        var committed = await CommittedAsync(c, packages, ct);
        // Dinner cover charges are already lines on the account, so they are left out of what was planned before sailing.
        return StanleyMoneyRules.Pace(new(folio.Totals.Balance, folio.Totals.Pending, folio.ThroughDay, trip.Nights, committed.Packages + committed.Tours, budget));
    }

    public async Task<PaceResult> PaceAsync(UserRecord user, string? sailingId, CancellationToken ct)
    {
        var c = await LoadAsync(user, sailingId, ct);
        return await PaceForAsync(user, c.Trip, c.Booking, await BudgetAsync(user.Id, ct), ct);
    }

    // ---- the folio explainer and the dispute ----

    public async Task<FolioExplainDto> FolioAsync(UserRecord user, string? sailingId, CancellationToken ct)
    {
        var c = await LoadAsync(user, sailingId, ct);
        return await FolioForAsync(c, ct);
    }

    private async Task<FolioExplainDto> FolioForAsync(Ctx c, CancellationToken ct)
    {
        var folio = await onboard.FolioAsync(c.User, c.Booking.Number, ct);
        var names = folio.Guests.ToDictionary(g => g.Id, g => g.Name.Split(' ')[0]);
        var cases = await handoffStore.ListAsync(c.User.Id, 100, ct);
        var questioned = cases.Where(r => r.Topic == "billing" && r.BookingRef.StartsWith("L-", StringComparison.Ordinal)).GroupBy(r => r.BookingRef).ToDictionary(g => g.Key, g => g.OrderBy(r => r.OpenedAt).First().Reference);
        var pace = await PaceForAsync(c.User, c.Trip, c.Booking, null, ct);
        return StanleyMoneyRules.ExplainFolio(folio.Lines, names, questioned, folio.ThroughDay, c.Trip.Nights, Ms(c.Now), pace);
    }

    /// <summary>
    /// The guest questions one charge. The line is read from their own account here (its text and amount are not taken from the request), a billing case is opened through the handoff with the line's short code,
    /// and the answer is the case. The line's state and the case's stage are never set to resolved by this: a person answers.
    /// </summary>
    public async Task<StanleyHandoffDto> DisputeAsync(UserRecord user, DisputeRequest? body, CancellationToken ct)
    {
        if (StanleyMoneyRules.DisputeProblem(body) is { } problem) throw ApiException.Invalid(problem);
        var c = await LoadAsync(user, body!.SailingId, ct);
        var explain = await FolioForAsync(c, ct);
        var id = body.LineId!.Trim();
        var line = explain.Groups.SelectMany(g => g.Lines).FirstOrDefault(l => l.Id == id || l.Short == id) ?? throw ApiException.NotFound();
        if (line.Cents <= 0) throw ApiException.Invalid("line");
        if (line.CaseReference is not null) throw ApiException.Conflict("alreadyQuestioned");
        return await handoffs.CreateAsync(user, new StanleyHandoffRequest("billing", StanleyMoneyRules.DisputeIssue(line, body.Note), "", line.Short, "", "", "guest", true), ct);
    }

    // ---- package value ----

    public async Task<PackageValueDto> PackageValueAsync(UserRecord user, PackageUseRequest? body, CancellationToken ct)
    {
        if (StanleyMoneyRules.PackageUseProblem(body) is { } problem) throw ApiException.Invalid(problem);
        var c = await LoadAsync(user, body!.SailingId, ct);
        var party = await PartyAsync(c, ct);
        var asked = body.Guests is { Count: > 0 } g ? g.Distinct().ToHashSet() : null;
        var people = party.View.People.Where(p => asked is null || asked.Contains(p.Id))
            .Select(p => (First(party, p.Id), party.View.Party.FirstOrDefault(m => m.Id == p.Id)?.Age ?? 30, p.Entitlements)).ToList();
        var rows = StanleyMoneyRules.PackageValue(people, party.View.DaysToDeparture, c.Trip.Nights, body.DrinksPerDay ?? 0, body.WifiDays ?? 0, body.SpecialtyDinners ?? 0);
        return new(Ms(c.Now), rows, StanleyMoneyRules.PackageValueLines(rows), true);
    }

    // ---- Captain's Circle ----

    public async Task<LoyaltyCoachDto> LoyaltyAsync(UserRecord user, CancellationToken ct)
    {
        if (!options.Value.Switches.Money) throw ApiException.Conflict("off");
        if (user.IsSupervised) throw ApiException.Forbidden();
        var now = await clock.NowAsync(user, ct);
        var v = await post.LoyaltyAsync(user, ct);
        var trip = await trips.LoadAsync(user, ct);
        var credits = v.Credits.Select(x => (x.Source, x.Remaining, DateOnly.ParseExact(x.ExpiresOn, "yyyy-MM-dd"))).ToList();
        return StanleyMoneyRules.Loyalty(new(v.Status.Before, v.Status.After, v.Status.DaysBefore, v.Status.DaysAfter, v.Status.Next, v.Status.DaysToNext, v.Status.Promoted, v.Counted, trip?.Nights ?? 0, credits, v.Perks), DateOnly.FromDateTime(now), Ms(now));
    }

    // ---- the chat ----

    /// <summary>
    /// The answer to a money question in the chat, as a card with no model call; null when the message is not one, or the guest has no current trip (the caller then goes on to the other routes).
    /// Every number on the card was worked out by the rules from the services above.
    /// </summary>
    public async Task<StanleyCardDto?> ChatAsync(UserRecord user, string message, string? sailingId, CancellationToken ct)
    {
        if (!options.Value.Switches.Money || user.IsSupervised) return null;
        if (StanleyMoneyRules.Classify(message) is not { } kind) return null;
        var now = await clock.NowAsync(user, ct);
        if (kind == StanleyMoneyRules.KindLoyalty) return StanleyMoneyRules.LoyaltyCard(await LoyaltyAsync(user, ct), now);
        Ctx c;
        try { c = await LoadAsync(user, sailingId, ct); }
        catch (ApiException e) when (e.Status is 404) { return null; }
        switch (kind)
        {
            case StanleyMoneyRules.KindBill:
                return StanleyMoneyRules.BillCard(await FolioForAsync(c, ct), now);
            case StanleyMoneyRules.KindPace:
                return StanleyMoneyRules.PaceCard(await PaceForAsync(user, c.Trip, c.Booking, await BudgetAsync(user.Id, ct), ct), now);
            case StanleyMoneyRules.KindPackages:
                return new StanleyCardDto("money", "Package value", ["Pick the use you expect (drinks a day, Wi-Fi days, specialty dinners) on the Packages screen and I will compare each package with paying as you go. I do not guess how much you will use."],
                    new([StanleyChips.Booking], "Princess price list", now, "live", false, "Nothing is compared until you choose a use."), false, [new CitationDto("Packages", "/me/packages")]);
            case StanleyMoneyRules.KindSpend:
                return new StanleyCardDto("money", "If you book this", ["Tell me what to add on the Packages screen and I will show the family total with and without it. Prices are the ones on that screen today."],
                    new([StanleyChips.Booking], "Princess price list", now, "live", false, "An illustration only. Nothing is booked."), false, [new CitationDto("Packages", "/me/packages")]);
            default:
            {
                var item = StanleyMoneyRules.ItemOf(message);
                if (item is null) return null;
                var party = await PartyAsync(c, ct);
                var names = party.View.People.Select(p => First(party, p.Id)).ToList();
                var named = StanleyMoneyRules.NameIn(message, names);
                var who = Who(party, named, named is null && StanleyMoneyRules.MeansEveryone(message));
                return StanleyMoneyRules.EntitlementCard(Answers(party, who, item, StanleyMoneyRules.PriceOf(message), StanleyMoneyRules.MeansAlcohol(message)), now);
            }
        }
    }
}
