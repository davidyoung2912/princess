namespace Princess.Api.Domain;

public sealed record AddOnInfo(string Id, string Unit, long Base, int ChangeAtDays, double ChangeShare, int MinAge);

public sealed record PackageUpgrade(string From, string To, long Base, int ChangeAtDays, double ChangeShare);

public sealed record PriceStateResult(string State, long PerUnit);

/// <summary>Packages, add-ons and price-change protection, ported from <c>src/domain/packages.ts</c>. Prices are authored concept values.</summary>
public static class PackageRules
{
    public static readonly IReadOnlyList<AddOnInfo> AddOns =
    [
        new("drinks", "personNight", 5_200, 15, 0.13, 21),
        new("wifi", "personNight", 2_500, 20, 0.2, 0),
        new("specialtyPass", "person", 12_900, 15, 0.1, 0),
        new("photo", "person", 14_900, 10, -0.2, 0),
        new("laundry", "room", 9_900, 0, 0, 0),
    ];

    /// <summary>The price rise on an upgrade: 10% from 15 days out.</summary>
    public const int UpgradeRiseDays = 15;
    public const double UpgradeRiseShare = 0.1;

    /// <summary>Purchases can be cancelled for a full refund until this many days before sailing.</summary>
    public const int CancelUntilDays = 3;

    public static AddOnInfo? AddOn(string? id) => AddOns.FirstOrDefault(a => a.Id == id);

    private static long WholeDollars(double cents) => Pricing.JsRound(cents / 100) * 100;

    /// <summary>The price of one unit on a day: the base price until the change date, then the changed price.</summary>
    public static long UnitPrice(long baseCents, int atDays, double share, int daysToDeparture) =>
        daysToDeparture >= atDays || share == 0 ? baseCents : WholeDollars(baseCents * (1 + share));

    public static long AddOnPrice(AddOnInfo a, int daysToDeparture) => UnitPrice(a.Base, a.ChangeAtDays, a.ChangeShare, daysToDeparture);

    public static int Units(string unit, int guests) => unit == "room" ? 1 : unit == "person" ? guests : guests * Pricing.Nights;

    /// <summary>What moving up to Plus or Premier costs per guest: the package price less the gratuities the fare already includes.</summary>
    public static long UpgradeBase(string from, string to)
    {
        var have = from == "none" ? Pricing.GratuityPerNight : Pricing.Fare(from)!.PerNight;
        return Math.Max(0, (Pricing.Fare(to)!.PerNight - have) * Pricing.Nights);
    }

    public static List<PackageUpgrade> UpgradesFrom(string from)
    {
        string[] targets = from == "none" ? ["plus", "premier"] : from == "plus" ? ["premier"] : [];
        return targets.Select(to => new PackageUpgrade(from, to, UpgradeBase(from, to), UpgradeRiseDays, UpgradeRiseShare)).ToList();
    }

    public static long UpgradePrice(PackageUpgrade u, int daysToDeparture) => UnitPrice(u.Base, u.ChangeAtDays, u.ChangeShare, daysToDeparture);

    public static string BestPackage(string a, string b)
    {
        string[] order = ["none", "plus", "premier"];
        return order[Math.Max(Array.IndexOf(order, a), Array.IndexOf(order, b))];
    }

    /// <summary>Price-change protection: bought before a rise keeps its price ("locked"); bought before a drop is owed the difference ("dropped").</summary>
    public static PriceStateResult PriceState(long paidUnit, long nowUnit) =>
        paidUnit < nowUnit ? new("locked", nowUnit - paidUnit) : paidUnit > nowUnit ? new("dropped", paidUnit - nowUnit) : new("same", 0);

    public static bool CanCancelPurchase(int daysToDeparture) => daysToDeparture >= CancelUntilDays;

    /// <summary>The date a price changes: the last day on the old price is <c>atDays</c> out, so the new price starts a day later.</summary>
    public static string ChangeOn(DateOnly departure, int atDays, double share) => share == 0 ? "" : departure.AddDays(-(atDays - 1)).ToString("yyyy-MM-dd");
}
