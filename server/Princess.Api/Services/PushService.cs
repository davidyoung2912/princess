using System.Text.Json.Nodes;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Reaching the guest's phone (next-level plan N3.2, N3.3, N3.6). Works out which of the five notices apply, applies the guest's budget, calm mode and quiet hours
/// (safety notices skip them), sends through <see cref="IPushSender"/> and keeps a log of what was sent and what was held back and why.
/// The check runs when the app asks (<see cref="DispatchAsync"/>); a scheduler that calls it for every signed-up person replaces that with no change to the rules.
/// </summary>
public sealed class PushService(
    IPushStore store, IPushSender sender, IInboxStore inbox, TripService trips, IUserClock clock, ScopeLoader scopes,
    IShipboardStore shipboard, IPortRowStore portRows, IProgramChanges program, IStateStore state)
{
    public async Task<PushStatusDto> StatusAsync(UserRecord actor, string? endpoint, CancellationToken ct)
    {
        var subs = await store.ListSubscriptionsAsync(actor.Id, ct);
        var log = await store.ListDeliveriesAsync(actor.Id, PushRules.MaxLog, ct);
        var mine = endpoint is null ? null : subs.FirstOrDefault(s => s.Endpoint == endpoint);
        var shown = mine ?? subs.FirstOrDefault();
        return new PushStatusDto(
            sender.PublicKey is not null, sender.PublicKey, mine is not null, subs.Count,
            shown?.Budget ?? PushRules.DefaultBudget, shown?.Calm ?? false, [.. Watch(subs)],
            log.Count(l => l.Outcome == "sent" && !l.Read), [.. log.Select(ToDto)]);
    }

    private static IEnumerable<string> Watch(IEnumerable<PushSubscriptionRow> subs) =>
        subs.SelectMany(s => s.Watch.Split(' ', StringSplitOptions.RemoveEmptyEntries)).Distinct().Take(PushRules.MaxWatch);

    private static PushLogDto ToDto(PushDeliveryRow r) =>
        new(r.NoticeKey, r.Kind, r.Outcome, r.Reason, r.Bypass, r.Devices, JsonNode.Parse(r.ParamsJson) ?? new JsonObject(), TripRules.ToMs(r.At), r.Read);

    public async Task<PushStatusDto> SubscribeAsync(UserRecord actor, PushSubscribeRequest? body, CancellationToken ct)
    {
        if (sender.PublicKey is null) throw ApiException.Conflict("pushUnavailable");
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        if (!PushRules.ValidEndpoint(body?.Endpoint) || !PushRules.ValidKey(body?.P256dh) || !PushRules.ValidKey(body?.Auth)) throw ApiException.Invalid("badSubscription");
        var settings = PushRules.NormalizeSettings(body!.Budget, body.Calm, body.Watch);
        var row = new PushSubscriptionRow(body.Endpoint!, body.P256dh!, body.Auth!, settings.Budget, settings.Calm, string.Join(' ', settings.Watch));
        if (!await store.SaveSubscriptionAsync(actor.Id, row, PushRules.MaxDevices, await clock.NowAsync(actor, ct), ct)) throw ApiException.Conflict("tooManyDevices");
        return await StatusAsync(actor, body.Endpoint, ct);
    }

    public async Task<PushStatusDto> UnsubscribeAsync(UserRecord actor, PushUnsubscribeRequest? body, CancellationToken ct)
    {
        if (!PushRules.ValidEndpoint(body?.Endpoint)) throw ApiException.Invalid("badSubscription");
        await store.RemoveSubscriptionAsync(actor.Id, body!.Endpoint!, ct);
        return await StatusAsync(actor, null, ct);
    }

    public async Task<PushStatusDto> MarkReadAsync(UserRecord actor, CancellationToken ct)
    {
        await store.MarkDeliveriesReadAsync(actor.Id, await clock.NowAsync(actor, ct), ct);
        return await StatusAsync(actor, null, ct);
    }

    /// <summary>Checks what the guest should hear now, sends it within their limits and logs the outcome. Safe to call often: a notice is sent once.</summary>
    public async Task<PushStatusDto> DispatchAsync(UserRecord actor, string? endpoint, CancellationToken ct)
    {
        var subs = await store.ListSubscriptionsAsync(actor.Id, ct);
        if (subs.Count > 0 && sender.PublicKey is not null) await RunAsync(actor, subs, ct);
        return await StatusAsync(actor, endpoint, ct);
    }

    private async Task RunAsync(UserRecord actor, List<PushSubscriptionRow> subs, CancellationToken ct)
    {
        var now = await clock.NowAsync(actor, ct);
        var booking = await trips.CurrentAsync(actor, now, ct);
        var departure = booking is null ? (DateOnly?)null : DateOnly.FromDateTime(booking.Departure);
        var zone = departure is { } d ? Itinerary.ShipZoneAt(d, now) : Itinerary.ShipHomeZone;
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(now, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(zone));

        var notices = PushRules.Build(await InputAsync(actor, booking, departure, now, [.. Watch(subs)], ct));
        if (notices.Count == 0) return;

        var prefs = await PrefsAsync(actor.Id, ct);
        // Several phones: the strictest limit applies, so one phone's calm mode is not undone by another.
        var settings = new PushSettings(subs.Min(s => s.Budget), subs.Any(s => s.Calm), [.. Watch(subs)]);
        var log = await store.ListDeliveriesAsync(actor.Id, 200, ct);
        var sentKeys = log.Where(l => l.Outcome == "sent").Select(l => l.NoticeKey).ToHashSet();
        var sentToday = log.Count(l => l.Outcome == "sent" && !l.Bypass && InZone(l.At, zone).Date == local.Date);

        foreach (var n in notices.Where(n => !sentKeys.Contains(n.Key)))
        {
            var decision = PushRules.Decide(n, prefs, settings, TimeOnly.FromDateTime(local), sentToday);
            var paramsJson = System.Text.Json.JsonSerializer.Serialize(n.Params);
            if (!decision.Send)
            {
                // A held notice is written down once per reason; it is tried again at every check.
                if (log.FirstOrDefault(l => l.NoticeKey == n.Key) is not { Outcome: "held" } last || last.Reason != decision.Reason)
                    await store.AddDeliveryAsync(actor.Id, new(n.Key, n.Kind, n.Bypass, "held", decision.Reason, 0, paramsJson, now, false), now, ct);
                continue;
            }
            var message = new PushMessage(n.Key, n.Kind, n.Title, n.Body, n.Path, n.Bypass, n.Params);
            var delivered = 0;
            foreach (var s in subs)
            {
                var result = await sender.SendAsync(s, message, ct);
                if (result == PushResult.Gone) await store.RemoveEndpointAsync(s.Endpoint, ct);
                else if (result == PushResult.Delivered) delivered++;
            }
            if (delivered == 0) continue; // nothing reached a phone: try again at the next check rather than log a send
            await store.AddDeliveryAsync(actor.Id, new(n.Key, n.Kind, n.Bypass, "sent", null, delivered, paramsJson, now, false), now, ct);
            if (!n.Bypass) sentToday++;
        }
    }

    private static DateTime InZone(DateTime utc, string zone) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(zone));

    private async Task<JsonObject> PrefsAsync(long userId, CancellationToken ct)
    {
        JsonNode? stored = null;
        if (await inbox.GetPrefsJsonAsync(userId, ct) is { } json)
        {
            try { stored = JsonNode.Parse(json); } catch (System.Text.Json.JsonException) { }
        }
        return NotificationRules.NormalizePrefs(stored);
    }

    private async Task<PushInput> InputAsync(UserRecord actor, BookingRow? booking, DateOnly? departure, DateTime now, IReadOnlyCollection<string> watched, CancellationToken ct)
    {
        var acked = (await shipboard.ListAcksAsync(actor.Id, ct)).Select(a => a.ScenarioId).ToHashSet();
        var disruptions = DisruptionRules.Active(await scopes.ScenariosAsync(actor, ct)).Where(d => !acked.Contains(d.Id)).ToList();
        var reminderAt = await ReminderAtAsync(actor.Id, ct);
        if (booking is null || departure is not { } dep)
            return new(now, "ok", "", null, false, 45, false, [], [], 0, disruptions, reminderAt);

        var trip = await trips.BuildAsync(booking, current: true, now, ct);
        var port = AboardRules.PortDayAt(dep, now) is { } p ? AboardRules.WithState(p, now) : null;
        var rows = port is null ? [] : (await portRows.ListAsync(booking.BookingId, ct)).Where(r => !r.Deleted).ToList();
        var notBack = port is not null && rows.Any(r => r.Kind == "presence" && r.Key.StartsWith(port.Date + "|", StringComparison.Ordinal) && Status(r.Json) is not (null or "back"));
        var alert = rows.FirstOrDefault(r => r.Kind == "setting" && r.Key == "alertBefore")?.Json is { } a && int.TryParse(a, out var minutes) ? minutes : 45;
        var dayNumber = TripRules.Today(now).DayNumber - dep.DayNumber + 1;
        return new(now, trip.Payment, trip.Plan.FinalDue, port, port is not null && TripRules.ToMs(now) >= port.ArriveAt, alert, notBack, program.Current(), watched, dayNumber, disruptions, reminderAt);
    }

    /// <summary>When the guest asked to be reminded (ms), from their own <c>reminder</c> document; null when there is none or it is not a number.</summary>
    private async Task<long?> ReminderAtAsync(long userId, CancellationToken ct)
    {
        if (await state.GetAsync(false, userId, "reminder", ct) is not { } row) return null;
        try { return JsonNode.Parse(row.Json)?["at"] is JsonValue v && v.TryGetValue<long>(out var at) && at > 0 ? at : null; }
        catch (System.Text.Json.JsonException) { return null; }
    }

    private static string? Status(string? json)
    {
        try { return JsonNode.Parse(json ?? "null")?["status"]?.GetValue<string>(); } catch (Exception e) when (e is System.Text.Json.JsonException or InvalidOperationException) { return null; }
    }
}
