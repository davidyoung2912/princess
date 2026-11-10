using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Princess.Api.Services;

namespace Princess.Api.Domain;

// ---- Requests ----

public sealed record TravelTrafficRequest(string? SailingId, string? Crowd);
public sealed record TravelPortRequest(string? SailingId, int Day, List<string>? Interests, string? Mode, int? Minutes, string? Distance, string? Mobility);
public sealed record TravelPhraseRequest(string? SailingId, int Day, string? Query);
public sealed record TravelPackRequest(string? SailingId, int Day);
public sealed record TravelReadRequest(string? SailingId, int Day, string? Image, string? ContentType);
public sealed record TravelConnectionRequest(string? SailingId, string? Kind, string? DepartAt, string? Mode, string? OffOption);
public sealed record TravelEmbarkRequest(string? SailingId, List<string>? Goals, string? Mobility);

// ---- Answers. Every time names its clock; every fact names where it came from and when. ----

/// <summary>A replanned onward flight. <see cref="State"/> is <c>ok</c> (a flight was checked), <c>noPlan</c> (no flight saved) or <c>unknown</c> (the provider had no answer).</summary>
public sealed record TravelAlternative(string OffOption, string Mode, string OffAt, string LeaveBy, int Spare, string Text);

public sealed record TravelFlightDto(
    string State, string? Flight, string Status, int DelayMinutes, string Provider, long AsOf, string Confidence, string? FlightAt, string? NewFlightAt, string Clock,
    string Verdict, int? Spare, string? LeaveBy, string? OffAt, IReadOnlyList<TravelAlternative> Alternatives, string Message, IReadOnlyList<string> Notes);

public sealed record TravelTrafficDto(string Traffic, string Sky, int LeaveEarlierMinutes, string Provider, long AsOf, string Confidence, string Message, IReadOnlyList<string> Notes);

public sealed record TravelStop(string Id, string Kind, string Title, string Start, string End, string Mode, int TravelMinutes, string Cost, long Cents, string Opens, string Closes, string Hours, string Why);

public sealed record TravelReturn(string BackBy, string AllAboard, int BufferMinutes, string Clock, string LeaveLastStopBy, string Text);

public sealed record TravelPortDto(string Port, string PortName, int Day, string Clock, string AshoreFrom, IReadOnlyList<TravelStop> Stops, TravelReturn Return, IReadOnlyList<string> Notes, bool Complete);

public sealed record TravelPhrase(string Id, string Say, string Means, string Sounds, string Label, string Language, string? Confidence = null);

public sealed record TravelPersonCard(string Text, string Language, string Label);

public sealed record TravelPhrasesDto(string Port, string Language, IReadOnlyList<TravelPhrase> Phrases, TravelPersonCard? ShowPerson, string Note);

public sealed record TravelLink(string Label, string Url);

public sealed record TravelEntrySource(string Jurisdiction, string Authority, string Role, IReadOnlyList<TravelLink> Links, string Note);

public sealed record TravelEntryDto(IReadOnlyList<TravelEntrySource> Sources, string ReviewedOn, string Note, bool ModelAnswers);

public sealed record TravelPortPackDto(string Version, string Port, string PortName, int Day, string Clock, string? AllAboard, string? BackBy, bool Tender, IReadOnlyList<string> Contacts, TravelPersonCard? TakeMeBack, IReadOnlyList<TravelPhrase> Phrases, IReadOnlyList<string> Notes, IReadOnlyList<string> Laws, string Basis);

public sealed record TravelEmbarkStep(string PlaceId, string Name, int Deck, string Section, string Goal, string Why, int WalkFromPrevious, bool StepFree, string? Note);

public sealed record TravelEmbarkDto(IReadOnlyList<string> Goals, IReadOnlyList<TravelEmbarkStep> Steps, IReadOnlyList<string> Notes);

public sealed record TravelReadLine(string Original, string English, string Confidence);

/// <summary><see cref="State"/> is read, unclear (too uncertain to rely on) or refused (a document: never read).</summary>
public sealed record TravelReadingDto(string State, string Kind, IReadOnlyList<TravelReadLine> Lines, string Label, string Note, IReadOnlyList<string> Cautions);

public sealed record TravelConnectionDto(string Kind, string DepartAt, string Clock, int BufferMinutes, string Verdict, int Spare, string LeaveBy, string OffAt, string EarliestDeparture, string Message, IReadOnlyList<string> Notes);

public sealed record TravelPackDto(IReadOnlyList<PackItem> Extras, string Basis);

/// <summary>
/// Stanley's travel-day, port and onward-travel rules (docs/stanley-gap-analysis-and-plan.md, phase 10). Nothing here comes from a model: flight and traffic come from provider answers handed in, the port plan from the
/// authored port reference, the entry answers from a list of official sources. Times are minutes in the clock the answer names (the port's, the airport's or the ship's). Framework-free, so it is tested in node-free C#.
/// </summary>
public static class StanleyTravelRules
{
    public const string FlightProvider = "Flight status feed";
    public const string TrafficProvider = "Traffic and weather feed";
    public const string ReviewedOn = "2026-11-09";
    public const int MinBudget = 60;
    public const int MaxBudget = 720;
    public const string PortClock = "port time";
    public const string AirportClock = "airport time (the port's clock on the last morning)";

