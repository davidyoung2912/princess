namespace Princess.Api.Domain;

public sealed record ChecklistItem(string Id, int DaysBefore, string? Auto, string? To);

public sealed record ChecklistEntry(string Id, int DaysBefore, string? Auto, string? To, string Due, string State, bool Automatic);

public sealed record Milestone(int DaysBefore, string Due, List<ChecklistEntry> Entries);

public sealed record AssistKind(string Id, string Group, string? Need, int NoticeDays, bool NoteRequired);

public sealed record Deadline(string By, int DaysLeft, string State);

public sealed record TravelPlan(string? Window, string? Mode, string? Hotel);

public sealed record ArrivalWindow(string Start, string End, string Crowd);

public sealed record PackItem(string Id, string Group, string Label, string Why);

public sealed record Weather(int HighF, int LowF, string Rain, string Note);

/// <summary>The pre-cruise helpers in one place: checklist (MNG-07), packing list (MNG-08), travel to the port (MNG-10) and special assistance (MNG-12). Ported from <c>src/domain</c>.</summary>
public static class PlanRules
{
    // ---- Checklist ----

    public static readonly int[] MilestoneDays = [90, 60, 30, 14, 7, 1];
    public const int DueSoonDays = 7;

    public static readonly IReadOnlyList<ChecklistItem> Checklist =
    [
        new("pay", 90, "paid", "/me/payments"),
        new("names", 90, null, "/me/profile"),
        new("documents", 60, "documents", "/me/documents"),
        new("tours", 60, "tours", "/plan/excursions"),
        new("assistance", 30, "assistance", "/plan/assistance"),
        new("dining", 30, "dining", "/plan/dining"),
        new("insurance", 30, null, null),
        new("travel", 14, "travel", "/plan/travel"),
        new("packages", 14, null, "/me/packages"),
        new("checkin", 7, "checkin", "/"),
        new("packing", 7, null, "/plan/packing"),
        new("phone", 7, null, null),
        new("bags", 1, null, null),
        new("pass", 1, null, "/"),
    ];

    public static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");

    public static List<ChecklistEntry> BuildChecklist(DateOnly departure, int daysToDeparture, IReadOnlyDictionary<string, bool> auto, IReadOnlyCollection<string> ticked) =>
        Checklist.Select(item =>
        {
            var automatic = item.Auto is not null && auto.GetValueOrDefault(item.Auto);
            var done = automatic || ticked.Contains(item.Id);
            var left = daysToDeparture - item.DaysBefore;
            var state = done ? "done" : left < 0 ? "overdue" : left <= DueSoonDays ? "dueSoon" : "upcoming";
            return new ChecklistEntry(item.Id, item.DaysBefore, item.Auto, item.To, Iso(departure.AddDays(-item.DaysBefore)), state, automatic);
        }).ToList();

    public static List<Milestone> Milestones(IReadOnlyList<ChecklistEntry> entries) =>
        MilestoneDays.Select(d => entries.Where(e => e.DaysBefore == d).ToList())
            .Where(list => list.Count > 0).Select(list => new Milestone(list[0].DaysBefore, list[0].Due, list)).ToList();

    /// <summary>The one item to do next: overdue first, then the soonest not done.</summary>
    public static ChecklistEntry? NextItem(IReadOnlyList<ChecklistEntry> entries)
    {
        var open = entries.Where(e => e.State != "done").ToList();
        return open.FirstOrDefault(e => e.State == "overdue") ?? open.OrderBy(e => e.Due, StringComparer.Ordinal).FirstOrDefault();
    }

    // ---- Assistance ----

    public static readonly IReadOnlyList<AssistKind> AssistKinds =
    [
        new("wheelchair", "mobility", "mobility", 30, false),
        new("accessibleEquipment", "mobility", "mobility", 30, true),
        new("tender", "mobility", "mobility", 7, false),
        new("assistiveListening", "hearing", "hearing", 14, false),
        new("largePrint", "vision", "vision", 14, false),
        new("cpap", "medical", "cpap", 14, false),
        new("oxygen", "medical", "oxygen", 30, true),
        new("dietary", "dietary", null, 14, true),
        new("serviceAnimal", "medical", "serviceAnimal", 30, true),
    ];

    public const int SoonDays = 14;
    /// <summary>Guest Services confirms a request a day after it comes in (a pretend process).</summary>
    public static readonly TimeSpan ConfirmAfter = TimeSpan.FromHours(24);

    public static AssistKind? AssistKindOf(string? id) => AssistKinds.FirstOrDefault(k => k.Id == id);

    public static Deadline DeadlineOf(AssistKind kind, DateOnly departure, DateOnly today)
    {
        var by = departure.AddDays(-kind.NoticeDays);
        var left = by.DayNumber - today.DayNumber;
        return new(Iso(by), left, left < 0 ? "late" : left <= SoonDays ? "soon" : "open");
    }

