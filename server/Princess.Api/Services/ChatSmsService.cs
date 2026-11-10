using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Realtime;

namespace Princess.Api.Services;

/// <summary>
/// The text bridge for guests ashore, outbound half (docs/chat-plan.md, 4.9): the guest's choices, who counts as ashore, and the texts a conversation message turns into.
/// A text goes out only when the member turned the bridge on, is an adult with a verified number, is not in a muted conversation, is ashore, and is inside the daily and hourly caps.
/// A failure to text never fails the message. Message text is never logged: the log keeps the conversation, the person and the outcome.
/// </summary>
public sealed class ChatSmsService(
    IChatSmsStore store, IChatStore chat, IUserStore users, IAccountStore accounts, PhoneCheckService phoneCheck, IRealtimeHub realtime,
    IPortRowStore portRows, TripService trips, IUserClock clock, ISmsSender sender, IConfiguration config, ILogger<ChatSmsService> log)
{
    /// <summary>The global switch (<c>Sms:ChatBridge</c>, on unless set to false).</summary>
    public bool Enabled => config.GetValue("Sms:ChatBridge", true);

    private async Task<string?> PhoneAsync(UserRecord user, CancellationToken ct) => (await accounts.GetProfileAsync(user.Id, ct))?.Phone;

    /// <summary>Why the bridge cannot be turned on for this person, or null when it can.</summary>
    private async Task<(string? Reason, string? Phone)> BlockerAsync(UserRecord user, CancellationToken ct)
    {
        if (!Enabled) return ("off", null);
        if (user.IsSupervised) return ("supervised", null);
        var phone = await PhoneAsync(user, ct);
        if (PhoneRules.Normalise(phone).Length == 0) return ("noPhone", null);
        return await phoneCheck.IsVerifiedAsync(user.Id, phone, ct) ? (null, phone) : ("unverified", phone);
    }

    public async Task<ChatSmsDto> SettingsAsync(UserRecord actor, CancellationToken ct)
    {
        var s = await store.GetSettingsAsync(actor.Id, ct);
        var (reason, _) = await BlockerAsync(actor, ct);
        // A number that is no longer verified stops the bridge until it is verified again (the choice is kept).
        return new(s.On && reason is null, s.Idle, reason is null, reason);
    }

    /// <summary>Turns the bridge on or off. Turning it on needs a verified number and sends one text that says what it does and that texts pass through the phone company.</summary>
    public async Task<ChatSmsDto> SetSettingsAsync(UserRecord actor, ChatSmsSettingsBody? body, CancellationToken ct)
    {
        if (body is null) throw ApiException.Invalid("settings");
        var before = await store.GetSettingsAsync(actor.Id, ct);
        if (body.On)
        {
            var (reason, phone) = await BlockerAsync(actor, ct);
            if (reason == "supervised") throw ApiException.Forbidden("supervised");
            if (reason is not null) throw ApiException.Invalid(reason);
            await store.SetSettingsAsync(actor.Id, true, body.Idle, ct);
            if (!before.On) await sender.SendAsync(new SmsMessage(phone!.Trim(), ChatSmsRules.Welcome), ct);
        }
        else await store.SetSettingsAsync(actor.Id, false, body.Idle, ct);
        return await SettingsAsync(actor, ct);
    }

    /// <summary>Whether the person counts as ashore now: the Away From Ship flow (with the app closed), or, when they chose it, 30 minutes with no live connection. See <see cref="ChatSmsRules.IsAshore"/>.</summary>
    public async Task<bool> IsAshoreAsync(UserRecord user, ChatSmsSettingsRow settings, ChatSmsStateRow state, CancellationToken ct)
    {
        var now = await clock.NowAsync(user, ct);
        var connected = realtime.IsConnected(user.PublicId);
        var (away, awayAt) = connected ? (false, (long?)null) : await AwayAsync(user, now, ct);
        // The time spent quiet is measured on the real clock and laid on the guest's own, so a shifted testing date cannot make anyone look ashore.
        DateTime? quiet = realtime.QuietSince(user.PublicId) is { } closed ? now - (DateTime.UtcNow - closed) : null;
        return ChatSmsRules.IsAshore(away, awayAt, connected, settings.Idle, quiet, now, state.BackAt);
    }

    private async Task<(bool Away, long? At)> AwayAsync(UserRecord user, DateTime now, CancellationToken ct)
    {
        var booking = await trips.CurrentAsync(user, now, ct);
        if (booking is null) return (false, null);
        var day = AboardRules.PortDayAt(TimelineBook.For(booking.SailingId, DateOnly.FromDateTime(booking.Departure)), now);
        if (day is null) return (false, null);
        var key = AwayRules.PresenceKey(day.Date, user.PublicId);
        var row = (await portRows.ListAsync(booking.BookingId, ct)).FirstOrDefault(r => !r.Deleted && r.Kind == "presence" && r.Key == key);
        return (AwayRules.IsAway(AwayRules.StatusOf(row?.Json)), row?.At);
    }

    /// <summary>The guest's open conversations, numbered from 1 by when they were made (so a number does not change mid-chat).</summary>
    public async Task<List<ChatConversationRow>> OpenAsync(long userId, CancellationToken ct) =>
        [.. (await chat.ListConversationsAsync(userId, ct)).Where(r => !ChatConversationRules.IsClosed(r.Kind, r.Status, r.DirectEnded)).OrderBy(r => r.GroupId)];

    /// <summary>Texts the people ashore who should hear about a new message. Never throws for one person's failure.</summary>
    public async Task MessageAsync(long groupId, string from, ChatMessageRow message, IReadOnlyList<ChatRecipientRow> recipients, CancellationToken ct)
    {
        if (!Enabled || message.IsSystem) return;
        // Urgent breaks through a muted conversation, as it does for the phone notice; the guest's own bridge choice and the other checks still apply.
        var urgent = message.Urgency == ChatUrgencyRules.Urgent;
        var settings = await store.ListSettingsAsync([.. recipients.Where(r => urgent || !r.Muted).Select(r => r.UserId)], ct);
        foreach (var r in recipients)
        {
            if ((r.Muted && !urgent) || !settings.TryGetValue(r.UserId, out var s) || !s.On) continue;
            try { await TextOneAsync(r.UserId, s, groupId, from, message, ct); }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogWarning(e, "A chat text could not be sent"); }
        }
    }

    private async Task TextOneAsync(long userId, ChatSmsSettingsRow settings, long groupId, string from, ChatMessageRow message, CancellationToken ct)
    {
        if (await users.FindByIdAsync(userId, ct) is not { IsSupervised: false } user) return;
        var (reason, phone) = await BlockerAsync(user, ct);
        if (reason is not null) return;
        var state = await store.GetStateAsync(userId, ct);
        if (!await IsAshoreAsync(user, settings, state, ct)) return;
        var now = await clock.NowAsync(user, ct);
        var verdict = ChatSmsRules.Verdict(await store.CountAsync(userId, "out", null, now.AddHours(-24), ct), await store.CountAsync(userId, "out", groupId, now.AddHours(-1), ct), message.Urgency);
        if (verdict == SmsSendVerdict.Skip) return;
        if (verdict == SmsSendVerdict.Capped) { await store.LogAsync(userId, groupId, "out", "capped", now, ct); return; }
        var open = await OpenAsync(userId, ct);
        int? code = open.Count > 1 ? ChatSmsRules.CodeOf([.. open.Select(o => o.GroupId)], groupId) : null;
        var digest = verdict == SmsSendVerdict.Digest;
        var text = digest ? ChatSmsRules.Digest(code) : ChatSmsRules.Outbound(code, from, message.Text, message.Photo is not null, message.Urgency);
        var ok = await sender.SendAsync(new SmsMessage(phone!.Trim(), text), ct);
        await store.LogAsync(userId, groupId, "out", !ok ? "failed" : digest ? "digest" : "sent", now, ct, message.Id);
        if (ok) await store.SetLastGroupAsync(userId, groupId, now, ct);
    }

    /// <summary>
    /// The one reminder for an urgent message that went out by text and has not been confirmed with Got it after <see cref="ChatSmsRules.RetryAfter"/>. Run by <see cref="ChatUrgentRetryService"/>.
    /// It carries no message text, is sent only to someone still ashore with the bridge on, and is logged as "retry" so it is never sent twice. Returns how many were sent.
    /// </summary>
    public async Task<int> RetryUnconfirmedAsync(CancellationToken ct)
    {
        if (!Enabled) return 0;
        var sent = 0;
        // The log's times are on each guest's own clock, so the window here is wide and each row is judged on its owner's clock below.
        foreach (var row in await store.ListUrgentTextsAsync(DateTime.UtcNow.AddHours(-12), ct))
        {
            try
            {
                if (await users.FindByIdAsync(row.UserId, ct) is not { IsSupervised: false } user) continue;
                var now = await clock.NowAsync(user, ct);
                if (!ChatSmsRules.RetryDue(row.At, now)) continue;
                var settings = await store.GetSettingsAsync(row.UserId, ct);
                if (!settings.On) continue;
                var (reason, phone) = await BlockerAsync(user, ct);
                if (reason is not null || !await IsAshoreAsync(user, settings, await store.GetStateAsync(row.UserId, ct), ct)) continue;
                var open = await OpenAsync(row.UserId, ct);
                int? code = open.Count > 1 ? ChatSmsRules.CodeOf([.. open.Select(o => o.GroupId)], row.GroupId) : null;
                var ok = await sender.SendAsync(new SmsMessage(phone!.Trim(), ChatSmsRules.UrgentReminder(code)), ct);
                await store.LogAsync(row.UserId, row.GroupId, "out", ok ? "retry" : "failed", now, ct, row.MessageId);
                if (ok) sent++;
            }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogWarning(e, "An urgent chat reminder could not be sent"); }
        }
        return sent;
    }

    /// <summary>The people among <paramref name="userIds"/> who are ashore and reachable by text, for the "Ashore, replies by text" label. Only people with the bridge on are looked at.</summary>
    public async Task<HashSet<long>> AshoreAsync(IReadOnlyCollection<long> userIds, CancellationToken ct)
    {
        var found = new HashSet<long>();
        if (!Enabled) return found;
        var settings = await store.ListSettingsAsync(userIds, ct);
        foreach (var (id, s) in settings)
        {
            if (!s.On || await users.FindByIdAsync(id, ct) is not { IsSupervised: false } user) continue;
            if ((await BlockerAsync(user, ct)).Reason is null && await IsAshoreAsync(user, s, await store.GetStateAsync(id, ct), ct)) found.Add(id);
        }
        return found;
    }
}
