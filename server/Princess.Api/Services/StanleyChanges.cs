using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public interface IStanleyChangeStore
{
    /// <summary>The guest's change memory as JSON, or null. Anyone else's is never returned.</summary>
    Task<string?> GetAsync(long userId, CancellationToken ct);
    Task PutAsync(long userId, string json, DateTime at, CancellationToken ct);
}

/// <summary>Kept in memory. For tests and a single-instance trial: <c>Providers:StanleyLog</c> = <c>memory</c>.</summary>
public sealed class MemoryStanleyChangeStore : IStanleyChangeStore
{
    private readonly Dictionary<long, string> _rows = [];

    public Task<string?> GetAsync(long userId, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.TryGetValue(userId, out var r) ? r : null);
    }

    public Task PutAsync(long userId, string json, DateTime at, CancellationToken ct)
    {
        lock (_rows) _rows[userId] = json;
        return Task.CompletedTask;
    }
}

/// <summary>
/// Voyage Autopilot v2 and "Explain this change" (docs/stanley-gap-analysis-and-plan.md, phase 11). Reads what the sources say about the signed-in guest's own trip (the programme, ship notices, tender outlook,
/// flight status, weather, the ship's sea state, their orders and cases), has <see cref="StanleyChangeRules"/> turn it into ranked change cards and keeps, for that guest only, when each change was first noticed,
/// which version they dismissed and when they last caught up. Nothing is cancelled, rebooked, paid or changed here: a card's option that would change something is a phase 5 action the guest previews and confirms.
/// A source that cannot be read is named (<c>unread</c>) and never guessed at.
/// </summary>
public sealed class StanleyChangeService(
    IStanleyTrips trips, ITripStore tripStore, IStanleyChangeStore store, IProgramChanges program, IPushStore pushStore, ScopeLoader scopes, ITenderOutlook tender, IWeatherService weather,
    IShipNavigation nav, StanleyTravelService travel, StanleyMoneyService money, CaseService cases, OrderService orders, IInboxStore inbox, IUserClock clock, IClock serverClock, IOptions<StanleyOptions> options, ILogger<StanleyChangeService> log)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private sealed record Read(StanleyTrip? Trip, IReadOnlyList<ChangeCard> Cards, IReadOnlyList<string> Unread, DateTime Now);

    private static long Ms(DateTime utc) => new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeMilliseconds();

    private async Task<ChangeMemory> MemoryAsync(long userId, CancellationToken ct)
    {
        if (await store.GetAsync(userId, ct) is not { } json) return ChangeMemory.Empty;
        try { return JsonSerializer.Deserialize<ChangeMemory>(json, Json) ?? ChangeMemory.Empty; }
        catch (JsonException) { return ChangeMemory.Empty; }
    }

    private async Task SaveAsync(long userId, ChangeMemory before, ChangeMemory after, CancellationToken ct)
    {
        var next = JsonSerializer.Serialize(after, Json);
        if (next == JsonSerializer.Serialize(before, Json)) return;
        await store.PutAsync(userId, next, serverClock.UtcNow, ct);
    }

    private static HashSet<string> SavedIds(IEnumerable<PushSubscriptionRow> subs, IEnumerable<string>? given) =>
        [.. subs.SelectMany(s => s.Watch.Split(' ', StringSplitOptions.RemoveEmptyEntries)).Concat(given ?? []).Take(StanleyChangeRules.MaxSaved * 2)];

    /// <summary>Reads each source for this guest. A source that fails is left out and named; the others are still used.</summary>
    private async Task<Read> ReadAsync(UserRecord user, string? sailingId, IEnumerable<string>? saved, CancellationToken ct)
    {
        var now = await clock.NowAsync(user, ct);
        if (!options.Value.Switches.Changes) return new(null, [], [], now);
        var trip = await trips.LoadAsync(user, sailingId, ct);
        if (trip is null) return new(null, [], [], now);
        var unread = new List<string>();
        async Task<T?> Try<T>(string name, Func<Task<T>> read) where T : class
        {
            try { return await read(); }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogWarning(e, "The change engine could not read {Source}", name); unread.Add(name); return null; }
        }

        var booking = (await tripStore.ListForUserAsync(user.Id, ct)).FirstOrDefault(b => b.Status == "confirmed" && b.SailingId == trip.SailingId);
        var timeline = trip.Timeline;
        var day = StanleyChangeRules.DayNumber(trip);
        var subs = await pushStore.ListSubscriptionsAsync(user.Id, ct);
        var scenarios = await Try("ship notices", async () => await scopes.ScenariosAsync(user, ct)) ?? [];

        var tenders = new List<TenderSignal>();
        var skies = new List<SkySignal>();
        foreach (var d in timeline.Days.Where(d => d.Day >= Math.Max(1, day) && d.Day <= Math.Max(1, day) + 3 && timeline.IsCall(d)))
        {
            var iso = d.Date.ToString("yyyy-MM-dd");
            if (Itinerary.PortOf(d.Port)?.Tender == true)
            {
                var o = await Try("the tender outlook", () => Task.FromResult(tender.Outlook(d.Port, iso)));
                if (o is not null && o.Band != "good") tenders.Add(new(d.Port, o.Date, o.Band, o.Percent));
            }
            if (d.Day <= Math.Max(1, day) + 1)
            {
                var sky = await Try("the weather forecast", () => Task.FromResult(weather.Sky(d.Date, d.Port)));
                if (sky is not null) skies.Add(new(d.Day, d.Port, sky.RainFrom, sky.RainTo));
            }
        }

        TravelFlightDto? flight = null;
        var away = timeline.LastDay.DayNumber - trip.Today.DayNumber;
        if (away is >= 0 and <= 3) flight = await Try("the flight status", () => travel.FlightAsync(user, trip.SailingId, ct));

        SeaSignal? sea = null;
        if (day >= 1 && day <= timeline.Days.Count)
        {
            var s = await Try("the ship's sea state", () => Task.FromResult(nav.Sea(timeline, Ms(now))));
            if (s is not null) sea = new(s.WaveM, s.SwellM);
        }

        var caseSignals = new List<CaseSignal>();
        var orderSignals = new List<OrderSignal>();
        if (booking is not null && !user.IsSupervised)
        {
            var view = await Try("your cases", () => cases.ListAsync(user, booking.Number, ct));
            if (view is not null) caseSignals.AddRange(view.Cases.Select(c => new CaseSignal(c.Number, c.Kind, c.Stage, c.Outcome, c.OpenedAt, c.DueAt)));
            var list = await Try("your orders", () => orders.ListAsync(user, booking.Number, ct));
            if (list is not null) orderSignals.AddRange(list.Select(o => new OrderSignal(o.Id.ToString("N")[..8], o.Stage, o.Unavailable.Count)));
        }

        // The spend pace (phase 12) only for a guest who is aboard and has chosen a budget for Stanley to watch.
        SpendSignal? spend = null;
        if (booking is not null && !user.IsSupervised && options.Value.Switches.Money && day >= 1 && day <= trip.Nights && await money.BudgetAsync(user.Id, ct) is { } budget)
        {
            var pace = await Try("your spending", () => money.PaceForAsync(user, trip, booking, budget, ct));
            if (pace is not null) spend = new SpendSignal(pace);
        }

        var facts = new ChangeFacts(now, trip, program.Current(), SavedIds(subs, saved), scenarios, tenders, flight, skies, sea, caseSignals, orderSignals, spend);
        return new(trip, StanleyChangeRules.Cards(facts), unread, now);
    }

    /// <summary>Reads, notes what is new and answers the cards with the time each was first noticed. This is what the other endpoints are built on.</summary>
    private async Task<(Read Read, IReadOnlyList<ChangeCard> Cards, ChangeMemory Memory)> NoticedAsync(UserRecord user, string? sailingId, IEnumerable<string>? saved, CancellationToken ct)
    {
        if (!StanleyChangeRules.ValidSaved(saved)) throw ApiException.Invalid("saved");
        var read = await ReadAsync(user, sailingId, saved, ct);
        var before = await MemoryAsync(user.Id, ct);
        var after = read.Trip is null ? before : StanleyChangeRules.Observe(before, read.Cards, Ms(read.Now));
        if (read.Trip is not null) await SaveAsync(user.Id, before, after, ct);
        return (read, StanleyChangeRules.Noticed(read.Cards, after), after);
    }

    public async Task<ChangeListDto> ListAsync(UserRecord user, string? sailingId, IEnumerable<string>? saved, CancellationToken ct)
    {
        var (read, cards, memory) = await NoticedAsync(user, sailingId, saved, ct);
        return new(Ms(read.Now), read.Trip is null ? "" : StanleyChangeRules.ClockText(read.Trip, read.Now), [.. cards.Where(c => !StanleyChangeRules.Dismissed(memory, c))], read.Unread);
    }

    public async Task<ChangeExplanation> ExplainAsync(UserRecord user, string? id, string? sailingId, IEnumerable<string>? saved, CancellationToken ct)
    {
        var (_, cards, _) = await NoticedAsync(user, sailingId, saved, ct);
        return StanleyChangeRules.Explain(cards.FirstOrDefault(c => c.Id == id) ?? throw ApiException.NotFound());
    }

    private async Task<bool> QuietAsync(UserRecord user, StanleyTrip trip, DateTime now, CancellationToken ct)
    {
        JsonNode? stored = null;
        if (await inbox.GetPrefsJsonAsync(user.Id, ct) is { } json)
        {
            try { stored = JsonNode.Parse(json); } catch (JsonException) { }
        }
        var quiet = NotificationRules.NormalizePrefs(stored)["quiet"] as JsonObject;
        var zone = TimeZoneInfo.FindSystemTimeZoneById(trip.Timeline.ShipZoneAt(DateTime.SpecifyKind(now, DateTimeKind.Utc)));
        var local = TimeOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(now, DateTimeKind.Utc), zone));
        return PushRules.InQuiet(local, quiet?["on"]?.GetValue<bool>() ?? false, quiet?["from"]?.GetValue<string>() ?? "22:00", quiet?["to"]?.GetValue<string>() ?? "07:00");
    }

    /// <summary>What to show on a screen now, under the delivery rules.</summary>
    public async Task<ChangeDelivery> DeliverAsync(UserRecord user, ChangeDeliveryRequest? body, CancellationToken ct)
    {
        if (body is null || body.Screen is null || !StanleyChangeRules.Screens.Contains(body.Screen)) throw ApiException.Invalid("screen");
        if (body.Level is null || !StanleyChangeRules.Levels.Contains(body.Level)) throw ApiException.Invalid("level");
        if (!StanleyChangeRules.ValidShown(body.Shown)) throw ApiException.Invalid("shown");
        var (read, cards, memory) = await NoticedAsync(user, body.SailingId, body.Saved, ct);
        if (read.Trip is null) return new([], null, []);
        var quiet = await QuietAsync(user, read.Trip, read.Now, ct);
        return StanleyChangeRules.Deliver(cards, memory, body.Screen, body.Level, body.Shown ?? [], quiet, StanleyChangeRules.Missed(cards, memory));
    }

    /// <summary>The guest dismissed a card. It stays dismissed until its facts change (the fingerprint it carries no longer matches).</summary>
    public async Task<ChangeListDto> DismissAsync(UserRecord user, string? id, ChangeDismissRequest? body, CancellationToken ct)
    {
        if (body?.Fingerprint is not { Length: > 0 and <= 16 } fp) throw ApiException.Invalid("fingerprint");
        var (read, cards, memory) = await NoticedAsync(user, body.SailingId, null, ct);
        // Cards that depend on saved events are not in this read, so a dismissal of one is checked against the memory of what was seen.
        var card = cards.FirstOrDefault(c => c.Id == id && c.Fingerprint == fp);
        if (card is null && !(id is { Length: > 0 and <= 120 } && memory.Seen.TryGetValue(id, out var seen) && seen.Fp == fp)) throw ApiException.NotFound();
        var next = card is not null ? StanleyChangeRules.Dismiss(memory, card)
            : memory with { Seen = new Dictionary<string, ChangeSeen>(memory.Seen) { [id!] = memory.Seen[id!] with { DismissedFp = fp } } };
        await SaveAsync(user.Id, memory, next, ct);
        return new(Ms(read.Now), read.Trip is null ? "" : StanleyChangeRules.ClockText(read.Trip, read.Now), [.. cards.Where(c => !StanleyChangeRules.Dismissed(next, c))], read.Unread);
    }

    /// <summary>"What did I miss?": the changes first noticed since the guest last caught up.</summary>
    public async Task<ChangeMissed> MissedAsync(UserRecord user, string? sailingId, IEnumerable<string>? saved, CancellationToken ct)
    {
        var (_, cards, memory) = await NoticedAsync(user, sailingId, saved, ct);
        return StanleyChangeRules.Missed(cards, memory);
    }

    /// <summary>The guest has seen the catch-up: what was new is no longer new.</summary>
    public async Task CaughtUpAsync(UserRecord user, CancellationToken ct)
    {
        var memory = await MemoryAsync(user.Id, ct);
        await SaveAsync(user.Id, memory, StanleyChangeRules.CaughtUp(memory, Ms(await clock.NowAsync(user, ct))), ct);
    }

    /// <summary>The answer to "what changed" or "explain this change" in the chat, from the same cards as the Home screen. Null when the guest has no current trip.</summary>
    public async Task<StanleyCardDto?> ChatAsync(UserRecord user, string? sailingId, bool explain, CancellationToken ct)
    {
        var (read, cards, memory) = await NoticedAsync(user, sailingId, null, ct);
        if (read.Trip is null) return null;
        var open = cards.Where(c => !StanleyChangeRules.Dismissed(memory, c)).ToList();
        return explain ? StanleyChangeRules.ExplainChatCard(open, read.Now) : StanleyChangeRules.ChatCard(open, read.Unread, read.Now);
    }

    /// <summary>The cards worth sending to the phone, for the push check. Reads only; nothing is recorded as seen here.</summary>
    public async Task<IReadOnlyList<ChangeCard>> PushCardsAsync(UserRecord user, CancellationToken ct)
    {
        var read = await ReadAsync(user, null, null, ct);
        return [.. read.Cards.Where(StanleyChangeRules.PushWorthy)];
    }
}
