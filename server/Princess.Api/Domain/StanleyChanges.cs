using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Princess.Api.Domain;

// ---- The canonical change event (docs/stanley-gap-analysis-and-plan.md, phase 11) ----

/// <summary>What kind of thing changed. Every source of change maps to exactly one of these.</summary>
public static class ChangeKinds
{
    public const string Itinerary = "itinerary", PortCall = "portCall", Venue = "venue", Tender = "tender", Weather = "weather", Flight = "flight", Reservation = "reservation", Order = "order", Case = "case", Spend = "spend";
    public static readonly string[] All = [Itinerary, PortCall, Venue, Tender, Weather, Flight, Reservation, Order, Case, Spend];
}

/// <summary>How sure the source is. Verified: the line, the ship or a provider says it is so. Provisional: reported but may still move. Forecast: something expected, not a fact.</summary>
public static class ChangeStatus
{
    public const string Verified = "verified", Provisional = "provisional", Forecast = "forecast";
    public static readonly string[] All = [Verified, Provisional, Forecast];
}

/// <summary>
/// How much a change matters to this guest, most serious first: a safety or deadline risk, a reservation that is lost, a meaningful conflict with the plan, a preference improvement, and the rest.
/// The first two are alerts; the others are suggestions (see <see cref="StanleyDeliveryRules"/>).
/// </summary>
public static class ChangeConsequence
{
    public const string Safety = "safety", LostReservation = "lostReservation", Conflict = "conflict", Improvement = "improvement", Optional = "optional";
    public static readonly string[] All = [Safety, LostReservation, Conflict, Improvement, Optional];
    public static int Rank(string c) => Array.IndexOf(All, c) is var i and >= 0 ? i : All.Length;
    public static bool IsAlert(string c) => Rank(c) <= Rank(LostReservation);
}

/// <summary>A change Stanley could carry out once the guest has seen a preview and confirmed it: one of the phase 5 action kinds with its plain-string arguments. Never anything else.</summary>
public sealed record ChangeAction(string Kind, Dictionary<string, string> Args);

/// <summary>One thing the guest can do. It is an action to preview and confirm, or a screen to open, or only advice (neither).</summary>
public sealed record ChangeOption(string Id, string Label, string Detail, ChangeAction? Action, string? Route);

/// <summary>What in the guest's own plan the change touches.</summary>
public sealed record ChangeAffect(string Kind, string Name, int Day, string? Time);

/// <summary>
/// The one card: what changed, why it affects you, the recommended option, the other options, and how to confirm (the recommended option's action, prepared and confirmed through the phase 5 actions).
/// <see cref="Id"/> is stable for the same thing; <see cref="Fingerprint"/> changes when the facts do, so a dismissed card returns only when the facts have changed.
/// </summary>
public sealed record ChangeCard(
    string Id, string Fingerprint, string Kind, string Status, string Source, long SourceAt, string SourceAtText, string Consequence, bool Critical, int? Day,
    string Title, string What, string Why, ChangeOption Recommended, IReadOnlyList<ChangeOption> Others, IReadOnlyList<ChangeAffect> Affects,
    string IfNothing, bool Tip, IReadOnlyList<string> Where, long NoticedAt = 0);

public sealed record ChangeQuestion(string Key, string Question, string Answer);

/// <summary>The six questions answered from one change card alone (never from chat history).</summary>
public sealed record ChangeExplanation(string Id, string Title, IReadOnlyList<ChangeQuestion> Questions);

public sealed record ChangeHeld(string Id, string Reason);

/// <summary>What to show on a screen now: alerts apart from the (at most one) suggestion, and what was held back and why.</summary>
public sealed record ChangeDelivery(IReadOnlyList<ChangeCard> Alerts, ChangeCard? Suggestion, IReadOnlyList<ChangeHeld> Held, ChangeMissed? Digest = null);

public sealed record ChangeMissed(long? Since, IReadOnlyList<ChangeCard> Cards, int Total);

public sealed record ChangeListDto(long AsOf, string AsOfText, IReadOnlyList<ChangeCard> Cards, IReadOnlyList<string> Unread);

public sealed record ChangeDeliveryRequest(string? SailingId, string? Screen, string? Level, List<string>? Shown, List<string>? Saved);

public sealed record ChangeDismissRequest(string? Fingerprint, string? SailingId);

/// <summary>What the server remembers for one guest: when each change (in the form it has now) was first noticed, which version was dismissed, and when the guest last caught up.</summary>
public sealed record ChangeSeen(string Fp, long At, string? DismissedFp = null);

/// <summary><see cref="BudgetCents"/> is the trip budget the guest chose to let Stanley watch (phase 12); it is kept here with the rest of what Stanley remembers about their changes, and is null until they set one.</summary>
public sealed record ChangeMemory(Dictionary<string, ChangeSeen> Seen, long? LastOpenAt, long? BudgetCents = null)
{
    public static ChangeMemory Empty => new([], null);
}

// ---- What the sources say. The engine takes only these, so the same facts always give the same cards. ----

public sealed record TenderSignal(string Port, string Date, string Band, int Percent);
public sealed record SkySignal(int Day, string Port, string? RainFrom, string? RainTo);
public sealed record SeaSignal(double WaveM, double SwellM);
public sealed record CaseSignal(string Number, string Kind, string Stage, string? Outcome, long OpenedAt, long DueAt);
public sealed record OrderSignal(string Id, string Stage, int Unavailable);
/// <summary>The spending pace against the budget the guest set (phase 12), already worked out by <see cref="StanleyMoneyRules.Pace"/>. Null when there is no budget or the guest is not aboard.</summary>
public sealed record SpendSignal(PaceResult Pace);

/// <summary>Everything the engine reads. <see cref="Saved"/> are the programme events the guest has saved; <see cref="Scenarios"/> the disruptions in force for a demo guest.</summary>
public sealed record ChangeFacts(
    DateTime Now, StanleyTrip Trip, IReadOnlyList<PlanChange> Program, IReadOnlySet<string> Saved, IReadOnlySet<string> Scenarios, IReadOnlyList<TenderSignal> Tenders,
    TravelFlightDto? Flight, IReadOnlyList<SkySignal> Skies, SeaSignal? Sea, IReadOnlyList<CaseSignal> Cases, IReadOnlyList<OrderSignal> Orders, SpendSignal? Spend = null);

