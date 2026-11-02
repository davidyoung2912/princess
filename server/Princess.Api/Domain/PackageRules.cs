namespace Princess.Api.Domain;

public sealed record AddOnInfo(string Id, string Unit, long Base, int ChangeAtDays, double ChangeShare, int MinAge);

public sealed record PackageUpgrade(string From, string To, long Base, int ChangeAtDays, double ChangeShare);

/// <summary>One add-on as the client lists it: the authored name and blurb with the unit, base price and price change of <see cref="AddOnInfo"/>.</summary>
public sealed record AddOnRefDto(string Id, string Name, string Blurb, string Unit, long Base, int ChangeAtDays, double ChangeShare, int MinAge);

/// <summary>The add-ons, the figures the "is it worth it" screens work from, and the refund window (multi-device plan 3, Phase 3 step 5). Prices stay server-computed; these are the bases.</summary>
public sealed record PackagesReferenceDto(string Version, IReadOnlyList<AddOnRefDto> AddOns, long AvgDrink, double ServiceCharge, long AvgCover, int CancelUntilDays);

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

    /// <summary>The average price of one drink on board, before the service charge; the average cover charge across the specialty restaurants.</summary>
    public const long AvgDrink = 1_100;
    public const double ServiceCharge = 0.18;
    public const long AvgCover = 4_500;

    private static readonly Dictionary<string, (string Name, string Blurb)> Copy = new()
    {
        ["drinks"] = ("Drinks package", "Cocktails, wine by the glass, beer and coffee, up to $15 a drink, with the gratuity included."),
        ["wifi"] = ("Wi-Fi, one device", "Messaging and browsing for one phone or tablet all cruise."),
        ["specialtyPass"] = ("Specialty dining pass", "Three dinners at Crown Grill, Sabatini’s, The Catch or Love by Britto."),
        ["photo"] = ("Photo package", "Every photo the ship’s photographers take of you, to download."),
        ["laundry"] = ("Laundry package", "Wash and fold, with up to five bags for the whole stateroom."),
    };

    public static PackagesReferenceDto Reference()
    {
        var list = AddOns.Select(a => new AddOnRefDto(a.Id, Copy[a.Id].Name, Copy[a.Id].Blurb, a.Unit, a.Base, a.ChangeAtDays, a.ChangeShare, a.MinAge)).ToList();
        var text = string.Join('|', list.Select(a => $"{a.Id}:{a.Name}:{a.Blurb}:{a.Unit}:{a.Base}:{a.ChangeAtDays}:{a.ChangeShare}:{a.MinAge}")) + $"#{AvgDrink}:{ServiceCharge}:{AvgCover}:{CancelUntilDays}";
        var version = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(text))).ToLowerInvariant()[..16];
        return new(version, list, AvgDrink, ServiceCharge, AvgCover, CancelUntilDays);
    }

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
