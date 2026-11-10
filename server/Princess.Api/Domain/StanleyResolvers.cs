using System.Globalization;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>
/// Where an answer came from (docs/stanley-gap-analysis-and-plan.md, phase 3). <c>Chips</c> are the short labels on the card (<see cref="StanleyChips"/>); <c>Owner</c> is who keeps the data;
/// <c>DataTime</c> is when the data was read or published, never when the reply was made; <c>Freshness</c> is <c>live</c>, <c>cached</c>, <c>estimated</c> or <c>provisional</c> (published and liable to change);
/// <c>CheckWithPerson</c> shows the route to a person; <c>Note</c> says how to read it.
/// </summary>
public sealed record StanleyProvenance(List<string> Chips, string Owner, DateTime? DataTime, string Freshness, bool CheckWithPerson, string Note);

/// <summary>A structured answer. <c>Id</c> is the resolver that made it (a short closed word, also the tier log topic); <c>Abstained</c> is true when the card says "I cannot confirm".</summary>
public sealed record StanleyCardDto(string Id, string Title, List<string> Lines, StanleyProvenance Provenance, bool Abstained, List<CitationDto>? Links = null)
{
    /// <summary>The card as plain text, for the thread and for a client that does not draw cards.</summary>
    [JsonIgnore]
    public string Text => string.Join("\n", [Title, .. Lines]);
}

public static class StanleyChips
{
    public const string Booking = "Your booking", Schedule = "Ship schedule", Policy = "Princess policy", Estimated = "Estimated", Cached = "Cached";
}

/// <summary>What a resolver sees: the question, the guest's trip facts and the time the facts were read against.</summary>
public sealed record ResolverInput(string Message, StanleyTrip Trip, DateTime Now)
{
    /// <summary>Facts that were never stamped, or were read long before <see cref="Now"/>, are stale.</summary>
    public bool Stale => Trip.AsOf is not { } at || (Now - at).Duration() > StanleyResolvers.MaxAge;
    /// <summary>The day of the sailing today is (1 is departure day; 0 or less is before the cruise).</summary>
    public int Day => Trip.Today.DayNumber - Trip.Departure.DayNumber + 1;
}

/// <summary>One deterministic answer: it knows the questions it takes, and builds a card from the guest's trip facts with no model.</summary>
public interface IStanleyResolver
{
    string Id { get; }
    bool Matches(string message);
    StanleyCardDto Resolve(ResolverInput input);
}

/// <summary>
/// The resolvers: the questions about the guest's own trip that need no model (Tier 0). Pure logic over <see cref="StanleyTrip"/>, so each is unit tested. Topics where a wrong answer costs
/// a guest something (deadlines, tender, payment, access, safety) never guess: with stale or missing data the card says "I cannot confirm" and shows the way to a person. Bill, case and
/// readiness figures are not in the trip facts, so those resolvers say what they cannot confirm and open the right screen until the read tools of phase 4 give them the data.
/// </summary>
public static class StanleyResolvers
{
    public static readonly TimeSpan MaxAge = TimeSpan.FromMinutes(30);
    /// <summary>When the published ship schedule and policy text was last reviewed.</summary>
    public static readonly DateTime PublishedAt = DateTime.ParseExact(StanleyRules.ContentVersion, "yyyy-MM-dd", CultureInfo.InvariantCulture);

    private sealed class Resolver(string id, string pattern, bool risky, string title, Func<ResolverInput, StanleyCardDto> run) : IStanleyResolver
    {
        private readonly Regex _re = new(pattern, RegexOptions.IgnoreCase | RegexOptions.Compiled);
        public string Id => id;
        public bool Matches(string message) => _re.IsMatch(message);
        public StanleyCardDto Resolve(ResolverInput input) =>
            risky && input.Stale ? Cannot(id, title, "The facts I would use are missing or out of date, so I will not guess.", input) : run(input);
    }

