using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>A booked tour as a tool sees it: the catalogue id, the day and which travellers are on it (by reference).</summary>
public sealed record StanleyTourFact(string ExcursionId, int Day, IReadOnlyList<string> Who);
/// <summary>A dinner reservation: venue id, day, "HH:mm" and who is at the table.</summary>
public sealed record StanleyMealFact(string VenueId, int Day, string Time, IReadOnlyList<string> Who);
/// <summary>An active package or add-on and who it covers.</summary>
public sealed record StanleyPackageFact(string ItemId, int Units, IReadOnlyList<string> Who);
/// <summary>A case, with the traveller who opened it. The stage and outcome are worked out from the clock by the service, not stored text.</summary>
public sealed record StanleyCaseFact(string Owner, string Kind, string Number, string Stage, string? Outcome, DateTime DueAt);

/// <summary>
/// Everything the read tools may touch for one request: the packet, the guest's own "now", and the booking's plan and cases, by traveller reference. The loader only fills it from the active
/// voyage, and each tool still asks the packet which travellers it may read before it answers.
/// </summary>
public sealed record StanleyReadData(StanleyPacket Packet, DateTime Now, IReadOnlyList<StanleyTourFact> Tours, IReadOnlyList<StanleyMealFact> Meals, IReadOnlyList<StanleyPackageFact> Packages, IReadOnlyList<StanleyCaseFact> Cases);

/// <summary>
/// Stanley's typed read tools (docs/stanley-gap-analysis-and-plan.md, phase 4): the schemas the model sees and the code that answers them. Every tool is read-only, takes no id from the model that is
/// not checked against the packet, and answers with an error the model can read rather than a throw. A tool that reads a traveller calls <see cref="StanleyPacket.Resolve"/> on every call (AI-SEC-01),
/// so a guest cannot read another traveller's data by asking the model to. Nothing here books, pays or changes anything.
/// </summary>
public static class StanleyReadTools
{
    public static readonly IReadOnlyList<string> Names =
        ["get_guest_visible_plan", "check_plan_conflicts", "search_ship_venues", "get_venue_hours_and_menu", "calculate_package_value", "get_case_status", "get_verified_all_aboard_details", "get_route"];

    /// <summary>The tools that read a traveller, so they carry the traveller input and the permission check.</summary>
    public static readonly IReadOnlyList<string> PersonalNames = ["get_guest_visible_plan", "check_plan_conflicts", "calculate_package_value", "get_case_status"];

