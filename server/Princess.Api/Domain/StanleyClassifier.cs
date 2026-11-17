namespace Princess.Api.Domain;

/// <summary>The kinds of item the classifier reads. Anything else is not classified, and so can never be acted on at rung 4.</summary>
public static class StanleyItemKind
{
    public const string Dining = "dining", Show = "show", Excursion = "excursion", Spa = "spa", Service = "service";
    public static readonly string[] All = [Dining, Show, Excursion, Spa, Service];
}

/// <summary>
/// The per-item facts that decide whether something may be acted on without a tap (docs/stanley-actions-and-proactive-plan.md, phase P3a).
/// <c>Free</c>: the guest pays nothing now or later for it. <c>FeeFreeUntilMs</c>: the last moment it can be cancelled with no fee (null when it never can).
/// <c>OnlyMe</c>: it touches only the guest's own items. <c>ReversibleUntilMs</c>: the last moment the act can be undone (null when it cannot).
/// Ids and numbers only; no guest words.
/// </summary>
public sealed record StanleyItemFlags(string Kind, bool Free, long? FeeFreeUntilMs, bool OnlyMe, long? ReversibleUntilMs)
{
    /// <summary>The flags of an item nobody has classified: not free, not only-me, not reversible. Fails every test.</summary>
    public static StanleyItemFlags Unknown(string kind) => new(kind, false, null, false, null);

    /// <summary>Why this item fails the classifier, or null when it passes. The undo window must fit before the thing stops being free to cancel, so an act never outlives its refund.</summary>
    public string? Failure(long nowMs, int undoMinutes)
    {
        if (!StanleyItemKind.All.Contains(Kind)) return "unclassified";
        if (!Free) return "paid";
        if (!OnlyMe) return "shared";
        var undoUntil = nowMs + undoMinutes * 60_000L;
        if (FeeFreeUntilMs is not { } free || free < undoUntil) return "feeSoon";
        if (ReversibleUntilMs is not { } rev || rev < undoUntil) return "notReversible";
        return null;
    }
}

/// <summary>Builds the flags from facts the server already holds about each kind of item. Pure; each helper reuses the rule that already prices or cancels that kind, so the two cannot disagree.</summary>
public static class StanleyClassifier
{
    /// <summary>A dinner is free only in the main dining room (no cover charge). A cover or a pay-at-the-table venue is paid. Cancelling is free until the table time. <paramref name="partyOthers"/> counts other travellers on the reservation.</summary>
    public static StanleyItemFlags Dining(Venue venue, long startAtMs, int partyOthers) =>
        new(StanleyItemKind.Dining, venue.Kind == "main" && venue.Cover == 0, startAtMs, partyOthers == 0, startAtMs);

    /// <summary>A ticketed show or class has no price. Seats are released until it starts. It is only-me when the booking holds one seat for the guest.</summary>
    public static StanleyItemFlags Show(long startAtMs, int seatsForOthers) =>
        new(StanleyItemKind.Show, true, startAtMs, seatsForOthers == 0, startAtMs);

    /// <summary>A ship tour always costs money. Cancelling is free until <see cref="ExcursionRules.FreeCancelDays"/> days before the port day (<paramref name="portDayStartMs"/>).</summary>
    public static StanleyItemFlags Excursion(Excursion tour, long portDayStartMs, int guestsOthers)
    {
        var until = portDayStartMs - ExcursionRules.FreeCancelDays * 86_400_000L;
        return new(StanleyItemKind.Excursion, tour.Price == 0, until, guestsOthers == 0, until);
    }

    /// <summary>A treatment always costs money, and cancelling is free until <see cref="SpaRules.CancelFreeHours"/> before the start.</summary>
    public static StanleyItemFlags Spa(SpaTreatment treatment, long startAtMs, int guestsOthers)
    {
        var until = startAtMs - SpaRules.CancelFreeHours * 3_600_000L;
        return new(StanleyItemKind.Spa, treatment.Price == 0, until, guestsOthers == 0, until);
    }

    /// <summary>A stateroom request is free and is the guest's own. It can be withdrawn until the crew is on the way, which is half its usual time (<see cref="ServiceRules.RequestStage"/>).</summary>
    public static StanleyItemFlags Service(ServiceRequestItem item, long placedAtMs)
    {
        var until = placedAtMs + item.EtaMin * 30_000L;
        return new(StanleyItemKind.Service, true, until, true, until);
    }
}

/// <summary>The state of one class of act for one guest, read from the permission rows and the ledger.</summary>
public sealed record StanleyClassState(bool On, bool Paused, bool Practice, int SentToday, int DailyCap, int UndoMinutes, int DeclinedOrUndoneOfKind, bool StepUpPassed);

/// <summary>What the gate needs to know about this moment. <c>LocalMinutes</c> is minutes since midnight on the ship's clock.</summary>
public sealed record StanleyGateInput(
    StanleyItemFlags Item, StanleyClassState Class, long NowMs, int LocalMinutes,
    int FactAgeMinutes, int FreshnessMinutes, bool SourceHealthy, bool OverlapsBooked,
    bool SeriousCase, bool ShipAlert, bool SupervisedChild);

/// <summary>The gate's answer. <c>Act</c> is true only when every test passes; otherwise it falls back to a rung 3 preview and <c>Reasons</c> names each test that failed (a closed set, for the ledger and the metrics).</summary>
public sealed record StanleyGateResult(bool Act, IReadOnlyList<string> Reasons);

/// <summary>The act-or-ask gate (19.6): the code form of the five tests. Pure, and it only ever adds reasons, so one failing test is enough to ask instead of act.</summary>
public static class StanleyActGate
{
    public const int QuietFrom = 22 * 60, QuietTo = 7 * 60;
    public const int MaxRefusals = 2;

    public static readonly string[] Reasons =
    [
        "classOff", "paused", "practice", "overCap", "unclassified", "paid", "shared", "feeSoon", "notReversible",
        "stale", "sourceDown", "overlap", "seriousCase", "shipAlert", "quiet", "child", "declined", "noStepUp",
    ];

    /// <summary>Reservations are made only 07:00 to 22:00 ship time; a stateroom request is not a reservation and may go at any hour.</summary>
    public static bool IsReservation(string kind) => kind is StanleyItemKind.Dining or StanleyItemKind.Show or StanleyItemKind.Excursion or StanleyItemKind.Spa;

    public static bool InQuietHours(int localMinutes) => localMinutes >= QuietFrom || localMinutes < QuietTo;

    public static StanleyGateResult Decide(StanleyGateInput g)
    {
        var why = new List<string>();
        var c = g.Class;
        if (!c.On) why.Add("classOff");
        if (c.Paused) why.Add("paused");
        if (c.Practice) why.Add("practice");
        if (c.SentToday >= c.DailyCap) why.Add("overCap");
        if (g.Item.Failure(g.NowMs, c.UndoMinutes) is { } fail) why.Add(fail);
        if (g.FactAgeMinutes > g.FreshnessMinutes || g.FactAgeMinutes < 0) why.Add("stale");
        if (!g.SourceHealthy) why.Add("sourceDown");
        if (g.OverlapsBooked) why.Add("overlap");
        if (g.SeriousCase) why.Add("seriousCase");
        if (g.ShipAlert) why.Add("shipAlert");
        if (IsReservation(g.Item.Kind) && InQuietHours(g.LocalMinutes)) why.Add("quiet");
        if (g.SupervisedChild) why.Add("child");
        if (c.DeclinedOrUndoneOfKind >= MaxRefusals) why.Add("declined");
        if (!c.StepUpPassed) why.Add("noStepUp");
        return new(why.Count == 0, why);
    }
}