    /// <summary>The resolvers whose answer does not depend on the time of day, which the device may keep to show with no signal (the ones that could mislead when old, such as tender and all aboard, are left out).</summary>
    public static readonly IReadOnlyList<string> SavedIds = ["tours", "dinner", "packages", "itinerary", "countdown", "stateroom", "party"];

    /// <summary>The cards the device keeps for offline use: each saved resolver's answer, with the time the booking was read.</summary>
    public static List<StanleyCardDto> SavedFacts(StanleyTrip trip, DateTime now)
    {
        var input = new ResolverInput("", trip, now);
        return [.. SavedIds.Select(id => All.First(r => r.Id == id).Resolve(input))];
    }

    private static string Key(string s) => string.Concat(s.ToLowerInvariant().Where(char.IsLetterOrDigit));

    private static IEnumerable<string> VenueKeys(Venue v)
    {
        var by = v.Name.IndexOf(" by ", StringComparison.OrdinalIgnoreCase);
        var core = by > 0 ? v.Name[..by] : v.Name;
        if (core.StartsWith("The ", StringComparison.OrdinalIgnoreCase)) core = core[4..];
        return new[] { Key(v.Name), Key(core) }.Where(k => k.Length >= 5).Distinct();
    }

    private static Venue? FindVenue(string message, IEnumerable<Venue> venues)
    {
        var m = Key(message);
        return venues.FirstOrDefault(v => VenueKeys(v).Any(k => m.Contains(k, StringComparison.Ordinal)));
    }

    /// <summary>"When is Sabatini's open?": a dining room's hours from the ship's published directory (ship time, a sea day and a port day), or its dinner seatings for a room that takes reservations. It takes only a question that names a room.</summary>
    private sealed class VenueHours : IStanleyResolver
    {
        private static readonly Regex Asks = new(@"\b(open|opens|opening|close|closes|closing|hours)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        public string Id => "venueHours";
        public bool Matches(string message) => Asks.IsMatch(message) && FindVenue(message, ShipDining.Ships.SelectMany(s => ShipDining.VenuesOf(s)).DistinctBy(v => v.Id)) is not null;

        private static string Ranges(string[][] r) => r.Length == 0 ? "closed" : string.Join(", ", r.Select(x => $"{x[0]} to {x[1]}"));

        public StanleyCardDto Resolve(ResolverInput i)
        {
            var shipId = i.Trip.Ship.ToLowerInvariant().Replace(' ', '-');
            var venue = FindVenue(i.Message, ShipDining.VenuesOf(shipId));
            if (venue is null) return FromPublished(Id, "Opening hours", [$"That place is not on {i.Trip.Ship}. The Dining screen lists the rooms on your ship."], StanleyChips.Schedule, "Princess ship directory", "From the published directory.", false, Dining);
            var lines = new List<string>();
            if (ShipDining.QueueOf(shipId).FirstOrDefault(q => q.Id == venue.Id) is { } q)
            {
                var today = i.Trip.Timeline.Days.FirstOrDefault(d => d.Day == i.Day);
                if (today is null) lines.Add($"{venue.Name} ({venue.Deck}): on a sea day {Ranges(q.Sea)}; on a port day {Ranges(q.Port)}.");
                else lines.Add($"{venue.Name} ({venue.Deck}) today: {Ranges(today.Port == "sea" ? q.Sea : q.Port)}.");
            }
            else lines.Add($"{venue.Name} ({venue.Deck}) takes reservations for dinner, with seatings from {DiningRules.DinnerTimes[0]} to {DiningRules.DinnerTimes[^1]}. The Dining screen shows what is free.");
            lines.Add("Hours are ship time and can change; the ship's daily programme has the last word.");
            return FromPublished(Id, "Opening hours", lines, StanleyChips.Schedule, "Princess ship directory", "The published hours can change. The ship's notice on the day is the last word.", false, Dining);
        }
    }

