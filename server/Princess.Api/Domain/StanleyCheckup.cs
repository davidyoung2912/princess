using System.Globalization;

namespace Princess.Api.Domain;

/// <summary>Where a "Fix this" goes: the screen in the app where the problem is put right. A check-up never changes anything itself.</summary>
public sealed record CheckFix(string Label, string Route);

/// <summary>
/// One thing the check-up found. <see cref="Id"/> is stable for the same problem; <see cref="Consequence"/> is a <see cref="ChangeConsequence"/> so findings rank the same way change cards do.
/// <see cref="Rule"/> is CHK-01 (trip), CHK-02 (plan) or CHK-08 (deadline).
/// </summary>
public sealed record CheckFinding(string Id, string Rule, string Consequence, string Title, string Detail, int? Day, string? Due, CheckFix Fix);

/// <summary>A date that can cost money or access (CHK-08), most serious first, with the days left (negative when it has passed).</summary>
public sealed record CheckDeadline(string Id, string Consequence, string Title, string Date, int DaysLeft, CheckFix Fix);

/// <summary>A traveller on the booking by position only ("Traveller 2"): no name, number or document detail ever enters the check-up.</summary>
public sealed record CheckTraveller(int Position, int Age, DocumentRules.GuestDocs Docs);

/// <summary>A booked tour as the plan lint reads it: its day, name, start in port time and length in hours.</summary>
public sealed record CheckTour(int Day, string Name, string Start, double Hours);

public sealed record CheckupFacts(
    DateOnly Today, DateTime Now, DateOnly Departure, int Nights, Timeline Timeline, string PaymentState, DateOnly? FinalDue, string CheckinState, DateTime CheckinOpensAt, DateTime CheckinClosesAt,
    bool AgentBooking, IReadOnlyList<CheckTraveller> Travellers, IReadOnlyList<CheckTour> Tours, IReadOnlyList<StanleyItem> Meals);

/// <summary>What the guest is shown: ranked findings, the deadline radar, and what was not checked and why (never silence presented as "all clear").</summary>
public sealed record CheckupDto(bool HasTrip, IReadOnlyList<CheckFinding> Findings, IReadOnlyList<CheckDeadline> Deadlines, IReadOnlyList<string> NotChecked, bool Clean, string? AsOf);

/// <summary>
/// Trip check-up (CHK-01), plan lint (CHK-02) and deadline radar (CHK-08), docs/stanley-actions-and-proactive-plan.md section 4.B. Pure and deterministic: the same facts always give the same findings in the same order.
/// A check that needs data we do not hold is listed in <see cref="NotChecked"/> instead of passing quietly.
/// </summary>
public static class StanleyCheckupRules
{
    public const int TightMinutes = 60;      // a tour should end this long before all aboard
    public const int ArrivalMinutes = 30;    // a tour should start this long after the ship arrives
    public const int DinnerMinutes = 30;     // a tour should end this long before dinner
    public const int ClosingSoonHours = 24;
    public const int MissingSoonDays = 14;

    private const string Docs = "/me/documents", Pay = "/me/payments", Checkin = "/home/check-in", Plan = "/plan/autopilot", Excursions = "/excursions-explorer", Dining = "/dining-today";

    private static int Minutes(string hhmm) => int.Parse(hhmm[..2], CultureInfo.InvariantCulture) * 60 + int.Parse(hhmm[3..5], CultureInfo.InvariantCulture);
    private static string Hm(int minutes) => $"{minutes / 60:00}:{minutes % 60:00}";
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    private static string Long(DateOnly d) => d.ToString("dddd d MMMM", CultureInfo.InvariantCulture);
    private static string Who(CheckupFacts f, CheckTraveller t) => f.Travellers.Count == 1 ? "Your" : $"Traveller {t.Position}'s";
    private static bool TryHm(string? s) => s is { Length: 5 } && s[2] == ':' && int.TryParse(s[..2], out var h) && int.TryParse(s[3..], out var m) && h is >= 0 and < 24 && m is >= 0 and < 60;

    /// <summary>What this check-up cannot see, said plainly.</summary>
    public static IReadOnlyList<string> NotChecked(CheckupFacts f)
    {
        var list = new List<string> { "Flights and your travel-day connection", "Whether names match documents", "Whether a tour suits a traveller's pace or access" };
        if (f.AgentBooking) list.Insert(0, "Documents (your travel agent handles them on this booking)");
        return list;
    }

    public static IReadOnlyList<CheckFinding> Findings(CheckupFacts f)
    {
        var list = new List<CheckFinding>();
        list.AddRange(Trip(f));
        list.AddRange(PlanLint(f));
        return [.. list.OrderBy(x => ChangeConsequence.Rank(x.Consequence)).ThenBy(x => x.Day ?? 0).ThenBy(x => x.Id, StringComparer.Ordinal)];
    }

    // ---- CHK-01: the trip ----

