using System.Text.Json.Serialization;

namespace Princess.Api.Domain;

public sealed record MenuExtra(string Id, string Label, long Cents);

public sealed record MenuItem(string Id, string Name, string Group, long Cents, bool Alcohol, bool Packaged, string[] On, MenuExtra[] Extras, string? Substitute);

/// <summary>Where an order goes: the stateroom, a place on deck (a delivery zone id) or words (3 to 80 characters).</summary>
public sealed record OrderLocation(
    string Kind,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? PlaceId = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Text = null);

public sealed record OrderLineIn(string ItemId, int Qty, string[] Extras, Guid Guest, string? Note);

public sealed record OrderGuestInfo(Guid Id, int Age, int DrinkCapUsd);

public sealed record PricedLine(
    int Index, string ItemId, string Name, int Qty, Guid Guest, long Gross, long Charge,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? CoveredBy,
    bool Alcohol, string Group, bool Removed,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SubstitutedFor);

public sealed record Priced(List<PricedLine> Lines, long Fee, long Service, long Tip, long Total, long Covered);

public sealed record OrderProgress(string Stage, long StartAt, long? EtaAt);

public sealed record BreakfastSlot(string Time, long At);

public sealed record Morning(string Date, int Day, List<BreakfastSlot> Slots);

/// <summary>
/// Ordering to a stateroom or a spot on deck (DIN-04), room service and scheduled breakfast (DIN-05) and what happens when something runs out (DIN-11).
/// Ported from <c>src/domain/orders.ts</c>; prices, times and the menu are authored concept values.
/// </summary>
public static class OrderRules
{
    private static MenuExtra X(string id, string label, long cents) => new(id, label, cents);

    private static MenuItem Item(string id, string name, string group, long cents, string[] on, MenuExtra[]? extras = null, bool alcohol = false, bool packaged = false, string? substitute = null) =>
        new(id, name, group, cents, alcohol, packaged, on, extras ?? [], substitute);

    private static readonly string[] Both = ["delivery", "room"], Delivery = ["delivery"], Room = ["room"];

    public static readonly IReadOnlyList<MenuItem> Menu =
    [
        Item("cheeseburger", "Cheeseburger", "mains", 950, Both, [X("bacon", "Add bacon", 250), X("no-cheese", "No cheese", 0), X("gf-bun", "Gluten-free bun", 150)], substitute: "veggie-burger"),
        Item("veggie-burger", "Veggie burger", "mains", 950, Both),
        Item("fish-tacos", "Fish tacos", "mains", 1100, Delivery, substitute: "veggie-wrap"),
        Item("veggie-wrap", "Veggie wrap", "mains", 900, Delivery),
        Item("margherita", "Margherita pizza", "mains", 1000, Delivery, [X("extra-cheese", "Extra cheese", 150)]),
        Item("chicken-tenders", "Chicken tenders", "mains", 900, Both),
        Item("club-sandwich", "Club sandwich", "mains", 900, Room),
        Item("caesar", "Caesar salad", "mains", 850, Both, [X("chicken", "Add chicken", 300)]),
        Item("fries", "Fries", "snacks", 500, Both),
        Item("cookies", "Cookies (four)", "snacks", 400, Both),
        Item("lava-cake", "Chocolate lava cake", "desserts", 700, Both, substitute: "fruit-plate"),
        Item("fruit-plate", "Seasonal fruit plate", "desserts", 600, Both),
        Item("soda", "Soft drink", "drinks", 350, Both, packaged: true),
        Item("latte", "Latte", "drinks", 525, Both, [X("oat", "Oat milk", 0)], packaged: true),
        Item("water", "Bottled water", "drinks", 350, Both),
        Item("beer", "Draft beer", "drinks", 800, Both, alcohol: true, packaged: true),
        Item("wine", "Glass of wine", "drinks", 1100, Both, alcohol: true, packaged: true),
        Item("mai-tai", "Mai Tai", "drinks", 1300, Both, alcohol: true, packaged: true),
        Item("premium-cocktail", "Premium cocktail", "drinks", 2200, Both, alcohol: true, packaged: true),
        Item("continental", "Continental basket", "breakfast", 0, Room),
        Item("fruit-yoghurt", "Fruit and yoghurt", "breakfast", 0, Room),
        Item("eggs-toast", "Eggs and toast", "breakfast", 0, Room),
        Item("oatmeal", "Oatmeal with brown sugar", "breakfast", 0, Room),
        Item("salmon-bagel", "Smoked salmon bagel", "breakfast", 600, Room),
        Item("coffee-pot", "Pot of coffee", "breakfast", 0, Room),
        Item("orange-juice", "Orange juice", "breakfast", 0, Room),
    ];

    /// <summary>The item with this id on any ship (ids are unique across ships).</summary>
    public static MenuItem? ItemById(string? id) => ShipDining.AnyItem(id);

    public static readonly string[] Kinds = ["delivery", "room", "breakfast"];

    public static IEnumerable<MenuItem> MenuFor(string kind, string? shipId = null) =>
        ShipDining.MenuOf(shipId).Where(m => kind == "breakfast" ? m.Group == "breakfast" : m.Group != "breakfast" && m.On.Contains(kind));

