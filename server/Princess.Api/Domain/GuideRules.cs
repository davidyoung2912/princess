namespace Princess.Api.Domain;

/// <summary>One checklist item as the guide sees it: whether the app found it done (or the guest ticked it) and the date it falls due.</summary>
public sealed record GuideCheck(bool Done, DateOnly Due);

/// <summary>The booking draft, as far as the guide needs.</summary>
public sealed record GuideDraft(string Id, bool CategoryChosen);

/// <summary>
/// The confirmed trip. <c>Checklist</c> is the checklist by item id (the same facts the checklist screen shows); it is empty for a trip the guest cannot plan on (a linked agent booking).
/// <c>CheckinState</c> is <c>notOpen</c>, <c>open</c>, <c>closed</c> or <c>done</c>.
/// </summary>
public sealed record GuideTrip(string Number, DateOnly Departure, bool Agent, bool Paid, DateOnly FinalDue, bool DocumentsOk, string CheckinState, DateOnly CheckinOpens, bool MusterDone, IReadOnlyDictionary<string, GuideCheck> Checklist, int Guests = 0, int Ready = 0, int Children = 0);

/// <summary>What the guest has put aside: tasks they said are not for them (<c>Skipped</c>) and tasks they will do later (<c>Later</c>, by the day each returns). A task with a real deadline is never put aside.</summary>
public sealed record GuideChoices(IReadOnlySet<string> Skipped, IReadOnlyDictionary<string, DateOnly> Later)
{
    public static readonly GuideChoices None = new(new HashSet<string>(), new Dictionary<string, DateOnly>());
}

/// <summary>The guest's own answers to "make this plan fit me": a first cruise, travelling alone, and keeping offers quiet (no selling tasks). Never anything about health or access.</summary>
public sealed record GuideFit(bool FirstCruise, bool Solo, bool Quiet)
{
    public static readonly GuideFit None = new(false, false, false);
}

/// <summary>Everything the guide is worked out from.</summary>
public sealed record GuideFacts(string Stage, DateOnly Today, int SavedSailings, GuideDraft? Draft, GuideTrip? Trip, bool LastFullDay, bool FeedbackSent, GuideChoices? Choices = null, GuideFit? Fit = null);

/// <summary>How many of the travellers a task is done for ("2 of 4 ready").</summary>
public sealed record GuideWho(int Done, int Total);

/// <summary>
/// One thing the guest could do now. <c>State</c> is todo, blocked (needs <c>BlockedBy</c> first), waiting (not open until <c>OpensAt</c>) or done.
/// <c>Urgency</c> is now, soon, later or none; <c>UrgencyReason</c> names why for <c>now</c>. <c>Hard</c> means a real deadline: it may be put off, never hidden.
/// <c>DoneBy</c> says how we know it is done: data (the app can see it), tick (the guest ticked it) or visit (the guest opened the screen).
/// <c>CarriedFrom</c> is the earlier stage a task still open belongs to.
/// </summary>
public sealed record GuideTask(
    string Id, string Stage, string To, string State, string Urgency, string? UrgencyReason, string? Due, string? DueSource, string? OpensAt,
    int Minutes, bool Hard, bool Optional, string DoneBy, string? BlockedBy, string? CarriedFrom, GuideWho? Who = null);

/// <summary>What really moves the guest to the next stage (the words are the client's, by stage), and the date when there is one.</summary>
public sealed record GuideMoveOn(string Stage, string? Date);

public sealed record GuideCounts(int Done, int Total, int Open);

/// <summary>The guest's plan right now: every task in order (open first, by urgency, then waiting, then done), the one to do first, and how the stage ends.</summary>
public sealed record GuideView(string Stage, string? PrimaryId, List<GuideTask> Tasks, GuideMoveOn MoveOn, GuideCounts Counts, List<string> Hidden, List<GuideDeferred> Deferred);

/// <summary>A task the guest put off, and the day it comes back.</summary>
public sealed record GuideDeferred(string Id, string Until);

/// <summary>
/// The Journey Guide (docs/next-steps-guidance-plan.md section 3). One catalogue of tasks per stage, each marked done from data wherever the data can say so, ordered so the first open one
/// is what the guest should do now. Pure, so the order and the urgency rules are tested without a database. Every task has a destination; the client holds the words, keyed by task id.
/// </summary>
public static class GuideRules
{
    public const string Todo = "todo", Blocked = "blocked", Waiting = "waiting", Done = "done";
    public const string Now = "now", Soon = "soon", Later = "later", None = "none";
    public const string ByData = "data", ByTick = "tick", ByVisit = "visit";

