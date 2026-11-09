using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Princess.Api.Data;

namespace Princess.Api.Domain;

public sealed record ConciergeMessageDto(string Role, string Text, long At);

public sealed record CitationDto(string Label, string Path);

/// <summary><c>Source</c> is claude, scripted or handoff; <c>Handoff</c> names the kind of person needed; <c>Fallback</c> says why a model was not used (auth, rate, network, bad, limit).</summary>
public sealed record ConciergeReplyDto(string Text, List<CitationDto> Citations, string Source, string? Handoff, string? Fallback);

public sealed record PartyMember(string Name, int Age);

/// <summary>Who is asking and what the concierge may know: the guest's own booking (first names only), the bookable sailings and the device's preferences.</summary>
public sealed record ConciergeContext(
    DateTime Now, string? SailingId, DateOnly? Departure, string? Ship, string? Stateroom, string? GuestFirstName, IReadOnlyList<PartyMember> Party,
    IReadOnlyList<SailingRow> Sailings, string Mobility, IReadOnlyList<string> Likes, IReadOnlyList<string>? Preferences = null);

public sealed record ToolOutcome(string Content, List<CitationDto> Citations, bool IsError = false);

/// <summary>
/// The AI concierge's rules (requirements §22.2), ported from <c>src/ai/*.ts</c> when the model moved behind the server: the guard that keeps emergencies away
/// from any model, the tools (the only facts the concierge may use), the scripted answers used when no model is available, and the instructions.
/// Nothing here books, pays or changes anything.
/// </summary>
public static class ConciergeRules
{
    public const int MaxMessage = 500, MaxContext = 12, MaxHistory = 60, MaxTurns = 5;