    /// <summary>What the <c>orderStock</c> scenario takes off the menu before checkout, and what runs out while the order is being made.</summary>
    public static readonly string[] OutAtMenu = ["fish-tacos"];
    public static readonly string[] OutWhilePreparing = ["lava-cake"];

    /// <summary>The same two lists under a ship's own item ids.</summary>
    public static string[] OutAtMenuOn(string? shipId) => [.. OutAtMenu.Select(i => ShipDining.ItemOn(shipId, i))];
    public static string[] OutWhilePreparingOn(string? shipId) => [.. OutWhilePreparing.Select(i => ShipDining.ItemOn(shipId, i))];

    /// <summary>Places the crew deliver to on deck (ids from the deck plan).</summary>
    public static readonly string[] DeliveryZones = ["lido-pool", "promenade", "sea-view", "dome", "piazza"];

    public static string? LocationProblem(OrderLocation? l, string? shipId = null)
    {
        if (l is null) return "badLocation";
        return l.Kind switch
        {
            "cabin" => null,
            "zone" => l.PlaceId is not null && ShipDining.ZonesOf(shipId).Contains(l.PlaceId) ? null : "badLocation",
            "other" => l.Text is not null && l.Text.Trim().Length is >= 3 and <= 80 ? null : "badLocation",
            _ => "badLocation",
        };
    }

    public const long DeliveryFee = 200;
    public static readonly long[] Tips = [0, 200, 500];
    public const int MaxPerLine = 10, MaxLines = 12, DrinkingAge = 21, NoteMax = 100;

    /// <summary>Alcohol carries the same service charge as at a bar.</summary>
    public const double ServiceRate = 0.18;

    /// <summary>Why an order cannot be placed, or null. <paramref name="outOfStock"/> lists items the kitchen has already run out of (title <c>unavailable</c>, which the caller answers with a conflict).</summary>
    public static string? OrderProblem(string kind, IReadOnlyList<OrderLineIn> lines, OrderLocation? location, long tip, long? deliverAt, IReadOnlyList<OrderGuestInfo> guests, IReadOnlyCollection<string> outOfStock, string? shipId = null)
    {
        if (!Kinds.Contains(kind)) return "badKind";
        if (lines.Count == 0) return "empty";
        if (lines.Count > MaxLines) return "tooMany";
        if (!Tips.Contains(tip)) return "badTip";
        if (LocationProblem(location, shipId) is { } lp) return lp;
        if (kind == "breakfast" && deliverAt is null) return "noTime";
        var menu = MenuFor(kind, shipId).ToList();
        foreach (var l in lines)
        {
            var m = ItemById(l.ItemId);
            if (m is null) return "unknownItem";
            if (!menu.Contains(m)) return "wrongMenu";
            if (l.Qty < 1 || l.Qty > MaxPerLine) return "badQuantity";
            if (!l.Extras.All(e => m.Extras.Any(y => y.Id == e))) return "unknownExtra";
            var g = guests.FirstOrDefault(y => y.Id == l.Guest);
            if (g is null) return "noGuest";
            if (m.Alcohol && g.Age < DrinkingAge) return "underage";
            if (outOfStock.Contains(m.Id)) return "unavailable";
        }
        return null;
    }

    /// <summary>Prices an order: extras, what a drinks package covers, the bar service charge, the delivery fee and the tip. <paramref name="choices"/> maps a line index to <c>substitute</c> or <c>remove</c>.</summary>
    public static Priced Price(IReadOnlyList<OrderLineIn> lines, string kind, OrderLocation location, long tip, IReadOnlyList<OrderGuestInfo> guests, bool free, IReadOnlyDictionary<int, string>? choices = null)
    {
        var outLines = new List<PricedLine>();
        for (var index = 0; index < lines.Count; index++)
        {
            var l = lines[index];
            var original = ItemById(l.ItemId)!;
            var choice = choices is not null && choices.TryGetValue(index, out var c) ? c : null;
            var m = choice == "substitute" && original.Substitute is not null ? ItemById(original.Substitute)! : original;
            var extras = m == original ? l.Extras.Sum(id => m.Extras.FirstOrDefault(e => e.Id == id)?.Cents ?? 0) : 0;
            var unit = m.Cents + extras;
            var gross = unit * l.Qty;
            var sub = m == original ? null : original.Id;
            if (choice == "remove") { outLines.Add(new(index, m.Id, m.Name, l.Qty, l.Guest, 0, 0, null, m.Alcohol, m.Group, true, sub)); continue; }
            if (free && !m.Alcohol && gross > 0) { outLines.Add(new(index, m.Id, m.Name, l.Qty, l.Guest, gross, 0, "fare", m.Alcohol, m.Group, false, sub)); continue; }
            var cap = (guests.FirstOrDefault(g => g.Id == l.Guest)?.DrinkCapUsd ?? 0) * 100L;
            if (m.Packaged && cap > 0 && gross > 0) { outLines.Add(new(index, m.Id, m.Name, l.Qty, l.Guest, gross, Math.Max(0, unit - cap) * l.Qty, "package", m.Alcohol, m.Group, false, sub)); continue; }
            outLines.Add(new(index, m.Id, m.Name, l.Qty, l.Guest, gross, gross, null, m.Alcohol, m.Group, false, sub));
        }
        var live = outLines.Where(l => !l.Removed).ToList();
        var lineCharge = outLines.Sum(l => l.Charge);
        var service = (long)Math.Round(live.Where(l => l.Alcohol).Sum(l => l.Gross) * ServiceRate, MidpointRounding.AwayFromZero);
        var fee = kind == "delivery" && location.Kind != "cabin" && !free && live.Count > 0 ? DeliveryFee : 0;
        var tipCharged = live.Count > 0 ? tip : 0;
        var covered = outLines.Sum(l => l.Gross - l.Charge);
        return new Priced(outLines, fee, service, tipCharged, lineCharge + service + fee + tipCharged, covered);
    }