    /// <summary>A task due within this many days (or overdue) is "soon".</summary>
    public const int SoonDays = 14;

    private sealed record Raw(
        string Id, string To, int Minutes, bool Done, string DoneBy, bool Hard = false, bool Optional = false, string? Check = null,
        string? BlockedBy = null, DateOnly? OpensAt = null, DateOnly? Due = null, string? DueSource = null, string? Reason = null, string? From = null, GuideWho? Who = null);

    /// <summary>Reads the <c>guideFit</c> document (<c>{ firstCruise, solo, quiet }</c>); anything unreadable counts as no.</summary>
    public static GuideFit ReadFit(System.Text.Json.Nodes.JsonObject? data)
    {
        static bool Flag(System.Text.Json.Nodes.JsonObject? o, string k) => o?[k] is System.Text.Json.Nodes.JsonValue v && v.TryGetValue<bool>(out var b) && b;
        return new GuideFit(Flag(data, "firstCruise"), Flag(data, "solo"), Flag(data, "quiet"));
    }

    /// <summary>Reads the <c>guideChoices</c> document (<c>{ skipped: { id: atMs }, later: { id: "yyyy-MM-dd" } }</c>); anything unreadable is left out.</summary>
    public static GuideChoices ReadChoices(System.Text.Json.Nodes.JsonObject? data)
    {
        var skipped = new HashSet<string>();
        var later = new Dictionary<string, DateOnly>();
        if (data?["skipped"] is System.Text.Json.Nodes.JsonObject sk) foreach (var (id, _) in sk) skipped.Add(id);
        if (data?["later"] is System.Text.Json.Nodes.JsonObject lt)
            foreach (var (id, node) in lt)
                if (node is System.Text.Json.Nodes.JsonValue v && v.TryGetValue<string>(out var day) && DateOnly.TryParseExact(day, "yyyy-MM-dd", out var d)) later[id] = d;
        return new GuideChoices(skipped, later);
    }

    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");

    public static GuideView Build(GuideFacts f)
    {
        var raws = Catalogue(f);
        var order = raws.Select((r, i) => (r, i)).ToDictionary(x => x.r.Id, x => x.i);
        var tasks = raws.Select(r => ToTask(f, r)).ToList();
        var choices = f.Choices ?? GuideChoices.None;
        var hidden = new List<string>();
        var deferred = new List<GuideDeferred>();
        tasks = [.. tasks.Where(t =>
        {
            if (t.Hard || t.State == Done) return true;
            if (choices.Skipped.Contains(t.Id)) { hidden.Add(t.Id); return false; }
            if (choices.Later.TryGetValue(t.Id, out var until) && until > f.Today) { deferred.Add(new GuideDeferred(t.Id, Iso(until))); return false; }
            return true;
        })];
        tasks = [.. tasks.OrderBy(t => StateRank(t.State)).ThenBy(t => t.State == Todo ? UrgencyRank(t.Urgency) : 0).ThenBy(t => t.State == Todo && t.Optional ? 1 : 0)
            .ThenBy(t => t.State == Waiting ? t.OpensAt : null, StringComparer.Ordinal).ThenBy(t => order[t.Id])];
        var own = tasks.Where(t => t.CarriedFrom is null).ToList();
        var counts = new GuideCounts(own.Count(t => t.State == Done), own.Count, tasks.Count(t => t.State != Done));
        return new GuideView(f.Stage, tasks.FirstOrDefault(t => t.State == Todo)?.Id, tasks, MoveOn(f), counts, hidden, deferred);
    }

    private static int StateRank(string s) => s switch { Todo => 0, Blocked => 1, Waiting => 2, _ => 3 };
    private static int UrgencyRank(string u) => u switch { Now => 0, Soon => 1, Later => 2, _ => 3 };

    private static GuideTask ToTask(GuideFacts f, Raw r)
    {
        var state = r.Done ? Done : r.BlockedBy is not null ? Blocked : r.OpensAt is { } o && o > f.Today ? Waiting : Todo;
        var urgency = None;
        string? reason = null;
        if (state != Done)
        {
            if (r.Reason is not null) { urgency = Now; reason = r.Reason; }
            else if (r.Due is { } due) urgency = due.DayNumber - f.Today.DayNumber <= SoonDays ? Soon : Later;
        }
        return new GuideTask(r.Id, r.Id[..r.Id.IndexOf('.')], r.To, state, urgency, reason, r.Due is { } d ? Iso(d) : null, r.DueSource, state == Waiting && r.OpensAt is { } opens ? Iso(opens) : null,
            r.Minutes, r.Hard, r.Optional, r.DoneBy, state == Blocked ? r.BlockedBy : null, r.From, state == Done ? null : r.Who);
    }

