using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The morning brief and evening look-ahead (phase P7, ACT-06, permission row CL-04). The guest chooses the times; nothing is sent until they do. Each brief is one item on the due queue
/// with a key made of the guest, the kind and the ship-clock day, so it is queued and sent once. The queue's arbiter applies quiet hours, calm mode and the day's budget; a time the guest has
/// already silenced is refused when they save it, so a brief is never chosen and then quietly lost. Settings live in the account's state store, so every device sees the same ones.
/// </summary>
public sealed class StanleyBriefService(IStateStore state, StanleyCheckupService checkup, StanleyPermissionService permissions, PushService push, IStanleyDueStore due, IUserClock clock)
{
    private async Task<(BriefSettings Settings, int Version)> LoadAsync(long userId, CancellationToken ct) =>
        await state.GetAsync(false, userId, StanleyBriefRules.StateKey, ct) is { } row ? (StanleyBriefRules.Parse(row.Json), row.Version) : (new BriefSettings(), 0);

    public Task<BriefSettings> SettingsAsync(long userId, CancellationToken ct) => LoadAsync(userId, ct).ContinueWith(t => t.Result.Settings, ct);

    /// <summary>The ship-clock date and zone now, for the guest's current sailing (or the home zone when they have none).</summary>
    private static (DateOnly Date, string Zone) Ship(CheckupFacts? facts, string? sailingId, DateTime now)
    {
        if (facts is null) return (TripRules.Today(now), Itinerary.ShipHomeZone);
        var zone = facts.Timeline.ShipZoneAt(now);
        return (Itinerary.LocalAt(now, zone).Item1, zone);
    }

    public async Task<BriefStateDto> GetAsync(UserRecord user, CancellationToken ct)
    {
        var (settings, _) = await LoadAsync(user.Id, ct);
        var now = await clock.NowAsync(user, ct);
        var (facts, sailing) = await checkup.FactsAsync(user, ct);
        var zone = Ship(facts, sailing, now).Zone;
        long? Next(string kind) => StanleyBriefRules.Wanted(settings, kind) ? TripRules.ToMs(StanleyReminderRules.NextDue(now, StanleyBriefRules.TimeOf(settings, kind), zone)) : null;
        return new(settings, await permissions.MayAsync(user, "CL-04", ct), Next(StanleyBriefRules.Morning), Next(StanleyBriefRules.Evening));
    }

    /// <summary>Saves the guest's choices. Turning a brief on switches CL-04 on (consent history records it); turning both off switches it off. A time inside the guest's quiet hours is refused.</summary>
    public async Task<BriefStateDto> PutAsync(UserRecord user, BriefSettingsRequest? body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        var (current, version) = await LoadAsync(user.Id, ct);
        var next = StanleyBriefRules.Apply(current, body, out var problem) ?? throw ApiException.Invalid(problem ?? "body");
        foreach (var kind in new[] { StanleyBriefRules.Morning, StanleyBriefRules.Evening })
            if (StanleyBriefRules.Wanted(next, kind) && await push.InQuietHoursAsync(user, TimeOnly.ParseExact(StanleyBriefRules.TimeOf(next, kind), "HH:mm"), ct))
                throw ApiException.Invalid(kind + "Quiet");
        var now = await clock.NowAsync(user, ct);
        var anyOn = next.Morning || next.Evening;
        if (anyOn) await permissions.SetRowAsync(user, "CL-04", new StanleyRowRequest(true, "settings", null), ct);
        if (await state.SaveAsync(false, user.Id, StanleyBriefRules.StateKey, StanleyBriefRules.ToJson(next), version, now, ct) is null) throw ApiException.Conflict("changed");
        if (!anyOn) await permissions.SetRowAsync(user, "CL-04", new StanleyRowRequest(false, "settings", null), ct);
        await QueueAsync(user, next, ct);
        return await GetAsync(user, ct);
    }

