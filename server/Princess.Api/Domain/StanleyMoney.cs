using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

// ---- Entitlement, spend and loyalty coach (docs/stanley-gap-analysis-and-plan.md, phase 12) ----
//
// Every figure here is computed by the rules below from what the services return (the package and entitlement records, the onboard account, the loyalty record, the price tables).
// No model writes, rounds or changes a number: the chat answers in this area are cards built here with no model call, and a test checks that every amount on a card is one the rules produced.
// Anything that is a guess (a pace, a scenario, a package comparison) is labelled illustrative and says what it leaves out.

/// <summary>What a guest can ask "is it included for me?" about.</summary>
public static class MoneyItems
{
    public const string Drink = "drink", Wifi = "wifi", Specialty = "specialty", Excursion = "excursion", Gratuity = "gratuity", Laundry = "laundry", Priority = "priority";
    public static readonly string[] All = [Drink, Wifi, Specialty, Excursion, Gratuity, Laundry, Priority];
}

public static class MoneyVerdicts
{
    /// <summary>Included: nothing to pay. Partly: some is covered. Not included: the guest pays. All used: it was included and has run out.</summary>
    public const string Included = "included", Partly = "partly", NotIncluded = "notIncluded", AllUsed = "allUsed";
}

/// <summary>One traveller's answer. <see cref="YouPayCents"/> is set only when the guest gave a price and the rule can work it out exactly.</summary>
public sealed record EntitlementAnswer(string Item, string Traveller, string Verdict, IReadOnlyList<string> Lines, string Basis, long? YouPayCents);

public sealed record EntitlementRequest(string? Item, string? Traveller, bool? Everyone, long? PriceCents, bool? Alcohol, string? SailingId);

public sealed record EntitlementAnswerDto(long AsOf, IReadOnlyList<EntitlementAnswer> Answers, string Note);

// ---- the spend coach ----

public sealed record ScenarioItem(string? Kind, string? Id, List<Guid>? Guests);

public sealed record ScenarioRequest(List<ScenarioItem>? Items, string? SailingId);

/// <summary>What the family has already committed to before sailing, in cents: packages, booked tours (after credit) and dinner cover charges.</summary>
public sealed record MoneyCommitted(long Packages, long Tours, long Dining)
{
    public long Total => Packages + Tours + Dining;
}

public sealed record ScenarioLine(string Kind, string Id, string Label, int Units, long UnitCents, long TotalCents, string Basis);

public sealed record ScenarioResult(
    MoneyCommitted Now, IReadOnlyList<ScenarioLine> Adds, long AddedCents, long NewTotalCents, long? BudgetCents, long? LeftCents, string State, IReadOnlyList<string> Lines, IReadOnlyList<string> NotCounted, bool Illustrative);

public sealed record PaceInput(long OnboardCents, long PendingCents, int Day, int Nights, long CommittedCents, long? BudgetCents);

/// <summary>
/// Pace against the budget the guest set. <see cref="State"/> is <c>noBudget</c>, <c>tooEarly</c> (under three days of spending to go on), <c>onTrack</c>, <c>near</c> (within a tenth of the budget) or <c>over</c>.
/// The projection is a straight line from what has been charged so far, so it is always illustrative.
/// </summary>
public sealed record PaceResult(
    string State, long? BudgetCents, long CommittedCents, long OnboardCents, long PendingCents, int Day, int Nights, long? ProjectedOnboardCents, long? ProjectedTotalCents, long? OverCents, IReadOnlyList<string> Lines, bool Illustrative);

public sealed record BudgetRequest(long? Cents);

public sealed record BudgetDto(long? Cents);

// ---- the folio explainer ----

public sealed record FolioExplainLine(string Id, string Short, int Day, long At, string Description, string Guest, string Category, long Cents, string State, string Why, string? CaseReference);

public sealed record FolioExplainGroup(string State, string Heading, string Meaning, long Cents, int Count, IReadOnlyList<FolioExplainLine> Lines);

public sealed record FolioEstimate(long Cents, string Text, bool Illustrative);

public sealed record FolioExplainDto(
    long AsOf, bool Final, int ThroughDay, long PostedCents, long PendingCents, long CreditsCents, long CoveredCents, IReadOnlyList<FolioExplainGroup> Groups, FolioEstimate? Estimate, IReadOnlyList<string> Lines);

public sealed record DisputeRequest(string? LineId, string? Note, bool Consent, string? SailingId);

// ---- package value ----

public sealed record PackageUseRequest(int? DrinksPerDay, int? WifiDays, int? SpecialtyDinners, List<Guid>? Guests, string? SailingId);

public sealed record PackageValueRow(string Id, string Name, int People, long PackageCents, long PayAsYouGoCents, long DifferenceCents, string Verdict, string Basis, IReadOnlyList<string> Lines);

public sealed record PackageValueDto(long AsOf, IReadOnlyList<PackageValueRow> Rows, IReadOnlyList<string> Lines, bool Illustrative);

// ---- Captain's Circle ----

public sealed record LoyaltyCredit(string Source, long RemainingCents, string ExpiresOn, int DaysLeft, bool Expired, bool ExpiresSoon);