    /// <summary>The tool schemas as a JSON array, in the same shape as <see cref="ConciergeRules.ToolsJson"/>.</summary>
    public const string ToolsJson = """
    [
      {"name":"get_guest_visible_plan","description":"What is booked on the guest's cruise: tours, dinners and packages, by day, for the travellers the guest may see.","input_schema":{"type":"object","properties":{"traveller":{"type":"string","description":"me (default), all, or a traveller's reference or first name."},"day":{"type":"integer","minimum":1,"maximum":41}}}},
      {"name":"check_plan_conflicts","description":"Problems in what is booked: a tour that does not fit the ship's day, two tours or two dinners that overlap, and a tour that leaves too little time before dinner.","input_schema":{"type":"object","properties":{"traveller":{"type":"string","description":"me (default), all, or a traveller's reference or first name."}}}},
      {"name":"search_ship_venues","description":"Places to eat on the guest's ship, filtered. Prices are US dollars per person.","input_schema":{"type":"object","properties":{"kind":{"type":"string","description":"main, specialty or casual."},"walk_in":{"type":"boolean"},"max_cover_usd":{"type":"number"},"text":{"type":"string","description":"A word from the name or the cuisine."}}}},
      {"name":"get_venue_hours_and_menu","description":"A venue's opening hours (ship time, sea day and port day) and its menu highlights.","input_schema":{"type":"object","properties":{"venue_id":{"type":"string"}},"required":["venue_id"]}},
      {"name":"calculate_package_value","description":"What a package or add-on costs for the travellers, today's price and when it next changes, and whether the guest already has it. A cost, not a promise of savings.","input_schema":{"type":"object","properties":{"item_id":{"type":"string","enum":["drinks","wifi","specialtyPass","photo","laundry"]},"traveller":{"type":"string","description":"me (default), all, or a traveller's reference or first name."}},"required":["item_id"]}},
      {"name":"get_case_status","description":"The stage and due date of a guest's service cases (lost item, billing query, claim, complaint). Cannot say what a person decided before the stage says so.","input_schema":{"type":"object","properties":{"traveller":{"type":"string","description":"me (default), all, or a traveller's reference or first name."},"number":{"type":"string","description":"A case number, to read one case."}}}},
      {"name":"get_verified_all_aboard_details","description":"The published arrival and all-aboard times for a port day on the guest's sailing, whether guests tender ashore, and when the schedule was last checked. The ship's notice on the day has the last word.","input_schema":{"type":"object","properties":{"port":{"type":"string","enum":["cozumel","belize","roatan"]},"day":{"type":"integer","minimum":1,"maximum":41}}}},
      {"name":"get_route","description":"The way from one place on the ship to another from the ship's deck plan: where to walk and which lifts to take, with a time. Places are place ids or names from search_ship_venues, a cabin number, or \"deck N\". A closed lift bank is avoided.","input_schema":{"type":"object","properties":{"from":{"type":"string"},"to":{"type":"string"},"step_free":{"type":"boolean","description":"Use lifts only; both places must be step-free."},"closed_banks":{"type":"string","description":"Lift banks to avoid, for example \"C,D\"."}},"required":["from","to"]}}
    ]
    """;

    /// <summary>The existing concierge tools followed by the read tools, as one array for the model.</summary>
    public static string AllToolsJson(string conciergeTools)
    {
        var all = JsonNode.Parse(conciergeTools)!.AsArray();
        foreach (var t in JsonNode.Parse(ToolsJson)!.AsArray()) all.Add(t!.DeepClone());
        return all.ToJsonString();
    }

    private static ToolOutcome Ok(object data, params CitationDto[] cites) => new(JsonSerializer.Serialize(data), [.. cites], false);
    private static ToolOutcome Fail(string message) => new(JsonSerializer.Serialize(new { error = message }), [], true);
    private static string? Text(JsonObject input, string name) => input[name] is JsonValue v && v.TryGetValue<string>(out var s) && s.Length > 0 ? s : null;
    private static int? Whole(JsonObject input, string name) => input[name] is JsonValue v && v.TryGetValue<int>(out var n) ? n : null;
    private static bool? Flag(JsonObject input, string name) => input[name] is JsonValue v && v.TryGetValue<bool>(out var b) ? b : null;
    private static string Hhmm(TimeOnly? t) => t is { } v ? v.ToString("HH:mm", CultureInfo.InvariantCulture) : "";
    private static long Usd(long cents) => (long)Math.Round(cents / 100.0, MidpointRounding.AwayFromZero);
    private static string ShipId(StanleyVoyage v) => v.Ship.ToLowerInvariant().Replace(' ', '-');

    /// <summary>Runs one read tool for the packet. Unknown tools and bad input answer with an error the model can read.</summary>
    public static ToolOutcome Run(string name, JsonObject input, StanleyReadData d)
    {
        if (!d.Packet.AllowedTools.Contains(name)) return Fail($"Unknown tool {name}.");
        if (d.Packet.Voyage is not { } voyage) return Fail("No active voyage.");
        return name switch
        {
            "get_guest_visible_plan" => Plan(input, d, voyage),
            "check_plan_conflicts" => Conflicts(input, d, voyage),
            "search_ship_venues" => SearchVenues(input, voyage),
            "get_venue_hours_and_menu" => VenueHours(input, d, voyage),
            "calculate_package_value" => PackageValue(input, d, voyage),
            "get_case_status" => CaseStatus(input, d),
            "get_verified_all_aboard_details" => AllAboard(input, voyage),
            "get_route" => Route(input, voyage),
            _ => Fail($"Unknown tool {name}."),
        };
    }

