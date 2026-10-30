namespace Princess.Api.Domain;

/// <summary>What a guest gets from fare, package, Captain's Circle tier and suite class. Ported from <c>src/domain/entitlements.ts</c>; figures are authored, not Princess's terms.</summary>
public sealed record Entitlements(
    int DrinkCapUsd, int WifiDevices, int SpecialtyMeals, int ExcursionCreditUsd, bool GratuitiesIncluded, string DiningWindow, string[] Perks);

public sealed record Balance(int Total, int Used, int Remaining);

public sealed record Balances(Balance SpecialtyMeals, Balance WifiDevices, Balance ExcursionCreditUsd);

public static class EntitlementRules
{
    private sealed record Pkg(int DrinkCap, int Wifi, int Meals, bool Gratuities, int ExcursionCredit);

    private static readonly Dictionary<string, Pkg> Packages = new()
    {
        ["none"] = new(0, 0, 0, false, 0),
        ["plus"] = new(15, 1, 2, true, 0),
        ["premier"] = new(20, 4, 3, true, 100),
    };

    private sealed record Tier(int Wifi, string[] Perks, string Window);

    private static readonly Dictionary<string, Tier> Tiers = new()
    {
        ["none"] = new(0, [], "afterFullPayment"),
        ["gold"] = new(0, ["memberEvents"], "afterFullPayment"),
        ["ruby"] = new(0, ["memberEvents", "welcomeGift"], "afterFullPayment"),
        ["platinum"] = new(1, ["memberEvents", "welcomeGift", "priorityEmbarkation", "priorityDisembarkation", "freeLaundry"], "atBooking"),
        ["elite"] = new(2, ["memberEvents", "welcomeGift", "priorityEmbarkation", "priorityDisembarkation", "freeLaundry"], "atBooking"),
    };

    private static readonly string[] SanctuaryPerks = ["suiteLounge", "priorityEmbarkation", "priorityDisembarkation"];

    /// <summary>Numbers add up across sources (a package's Wi-Fi plus the tier's); the best dining window and cap win.</summary>
    public static Entitlements Compute(string tier, string package, bool sanctuary)
    {
        var pkg = Packages.GetValueOrDefault(package) ?? Packages["none"];
        var t = Tiers.GetValueOrDefault(tier) ?? Tiers["none"];
        var perks = t.Perks.Concat(sanctuary ? SanctuaryPerks : []).Distinct().ToArray();
        return new Entitlements(pkg.DrinkCap, pkg.Wifi + t.Wifi, pkg.Meals + (sanctuary ? 1 : 0), pkg.ExcursionCredit, pkg.Gratuities, t.Window, perks);
    }

    /// <summary>Used and remaining for the countable entitlements. Overuse shows as zero remaining.</summary>
    public static Balances BalancesOf(Entitlements e, int specialtyMealsUsed = 0, int wifiDevicesUsed = 0, int excursionCreditUsedUsd = 0)
    {
        static Balance One(int total, int used) => new(total, Math.Min(used, total), Math.Max(0, total - used));
        return new Balances(One(e.SpecialtyMeals, specialtyMealsUsed), One(e.WifiDevices, wifiDevicesUsed), One(e.ExcursionCreditUsd, excursionCreditUsedUsd));
    }

    public static bool HasPriority(Entitlements e) => e.Perks.Contains("priorityEmbarkation");
}