    private static readonly Regex Emergency = new(@"\b(fire|smoke|overboard|drown\w*|can'?t breathe|cannot breathe|not breathing|chest pain|heart attack|stroke|unconscious|bleeding|overdose|seizure|choking|collapsed|assault\w*|attack\w*|missing child|lost child|(child|kid|baby|son|daughter|toddler|boy|girl) (is |has gone |went )?(missing|lost)|suicid\w*|help me now|emergency(?! (muster|drill|exit|station|procedure|plan|instruction)))\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Medical = new(@"\b(medic\w*|dose|dosage|prescription|doctor|diagnos\w*|symptom\w*|pregnan\w*|allerg\w* (reaction|shock)|infection|rash|fever|vomit\w*|norovirus|covid|seasick\w*|is it safe to (take|drink|eat))\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Legal = new(@"\b(lawyer|attorney|sue|lawsuit|legal advice|liability|liable|compensation claim|injur\w+ claim|insurance claim|contract dispute)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Person = new(@"\b(talk to (a )?(person|human|agent|someone)|speak to (a )?(person|human|agent|someone)|real person|human agent|guest services|customer service|supervisor|manager)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>Which kind of handoff a message needs (emergency, medical, legal, person), or null when the concierge may answer. Emergency wins over the rest.</summary>
    public static string? Screen(string message) =>
        Emergency.IsMatch(message) ? "emergency" : Medical.IsMatch(message) ? "medical" : Legal.IsMatch(message) ? "legal" : Person.IsMatch(message) ? "person" : null;

    /// <summary>The last <see cref="MaxContext"/> messages, or null when the thread is not one the concierge can answer (empty, not ending with the guest, bad roles, too long).</summary>
    public static List<ConciergeMessageDto>? Usable(List<ConciergeMessageDto>? history)
    {
        if (history is not { Count: > 0 and <= MaxHistory }) return null;
        if (history.Any(m => m is null || (m.Role != "user" && m.Role != "assistant") || m.Text is null || m.Text.Length > 4_000)) return null;
        var last = history[^1];
        if (last.Role != "user" || last.Text.Trim().Length is 0 or > MaxMessage) return null;
        return [.. history.TakeLast(MaxContext)];
    }

    /// <summary>The longest instruction set the model is given. Grounding and handoff rules live here as well as in <see cref="Screen"/>.</summary>
    public static string SystemPrompt(ConciergeContext ctx) => string.Join('\n',
        "You are the concierge in a concept app for a Princess-style cruise. You are an AI, not a person, and you say so if asked.",
        $"The guest is {ctx.GuestFirstName ?? "a guest"}. Today in the app is {ctx.Now:yyyy-MM-dd}.",
        "Answer only from the tools. If the tools do not hold a fact, say you do not know and point to Guest Services. Never invent prices, times or availability.",
        "The app has one cruise: 7 nights, Western Caribbean, Sun Princess from Fort Lauderdale. If asked about anything else, say so plainly.",
        "You cannot book, pay, cancel or change anything. When the guest wants to book, send them to the booking steps.",
        "Do not give medical, legal or safety advice. For those, and for emergencies, tell the guest to call Guest Services (the 24-hour number is on the Contact screen) or, on board, to use the Help button.",
        "Be brief and plain: short sentences, no markdown headings, bullet points with \"•\" at most. Prices are US dollars.");

    // ---- tools -------------------------------------------------------------------------------------------------------------------------

    private static readonly string[] Interests = ["water", "nature", "culture", "relax", "adventure"];
    private static readonly string[] Ports = ["cozumel", "belize", "roatan"];

    /// <summary>The tool schemas, as the model API takes them. A string so each request parses its own copy (a JSON node cannot have two parents).</summary>
    public const string ToolsJson = """
    [
      {"name":"list_sailings","description":"The departures that can be booked, with the lowest all-in price per person (two sharing). This app has one 7-night Western Caribbean cruise on Sun Princess from Fort Lauderdale; there are no other destinations.","input_schema":{"type":"object","properties":{"month":{"type":"string","description":"Optional \"YYYY-MM\" to list only that month."}}}},
      {"name":"get_itinerary","description":"The day-by-day itinerary of a departure: port, arrival, all-aboard time.","input_schema":{"type":"object","properties":{"sailing_id":{"type":"string","description":"A sailing id from list_sailings; defaults to the guest's own cruise."}}}},
      {"name":"get_port","description":"A port: whether guests tender ashore, the ship's arrival and all-aboard times, and the shore excursions on offer.","input_schema":{"type":"object","properties":{"port":{"type":"string","enum":["fll","cozumel","belize","roatan"]}},"required":["port"]}},
      {"name":"search_excursions","description":"Shore excursions, filtered. Prices are per adult in US dollars.","input_schema":{"type":"object","properties":{"port":{"type":"string","enum":["cozumel","belize","roatan"]},"interests":{"type":"array","items":{"type":"string","enum":["water","nature","culture","relax","adventure"]}},"max_activity":{"type":"string","enum":["easy","moderate","strenuous"]},"max_price_usd":{"type":"number"},"family":{"type":"boolean","description":"Only tours suitable for children."},"wheelchair":{"type":"boolean","description":"Only tours a wheelchair user can join."}}}},
      {"name":"list_restaurants","description":"Dining venues on the ship with cuisine, cover charge and dress code.","input_schema":{"type":"object","properties":{}}},
      {"name":"build_day","description":"A suggested plan for one day of the cruise (1 to the last day): a tour that fits the ship's day, and dinner.","input_schema":{"type":"object","properties":{"day":{"type":"integer","minimum":1,"maximum":41},"tour_interests":{"type":"array","items":{"type":"string","enum":["water","nature","culture","relax","adventure"]}},"mobility":{"type":"string","enum":["any","easy","wheelchair"]},"with_children":{"type":"boolean"}},"required":["day"]}},
      {"name":"my_trip","description":"The signed-in guest's own cruise: who is in the party, the departure and stateroom type.","input_schema":{"type":"object","properties":{}}}
    ]
    """;

    public static readonly IReadOnlyList<string> ToolNames = ["list_sailings", "get_itinerary", "get_port", "search_excursions", "list_restaurants", "build_day", "my_trip"];

    private static long Usd(long cents) => (long)Math.Round(cents / 100.0, MidpointRounding.AwayFromZero);
    private static string Date(DateTime d) => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    private static string Hhmm(TimeOnly? t) => t is { } v ? v.ToString("HH:mm", CultureInfo.InvariantCulture) : "";
    private static string? Text(JsonObject input, string name) => input[name] is JsonValue v && v.TryGetValue<string>(out var s) && s.Length > 0 ? s : null;
    private static bool Flag(JsonObject input, string name) => input[name] is JsonValue v && v.TryGetValue<bool>(out var b) && b;
    private static List<string> Strings(JsonObject input, string name, string[] allowed) =>
        input[name] is JsonArray a ? [.. a.Select(x => x is JsonValue v && v.TryGetValue<string>(out var s) ? s : "").Where(s => allowed.Contains(s)).Distinct()] : [];

    private static ToolOutcome Ok(object data, params CitationDto[] cites) => new(JsonSerializer.Serialize(data), [.. cites]);
    private static ToolOutcome Fail(string message) => new(JsonSerializer.Serialize(new { error = message }), [], true);

    /// <summary>Runs one tool. Unknown tools and bad input answer with an error the model can read, never a throw.</summary>
    public static ToolOutcome RunTool(string name, JsonObject input, ConciergeContext ctx)
    {
        switch (name)
        {
            case "list_sailings":
            {
                var month = Text(input, "month");
                var rows = ctx.Sailings.Where(s => month is null || Date(s.Departure).StartsWith(month, StringComparison.Ordinal))
                    .Select(s => new { id = s.Id, departs = Date(s.Departure), nights = s.Nights, ship = "Sun Princess", holiday = s.IsHoliday, from_usd_per_person = Usd(Pricing.FromPriceOf(s.Id)?.AllIn ?? 0) }).ToList();
                CitationDto[] cites = rows.Count is > 0 and <= 3 ? [.. rows.Select(r => new CitationDto(r.departs, $"/home/sailings/{r.id}"))] : [new CitationDto("Sailings and prices", "/home/sailings")];
                return Ok(new { sailings = rows }, cites);
            }
            case "get_itinerary":
            {
                var id = Text(input, "sailing_id") ?? ctx.SailingId;
                var departure = ctx.Sailings.FirstOrDefault(s => s.Id == id) is { } row ? DateOnly.FromDateTime(row.Departure) : id == ctx.SailingId ? ctx.Departure : null;
                if (id is null || departure is not { } dep) return Fail("Unknown sailing id.");
                var timeline = TimelineBook.For(id, dep);
                var days = timeline.Days.Select(d => new
                {
                    day = d.Day, date = d.Date.ToString("yyyy-MM-dd"), place = (Itinerary.PortOf(d.Port) is { } p) ? p.Name : "At sea",
                    arrives = d.Arrive is null ? null : Hhmm(d.Arrive), all_aboard = d.AllAboard is null ? null : Hhmm(d.AllAboard), tender = (Itinerary.PortOf(d.Port) is { } q) && q.Tender,
                });
                return Ok(new { departs = dep.ToString("yyyy-MM-dd"), days }, new CitationDto($"Itinerary, {dep:yyyy-MM-dd}", $"/home/sailings/{id}"));
            }
            case "get_port":
            {
                var id = Text(input, "port");
                if (id is null || !(Itinerary.PortOf(id) is { } port)) return Fail("Unknown port.");
                var tours = ExcursionRules.Catalogue.Where(x => x.Port == id).Select(x => new { id = x.Id, name = x.Name, hours = x.Hours, usd_per_adult = Usd(x.Price) });
                var stop = ctx.Departure is { } dep ? TimelineBook.For(ctx.SailingId, dep).Days.FirstOrDefault(d => d.Port == id && d.Arrive is not null) : null;
                return Ok(new { name = port.Name, tender = port.Tender, arrives = stop is null ? null : Hhmm(stop.Arrive), all_aboard = stop is null ? null : Hhmm(stop.AllAboard), excursions = tours }, new CitationDto(port.Name, $"/home/ports/{id}"));
            }
            case "search_excursions":
            {
                var interests = Strings(input, "interests", Interests);
                var maxActivity = Text(input, "max_activity");
                var order = new[] { "easy", "moderate", "strenuous" };
                var port = Text(input, "port") is { } p && Ports.Contains(p) ? p : null;
                var price = input["max_price_usd"] is JsonValue pv && pv.TryGetValue<double>(out var usd) ? usd : (double?)null;
                var found = ExcursionRules.Catalogue.Where(x =>
                    (port is null || x.Port == port)
                    && (interests.Count == 0 || x.Interests.Any(interests.Contains))
                    && (maxActivity is null || Array.IndexOf(order, x.Activity) <= Array.IndexOf(order, maxActivity))
                    && (price is null || x.Price <= Math.Round(price.Value * 100))
                    && (!Flag(input, "family") || x.Family)
                    && (!Flag(input, "wheelchair") || x.Wheelchair))
                    .OrderByDescending(x => x.Rating)
                    .Select(x => new { id = x.Id, name = x.Name, port = x.Port, hours = x.Hours, usd_per_adult = Usd(x.Price), activity = x.Activity, rating = x.Rating, starts = x.Start, wheelchair = x.Wheelchair, family = x.Family });
                return Ok(new { excursions = found }, new CitationDto("Shore excursions", "/plan/excursions"));
            }
            case "list_restaurants":
                return Ok(new { restaurants = ShipDining.VenuesOf(ctx.SailingId is null ? null : AboardPlans.ShipOfSailing(ctx.SailingId)).Select(v => new { id = v.Id, name = v.Name, kind = v.Kind, cover_usd_per_person = Usd(v.Cover), walk_in = v.WalkIn }) }, new CitationDto("Dining", "/plan/dining"));
            case "build_day":
                return BuildDay(input, ctx);
            case "my_trip":
                if (ctx.Departure is not { } departs) return Fail("No booking.");
                return Ok(new { guest = ctx.GuestFirstName, party = ctx.Party.Select(p => new { name = p.Name, age = p.Age }), departs = departs.ToString("yyyy-MM-dd"), ship = ctx.Ship ?? "Sun Princess", stateroom = ctx.Stateroom }, new CitationDto("My trips", "/me/trips"));
            default:
                return Fail($"Unknown tool {name}.");
        }
    }

    /// <summary>One day: on a port day the best-rated tour that fits the ship's day and the guest's wishes, then dinner (none on the last morning).</summary>
    private static ToolOutcome BuildDay(JsonObject input, ConciergeContext ctx)
    {
        if (ctx.Departure is not { } dep || input["day"] is not JsonValue dv || !dv.TryGetValue<int>(out var n) || n < 1) return Fail("day must be a whole number from 1.");
        var timeline = TimelineBook.For(ctx.SailingId, dep);
        if (n > timeline.Days.Count) return Fail($"day must be a whole number from 1 to {timeline.Days.Count}.");
        var day = timeline.Days.First(d => d.Day == n);
        var wanted = Strings(input, "tour_interests", Interests);
        var mobility = Text(input, "mobility") is "easy" or "wheelchair" ? Text(input, "mobility")! : ctx.Mobility;
        var kids = Flag(input, "with_children");
        var items = new List<object>();
        string? backBy = null;
        if (day.Arrive is not null)
        {
            var tour = ExcursionRules.Catalogue.Where(x => x.Port == day.Port && ExcursionRules.TimingProblem(x, day) is null
                    && (wanted.Count == 0 || x.Interests.Any(wanted.Contains)) && (mobility != "wheelchair" || x.Wheelchair) && (mobility != "easy" || x.Activity == "easy") && (!kids || x.Family))
                .OrderByDescending(x => x.Rating).FirstOrDefault();
            if (tour is not null)
            {
                items.Add(new { kind = "tour", title = tour.Name, starts = tour.Start, why = $"Rated {tour.Rating}; fits the ship's day." });
                backBy = ExcursionRules.BackBy(tour, day);
            }
        }
        if (n < timeline.Days.Count) items.Add(new { kind = "dinner", title = "Dinner in the Eclipse Dining Room", starts = "18:00", why = "Included with your fare." });
        return Ok(new { day = n, items, back_on_ship_by = backBy }, new CitationDto("Build my day", "/plan/day"));
    }

    // ---- scripted answers --------------------------------------------------------------------------------------------------------------

    private static readonly (string Id, Regex Re)[] PortWords =
    [
        ("cozumel", new Regex("cozumel|mexico", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
        ("belize", new Regex("belize", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
        ("roatan", new Regex("roat[aá]n|honduras", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
    ];

    private static readonly Dictionary<string, string> InterestWords = new()
    {
        ["snorkel"] = "water", ["swim"] = "water", ["beach"] = "relax", ["relax"] = "relax", ["ruins"] = "culture", ["history"] = "culture", ["mayan"] = "culture",
        ["culture"] = "culture", ["wildlife"] = "nature", ["nature"] = "nature", ["jungle"] = "nature", ["adventure"] = "adventure", ["zip"] = "adventure", ["cave"] = "adventure",
    };

    private static string Money(long usd) => "$" + usd.ToString("N0", CultureInfo.InvariantCulture);
    private static JsonObject Read(string tool, JsonObject input, ConciergeContext ctx, out List<CitationDto> cites)
    {
        var r = RunTool(tool, input, ctx);
        cites = r.Citations;
        return JsonNode.Parse(r.Content)!.AsObject();
    }

    private static ConciergeReplyDto Scripted(string text, List<CitationDto>? cites = null) => new(text, cites ?? [], "scripted", null, null);

    /// <summary>An answer for the guest's message, always grounded on the same tools the model uses. Questions it cannot place get an honest "I can't" and where to go.</summary>
    public static ConciergeReplyDto ScriptedReply(string message, ConciergeContext ctx)
    {
        var m = message.ToLowerInvariant();
        var port = PortWords.FirstOrDefault(p => p.Re.IsMatch(m)).Id;
        var interests = new JsonArray([.. InterestWords.Where(w => m.Contains(w.Key)).Select(w => w.Value).Distinct().Select(v => (JsonNode)JsonValue.Create(v)!)]);
        var kids = Regex.IsMatch(m, "kid|child|toddler|family");

        var dayNo = Regex.Match(m, @"\bday (\d)\b").Groups[1].Value;
        if (Regex.IsMatch(m, "plan my day|build my day|what should i do|day plan|itinerary for") || (dayNo.Length > 0 && Regex.IsMatch(m, "plan|do|suggest")))
        {
            var day = dayNo.Length > 0 ? int.Parse(dayNo, CultureInfo.InvariantCulture) : port switch { "cozumel" => 3, "belize" => 4, "roatan" => 5, _ => 2 };
            var data = Read("build_day", new JsonObject { ["day"] = day, ["tour_interests"] = interests, ["with_children"] = kids, ["mobility"] = m.Contains("wheelchair") ? "wheelchair" : Regex.IsMatch(m, "easy|mobility") ? "easy" : ctx.Mobility }, ctx, out var cites);
            var items = data["items"] as JsonArray;
            if (items is null || items.Count == 0) return Scripted($"I could not find a day to suggest for day {day}. Try Build my day in the Plan tab.", cites);
            var back = data["back_on_ship_by"] is JsonValue b ? $" Be back on the ship by {b}." : "";
            var basis = ctx.Likes.Count > 0 ? $"\nBased on what you told us: {string.Join("; ", ctx.Likes.Take(3)).ToLowerInvariant()}. You can change this under Taste profile." : "";
            return Scripted($"Here is a day for day {day}:\n{string.Join("\n", items.Select(i => $"• {i!["starts"]} {i["title"]} ({i["why"]})"))}{back}{basis}", cites);
        }
        if (Regex.IsMatch(m, "alaska|europe|mediterranean|hawaii|pacific|asia|transatlantic"))
            return Scripted("This app covers one cruise: seven nights in the Western Caribbean on Sun Princess from Fort Lauderdale, so I cannot plan other destinations here. I can show the dates and prices for this one.", [new("Sailings and prices", "/home/sailings")]);
        if (Regex.IsMatch(m, "book (it|this|me)|reserve|buy|pay for|purchase"))
            return Scripted("I cannot book or take payment in this chat. Choose a date and I will take you to the booking steps, where you confirm everything before anything is charged.", [new("Book this cruise", "/book")]);
        if (Regex.IsMatch(m, "excursion|tour|snorkel|ruins|zip|cave|things to do|activit") || (port is not null && Regex.IsMatch(m, "do|see")))
        {
            var input = new JsonObject { ["interests"] = interests, ["family"] = kids, ["wheelchair"] = m.Contains("wheelchair") };
            if (port is not null) input["port"] = port;
            if (Regex.IsMatch(m, "easy|gentle|relax")) input["max_activity"] = "easy";
            var rows = Read("search_excursions", input, ctx, out var cites)["excursions"]!.AsArray().Take(4).ToList();
            if (rows.Count == 0) return Scripted("No excursion matches all of that. Try fewer filters on the Excursions screen.", cites);
            return Scripted($"These shore excursions fit:\n{string.Join("\n", rows.Select(r => $"• {r!["name"]}, {r["hours"]} hours, {Money(r["usd_per_adult"]!.GetValue<long>())} per adult, rated {r["rating"]}"))}", cites);
        }
        if (port is not null || Regex.IsMatch(m, "port|stop|where does"))
        {
            if (port is not null)
            {
                var data = Read("get_port", new JsonObject { ["port"] = port }, ctx, out var cites);
                var ashore = data["tender"]!.GetValue<bool>() ? "Guests go ashore by tender boat." : "The ship docks at the pier.";
                return Scripted($"{data["name"]}: {ashore} {(data["arrives"] is JsonValue a ? $"The ship arrives at {a}, all aboard by {data["all_aboard"]}." : "")}".TrimEnd(), cites);
            }
            var it = Read("get_itinerary", new JsonObject(), ctx, out var ic);
            if (it.ContainsKey("error")) return Scripted("Sign in to see your trip, or ask for the dates and prices.");
            return Scripted($"Your week: {string.Join(", ", it["days"]!.AsArray().Select(d => $"day {d!["day"]} {d["place"]}"))}.", ic);
        }
        if (Regex.IsMatch(m, "dinner|restaurant|dining|eat|steak|italian|seafood"))
        {
            var rows = Read("list_restaurants", new JsonObject(), ctx, out var cites)["restaurants"]!.AsArray();
            return Scripted($"You can eat at:\n{string.Join("\n", rows.Select(r => $"• {r!["name"]}{(r["cover_usd_per_person"]!.GetValue<long>() > 0 ? $", {Money(r["cover_usd_per_person"]!.GetValue<long>())} cover" : ", included")}"))}", cites);
        }
        if (Regex.IsMatch(m, @"price|cost|cheap|date|when|sail|depart|how much|budget|\bjune\b|\bmarch\b|\bjan"))
        {
            var input = new JsonObject();
            var month = Regex.Match(m, @"20\d\d-\d\d");
            if (month.Success) input["month"] = month.Value;
            var rows = Read("list_sailings", input, ctx, out var cites)["sailings"]!.AsArray();
            return Scripted($"Seven-night departures from Fort Lauderdale:\n{string.Join("\n", rows.Select(r => $"• {r!["departs"]}, from {Money(r["from_usd_per_person"]!.GetValue<long>())} per person (two sharing, with taxes, fees and gratuities)"))}", cites);
        }
        if (Regex.IsMatch(m, "my trip|my cruise|who is|my booking|party"))
        {
            var data = Read("my_trip", new JsonObject(), ctx, out var cites);
            if (data.ContainsKey("error")) return Scripted("Sign in to see your trip.", cites);
            return Scripted($"You are sailing on {data["departs"]} aboard Sun Princess with {string.Join(", ", data["party"]!.AsArray().Select(p => p!["name"]!.GetValue<string>()))}.", cites);
        }
        return Scripted("I can help with dates and prices, the itinerary, ports, shore excursions, dining and a plan for a day. For anything else, I can pass you to a person.");
    }
}