public sealed record LoyaltyCoachDto(
    long AsOf, string Tier, int Days, string? NextTier, int? DaysToNext, bool Counted, IReadOnlyList<LoyaltyCredit> Credits, long UsableCreditCents, IReadOnlyList<string> Perks, IReadOnlyList<string> Lines);

public sealed record LoyaltyInput(
    string Before, string After, int DaysBefore, int DaysAfter, string? Next, int? DaysToNext, bool Promoted, bool Counted, int Nights, IReadOnlyList<(string Source, long Remaining, DateOnly ExpiresOn)> Credits, IReadOnlyList<string> Perks);

public static class StanleyMoneyRules
{
    public const int MaxScenarioItems = 5, MaxNote = 300, ExpiresSoonDays = 90, MinPaceDay = 3;
    public static readonly int[] DrinkRange = [0, 12];
    public const double NearShare = 0.9;
    public const long MaxBudgetCents = 100_000_000;

    // ---- small helpers ----

    /// <summary>"$45" or "$45.50": whole dollars when there are no cents. Money always shows its currency sign; this app prices everything in US dollars.</summary>
    public static string Money(long cents)
    {
        var sign = cents < 0 ? "-" : "";
        var abs = Math.Abs(cents);
        return abs % 100 == 0 ? $"{sign}${(abs / 100).ToString("N0", CultureInfo.InvariantCulture)}" : $"{sign}${(abs / 100m).ToString("N2", CultureInfo.InvariantCulture)}";
    }

    private static string Dollars(int whole) => Money(whole * 100L);

    public static string PackageName(string package) => package switch { "plus" => "Princess Plus", "premier" => "Princess Premier", _ => "no package" };