    /// <summary>
    /// "Compare the reef snorkel and the Mayan ruins": two shore excursions side by side, from the same rules as the Excursions screen's compare table (<see cref="StanleyPlannerRules.CompareTours"/>), so the chat and the screen
    /// cannot disagree. It takes only a question with a comparing word that names two different excursions on the guest's own sailing; nothing is booked from here.
    /// </summary>
    private sealed class TourCompare : IStanleyResolver
    {
        private static readonly Regex Cue = new(@"\b(compar(e|ing|ison)|differences? between|versus|vs)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex Split = new(@"\b(and|versus|vs|or|against|with|to)\b|[,&/]", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly HashSet<string> Skip = ["with", "pass", "town", "boat", "tour", "tours"];
        private static readonly Dictionary<string, string> Labels = new()
        {
            ["when"] = "Day", ["start"] = "Starts", ["duration"] = "Length", ["exertion"] = "Effort", ["transport"] = "Getting there", ["return"] = "Getting back",
            ["price"] = "Price for your party", ["included"] = "Included", ["stepFree"] = "Step-free", ["places"] = "Places",
        };
        public string Id => "compareTours";
        public bool Matches(string message) => Cue.IsMatch(message) && Pair(message) is not null;

        private static string[] Content(Excursion e) => [.. Regex.Split(e.Name.ToLowerInvariant(), "[^a-z]+").Where(w => w.Length > 3 && !Skip.Contains(w))];

        /// <summary>The one excursion a piece of the question names: the full name, or the most of its own words (at least two), and never a tie.</summary>
        private static Excursion? Find(string part)
        {
            var words = Regex.Split(part.ToLowerInvariant(), "[^a-z]+").ToHashSet();
            var scored = ExcursionRules.Catalogue.Select(e => (e, c: Content(e))).Select(x => (x.e, hit: x.c.Count(words.Contains), all: x.c.Length)).Where(x => x.hit >= Math.Min(2, x.all) && x.hit > 0).OrderByDescending(x => x.hit == x.all).ThenByDescending(x => x.hit).ToList();
            return scored.Count == 0 || (scored.Count > 1 && scored[0].hit == scored[1].hit && (scored[0].hit == scored[0].all) == (scored[1].hit == scored[1].all)) ? null : scored[0].e;
        }

        private static (Excursion A, Excursion B)? Pair(string message)
        {
            var found = Split.Split(message).Select(Find).OfType<Excursion>().DistinctBy(e => e.Id).ToList();
            return found.Count == 2 ? (found[0], found[1]) : null;
        }

        public StanleyCardDto Resolve(ResolverInput i)
        {
            const string Note = "From the published excursion listings; places and prices can change, so confirm on the Excursions screen before you book.";
            const string Owner = "Princess shore excursion listings";
            var (a, b) = Pair(i.Message) ?? throw new InvalidOperationException("No pair of excursions.");
            var timeline = i.Trip.Timeline;
            var off = new[] { a, b }.Where(e => timeline.Days.All(d => d.Port != e.Port)).ToList();
            if (off.Count > 0) return FromPublished(Id, "Compare excursions", [.. off.Select(e => $"{e.Name} is not at a port on your sailing, so I cannot compare it for your trip."), "The Excursions screen lists what is on your sailing."], StanleyChips.Schedule, Owner, Note, false, Tours);
            var cmp = StanleyPlannerRules.CompareTours(timeline, i.Trip.SailingId ?? "", a.Id, b.Id, i.Trip.Ages, i.Trip.Today);
            if (cmp is null) return FromPublished(Id, "Compare excursions", ["I could not compare those two. The Excursions screen has the compare table."], StanleyChips.Schedule, Owner, Note, false, Tours);
            var lines = new List<string>();
            foreach (var r in cmp.Rows.Where(r => r.Differs)) lines.Add($"{Labels.GetValueOrDefault(r.Key, r.Key)}: {cmp.NameA}, {r.A}. {cmp.NameB}, {r.B}.");
            var same = cmp.Rows.Where(r => !r.Differs).Select(r => Labels.GetValueOrDefault(r.Key, r.Key).ToLowerInvariant()).ToList();
            if (same.Count > 0) lines.Add($"The same for both: {string.Join(", ", same)}.");
            lines.AddRange(cmp.Risks.Select(x => "Check: " + x));
            lines.AddRange(cmp.Missing.Select(x => "Not stated: " + x));
            return FromPublished(Id, $"{cmp.NameA} or {cmp.NameB}", lines, StanleyChips.Schedule, Owner, Note, false, Tours);
        }
    }