    /// <summary>The checklist item's own date and state when the guest has a checklist, else the fallback.</summary>
    private static (bool Done, DateOnly? Due, string? Source) FromCheck(GuideTrip? t, string? id, bool fallbackDone)
    {
        if (t is null || id is null || !t.Checklist.TryGetValue(id, out var c)) return (fallbackDone, null, null);
        return (c.Done, c.Due, "checklist");
    }

    private static Raw Item(GuideTrip? trip, string id, string to, int minutes, string check, string doneBy, bool fallbackDone = false, bool hard = false, bool optional = false, string? from = null)
    {
        var (done, due, source) = FromCheck(trip, check, fallbackDone);
        return new Raw(id, to, minutes, done, doneBy, hard, optional, check, Due: due, DueSource: source, From: from);
    }

    private static Raw Pay(GuideFacts f, string? from = null)
    {
        var t = f.Trip;
        var days = t is null ? int.MaxValue : t.FinalDue.DayNumber - f.Today.DayNumber;
        return new("manage.pay", t is not null && !t.Agent ? $"/book/pay/{t.Number}" : "/me/payments", 5, t?.Paid ?? false, ByData, Hard: true, Check: "pay",
            Due: t?.FinalDue, DueSource: t is null ? null : "booking", Reason: t is not null && !t.Paid && days <= 14 ? "payment" : null, From: from);
    }

    private static Raw Documents(GuideFacts f, string id, string? from = null)
    {
        var t = f.Trip;
        var days = t is null ? int.MaxValue : t.Departure.DayNumber - f.Today.DayNumber;
        var (_, due, source) = FromCheck(t, "documents", false);
        return new(id, "/me/documents", 10, t?.DocumentsOk ?? false, ByData, Hard: true, Check: "documents", Due: due, DueSource: source,
            Reason: t is not null && !t.Agent && !t.DocumentsOk && days <= 30 ? "documents" : null, From: from,
            Who: t is { Agent: false, Guests: > 1 } ? new GuideWho(Math.Min(t.Ready, t.Guests), t.Guests) : null);
    }

