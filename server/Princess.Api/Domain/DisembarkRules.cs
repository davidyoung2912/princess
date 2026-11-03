namespace Princess.Api.Domain;

public sealed record TagGroup(string Color, int Number, string Time);

public sealed record DisembarkTimes(DateTime ArrivalAt, DateTime BagsOutAt, DateTime TipBy, DateTime VacateAt, DateOnly Date);

public sealed record CustomsDeclaration(bool Food, bool Cash, int GoodsUsd, string Note);

public sealed record CustomsSummary(List<string> Declare, int OverUsd, int AllowanceUsd);

public sealed record OnwardModeDef(string Id, int Minutes, long Cents, bool PerCar);

public sealed record OnwardPlan(string Mode, string FlightAt, string Flight, string Note);

public sealed record OnwardCheck(string Status, long? LeaveBy, int? Spare, string EarliestFlight);

public sealed record NightItem(string Id, int Day, string Time, string? Auto, string? To, bool TaggedOnly);

public sealed record NightEntry(string Id, int Day, string Time, string? Auto, string? To, bool TaggedOnly, long DueAt, string State, bool Automatic);

public sealed record GratuityGuest(bool Suite, bool Included);

/// <summary>
/// Disembarkation (DEB-01 to DEB-07): how to get off, luggage tags, customs, onward travel, the final night and the final bill. Ported from <c>src/domain/disembark.ts</c>.
/// Times, groups and amounts are authored concept values.
/// </summary>
public static class DisembarkRules
{
    public const string PortZone = Itinerary.ShipHomeZone;

    public static readonly string[] WalkOffIds = ["tagged", "selfAssist", "earlyWalkOff"];

    /// <summary>Luggage-tag groups in the order they are called. Gold is for priority guests; the rest are shared out by a steady pick.</summary>
    public static readonly IReadOnlyList<TagGroup> TagGroups =
    [
        new("gold", 1, "07:00"), new("blue", 2, "07:30"), new("green", 3, "08:00"), new("orange", 4, "08:30"), new("red", 5, "09:00"), new("purple", 6, "09:30"),
    ];

    public const string SelfAssistFrom = "07:30";
    public const string EarlyFrom = "06:30";

    /// <summary>Cash carried at or above this many US dollars must be declared at customs.</summary>
    public const int CashLimitUsd = 10_000;
    /// <summary>Walking from the gangway through customs and out to the curb.</summary>
    public const int ClearanceMinutes = 45;
    public const int MaxCarryBags = 2;
    public const int MaxBags = 6;

    private static TimeOnly T(string hhmm) => TimeOnly.ParseExact(hhmm, "HH:mm");

    /// <summary>FNV-1a over UTF-16 code units, as the TypeScript <c>hash</c>.</summary>
    public static uint Hash(string text)
    {
        var h = 2166136261u;
        foreach (var ch in text) h = unchecked((h ^ ch) * 16777619u);
        return h;
    }

    /// <summary>The tag group for a booking: Gold 1 for priority disembarkation, otherwise a steady pick from the others.</summary>
    public static TagGroup GroupFor(string booking, bool priority) => priority ? TagGroups[0] : TagGroups[1 + (int)(Hash(booking) % (uint)(TagGroups.Count - 1))];

    public static DisembarkTimes Times(Timeline timeline)
    {
        var days = timeline.Days;
        var last = days[^1];
        var eve = days[^2];
        var portZone = Itinerary.ZoneOf(last.Port);
        DateTime Evening(string time) => Itinerary.LocalToUtc(eve.Date, T(time), timeline.ShipZoneOnDate(eve.Date));
        return new DisembarkTimes(
            Itinerary.LocalToUtc(last.Date, last.Arrive ?? T("06:00"), portZone), Evening("22:00"), Evening("20:00"), Itinerary.LocalToUtc(last.Date, T("08:30"), portZone), last.Date);
    }

    private static DateTime OnLastMorning(Timeline timeline, string time) => Itinerary.LocalToUtc(timeline.Days[^1].Date, T(time), Itinerary.ZoneOf(timeline.Days[^1].Port));