    /// <summary>A request made after its cut-off is passed on but cannot be promised.</summary>
    public static string RequestStatus(AssistKind kind, DateOnly departure, DateOnly madeOn, DateTime at, DateTime now) =>
        DeadlineOf(kind, departure, madeOn).State == "late" ? "late" : now - at >= ConfirmAfter ? "confirmed" : "received";

    // ---- Travel ----

    public static readonly string[] Modes = ["drive", "transfer", "rideshare", "shuttle"];
    public static readonly string[] Hotels = ["seabreeze", "harbour", "beachside"];

    private static readonly (string Start, string End, string Crowd)[] Slots =
    [
        ("10:30", "11:00", "quiet"), ("11:00", "11:30", "quiet"), ("11:30", "12:00", "busy"),
        ("12:00", "12:30", "busiest"), ("12:30", "13:00", "busiest"), ("13:00", "13:30", "busy"),
    ];

    /// <summary>Priority guests may also arrive at 10:30; everyone else starts at 11:00.</summary>
    public static List<ArrivalWindow> ArrivalWindows(bool priority) =>
        Slots.Where(s => priority || s.Start != "10:30").Select(s => new ArrivalWindow(s.Start, s.End, s.Crowd)).ToList();

    public static bool IsWindow(string? start, bool priority) => start is not null && ArrivalWindows(priority).Any(w => w.Start == start);
    public static bool IsMode(string? v) => v is not null && Modes.Contains(v);
    public static bool IsHotel(string? v) => v is not null && Hotels.Contains(v);
    public static string SuggestedWindow(bool priority) => priority ? "10:30" : "11:00";

    /// <summary>Anything stored that is no longer a valid choice reads back as nothing chosen.</summary>
    public static TravelPlan Normalize(TravelPlan? raw, bool priority) =>
        new(IsWindow(raw?.Window, priority) ? raw!.Window : null, IsMode(raw?.Mode) ? raw!.Mode : null, IsHotel(raw?.Hotel) ? raw!.Hotel : null);

    /// <summary>The window ids in <c>ref.TravelWindows</c> are "w-" and the start time without the colon.</summary>
    public static string WindowId(string start) => "w-" + start.Replace(":", "");

    public static string? WindowFromId(string? id) => id is { Length: 6 } && id.StartsWith("w-") ? $"{id[2..4]}:{id[4..6]}" : null;

    // ---- Packing ----

    public static readonly string[] PackGroups = ["documents", "clothes", "beach", "health", "tech", "kids"];

    private static readonly Weather[] MonthWeather =
    [
        new(82, 72, "low", "Dry, warm and breezy."), new(83, 72, "low", "Dry, warm and breezy."), new(84, 74, "low", "Warm and mostly dry, with strong sun."),
        new(85, 75, "low", "Hot and dry before the rains."), new(87, 77, "some", "Hotter, with the first showers."), new(88, 78, "high", "Hot, humid and showery. Hurricane season begins."),
        new(89, 79, "some", "Hot and humid, with passing storms."), new(89, 79, "some", "Hot and humid, with passing storms."), new(88, 78, "high", "Wettest month, with storm risk."),
        new(86, 77, "high", "Wet, with storm risk easing."), new(84, 75, "some", "Drier and cooler as the season ends."), new(82, 73, "low", "Dry, warm and the busiest season."),
    ];

    public static Weather WeatherFor(DateOnly date) => MonthWeather[date.Month - 1];

    public static int ElegantNights(int nights) => nights >= 7 ? 2 : nights >= 5 ? 1 : 0;

