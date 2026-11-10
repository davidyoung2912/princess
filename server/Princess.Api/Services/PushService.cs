using System.Net;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
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
    IShipboardStore shipboard, IPortRowStore portRows, IProgramChanges program, IStateStore state, TripWatchService watchService, InstalmentChargeService instalments,
    IEmailSender email, ISmsSender sms, IAccountStore profiles, IOptions<JwtOptions> jwt, IConfiguration config, PhoneCheckService phoneCheck, EmailCheckService emailCheck, StanleyChangeService changes, StanleyReminderService? stanleyReminders = null, StanleyActionService? stanleyActions = null, StanleyNoticeRelay? relay = null, IOnboardStore? onboard = null, StanleyMomentService? moments = null)
{
    private byte[] NoticeKey => NoticeEmailRules.KeyFrom(jwt.Value.SigningKey);

    public async Task<PushStatusDto> StatusAsync(UserRecord actor, string? endpoint, CancellationToken ct)
    {
        var subs = await store.ListSubscriptionsAsync(actor.Id, ct);
        var log = (await store.ListDeliveriesAsync(actor.Id, PushRules.MaxLog, ct)).Where(l => !IsOtherChannel(l.NoticeKey)).ToList();
        var mine = endpoint is null ? null : subs.FirstOrDefault(s => s.Endpoint == endpoint);
        var shown = mine ?? subs.FirstOrDefault();
        return new PushStatusDto(
            sender.PublicKey is not null, sender.PublicKey, mine is not null, subs.Count,
            shown?.Budget ?? PushRules.DefaultBudget, shown?.Calm ?? false, [.. Watch(subs)],
            log.Count(l => l.Outcome == "sent" && !l.Read), [.. log.Select(ToDto)]);
    }

    // Email and text deliveries are kept in the same log under "email:" and "sms:" keys so each is sent once; they are not shown as phone alerts.
    private static bool IsOtherChannel(string key) => key.StartsWith("email:", StringComparison.Ordinal) || key.StartsWith("sms:", StringComparison.Ordinal);

    private static IEnumerable<string> Watch(IEnumerable<PushSubscriptionRow> subs) =>
        subs.SelectMany(s => s.Watch.Split(' ', StringSplitOptions.RemoveEmptyEntries)).Distinct().Take(PushRules.MaxWatch);

    private static PushLogDto ToDto(PushDeliveryRow r) =>
        new(r.NoticeKey, r.Kind, r.Outcome, r.Reason, r.Bypass, r.Devices, JsonNode.Parse(r.ParamsJson) ?? new JsonObject(), TripRules.ToMs(r.At), r.Read, r.Acked);

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

    /// <summary>The guest acknowledged a safety alert (tapped it, or pressed Got it): it will not fall back to text or email.</summary>
    public async Task<PushStatusDto> AckAsync(UserRecord actor, PushAckRequest? body, CancellationToken ct)
    {
        if (body?.Key is not { Length: > 0 and <= 120 } key) throw ApiException.Invalid("badKey");
        await store.AckDeliveryAsync(actor.Id, key, await clock.NowAsync(actor, ct), ct);
        return await StatusAsync(actor, null, ct);
    }

    /// <summary>Checks what the guest should hear now, sends it within their limits and logs the outcome. Safe to call often: a notice is sent once.</summary>
    public async Task<PushStatusDto> DispatchAsync(UserRecord actor, string? endpoint, CancellationToken ct)
    {
        await instalments.ChargeDueAsync(actor, await clock.NowAsync(actor, ct), ct);
        var subs = await store.ListSubscriptionsAsync(actor.Id, ct);
        await RunAsync(actor, subs, ct);
        return await StatusAsync(actor, endpoint, ct);
    }

    /// <summary>
    /// Tells a guest about a chat event now (docs/chat-plan.md, 4.4), instead of waiting for the app to ask. It follows the guest's own limits: no phone, no push; calm mode,
    /// quiet hours and a daily budget of none hold it (it stays in the app either way, so nothing is lost). It does not use up the daily notice budget, and one event is sent once.
    /// Children's accounts have no phone alerts, so a request that needs a guardian goes to the guardian.
    /// </summary>
    public async Task NotifyChatAsync(UserRecord target, PushNotice n, CancellationToken ct)
    {
        if (target.IsSupervised || sender.PublicKey is null) return;
        var subs = await store.ListSubscriptionsAsync(target.Id, ct);
        if (subs.Count == 0) return;
        var now = await clock.NowAsync(target, ct);
        var log = await store.ListDeliveriesAsync(target.Id, 200, ct);
        if (log.Any(l => l.NoticeKey == n.Key && l.Outcome == "sent")) return;
        var booking = await trips.CurrentAsync(target, now, ct);
        var departure = booking is null ? (DateOnly?)null : DateOnly.FromDateTime(booking.Departure);
        var zone = departure is { } d ? Itinerary.ShipZoneAt(d, now) : Itinerary.ShipHomeZone;
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(now, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(zone));
        var prefs = await PrefsAsync(target.Id, ct);
        var settings = new PushSettings(subs.Min(s => s.Budget), subs.Any(s => s.Calm), []);
        var paramsJson = System.Text.Json.JsonSerializer.Serialize(n.Params);
        // sentToday is 0: chat does not count against the budget, but a guest who chose "none" (budget 0) still hears nothing.
        var decision = PushRules.Decide(n, prefs, settings, TimeOnly.FromDateTime(local), 0, Shipboard.Ms(now));
        if (!decision.Send)
        {
            if (log.FirstOrDefault(l => l.NoticeKey == n.Key) is not { Outcome: "held" } last || last.Reason != decision.Reason)
                await store.AddDeliveryAsync(target.Id, new(n.Key, n.Kind, n.Bypass, "held", decision.Reason, 0, paramsJson, now, false), now, ct);
            return;
        }
        var message = new PushMessage(n.Key, n.Kind, n.Title, n.Body, n.Path, n.Bypass, n.Params, n.Tag);
        var delivered = 0;
        foreach (var s in subs)
        {
            var result = await sender.SendAsync(s, message, ct);
            if (result == PushResult.Gone) await store.RemoveEndpointAsync(s.Endpoint, ct);
            else if (result == PushResult.Delivered) delivered++;
        }
        if (delivered > 0) await store.AddDeliveryAsync(target.Id, new(n.Key, n.Kind, n.Bypass, "sent", null, delivered, paramsJson, now, false), now, ct);
    }

    private async Task RunAsync(UserRecord actor, List<PushSubscriptionRow> subs, CancellationToken ct)
    {
        var now = await clock.NowAsync(actor, ct);
        var booking = await trips.CurrentAsync(actor, now, ct);
        var departure = booking is null ? (DateOnly?)null : DateOnly.FromDateTime(booking.Departure);
        var zone = departure is { } d ? Itinerary.ShipZoneAt(d, now) : Itinerary.ShipHomeZone;
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(now, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(zone));

        var input = await InputAsync(actor, booking, departure, now, [.. Watch(subs)], ct);
        if (stanleyReminders is not null) input = input with { Reminders = await stanleyReminders.DueAsync(actor.Id, now, ct) };
        if (stanleyActions is not null) input = input with { HelperPrepared = [.. (await stanleyActions.WaitingFromHelperAsync(actor, ct)).Select(a => a.Id)] };
        var built = PushRules.Build(input).Select(n => PushRules.WithLink(n, booking?.Number)).ToList();
        // The thread keeps the full text (the guest is in the app); the phone gets the lock-screen version. Writing to the thread never holds the push back.
        if (relay is not null) await relay.RelayAsync(actor, [.. built, .. await ScreenNoticesAsync(actor, booking, departure, now, ct)], now, ct);
        if (moments is not null) await PostMomentAsync(actor, booking, now, local, ct);
        var notices = built.Select(PushRules.Redact).ToList();
        if (notices.Count == 0) return;

        var prefs = await PrefsAsync(actor.Id, ct);
        // Several phones: the strictest limit applies, so one phone's calm mode is not undone by another.
        var settings = new PushSettings(subs.Min(s => s.Budget), subs.Any(s => s.Calm), [.. Watch(subs)]);
        var log = await store.ListDeliveriesAsync(actor.Id, 200, ct);
        var sentKeys = log.Where(l => l.Outcome == "sent").Select(l => l.NoticeKey).ToHashSet();
        await ReachOtherChannelsAsync(actor, notices, prefs, TimeOnly.FromDateTime(local), sentKeys, now, ct);
        await FallbackAsync(actor, notices, log, now, ct);
        if (subs.Count == 0 || sender.PublicKey is null) return;
        var sentToday = log.Count(l => l.Outcome == "sent" && !l.Bypass && !IsOtherChannel(l.NoticeKey) && InZone(l.At, zone).Date == local.Date);

        foreach (var n in notices.Where(n => !sentKeys.Contains(n.Key)))
        {
            var decision = PushRules.Decide(n, prefs, settings, TimeOnly.FromDateTime(local), sentToday, Shipboard.Ms(now));
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

    /// <summary>Sends the notice by email and by text where the guest chose those channels, once each (the log keeps an "email:" or "sms:" row). A refused send is tried again at the next check.</summary>
    private async Task ReachOtherChannelsAsync(UserRecord actor, List<PushNotice> notices, JsonObject prefs, TimeOnly local, HashSet<string> sentKeys, DateTime now, CancellationToken ct)
    {
        var phone = (await profiles.GetProfileAsync(actor.Id, ct))?.Phone;
        // Texts go only to a number the guest has confirmed with a code.
        if (!await phoneCheck.IsVerifiedAsync(actor.Id, phone, ct)) phone = null;
        // Emails likewise go only to an address the guest has confirmed.
        var emailOk = !string.IsNullOrWhiteSpace(actor.Email) && await emailCheck.IsVerifiedAsync(actor, ct);
        // Only the payment and travel notices (instalments, tender, flight) go beyond the phone; the on-board and port-day ones are for the phone alone.
        // The exception is the "head back to the ship" notice for a guest who is away: it also goes by text to a confirmed number, straight away, because a guest ashore may have no data
        // for the push to arrive on (the unacknowledged-alert fallback below only starts once a push has reached a phone). Never by email: nobody reads it on the pier.
        foreach (var n in notices.Where(n => n.Kind is "payment" or "travel" || AwayRules.IsReturnNotice(n)))
        {
            var paramsJson = System.Text.Json.JsonSerializer.Serialize(n.Params);
            if (emailOk && !AwayRules.IsReturnNotice(n) && !sentKeys.Contains("email:" + n.Key) && PushRules.Reach(n, prefs, "email", local)
                && await email.SendAsync(NoticeEmail(actor, n), ct))
                await store.AddDeliveryAsync(actor.Id, new("email:" + n.Key, n.Kind, n.Bypass, "sent", null, 1, paramsJson, now, true), now, ct);
            if (!string.IsNullOrWhiteSpace(phone) && !sentKeys.Contains("sms:" + n.Key) && PushRules.Reach(n, prefs, "sms", local)
                && await sms.SendAsync(new SmsMessage(phone, n.Title + ": " + n.Body), ct))
                await store.AddDeliveryAsync(actor.Id, new("sms:" + n.Key, n.Kind, n.Bypass, "sent", null, 1, paramsJson, now, true), now, ct);
        }
    }

    /// <summary>
    /// COM-04: a safety alert nobody acknowledged within <see cref="PushRules.FallbackAfter"/> goes once more by text to a confirmed phone, or by email to a confirmed address when
    /// there is no such phone. It is only sent while the notice still applies (a built notice), and the log keeps an "sms:" or "email:" row so it is never repeated.
    /// </summary>
    private async Task FallbackAsync(UserRecord actor, List<PushNotice> notices, List<PushDeliveryRow> log, DateTime now, CancellationToken ct)
    {
        var due = PushRules.FallbackDue(log, now);
        if (due.Count == 0) return;
        var phone = (await profiles.GetProfileAsync(actor.Id, ct))?.Phone;
        if (!await phoneCheck.IsVerifiedAsync(actor.Id, phone, ct)) phone = null;
        var emailOk = !string.IsNullOrWhiteSpace(actor.Email) && await emailCheck.IsVerifiedAsync(actor, ct);
        foreach (var n in notices.Where(n => due.Contains(n.Key)))
        {
            var paramsJson = System.Text.Json.JsonSerializer.Serialize(n.Params);
            var text = "Not yet seen. " + n.Title + ": " + n.Body;
            if (!string.IsNullOrWhiteSpace(phone) && await sms.SendAsync(new SmsMessage(phone, text), ct))
                await store.AddDeliveryAsync(actor.Id, new("sms:" + n.Key, n.Kind, n.Bypass, "sent", null, 1, paramsJson, now, true), now, ct);
            else if (emailOk && await email.SendAsync(NoticeEmail(actor, n with { Body = text }), ct))
                await store.AddDeliveryAsync(actor.Id, new("email:" + n.Key, n.Kind, n.Bypass, "sent", null, 1, paramsJson, now, true), now, ct);
        }
    }

    private EmailMessage NoticeEmail(UserRecord actor, PushNotice n)
    {
        var url = UnsubscribeUrl(actor.Id, n.Category);
        return new(actor.Email!, n.Title, NoticeEmailRules.WithFooter(n.Body, url), url);
    }

    private string? UnsubscribeUrl(long userId, string category) =>
        NoticeEmailRules.Token(NoticeKey, userId, category) is { } t ? $"{(config["Public:ApiBaseUrl"] ?? "").TrimEnd('/')}/api/v1/public/notice/unsubscribe/{t}" : null;

    /// <summary>Switches off the email channel for the category the link was made for, with no sign-in. False when the link is not one of ours.</summary>
    public async Task<bool> UnsubscribeEmailAsync(string? token, CancellationToken ct)
    {
        if (NoticeEmailRules.Verify(NoticeKey, token) is not { } who) return false;
        var next = NoticeEmailRules.WithEmailOff(await PrefsAsync(who.UserId, ct), who.Category);
        await inbox.SavePrefsJsonAsync(who.UserId, next.ToJsonString(), DateTime.UtcNow, ct);
        return true;
    }

    public static string UnsubscribePage(bool ok) =>
        $"<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Notice emails</title><body style=\"font-family:system-ui;max-width:32rem;margin:3rem auto;padding:0 1rem\"><h1>{(ok ? "No more of these emails" : "That link does not work")}</h1><p>{WebUtility.HtmlEncode(ok ? "You will not get this kind of notice by email. You can turn it back on in the app under notification settings. Nothing else has changed." : "It may be mistyped or out of date. You can also turn the email off in the app under notification settings.")}</p></body></html>";

    private static DateTime InZone(DateTime utc, string zone) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(zone));

    /// <summary>Whether do-not-disturb is on, and until when (milliseconds; 0 when off or ended).</summary>
    public async Task<ChatDndDto> DndAsync(UserRecord actor, CancellationToken ct)
    {
        var until = (await PrefsAsync(actor.Id, ct))["dnd"]?["until"]?.GetValue<long>() ?? 0;
        return new(ChatUrgencyRules.DndOn(until, Shipboard.Ms(await clock.NowAsync(actor, ct))) ? until : 0);
    }

    /// <summary>
    /// The one-tap do-not-disturb on the Chat screen: "hour", "morning" (until the guest's quiet hours end, 07:00 when they have none) or "off". It is kept with the notification
    /// preferences, so it follows the guest across devices, holds phone alerts and the in-app pop-up (not urgent chat messages) and ends by itself. 400 mode; 403 supervised.
    /// </summary>
    public async Task<ChatDndDto> SetDndAsync(UserRecord actor, ChatDndRequest? body, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var now = await clock.NowAsync(actor, ct);
        var booking = await trips.CurrentAsync(actor, now, ct);
        var departure = booking is null ? (DateOnly?)null : DateOnly.FromDateTime(booking.Departure);
        var local = InZone(now, departure is { } d ? Itinerary.ShipZoneAt(d, now) : Itinerary.ShipHomeZone);
        var prefs = await PrefsAsync(actor.Id, ct);
        var morning = prefs["quiet"]?["to"]?.GetValue<string>() ?? "07:00";
        var length = ChatUrgencyRules.DndLength(body?.Mode, local, morning) ?? throw ApiException.Invalid("mode");
        var until = length == TimeSpan.Zero ? 0 : Shipboard.Ms(now + length);
        prefs["dnd"] = new JsonObject { ["until"] = until };
        await inbox.SavePrefsJsonAsync(actor.Id, prefs.ToJsonString(), now, ct);
        return new(until);
    }

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
        // The change engine reads the same sources again, so one failing source never stops the other notices.
        IReadOnlyList<ChangeCard> stanley = [];
        try { stanley = await changes.PushCardsAsync(actor, ct); }
        catch (Exception e) when (e is not OperationCanceledException) { stanley = []; }
        if (booking is null || departure is not { } dep)
            return new(now, "ok", "", null, false, 45, false, [], [], 0, disruptions, reminderAt, StanleyCards: stanley);

        var postcards = PostcardRules.Due(await PostcardRefsAsync(actor.Id, ct), booking.SailingId, dep.DayNumber - TripRules.Today(now).DayNumber);
        var trip = await trips.BuildAsync(booking, current: true, now, ct);
        var port = AboardRules.PortDayAt(TimelineBook.For(booking.SailingId, dep), now) is { } p ? AboardRules.WithState(p, now) : null;
        var rows = port is null ? [] : (await portRows.ListAsync(booking.BookingId, ct)).Where(r => !r.Deleted).ToList();
        var notBack = port is not null && rows.Any(r => r.Kind == "presence" && r.Key.StartsWith(port.Date + "|", StringComparison.Ordinal) && Status(r.Json) is not (null or "back"));
        var guestAway = port is not null && AwayRules.IsAway(AwayRules.StatusOf(rows.FirstOrDefault(r => r.Kind == "presence" && r.Key == AwayRules.PresenceKey(port.Date, actor.PublicId))?.Json));
        var alert = rows.FirstOrDefault(r => r.Kind == "setting" && r.Key == "alertBefore")?.Json is { } a && int.TryParse(a, out var minutes) ? minutes : 45;
        var buffer = port is null ? null : PlanBuffer(rows.FirstOrDefault(r => r.Kind == "plan" && r.Key == port.Date)?.Json);
        var dayNumber = TripRules.Today(now).DayNumber - dep.DayNumber + 1;
        var watches = await watchService.WatchAsync(booking, trip, TripRules.Today(now), ct);
        return new(now, trip.Payment, trip.Plan.FinalDue, port, port is not null && TripRules.ToMs(now) >= port.ArriveAt, alert, notBack, program.Current(), watched, dayNumber, disruptions, reminderAt, postcards, buffer, watches.Instalment, watches.Tender, watches.Flight, watches.InstalmentAuto && watches.Instalment is { } ni && string.CompareOrdinal(ni.Date, TripRules.Today(now).ToString("yyyy-MM-dd")) <= 0, watches.InstalmentTaken, stanley, GuestAway: guestAway);
    }

    /// <summary>
    /// The thread-only notices (phase 0b): the muster drill, documents, check-in and answered Guest Services requests, from the same sources their own screens read. A source that fails
    /// is left out rather than stopping the others, and none of these is ever pushed.
    /// </summary>
    private async Task<List<PushNotice>> ScreenNoticesAsync(UserRecord actor, BookingRow? booking, DateOnly? departure, DateTime now, CancellationToken ct)
    {
        try
        {
            var answered = (await inbox.ListTicketsAsync(actor.Id, ct)).Where(t => now - t.At < TimeSpan.FromDays(3) && NotificationRules.TicketStatus(t.At, now, t.Status) == "resolved").Select(t => t.PublicId).ToList();
            if (booking is null || departure is not { } dep)
                return StanleyNoticeRules.ScreenNotices(new(now, null, true, 0, 0, "done", "", answered));
            var trip = await trips.BuildAsync(booking, current: true, now, ct);
            var musterDone = onboard is null || (await onboard.ListMusterAsync(booking.BookingId, ct)).ContainsKey(actor.Id);
            var opens = TripRules.Today(DateTimeOffset.FromUnixTimeMilliseconds(trip.Checkin.OpensAt).UtcDateTime).ToString("yyyy-MM-dd");
            return StanleyNoticeRules.ScreenNotices(new(now, AboardRules.DrillAt(dep), musterDone, trip.Documents?.Missing ?? 0, trip.Documents?.PassportProblems ?? 0, trip.Checkin.State, opens, answered));
        }
        catch (Exception e) when (e is not OperationCanceledException) { return []; }
    }

    /// <summary>
    /// The proactive engine (chat phase 6): at most one suggestion card in the Stanley thread, from this guest's own trip facts. Quiet hours and do-not-disturb hold it (it waits for the next check).
    /// A failure to read the trip leaves the thread as it is.
    /// </summary>
    private async Task PostMomentAsync(UserRecord actor, BookingRow? booking, DateTime now, DateTime local, CancellationToken ct)
    {
        try
        {
            var held = PushRules.QuietOrDnd(await PrefsAsync(actor.Id, ct), TimeOnly.FromDateTime(local), Shipboard.Ms(now));
            if (booking is null)
            {
                // Dream and Discover (phase 7a): no booking yet, so the facts are the guest's saved sailings and their own recent views.
                var saved = (await inbox.ListFavouritesAsync(actor.Id, ct)).Count(k => k.StartsWith("sailing:", StringComparison.Ordinal));
                var events = (await inbox.ListJourneyEventsAsync(actor.Id, 20, ct)).Where(e => now - e.At < TimeSpan.FromDays(7)).ToList();
                var early = StageRules.Derive(new(now, [], events.Select(e => new JourneyIntent(e.Kind, e.SailingId, e.At)).ToList(), null, null, null)).Stage;
                if (saved > 0 && early == StageRules.Dream) early = StageRules.Discover;
                await moments!.PostAsync(actor, new(now, early, 0, false, null, saved, events.Count(e => e.Kind == "cabinView"), events.Any(e => e.Kind == StageRules.PriceView)), held, ct);
                return;
            }
            var trip = await trips.BuildAsync(booking, current: true, now, ct);
            var stage = StageRules.Derive(new(now, [], [], null, null, new StageTrip(booking.SailingId, DateOnly.FromDateTime(booking.Departure), trip.Plan.Balance <= 0, trip.Checkin.State == "done"))).Stage;
            var due = DateOnly.TryParse(trip.Plan.FinalDue, out var f) ? f : (DateOnly?)null;
            await moments!.PostAsync(actor, new(now, stage, trip.DaysToDeparture, trip.Plan.Balance > 0, due, DepositUnpaid: booking.PaidCents < trip.Plan.Deposit, DocumentsMissing: trip.Documents?.Missing ?? 0, CheckinOpen: trip.Checkin.State == "open"), held, ct);
        }
        catch (Exception e) when (e is not OperationCanceledException) { /* a suggestion is never worth stopping a notice for */ }
    }

    /// <summary>The postcards the guest has not read yet (ids and the sailing each was written on), from their own <c>postcards</c> document; empty when there is none.</summary>
    private async Task<IReadOnlyList<PostcardRef>> PostcardRefsAsync(long userId, CancellationToken ct) =>
        await state.GetAsync(false, userId, "postcards", ct) is { } row ? PostcardRules.Parse(row.Json) : [];

    /// <summary>When the guest asked to be reminded (ms), from their own <c>reminder</c> document; null when there is none or it is not a number.</summary>
    private async Task<long?> ReminderAtAsync(long userId, CancellationToken ct)
    {
        if (await state.GetAsync(false, userId, "reminder", ct) is not { } row) return null;
        try { return JsonNode.Parse(row.Json)?["at"] is JsonValue v && v.TryGetValue<long>(out var at) && at > 0 ? at : null; }
        catch (System.Text.Json.JsonException) { return null; }
    }

    private static int? PlanBuffer(string? json)
    {
        try { return JsonNode.Parse(json ?? "null")?["buffer"] is JsonValue v && v.TryGetValue<int>(out var b) ? b : null; } catch (Exception e) when (e is System.Text.Json.JsonException or InvalidOperationException or FormatException) { return null; }
    }

    private static string? Status(string? json)
    {
        try { return JsonNode.Parse(json ?? "null")?["status"]?.GetValue<string>(); } catch (Exception e) when (e is System.Text.Json.JsonException or InvalidOperationException) { return null; }
    }
}