    private static Timeline TimelineOf(StanleyVoyage v) => TimelineBook.For(v.SailingId, v.Departure);

    private static (HashSet<string> Refs, int Withheld, string? Problem) Readable(JsonObject input, StanleyReadData d, StanleyScope scope)
    {
        var (who, problem) = d.Packet.Resolve(Text(input, "traveller"), scope);
        if (problem is not null) return ([], 0, problem);
        var asked = Text(input, "traveller");
        var wantsAll = asked is not null && (asked.Equals("all", StringComparison.OrdinalIgnoreCase) || asked.Equals("everyone", StringComparison.OrdinalIgnoreCase));
        return ([.. who.Select(w => w.Ref)], wantsAll ? d.Packet.Travellers.Count - who.Count : 0, null);
    }

    private static List<string> FirstNames(IEnumerable<string> refs, StanleyPacket p, HashSet<string> readable) =>
        [.. refs.Where(readable.Contains).Select(r => p.Travellers.First(t => t.Ref == r).FirstName)];

    private static ToolOutcome Plan(JsonObject input, StanleyReadData d, StanleyVoyage voyage)
    {
        var (readable, withheld, problem) = Readable(input, d, StanleyScope.Plan);
        if (problem is not null) return Fail(problem);
        var day = Whole(input, "day");
        var timeline = TimelineOf(voyage);
        var items = new List<(int Day, object Item)>();
        foreach (var t in d.Tours.Where(t => t.Who.Any(readable.Contains) && (day is null || t.Day == day)))
            if (ExcursionRules.ById(t.ExcursionId) is { } e)
                items.Add((t.Day, new { day = t.Day, kind = "tour", title = e.Name, starts = e.Start, travellers = FirstNames(t.Who, d.Packet, readable), with_others = t.Who.Any(w => !readable.Contains(w)) }));
        foreach (var m in d.Meals.Where(m => m.Who.Any(readable.Contains) && (day is null || m.Day == day)))
            items.Add((m.Day, new { day = m.Day, kind = "dinner", title = DiningRules.VenueById(m.VenueId)?.Name ?? "Dinner", starts = m.Time, travellers = FirstNames(m.Who, d.Packet, readable), with_others = m.Who.Any(w => !readable.Contains(w)) }));
        var packages = d.Packages.Where(p => p.Who.Any(readable.Contains)).Select(p => new { kind = "package", title = PackageRules.NameOf(p.ItemId) ?? p.ItemId, travellers = FirstNames(p.Who, d.Packet, readable) });
        return Ok(new { days = timeline.Days.Count, items = items.OrderBy(i => i.Day).Select(i => i.Item), packages, withheld_travellers = withheld }, new CitationDto("My plan", "/plan"));
    }

    private static int Minutes(string hhmm) => int.TryParse(hhmm.AsSpan(0, 2), out var h) && int.TryParse(hhmm.AsSpan(3, 2), out var m) ? h * 60 + m : 0;

