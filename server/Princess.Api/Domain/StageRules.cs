namespace Princess.Api.Domain;

/// <summary>Something the guest did that shows interest in a sailing (or, for <c>atTerminal</c>, that they have reached the terminal).</summary>
public sealed record JourneyIntent(string Kind, string? SailingId, DateTime At);

/// <summary>The confirmed trip the stage follows: its sailing (the demo account's chosen one when it has chosen), whether it is paid in full and whether check-in is finished.</summary>
public sealed record StageTrip(string SailingId, DateOnly Departure, bool PaidInFull, bool CheckinDone);

/// <summary>
/// Everything the stage is worked out from. <c>SavedSailings</c> are the guest's saved sailings, oldest first, already limited to sailings that exist and have not left.
/// <c>Trip</c> is null until a booking is confirmed. <c>CancelledSailingId</c> is a cancelled booking's sailing that is still ahead.
/// </summary>
public sealed record StageInput(DateTime Now, IReadOnlyList<string> SavedSailings, IReadOnlyList<JourneyIntent> Intents, string? DraftSailingId, string? CancelledSailingId, StageTrip? Trip);

/// <summary>The stage, the sailing it is about, and the one event that put the guest here (a stable code, so the test bar can say why).</summary>
public sealed record StageResult(string Stage, string? FocusSailingId, string Reason);

/// <summary>
/// The stage engine (docs/stage-experience-plan.md section 3). The stage is derived on every read from what the guest has done and, once a booking is
/// confirmed, from where the sailing is in time. Nothing is stored, so a guest cannot be stuck in a stage and every device agrees. Anything unclear
/// resolves to the earlier stage.
/// </summary>
public static class StageRules
{
    public const string Dream = "dream", Discover = "discover", Book = "book", Manage = "manage", Prebook = "prebook", GetToShip = "getToShip",
        Embark = "embark", Sea = "sea", Port = "port", Disembark = "disembark", Remember = "remember";

    /// <summary>The eleven stages, in journey order.</summary>
    public static readonly string[] All = [Dream, Discover, Book, Manage, Prebook, GetToShip, Embark, Sea, Port, Disembark, Remember];

    /// <summary>Intent kinds a guest can report. Looking (browsing, reading a port, the quiz) is not among them: only a deliberate "this one" counts.</summary>
    public static readonly string[] IntentKinds = ["lookCloser", "priceView", "cabinView", "sharedAccepted", "planImported"];

    /// <summary>Every kind the events endpoint accepts: the intents, plus the guest saying they are at the terminal.</summary>
    public static readonly string[] ClientKinds = [.. IntentKinds, AtTerminal];

    public const string AtTerminal = "atTerminal";
    public const string PriceView = "priceView";

    /// <summary>An intent stays open as long as a price quote does.</summary>
    public static readonly TimeSpan IntentWindow = TimeSpan.FromHours(24);
    public const int PrebookDaysBefore = 14;
    /// <summary>A finished trip stays the current one (stage Remember) this many days.</summary>
    public const int RememberDays = 10;

    private static readonly TimeOnly Boarding = new(11, 0), FinalMorning = new(6, 0), LastNoon = new(12, 0), DayStarts = new(8, 0);

    public static StageResult Derive(StageInput i) => i.Trip is { } trip ? AfterBooking(i.Now, trip, i.Intents) : BeforeBooking(i);

    private static StageResult BeforeBooking(StageInput i)
    {
        if (!string.IsNullOrEmpty(i.DraftSailingId)) return new(Book, i.DraftSailingId, "draftStarted");
        var open = i.Intents
            .Where(e => e.SailingId is not null && IntentKinds.Contains(e.Kind) && i.Now - e.At < IntentWindow)
            .OrderByDescending(e => e.At)
            .FirstOrDefault();
        if (open is not null) return new(Discover, open.SailingId, open.Kind);
        if (i.SavedSailings.Count > 0) return new(Discover, i.SavedSailings[^1], "sailingSaved");
        if (i.CancelledSailingId is not null) return new(Discover, i.CancelledSailingId, "bookingCancelled");
        return new(Dream, null, "noSailing");
    }

    private static StageResult AfterBooking(DateTime now, StageTrip t, IReadOnlyList<JourneyIntent> intents)
    {
        var timeline = TimelineBook.For(t.SailingId, t.Departure);
        var days = timeline.Days;
        var lastDate = days[^1].Date;
        StageResult R(string stage, string reason) => new(stage, t.SailingId, reason);

        if (now >= Itinerary.LocalToUtc(lastDate, LastNoon, timeline.FinalZone)) return R(Remember, "tripEnded");
        if (now >= Itinerary.LocalToUtc(lastDate, FinalMorning, timeline.FinalZone)) return R(Disembark, "finalMorning");
        if (now >= Itinerary.LocalToUtc(t.Departure, days[0].Depart!.Value, timeline.HomeZone))
        {
            // Sea or port by the itinerary day, which starts at 08:00 ship time.
            var (date, time) = Itinerary.LocalAt(now, timeline.ShipZoneAt(now));
            if (time < DayStarts) date = date.AddDays(-1);
            var day = days.FirstOrDefault(d => d.Date == date);
            return day is null || !timeline.IsCall(day) ? R(Sea, "seaDay") : R(Port, "portDay");
        }
        if (now >= Itinerary.LocalToUtc(t.Departure, Boarding, timeline.HomeZone)) return R(Embark, "boardingBegan");

        var checkinOpens = TripRules.CheckinOpensAt(t.Departure);
        if (now >= checkinOpens && intents.Any(e => e.Kind == AtTerminal && e.SailingId == t.SailingId)) return R(Embark, "atTerminal");
        if (t.CheckinDone) return R(GetToShip, "checkinDone");
        if (now >= checkinOpens) return R(GetToShip, "checkinOpened");
        if (t.PaidInFull) return R(Prebook, "paidInFull");
        if (TripRules.Today(now).AddDays(PrebookDaysBefore) >= t.Departure) return R(Prebook, "twoWeeksOut");
        return R(Manage, "bookingConfirmed");
    }
}