    private static readonly CitationDto Trips = new("My trips", "/me/trips"), Bill = new("Bill", "/me/bill"), Cases = new("Cases", "/me/cases"), Documents = new("Documents", "/me/documents"),
        Pass = new("Boarding pass", "/home/boarding-pass"), Checklist = new("Checklist", "/plan/checklist"), Tours = new("Excursions", "/plan/excursions"), Dining = new("Dining", "/plan/dining"),
        Packages = new("Packages", "/me/packages");

    public static IReadOnlyList<IStanleyResolver> All { get; } =
    [
        new Resolver("tender", @"\b(tender|tenders|tendering)\b.*\b(run|running|today|tomorrow|cancel\w*|late|delay\w*|operat\w*|called off|suspend\w*)\b|\b(today|tomorrow)\b.*\btender\b|\bwill we tender\b|\bis .{0,25}\btender port\b", true, "Tender", Tender),
        new Resolver("checkin", @"\bcheck-?in\b.*\b(close|closes|closing|deadline|cut-?off|last chance|by when|until)\b|\b(close|closes|deadline|cut-?off)\b.*\bcheck-?in\b", true, "Online check-in", CheckIn),
        new Resolver("allAboard", @"\ball aboard\b|\bback on (the )?(ship|boat)\b|\bwhen (do|must|should|shall) (i|we) (need to |have to )?be back\b|\bbe back (on|at|by)\b", true, "All aboard", AllAboard),
        new Resolver("bill", @"\b(my|our) (bill|balance|account|folio|charges)\b|\b(what|how much) do (i|we) owe\b", true, "Your bill", BillStatus),
        new Resolver("cases", @"\b(my|our) (cases?|complaints?|claims?|refunds?)\b|\bstatus of (my|our) (case|complaint|claim|refund)\b", true, "Your cases", OpenCases),
        new Resolver("readiness", @"\bboarding pass\b|\b(my|our) (documents?|passports?|visas?)\b|\bready to (sail|board|go)\b|\bwhat (do|must|should) (i|we) still (need|have) to do\b|\bwhat('s| is) (still )?left to do\b", true, "Are you ready to sail", Readiness),
        new Resolver("changed", @"\bwhat('s| has| have)? changed\b|\bany changes\b|\banything (new|changed)\b", false, "What changed", Changed),
        new Resolver("nextEvent", @"\bwhat('s| is) next\b|\bwhats next\b|\bnext (thing|event|booking|reservation|tour|dinner)\b|\bcoming up\b|\bwhat do (i|we) have (next|on)\b", false, "Next on your plan", NextEvent),
        new TourCompare(),
        new Resolver("tours", @"\b(my|our) (tours?|excursions?)\b|\b(tours?|excursions?) (do )?(i|we) (have )?(booked|got)\b|\bwhat (tours?|excursions?) (have|did) (i|we) book", false, "Your tours", TourList),
        new Resolver("dinner", @"\b(my|our) (dinners?|dining|table)\b|\bdinner reservations?\b|\bwhat time is (my |our )?dinner\b|\bwhere (am i|are we) eating\b", false, "Your dinners", DinnerList),
        new Resolver("packages", @"\b(my|our) (packages?|drinks? package|wi-?fi package)\b|\bwhat (does|do) (my|our) .{0,30}package.{0,20} include\b|\bpackages? (do )?(i|we) have\b", false, "Your packages", PackageList),
        new VenueHours(),
        new Resolver("itinerary", @"\bitinerary\b(?! for\b)|\bwhich ports\b|\bports? of call\b|\bports? (are we|do we) (go|visit|stop|call)|\bwhere (are we|do we) (go|stop|sail)\b", false, "Your ports", Ports),
        new Resolver("portToday", @"\bwhere is the ship\b|\b(where|which port)\b.*\b(today|tomorrow|now)\b|\b(today|tomorrow)'?s port\b", false, "Where the ship is", PortToday),
        new Resolver("countdown", @"\bcountdown\b|\bhow (many|long)\b.*\b(days?|sleeps?)\b.*\b(sail|cruise|trip|go|left|until|before)\b|\bwhen (do|does) (we|the (cruise|ship|trip)) (sail|leave|depart|start)\b", false, "When you sail", Countdown),
        new Resolver("stateroom", @"\b(my|our) (cabin|stateroom|room) (category|type|grade)\b|\bwhich (cabin|stateroom) (category|type)\b|\bwhat (kind|type) of (cabin|stateroom)\b", false, "Your stateroom", Stateroom),
        new Resolver("party", @"\bhow many (people|guests|travell?ers|of us)\b|\bwho('s| is) (travell?ing|sailing)\b", false, "Who is travelling", Party),
    ];