    public static readonly IReadOnlyList<string> Interests = ["culture", "nature", "beach", "shopping", "quiet", "family", "food"];
    public static readonly IReadOnlyList<string> Goals = ["essentials", "family", "dining", "quiet", "access"];
    public static readonly IReadOnlyList<string> Modes = ["walk", "taxi"];

    private static string Hm(int minutes) => $"{Math.Clamp(minutes, 0, 1439) / 60:00}:{Math.Clamp(minutes, 0, 1439) % 60:00}";
    private static int Min(TimeOnly t) => t.Hour * 60 + t.Minute;
    private static int Min(string hhmm) => Min(TimeOnly.ParseExact(hhmm, "HH:mm", CultureInfo.InvariantCulture));

    private static bool TimeText(string? s) => s is { Length: 5 } && s[2] == ':' && TimeOnly.TryParseExact(s, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);

    // ---- Flight replan ----

    /// <summary>
    /// The onward flight rechecked against a provider answer. <paramref name="status"/> is null when the provider could not answer (the guest sees that, not a guess). A delayed flight moves the check to its new time and, when
    /// there is slack, offers the later ways off the ship that still work; a cancelled flight is not rebooked here (the airline does that), only the message draft is given. Nothing is booked, moved or sent.
    /// </summary>
    public static TravelFlightDto Flight(Timeline timeline, OnwardPlan plan, string optionId, TagGroup group, FlightStatusDto? status, DateTime asOfUtc)
    {
        var number = FeedRules.NormalizeFlight(plan.Flight);
        var asOf = TripRules.ToMs(asOfUtc);
        if (!FeedRules.ValidFlightNumber(number) || !TimeText(plan.FlightAt) || DisembarkRules.OnwardMode(plan.Mode) is not { } mode)
            return new("noPlan", null, "none", 0, FlightProvider, asOf, "none", null, null, AirportClock, "noPlan", null, null, null, [],
                "Save your flight number, its time and how you will get to the airport on the Onward travel screen, and Stanley can watch it.", ["Nothing to watch yet."]);
        if (status is null)
            return new("unknown", number, "unknown", 0, FlightProvider, asOf, "none", plan.FlightAt, null, AirportClock, "unknown", null, null, null, [],
                $"Nothing came back for flight {number}. Check the airline's own site or app before you leave the ship.", ["No status was available, so nothing was assumed."]);

        var off = DisembarkRules.OffAt(timeline, optionId, group);
        var zone = Itinerary.ZoneOf(timeline.Days[^1].Port);
        var offAt = Itinerary.LocalAt(off, zone).Time.ToString("HH:mm", CultureInfo.InvariantCulture);
        var notes = new List<string>();
        if (status.State == "cancelled")
            return new("ok", number, "cancelled", 0, FlightProvider, asOf, "provider", plan.FlightAt, null, AirportClock, "cancelled", null, null, offAt, [],
                $"Flight {number} shows as cancelled. Call the airline to rebook: Stanley cannot do that. Until you have a new time you do not need to leave the ship early.",
                ["Stanley does not rebook flights or change your walk-off choice for you.", "Tell whoever is meeting you or driving once you have a new time."]);

        var delay = status.State == "delayed" ? Math.Max(0, status.DelayMinutes) : 0;
        var newMin = Min(plan.FlightAt) + delay;
        if (newMin >= 24 * 60) { newMin = 24 * 60 - 1; notes.Add("The new time is after midnight, so it is shown as 23:59: check the exact time with the airline."); }
        var newAt = Hm(newMin);
        var check = DisembarkRules.CheckOnward(timeline, plan with { FlightAt = newAt }, off);
        var leaveBy = check.LeaveBy is null ? null : Hm(newMin - (DisembarkRules.AirportMinutes + mode.Minutes));
        var verdict = check.Status;
        if (delay > 0) notes.Add($"The provider reports about {delay} minutes late. The airline's own board is the final word.");
        if (verdict is "tooEarly") notes.Add($"The earliest flight this way off the ship allows is about {check.EarliestFlight}.");

        var alternatives = new List<TravelAlternative>();
        if (verdict != "ok")
            foreach (var id in DisembarkRules.WalkOffIds)
                foreach (var m in DisembarkRules.OnwardModes)
                {
                    var c = DisembarkRules.CheckOnward(timeline, plan with { Mode = m.Id, FlightAt = newAt }, DisembarkRules.OffAt(timeline, id, group));
                    if (c.Status != "ok" || id == optionId && m.Id == plan.Mode) continue;
                    var at = Itinerary.LocalAt(DisembarkRules.OffAt(timeline, id, group), zone).Time.ToString("HH:mm", CultureInfo.InvariantCulture);
                    alternatives.Add(new(id, m.Id, at, Hm(newMin - (DisembarkRules.AirportMinutes + m.Minutes)), c.Spare ?? 0, $"Leave the ship at {at} ({PortClock}) and go by {m.Id}: {c.Spare} minutes to spare."));
                }
        // The least hurried ways first: the latest time off the ship, then the most to spare.
        alternatives = [.. alternatives.OrderByDescending(a => a.OffAt, StringComparer.Ordinal).ThenByDescending(a => a.Spare).Take(3)];

        var message = delay > 0
            ? $"Update: my flight {number} is running about {delay} minutes late, now around {newAt} (airport time). I plan to leave the ship about {offAt}. I will confirm once I am through customs."
            : $"Update: my flight {number} is on time at {newAt} (airport time), as of the latest status. I plan to leave the ship about {offAt}.";
        return new("ok", number, status.State, delay, FlightProvider, asOf, "provider", plan.FlightAt, delay > 0 ? newAt : null, AirportClock, verdict, check.Spare, leaveBy, offAt, alternatives, message, notes);
    }