    private const long Min = 60_000;

    /// <summary>Minutes after the start at which each stage ends.</summary>
    private static (int Prepare, int Deliver) Timeline(string kind) => kind == "delivery" ? (5, 30) : (5, 35);

    private static int OnTheWay(string kind) => kind == "delivery" ? 20 : 25;

    /// <summary>Where an order stands. The clock stops at the moment something runs out and starts again when the guest chooses.</summary>
    public static OrderProgress ProgressOf(string kind, long placedAt, long? deliverAt, long? cancelledAt, bool pending, long? resolvedAt, long now)
    {
        var (prepare, deliver) = Timeline(kind);
        var startAt = kind == "breakfast" && deliverAt is { } d ? d - deliver * Min : placedAt;
        if (cancelledAt is not null) return new("cancelled", startAt, null);
        if (now < startAt) return new("scheduled", startAt, startAt + deliver * Min);
        var stall = resolvedAt is { } r ? Math.Max(0, r - (startAt + prepare * Min)) : 0;
        var elapsed = (now - startAt - stall) / (double)Min;
        if (pending && elapsed >= prepare) return new("needsChoice", startAt, null);
        var etaAt = startAt + stall + deliver * Min;
        var stage = elapsed < prepare ? "received" : elapsed < OnTheWay(kind) ? "preparing" : elapsed < deliver ? "onTheWay" : "delivered";
        return new(stage, startAt, etaAt);
    }

    /// <summary>An order can be cancelled with a full refund until the kitchen has started cooking, or when it is waiting on the guest's choice.</summary>
    public static bool CanCancel(string stage) => stage is "scheduled" or "received" or "needsChoice";

    /// <summary>The location can be corrected until the order arrives.</summary>
    public static bool CanMove(string stage) => stage is not ("delivered" or "cancelled");

    public static readonly string[] BreakfastSlots = ["06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30"];

    /// <summary>Breakfast needs this much notice.</summary>
    public const int BreakfastLeadMinutes = 120;

    /// <summary>The next few mornings that still have a delivery time with enough notice, in ship time.</summary>
    public static List<Morning> BreakfastMornings(Timeline timeline, DateTime now, int count = 3)
    {
        var nowMs = TripRules.ToMs(now);
        var result = new List<Morning>();
        foreach (var d in timeline.Days)
        {
            var zone = timeline.ShipZoneOnDate(d.Date);
            var slots = BreakfastSlots
                .Select(t => new BreakfastSlot(t, TripRules.ToMs(Itinerary.LocalToUtc(d.Date, TimeOnly.ParseExact(t, "HH:mm"), zone))))
                .Where(s => s.At - nowMs >= BreakfastLeadMinutes * Min).ToList();
            if (slots.Count > 0) result.Add(new Morning(d.Date.ToString("yyyy-MM-dd"), d.Day, slots));
            if (result.Count == count) break;
        }
        return result;
    }

    /// <summary>The account lines for an order: package entitlements applied visibly, and after a cancellation the charge followed by the refund.</summary>
    public static List<FolioLine> FolioLinesOf(Priced priced, long at, int day, long? cancelledAt, Guid tipper)
    {
        var lines = new List<FolioLine>();
        foreach (var l in priced.Lines.Where(l => !l.Removed))
            lines.Add(new FolioLine("", day, at, l.Group == "drinks" ? "drinks" : "dining", $"{(l.Qty > 1 ? $"{l.Qty} × " : "")}{l.Name} (order)", l.Guest, l.Charge, l.Gross, l.CoveredBy));
        var who = lines.Count > 0 ? lines[0].Guest : tipper;
        if (priced.Service > 0) lines.Add(new FolioLine("", day, at, "tips", "Bar service charge (order)", who, priced.Service, null, null));
        if (priced.Fee > 0) lines.Add(new FolioLine("", day, at, "dining", "Delivery fee (order)", who, priced.Fee, null, null));
        if (priced.Tip > 0) lines.Add(new FolioLine("", day, at, "tips", "Tip for the crew (order)", who, priced.Tip, null, null));
        if (cancelledAt is { } c && priced.Total > 0) lines.Add(new FolioLine("", day, c, "credit", "Refund, order cancelled", who, -priced.Total, null, null));
        return lines;
    }
}
