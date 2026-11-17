using System.Globalization;

namespace Princess.Api.Domain;

/// <summary>One thing for the Value and bill card: its rule (CHK-04 bill watch, VAL-01 included value, CHK-05 forgot something), a stable id, words and a screen to open.</summary>
public sealed record ValueFinding(string Id, string Rule, string Consequence, string Title, string Detail, CheckFix Fix);

/// <summary>A traveller by position only ("Traveller 2"), with what their booking includes and what is left of it.</summary>
public sealed record ValuePerson(int Position, Guid Id, Entitlements Entitlements, Balances Balances);

public sealed record ValueFacts(
    DateOnly Today, DateOnly Departure, int Nights, int ThroughDay, bool Afloat, IReadOnlyList<FolioLine> Lines, IReadOnlyList<ValuePerson> People, long CreditLeftCents, bool Tender);

/// <summary>What the guest is shown. <see cref="NotChecked"/> says what could not be seen, so a short list is never read as "all clear".</summary>
public sealed record ValueDto(bool HasTrip, IReadOnlyList<ValueFinding> Findings, IReadOnlyList<string> NotChecked, bool Clean, string? AsOf);

/// <summary>
/// Bill watch (CHK-04), the included-value finder (VAL-01) and "Forgot something?" (CHK-05), docs/stanley-actions-and-proactive-plan.md section 4. Pure and deterministic. It is read-only: it never buys, charges,
/// disputes or refunds, and a fix is only a screen to open. VAL-01 speaks only of what the guest already has (D8); it never suggests buying anything.
/// </summary>
public static class StanleyValueRules
{
    public const int CreditDaysBeforeEnd = 2, PackingDays = 14;
    private const string Bill = "/me/bill", Packages = "/me/packages", Excursions = "/plan/excursions", Dining = "/plan/dining", Packing = "/plan/packing";

    private static string Who(ValueFacts f, ValuePerson p) => f.People.Count == 1 ? "You have" : $"Traveller {p.Position} has";
    private static string Money(long cents) => StanleyMoneyRules.Money(cents);

    public static IReadOnlyList<string> NotChecked(ValueFacts f)
    {
        var list = new List<string> { "Whether a charge is the right price", "Charges that have not reached your account yet" };
        if (!f.Afloat) list.Insert(0, "Your onboard bill (nothing is charged until you sail)");
        return list;
    }

    public static IReadOnlyList<ValueFinding> Findings(ValueFacts f)
    {
        var list = new List<ValueFinding>();
        list.AddRange(f.Afloat ? BillWatch(f) : []);
        list.AddRange(f.Afloat ? IncludedValue(f) : []);
        list.AddRange(Forgot(f));
        return [.. list.OrderBy(x => ChangeConsequence.Rank(x.Consequence)).ThenBy(x => x.Id, StringComparer.Ordinal)];
    }

    // ---- CHK-04 ----