    // ---- Onward connection: a train, a ferry or a flight, from a time the guest types ----

    public static readonly IReadOnlyList<string> ConnectionKinds = ["flight", "train", "ferry"];

    /// <summary>How long before departure to be at the station, quay or airport.</summary>
    public static int ArriveBefore(string kind) => kind switch { "train" => 45, "ferry" => 60, _ => DisembarkRules.AirportMinutes };

    /// <summary>
    /// Whether a train, ferry or flight at a typed time (the port's clock on the last morning) can be made from when the guest leaves the ship: off the ship, through customs, the ride, then the buffer for that kind of journey.
    /// There is no live status for these, so the answer says so; for a flight with a number, the flight check uses the status feed.
    /// </summary>
    public static TravelConnectionDto? Connection(Timeline timeline, string kind, string departAt, string modeId, string optionId, TagGroup group)
    {
        if (!ConnectionKinds.Contains(kind) || !TimeText(departAt) || DisembarkRules.OnwardMode(modeId) is not { } mode || !DisembarkRules.WalkOffIds.Contains(optionId)) return null;
        var last = timeline.Days[^1];
        var zone = Itinerary.ZoneOf(last.Port);
        var baseline = Itinerary.LocalToUtc(last.Date, new TimeOnly(0, 0), zone);
        var off = DisembarkRules.OffAt(timeline, optionId, group);
        var readyMin = (int)Math.Ceiling((off.AddMinutes(DisembarkRules.ClearanceMinutes + mode.Minutes) - baseline).TotalMinutes);
        var buffer = ArriveBefore(kind);
        var depart = Min(departAt);
        var spare = depart - buffer - readyMin;
        var earliest = readyMin + buffer;
        var verdict = spare < 0 ? "tooEarly" : spare < DisembarkRules.TightMinutes ? "tight" : "ok";
        var offAt = Itinerary.LocalAt(off, zone).Time.ToString("HH:mm", CultureInfo.InvariantCulture);
        var notes = new List<string> { $"Be there {buffer} minutes before departure. All times are {PortClock}." };
        if (kind != "flight") notes.Add("Stanley has no live status for trains and ferries: check the operator's own board or app on the day.");
        if (verdict == "tooEarly") notes.Add($"The earliest departure this way off the ship allows is about {Hm(earliest)}.");
        var message = verdict == "tooEarly"
            ? $"This connection is too early for leaving the ship at {offAt}. Choose a departure at {Hm(earliest)} or later, or a quicker way off."
            : $"Leaving the ship about {offAt}, you have {spare} minutes to spare for the {departAt} {kind}. Set off by {Hm(depart - buffer - mode.Minutes)}.";
        return new(kind, departAt, PortClock, buffer, verdict, spare, Hm(depart - buffer - mode.Minutes), offAt, Hm(earliest), message, notes);
    }

    // ---- Reading a sign or a menu from a photo the guest takes ----

    public const int ReadingFloor = 60;

    private static string Level(double c) => c >= 0.85 ? "high" : c >= 0.6 ? "medium" : "low";

    /// <summary>
    /// The result of reading a photo, for a sign or a menu only. A document (a passport, ticket or ID) is refused whatever was asked, and nothing of it is shown. Every line carries a confidence; when none reaches
    /// medium the whole result is "unclear" and the guest is sent to a person. Menus always carry a caution that Stanley cannot say what is in a dish.
    /// </summary>
    public static TravelReadingDto Reading(ImageReading r)
    {
        const string label = "Read and translated by a machine";
        if (r.Kind == "document")
            return new("refused", "document", [], label, "That looks like a document (a passport, ticket or ID). Stanley does not read documents, and nothing from the photo was kept.", []);
        var lines = r.Lines.Where(l => l.Original.Length > 0).Take(12).Select(l => new TravelReadLine(l.Original.Length > 120 ? l.Original[..120] : l.Original, l.English.Length > 120 ? l.English[..120] : l.English, Level(l.Confidence))).ToList();
        var cautions = new List<string> { "A machine may misread or mistranslate. Check anything important with a person." };
        if (r.Kind == "menu") cautions.Add("Stanley cannot say what is in a dish or whether it is safe for an allergy: always ask the staff.");
        if (lines.Count == 0 || lines.All(l => l.Confidence == "low"))
            return new("unclear", r.Kind == "menu" ? "menu" : r.Kind == "sign" ? "sign" : "unknown", [], label, "Stanley could not read that clearly enough to rely on. Try again closer and in better light, or ask a person.", cautions);
        return new("read", r.Kind == "menu" ? "menu" : "sign", lines, label, "Lines marked low are guesses.", cautions);
    }

    // ---- Traffic replan ----

    public static TravelTrafficDto Traffic(RouteConditionsDto r, DateTime asOfUtc)
    {
        var notes = new List<string>();
        if (r.LeaveEarlierMinutes > 0) notes.Add($"Traffic is {r.Traffic} and the sky is {r.Sky}, so allow about {r.LeaveEarlierMinutes} minutes more than usual.");
        else notes.Add("Roads look clear and the sky is fine: your usual time should do.");
        notes.Add("Your check-in time for the terminal stays the same. Arriving early does not get you on sooner.");
        var message = r.LeaveEarlierMinutes > 0
            ? $"Update: traffic to the port looks {r.Traffic} ({r.Sky} sky), so let us leave about {r.LeaveEarlierMinutes} minutes earlier than planned."
            : "Update: roads to the port look clear, so we can leave at the planned time.";
        return new(r.Traffic, r.Sky, r.LeaveEarlierMinutes, TrafficProvider, TripRules.ToMs(asOfUtc), "provider", message, notes);
    }

