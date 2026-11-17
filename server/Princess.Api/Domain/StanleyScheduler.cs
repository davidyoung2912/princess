namespace Princess.Api.Domain;

/// <summary>Why something is due: a time came, a fact changed, stock appeared, or a state was reached (docs/stanley-actions-and-proactive-plan.md, phase P2c).</summary>
public static class StanleyTrigger
{
    public const string Time = "time", Change = "change", Inventory = "inventory", State = "state";
    public static readonly string[] All = [Time, Change, Inventory, State];
}

/// <summary>The arbiter's priority order (22.1): safety, then money and deadlines, then missed-ship, then plan problems, then convenience, then suggestions.</summary>
public static class StanleyRank
{
    public const int Safety = 0, Money = 1, MissedShip = 2, PlanProblem = 3, Convenience = 4, Suggestion = 5;
}

/// <summary>States of one due item on the queue.</summary>
public static class StanleyDueState
{
    public const string Pending = "pending", Claimed = "claimed", Done = "done", Held = "held", Dropped = "dropped";
}

/// <summary>
/// One thing that has come due for one guest. <c>Key</c> is the idempotency key (the same fact on the same occasion is queued once). <c>ClassId</c> names the family it belongs to
/// (for kill switches and circuit breakers). <c>Subject</c> groups items about the same booking for the roll-up; <c>FactKey</c> marks the same fact reaching us from two sources.
/// Holds ids and keys only, never the guest's words.
/// </summary>
public sealed record StanleyDue(string Key, long UserId, DateTime DueAt, string Trigger, string ClassId, int Rank, bool Critical, string Subject, string FactKey);

/// <summary>What the arbiter needs to know about the guest right now. Loaded once per guest per pass.</summary>
public sealed record ArbiterContext(int Budget, int SentToday, bool Quiet, bool Dnd, bool Calm, bool ShipAlertActive, IReadOnlySet<string> OffClasses);

/// <summary>One card for the guest: one or more due items rolled into one. <c>Push</c> is false when it waits in the thread without a phone alert.</summary>
public sealed record StanleyCard(IReadOnlyList<string> Keys, string Subject, int Rank, bool Critical, bool Push, int Count);

public sealed record StanleyHeld(string Key, string Reason);

public sealed record ArbiterResult(IReadOnlyList<StanleyCard> Cards, IReadOnlyList<StanleyHeld> Held, IReadOnlyList<string> Duplicates, IReadOnlyList<StanleyHeld> Dropped);

/// <summary>
/// The arbiter (22.1): all proactive output for one guest passes through here, so ten rules do not make ten notices. Pure, so it is unit tested without a clock or a store.
/// Order of work: drop what the guest or an operator has switched off, merge the same fact, let critical items through, hold the rest for a ship alert, do-not-disturb and quiet hours,
/// roll items about the same booking into one card, keep to the day's budget (a critical card ignores it), and put calm-mode cards in the thread without a push.
/// </summary>
public static class StanleyArbiter
{
    public static ArbiterResult Arbitrate(IReadOnlyList<StanleyDue> items, ArbiterContext ctx)
    {
        var dropped = new List<StanleyHeld>();
        var duplicates = new List<string>();
        var held = new List<StanleyHeld>();
        var live = new List<StanleyDue>();
        foreach (var i in items)
        {
            if (ctx.OffClasses.Contains(i.ClassId)) dropped.Add(new(i.Key, "classOff"));
            else live.Add(i);
        }

        // Dedupe: the same fact from two sources becomes one item (the most urgent, then the soonest). The other keys are reported so they can be closed.
        var unique = new List<StanleyDue>();
        foreach (var group in live.GroupBy(i => i.FactKey.Length == 0 ? "k:" + i.Key : "f:" + i.FactKey))
        {
            var ordered = group.OrderBy(i => i.Critical ? 0 : 1).ThenBy(i => i.Rank).ThenBy(i => i.DueAt).ThenBy(i => i.Key, StringComparer.Ordinal).ToList();
            unique.Add(ordered[0]);
            duplicates.AddRange(ordered.Skip(1).Select(i => i.Key));
        }

        var cards = new List<StanleyCard>();
        var rest = new List<StanleyDue>();
        foreach (var i in unique)
        {
            if (i.Critical || i.Rank == StanleyRank.Safety) cards.Add(new([i.Key], i.Subject, i.Rank, true, true, 1));
            else rest.Add(i);
        }

        string? hold = ctx.ShipAlertActive ? "shipAlert" : ctx.Dnd ? "dnd" : ctx.Quiet ? "quiet" : null;
        if (hold is not null)
        {
            held.AddRange(rest.Select(i => new StanleyHeld(i.Key, hold)));
            rest.Clear();
        }

        // Roll-up: two or more items about the same booking in the same pass become one card.
        var groups = new List<List<StanleyDue>>();
        foreach (var g in rest.Where(i => i.Subject.Length > 0).GroupBy(i => i.Subject)) groups.Add([.. g]);
        groups.AddRange(rest.Where(i => i.Subject.Length == 0).Select(i => new List<StanleyDue> { i }));
        var ranked = groups
            .Select(g => g.OrderBy(i => i.Rank).ThenBy(i => i.DueAt).ThenBy(i => i.Key, StringComparer.Ordinal).ToList())
            .OrderBy(g => g[0].Rank).ThenBy(g => g.Min(i => i.DueAt)).ThenBy(g => g[0].Key, StringComparer.Ordinal);

        var room = Math.Max(0, ctx.Budget - ctx.SentToday);
        foreach (var g in ranked)
        {
            if (room <= 0)
            {
                held.AddRange(g.Select(i => new StanleyHeld(i.Key, "budget")));
                continue;
            }
            room--;
            cards.Add(new([.. g.Select(i => i.Key)], g[0].Subject, g[0].Rank, false, !ctx.Calm, g.Count));
        }
        return new(cards, held, duplicates, dropped);
    }
}

/// <summary>What a class has done lately, kept so a runaway class pauses itself.</summary>
public sealed record BreakerState(DateTime WindowStart, int Count, DateTime? PausedUntil);

/// <summary>
/// The circuit breaker for one class of proactive output: more than <c>limit</c> cards inside <c>window</c> pauses the class until <c>pause</c> has passed. Pure.
/// While paused nothing of that class is delivered; its items wait and are tried again when the pause ends.
/// </summary>
public static class StanleyBreakerRules
{
    public static readonly BreakerState Fresh = new(DateTime.MinValue, 0, null);

    public static bool IsPaused(BreakerState s, DateTime now) => s.PausedUntil is { } p && now < p;

    /// <summary>The state after <paramref name="delivered"/> more cards at <paramref name="now"/>. Crossing the limit sets the pause; a window that has run out starts again.</summary>
    public static BreakerState Record(BreakerState s, DateTime now, int delivered, int limit, TimeSpan window, TimeSpan pause)
    {
        var paused = s.PausedUntil is { } p && now < p ? p : (DateTime?)null;
        var start = s.WindowStart;
        var count = s.Count;
        if (now - start >= window || start == DateTime.MinValue) { start = now; count = 0; }
        count += delivered;
        if (paused is null && limit > 0 && count > limit) paused = now + pause;
        return new(start, count, paused);
    }
}