/// <summary>
/// Stanley's change engine: it turns what the sources say into change events, works out only the parts of the guest's plan each one touches, and ranks them by consequence.
/// Nothing here cancels, rebooks, pays or changes anything: a card offers options, and an option that changes something is a phase 5 action the guest previews and confirms.
/// A forecast is never an alert. Pure and framework-free, so it is tested without a server.
/// </summary>
public static class StanleyChangeRules
{
    public const int MaxPerSession = 3, MaxAlerts = 3, MaxMissed = 5, MaxSaved = 30, MaxSeen = 200;
    public static readonly string[] Levels = ["off", "affects", "suggest", "guide"];
    public static readonly string[] Screens = ["home", "ship", "port", "plan", "travel"];
    private static readonly TimeSpan SeenStays = TimeSpan.FromDays(30);
    private const int DinnerMinutes = 90, WalkMinutes = 15;

    private static readonly string[] AllScreens = ["home", "ship", "port", "plan", "travel"];
    private static readonly ChangeOption Person = new("person", "Ask a person", "Guest Services can look at it with you. I cannot decide this for you.", null, "/me/cases");

    // ---- small helpers ----

    private static int Minutes(string hhmm) => int.Parse(hhmm[..2], CultureInfo.InvariantCulture) * 60 + int.Parse(hhmm[3..5], CultureInfo.InvariantCulture);
    private static string Hm(int minutes) { var m = ((minutes % 1440) + 1440) % 1440; return $"{m / 60:00}:{m % 60:00}"; }
    private static bool IsTime(string? s) => s is { Length: 5 } && s[2] == ':' && char.IsAsciiDigit(s[0]) && char.IsAsciiDigit(s[1]) && char.IsAsciiDigit(s[3]) && char.IsAsciiDigit(s[4]) && int.Parse(s[..2], CultureInfo.InvariantCulture) < 24 && int.Parse(s[3..5], CultureInfo.InvariantCulture) < 60;
    private static string Ordinal(int n) => n.ToString(CultureInfo.InvariantCulture);
    private static string PortName(string id) => Itinerary.PortOf(id)?.Name ?? "the port";
    private static string DateText(DateOnly d) => d.ToString("dddd d MMMM", CultureInfo.InvariantCulture);

    /// <summary>The day of the sailing today is (1 is departure day; 0 or less is before the cruise).</summary>
    public static int DayNumber(StanleyTrip t) => t.Today.DayNumber - t.Departure.DayNumber + 1;