    private static List<Raw> Catalogue(GuideFacts f)
    {
        var t = f.Trip;
        var resume = f.Draft is null ? "/book" : $"/book/resume/{f.Draft.Id}";
        switch (f.Stage)
        {
            case StageRules.Dream:
                return
                [
                    new("dream.quiz", "/home/quiz", 3, false, ByVisit),
                    new("dream.save", "/home/sailings", 5, f.SavedSailings > 0, ByData),
                    new("dream.invite", "/plan/group-poll", 2, false, ByVisit, Optional: true),
                ];
            case StageRules.Discover:
                return
                [
                    new("discover.room", "/home/cabins", 5, f.Draft?.CategoryChosen ?? false, ByData),
                    new("discover.cost", "/home/cruise/cost", 3, false, ByVisit),
                    new("discover.book", "/book", 2, false, ByVisit),
                ];
            case StageRules.Book:
                return
                [
                    new("book.finish", resume, 10, false, ByVisit),
                    new("book.deposit", f.Draft is null ? "/book" : $"/book/pay/{f.Draft.Id}", 5, false, ByVisit),
                    new("book.names", "/plan/party", 5, false, ByVisit),
                ];
            case StageRules.Manage:
                return
                [
                    Pay(f),
                    Documents(f, "manage.documents"),
                    new("manage.readiness", "/plan/readiness", 5, false, ByVisit),
                    Item(t, "manage.assistance", "/plan/assistance", 5, "assistance", ByData, optional: true),
                ];
            case StageRules.Prebook:
            {
                var raws = new List<Raw>();
                var fit = f.Fit ?? GuideFit.None;
                if (t is { Paid: false }) raws.Add(Pay(f, StageRules.Manage));
                if (t is { Agent: false, DocumentsOk: false }) raws.Add(Documents(f, "manage.documents", StageRules.Manage));
                if (fit.FirstCruise) raws.Add(new("prebook.firstTime", "/plan/starter", 10, false, ByVisit));
                raws.Add(Item(t, "prebook.tours", "/excursions-explorer", 15, "tours", ByData));
                raws.Add(Item(t, "prebook.dining", "/dining-today", 10, "dining", ByData));
                raws.Add(Item(t, "prebook.packing", "/plan/packing", 10, "packing", ByTick));
                raws.Add(Item(t, "prebook.travel", "/plan/travel", 5, "travel", ByData));
                if (!fit.Quiet) raws.Add(Item(t, "prebook.packages", "/me/packages", 5, "packages", ByTick, optional: true));
                if (t is { Children: > 0 }) raws.Add(new("prebook.clubs", "/plan/clubs", 5, false, ByVisit, Optional: true));
                if (fit.Solo || t is { Guests: 1 }) raws.Add(new("prebook.solo", "/ship/solo", 3, false, ByVisit, Optional: true));
                return raws;
            }
            case StageRules.GetToShip:
            {
                var raws = new List<Raw>();
                if (t is { Paid: false }) raws.Add(Pay(f, StageRules.Manage));
                var state = t?.CheckinState ?? "notOpen";
                var checkinDone = state == "done";
                var days = t is null ? int.MaxValue : t.Departure.DayNumber - f.Today.DayNumber;
                raws.Add(new("getToShip.checkin", state == "closed" ? "/home/check-in/terminal" : "/home/check-in", 10, checkinDone, ByData, Hard: true, Check: "checkin",
                    OpensAt: state == "notOpen" ? t?.CheckinOpens : null, Due: t?.Departure, DueSource: t is null ? null : "booking",
                    Reason: state is "open" or "closed" && days <= 3 ? "checkin" : null));
                raws.Add(new("getToShip.pass", "/home/boarding-pass", 2, false, ByVisit, BlockedBy: checkinDone ? null : "getToShip.checkin"));
                raws.Add(new("getToShip.travel", "/plan/getting-there", 5, false, ByVisit));
                raws.Add(Documents(f, "getToShip.documents"));
                return raws;
            }
            case StageRules.Embark:
                return
                [
                    new("embark.steps", "/home/embarkation/steps", 5, false, ByVisit),
                    new("embark.group", "/home/meeting-point", 5, false, ByVisit),
                    new("embark.muster", "/ship/muster", 15, t?.MusterDone ?? false, ByData, Hard: true, Reason: t is { MusterDone: false } ? "muster" : null),
                ];
            case StageRules.Sea:
            {
                var raws = new List<Raw> { new("sea.today", "/plan/day", 3, false, ByVisit), new("sea.dinner", "/dining-today", 5, false, ByVisit) };
                if (f.LastFullDay) raws.Add(new("sea.bags", "/home/disembark/bags", 10, false, ByVisit, Hard: true, Reason: "bags"));
                return raws;
            }
            case StageRules.Port:
                return
                [
                    new("port.leaveby", "/ship/port", 2, false, ByVisit),
                    new("port.excursion", "/excursions-explorer", 10, false, ByVisit),
                    new("port.safe", "/ship/safe-ashore", 3, false, ByVisit, Optional: true),
                ];
            case StageRules.Disembark:
                return
                [
                    new("disembark.exit", "/home/disembark", 3, false, ByVisit),
                    new("disembark.bags", "/home/disembark/bags", 10, false, ByVisit, Hard: true),
                    new("disembark.bill", "/me/bill", 5, false, ByVisit),
                ];
            case StageRules.Remember:
                return
                [
                    new("remember.recap", "/me/recap", 5, false, ByVisit),
                    new("remember.feedback", "/me/feedback", 5, f.FeedbackSent, ByData),
                    new("remember.next", "/home/sailings", 5, f.SavedSailings > 0, ByData, Optional: true),
                ];
            default:
                return [];
        }
    }

    /// <summary>The real trigger for leaving the stage (the same as StageRules), with its date when there is one. The client's words are `guide.moveOn.&lt;stage&gt;`.</summary>
    private static GuideMoveOn MoveOn(GuideFacts f)
    {
        var t = f.Trip;
        string? date = f.Stage switch
        {
            StageRules.Manage when t is not null => Iso(t.Departure.AddDays(-StageRules.PrebookDaysBefore)),
            StageRules.Prebook when t is not null => Iso(t.CheckinOpens),
            StageRules.GetToShip when t is not null => Iso(t.Departure),
            _ => null,
        };
        return new GuideMoveOn(f.Stage, date);
    }
}