    private static ToolOutcome Conflicts(JsonObject input, StanleyReadData d, StanleyVoyage voyage)
    {
        var (readable, _, problem) = Readable(input, d, StanleyScope.Plan);
        if (problem is not null) return Fail(problem);
        var timeline = TimelineOf(voyage);
        var found = new List<object>();
        foreach (var who in readable.Order())
        {
            var name = d.Packet.Travellers.First(t => t.Ref == who).FirstName;
            var tours = d.Tours.Where(t => t.Who.Contains(who)).Select(t => (Fact: t, Ex: ExcursionRules.ById(t.ExcursionId))).Where(x => x.Ex is not null).ToList();
            var meals = d.Meals.Where(m => m.Who.Contains(who)).ToList();
            foreach (var (t, e) in tours)
            {
                var dayRow = timeline.Days.FirstOrDefault(x => x.Day == t.Day);
                if (dayRow is null) continue;
                if (ExcursionRules.TimingProblem(e!, dayRow) is { } why)
                    found.Add(new { day = t.Day, traveller = name, kind = "tourTiming", detail = $"{e!.Name} {(why == "tooEarly" ? "starts before guests can be ashore" : "ends too close to all aboard")}." });
                if (dayRow.Port != e!.Port && dayRow.Arrive is not null) found.Add(new { day = t.Day, traveller = name, kind = "wrongPort", detail = $"{e.Name} is in another port than the ship's stop that day." });
                foreach (var dinner in meals.Where(m => m.Day == t.Day))
                    if (ExcursionRules.EndMinutes(e) + 60 > Minutes(dinner.Time)) found.Add(new { day = t.Day, traveller = name, kind = "tourBeforeDinner", detail = $"{e.Name} ends less than an hour before dinner at {dinner.Time}." });
            }
            foreach (var pair in tours.SelectMany((a, i) => tours.Skip(i + 1).Select(b => (a, b))).Where(p => p.a.Fact.Day == p.b.Fact.Day && ExcursionRules.Overlaps(p.a.Ex!, p.b.Ex!)))
                found.Add(new { day = pair.a.Fact.Day, traveller = name, kind = "tourOverlap", detail = $"{pair.a.Ex!.Name} and {pair.b.Ex!.Name} overlap." });
            foreach (var pair in meals.SelectMany((a, i) => meals.Skip(i + 1).Select(b => (a, b))).Where(p => p.a.Day == p.b.Day && Math.Abs(Minutes(p.a.Time) - Minutes(p.b.Time)) < 90))
                found.Add(new { day = pair.a.Day, traveller = name, kind = "dinnerOverlap", detail = $"Two dinners within 90 minutes: {pair.a.Time} and {pair.b.Time}." });
        }
        return Ok(new { conflicts = found, none = found.Count == 0 }, new CitationDto("My plan", "/plan"));
    }

    private static ToolOutcome SearchVenues(JsonObject input, StanleyVoyage voyage)
    {
        var kind = Text(input, "kind")?.ToLowerInvariant();
        var walkIn = Flag(input, "walk_in");
        var max = input["max_cover_usd"] is JsonValue pv && pv.TryGetValue<double>(out var usd) ? usd : (double?)null;
        var text = Text(input, "text")?.ToLowerInvariant();
        var rows = ShipDining.VenuesOf(ShipId(voyage))
            .Where(v => (kind is null || v.Kind == kind) && (walkIn is null || v.WalkIn == walkIn) && (max is null || v.Cover <= Math.Round(max.Value * 100)) && (text is null || v.Name.Contains(text, StringComparison.OrdinalIgnoreCase) || v.Cuisine.Contains(text, StringComparison.OrdinalIgnoreCase)))
            .Take(12).Select(v => new { id = v.Id, name = v.Name, kind = v.Kind, deck = v.Deck, cuisine = v.Cuisine, cover_usd_per_person = Usd(v.Cover), walk_in = v.WalkIn, dress = v.Dress });
        return Ok(new { venues = rows }, new CitationDto("Dining", "/plan/dining"));
    }

    private static string Ranges(string[][] r) => r.Length == 0 ? "closed" : string.Join(", ", r.Select(x => $"{x[0]} to {x[1]}"));

    private static ToolOutcome VenueHours(JsonObject input, StanleyReadData d, StanleyVoyage voyage)
    {
        var id = Text(input, "venue_id");
        var venue = ShipDining.VenuesOf(ShipId(voyage)).FirstOrDefault(v => v.Id == id);
        if (venue is null) return Fail("Unknown venue id for this ship.");
        var queue = ShipDining.QueueOf(ShipId(voyage)).FirstOrDefault(q => q.Id == venue.Id);
        var dayNumber = DateOnly.FromDateTime(d.Now).DayNumber - voyage.Departure.DayNumber + 1;
        var today = TimelineOf(voyage).Days.FirstOrDefault(x => x.Day == dayNumber);
        return Ok(new
        {
            name = venue.Name, deck = venue.Deck, kind = venue.Kind, cuisine = venue.Cuisine, menu = venue.Menu, dress = venue.Dress,
            hours_sea_day = queue is null ? null : Ranges(queue.Sea), hours_port_day = queue is null ? null : Ranges(queue.Port),
            hours_today = queue is null || today is null ? null : Ranges(today.Port == "sea" ? queue.Sea : queue.Port),
            takes_reservations = queue is null, reservation_times = queue is null ? new[] { DiningRules.DinnerTimes[0], DiningRules.DinnerTimes[^1] } : null,
            note = "Ship time. The ship's daily programme has the last word.",
        }, new CitationDto(venue.Name, "/plan/dining"));
    }

