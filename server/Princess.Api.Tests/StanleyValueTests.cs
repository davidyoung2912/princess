using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Value and bill (phase P6): bill watch, included value and the packing nudge. Each finds its case once with a screen to open, a clean bill raises nothing, and value only names what the guest has.</summary>
public class StanleyValueTests
{
    private static readonly DateOnly Departure = new(2027, 3, 20);
    private static readonly Guid Me = Guid.NewGuid();

    private static Entitlements Ent(int drinkCap = 0, int meals = 0, int wifi = 0) => new(drinkCap, wifi, meals, 0, false, "any", []);
    private static Balances Bal(int meals = 0, int mealsUsed = 0, int wifi = 0, int wifiUsed = 0) =>
        new(new(meals, mealsUsed, meals - mealsUsed), new(wifi, wifiUsed, wifi - wifiUsed), new(0, 0, 0));

    private static FolioLine Line(string id, int day, string category, string text, long cents, string? covered = null, string state = FolioStates.Posted) =>
        new(id, day, day * 1000L, category, text, Me, cents, null, covered, state);

    private static ValueFacts Facts(int through = 3, IReadOnlyList<FolioLine>? lines = null, ValuePerson? person = null, long credit = 0, bool afloat = true, DateOnly? today = null) =>
        new(today ?? (afloat ? Departure.AddDays(through) : Departure.AddDays(-30)), Departure, 7, afloat ? through : 0, afloat, lines ?? [], [person ?? new(1, Me, Ent(), Bal())], credit, false);

    [Fact]
    public void ACleanBillRaisesNothing() =>
        Assert.Empty(StanleyValueRules.Findings(Facts(lines: [Line("a", 1, "shops", "Souvenir", 3200), Line("b", 2, "drinks", "Cocktail", 1400)])));

    [Fact]
    public void ARepeatedChargeIsFoundOnceAndAsksRatherThanAccuses()
    {
        var x = Assert.Single(StanleyValueRules.Findings(Facts(lines: [Line("a", 1, "photos", "Portrait print", 2495), Line("b", 1, "photos", "Portrait print", 2495)])));
        Assert.Equal("CHK-04", x.Rule);
        Assert.Equal("/me/bill", x.Fix.Route);
        Assert.Contains("If you bought it more than once", x.Detail);
    }

    [Fact]
    public void ARefundedLineIsNotCountedAsADuplicate() =>
        Assert.Empty(StanleyValueRules.Findings(Facts(lines: [Line("a", 1, "photos", "Print", 2495), Line("b", 1, "photos", "Print", 2495, state: FolioStates.Refunded)])));

    [Fact]
    public void ADrinkChargedInFullToSomeoneWithADrinksPackageIsFound()
    {
        var f = Facts(lines: [Line("a", 1, "drinks", "Cocktail", 1400)], person: new(1, Me, Ent(drinkCap: 15), Bal()));
        Assert.Contains(StanleyValueRules.Findings(f), x => x.Id == "covered:a");
        var over = Facts(lines: [Line("a", 1, "drinks", "Premium", 1900)], person: new(1, Me, Ent(drinkCap: 15), Bal()));
        Assert.DoesNotContain(StanleyValueRules.Findings(over), x => x.Id.StartsWith("covered"));
        var covered = Facts(lines: [Line("a", 1, "drinks", "Cocktail", 0, "package")], person: new(1, Me, Ent(drinkCap: 15), Bal()));
        Assert.Empty(StanleyValueRules.Findings(covered));
    }

    [Fact]
    public void UnusedCreditIsOnlyRaisedNearTheEnd()
    {
        Assert.Empty(StanleyValueRules.Findings(Facts(through: 3, credit: 5000)));
        Assert.Contains(StanleyValueRules.Findings(Facts(through: 6, credit: 5000)), x => x.Id == "credit:unused");
    }

    [Fact]
    public void IncludedValueNamesOnlyWhatTheGuestHasAndNeverOffersToSell()
    {
        var f = Facts(through: 3, person: new(1, Me, Ent(meals: 2, wifi: 1), Bal(meals: 2, mealsUsed: 1, wifi: 1)));
        var found = StanleyValueRules.Findings(f).Where(x => x.Rule == "VAL-01").ToList();
        Assert.Equal(2, found.Count);
        Assert.All(found, x => Assert.DoesNotContain("buy", x.Detail, StringComparison.OrdinalIgnoreCase));
        Assert.Empty(StanleyValueRules.Findings(Facts(through: 3)));                                  // a guest with nothing included hears nothing
        Assert.Empty(StanleyValueRules.Findings(Facts(through: 7, person: new(1, Me, Ent(meals: 2), Bal(meals: 2)))));  // nothing left to use on the last day
    }

    [Fact]
    public void PackingHelpAppearsOnlyInTheTwoWeeksBeforeSailing()
    {
        Assert.Empty(StanleyValueRules.Findings(Facts(afloat: false)));                                        // 30 days out
        var near = StanleyValueRules.Findings(Facts(afloat: false, today: Departure.AddDays(-5)));
        Assert.Contains(near, x => x.Rule == "CHK-05" && x.Id == "pack:elegant");
        Assert.All(near, x => Assert.Equal("/plan/packing", x.Fix.Route));
    }

    [Fact]
    public void NothingOnTheBillIsClaimedBeforeSailing()
    {
        var f = Facts(afloat: false, today: Departure.AddDays(-5));
        Assert.Contains(StanleyValueRules.NotChecked(f), x => x.Contains("onboard bill"));
        Assert.DoesNotContain(StanleyValueRules.Findings(f), x => x.Rule != "CHK-05");
    }

    [Fact]
    public void FindingsAreRankedByConsequenceThenId()
    {
        var f = Facts(through: 6, credit: 5000, lines: [Line("a", 1, "photos", "P", 100), Line("b", 1, "photos", "P", 100)], person: new(1, Me, Ent(meals: 1), Bal(meals: 1)));
        var ranks = StanleyValueRules.Findings(f).Select(x => ChangeConsequence.Rank(x.Consequence)).ToList();
        Assert.Equal(ranks.OrderBy(r => r), ranks);
    }
}