    /// <summary>Whether any resolver takes the question, before any trip facts are known. Used to ask which trip when a guest has two.</summary>
    public static bool Takes(string message) => All.Any(r => r.Matches(message));

    /// <summary>The card for a question one resolver takes, or null when none does. <paramref name="now"/> is the time the trip facts are judged against.</summary>
    public static StanleyCardDto? Resolve(string message, StanleyTrip trip, DateTime now)
    {
        // A request to build a day, week or itinerary is planning for the model, never a lookup.
        if (StanleyRouter.Route(message, "unknown", true).Planning) return null;
        var input = new ResolverInput(message, trip, now);
        return All.FirstOrDefault(r => r.Matches(message))?.Resolve(input);
    }

    // ---- card builders ---------------------------------------------------------------------------------------------------------------------

    private static string Date(DateOnly d) => d.ToString("dddd d MMMM", CultureInfo.InvariantCulture);
    private static string Hm(TimeOnly t) => t.ToString("HH:mm", CultureInfo.InvariantCulture);
    private static string PortName(string id) => Itinerary.PortOf(id)?.Name ?? "At sea";
    private static string Plural(int n, string one, string many) => $"{n} {(n == 1 ? one : many)}";

    /// <summary>A card from the guest's own booking. Stale facts are marked cached rather than live, with the time they were read.</summary>
    private static StanleyCardDto FromBooking(string id, string title, List<string> lines, ResolverInput i, params CitationDto[] links) =>
        new(id, title, lines, i.Stale
            ? new StanleyProvenance([StanleyChips.Booking, StanleyChips.Cached], "Your Princess booking", i.Trip.AsOf, "cached", true, "These facts were read earlier and may have changed. Check the screen or a person before you rely on them.")
            : new StanleyProvenance([StanleyChips.Booking], "Your Princess booking", i.Trip.AsOf, "live", false, "Read from your booking when you asked."), false, [.. links]);

    /// <summary>A card from the published ship schedule or policy. It is published text, so it is provisional: the ship's own notice on the day wins.</summary>
    private static StanleyCardDto FromPublished(string id, string title, List<string> lines, string chip, string owner, string note, bool person, params CitationDto[] links) =>
        new(id, title, lines, new StanleyProvenance([chip], owner, PublishedAt, "provisional", person, note), false, [.. links]);