    // ---- Independent port itinerary and return brief ----

    private sealed record Candidate(string Id, string Kind, string Title, string[] Tags, bool Taxi, int Travel, int Stay, string Cost, long Cents, int Opens, int Closes, string Why, bool Rough, bool Authored = false);

    private static readonly Regex TaxiMinutes = new(@"(\d+)\s*minutes?", RegexOptions.Compiled);

    // Typical hours by kind, not live ones: the guide has no opening times, so the answer says so.
    private static (int Opens, int Closes) Typical(string kind) => kind switch
    {
        "shopping" => (9 * 60, 17 * 60 + 30),
        "beach" => (9 * 60, 17 * 60),
        _ => (8 * 60, 18 * 60),
    };

    private static int T(string hhmm) => Min(hhmm);

    // Authored sample hours by stop id (the port guide holds none), and the food stops the guide does not list. Samples, not live: the answer says to check at the door.
    private static readonly IReadOnlyDictionary<string, (string Opens, string Closes)> Hours = new Dictionary<string, (string, string)>
    {
        ["shop-mercado-municipal-stalls"] = ("08:00", "19:00"), ["shop-artisan-co-op-near-the-square"] = ("10:00", "18:00"), ["coz-mia"] = ("09:00", "18:00"), ["coz-sunset"] = ("10:00", "17:00"),
        ["shop-tourism-village-craft-stalls"] = ("09:00", "17:00"), ["shop-garifuna-drum-makers"] = ("10:00", "16:00"), ["bze-cay"] = ("09:00", "16:00"), ["bze-river"] = ("08:00", "15:00"),
        ["shop-pier-artisan-market"] = ("08:00", "17:00"), ["shop-local-coffee-roasters"] = ("07:00", "15:00"), ["rtb-westbay"] = ("09:00", "17:00"), ["rtb-quiet"] = ("09:00", "17:00"),
    };

    private static readonly IReadOnlyDictionary<string, Candidate[]> Food = new Dictionary<string, Candidate[]>
    {
        ["cozumel"] = [
            new("coz-lunch-pier", "food", "Lunch at the pier restaurants", ["food"], false, 0, 60, "paid", 0, T("11:00"), T("21:00"), "Simple meals within sight of the ship. Typically $12 to $25 a person.", false, true),
            new("coz-lunch-town", "food", "Lunch in San Miguel town", ["food", "culture"], true, 10, 75, "paid", 0, T("11:00"), T("22:00"), "A short taxi ride to the town's restaurants. Typically $12 to $25 a person.", false, true)],
        ["belize"] = [new("bze-lunch-village", "food", "Lunch in the Tourism Village", ["food"], false, 0, 60, "paid", 0, T("11:00"), T("20:00"), "Cafes in the village by the landing. Typically $10 to $20 a person.", false, true)],
        ["roatan"] = [new("rtb-lunch-pier", "food", "Lunch at the pier restaurants", ["food"], false, 0, 60, "paid", 0, T("11:00"), T("20:00"), "Meals beside the pier. Typically $10 to $22 a person.", false, true)],
    };