    /// <summary>When a guest can leave the ship with a choice. Tagged guests go when their group is called.</summary>
    public static DateTime OffAt(Timeline timeline, string option, TagGroup group) =>
        OnLastMorning(timeline, option == "tagged" ? group.Time : option == "selfAssist" ? SelfAssistFrom : EarlyFrom);

    /// <summary>What is wrong with a choice, as a short code the screen explains, or null. <paramref name="bags"/> has an entry for every guest.</summary>
    public static string? ChoiceProblem(string? option, IReadOnlyDictionary<Guid, int> bags)
    {
        if (option is null || !WalkOffIds.Contains(option)) return "badOption";
        var total = 0;
        foreach (var n in bags.Values)
        {
            if (n < 0 || n > MaxBags) return "badBags";
            if (option != "tagged" && n > MaxCarryBags) return "tooManyToCarry";
            total += n;
        }
        return option == "tagged" && total == 0 ? "noBags" : null;
    }

    /// <summary>The label printed on a luggage tag.</summary>
    public static string TagLabel(TagGroup g, string printed, string cabin) => $"{g.Color.ToUpperInvariant()} {g.Number} · {printed} · {cabin}";

    // ---- Customs and immigration (DEB-04) ----

    /// <summary>Duty-free goods each person may bring in.</summary>
    public const int AllowanceUsd = 800;
    public const int GoodsMax = 100_000;
    public const int CustomsNoteMax = 200;

    public static CustomsDeclaration BlankCustoms() => new(false, false, 0, "");

    public static string? CustomsProblem(CustomsDeclaration d) =>
        d.GoodsUsd < 0 || d.GoodsUsd > GoodsMax ? "badGoods" : (d.Note ?? "").Length > CustomsNoteMax ? "badNote" : null;

    /// <summary>What must be declared to the officer, and how far the goods are over the family's allowance.</summary>
    public static CustomsSummary CustomsSummaryOf(CustomsDeclaration d, int people)
    {
        var allowance = AllowanceUsd * people;
        var over = Math.Max(0, d.GoodsUsd - allowance);
        var declare = new List<string>();
        if (d.Food) declare.Add("food");
        if (d.Cash) declare.Add("cash");
        if (over > 0) declare.Add("goods");
        return new CustomsSummary(declare, over, allowance);
    }

    // ---- Onward travel (DEB-05) ----

    public static readonly IReadOnlyList<OnwardModeDef> OnwardModes =
    [
        new("airportTransfer", 25, 2600, false), new("rideshare", 15, 3000, true), new("hotelShuttle", 30, 0, false), new("parking", 10, 0, false),
    ];

    public static OnwardModeDef? OnwardMode(string? id) => OnwardModes.FirstOrDefault(m => m.Id == id);

    public const int OnwardNoteMax = 200;
    /// <summary>Be at the airport this long before a flight.</summary>
    public const int AirportMinutes = 180;
    public const int TightMinutes = 45;

    private static bool TimeText(string s) => s.Length == 5 && s[2] == ':' && TimeOnly.TryParseExact(s, "HH:mm", out _);

    public static string? OnwardProblem(OnwardPlan p)
    {
        if (OnwardMode(p.Mode) is null) return "badMode";
        if (p.FlightAt.Length > 0 && !TimeText(p.FlightAt)) return "badFlightTime";
        if (p.Flight.Length > 8 || !p.Flight.All(ch => char.IsAsciiLetterOrDigit(ch) || ch == ' ')) return "badFlight";
        return p.Note.Length > OnwardNoteMax ? "badNote" : null;
    }