    /// <summary>"I cannot confirm": a deadline, tender, payment, access or safety answer with no usable data. It never falls to a guess.</summary>
    public static StanleyCardDto Cannot(string id, string title, string reason, ResolverInput i, params CitationDto[] links) =>
        new(id, title, [$"I cannot confirm this. {reason}", "Please check with a person at Guest Services, or on the screen shown."],
            new StanleyProvenance([], "Your Princess booking", i.Trip.AsOf, i.Trip.AsOf is null ? "provisional" : "cached", true, "I did not have current data for this, so I did not answer from memory."), true, [.. links]);

    private sealed record Booked(int Day, string Name, string? Time, string Kind);

    private static List<Booked> Items(StanleyTrip t) =>
        [.. t.Tours.Select(x => new Booked(x.Day, x.Name, x.Time, "tour")), .. t.Meals.Select(x => new Booked(x.Day, x.Name, x.Time, "dinner"))];

    private static DateOnly DayDate(StanleyTrip t, int day) => t.Departure.AddDays(day - 1);
    private static string Describe(StanleyTrip t, Booked b) => $"{b.Name} on day {b.Day} ({DayDate(t, b.Day).ToString("ddd d MMM", CultureInfo.InvariantCulture)}){(b.Time is null ? "" : " at " + b.Time)}";

    // ---- the resolvers ---------------------------------------------------------------------------------------------------------------------

    private static StanleyCardDto NextEvent(ResolverInput i)
    {
        var t = i.Trip;
        var all = Items(t).OrderBy(b => b.Day).ThenBy(b => b.Time ?? "99:99", StringComparer.Ordinal).ToList();
        if (i.Day < 1)
        {
            var left = -i.Day + 1;
            var lines = new List<string> { $"You sail on {Date(t.Departure)}, in {Plural(left, "day", "days")}. Nothing happens on board before then." };
            if (all.Count > 0) lines.Add($"Your first booking is {Describe(t, all[0])}.");
            return FromBooking("nextEvent", "Next on your plan", lines, i, Trips);
        }
        var nowTime = t.AsOf is { } at ? Hm(TimeOnly.FromDateTime(at)) : "00:00";
        var next = all.FirstOrDefault(b => b.Day > i.Day || (b.Day == i.Day && string.CompareOrdinal(b.Time ?? "99:99", nowTime) >= 0));
        return next is null
            ? FromBooking("nextEvent", "Next on your plan", ["You have no more tours or dinners booked. The Plan tab shows what you can add."], i, Tours, Dining)
            : FromBooking("nextEvent", "Next on your plan", [$"{Describe(t, next)}.", "Times are local to where the ship is on that day."], i, next.Kind == "tour" ? Tours : Dining);
    }

    private static StanleyCardDto AllAboard(ResolverInput i)
    {
        var t = i.Trip;
        var stop = t.Timeline.Days.Where(d => d.AllAboard is not null && d.Day >= Math.Max(1, i.Day)).OrderBy(d => d.Day).FirstOrDefault();
        if (stop is null) return Cannot("allAboard", "All aboard", "There is no port day left on your sailing in the schedule I have.", i);
        var when = stop.Day == i.Day ? "Today" : stop.Day == i.Day + 1 ? "Tomorrow" : $"On day {stop.Day}";
        return FromPublished("allAboard", "All aboard",
            [$"{when} in {PortName(stop.Port)} ({Date(stop.Date)}): all aboard at {Hm(stop.AllAboard!.Value)}, local time in port.",
             stop.Arrive is { } arr && stop.Depart is { } dep ? $"The ship arrives at {Hm(arr)} and sails at {Hm(dep)}." : "The ship sails soon after.",
             "That is the time on the clocks in port, which may differ from your phone's. The ship leaves on time, so aim to be back well before it."],
            StanleyChips.Schedule, "Princess ship schedule", "The published schedule can change. The ship's notice on the day is the last word.", true);
    }