    public static List<PackItem> BuildPackingList(DateOnly departure, int nights, IEnumerable<string> tours, IReadOnlyCollection<int> ages, IReadOnlyCollection<string> needs, bool tender, int elegantNights)
    {
        var w = WeatherFor(departure);
        var kinds = tours.Select(ExcursionRules.ById).OfType<Excursion>().SelectMany(x => new[] { x.Activity }.Concat(x.Interests)).ToHashSet();
        var items = new List<PackItem>();
        void Add(string id, string group, string label, string why) => items.Add(new(id, group, label, why));

        Add("passport", "documents", "Passports for everyone", "Needed to board and to come home. Keep them in your hand luggage.");
        Add("boardingDocs", "documents", "Printed boarding documents and luggage tags", "Check-in is quicker with paper as a back-up to your phone.");
        Add("cards", "documents", "Credit card and some small bills", "For tips ashore, taxis and small shops.");
        Add("insurance", "documents", "Travel insurance details", "Keep the policy number and phone number together.");

        Add("daywear", "clothes", $"Lightweight daywear for {nights} days", $"Highs of {w.HighF}°F and lows of {w.LowF}°F. {w.Note}");
        Add("smart", "clothes", "Smart casual outfits for dinner", "Collared shirts or a nice top; shorts and flip-flops are not worn at dinner.");
        if (elegantNights > 0) Add("elegant", "clothes", $"{(elegantNights == 1 ? "One outfit" : $"{elegantNights} outfits")} for elegant evenings", "A jacket or a dress; the ship marks these nights on the daily plan.");
        Add("lightLayer", "clothes", "A light jacket or wrap", "Dining rooms and the Dome theatre are cool, and the evening deck breeze is stronger.");
        Add("comfyShoes", "clothes", "Comfortable walking shoes", "The ship is long, and ports mean cobbles and uneven pavements.");
        if (w.Rain != "low") Add("rain", "clothes", "A light rain jacket or compact umbrella", $"Showers are {(w.Rain == "high" ? "likely" : "possible")} at this time of year.");

        Add("swim", "beach", "Two swimsuits", "One is always drying.");
        Add("sunscreen", "beach", "Sunscreen, reef-safe if you will snorkel", "The Caribbean sun burns in under 30 minutes.");
        Add("hat", "beach", "Hat and sunglasses", "Shade is scarce on the pier and the pool deck.");
        if (kinds.Contains("water")) Add("waterShoes", "beach", "Water shoes and a quick-dry towel", "For your snorkelling or beach excursion. Gear is provided; shoes are not.");
        if (kinds.Contains("culture")) Add("ruinsShoes", "beach", "Sturdy shoes and a small day bag", "For the temple or ruins visit: steps, stones and no shade.");
        if (kinds.Contains("strenuous")) Add("closedShoes", "beach", "Closed shoes you can get muddy", "Your zip-line or cave tour needs them.");
        if (tender) Add("tenderBag", "beach", "A small bag with a zip", "Going ashore by tender at Belize City: you will step across a gap, so keep both hands free.");

        Add("meds", "health", "Prescription medicines in their own bottles, in hand luggage", "Pack extra for two days. Do not put them in checked bags.");
        Add("firstAid", "health", "Seasickness tablets and a small first-aid kit", "The medical centre charges for these.");
        if (needs.Contains("cpap")) Add("cpap", "health", "CPAP machine, distilled water and an extension cord", "Staterooms have limited sockets. Ask for a power strip in your assistance request.");
        if (needs.Contains("oxygen")) Add("oxygen", "health", "Portable oxygen concentrator and spare batteries", "Carry them yourself. Tell the ship in advance.");
        if (needs.Contains("hearing")) Add("hearing", "health", "Hearing aid batteries and a spare", "The assistive listening request covers the theatre, not your room.");
        if (needs.Contains("mobility")) Add("mobility", "health", "Charger and spare parts for your mobility aid", "Tender and shore transport cannot always carry repairs.");

        Add("chargers", "tech", "Phone chargers and a power strip without a surge protector", "Surge protectors are not allowed on board.");
        Add("battery", "tech", "A portable battery", "Useful for a long day ashore with no outlets.");
        Add("offline", "tech", "Offline copies of your tickets and maps", "Wi-Fi at sea is slow. Download them before you leave home.");

        if (ages.Any(a => a < 3)) Add("swimDiapers", "kids", "Swim nappies and baby supplies", "The pools require swim nappies for babies and toddlers.");
        if (ages.Any(a => a < 18)) Add("games", "kids", "Cards, small games and books", "For quiet time in the cabin and long days at sea.");
        if (ages.Any(a => a is >= 13 and < 18)) Add("teenClothes", "kids", "Clothes for the Underground and the pool deck", "Teen club nights have their own dress ideas.");
        return items;
    }

    // ---- Overview ----

    public sealed record PlanEntry(string Kind, string Time, string Name, string? Id, List<Guid> Guests);
    public sealed record PlanDay(int Day, string Date, string Port, string Place, List<PlanEntry> Entries, List<string> Gaps);

    public static List<PlanDay> BuildPlan(DateOnly departure, IEnumerable<(string Id, string ExcursionId, List<Guid> Guests)> tours, IEnumerable<(string Id, string VenueId, int Day, string Time, List<Guid> Guests)> tables) =>
        Itinerary.Days(departure).Select(d =>
        {
            var entries = new List<PlanEntry>();
            if (d.Depart is { } dep && d.Port == "fll") entries.Add(new("sail", dep.ToString("HH:mm"), "", null, []));
            if (d.AllAboard is { } aa) entries.Add(new("allAboard", aa.ToString("HH:mm"), "", null, []));
            foreach (var t in tours)
                if (ExcursionRules.ById(t.ExcursionId) is { } x && ExcursionRules.DayOf(departure, x).Day == d.Day) entries.Add(new("tour", x.Start, x.Name, t.Id, t.Guests));
            foreach (var r in tables.Where(r => r.Day == d.Day)) entries.Add(new("dinner", r.Time, DiningRules.VenueById(r.VenueId)?.Name ?? r.VenueId, r.Id, r.Guests));
            entries = entries.OrderBy(e => e.Time, StringComparer.Ordinal).ToList();
            var gaps = new List<string>();
            if (d.Port is not ("sea" or "fll") && !entries.Any(e => e.Kind == "tour")) gaps.Add("tour");
            if (d.Day <= 7 && !entries.Any(e => e.Kind == "dinner")) gaps.Add("dinner");
            return new PlanDay(d.Day, Iso(d.Date), d.Port, d.Port == "sea" ? "" : Itinerary.Ports[d.Port].Name, entries, gaps);
        }).ToList();
}