    private static ToolOutcome PackageValue(JsonObject input, StanleyReadData d, StanleyVoyage voyage)
    {
        var (readable, _, problem) = Readable(input, d, StanleyScope.Plan);
        if (problem is not null) return Fail(problem);
        var add = PackageRules.AddOn(Text(input, "item_id"));
        if (add is null) return Fail("Unknown item id.");
        var travellers = d.Packet.Travellers.Where(t => readable.Contains(t.Ref)).ToList();
        var eligible = travellers.Where(t => t.Age >= add.MinAge).ToList();
        var daysToDeparture = voyage.Departure.DayNumber - DateOnly.FromDateTime(d.Now).DayNumber;
        var unit = PackageRules.AddOnPrice(add, daysToDeparture);
        var units = PackageRules.Units(add.Unit, eligible.Count, voyage.Nights);
        var have = d.Packages.Where(p => p.ItemId == add.Id).SelectMany(p => p.Who).Where(readable.Contains).Distinct().ToList();
        var rises = add.ChangeShare != 0 && daysToDeparture >= add.ChangeAtDays;
        return Ok(new
        {
            item = PackageRules.NameOf(add.Id) ?? add.Id, priced_per = add.Unit, usd_per_unit_today = Usd(unit), units, usd_total = Usd(unit * units),
            minimum_age = add.MinAge, too_young = travellers.Where(t => t.Age < add.MinAge).Select(t => t.FirstName),
            already_has = d.Packet.Travellers.Where(t => have.Contains(t.Ref)).Select(t => t.FirstName),
            price_changes_on = rises ? PackageRules.ChangeOn(voyage.Departure, add.ChangeAtDays, add.ChangeShare) : null,
            note = "A cost for the travellers, not a promise of savings. Use is not known here.",
        }, new CitationDto("Packages", "/me/packages"));
    }