    private static IEnumerable<ValueFinding> BillWatch(ValueFacts f)
    {
        var fix = new CheckFix("Open my bill", Bill);
        var charged = f.Lines.Where(l => l.Cents > 0 && l.State is FolioStates.Posted or FolioStates.Pending).ToList();

        // The same guest, day, description and amount twice (a real second drink is possible, so this asks and does not accuse).
        foreach (var g in charged.GroupBy(l => (l.Guest, l.Day, l.Description, l.Cents)).Where(g => g.Count() > 1).OrderBy(g => g.Key.Day).ThenBy(g => g.Key.Description, StringComparer.Ordinal))
            yield return new ValueFinding($"dup:{g.Key.Day}:{g.Key.Description}:{g.Key.Cents}:{g.Key.Guest}", "CHK-04", ChangeConsequence.Conflict,
                $"{g.Key.Description} appears {g.Count()} times on day {g.Key.Day}", $"Each is {Money(g.Key.Cents)}. If you bought it more than once that is right; if not, ask about it from your bill.", fix);

        // A drink charged in full to someone whose drinks package should cover a drink of that price.
        foreach (var l in charged.Where(l => l.Category == "drinks" && l.CoveredBy is null).OrderBy(l => l.At).ThenBy(l => l.Id, StringComparer.Ordinal))
            if (f.People.FirstOrDefault(p => p.Id == l.Guest) is { } p && p.Entitlements.DrinkCapUsd > 0 && l.Cents <= p.Entitlements.DrinkCapUsd * 100L)
                yield return new ValueFinding($"covered:{l.Id}", "CHK-04", ChangeConsequence.Conflict,
                    $"{l.Description} was charged though your package covers drinks", $"It is {Money(l.Cents)} and the package covers a drink up to ${p.Entitlements.DrinkCapUsd}. A bar service charge on a covered drink is normal; the drink itself should not be.", fix);

        if (f.ThroughDay >= f.Nights - CreditDaysBeforeEnd + 1 && f.CreditLeftCents > 0)
            yield return new ValueFinding("credit:unused", "CHK-04", ChangeConsequence.Conflict, $"{Money(f.CreditLeftCents)} of excursion credit is still unused",
                "Credit does not come off your bill at the end unless the terms of your booking say so. Check before you disembark.", new CheckFix("Open tours", Excursions));
    }

    // ---- VAL-01: only what the guest already has ----

    private static IEnumerable<ValueFinding> IncludedValue(ValueFacts f)
    {
        var daysLeft = f.Nights - f.ThroughDay;
        if (daysLeft <= 0) yield break;
        foreach (var p in f.People)
        {
            var meals = p.Balances.SpecialtyMeals;
            if (meals.Total > 0 && meals.Remaining > 0)
                yield return new ValueFinding($"value:meals:{p.Position}", "VAL-01", ChangeConsequence.Optional,
                    $"{Who(f, p)} {meals.Remaining} included specialty {(meals.Remaining == 1 ? "dinner" : "dinners")} left", $"{daysLeft} {(daysLeft == 1 ? "day" : "days")} remain. These are already part of your booking.", new CheckFix("Open dining", Dining));
            var wifi = p.Balances.WifiDevices;
            if (wifi.Total > 0 && wifi.Used == 0)
                yield return new ValueFinding($"value:wifi:{p.Position}", "VAL-01", ChangeConsequence.Optional,
                    $"{Who(f, p)} included Wi-Fi that has not been used", "It is part of the package and costs nothing extra.", new CheckFix("Open my packages", Packages));
        }
    }

    // ---- CHK-05: a short list tuned to the trip, shown in the fortnight before sailing ----

    private static IEnumerable<ValueFinding> Forgot(ValueFacts f)
    {
        var days = f.Departure.DayNumber - f.Today.DayNumber;
        if (f.Afloat || days is < 0 or > PackingDays) yield break;
        var fix = new CheckFix("Open the packing list", Packing);
        var elegant = PlanRules.ElegantNights(f.Nights);
        if (elegant > 0)
            yield return new ValueFinding("pack:elegant", "CHK-05", ChangeConsequence.Improvement, $"{(elegant == 1 ? "One evening" : $"{elegant} evenings")} on this cruise are elegant", "Pack a jacket or a dress for each.", fix);
        if (f.Tender)
            yield return new ValueFinding("pack:tender", "CHK-05", ChangeConsequence.Optional, "One port is reached by a small boat", "Pack comfortable shoes you can step into a boat with.", fix);
        var weather = PlanRules.WeatherFor(f.Departure);
        if (weather.Rain == "high")
            yield return new ValueFinding("pack:rain", "CHK-05", ChangeConsequence.Optional, "It is a wet time of year", $"{weather.Note} A light rain jacket is worth the space.", fix);
        yield return new ValueFinding("pack:sun", "CHK-05", ChangeConsequence.Optional, "Sun cream is dearer on board", $"Highs around {weather.HighF}°F. Pack enough for the week.", fix);
    }

    public static ValueDto Build(ValueFacts f, string asOf)
    {
        var findings = Findings(f);
        return new ValueDto(true, findings, NotChecked(f), findings.Count == 0, asOf);
    }
}