    private static IEnumerable<CheckFinding> Trip(CheckupFacts f)
    {
        var returns = f.Departure.AddDays(f.Nights);
        var daysToGo = f.Departure.DayNumber - f.Today.DayNumber;

        var seen = new HashSet<string>();
        if (!f.AgentBooking)
            foreach (var t in f.Travellers)
                foreach (var r in t.Docs.Results.Where(x => x.Status != "ready"))
                {
                    // One passport problem would otherwise show once for every requirement it fails (proof of citizenship, photo ID, passport).
                    var id = r.Status == "problem" ? $"doc:{t.Position}:{r.UsedDoc}:{r.Problem}" : $"doc:{t.Position}:{r.Requirement.Id}";
                    if (!seen.Add(id)) continue;
                    var fix = new CheckFix("Open my documents", Docs);
                    if (r.Status == "problem")
                    {
                        var (title, detail) = r.Problem switch
                        {
                            "tooSoon" => ($"{Who(f, t)} passport is too close to expiring", $"A passport should be valid for {DocumentRules.PassportValidMonths} months after you return on {Long(returns)}, that is until {Long(DocumentRules.PassportValidUntil(returns))}. Check the rule for each country on your route."),
                            "expired" => ($"{Who(f, t)} {Name(r)} expires before the cruise ends", $"It must be in date until you return on {Long(returns)}."),
                            _ => ($"{Who(f, t)} {Name(r)} has no expiry date saved", "Add the date so it can be checked."),
                        };
                        yield return new CheckFinding(id, "CHK-01", r.Problem == "noExpiry" ? ChangeConsequence.Conflict : ChangeConsequence.LostReservation, title, detail, null, null, fix);
                    }
                    else if (r.Requirement.Level == "required")
                        yield return new CheckFinding(id, "CHK-01", daysToGo <= MissingSoonDays ? ChangeConsequence.LostReservation : ChangeConsequence.Conflict,
                            $"{Who(f, t)} {Name(r)} is not saved yet", $"Save it before you sail on {Long(f.Departure)}. Stanley only records that you hold it; it is never an official check.", null, null, fix);
                }

        if (f.PaymentState == "overdue")
            yield return new CheckFinding("pay:overdue", "CHK-01", ChangeConsequence.LostReservation, "Your final payment is overdue", f.FinalDue is { } d ? $"It was due on {Long(d)}." : "The balance is past its due date.", null, f.FinalDue is { } o ? Iso(o) : null, new CheckFix("Open payments", Pay));
        else if (f.PaymentState == "dueSoon")
            yield return new CheckFinding("pay:due", "CHK-01", ChangeConsequence.Conflict, "Your final payment is coming due", f.FinalDue is { } d ? $"It is due on {Long(d)}." : "The balance is due soon.", null, f.FinalDue is { } o ? Iso(o) : null, new CheckFix("Open payments", Pay));

        if (f.CheckinState == "open")
        {
            var closes = (f.CheckinClosesAt - f.Now).TotalHours;
            yield return new CheckFinding("checkin:open", "CHK-01", closes <= ClosingSoonHours ? ChangeConsequence.LostReservation : ChangeConsequence.Conflict,
                closes <= ClosingSoonHours ? "Online check-in closes within a day" : "Online check-in is open and not finished", "Finish it to get your boarding pass.", null, null, new CheckFix("Go to check-in", Checkin));
        }
    }

    private static string Name(DocumentRules.ReqResult r) => r.UsedDoc is { } d ? DocName(d) : DocName(r.Requirement.Id);

    private static string DocName(string id) => id switch
    {
        "passport" => "passport",
        "birthCertificate" => "birth certificate",
        "photoId" => "photo ID",
        "proofOfCitizenship" => "proof of citizenship",
        "insurance" => "travel insurance",
        _ => "document",
    };

    // ---- CHK-02: the plan ----