    /// <summary>The short code a case carries for one account line: the line's own id can be long and holds a traveller's id, so a short fingerprint of it is used instead.</summary>
    public static string LineCode(string lineId)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes("folio|" + lineId));
        return "L-" + Convert.ToHexString(hash)[..8].ToLowerInvariant();
    }

    public static string? CleanItem(string? item) => item is not null && MoneyItems.All.Contains(item) ? item : null;

    // ---- entitlement ----

    /// <summary>
    /// Whether one thing is included for one traveller, from that traveller's entitlements and what is left of them. <paramref name="priceCents"/> is a price the guest gave (never one read from a model);
    /// with it a drink gets an exact figure for what they would pay, the bar service charge included.
    /// </summary>
    public static EntitlementAnswer Entitlement(string item, string name, int age, string package, Entitlements e, Balances b, long? priceCents, bool alcohol, long creditLeftCents)
    {
        var basis = package == "none" ? "Your booking, your Captain's Circle level and any add-ons you bought" : $"{PackageName(package)}, your Captain's Circle level and any add-ons you bought";
        EntitlementAnswer Make(string verdict, long? pay, params string[] lines) => new(item, name, verdict, lines, basis, pay);

        switch (item)
        {
            case MoneyItems.Drink:
            {
                if (alcohol && age < 21) return Make(MoneyVerdicts.NotIncluded, null, $"{name} is under 21, so alcoholic drinks are not served to {name} and no package changes that.");
                if (e.DrinkCapUsd <= 0)
                {
                    var pay = priceCents is { } p ? p + (long)Math.Round(p * FolioRules.BarServiceRate, MidpointRounding.AwayFromZero) : (long?)null;
                    return Make(MoneyVerdicts.NotIncluded, pay, $"{name} has no drinks package, so a drink is charged to the account with the {Math.Round(FolioRules.BarServiceRate * 100)}% bar service charge.",
                        pay is { } v ? $"At {Money(priceCents!.Value)} that is {Money(v)}." : "Tell me a price and I will work it out.");
                }
                var cap = e.DrinkCapUsd * 100L;
                if (priceCents is not { } price)
                    return Make(MoneyVerdicts.Included, null, $"Yes, for {name}: a drink priced up to {Dollars(e.DrinkCapUsd)} is included. Above that, {name} pays the difference and the {Math.Round(FolioRules.BarServiceRate * 100)}% service charge on it.");
                if (price <= cap) return Make(MoneyVerdicts.Included, 0, $"Yes, for {name}: at {Money(price)} it is under the {Dollars(e.DrinkCapUsd)} limit, so {name} pays nothing.");
                var over = price - cap;
                var total = over + (long)Math.Round(over * FolioRules.BarServiceRate, MidpointRounding.AwayFromZero);
                return Make(MoneyVerdicts.Partly, total, $"Partly, for {name}: the package covers {Dollars(e.DrinkCapUsd)} of a {Money(price)} drink.",
                    $"{name} pays the {Money(over)} difference plus the {Math.Round(FolioRules.BarServiceRate * 100)}% service charge on it: {Money(total)}.");
            }
            case MoneyItems.Wifi:
            {
                var left = b.WifiDevices;
                if (left.Total <= 0) return Make(MoneyVerdicts.NotIncluded, null, $"{name} has no Wi-Fi included. One device for one day is {Money(FolioRules.WifiDayCents)} when it is charged to the account.");
                if (left.Remaining <= 0) return Make(MoneyVerdicts.AllUsed, null, $"{name} has {left.Total} Wi-Fi device{(left.Total == 1 ? "" : "s")} included and all are in use. One more is {Money(FolioRules.WifiDayCents)} a day.");
                return Make(MoneyVerdicts.Included, 0, $"Yes, for {name}: {left.Total} device{(left.Total == 1 ? "" : "s")} included, {left.Remaining} not yet used.");
            }
            case MoneyItems.Specialty:
            {
                var meals = b.SpecialtyMeals;
                if (meals.Total <= 0) return Make(MoneyVerdicts.NotIncluded, null, $"{name} has no specialty dinners included. A specialty restaurant adds a cover charge, about {Money(PackageRules.AvgCover)} a person on average.");
                if (meals.Remaining <= 0) return Make(MoneyVerdicts.AllUsed, null, $"{name} had {meals.Total} specialty dinner{(meals.Total == 1 ? "" : "s")} included and all are booked or used. Another has a cover charge, about {Money(PackageRules.AvgCover)} on average.");
                return Make(MoneyVerdicts.Included, 0, $"Yes, for {name}: {meals.Remaining} of {meals.Total} specialty dinner{(meals.Total == 1 ? "" : "s")} left, with no cover charge.");
            }
            case MoneyItems.Excursion:
            {
                if (e.ExcursionCreditUsd <= 0) return Make(MoneyVerdicts.NotIncluded, null, $"{name} has no shore excursion credit with this booking.");
                return creditLeftCents > 0
                    ? Make(MoneyVerdicts.Partly, null, $"{name} has an excursion credit of {Dollars(e.ExcursionCreditUsd)}. The booking's credit is shared by everyone on it, and {Money(creditLeftCents)} of it is left. A tour costs its full price minus what is left.")
                    : Make(MoneyVerdicts.AllUsed, null, $"{name} has an excursion credit of {Dollars(e.ExcursionCreditUsd)}, but the booking's shared credit is used up. A tour is charged at its full price.");
            }
            case MoneyItems.Gratuity:
                return e.GratuitiesIncluded
                    ? Make(MoneyVerdicts.Included, 0, $"Yes, for {name}: the daily gratuity is included.")
                    : Make(MoneyVerdicts.NotIncluded, null, $"{name}'s daily gratuity is charged to the account each day.");
            case MoneyItems.Laundry:
                return e.Perks.Contains("freeLaundry")
                    ? Make(MoneyVerdicts.Included, 0, $"Yes, for {name}: laundry is part of the level or package.")
                    : Make(MoneyVerdicts.NotIncluded, null, $"{name} has no laundry benefit, so laundry is charged to the account when used.");
            case MoneyItems.Priority:
            {
                var embark = e.Perks.Contains("priorityEmbarkation");
                var disembark = e.Perks.Contains("priorityDisembarkation");
                if (embark && disembark) return Make(MoneyVerdicts.Included, 0, $"Yes, for {name}: priority embarkation and priority disembarkation.");
                if (embark || disembark) return Make(MoneyVerdicts.Partly, null, $"Partly, for {name}: priority {(embark ? "embarkation" : "disembarkation")} only.");
                return Make(MoneyVerdicts.NotIncluded, null, $"{name} has no priority embarkation or disembarkation.");
            }
            default:
                return Make(MoneyVerdicts.NotIncluded, null, "I do not know that item.");
        }
    }

    public static string EntitlementNote =>
        "These are the figures your booking shows in the app. Princess's own terms for your package, level and any offer are the last word; ask Guest Services if a charge does not match.";

    // ---- the spend scenario ----

    /// <summary>
    /// "If we book this, what will the family total be?" Adds the new lines to what is already committed. It counts extras only (packages, tours, dinner cover charges), never the fare or onboard spending,
    /// and says so; it books nothing, so it is always illustrative.
    /// </summary>
    public static ScenarioResult Scenario(MoneyCommitted now, IReadOnlyList<ScenarioLine> adds, long? budgetCents)
    {
        var added = adds.Sum(a => a.TotalCents);
        var total = now.Total + added;
        long? left = budgetCents is { } b ? b - total : null;
        var state = budgetCents is null ? "noBudget" : left < 0 ? "over" : total >= budgetCents * NearShare ? "near" : "within";
        var lines = new List<string>();
        foreach (var a in adds) lines.Add($"{a.Label}: {Money(a.TotalCents)}{(a.Units > 1 ? $" ({a.Units} × {Money(a.UnitCents)})" : "")}");
        lines.Add($"Already planned: {Money(now.Total)} (packages {Money(now.Packages)}, tours {Money(now.Tours)}, dinner cover charges {Money(now.Dining)}).");
        lines.Add($"With this: {Money(total)} for the family.");
        if (budgetCents is { } bud)
            lines.Add(left >= 0 ? $"That leaves {Money(left.Value)} of your {Money(bud)} budget." : $"That is {Money(-left!.Value)} over your {Money(bud)} budget.");
        else lines.Add("You have not set a budget, so I cannot say how it compares.");
        string[] notCounted = ["The fare and taxes", "Anything charged to the onboard account (drinks, shops, spa, photos)", "Price changes before you book: prices can rise as sailing gets closer"];
        return new(now, adds, added, total, budgetCents, left, state, lines, notCounted, true);
    }

    // ---- pace ----

    /// <summary>
    /// A gentle mid-week reading: what the onboard account has charged so far (pending included), carried on at the same pace to the end of the cruise, plus what was committed before sailing.
    /// It is a straight line, not a forecast, and says so. With under three days of spending, or no budget, it says nothing about pace.
    /// </summary>
    public static PaceResult Pace(PaceInput i)
    {
        var budgetSet = i.BudgetCents is > 0;
        var day = Math.Clamp(i.Day, 0, i.Nights);
        if (day < MinPaceDay)
            return new(budgetSet ? "tooEarly" : "noBudget", budgetSet ? i.BudgetCents : null, i.CommittedCents, i.OnboardCents, i.PendingCents, i.Day, i.Nights, null, null, null,
                [budgetSet ? "It is too early to say. I need at least three days of spending to read a pace." : "You have not set a trip budget, so there is no pace to compare.", $"So far: {Money(i.OnboardCents)} on the onboard account."], true);
        var projectedOnboard = (long)Math.Round((double)Math.Max(0, i.OnboardCents) * i.Nights / day, MidpointRounding.AwayFromZero);
        var projected = i.CommittedCents + projectedOnboard;
        var lines = new List<string>
        {
            $"Charged to your account so far: {Money(i.OnboardCents)} in {day} day{(day == 1 ? "" : "s")}{(i.PendingCents > 0 ? $", {Money(i.PendingCents)} of it still pending" : "")}.",
            $"Planned before sailing: {Money(i.CommittedCents)}.",
            $"At this pace you will be around {Money(projected)} by the end (illustrative: a straight line from the days so far, not a forecast).",
        };
        if (!budgetSet)
        {
            lines.Add("You have not set a trip budget, so I cannot say how that compares.");
            return new("noBudget", null, i.CommittedCents, i.OnboardCents, i.PendingCents, i.Day, i.Nights, projectedOnboard, projected, null, lines, true);
        }
        var budget = i.BudgetCents!.Value;
        var over = projected - budget;
        var state = over > 0 ? "over" : projected >= budget * NearShare ? "near" : "onTrack";
        lines.Add(state switch
        {
            "over" => $"That is about {Money(over)} over your {Money(budget)} budget.",
            "near" => $"That is close to your {Money(budget)} budget.",
            _ => $"That is inside your {Money(budget)} budget.",
        });
        return new(state, budget, i.CommittedCents, i.OnboardCents, i.PendingCents, i.Day, i.Nights, projectedOnboard, projected, over > 0 ? over : null, lines, true);
    }

    /// <summary>Whether the pace is worth a gentle word on its own: mid-week (day 3 up to the day before the last), and near or over.</summary>
    public static bool PaceAlertWorthy(PaceResult p) => p.State is "near" or "over" && p.Day >= MinPaceDay && p.Day < p.Nights;

    public static bool ValidBudget(long? cents) => cents is null || cents is > 0 and <= MaxBudgetCents;

    // ---- the folio explainer ----

    private static readonly (string State, string Heading, string Meaning)[] StateOrder =
    [
        (FolioStates.Posted, "Posted", "Final. These have been charged to your account."),
        (FolioStates.Pending, "Pending", "Not final yet. These have not posted and the amount can still change or drop away."),
        (FolioStates.Disputed, "Questioned", "You have asked about these, or the ship marked them as questioned. They stay on the account until a person answers."),
        (FolioStates.Adjusted, "Adjusted", "These were changed after they posted."),
        (FolioStates.Refunded, "Paid back", "These were refunded."),
    ];

    /// <summary>Why a line is on the account, in plain words, from the line alone.</summary>
    public static string Why(FolioLine l)
    {
        if (l.Cents < 0) return "A credit: it lowers what you owe.";
        if (l.CoveredBy is "package") return l.Cents == 0 ? $"Covered by your package: it would have been {Money(l.Value ?? 0)}." : $"Your package paid part of {Money(l.Value ?? 0)}; you paid {Money(l.Cents)}.";
        return l.Category switch
        {
            "tips" => $"The {Math.Round(FolioRules.BarServiceRate * 100)}% bar service charge on what you paid for a drink.",
            "gratuities" => "The daily gratuity for the crew.",
            "dining" => "A specialty restaurant cover charge.",
            _ => "A charge you or someone on your booking made.",
        };
    }

    /// <summary>
    /// Explains the onboard account with each state kept apart. A line the guest has questioned (a billing case carries its code) moves to the questioned group but keeps its own state beside it; nothing here marks a line settled.
    /// The estimate is the rest-of-cruise part of the pace, labelled illustrative and never added to what is posted or pending.
    /// </summary>
    public static FolioExplainDto ExplainFolio(
        IReadOnlyList<FolioLine> lines, IReadOnlyDictionary<Guid, string> names, IReadOnlyDictionary<string, string> questioned, int throughDay, int nights, long asOf, PaceResult? pace)
    {
        var rows = lines.OrderBy(l => l.At).ThenBy(l => l.Id, StringComparer.Ordinal).Select(l =>
        {
            var code = LineCode(l.Id);
            var caseRef = questioned.TryGetValue(code, out var r) ? r : null;
            return new FolioExplainLine(l.Id, code, l.Day, l.At, l.Description, names.TryGetValue(l.Guest, out var n) ? n : "A traveller", l.Category, l.Cents, caseRef is not null ? FolioStates.Disputed : l.State, Why(l), caseRef);
        }).ToList();
        var groups = new List<FolioExplainGroup>();
        foreach (var (state, heading, meaning) in StateOrder)
        {
            var these = rows.Where(r => r.State == state).ToList();
            if (these.Count == 0 && state is not (FolioStates.Posted or FolioStates.Pending)) continue;
            groups.Add(new(state, heading, meaning, these.Where(r => r.Cents > 0).Sum(r => r.Cents), these.Count, these));
        }
        var posted = rows.Where(r => r.State == FolioStates.Posted && r.Cents > 0).Sum(r => r.Cents);
        var pending = rows.Where(r => r.State == FolioStates.Pending && r.Cents > 0).Sum(r => r.Cents);
        var credits = -rows.Where(r => r.Cents < 0).Sum(r => r.Cents);
        var covered = lines.Where(l => l.CoveredBy is not null).Sum(l => (l.Value ?? 0) - l.Cents);
        var final = throughDay >= nights + 1;
        FolioEstimate? estimate = pace is { ProjectedOnboardCents: { } proj } && !final
            ? new(Math.Max(0, proj - pace.OnboardCents), $"Still to come, if spending carries on at the same pace: about {Money(Math.Max(0, proj - pace.OnboardCents))}. This is an estimate, kept apart from the posted and pending amounts.", true)
            : null;
        var text = new List<string>
        {
            $"Posted: {Money(posted)}. Pending: {Money(pending)}. Credits: {Money(credits)}.",
            $"Your package covered {Money(covered)} of what you would otherwise have paid.",
        };
        var nQuestioned = rows.Count(r => r.State == FolioStates.Disputed);
        if (nQuestioned > 0) text.Add($"{nQuestioned} line{(nQuestioned == 1 ? " is" : "s are")} questioned. A person has to answer; I cannot say they are settled.");
        if (final) text.Add("The cruise is over. Anything still pending posts or drops away on its own; Trip history lists the folio statement once it is ready. If a line looks wrong, question it and a person will look.");
        else text.Add("Pending lines are not final, so the total can still change.");
        return new(asOf, final, throughDay, posted, pending, credits, covered, groups, estimate, text);
    }

    /// <summary>The problem with a dispute request, or null. The note is the guest's words; the line itself is read from the account on the server.</summary>
    public static string? DisputeProblem(DisputeRequest? r)
    {
        if (r is null || string.IsNullOrWhiteSpace(r.LineId) || r.LineId.Length > 80) return "line";
        if (!r.Consent) return "consent";
        if ((r.Note?.Length ?? 0) > MaxNote) return "tooLong";
        return null;
    }

    /// <summary>The issue text a billing case carries: the line as the account holds it, then the guest's own words. Built on the server from the account, so the guest cannot change the figure.</summary>
    public static string DisputeIssue(FolioExplainLine line, string? note)
    {
        var text = $"I would like to question a charge on my onboard account: {line.Description}, {Money(line.Cents)}, day {line.Day}, for {line.Guest} (line {line.Short}, {line.State}).";
        return string.IsNullOrWhiteSpace(note) ? text : $"{text} {note.Trim()}";
    }

    // ---- package value ----

    public static string? PackageUseProblem(PackageUseRequest? r)
    {
        if (r is null) return "use";
        if (r.DrinksPerDay is < 0 or > 12) return "drinks";
        if (r.WifiDays is < 0 or > 30) return "wifiDays";
        if (r.SpecialtyDinners is < 0 or > 10) return "dinners";
        return null;
    }

    /// <summary>
    /// Compares each add-on with paying as you go for the use the family chose. Pay-as-you-go prices are the average drink with the service charge, the one-device day rate and the average specialty cover charge,
    /// so it is an illustration of the family's chosen use, not a prediction. A person already covered for the item is left out, because buying it again would buy nothing.
    /// </summary>
    public static IReadOnlyList<PackageValueRow> PackageValue(IReadOnlyList<(string Name, int Age, Entitlements E)> people, int daysToDeparture, int nights, int drinksPerDay, int wifiDays, int specialtyDinners)
    {
        var rows = new List<PackageValueRow>();
        PackageValueRow Row(AddOnInfo a, int count, long payAsYouGoEach, string basis, string use)
        {
            var unit = PackageRules.AddOnPrice(a, daysToDeparture);
            var units = PackageRules.Units(a.Unit, count, nights);
            var pkg = unit * units;
            var go = payAsYouGoEach * count;
            var diff = go - pkg;
            var verdict = count == 0 ? "nobody" : diff > 0 ? "worth" : diff < 0 ? "notWorth" : "even";
            var lines = new List<string>
            {
                $"{PackageRules.NameOf(a.Id)}: {Money(pkg)} for {count} {(count == 1 ? "person" : "people")}.",
                $"Paying as you go for {use}: {Money(go)}.",
                diff > 0 ? $"On that use the package saves {Money(diff)}." : diff < 0 ? $"On that use the package costs {Money(-diff)} more than paying as you go." : "On that use they cost the same.",
            };
            return new(a.Id, PackageRules.NameOf(a.Id) ?? a.Id, count, pkg, go, diff, verdict, basis, lines);
        }

        var drinkers = people.Where(p => p.Age >= 21 && p.E.DrinkCapUsd <= 0).ToList();
        if (drinkers.Count > 0 && drinksPerDay > 0)
        {
            var each = (long)Math.Round(PackageRules.AvgDrink * (1 + PackageRules.ServiceCharge) * drinksPerDay * nights, MidpointRounding.AwayFromZero);
            rows.Add(Row(PackageRules.AddOn("drinks")!, drinkers.Count, each, $"An average drink is {Money(PackageRules.AvgDrink)} plus the {Math.Round(PackageRules.ServiceCharge * 100)}% service charge.", $"{drinksPerDay} drink{(drinksPerDay == 1 ? "" : "s")} a day for {nights} nights"));
        }
        var wifiNeeders = people.Where(p => p.E.WifiDevices <= 0).ToList();
        if (wifiNeeders.Count > 0 && wifiDays > 0)
            rows.Add(Row(PackageRules.AddOn("wifi")!, wifiNeeders.Count, FolioRules.WifiDayCents * Math.Min(wifiDays, nights), $"One device is {Money(FolioRules.WifiDayCents)} a day without a package.", $"one device on {Math.Min(wifiDays, nights)} day{(Math.Min(wifiDays, nights) == 1 ? "" : "s")}"));
        var diners = people.Where(p => p.E.SpecialtyMeals <= 0).ToList();
        if (diners.Count > 0 && specialtyDinners > 0)
            rows.Add(Row(PackageRules.AddOn("specialtyPass")!, diners.Count, PackageRules.AvgCover * Math.Min(specialtyDinners, 3), $"An average cover charge is {Money(PackageRules.AvgCover)}; the pass covers three dinners.", $"{Math.Min(specialtyDinners, 3)} specialty dinner{(Math.Min(specialtyDinners, 3) == 1 ? "" : "s")} (the pass covers three)"));
        return rows;
    }

    public static IReadOnlyList<string> PackageValueLines(IReadOnlyList<PackageValueRow> rows)
    {
        if (rows.Count == 0) return ["Everyone on the booking is already covered for what you chose, or you chose no use. Nothing to compare."];
        var lines = new List<string>();
        foreach (var r in rows) lines.Add($"{r.Name}: {(r.Verdict == "worth" ? $"saves {Money(r.DifferenceCents)}" : r.Verdict == "notWorth" ? $"costs {Money(-r.DifferenceCents)} more" : "costs about the same")} on the use you chose ({r.People} {(r.People == 1 ? "person" : "people")}).");
        lines.Add("This is an illustration of the use you chose. It is not a prediction and not a recommendation to buy.");
        return lines;
    }

    // ---- Captain's Circle ----

    private static string TierName(string tier) => tier switch { "gold" => "Gold", "ruby" => "Ruby", "platinum" => "Platinum", "elite" => "Elite", _ => "no level yet" };

    /// <summary>
    /// What the loyalty record says now, and what its own rules would give if this cruise is counted. Never a promise: Princess counts the days and confirms the level. Credits show their expiry and whether it is close.
    /// </summary>
    public static LoyaltyCoachDto Loyalty(LoyaltyInput i, DateOnly today, long asOf)
    {
        var credits = i.Credits.Select(c =>
        {
            var left = c.ExpiresOn.DayNumber - today.DayNumber;
            return new LoyaltyCredit(c.Source, c.Remaining, c.ExpiresOn.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), left, left < 0, left >= 0 && left <= ExpiresSoonDays);
        }).OrderBy(c => c.ExpiresOn, StringComparer.Ordinal).ToList();
        var usable = credits.Where(c => !c.Expired).Sum(c => c.RemainingCents);
        var lines = new List<string>
        {
            i.Counted
                ? $"Your record shows {i.DaysAfter} Captain's Circle days, which is {TierName(i.After)}."
                : $"Your record shows {i.DaysBefore} Captain's Circle days, which is {TierName(i.Before)}.",
        };
        if (!i.Counted && i.Nights > 0)
        {
            var h = PostCruiseRules.Loyalty(i.Before, i.DaysBefore, i.Nights, true);
            lines.Add($"This cruise is {i.Nights} nights. If Princess counts all of them, your days would be {h.DaysAfter}{(h.Promoted ? $", which would reach {TierName(h.After)}" : "")}. I cannot promise that: Princess counts the days and confirms your level.");
        }
        if (i.Next is { } next && i.DaysToNext is { } to) lines.Add(to > 0 ? $"{to} more day{(to == 1 ? "" : "s")} on the record reaches {TierName(next)}." : $"The record has reached {TierName(next)}.");
        else if (i.After == "elite" || i.Before == "elite") lines.Add("You are at the highest level.");
        if (credits.Count == 0) lines.Add("You have no future cruise credits on the record.");
        foreach (var c in credits)
            lines.Add(c.Expired ? $"{c.Source}: {Money(c.RemainingCents)} expired on {c.ExpiresOn}."
                : c.ExpiresSoon ? $"{c.Source}: {Money(c.RemainingCents)} expires on {c.ExpiresOn}, in {c.DaysLeft} day{(c.DaysLeft == 1 ? "" : "s")}."
                : $"{c.Source}: {Money(c.RemainingCents)}, expires on {c.ExpiresOn}.");
        lines.Add("If a day count, level or credit looks wrong, report it on the Captain's Circle screen and a person will look. Nothing on the record changes from here.");
        return new(asOf, i.Counted ? i.After : i.Before, i.Counted ? i.DaysAfter : i.DaysBefore, i.Next, i.DaysToNext, i.Counted, credits, usable, i.Perks, lines);
    }

    // ---- what the chat takes ----

    public const string KindEntitlement = "entitlement", KindBill = "bill", KindPace = "pace", KindLoyalty = "loyalty", KindPackages = "packages", KindSpend = "spend";

    private static readonly Regex IncludedQ = new(@"\b(included|include|covered|cover|free|comp|comped|part of (my|our|the) (package|plan|fare))\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex EntItem = new(@"\b(drinks?|cocktails?|wine|beers?|coffee|wi-?fi|internet|specialty|speciality|dinner|restaurant|laundry|gratuit\w*|tips?|excursion credit|shore credit|priority|express|embark\w*|disembark\w*)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex BillQ = new(@"\b(my|our) (bill|balance|account|folio|charges)\b|\bwhat (do|did) (i|we) owe\b|\bhow much (do|did|have) (i|we) (owe|spent|spend)\b|\bwhat('s| is) (pending|posted)\b|\bexplain (my|our|the) (bill|folio|charges)\b|\b(final|last) (bill|folio)\b|\bdispute\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex PaceQ = new(@"\b(spending|spend) pace\b|\bat this pace\b|\bon track\b.*\b(budget|spend|spending)\b|\b(budget|spending)\b.*\bon track\b|\bam i (over|under|within) (my |our )?budget\b|\bhow (am|are) (i|we) doing\b.*\b(spend|spending|money|budget)\b|\b(my|our) (trip )?budget\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex Personal = new(@"\b(my|our|me|us|i|we|mine|ours)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex ForSomeone = new(@"\bfor [A-Z][a-z]+\b|\bfor (him|her|them|the kids|my (wife|husband|partner|son|daughter|mum|mom|dad))\b", RegexOptions.CultureInvariant);
    private static readonly Regex LoyaltyQ = new(@"\bcaptain'?s? circle\b|\bloyalty\b|\bmy (tier|level|status)\b|\bfuture cruise credit\w*\b|\bfcc\b|\b(credit|credits) (expire|expiry|expires)\b|\bmy credits?\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex PackagesQ = new(@"\b(worth it|worth buying|is the .*package worth|should (i|we) (buy|get|book) the .*(package|pass)|package (value|compare|comparison)|compare (the )?packages?)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex SpendQ = new(@"\bif (i|we) (book|buy|add|get)\b.*\b(total|cost|how much)\b|\bwhat will (the|our|my) (family )?total be\b|\bhow much (will|would) (it|that|this) (cost|come to|bring)\b|\bfamily total\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    /// <summary>Which money question this is, or null. Order matters: the most specific first. A question about a visa, a deadline or anything else falls through to the other routes.</summary>
    public static string? Classify(string message)
    {
        if (string.IsNullOrWhiteSpace(message) || message.Length > 500) return null;
        if (SpendQ.IsMatch(message)) return KindSpend;
        if (PackagesQ.IsMatch(message)) return KindPackages;
        if (LoyaltyQ.IsMatch(message)) return KindLoyalty;
        if (BillQ.IsMatch(message)) return KindBill;
        if (IncludedQ.IsMatch(message) && EntItem.IsMatch(message) && (Personal.IsMatch(message) || ForSomeone.IsMatch(message)) && !Regex.IsMatch(message, @"\b(visa|passport|insurance|fare|fee)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)) return KindEntitlement;
        if (PaceQ.IsMatch(message)) return KindPace;
        return null;
    }

    /// <summary>The item a question names. The first match wins and a question that names none of them gets none.</summary>
    public static string? ItemOf(string message)
    {
        var m = message.ToLowerInvariant();
        bool Has(string pattern) => Regex.IsMatch(m, pattern, RegexOptions.CultureInvariant);
        if (Has(@"\b(drinks?|cocktails?|wine|beers?|coffee)\b")) return MoneyItems.Drink;
        if (Has(@"\b(wi-?fi|internet)\b")) return MoneyItems.Wifi;
        if (Has(@"\b(specialty|speciality|dinner|restaurant)\b")) return MoneyItems.Specialty;
        if (Has(@"\b(excursion|shore) credit\b")) return MoneyItems.Excursion;
        if (Has(@"\b(gratuit\w*|tips?)\b")) return MoneyItems.Gratuity;
        if (Has(@"\blaundry\b")) return MoneyItems.Laundry;
        if (Has(@"\b(priority|express|embark\w*|disembark\w*)\b")) return MoneyItems.Priority;
        return null;
    }

    /// <summary>A dollar amount the guest typed ("is a $19 cocktail included"), in cents; null when there is none or it is not sensible. Read by the rules, not by a model.</summary>
    public static long? PriceOf(string message)
    {
        var m = Regex.Match(message, @"\$\s?(\d{1,4})(?:\.(\d{2}))?\b", RegexOptions.CultureInvariant);
        if (!m.Success) return null;
        var cents = long.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture) * 100 + (m.Groups[2].Success ? long.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture) : 0);
        return cents is > 0 and <= 500_000 ? cents : null;
    }

    public static bool MeansAlcohol(string message) => Regex.IsMatch(message, @"\b(cocktails?|wine|beers?|spirits?|whisk(e)?y|vodka|rum|gin|margaritas?|alcohol\w*)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    public static bool MeansEveryone(string message) => Regex.IsMatch(message, @"\b(we|us|our|everyone|everybody|family|all of us|the party|the group|kids|children)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    /// <summary>The first name from <paramref name="names"/> the message mentions, or null. Whole word, case-insensitive.</summary>
    public static string? NameIn(string message, IEnumerable<string> names) =>
        names.FirstOrDefault(n => n.Length > 0 && Regex.IsMatch(message, $@"\b{Regex.Escape(n)}\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant));

    // ---- chat cards ----

    private static StanleyProvenance Prov(DateTime? at, bool estimated, bool check, string owner, string note) =>
        new(estimated ? [StanleyChips.Booking, StanleyChips.Estimated] : [StanleyChips.Booking], owner, at, estimated ? "estimated" : "live", check, note);

    public static StanleyCardDto EntitlementCard(IReadOnlyList<EntitlementAnswer> answers, DateTime at) =>
        new("money", "Is it included?", [.. answers.SelectMany(a => a.Lines), EntitlementNote], Prov(at, false, true, "Your Princess booking", "Worked out from your booking, your level and what is left. Princess's own terms are the last word."), false, [new CitationDto("Packages", "/me/packages")]);

    public static StanleyCardDto ScenarioCard(ScenarioResult r, DateTime at) =>
        new("money", "If you book this", [.. r.Lines, "Not counted: " + string.Join("; ", r.NotCounted) + ".", "This is an illustration. Nothing is booked."],
            Prov(at, true, false, "Your Princess booking and the current price list", "Illustrative: a sum of the prices now. Prices can change before you book."), false, [new CitationDto("Packages", "/me/packages")]);

    public static StanleyCardDto PaceCard(PaceResult p, DateTime at) =>
        new("money", "Your spending pace", [.. p.Lines, "A straight-line illustration, not a forecast."],
            Prov(at, true, false, "Your onboard account", "Illustrative: it carries on the pace so far."), false, [new CitationDto("Bill", "/me/bill")]);

    public static StanleyCardDto BillCard(FolioExplainDto f, DateTime at) =>
        new("money", "Your bill", [.. f.Lines, .. f.Groups.Where(g => g.Count > 0).Select(g => $"{g.Heading}: {g.Count} line{(g.Count == 1 ? "" : "s")}, {Money(g.Cents)}. {g.Meaning}"), .. (f.Estimate is { } e ? new List<string> { e.Text } : new List<string>())],
            Prov(at, f.Estimate is not null, true, "Your onboard account", "Posted, pending, questioned and estimated amounts are kept apart. Only posted is final."), false, [new CitationDto("Bill", "/me/bill")]);

    public static StanleyCardDto LoyaltyCard(LoyaltyCoachDto l, DateTime at) =>
        new("money", "Captain's Circle", [.. l.Lines],
            Prov(at, false, true, "Princess Captain's Circle record", "What the loyalty record shows now. Princess confirms levels and credits."), false, [new CitationDto("Captain's Circle", "/me/loyalty")]);

    public static StanleyCardDto PackagesCard(IReadOnlyList<PackageValueRow> rows, IReadOnlyList<string> lines, DateTime at) =>
        new("money", "Package value", [.. lines],
            Prov(at, true, false, "Princess price list", "Illustrative: it compares prices for the use you chose. It is not a prediction."), false, [new CitationDto("Packages", "/me/packages")]);

    /// <summary>When the account could not be read, the card says so and shows the screen; it never offers a figure from memory.</summary>
    public static StanleyCardDto UnreadCard(DateTime at) =>
        new("money", "Money", ["I cannot read your account just now, so I cannot give you a figure. The Bill and Packages screens show what is on record, or ask a person."],
            Prov(at, false, true, "Your Princess booking", "The account could not be read."), true, [new CitationDto("Bill", "/me/bill"), new CitationDto("Packages", "/me/packages")]);
}