    /// <summary>Whether a flight can be made from when the guest leaves the ship: off the ship, through customs, the ride, then three hours before the flight.</summary>
    public static OnwardCheck CheckOnward(Timeline timeline, OnwardPlan plan, DateTime offFrom)
    {
        var mode = OnwardMode(plan.Mode)!;
        var ready = offFrom.AddMinutes(ClearanceMinutes + mode.Minutes);
        var baseline = OnLastMorning(timeline, "00:00");
        var earliestMin = (int)Math.Ceiling((ready - baseline).TotalMinutes / 15) * 15 + AirportMinutes;
        var earliest = earliestMin >= 24 * 60 ? "23:59" : $"{earliestMin / 60:00}:{earliestMin % 60:00}";
        if (plan.FlightAt.Length == 0) return new OnwardCheck("noFlight", null, null, earliest);
        var flightAt = baseline.Add(T(plan.FlightAt).ToTimeSpan());
        var spare = (int)Math.Round((flightAt.AddMinutes(-AirportMinutes) - ready).TotalMinutes, MidpointRounding.AwayFromZero);
        var leaveBy = flightAt.AddMinutes(-(AirportMinutes + mode.Minutes));
        return new OnwardCheck(spare < 0 ? "tooEarly" : spare < TightMinutes ? "tight" : "ok", TripRules.ToMs(leaveBy), spare, earliest);
    }

    // ---- The final night (DEB-07) ----

    public static readonly IReadOnlyList<NightItem> NightItems =
    [
        new("bill", 7, "20:00", null, "/me/bill/final", false),
        new("choose", 7, "22:00", "option", "/home/disembark", false),
        new("customs", 7, "22:00", "customs", "/home/disembark/customs", false),
        new("tags", 7, "22:00", "tags", "/home/disembark", true),
        new("bagsOut", 7, "22:00", null, null, true),
        new("carryOn", 7, "22:00", null, null, false),
        new("valuables", 7, "22:00", null, null, false),
        new("charge", 7, "22:00", null, null, false),
        new("documents", 8, "06:00", null, null, false),
    ];

    public static NightItem? NightItemById(string? id) => NightItems.FirstOrDefault(i => i.Id == id);

    public const int DueSoonMinutes = 120;

    public static List<NightEntry> NightEntries(Timeline timeline, DateTime now, string? option, bool customsDone, bool tagsOn, IReadOnlySet<string> ticked)
    {
        var days = timeline.Days;
        return [.. NightItems.Where(i => !i.TaggedOnly || option is null || option == "tagged").Select(item =>
        {
            // The items are written against the eight-day week; they count back from the last day, so a longer sailing keeps them at its end.
            var date = days[item.Day - 1 + (days.Count - 8)].Date;
            var dueAt = Itinerary.LocalToUtc(date, T(item.Time), item.Day == 8 ? Itinerary.ZoneOf(days[^1].Port) : timeline.ShipZoneOnDate(date));
            var automatic = item.Auto switch { "option" => option is not null, "customs" => customsDone, "tags" => tagsOn, _ => false };
            var state = automatic || ticked.Contains(item.Id) ? "done" : now > dueAt ? "overdue" : dueAt - now <= TimeSpan.FromMinutes(DueSoonMinutes) ? "dueSoon" : "upcoming";
            return new NightEntry(item.Id, item.Day, item.Time, item.Auto, item.To, item.TaggedOnly, TripRules.ToMs(dueAt), state, automatic);
        })];
    }

    // ---- The final bill (DEB-03) ----

    /// <summary>Shares of the daily gratuity a guest can keep.</summary>
    public static readonly int[] TipKeep = [100, 75, 50, 0];

    /// <summary>What the daily gratuity comes to for a booking, for the seven nights; nothing for a guest whose package includes it.</summary>
    public static long GratuityCharged(IEnumerable<GratuityGuest> guests, int nights = Pricing.Nights) =>
        guests.Sum(g => g.Included ? 0 : (g.Suite ? Pricing.GratuityPerNightSuite : Pricing.GratuityPerNight) * nights);

    /// <summary>The credit for keeping only part of the gratuity.</summary>
    public static long TipCredit(long charged, int keepPercent) => Pricing.JsRound((double)charged * (100 - keepPercent) / 100);

    public static readonly string[] ReceiptIds = ["folio", "gratuities", "fare"];
}