    private static StanleyCardDto Tender(ResolverInput i)
    {
        var t = i.Trip;
        var upcoming = t.Timeline.Days.Where(d => d.Day >= Math.Max(1, i.Day) && Itinerary.PortOf(d.Port)?.Tender == true).OrderBy(d => d.Day).ToList();
        var lines = new List<string>();
        if (upcoming.Count == 0) lines.Add("None of the ports left on your sailing is a tender port, so you should walk or be driven off at a pier.");
        else
            foreach (var d in upcoming)
            {
                var o = TenderRules.Outlook(d.Port, d.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                lines.Add($"{PortName(d.Port)}, day {d.Day} ({d.Date.ToString("ddd d MMM", CultureInfo.InvariantCulture)}): a tender port. Outlook {o.Band}, about {o.Percent}% chance of delays or a cancelled tender.");
            }
        lines.Add("I cannot confirm whether tenders will run. The captain decides on the day, and the ship's notice is the last word.");
        var estimated = upcoming.Count > 0;
        return new StanleyCardDto("tender", "Tender", lines,
            new StanleyProvenance(estimated ? [StanleyChips.Schedule, StanleyChips.Estimated] : [StanleyChips.Schedule], "Princess ship schedule and a simulated sea-state outlook", PublishedAt, estimated ? "estimated" : "provisional", true,
                "The ports come from the published schedule. The outlook is an estimate, not a forecast."), false);
    }

    private static StanleyCardDto CheckIn(ResolverInput i)
    {
        var t = i.Trip;
        var closeLocal = TimeZoneInfo.ConvertTimeBySystemTimeZoneId(TripRules.CheckinClosesAt(t.Departure), TripRules.HomeZone);
        var openLocal = TimeZoneInfo.ConvertTimeBySystemTimeZoneId(TripRules.CheckinOpensAt(t.Departure), TripRules.HomeZone);
        var at = t.AsOf!.Value;
        if (at >= closeLocal) return Cannot("checkin", "Online check-in", "By my information online check-in has closed. Please go to the terminal or ask a person.", i, Pass);
        var closes = $"{Hm(TimeOnly.FromDateTime(closeLocal))} on {Date(DateOnly.FromDateTime(closeLocal))}, Fort Lauderdale time";
        var lines = new List<string> { at < openLocal ? $"Online check-in opens on {Date(DateOnly.FromDateTime(openLocal))} and closes at {closes}." : $"Online check-in is open and closes at {closes}." };
        return FromPublished("checkin", "Online check-in", lines, StanleyChips.Policy, "Princess check-in policy", "The cut-off is Princess policy. Allow time before it: do not wait for the last minute.", true, Pass, Checklist);
    }

    private static StanleyCardDto BillStatus(ResolverInput i) =>
        Cannot("bill", "Your bill", "Your balance and its posted, pending, disputed and estimated parts are not in what I can read in chat yet. The Bill screen shows each charge with its state.", i, Bill);

    private static StanleyCardDto OpenCases(ResolverInput i) =>
        Cannot("cases", "Your cases", "I cannot read the state of your cases here. The Cases screen lists each one with its status.", i, Cases);

    private static StanleyCardDto Readiness(ResolverInput i) =>
        Cannot("readiness", "Are you ready to sail", "Your documents, boarding pass and checklist are not in what I can read in chat yet. The checklist shows each task, who it is for and the date.", i, Checklist, Documents, Pass);

    private static StanleyCardDto Changed(ResolverInput i) =>
        new("changed", "What changed", ["I cannot read the list of changes just now, so I cannot say what changed. Check Notices on Home, or ask a person."],
            new StanleyProvenance([], "Your Princess booking", i.Trip.AsOf, "provisional", true, "The change engine answers this when it is on; this card is only the fallback."), true);

    private static StanleyCardDto TourList(ResolverInput i)
    {
        var lines = i.Trip.Tours.Count == 0
            ? new List<string> { "You have no tours booked yet. The Excursions screen lists what is on offer in each port." }
            : i.Trip.Tours.OrderBy(x => x.Day).Select(x => Describe(i.Trip, new Booked(x.Day, x.Name, x.Time, "tour")) + ".").ToList();
        return FromBooking("tours", "Your tours", lines, i, Tours);
    }

    private static StanleyCardDto DinnerList(ResolverInput i)
    {
        var lines = i.Trip.Meals.Count == 0
            ? new List<string> { "You have no dinners booked yet." }
            : i.Trip.Meals.OrderBy(x => x.Day).Select(x => Describe(i.Trip, new Booked(x.Day, x.Name, x.Time, "dinner")) + ".").ToList();
        lines.Add($"Your main dinner is set to {i.Trip.Dining}.");
        return FromBooking("dinner", "Your dinners", lines, i, Dining);
    }

    private static StanleyCardDto PackageList(ResolverInput i)
    {
        var lines = i.Trip.Packages.Count == 0
            ? new List<string> { "You have no packages yet. The Packages screen shows drinks, Wi-Fi, dining and more." }
            : new List<string> { $"Active: {string.Join(", ", i.Trip.Packages)}.", "The Packages screen shows what each one covers and what it has saved you." };
        return FromBooking("packages", "Your packages", lines, i, Packages);
    }

    private static StanleyCardDto Ports(ResolverInput i)
    {
        var days = i.Trip.Timeline.Days.Where(d => d.Arrive is not null).ToList();
        return FromPublished("itinerary", "Your ports", [.. days.Select(d => $"Day {d.Day}, {Date(d.Date)}: {PortName(d.Port)}, arriving {Hm(d.Arrive!.Value)}.")],
            StanleyChips.Schedule, "Princess ship schedule", "The published schedule can change. The ship's notice on the day is the last word.", false, Trips);
    }

    private static StanleyCardDto PortToday(ResolverInput i)
    {
        var tomorrow = Regex.IsMatch(i.Message, "tomorrow", RegexOptions.IgnoreCase);
        var day = i.Day + (tomorrow ? 1 : 0);
        var d = i.Trip.Timeline.Days.FirstOrDefault(x => x.Day == day);
        if (d is null) return FromPublished("portToday", "Where the ship is", [$"Your sailing has no day {day}. You sail on {Date(i.Trip.Departure)}."], StanleyChips.Schedule, "Princess ship schedule", "From the published schedule.", false);
        var word = tomorrow ? "Tomorrow" : "Today";
        var line = d.Arrive is { } a ? $"{word} (day {d.Day}) the ship is in {PortName(d.Port)}, arriving {Hm(a)}{(d.AllAboard is { } b ? $" with all aboard at {Hm(b)}" : "")}, local time." : $"{word} (day {d.Day}) the ship is {(d.Port == "sea" ? "at sea" : "in " + PortName(d.Port))}.";
        return FromPublished("portToday", "Where the ship is", [line], StanleyChips.Schedule, "Princess ship schedule", "The published schedule can change. The ship's notice on the day is the last word.", false);
    }

    private static StanleyCardDto Countdown(ResolverInput i)
    {
        var left = -i.Day + 1;
        return FromBooking("countdown", "When you sail",
            [left > 0 ? $"You sail on {Date(i.Trip.Departure)}, {Plural(left, "day", "days")} from now." : $"You sailed on {Date(i.Trip.Departure)} and today is day {i.Day} of {i.Trip.Nights + 1}."], i, Trips);
    }

    private static StanleyCardDto Stateroom(ResolverInput i) =>
        FromBooking("stateroom", "Your stateroom", [$"You booked a {i.Trip.Stateroom} stateroom on {i.Trip.Ship}. Your cabin number is on the Me tab."], i, Trips);

    private static StanleyCardDto Party(ResolverInput i) =>
        FromBooking("party", "Who is travelling", [$"{Plural(i.Trip.Ages.Count, "traveller is", "travellers are")} on your booking. Names and details are on the Me tab."], i, Trips);
}