    private static string Fp(params string[] parts)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(string.Join('\u001f', parts)));
        return Convert.ToHexString(hash)[..8].ToLowerInvariant();
    }

    /// <summary>The time a source was read, on the ship's clock, so no time stands without its clock.</summary>
    public static string ClockText(StanleyTrip trip, DateTime utc)
    {
        try
        {
            var zone = TimeZoneInfo.FindSystemTimeZoneById(trip.Timeline.ShipZoneAt(DateTime.SpecifyKind(utc, DateTimeKind.Utc)));
            var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone);
            return $"{local.ToString("HH:mm", CultureInfo.InvariantCulture)} ship time";
        }
        catch (Exception e) when (e is TimeZoneNotFoundException or InvalidTimeZoneException or ArgumentException) { return $"{utc.ToString("HH:mm", CultureInfo.InvariantCulture)} UTC"; }
    }

    private sealed record Draft(
        string Id, string Kind, string Status, string Source, string Consequence, int? Day, string Title, string What, string Why, ChangeOption Recommended, List<ChangeOption> Others,
        List<ChangeAffect> Affects, string IfNothing, string[] Where, string[] Facts, bool Tip = false);

    private static ChangeCard Make(ChangeFacts f, Draft d)
    {
        // A forecast, or a thing a source only reports, can never be the highest alert on its own: nobody is told "act now" on a guess.
        var consequence = d.Status == ChangeStatus.Forecast && d.Consequence == ChangeConsequence.Safety ? ChangeConsequence.Conflict : d.Consequence;
        var critical = ChangeConsequence.IsAlert(consequence);
        var others = d.Others.Where(o => o.Id != Person.Id).Append(Person).ToList();
        var ms = new DateTimeOffset(DateTime.SpecifyKind(f.Now, DateTimeKind.Utc)).ToUnixTimeMilliseconds();
        return new ChangeCard(
            d.Id, Fp([d.Status, consequence, .. d.Facts]), d.Kind, d.Status, d.Source, ms, ClockText(f.Trip, f.Now), consequence, critical, d.Day,
            d.Title, d.What, d.Why, d.Recommended, others, d.Affects, d.IfNothing, d.Tip, critical ? AllScreens : d.Where);
    }

    private static ChangeOption Route(string id, string label, string detail, string route) => new(id, label, detail, null, route);
    private static ChangeOption Advice(string id, string label, string detail) => new(id, label, detail, null, null);
    private static ChangeOption Act(string id, string label, string detail, string kind, params (string K, string V)[] args) =>
        new(id, label, detail, new ChangeAction(kind, args.ToDictionary(a => a.K, a => a.V)), null);

    private static List<StanleyItem> ToursOn(StanleyTrip t, int day) => [.. t.Tours.Where(x => x.Day == day)];

    private static IEnumerable<ChangeOption> DropTours(IEnumerable<StanleyItem> tours, int day) =>
        tours.Take(2).Select(x => ExcursionRules.Catalogue.FirstOrDefault(e => e.Name == x.Name)).OfType<Excursion>().Select(e =>
            Act($"drop-{e.Id}", $"Take {e.Name} off my day plan", "Only your plan on this device changes. Your booking and any refund are not touched.", StanleyActionKinds.PlanChange, ("op", "drop"), ("itemId", e.Id), ("day", Ordinal(day))));

    // ---- the sources ----

    /// <summary>Every change that matters to this guest now, most serious first. A change to something the guest has no part in produces nothing.</summary>
    public static IReadOnlyList<ChangeCard> Cards(ChangeFacts f)
    {
        var drafts = new List<Draft>();
        drafts.AddRange(ProgramDrafts(f));
        drafts.AddRange(ScenarioDrafts(f));
        drafts.AddRange(TenderDrafts(f, drafts));
        drafts.AddRange(FlightDrafts(f));
        drafts.AddRange(WeatherDrafts(f));
        drafts.AddRange(SeaDrafts(f));
        drafts.AddRange(OrderDrafts(f));
        drafts.AddRange(CaseDrafts(f));
        drafts.AddRange(SpendDrafts(f));
        return [.. drafts.Select(d => Make(f, d)).OrderBy(c => ChangeConsequence.Rank(c.Consequence)).ThenBy(c => c.Day ?? int.MaxValue).ThenBy(c => c.Id, StringComparer.Ordinal)];
    }

    private static IEnumerable<Draft> ProgramDrafts(ChangeFacts f)
    {
        var today = Math.Max(1, DayNumber(f.Trip));
        var ship = f.Trip.SailingId is null ? null : AboardPlans.ShipOfSailing(f.Trip.SailingId);
        foreach (var c in f.Program)
        {
            if (!f.Saved.Contains(c.EventId) || c.Day < today) continue;
            var ev = ProgramRules.ById(c.EventId, ship);
            var title = ev?.Title ?? "An event you saved";
            var reason = string.IsNullOrWhiteSpace(c.Reason) ? "" : " " + c.Reason.Trim();
            var days = f.Trip.Timeline.Days.FirstOrDefault(d => d.Day == c.Day);
            var when = days is null ? $"day {c.Day}" : $"day {c.Day}, {DateText(days.Date)}";
            if (c.Kind == "cancelled")
            {
                yield return new Draft($"venue:{c.EventId}:cancelled", ChangeKinds.Venue, ChangeStatus.Verified, "Ship programme", ChangeConsequence.Conflict, c.Day,
                    $"{title} is cancelled", $"{title} on {when} has been cancelled.{reason}", "You saved it, so it is still in your plan, but it will not happen.",
                    Act("drop", "Take it off my plan", "Only your plan on this device changes.", StanleyActionKinds.PlanChange, ("op", "drop"), ("itemId", c.EventId), ("day", Ordinal(c.Day))),
                    [Route("else", "See what else is on", "The programme lists everything on that day.", "/ship")],
                    [new ChangeAffect("event", title, c.Day, ev?.Start)], "It stays in your plan, but nothing will take place.", ["home", "ship", "plan"], [c.Kind, c.EventId, c.Day.ToString(CultureInfo.InvariantCulture)]);
                continue;
            }
            var start = IsTime(c.Start) ? c.Start! : "";
            var length = ev?.Minutes ?? 60;
            var dinner = start.Length == 0 ? null : f.Trip.Meals.Where(m => m.Day == c.Day && IsTime(m.Time))
                .FirstOrDefault(m => Minutes(m.Time!) < Minutes(start) + length && Minutes(start) < Minutes(m.Time!) + DinnerMinutes);
            var affects = new List<ChangeAffect> { new("event", title, c.Day, start.Length == 0 ? null : start) };
            if (dinner is not null) affects.Add(new ChangeAffect("dinner", dinner.Name, c.Day, dinner.Time));
            var earlier = dinner is null ? null : DiningRules.DinnerTimes.Where(t => Minutes(t) + DinnerMinutes + WalkMinutes <= Minutes(start) && t != dinner.Time).OrderByDescending(Minutes).FirstOrDefault();
            var move = Act("move", $"Move it to {start} in my plan", "Only your plan on this device changes.", StanleyActionKinds.PlanChange, ("op", "move"), ("itemId", c.EventId), ("day", Ordinal(c.Day)), ("to", start.Length == 0 ? "00:00" : start));
            var drop = Act("drop", "Take it off my plan", "Only your plan on this device changes.", StanleyActionKinds.PlanChange, ("op", "drop"), ("itemId", c.EventId), ("day", Ordinal(c.Day)));
            ChangeOption recommended = move;
            var others = new List<ChangeOption> { drop };
            var why = "You saved it, so your plan still shows the old time.";
            if (dinner is not null)
            {
                why = $"The new time overlaps your dinner at {dinner.Time}.";
                if (earlier is not null)
                {
                    recommended = Act("dinner", $"Move dinner to {earlier}", "Your dinner table is moved to the earlier time if one is free. You see the exact change before anything happens.", StanleyActionKinds.MoveDinner, ("day", Ordinal(c.Day)), ("time", earlier));
                    others.Insert(0, move);
                }
                else others.Insert(0, move);
            }
            yield return new Draft($"venue:{c.EventId}:moved:{start}", ChangeKinds.Venue, ChangeStatus.Verified, "Ship programme", ChangeConsequence.Conflict, c.Day,
                $"{title} has moved", $"{title} on {when} now starts at {(start.Length == 0 ? "a new time" : start + " ship time")}.{reason}", why, recommended, others, affects,
                "Your plan keeps showing the old time, so you could miss it.", ["home", "ship", "plan"], [c.Kind, c.EventId, start, dinner?.Time ?? ""]);
        }
    }

    private static ItineraryDay? PortDay(ChangeFacts f, string port) =>
        f.Trip.Timeline.Days.Where(d => d.Port == port && d.Day >= Math.Max(1, DayNumber(f.Trip))).OrderBy(d => d.Day).FirstOrDefault();

    private static ChangeOption? HeadBack(ItineraryDay day, string why)
    {
        if (day.AllAboard is not { } aboard) return null;
        var at = Hm(aboard.Hour * 60 + aboard.Minute - 90);
        return Act("remind", $"Remind me at {at} to head back", $"A reminder on this device, 90 minutes before all aboard ({aboard:HH:mm} ship time). {why}", StanleyActionKinds.RemindMe,
            ("at", at), ("text", $"Head back to the ship. All aboard is {aboard:HH:mm} ship time."));
    }

    private static IEnumerable<Draft> ScenarioDrafts(ChangeFacts f)
    {
        var today = Math.Max(1, DayNumber(f.Trip));
        foreach (var def in DisruptionRules.All)
        {
            if (!f.Scenarios.Contains(def.Id)) continue;
            switch (def.Id)
            {
                case "portSkipped":
                {
                    var day = PortDay(f, "cozumel") ?? f.Trip.Timeline.Days.Where(d => f.Trip.Timeline.IsCall(d) && d.Day >= today).OrderBy(d => d.Day).FirstOrDefault();
                    if (day is null) break;
                    var name = PortName(day.Port);
                    var tours = ToursOn(f.Trip, day.Day);
                    var affects = tours.Select(x => new ChangeAffect("tour", x.Name, day.Day, x.Time)).ToList();
                    var lost = tours.Count > 0;
                    var others = new List<ChangeOption>();
                    if (lost) others.AddRange(DropTours(tours, day.Day));
                    yield return new Draft($"portCall:{day.Port}:{day.Day}:skipped", ChangeKinds.PortCall, ChangeStatus.Verified, "Ship notice", lost ? ChangeConsequence.LostReservation : ChangeConsequence.Conflict, day.Day,
                        $"{name} has been skipped", $"The ship will not call at {name} on day {day.Day} ({DateText(day.Date)}) because of the weather. It will be at sea instead.",
                        lost ? $"You have {string.Join(" and ", tours.Select(x => x.Name))} booked there, and it cannot go ahead." : "You may have planned to go ashore that day.",
                        lost ? Route("options", "See your options for the tour", "The update screen shows the credit or refund choices. I will not pick one for you.", "/home/disruption")
                             : Route("board", "Plan a day on board", "The programme shows what is on at sea.", "/ship"),
                        others, affects, lost ? "Your tour is not delivered. Whether it is refunded or credited is for Princess to confirm." : "You stay at sea that day.",
                        ["home", "port", "ship", "plan"], [def.Id, day.Port, Ordinal(day.Day), string.Join("|", tours.Select(x => x.Name))]);
                    break;
                }
                case "belizeTender":
                {
                    var day = PortDay(f, "belize");
                    if (day is null) break;
                    var tours = ToursOn(f.Trip, day.Day);
                    var affects = tours.Select(x => new ChangeAffect("tour", x.Name, day.Day, x.Time)).ToList();
                    var isToday = day.Day == DayNumber(f.Trip);
                    var consequence = isToday ? ChangeConsequence.Safety : tours.Count > 0 ? ChangeConsequence.Conflict : ChangeConsequence.Optional;
                    var back = HeadBack(day, "Tender boats may queue.");
                    yield return new Draft($"tender:{day.Port}:{day.Day}:delay", ChangeKinds.Tender, ChangeStatus.Verified, "Ship notice", consequence, day.Day,
                        $"Tender boats at {PortName(day.Port)} are running late", $"The tender boats at {PortName(day.Port)} on day {day.Day} are delayed by the weather and sea conditions.",
                        tours.Count > 0 ? $"Your {string.Join(" and ", tours.Select(x => x.Name))} may start late, and the queue back to the ship is longer." : "The queue back to the ship will be longer than usual.",
                        back ?? Route("port", "Read the port page", "It says what to do when the tender is delayed.", $"/home/ports/{day.Port}"),
                        back is null ? [] : [Route("port", "Read the port page", "It says what to do when the tender is delayed.", $"/home/ports/{day.Port}")], affects,
                        "Nothing changes on your booking. The ship still leaves at its time, so leave more time to return.", ["home", "port", "ship"], [def.Id, day.Port, Ordinal(day.Day)]);
                    break;
                }
                case "clockChange":
                {
                    var day = f.Trip.Timeline.Days.Where(d => d.ClockChangeHours is not null and not 0 && d.Day >= today).OrderBy(d => d.Day).FirstOrDefault();
                    if (day?.ClockChangeHours is not { } hours) break;
                    var at = day.ClockChangeAt ?? new TimeOnly(2, 0);
                    var hourText = Math.Abs(hours) == 1 ? "1 hour" : $"{Math.Abs(hours)} hours";
                    var dir = hours > 0 ? "forward" : "back";
                    var soon = day.Day - today <= 1;
                    var remindAt = Hm(at.Hour * 60 + at.Minute - 120);
                    yield return new Draft($"itinerary:clock:{day.Day}", ChangeKinds.Itinerary, ChangeStatus.Verified, "Ship notice", soon ? ChangeConsequence.Conflict : ChangeConsequence.Optional, day.Day,
                        "The ship's clocks are changing", $"The ship's clocks move {hourText} {dir} at {at:HH:mm} on day {day.Day}.",
                        "Your phone may or may not change on its own. Reminders and the all-aboard time follow the ship's clock.",
                        Act("remind", $"Remind me at {remindAt}", "A reminder on this device before the clocks move.", StanleyActionKinds.RemindMe, ("at", remindAt), ("text", $"Ship clocks move {hourText} {dir} at {at:HH:mm}.")),
                        [Route("updates", "Read the notice", "It explains what changes for the day.", "/home/updates")], [], "Nothing is lost, but a time read on your phone may be an hour out.", ["home", "ship", "plan"], [def.Id, Ordinal(day.Day), Ordinal(hours)]);
                    break;
                }
                case "terminalChange":
                {
                    if (DayNumber(f.Trip) > 1) break;
                    var embark = DayNumber(f.Trip) == 1;
                    yield return new Draft("itinerary:terminal:1", ChangeKinds.Itinerary, ChangeStatus.Verified, "Ship notice", embark ? ChangeConsequence.Safety : ChangeConsequence.Conflict, 1,
                        "Your embarkation terminal has changed", "The terminal for boarding has changed. Your boarding pass shows the new one.",
                        "Going to the old terminal could make you late for check-in, which has a cut-off.",
                        Route("pass", "Open your boarding pass", "It shows the terminal and your arrival window.", "/home/boarding-pass"), [], [new ChangeAffect("boarding", "Embarkation", 1, null)],
                        "Your booking is unchanged, but you could arrive at the wrong terminal.", ["home", "travel"], [def.Id]);
                    break;
                }
            }
        }
    }

    private static IEnumerable<Draft> TenderDrafts(ChangeFacts f, List<Draft> sofar)
    {
        foreach (var t in f.Tenders)
        {
            if (t.Band == "good" || !DateOnly.TryParseExact(t.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)) continue;
            var day = f.Trip.Timeline.Days.FirstOrDefault(d => d.Date == date && d.Port == t.Port);
            if (day is null || day.Day < Math.Max(1, DayNumber(f.Trip))) continue;
            // A ship notice for the same port and day already says it, with more certainty.
            if (sofar.Any(d => d.Kind == ChangeKinds.Tender && d.Id.StartsWith($"tender:{t.Port}:{day.Day}:", StringComparison.Ordinal))) continue;
            var tours = ToursOn(f.Trip, day.Day);
            var back = HeadBack(day, "The tender outlook is only a forecast.");
            yield return new Draft($"tender:{t.Port}:{day.Day}:outlook", ChangeKinds.Tender, ChangeStatus.Forecast, "Tender outlook", tours.Count > 0 ? ChangeConsequence.Conflict : ChangeConsequence.Optional, day.Day,
                $"Tender boats at {PortName(t.Port)} may be affected", $"The tender outlook for {PortName(t.Port)} on day {day.Day} is {(t.Band == "rough" ? "poor" : "mixed")}: about {t.Percent} in 100 that boats run late or are called off. This is an outlook, not a decision; the captain decides on the day.",
                tours.Count > 0 ? $"You have {string.Join(" and ", tours.Select(x => x.Name))} booked there." : "If you plan to go ashore, you may wait longer.",
                back ?? Route("port", "Read the port page", "It says what to do when the tender is delayed.", $"/home/ports/{t.Port}"),
                back is null ? [] : [Route("port", "Read the port page", "It says what to do when the tender is delayed.", $"/home/ports/{t.Port}")],
                [.. tours.Select(x => new ChangeAffect("tour", x.Name, day.Day, x.Time))], "Nothing changes unless the captain decides it on the day.", ["home", "port", "ship"], [t.Port, Ordinal(day.Day), t.Band]);
        }
    }

    private static IEnumerable<Draft> FlightDrafts(ChangeFacts f)
    {
        if (f.Flight is not { State: "ok" } flight || flight.Status is not ("delayed" or "cancelled")) yield break;
        var last = f.Trip.Timeline.LastDay;
        var away = last.DayNumber - f.Trip.Today.DayNumber;
        if (away is < 0 or > 3) yield break;
        var status = flight.Confidence == "provider" ? ChangeStatus.Verified : ChangeStatus.Provisional;
        var number = flight.Flight ?? "your flight";
        var affects = new List<ChangeAffect> { new("flight", number, f.Trip.Timeline.Days.Count, flight.NewFlightAt ?? flight.FlightAt) };
        var onward = Route("onward", "Open Onward travel", "It rechecks the flight and lists the ways off the ship that still work.", "/home/disembark/onward");
        if (flight.Status == "cancelled")
        {
            yield return new Draft($"flight:{number}:{last:yyyyMMdd}:cancelled", ChangeKinds.Flight, status, "Flight status feed", ChangeConsequence.Safety, f.Trip.Timeline.Days.Count,
                $"Flight {number} is cancelled", $"Flight {number} on {DateText(last)} has been cancelled.", "You planned to fly home that day, and your walk-off plan was built around it.",
                Route("airline", "Contact the airline to rebook", "I cannot rebook it and have changed nothing. Your onward travel screen has the details you saved.", "/home/disembark/onward"), [], affects,
                "Your flight does not leave. Nothing on the ship side changes by itself.", ["home", "travel"], [number, "cancelled"]);
            yield break;
        }
        var minutes = flight.DelayMinutes;
        var consequence = flight.Verdict switch
        {
            "tight" or "cancelled" or "noFlight" => ChangeConsequence.Safety,
            "tooEarly" => ChangeConsequence.Improvement,
            _ => minutes >= 60 ? ChangeConsequence.Improvement : ChangeConsequence.Optional,
        };
        var alt = flight.Alternatives.FirstOrDefault();
        var recommended = consequence == ChangeConsequence.Safety || consequence == ChangeConsequence.Improvement
            ? Route("ways", alt is null ? "See the ways off the ship" : "See the way off that now works", alt?.Text ?? "Onward travel lists the ways off the ship that still work with the new time.", "/home/disembark/onward")
            : onward;
        yield return new Draft($"flight:{number}:{last:yyyyMMdd}:delayed:{minutes}", ChangeKinds.Flight, status, "Flight status feed", consequence, f.Trip.Timeline.Days.Count,
            $"Flight {number} is about {minutes} minutes late", $"Flight {number} on {DateText(last)} is about {minutes} minutes late{(flight.NewFlightAt is null ? "" : $", now {flight.NewFlightAt} {flight.Clock}")}.",
            flight.Verdict switch
            {
                "tight" => "With the delay your walk-off plan is tight, so you could miss the flight.",
                "tooEarly" => "With the delay you would reach the airport much too early, so a later walk-off may suit you better.",
                _ => minutes >= 60 ? "You have more time aboard than you planned, if you want it." : "You still make it, with about the margin you planned.",
            },
            recommended, [], affects, "Your plan stays as it is. Your walk-off choice is never changed for you.", ["home", "travel"], [number, "delayed", Ordinal(minutes), flight.Verdict]);
    }

    private static IEnumerable<Draft> WeatherDrafts(ChangeFacts f)
    {
        var today = Math.Max(1, DayNumber(f.Trip));
        foreach (var s in f.Skies)
        {
            if (s.Day < today || s.Day > today + 1 || !IsTime(s.RainFrom) || !IsTime(s.RainTo)) continue;
            var rainFrom = Minutes(s.RainFrom!);
            var rainTo = Minutes(s.RainTo!);
            var hit = ToursOn(f.Trip, s.Day).Where(x => IsTime(x.Time)).Select(x => (Tour: x, Hours: ExcursionRules.Catalogue.FirstOrDefault(e => e.Name == x.Name)?.Hours ?? 3))
                .Where(x => Minutes(x.Tour.Time!) < rainTo && rainFrom < Minutes(x.Tour.Time!) + (int)(x.Hours * 60)).Select(x => x.Tour).ToList();
            if (hit.Count == 0) continue;
            var name = PortName(s.Port);
            yield return new Draft($"weather:rain:{s.Day}", ChangeKinds.Weather, ChangeStatus.Forecast, "Weather forecast", ChangeConsequence.Conflict, s.Day,
                $"Rain is forecast at {name}", $"Rain is forecast at {name} on day {s.Day} between {s.RainFrom} and {s.RainTo} (port time). This is a forecast and may not happen.",
                $"It overlaps {string.Join(" and ", hit.Select(x => x.Name))}.",
                Advice("keep", "Keep the tour and take rain cover", "Your booking has not changed. The tour operator decides whether it runs; I cannot say."),
                [Route("port", "See the port page", "It lists indoor things to do ashore.", $"/home/ports/{s.Port}")], [.. hit.Select(x => new ChangeAffect("tour", x.Name, s.Day, x.Time))],
                "Nothing changes on your booking.", ["home", "port", "plan"], [s.Port, Ordinal(s.Day), s.RainFrom!, s.RainTo!]);
        }
    }

    /// <summary>The rough-seas companion: a quiet, non-medical tip while the ship is underway in a rougher sea. It is a suggestion like any other.</summary>
    private static IEnumerable<Draft> SeaDrafts(ChangeFacts f)
    {
        var day = DayNumber(f.Trip);
        if (f.Sea is not { } sea || day < 1 || day > f.Trip.Timeline.Days.Count || (sea.SwellM < 1.5 && sea.WaveM < 1.0)) yield break;
        var band = sea.SwellM >= 2.5 || sea.WaveM >= 2.0 ? "rough" : "moderate";
        yield return new Draft($"weather:seas:{day}", ChangeKinds.Weather, ChangeStatus.Verified, "Ship sea-state reading", ChangeConsequence.Optional, day,
            "The sea is rougher than usual", $"The swell is about {sea.SwellM:0.#} m and the waves about {sea.WaveM:0.#} m.",
            "A rougher sea can make walking and eating harder. This is general advice, not medical advice.",
            Route("seasick", "Read the reviewed page on seasickness", "It is written and checked by the line. If you feel unwell, ask a person.", "/ship/seasick"),
            [Advice("midship", "Stay midship, lower down", "The middle of the ship on lower decks moves the least.")], [], "Nothing changes. This is only a heads-up.", ["home", "ship"], [band],
            Tip: true);
    }

    /// <summary>
    /// The gentle mid-week spend pace (phase 12): "at this pace you will be around X" against the budget the guest set. It is a projection, so its status is forecast and it is never an alert; it is an improvement
    /// suggestion when the pace is over the budget and optional when it is close, so the guest's proactivity level and quiet hours decide whether it is shown. Only a move of more than fifty dollars in the projection makes it a new card.
    /// </summary>
    private static IEnumerable<Draft> SpendDrafts(ChangeFacts f)
    {
        if (f.Spend?.Pace is not { } p || !StanleyMoneyRules.PaceAlertWorthy(p) || p.ProjectedTotalCents is not { } projected || p.BudgetCents is not { } budget) yield break;
        var over = p.State == "over";
        yield return new Draft("spend:pace", ChangeKinds.Spend, ChangeStatus.Forecast, "Your onboard account", over ? ChangeConsequence.Improvement : ChangeConsequence.Optional, p.Day,
            $"At this pace you will be around {StanleyMoneyRules.Money(projected)}",
            string.Join(" ", p.Lines.Take(3)),
            over ? $"You set a budget of {StanleyMoneyRules.Money(budget)}, and this pace is about {StanleyMoneyRules.Money(p.OverCents ?? 0)} over it." : $"You set a budget of {StanleyMoneyRules.Money(budget)}, and this pace is close to it.",
            Route("bill", "See what is on your bill", "Each charge is listed with its state: posted, pending or questioned.", "/me/bill"),
            [Advice("pace", "Nothing needs to change", "A budget is yours to keep or move. I will not stop anything you buy.")], [], "Nothing changes. This is only a heads-up, and a straight-line guess from the days so far.", ["home", "ship"],
            [p.State, (projected / 5_000).ToString(CultureInfo.InvariantCulture)], Tip: true);
    }

    private static IEnumerable<Draft> OrderDrafts(ChangeFacts f)
    {
        foreach (var o in f.Orders)
        {
            if (o.Unavailable <= 0 || o.Stage is "cancelled" or "delivered") continue;
            yield return new Draft($"order:{o.Id}:unavailable", ChangeKinds.Order, ChangeStatus.Provisional, "Your order", ChangeConsequence.Conflict, null,
                "Part of your order is unavailable", $"{(o.Unavailable == 1 ? "One item" : o.Unavailable + " items")} in your order cannot be sent right now.", "The rest of the order is still on its way, so it will arrive without them.",
                Route("order", "Review your order", "It shows what is left and what you can do.", "/ship/order"), [], [new ChangeAffect("order", "Your order", 0, null)],
                "The rest of the order arrives without them.", ["home", "ship"], [o.Id, o.Stage, Ordinal(o.Unavailable)]);
        }
    }

    private static IEnumerable<Draft> CaseDrafts(ChangeFacts f)
    {
        var now = new DateTimeOffset(DateTime.SpecifyKind(f.Now, DateTimeKind.Utc)).ToUnixTimeMilliseconds();
        foreach (var c in f.Cases)
        {
            if (c.Stage == "resolved" && c.Outcome is not null && now - c.DueAt <= (long)TimeSpan.FromDays(14).TotalMilliseconds)
            {
                yield return new Draft($"case:{c.Number}:resolved", ChangeKinds.Case, ChangeStatus.Verified, "Guest Services", ChangeConsequence.Optional, null,
                    $"Your case {c.Number} has an answer", $"Guest Services has answered your {CaseWord(c.Kind)} case {c.Number}.", "You asked for this, so the answer is waiting for you.",
                    Route("read", "Read the answer", "The case shows the answer and any next step.", "/me/cases"), [], [new ChangeAffect("case", c.Number, 0, null)], "Nothing changes. The answer stays in your cases.", ["home"], [c.Number, c.Stage, c.Outcome]);
            }
            else if (c.Stage is "received" or "inReview" && now > c.DueAt)
            {
                yield return new Draft($"case:{c.Number}:late", ChangeKinds.Case, ChangeStatus.Verified, "Guest Services", ChangeConsequence.Conflict, null,
                    $"Your case {c.Number} is past its reply time", $"Your {CaseWord(c.Kind)} case {c.Number} should have had an answer by now.", "You have not had the reply you were told to expect.",
                    Route("ask", "Ask a person to look at it", "The cases screen has the case number to quote.", "/me/cases"), [], [new ChangeAffect("case", c.Number, 0, null)], "The case stays open.", ["home"], [c.Number, c.Stage, "late"]);
            }
        }
    }

    private static string CaseWord(string kind) => kind switch { "lostItem" => "lost item", "billing" => "billing", "claim" => "claim", "complaint" => "complaint", _ => "service" };

    // ---- the six questions ----

    private static string StatusText(string status) => status switch
    {
        ChangeStatus.Verified => "This is confirmed by the source named here.",
        ChangeStatus.Provisional => "This is reported but could still change.",
        _ => "This is a forecast, not a fact. It may not happen.",
    };

    /// <summary>Answers the six questions from the card alone. The card was built from the event and what the guest holds, so nothing here depends on what was said in chat.</summary>
    public static ChangeExplanation Explain(ChangeCard c)
    {
        var affects = c.Affects.Count == 0 ? "" : " It touches: " + string.Join("; ", c.Affects.Select(a => a.Time is null ? a.Name : $"{a.Name} at {a.Time}")) + ".";
        var action = c.Recommended.Action is null ? "" : " I can prepare it for you to look at. Nothing happens until you confirm.";
        var others = string.Join(" ", c.Others.Select(o => $"{o.Label}: {o.Detail}"));
        return new ChangeExplanation(c.Id, c.Title,
        [
            new("what", "What changed?", c.What),
            new("sure", "How sure is this, and who says so?", $"{StatusText(c.Status)} Source: {c.Source}, read at {c.SourceAtText}."),
            new("affects", "Why does it affect me?", c.Why + affects),
            new("recommend", "What do you recommend?", $"{c.Recommended.Label}. {c.Recommended.Detail}{action}"),
            new("others", "What else could I do?", others),
            new("nothing", "What happens if I do nothing?", c.IfNothing + " I have not changed anything for you."),
        ]);
    }

    // ---- delivery rules ----

    /// <summary>The most a guest at this proactivity level is told unprompted: <c>affects</c> only what touches their plan, <c>suggest</c> adds improvements, <c>guide</c> adds the rest.</summary>
    public static bool LevelAdmits(string level, string consequence) => level switch
    {
        "affects" => ChangeConsequence.Rank(consequence) <= ChangeConsequence.Rank(ChangeConsequence.Conflict),
        "suggest" => ChangeConsequence.Rank(consequence) <= ChangeConsequence.Rank(ChangeConsequence.Improvement),
        "guide" => true,
        _ => false,
    };

    public static bool Dismissed(ChangeMemory memory, ChangeCard c) => memory.Seen.TryGetValue(c.Id, out var s) && s.DismissedFp == c.Fingerprint;

    /// <summary>
    /// What to show on one screen. Alerts (a safety or deadline risk, a lost reservation) are kept apart from suggestions: they ignore quiet hours and the session count, and only an acknowledgement
    /// hides them. A suggestion needs the guest's level, quiet hours to be over, a card that suits the screen, that it was not shown this session, fewer than three shown this session, and is the only
    /// one on the screen. A dismissed card stays dismissed until its facts change.
    /// </summary>
    public static ChangeDelivery Deliver(IReadOnlyList<ChangeCard> cards, ChangeMemory memory, string screen, string level, IReadOnlyCollection<string> shown, bool quiet, ChangeMissed? missed = null)
    {
        var held = new List<ChangeHeld>();
        if (level == "off") return new([], null, [.. cards.Select(c => new ChangeHeld(c.Id, "off"))]);
        var alerts = new List<ChangeCard>();
        ChangeCard? suggestion = null;
        foreach (var c in cards)
        {
            if (Dismissed(memory, c)) { held.Add(new(c.Id, "dismissed")); continue; }
            if (c.Critical)
            {
                if (alerts.Count < MaxAlerts) alerts.Add(c); else held.Add(new(c.Id, "alertCap"));
                continue;
            }
            if (!LevelAdmits(level, c.Consequence)) held.Add(new(c.Id, "level"));
            else if (!c.Where.Contains(screen)) held.Add(new(c.Id, "screen"));
            else if (shown.Contains(c.Id)) held.Add(new(c.Id, "shown"));
            else if (shown.Count >= MaxPerSession) held.Add(new(c.Id, "sessionCap"));
            else if (quiet) held.Add(new(c.Id, "quiet"));
            else if (suggestion is not null) held.Add(new(c.Id, "oneOnScreen"));
            else suggestion = c;
        }
        // "What did I miss?": on Home, when two or more suggestions are new since the guest last caught up, one digest stands in for the single suggestion, so the screen still has one proactive element.
        ChangeMissed? digest = null;
        if (missed is { } m && screen == "home" && !quiet && !shown.Contains(DigestId) && shown.Count < MaxPerSession)
        {
            var eligible = m.Cards.Where(c => !c.Critical && LevelAdmits(level, c.Consequence) && !Dismissed(memory, c)).ToList();
            if (eligible.Count >= 2)
            {
                digest = new ChangeMissed(m.Since, eligible, eligible.Count);
                if (suggestion is not null) held.Add(new(suggestion.Id, "digest"));
                suggestion = null;
            }
        }
        return new(alerts, suggestion, held, digest);
    }

    /// <summary>The id the device records when the digest was shown, so it counts toward the three a session.</summary>
    public const string DigestId = "digest";

    // ---- memory: first noticed, dismissed, caught up ----

    /// <summary>Records when each change (in the form it has now) was first noticed. A card whose facts changed counts as noticed again. Gone cards are forgotten after thirty days.</summary>
    public static ChangeMemory Observe(ChangeMemory memory, IReadOnlyList<ChangeCard> cards, long now)
    {
        var seen = new Dictionary<string, ChangeSeen>(memory.Seen);
        foreach (var c in cards)
        {
            if (!seen.TryGetValue(c.Id, out var s)) seen[c.Id] = new ChangeSeen(c.Fingerprint, now);
            else if (s.Fp != c.Fingerprint) seen[c.Id] = s with { Fp = c.Fingerprint, At = now };
        }
        var live = cards.Select(c => c.Id).ToHashSet();
        var cutoff = now - (long)SeenStays.TotalMilliseconds;
        foreach (var id in seen.Keys.Where(k => !live.Contains(k) && seen[k].At < cutoff).ToList()) seen.Remove(id);
        while (seen.Count > MaxSeen && seen.Where(kv => !live.Contains(kv.Key)).OrderBy(kv => kv.Value.At).Select(kv => kv.Key).FirstOrDefault() is { } oldest) seen.Remove(oldest);
        return memory with { Seen = seen, LastOpenAt = memory.LastOpenAt ?? now };
    }

    /// <summary>The cards with the time each was first noticed.</summary>
    public static IReadOnlyList<ChangeCard> Noticed(IReadOnlyList<ChangeCard> cards, ChangeMemory memory) =>
        [.. cards.Select(c => memory.Seen.TryGetValue(c.Id, out var s) && s.Fp == c.Fingerprint ? c with { NoticedAt = s.At } : c)];

    public static ChangeMemory Dismiss(ChangeMemory memory, ChangeCard card) =>
        memory with { Seen = new Dictionary<string, ChangeSeen>(memory.Seen) { [card.Id] = (memory.Seen.TryGetValue(card.Id, out var s) ? s : new ChangeSeen(card.Fingerprint, 0)) with { Fp = card.Fingerprint, DismissedFp = card.Fingerprint } } };

    public static ChangeMemory CaughtUp(ChangeMemory memory, long now) => memory with { LastOpenAt = now };

    /// <summary>"What did I miss?": the changes first noticed since the guest last caught up, ranked by the same consequence order. Nothing to compare with the first time, so nothing is claimed as missed.</summary>
    public static ChangeMissed Missed(IReadOnlyList<ChangeCard> noticed, ChangeMemory memory)
    {
        if (memory.LastOpenAt is not { } since) return new(null, [], 0);
        var cards = noticed.Where(c => c.NoticedAt > since && !Dismissed(memory, c)).ToList();
        return new(since, [.. cards.Take(MaxMissed)], cards.Count);
    }

    // ---- push and chat ----

    /// <summary>Whether a card is also sent to the phone: alerts (a lost reservation, a deadline risk) and a case that has an answer. A forecast and a tip never are.</summary>
    public static bool PushWorthy(ChangeCard c) => c.Status != ChangeStatus.Forecast && !c.Tip && (c.Critical || (c.Kind == ChangeKinds.Case && c.Consequence == ChangeConsequence.Optional));

    /// <summary>Whether a message asks what has changed. The scripted resolver answers it, so this only keeps the two in step.</summary>
    public static bool IsExplainQuestion(string message) =>
        System.Text.RegularExpressions.Regex.IsMatch(message ?? "", @"\bexplain\b.{0,30}\b(change|changes|notice|update)\b|\bwhy (did|has|have) (it|that|this|the .{1,30}) (change|moved?|cancel)", System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));

    /// <summary>The chat answer to "what changed": the top changes with their status, or an honest "none on record", and a note when a source could not be read.</summary>
    public static StanleyCardDto ChatCard(IReadOnlyList<ChangeCard> cards, IReadOnlyList<string> unread, DateTime asOf)
    {
        var lines = new List<string>();
        foreach (var c in cards.Take(3)) lines.Add($"{c.Title}. {c.What} ({c.Status}, {c.Source}, {c.SourceAtText}.)");
        if (cards.Count > 3) lines.Add($"There are {cards.Count - 3} more on the Home screen.");
        if (cards.Count == 0) lines.Add("I have no change on record that affects your trip.");
        if (unread.Count > 0) lines.Add($"I could not read {string.Join(" or ", unread)} just now, so this may be incomplete.");
        var chips = new List<string> { StanleyChips.Booking, StanleyChips.Schedule };
        return new StanleyCardDto("changed", "What changed", lines,
            new StanleyProvenance(chips, "Stanley's change log", asOf, unread.Count > 0 ? "provisional" : "live", unread.Count > 0 || cards.Any(c => c.Critical), unread.Count > 0 ? "Some sources could not be read." : "Each change names its source and how sure it is."),
            false, [new CitationDto("Notices", "/home/updates")]);
    }

    /// <summary>The chat answer to "explain this change": the six questions for the most serious change.</summary>
    public static StanleyCardDto ExplainChatCard(IReadOnlyList<ChangeCard> cards, DateTime asOf)
    {
        if (cards.Count == 0)
            return new StanleyCardDto("changed", "Explain this change", ["I have no change on record that affects your trip, so there is nothing to explain."],
                new StanleyProvenance([StanleyChips.Booking], "Stanley's change log", asOf, "live", false, "No change on record."), false);
        var e = Explain(cards[0]);
        return new StanleyCardDto("changed", e.Title, [.. e.Questions.Select(q => $"{q.Question} {q.Answer}")],
            new StanleyProvenance([StanleyChips.Booking, StanleyChips.Schedule], "Stanley's change log", asOf, cards[0].Status == ChangeStatus.Forecast ? "estimated" : "live", cards[0].Critical, "Answered from the change itself."), false,
            [new CitationDto("Notices", "/home/updates")]);
    }

    // ---- request checks ----

    public static bool ValidSaved(IEnumerable<string>? saved) =>
        saved is null || (saved.Count() <= MaxSaved && saved.All(s => s is { Length: > 0 and <= 40 } && s.All(ch => char.IsAsciiLetterOrDigit(ch) || ch is '-' or '_')));

    public static bool ValidShown(IEnumerable<string>? shown) =>
        shown is null || (shown.Count() <= 20 && shown.All(s => s is { Length: > 0 and <= 120 } && s.All(ch => char.IsAsciiLetterOrDigit(ch) || ch is '-' or '_' or ':')));
}
