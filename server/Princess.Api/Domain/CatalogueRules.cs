namespace Princess.Api.Domain;

/// <summary>What can be booked, ordered or joined on board. <c>Mode</c> is <c>book</c> (a time), <c>order</c> (for pick-up) or <c>going</c> (just mark it). <c>Price</c> is null for a service you only join.</summary>
public sealed record CatalogueItem(string Id, string Group, string Title, int[] Days, string[] Times, long? Price, int? Limit, int MinAge, string Mode);

public sealed record SelectionAsk(string? Item, int Day, string? Time, int Qty);

/// <summary>Spa and fitness, shops and gift cards, auctions and specials, faith and community services and captioned showings (ENT-03, SHP-01, SHP-04, SHP-06, ACS-04). Ports <c>src/domain/catalogue.ts</c>; names, times and prices are authored concept values.</summary>
public static class CatalogueRules
{
    private static readonly int[] Sea = [2, 6, 7];
    private static readonly int[] AtSeaOrPort = [1, 2, 3, 4, 5, 6, 7];
    private static readonly int[] Port = [3, 4, 5];
    private static readonly string[] None = [];

    private static CatalogueItem I(string id, string group, string title, int[]? days = null, string[]? times = null, long? price = null, int? limit = null, int minAge = 0, string mode = "going") =>
        new(id, group, title, days ?? AtSeaOrPort, times ?? None, price, limit, minAge, mode);

    public static readonly IReadOnlyList<CatalogueItem> Items =
    [
        I("spa-swedish", "spa", "Swedish massage", times: ["10:00", "13:00", "16:00"], price: 13900, limit: 4, minAge: 18, mode: "book"),
        I("spa-hotstone", "spa", "Hot stone massage", times: ["11:00", "15:00"], price: 18900, limit: 3, minAge: 18, mode: "book"),
        I("spa-facial", "spa", "Hydrating facial", times: ["09:30", "12:30", "17:00"], price: 12900, limit: 4, minAge: 16, mode: "book"),
        I("spa-port-special", "spa", "Port-day special: back and shoulders", days: Port, times: ["10:30", "14:00"], price: 6900, limit: 6, minAge: 18, mode: "book"),
        I("salon-cut", "spa", "Haircut and style", times: ["09:00", "11:30", "15:00"], price: 6500, limit: 3, mode: "book"),
        I("salon-nails", "spa", "Manicure", times: ["10:00", "14:30"], price: 4500, limit: 3, mode: "book"),
        I("fit-yoga", "fitness", "Sunrise yoga", days: Sea, times: ["07:00"], price: 0, limit: 20, mode: "book"),
        I("fit-spin", "fitness", "Spin class", days: [2, 3, 5, 6], times: ["08:30", "17:30"], price: 1200, limit: 14, minAge: 16, mode: "book"),
        I("fit-trainer", "fitness", "Personal training session", times: ["09:00", "16:00"], price: 8500, limit: 2, minAge: 16, mode: "book"),
        I("shop-sunscreen", "shop", "Reef-safe sunscreen SPF 50", price: 1800, limit: 30, mode: "order"),
        I("shop-hat", "shop", "Wide-brim sun hat", price: 2900, limit: 12, mode: "order"),
        I("shop-tote", "shop", "Sun Princess tote bag", price: 2400, limit: 20, mode: "order"),
        I("shop-charm", "shop", "Charm bracelet", price: 5900, limit: 8, mode: "order"),
        I("gift-25", "shop", "Gift card, $25", price: 2500, mode: "order"),
        I("gift-50", "shop", "Gift card, $50", price: 5000, mode: "order"),
        I("gift-100", "shop", "Gift card, $100", price: 10000, mode: "order"),
        I("gift-flowers", "gift", "Fresh flowers in the cabin", price: 4500, limit: 20, mode: "order"),
        I("gift-champagne", "gift", "Champagne and strawberries", price: 7500, limit: 20, minAge: 21, mode: "order"),
        I("gift-cake", "gift", "Celebration cake", price: 3500, limit: 16, mode: "order"),
        I("gift-decor", "gift", "Stateroom decorating", price: 5500, limit: 12, mode: "order"),
        I("gift-kids", "gift", "Kids’ welcome package", price: 3000, limit: 24, mode: "order"),
        I("sp-art", "special", "Art auction", days: [2, 6], times: ["15:30"]),
        I("sp-jewel", "special", "Jewellery event", days: Port, times: ["11:00"]),
        I("sp-bingo", "special", "Bingo book, three games", days: Sea, times: ["14:00"], price: 2500, limit: 40, minAge: 18, mode: "order"),
        I("sp-daily", "special", "Daily special: deck-sale table", days: [2, 6, 7], times: ["10:00"]),
        I("faith-mass", "faith", "Catholic Mass", days: [2, 6], times: ["08:30"]),
        I("faith-shabbat", "faith", "Shabbat service", days: [5], times: ["18:00"]),
        I("faith-interfaith", "faith", "Interfaith reflection", days: [2, 6], times: ["09:30"]),
        I("faith-aa", "faith", "Friends of Bill W. meet-up", times: ["17:00"]),
        I("faith-solo", "faith", "Solo travellers’ meet-up", days: [1, 2, 6], times: ["17:30"]),
        I("acc-show-cc", "access", "Welcome aboard show with captions", days: [1], times: ["20:30"]),
        I("acc-show-sign", "access", "Stage show with sign-language interpreter", days: [2, 6], times: ["20:30"]),
        I("acc-cooking", "access", "Cooking demo transcript", days: Sea, times: ["11:00"]),
        I("acc-comedy", "access", "Comedy night with captions", days: [4, 7], times: ["21:30"]),
    ];

    public static CatalogueItem? ById(string? id) => Items.FirstOrDefault(i => i.Id == id);

    public const int MaxQty = 6;

    /// <summary>What other guests have taken, the same every time. A class or slot is never full to start with, and the stock is never below a quarter.</summary>
    public static int TakenByOthers(CatalogueItem i, int day, string time = "") =>
        i.Limit is not { } limit ? 0 : (int)(ExcursionRules.Hash($"{i.Id}|{day}|{time}") % (uint)(limit * 3 / 4 + 1));

    /// <summary>Places left for what others have not taken, or null when there is no limit.</summary>
    public static int? PlacesLeft(CatalogueItem i, int day, string time, int mine) => i.Limit is not { } limit ? null : Math.Max(0, limit - TakenByOthers(i, day, time) - mine);

    /// <summary>unknown, badDay, badTime, badQty, age, soldOut or notBookable.</summary>
    public static string? Problem(SelectionAsk s, int age, int taken = 0)
    {
        var i = ById(s.Item);
        if (i is null) return "unknown";
        if (age < i.MinAge) return "age";
        if (i.Mode == "order")
        {
            if (s.Day != 0 || (s.Time ?? "") != "") return "notBookable";
        }
        else
        {
            if (!i.Days.Contains(s.Day)) return "badDay";
            if (i.Times.Length > 0 ? !i.Times.Contains(s.Time ?? "") : (s.Time ?? "") != "") return "badTime";
        }
        var perPerson = i.Mode == "going" ? 1 : MaxQty;
        if (s.Qty < 1 || s.Qty > perPerson) return "badQty";
        if (i.Limit is { } limit && s.Qty > limit - taken) return "soldOut";
        return null;
    }

    public static long ChargeFor(CatalogueItem i, int qty) => (i.Price ?? 0) * qty;
}