    private static List<Candidate> Candidates(string portId, JsonNode? knowledge)
    {
        var list = new List<Candidate>();
        if (Food.TryGetValue(portId, out var food)) list.AddRange(food);
        if (knowledge is null) return list;
        foreach (var w in knowledge["walks"]?.AsArray() ?? new JsonArray())
        {
            if (w is null) continue;
            var minutes = (int?)w["minutes"] ?? 30;
            var access = (string?)w["accessible"] ?? "";
            var (o, c) = Typical("walk");
            list.Add(new((string?)w["id"] ?? "", "walk", (string?)w["name"] ?? "A walk", ["culture", "nature", "quiet"], false, 0, minutes * 2, "free", 0, o, c,
                $"{(string?)w["step"] ?? ""} About {minutes} minutes each way on foot.".Trim(),
                Regex.IsMatch(access, "step|uneven|steep|cobble", RegexOptions.IgnoreCase)));
        }
        foreach (var d in knowledge["dayPasses"]?.AsArray() ?? new JsonArray())
        {
            if (d is null) continue;
            var travel = TaxiMinutes.Match((string?)d["distance"] ?? "") is { Success: true } m ? int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture) : 20;
            var quiet = (string?)d["crowd"] == "quiet";
            var (o, c) = Typical("beach");
            list.Add(new((string?)d["id"] ?? "", "beach", (string?)d["name"] ?? "A beach", quiet ? ["beach", "quiet"] : ["beach", "family"], true, travel, 150, "paid", (long)Math.Round(((double?)d["price"] ?? 0) * 100), o, c,
                $"{(string?)d["distance"] ?? ""}. Day pass; {(quiet ? "usually quiet" : "usually busy")}.".Trim(), false));
        }
        foreach (var v in knowledge["vendors"]?.AsArray() ?? new JsonArray())
        {
            if (v is null) continue;
            var (o, c) = Typical("shopping");
            var name = (string?)v["name"] ?? "Local stalls";
            list.Add(new("shop-" + Slug(name), "shopping", name, ["shopping", "culture"], false, 0, 45, "free", 0, o, c, $"{(string?)v["what"] ?? ""}.", false));
        }
        for (var i = 0; i < list.Count; i++)
            if (Hours.TryGetValue(list[i].Id, out var h)) list[i] = list[i] with { Opens = T(h.Opens), Closes = T(h.Closes), Authored = true };
        return list;
    }

    private static string Slug(string s) => Regex.Replace(s.ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');

    public static bool ValidInterest(string s) => Interests.Contains(s);

    /// <summary>
    /// A shore plan the guest builds without a tour: stops chosen from their interests, the distance they will accept (near means no taxi), the way they travel and their time budget, laid out inside the day's real
    /// window (ashore after the landing buffer, back by all aboard minus the return buffer) and inside each stop's typical opening hours. It never goes past the back-by time; what does not fit is left out and said.
    /// </summary>
    public static TravelPortDto? PortPlan(Timeline timeline, int day, IReadOnlyList<string> interests, string mode, int budgetMinutes, bool nearOnly, string mobility)
    {
        if (day < 1 || day > timeline.Days.Count) return null;
        var d = timeline.Days[day - 1];
        if (!timeline.IsCall(d) || d.Arrive is not { } arrive || d.AllAboard is not { } allAboard) return null;
        var port = Itinerary.PortById(d.Port);
        var (landOut, landBack) = ExcursionRules.LandingBuffer(d.Port);
        var ashore = Min(arrive) + landOut;
        var backBy = Min(allAboard) - landBack;
        var notes = new List<string>
        {
            $"Everything here is on {PortClock} at {port.Name}. Opening hours are typical, not live: check at the door.",
            $"Be back at the landing by {Hm(backBy)} ({PortClock}). All aboard is {Hm(Min(allAboard))}, and the {landBack}-minute buffer covers {(port.Tender ? "the tender queue" : "the walk and the gangway")}.",
        };
        var knowledge = PortsReference.Get()["knowledge"]?[d.Port];
        var all = Candidates(d.Port, knowledge);
        var wanted = interests.Where(ValidInterest).Distinct().ToList();
        if (wanted.Contains("food") && !all.Any(c => c.Tags.Contains("food"))) notes.Add("The guide for this port has no food stops, so food is not planned. Ask at Guest Services or the pier information desk.");
        var open = Math.Min(Math.Max(budgetMinutes, MinBudget), MaxBudget);
        var pool = all.Where(c => !(nearOnly && c.Taxi) && !(mode == "walk" && c.Taxi)).ToList();
        if (mode == "walk" && all.Any(c => c.Taxi)) notes.Add("Beach clubs need a taxi, so they are left out of a walking plan.");
        if (mobility != "any")
        {
            var rough = pool.Where(c => c.Rough).ToList();
            if (rough.Count > 0) notes.Add($"Left out because the route has steps or uneven ground: {string.Join(", ", rough.Select(r => r.Title))}.");
            pool = [.. pool.Where(c => !c.Rough)];
        }
        // Interests rank the stops; with none chosen, every stop counts equally and the shorter ones come first.
        var ranked = pool.Select(c => (C: c, Score: wanted.Count == 0 ? 1 : c.Tags.Count(wanted.Contains))).Where(x => x.Score > 0)
            .OrderByDescending(x => x.Score).ThenBy(x => x.C.Travel + x.C.Stay).Select(x => x.C).ToList();

        var stops = new List<TravelStop>();
        var clock = ashore;
        var limit = Math.Min(backBy, ashore + open);
        foreach (var c in ranked)
        {
            var start = Math.Max(clock + c.Travel, c.Opens);
            var end = start + c.Stay;
            if (start >= c.Closes || end > c.Closes) { notes.Add($"{c.Title} is left out: it would not fit inside its typical opening hours."); continue; }
            // A taxi stop needs the ride back counted, so it must still leave room to return before the limit.
            if (end + (c.Taxi ? c.Travel : 0) > limit) continue;
            stops.Add(new(c.Id, c.Kind, c.Title, Hm(start), Hm(end), c.Taxi ? "taxi" : "walk", c.Travel, c.Cost, c.Cents, Hm(c.Opens), Hm(c.Closes), c.Authored ? "authored" : "typical", c.Why));
            clock = end + (c.Taxi ? c.Travel : 0);
        }
        if (ranked.Count > 0 && stops.Count == 0) notes.Add("Nothing fits your time budget today. Try a longer time or a nearer plan.");
        var leaveLast = Hm(stops.Count == 0 ? backBy : backBy - (stops[^1].Mode == "taxi" ? stops[^1].TravelMinutes : 0));
        var text = $"Be back at the landing by {Hm(backBy)} ({PortClock}). All aboard is {Hm(Min(allAboard))}. {(stops.Count == 0 ? "" : $"Leave your last stop by {leaveLast}.")}".Trim();
        return new(d.Port, port.Name, day, PortClock, Hm(ashore), stops, new(Hm(backBy), Hm(Min(allAboard)), landBack, PortClock, leaveLast, text), notes, stops.Count > 0);
    }

    // ---- Phrases ----

    private static readonly Regex Sensitive = new(@"allerg|medic|drug|pill|pregnan|doctor|hospital|ambulance|police|arrest|lawyer|emergency|sick|injur|bleed|asthma|epipen|insulin|diabet", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex Words = new(@"[a-z']+", RegexOptions.Compiled);
    private static readonly HashSet<string> Stop = ["the", "a", "an", "to", "is", "i", "me", "my", "do", "you", "and", "of", "for", "please", "can", "where", "how", "what", "where's", "it", "this", "that"];

    private static TravelPhrase[] PhrasesOf(JsonNode? knowledge, string language) =>
        [.. (knowledge?["phrases"]?.AsArray() ?? new JsonArray()).Where(p => p is not null).Select((p, i) =>
            new TravelPhrase($"p{i}", (string?)p!["say"] ?? "", (string?)p["means"] ?? "", (string?)p["sounds"] ?? "", "reviewed", language))];

    /// <summary>The language of a port day's reviewed phrases, for the image reader.</summary>
    public static string PortLanguage(Timeline timeline, int day) =>
        day < 1 || day > timeline.Days.Count || timeline.Days[day - 1].Port == "sea" ? "the local language" : LanguageOf(PortsReference.Get()["knowledge"]?[timeline.Days[day - 1].Port]);

    private static string LanguageOf(JsonNode? knowledge) =>
        (knowledge?["allergy"]?.AsArray().FirstOrDefault()?["language"] is { } l ? (string?)l : null) ?? "the local language";

    /// <summary>
    /// Phrases for a port from the authored list. Each one is labelled <c>reviewed</c>. A request that matches nothing is not translated by a machine: the guest gets the exact English words in large type to show to a
    /// person, labelled as not translated.
    /// </summary>
    public static TravelPhrasesDto? Phrases(Timeline timeline, int day, string? query, Func<string, string, MachineTranslation?>? translate = null)
    {
        if (day < 1 || day > timeline.Days.Count) return null;
        var port = timeline.Days[day - 1].Port;
        if (port == "sea") return null;
        var knowledge = PortsReference.Get()["knowledge"]?[port];
        var language = LanguageOf(knowledge);
        var all = PhrasesOf(knowledge, language);
        var q = (query ?? "").Trim();
        if (q.Length == 0) return new(port, language, all, null, "Reviewed phrases from the port guide. Show the screen to a person if you are not sure how to say one.");
        var words = Words.Matches(q.ToLowerInvariant()).Select(m => m.Value).Where(w => !Stop.Contains(w) && w.Length > 2).ToHashSet();
        var hits = all.Where(p => Words.Matches(p.Means.ToLowerInvariant()).Any(m => words.Contains(m.Value))).ToList();
        if (hits.Count > 0) return new(port, language, hits, null, "Reviewed phrases that match your words.");
        var shown = new TravelPersonCard(q.Length > 200 ? q[..200] : q, "English", "Not translated");
        // A machine translation is offered only for plain everyday words, never for health, allergy, legal or emergency ones, and it always carries the show-a-person fallback.
        if (translate is not null && !Sensitive.IsMatch(q) && translate(q, language) is { } m)
            return new(port, language, [new("m0", m.Text, q, "", "machine", language, m.Confidence)], shown,
                "Machine-made and not checked by a person: it may be wrong. For anything that matters, show the English words below to a person instead.");
        return new(port, language, [], shown, "Stanley has no reviewed phrase for that and will not make one up. Show these words to a person, or ask Guest Services.");
    }

    // ---- Offline port pack ----

    /// <summary>Everything a guest needs ashore, in one document the device can keep with no signal: the landing and back-by times, contacts, a ride back to the ship, reviewed phrases and the local rules.</summary>
    public static TravelPortPackDto? PortPack(Timeline timeline, int day)
    {
        if (day < 1 || day > timeline.Days.Count) return null;
        var d = timeline.Days[day - 1];
        if (!timeline.IsCall(d)) return null;
        var port = Itinerary.PortById(d.Port);
        var knowledge = PortsReference.Get()["knowledge"]?[d.Port];
        var ashore = PortsReference.Get()["ashore"]?[d.Port];
        var contacts = new List<string>();
        if (ashore?["contacts"] is JsonObject c) foreach (var kv in c) if ((string?)kv.Value is { } v) contacts.Add(v);
        TravelPersonCard? back = ashore?["takeMeBack"] is { } t ? new((string?)t["say"] ?? "", (string?)t["lang"] ?? "", "reviewed") : null;
        var language = LanguageOf(knowledge);
        var (_, landBack) = ExcursionRules.LandingBuffer(d.Port);
        var allAboard = d.AllAboard is { } a ? Hm(Min(a)) : null;
        var backBy = d.AllAboard is { } b ? Hm(Min(b) - landBack) : null;
        var notes = new List<string>();
        foreach (var n in ((ashore?["clearance"]?["notes"]?.AsArray()) ?? new JsonArray()).Concat(knowledge?["advisories"]?.AsArray() ?? new JsonArray())) if ((string?)n is { } s) notes.Add(s);
        var laws = ((knowledge?["laws"]?.AsArray()) ?? new JsonArray()).Select(x => (string?)x).OfType<string>().ToList();
        var phrases = PhrasesOf(knowledge, language);
        var body = JsonSerializerBody(d.Port, day, allAboard, backBy, contacts, phrases, notes, laws);
        var version = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(body))).ToLowerInvariant()[..16];
        return new(version, d.Port, port.Name, day, PortClock, allAboard, backBy, port.Tender, contacts, back, phrases, notes, laws, "Authored port guide; opening hours and prices are samples, so check before relying on them.");
    }

    private static string JsonSerializerBody(string port, int day, string? allAboard, string? backBy, IEnumerable<string> contacts, IEnumerable<TravelPhrase> phrases, IEnumerable<string> notes, IEnumerable<string> laws) =>
        string.Join("|", port, day, allAboard, backBy, string.Join(";", contacts), string.Join(";", phrases.Select(p => p.Say)), string.Join(";", notes), string.Join(";", laws));

    // ---- Packing: itinerary and forecast ----

    /// <summary>
    /// Extra packing items from the sailing itself: the sky at each call (rain, strong sun, heat, cool air) and tender ports. Each says why and where. <paramref name="sky"/> is the weather service's answer for a date and port.
    /// </summary>
    public static List<PackItem> PackingExtras(Timeline timeline, Func<DateOnly, string, SkyDto> sky, IReadOnlyCollection<string> tourNames)
    {
        var items = new List<PackItem>();
        var rain = new List<string>();
        var sun = new List<string>();
        var heat = new List<string>();
        var cool = new List<string>();
        var tender = new List<string>();
        foreach (var d in timeline.Days.Where(timeline.IsCall))
        {
            var port = Itinerary.PortById(d.Port);
            var s = sky(d.Date, d.Port);
            var label = $"{port.Short()} on {d.Date.ToString("ddd d MMM", CultureInfo.InvariantCulture)}";
            if (s.RainFrom is not null) rain.Add($"{label} from {s.RainFrom}");
            if (s.Uv >= 10) sun.Add(label);
            if (s.TempF >= 88) heat.Add(label);
            if (s.TempF <= 60) cool.Add(label);
            if (port.Tender) tender.Add(port.Name);
        }
        if (rain.Count > 0) items.Add(new("fcRain", "clothes", "A compact rain jacket in your day bag", $"Rain is expected: {string.Join("; ", rain.Take(3))}."));
        if (sun.Count > 0) items.Add(new("fcSun", "beach", "A UV-protective shirt or cover-up", $"The sun index is very high at {string.Join("; ", sun.Take(3))}."));
        if (heat.Count > 0) items.Add(new("fcHeat", "health", "A refillable water bottle and a cooling towel", $"Highs of 88°F or more are expected at {string.Join("; ", heat.Take(3))}."));
        if (cool.Count > 0) items.Add(new("fcCool", "clothes", "A warm layer for the day ashore", $"It is likely to be 60°F or cooler at {string.Join("; ", cool.Take(3))}."));
        if (tender.Count > 0) items.Add(new("fcTender", "beach", "Shoes with grip for the tender step", $"The ship tenders at {string.Join(", ", tender.Distinct().Take(3))}: the boat can move at the landing."));
        if (tourNames.Any(n => Regex.IsMatch(n, "snorkel|reef|beach", RegexOptions.IgnoreCase))) items.Add(new("fcSwimTour", "beach", "Swimwear under your clothes on tour days", "You have a water or beach tour booked, and there may be no changing room."));
        return items;
    }

    private static string Short(this Port p) => p.Name.Split(',')[0];

    // ---- Embark goals tour ----

    private static readonly IReadOnlyDictionary<string, string[]> GoalKinds = new Dictionary<string, string[]>
    {
        ["essentials"] = ["service", "restroom", "medical"],
        ["family"] = ["family", "pool"],
        ["dining"] = ["dining"],
        ["quiet"] = ["wellness", "bar"],
        ["access"] = ["service", "restroom"],
    };

    private static readonly IReadOnlyDictionary<string, string> GoalWhy = new Dictionary<string, string>
    {
        ["essentials"] = "A first look at the places you may need in a hurry.",
        ["family"] = "Where the family spaces are.",
        ["dining"] = "Where you can eat on the first afternoon.",
        ["quiet"] = "A calmer corner when the ship is busy.",
        ["access"] = "Step-free places and the notes that matter for getting around.",
    };

    /// <summary>
    /// A short tour of the ship by goal, in a walking order that starts at the first service desk. Muster comes first when essentials is chosen. Walking times use the same rule as the planner. At most eight stops.
    /// </summary>
    public static TravelEmbarkDto? Embark(string shipId, IReadOnlyList<string> goals, string mobility)
    {
        var plan = AboardPlans.For(shipId) ?? AboardPlans.For(ShipDining.SunId);
        if (plan is null) return null;
        var wanted = goals.Where(Goals.Contains).Distinct().ToList();
        if (wanted.Count == 0) wanted = ["essentials"];
        var picks = new List<(DeckPlaceDto Place, string Goal)>();
        foreach (var g in wanted)
        {
            var places = plan.Places.Where(p => GoalKinds[g].Contains(p.Kind) && (g != "access" || p.StepFree && (p.Note is not null || p.Kind == "service")) && (mobility == "any" || p.StepFree)).ToList();
            foreach (var p in places.OrderBy(p => Array.IndexOf(GoalKinds[g], p.Kind)).ThenBy(p => p.Deck).Take(g == "dining" || g == "quiet" ? 2 : 2))
                if (picks.All(x => x.Place.Id != p.Id)) picks.Add((p, g));
        }
        var notes = new List<string>();
        if (wanted.Contains("essentials") && plan.Muster.Count > 0)
        {
            var m = plan.Muster[0];
            notes.Add($"Muster: your station is on your boarding pass. Station {m.Letter} is {m.Name} (deck {m.Deck}). Find yours before you do anything else.");
        }
        foreach (var g in wanted) notes.Add(GoalWhy[g]);
        picks = [.. picks.Take(8)];
        var ordered = new List<(DeckPlaceDto Place, string Goal)>();
        var left = picks.ToList();
        string? at = plan.Places.FirstOrDefault(p => p.Kind == "service")?.Id;
        while (left.Count > 0)
        {
            var next = left.OrderBy(x => StanleyPlannerRules.Walk(at, x.Place.Id, shipId, mobility)).ThenBy(x => x.Place.Deck).First();
            ordered.Add(next);
            left.Remove(next);
            at = next.Place.Id;
        }
        string? prev = plan.Places.FirstOrDefault(p => p.Kind == "service")?.Id;
        var steps = new List<TravelEmbarkStep>();
        foreach (var (p, g) in ordered)
        {
            steps.Add(new(p.Id, p.Name, p.Deck, p.Section, g, GoalWhy[g], StanleyPlannerRules.Walk(prev, p.Id, shipId, mobility), p.StepFree, p.Note));
            prev = p.Id;
        }
        return new(wanted, steps, notes);
    }

    // ---- Entry and customs: official sources, never a model ----

    private sealed record Authority(string Jurisdiction, string Name, TravelLink[] Links, string Note);

    private static readonly IReadOnlyDictionary<string, Authority> Authorities = new Dictionary<string, Authority>
    {
        ["United States"] = new("United States", "U.S. Customs and Border Protection (CBP) and the U.S. Department of State", [new("CBP: travel", "https://www.cbp.gov/travel"), new("State Department: travel", "https://travel.state.gov")], "Entry rules depend on your citizenship. Check both before you pay the balance."),
        ["Mexico"] = new("Mexico", "Instituto Nacional de Migración (INM)", [new("INM", "https://www.inm.gob.mx")], "Rules depend on your nationality. Your own government's travel advice also lists them."),
        ["Spain"] = EuCountry("Spain"), ["France"] = EuCountry("France"), ["Italy"] = EuCountry("Italy"), ["Greece"] = EuCountry("Greece"),
        ["United Kingdom"] = new("United Kingdom", "GOV.UK", [new("Foreign travel advice", "https://www.gov.uk/foreign-travel-advice"), new("Check if you need a UK visa", "https://www.gov.uk/check-uk-visa")], "Rules depend on your nationality."),
    };

    private static Authority EuCountry(string country) =>
        new(country, "The European Union's travel information for the Schengen area (ETIAS and entry rules)", [new("EU travel information", "https://travel-europe.europa.eu/etias_en")], "Rules depend on your nationality and on the country: also check that country's own foreign ministry.");

    private static string CountryOf(string portId) => (string?)PortsReference.Get()["ashore"]?[portId]?["clearance"]?["country"] ?? "";

    private static string Normalize(string country)
    {
        var c = country.Split('(')[0].Trim();
        return c.Length == 0 ? country : c;
    }

    /// <summary>
    /// The official sources for the countries a sailing touches, each with its jurisdiction. Where this app does not hold a link it says which office to ask and does not guess an address. The answer is a fixed list:
    /// <see cref="TravelEntryDto.ModelAnswers"/> is always false.
    /// </summary>
    public static TravelEntryDto Entry(Timeline timeline)
    {
        var countries = timeline.Days.Select(d => d.Port).Where(p => p != "sea").Distinct().Select(CountryOf).Where(c => c.Length > 0).Select(Normalize).Distinct().ToList();
        var sources = new List<TravelEntrySource>();
        foreach (var country in countries)
        {
            var role = country == Normalize(CountryOf(timeline.Days[0].Port)) ? "Where you board and return" : "A port of call";
            if (Authorities.TryGetValue(country, out var a)) sources.Add(new(a.Jurisdiction, a.Name, role, a.Links, a.Note));
            else sources.Add(new(country, $"The immigration and customs office of {country}", role, [], "This app does not hold a link for this country. Ask the ship's agent at the pier or Guest Services, and check your own government's travel advice."));
        }
        return new(sources, ReviewedOn, "Entry, visa and customs rules change and depend on your nationality, so Stanley does not answer them. Use the official source for each country below.", false);
    }

    private static readonly Regex EntryWords = new(
        @"\b(visas?|passports?|immigration|customs|entry (rules?|requirements?)|border|declare|declaration|duty.?free|e-?visa|esta|biometric|quarantine)\b|\bdocuments?\b.*\b(need|require|bring|carry)\b|\b(need|require|bring|carry)\b.*\bdocuments?\b|\b(can|may) i (bring|take).{0,30}\b(through|into|across)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>Whether a message asks about entry, immigration or customs rules, which only official sources may answer.</summary>
    public static bool IsEntryQuestion(string message) => EntryWords.IsMatch(message);

    /// <summary>The chat answer for an entry question: who to ask, with links, and no rule stated by Stanley.</summary>
    public static string EntryAnswer(TravelEntryDto entry)
    {
        var sb = new StringBuilder("I can't answer entry, visa or customs rules: they depend on your nationality and they change, so only the official source is safe.");
        foreach (var s in entry.Sources.Take(4))
        {
            sb.Append($" {s.Jurisdiction}: {s.Authority}");
            if (s.Links.Count > 0) sb.Append($" ({string.Join(", ", s.Links.Select(l => l.Url))})");
            sb.Append('.');
        }
        sb.Append(" The Customs screen shows the allowances and your declaration for the return day.");
        return sb.ToString();
    }
}
