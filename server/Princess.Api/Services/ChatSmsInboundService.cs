using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The text bridge, inbound half (docs/chat-plan.md, 4.9): a text from a guest's verified number goes to the conversation they name (or were last texted from), through the same checks as a message
/// from the app. LIST, HELP, BACK and STOP are answered by text. The sender is matched only by the verified number on the server; a number that two guests share switches the bridge off for both
/// until each verifies again. Message text is never logged; the log keeps the conversation, the person and the outcome.
/// </summary>
public sealed class ChatSmsInboundService(
    IPhoneLookupStore phones, PhoneCheckService phoneCheck, IUserStore users, IChatSmsStore store, ChatSmsService sms, ChatService chat, IChatStore chats, IUserClock clock, ISmsSender sender)
{
    public const string SharedNumber = "This number is used by more than one guest, so chat by text is off. Verify the number again in the app to use it.";

    /// <summary>
    /// True when the text was for the bridge (so nothing else should act on it). False when the bridge is off for everyone, or the number is not one of a guest who has it on:
    /// the caller then treats it as a reply to a notice (a STOP there switches notices off).
    /// </summary>
    public async Task<bool> HandleAsync(string? from, string? body, string? carrierId, CancellationToken ct)
    {
        if (!sms.Enabled || SmsReplyRules.Tail(from) is not { } tail) return false;
        var matches = new List<long>();
        foreach (var (userId, phone) in await phones.FindByTailAsync(tail, ct))
            if (SmsReplyRules.SameNumber(from, phone) && await phoneCheck.IsVerifiedAsync(userId, phone, ct)) matches.Add(userId);
        var on = await store.ListOnAsync(matches, ct);
        if (on.Count == 0) return false;
        if (on.Count > 1)
        {
            foreach (var id in on) await store.SetSettingsAsync(id, false, (await store.GetSettingsAsync(id, ct)).Idle, ct);
            await sender.SendAsync(new SmsMessage(from!.Trim(), SharedNumber), ct);
            return true;
        }
        if (await users.FindByIdAsync(on[0], ct) is not { IsSupervised: false } user) return false;
        var now = await clock.NowAsync(user, ct);
        if (!ChatSmsRules.InboundAllowed(await store.CountAsync(user.Id, "in", null, now.AddHours(-1), ct)))
        {
            await store.LogAsync(user.Id, null, "in", "refused", now, ct);
            return true;
        }
        var parsed = ChatSmsRules.Parse(body);
        async Task Say(string text) => await sender.SendAsync(new SmsMessage(from!.Trim(), text), ct);

        switch (parsed.Command)
        {
            case SmsCommand.Stop:
                await store.SetSettingsAsync(user.Id, false, (await store.GetSettingsAsync(user.Id, ct)).Idle, ct);
                await store.LogAsync(user.Id, null, "in", "command", now, ct);
                await Say(ChatSmsRules.StopDone);
                return true;
            case SmsCommand.Help:
                await store.LogAsync(user.Id, null, "in", "command", now, ct);
                await Say(ChatSmsRules.Help);
                return true;
            case SmsCommand.Back:
                await store.SetBackAsync(user.Id, now, ct);
                await store.LogAsync(user.Id, null, "in", "command", now, ct);
                await Say(ChatSmsRules.BackDone);
                return true;
            case SmsCommand.List:
                await store.LogAsync(user.Id, null, "in", "command", now, ct);
                await Say(await ListAsync(user.Id, ct));
                return true;
        }

        var open = await sms.OpenAsync(user.Id, ct);
        var state = await store.GetStateAsync(user.Id, ct);
        // A number picks a conversation; with none, the one the guest was last texted from, or the only one they have.
        ChatConversationRow? target = parsed.Code is { } code
            ? (code >= 1 && code <= open.Count ? open[code - 1] : null)
            : open.FirstOrDefault(o => o.GroupId == state.LastGroupId) ?? (open.Count == 1 ? open[0] : null);
        if (target is null)
        {
            await store.LogAsync(user.Id, null, "in", "refused", now, ct);
            await Say(parsed.Code is not null ? ChatSmsRules.NotThere : open.Count == 0 ? ChatSmsRules.NoChats : ChatSmsRules.NoTarget);
            return true;
        }
        try
        {
            await chat.SendFromTextAsync(user, target.GroupPublicId, parsed.Text, ChatSmsRules.KeyFor(carrierId, user.Id, parsed.Text), ct);
        }
        catch (ApiException e)
        {
            var outcome = e.Title == "blocked" ? "blocked" : "refused";
            await store.LogAsync(user.Id, target.GroupId, "in", outcome, now, ct);
            await Say(e.Title switch { "blocked" => ChatSmsRules.Blocked, "closed" => ChatSmsRules.Closed, "notFound" => ChatSmsRules.NotThere, _ => ChatSmsRules.NoTarget });
            return true;
        }
        await store.LogAsync(user.Id, target.GroupId, "in", "delivered", now, ct);
        await store.SetLastGroupAsync(user.Id, target.GroupId, now, ct);
        return true;
    }

    private async Task<string> ListAsync(long userId, CancellationToken ct)
    {
        var open = await sms.OpenAsync(userId, ct);
        var rows = new List<(int, string)>();
        for (var i = 0; i < open.Count; i++)
        {
            var members = await chats.ListMembersAsync(open[i].GroupId, ct);
            var others = members.Where(p => p.UserId != userId && p.Status == ChatConversationRules.Active).Select(p => ChatConnectionRules.ShortName(p.FirstName, p.LastName)).ToList();
            rows.Add((i + 1, ChatConversationRules.DisplayName(open[i].Kind, open[i].Name, others)));
        }
        return ChatSmsRules.ListText(rows);
    }
}