    /// <summary>
    /// Queues the next brief of each kind the guest wants (today's if its time has not passed, otherwise tomorrow's). Safe to call again: the key keeps it to one. Called when the guest saves
    /// and each time a brief is checked for delivery, so the next day's brief is always already queued.
    /// </summary>
    public async Task QueueAsync(UserRecord user, BriefSettings settings, CancellationToken ct)
    {
        var now = await clock.NowAsync(user, ct);
        var (facts, sailing) = await checkup.FactsAsync(user, ct);
        var (_, zone) = Ship(facts, sailing, now);
        foreach (var kind in new[] { StanleyBriefRules.Morning, StanleyBriefRules.Evening })
        {
            if (!StanleyBriefRules.Wanted(settings, kind)) continue;
            var at = StanleyReminderRules.NextDue(now, StanleyBriefRules.TimeOf(settings, kind), zone);
            var date = Itinerary.LocalAt(at, zone).Item1;
            await due.EnqueueAsync(new StanleyDueRow
            {
                UserId = user.Id, IdemKey = StanleyBriefRules.Key(user.Id, kind, date), DueAt = at, TriggerKind = StanleyTrigger.Time, ClassId = StanleyBriefRules.ClassId,
                RankNo = StanleyRank.Convenience, Subject = "brief:" + kind, CreatedAt = now,
            }, ct);
        }
    }

    /// <summary>The brief of this kind for now, or null when the guest has no sailing day it covers. The preview and the delivery use the same composition.</summary>
    public async Task<BriefDto?> ComposeAsync(UserRecord user, string kind, CancellationToken ct)
    {
        if (!StanleyBriefRules.KindOk(kind)) throw ApiException.Invalid("kind");
        var now = await clock.NowAsync(user, ct);
        var (facts, sailing) = await checkup.FactsAsync(user, ct);
        if (facts is null) return null;
        var (date, _) = Ship(facts, sailing, now);
        var about = facts.Timeline.Days.FirstOrDefault(d => d.Date == date);
        var tomorrow = facts.Timeline.Days.FirstOrDefault(d => d.Date == date.AddDays(1));
        var deadlines = StanleyCheckupRules.Deadlines(facts);
        return StanleyBriefRules.Compose(kind, new BriefFacts(date, facts.Nights, about, tomorrow, facts.Tours, facts.Meals, deadlines));
    }
}

/// <summary>
/// Delivers briefs from the due queue. It re-reads the stop facts just before sending (the permission is still on, the guest still wants that brief at that time), keeps the next brief queued,
/// and writes the brief to the guest's thread and, within their own limits, their phone. A key that is not a brief is not its business.
/// </summary>
public sealed class StanleyBriefDueHandler(IUserStore users, StanleyBriefService briefs, StanleyPermissionService permissions, StanleyNoticeRelay relay, PushService push, IUserClock clock) : IStanleyDueHandler
{
    public string Trigger => StanleyTrigger.Time;

    public async Task<bool> StillNeededAsync(StanleyDue due, CancellationToken ct)
    {
        if (StanleyBriefRules.KindOfKey(due.Key) is not { } kind || await users.FindByIdAsync(due.UserId, ct) is not { } user) return false;
        var settings = await briefs.SettingsAsync(user.Id, ct);
        if (!StanleyBriefRules.Wanted(settings, kind)) return false;
        await briefs.QueueAsync(user, settings, ct);
        return await permissions.MayAsync(user, "CL-04", ct);
    }

    public async Task DeliverAsync(long userId, StanleyCard card, CancellationToken ct)
    {
        if (await users.FindByIdAsync(userId, ct) is not { } user) return;
        var now = await clock.NowAsync(user, ct);
        foreach (var key in card.Keys)
        {
            if (StanleyBriefRules.KindOfKey(key) is not { } kind || await briefs.ComposeAsync(user, kind, ct) is not { } brief) continue;
            var notice = new PushNotice(key, "reminder", "checkin", false, 40, "/plan/autopilot", "Stanley: " + brief.Title, StanleyBriefRules.Body(brief), [], "brief:" + kind);
            await relay.RelayAsync(user, [notice], now, ct);
            if (card.Push) await push.NotifyChatAsync(user, notice, ct);
        }
    }
}