    private static IEnumerable<CheckFinding> PlanLint(CheckupFacts f)
    {
        foreach (var group in f.Tours.Where(x => TryHm(x.Start)).GroupBy(x => x.Day))
        {
            var day = f.Timeline.Days.FirstOrDefault(d => d.Day == group.Key);
            var spans = group.Select(x => (Tour: x, Start: Minutes(x.Start), End: Minutes(x.Start) + (int)Math.Round(x.Hours * 60))).OrderBy(x => x.Start).ToList();
            foreach (var s in spans)
            {
                var id = $"tour:{s.Tour.Day}:{s.Tour.Name}";
                var fix = new CheckFix("Review my tour", Excursions);
                if (day?.AllAboard is { } back)
                {
                    var abd = back.Hour * 60 + back.Minute;
                    if (s.End > abd)
                        yield return new CheckFinding($"{id}:after-aboard", "CHK-02", ChangeConsequence.LostReservation, $"{s.Tour.Name} ends after all aboard", $"It ends about {Hm(s.End)} and the ship is all aboard at {Hm(abd)}. Pick a shorter tour or move it.", s.Tour.Day, null, fix);
                    else if (s.End > abd - TightMinutes)
                        yield return new CheckFinding($"{id}:tight", "CHK-02", ChangeConsequence.Conflict, $"{s.Tour.Name} leaves little time before all aboard", $"It ends about {Hm(s.End)} and the ship is all aboard at {Hm(abd)}. Aim to be back an hour early.", s.Tour.Day, null, fix);
                }
                if (day?.Arrive is { } arrive && s.Start < arrive.Hour * 60 + arrive.Minute + ArrivalMinutes)
                    yield return new CheckFinding($"{id}:early", "CHK-02", ChangeConsequence.Conflict, $"{s.Tour.Name} starts before you can be ashore", $"The ship arrives at {arrive:HH\\:mm} and the tour starts at {Hm(s.Start)}.", s.Tour.Day, null, fix);
                foreach (var meal in f.Meals.Where(m => m.Day == s.Tour.Day && TryHm(m.Time)))
                    if (s.End > Minutes(meal.Time!) - DinnerMinutes)
                        yield return new CheckFinding($"{id}:dinner", "CHK-02", ChangeConsequence.Conflict, $"{s.Tour.Name} runs into {meal.Name}", $"The tour ends about {Hm(s.End)} and dinner is at {meal.Time}.", s.Tour.Day, null, new CheckFix("Review my dinner", Dining));
            }
            for (var i = 1; i < spans.Count; i++)
                if (spans[i].Start < spans[i - 1].End)
                    yield return new CheckFinding($"overlap:{group.Key}:{spans[i - 1].Tour.Name}:{spans[i].Tour.Name}", "CHK-02", ChangeConsequence.Conflict, $"{spans[i - 1].Tour.Name} and {spans[i].Tour.Name} overlap", $"Both are booked on day {group.Key}.", group.Key, null, new CheckFix("Review my tours", Excursions));
        }

        // A dinner booked while the ship may still be loading: the guest may be ashore.
        foreach (var meal in f.Meals.Where(m => TryHm(m.Time)))
            if (f.Timeline.Days.FirstOrDefault(d => d.Day == meal.Day)?.AllAboard is { } back && back.Hour * 60 + back.Minute >= Minutes(meal.Time!) - TightMinutes)
                yield return new CheckFinding($"dinner:{meal.Day}:late-port", "CHK-02", ChangeConsequence.Conflict, $"{meal.Name} is booked on a late port day", $"All aboard is {back:HH\\:mm} and dinner is {meal.Time}. Make sure you will be back in time.", meal.Day, null, new CheckFix("Review my dinner", Dining));
    }

    // ---- CHK-08: the deadline radar ----

    /// <summary>Every date that can cost money or access and has not been dealt with, ordered by consequence and then date.</summary>
    public static IReadOnlyList<CheckDeadline> Deadlines(CheckupFacts f)
    {
        var list = new List<CheckDeadline>();
        void Add(string id, string consequence, string title, DateOnly date, CheckFix fix) => list.Add(new CheckDeadline(id, consequence, title, Iso(date), date.DayNumber - f.Today.DayNumber, fix));

        if (f.PaymentState != "paid" && f.FinalDue is { } due) Add("final-payment", ChangeConsequence.LostReservation, "Final payment due", due, new CheckFix("Open payments", Pay));
        if (f.CheckinState is "notOpen") Add("checkin-opens", ChangeConsequence.Optional, "Online check-in opens", DateOnly.FromDateTime(TripRules.ZonedToUtc(f.Departure.AddDays(-TripRules.CheckinOpenDaysBefore), TimeOnly.MinValue)), new CheckFix("Go to check-in", Checkin));
        if (f.CheckinState is "notOpen" or "open") Add("checkin-closes", ChangeConsequence.LostReservation, "Online check-in closes", f.Departure, new CheckFix("Go to check-in", Checkin));
        foreach (var t in f.Travellers.Where(_ => !f.AgentBooking))
            if (t.Docs.Results.Any(r => r.Requirement.Level == "required" && r.Status != "ready"))
                Add($"documents:{t.Position}", ChangeConsequence.Conflict, f.Travellers.Count == 1 ? "Save your documents" : $"Save Traveller {t.Position}'s documents", f.Departure, new CheckFix("Open my documents", Docs));

        return [.. list.OrderBy(x => ChangeConsequence.Rank(x.Consequence)).ThenBy(x => x.Date, StringComparer.Ordinal).ThenBy(x => x.Id, StringComparer.Ordinal)];
    }

    public static CheckupDto Build(CheckupFacts f, string asOf)
    {
        var findings = Findings(f);
        return new CheckupDto(true, findings, Deadlines(f), NotChecked(f), findings.Count == 0, asOf);
    }
}