    private static ToolOutcome CaseStatus(JsonObject input, StanleyReadData d)
    {
        var (readable, withheld, problem) = Readable(input, d, StanleyScope.Cases);
        if (problem is not null) return Fail(problem);
        var number = Text(input, "number");
        var rows = d.Cases.Where(c => readable.Contains(c.Owner) && (number is null || c.Number.Equals(number, StringComparison.OrdinalIgnoreCase)))
            .Select(c => new { number = c.Number, kind = c.Kind, stage = c.Stage, outcome = c.Outcome, due = c.DueAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), traveller = d.Packet.Travellers.First(t => t.Ref == c.Owner).FirstName });
        return Ok(new { cases = rows, withheld_travellers = withheld, note = "Only the stage is known here. A person decides the outcome." }, new CitationDto("Cases", "/me/cases"));
    }

    private static ToolOutcome AllAboard(JsonObject input, StanleyVoyage voyage)
    {
        var port = Text(input, "port");
        var day = Whole(input, "day");
        var stops = TimelineOf(voyage).Days.Where(x => x.Arrive is not null && (port is null || x.Port == port) && (day is null || x.Day == day)).ToList();
        if (stops.Count == 0) return Fail("No port day matches.");
        return Ok(new
        {
            stops = stops.Select(x => new
            {
                day = x.Day, date = x.Date.ToString("yyyy-MM-dd"), port = Itinerary.PortOf(x.Port)?.Name ?? x.Port, arrives = Hhmm(x.Arrive), all_aboard = Hhmm(x.AllAboard),
                tender = Itinerary.PortOf(x.Port)?.Tender ?? false,
            }),
            published = StanleyResolvers.PublishedAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), provisional = true,
            note = "Published schedule, in ship time. The ship's notice on the day has the last word. Never tell a guest it is safe to be later.",
        }, new CitationDto("Itinerary", $"/home/sailings/{voyage.SailingId}"));
    }

    // ---- the deck graph --------------------------------------------------------------------------------------------------------------

    private static readonly Regex DeckWord = new(@"deck\s*(\d{1,2})(?:\s*(forward|midship|aft))?", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>A place on the deck graph: the deck number and the end of the ship (forward, midship or aft; midship when unknown).</summary>
    public sealed record Spot(string Name, int Deck, string End);

    public static Spot? SpotOf(string? place, string shipId)
    {
        if (place is null) return null;
        var venue = ShipDining.VenuesOf(shipId).FirstOrDefault(v => v.Id == place || v.Name.Equals(place, StringComparison.OrdinalIgnoreCase));
        var text = venue?.Deck ?? place;
        return DeckWord.Match(text) is { Success: true } m ? new Spot(venue?.Name ?? $"Deck {m.Groups[1].Value}", int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture), m.Groups[2].Success ? m.Groups[2].Value.ToLowerInvariant() : "midship") : null;
    }

    /// <summary>The steps between two spots: walk to the lifts at the end of the ship, change decks, walk on. An outline from published decks, not a plan of corridors.</summary>
    public static List<string> RouteBetween(Spot a, Spot b, bool stepFree)
    {
        var steps = new List<string>();
        if (a.Deck == b.Deck)
        {
            steps.Add(a.End == b.End ? $"{b.Name} is on the same deck, at the same end of the ship ({a.End}). Walk along deck {a.Deck}." : $"{b.Name} is on the same deck. Walk along deck {a.Deck} from {a.End} to {b.End}.");
            return steps;
        }
        var up = b.Deck > a.Deck;
        steps.Add($"From {a.Name} (deck {a.Deck}, {a.End}) go to the nearest lifts{(stepFree ? "" : " or stairs")}.");
        steps.Add($"Go {(up ? "up" : "down")} {Math.Abs(b.Deck - a.Deck)} {(Math.Abs(b.Deck - a.Deck) == 1 ? "deck" : "decks")}, to deck {b.Deck}.");
        steps.Add($"{b.Name} is at the {b.End} end of deck {b.Deck}{(a.End == b.End || b.End == "midship" ? "" : $"; walk {(b.End == "forward" ? "towards the bow" : "towards the stern")}")}.");
        return steps;
    }

    private static ToolOutcome Route(JsonObject input, StanleyVoyage voyage)
    {
        var plan = AboardPlans.For(ShipId(voyage)) ?? AboardPlans.For("sun-princess")!;
        var from = ShipRoute.Locate(Text(input, "from"), plan);
        var to = ShipRoute.Locate(Text(input, "to"), plan);
        if (from is null || to is null) return Fail("Unknown place. Use a venue or place id from search_ship_venues, a cabin number, or \"deck N\".");
        var closed = (Text(input, "closed_banks") ?? "").Split([',', ' '], StringSplitOptions.RemoveEmptyEntries).Select(b => b.ToUpperInvariant()).Where(b => plan.Elevators.Any(e => e.Bank == b)).ToHashSet();
        var way = ShipRoute.Between(from, to, plan, Flag(input, "step_free") == true, closed);
        return way.Problem switch
        {
            "same" => Fail("Those are the same place."),
            "notStepFree" => Fail($"One of those places is not step-free.{(way.Instead is null ? "" : $" {way.Instead} is a step-free alternative.")}"),
            "noWay" => Fail("There is no way between those places with the lifts that are closed."),
            null => Ok(new { from = from.Name, to = to.Name, steps = way.Steps, minutes = way.Minutes, step_free = way.StepFree, rerouted = way.Rerouted, note = "From the ship's deck plan: halls and lifts. Signs and crew on board are the last word." }, new CitationDto("Ship map", "/ship/map")),
            _ => Fail("Unknown place."),
        };
    }
}
