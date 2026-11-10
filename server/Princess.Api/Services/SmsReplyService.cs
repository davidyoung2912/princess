using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Handles a text sent back to the notice number. A guest's chat replies go to <see cref="ChatSmsInboundService"/> first. A stop word from a guest's confirmed phone number switches text notices off for them (the same switch as in
/// notification settings) and sends one line to say so. Anything else is ignored. The text provider's adapter delivers these through the inbound endpoint.
/// </summary>
public sealed class SmsReplyService(IPhoneLookupStore phones, PhoneCheckService phoneCheck, IInboxStore inbox, ISmsSender sms, ChatSmsInboundService chatBridge)
{
    public const string Confirmation = "You will not get text notices from Princess. You can turn them back on in the app under notification settings.";

    /// <summary>How many guests were switched off (0 for a reply that is not a stop word or a number nobody has confirmed).</summary>
    public async Task<int> HandleAsync(string? from, string? body, string? carrierId, CancellationToken ct)
    {
        // A guest who turned on chat by text has their replies taken by the bridge first (its STOP turns the bridge off; a second STOP then reaches the notices below).
        if (await chatBridge.HandleAsync(from, body, carrierId, ct)) return 0;
        if (!SmsReplyRules.IsStop(body) || SmsReplyRules.Tail(from) is not { } tail) return 0;
        var stopped = 0;
        foreach (var (userId, phone) in await phones.FindByTailAsync(tail, ct))
        {
            if (!SmsReplyRules.SameNumber(from, phone) || !await phoneCheck.IsVerifiedAsync(userId, phone, ct)) continue;
            System.Text.Json.Nodes.JsonNode? stored = null;
            if (await inbox.GetPrefsJsonAsync(userId, ct) is { } json)
            {
                try { stored = System.Text.Json.Nodes.JsonNode.Parse(json); } catch (System.Text.Json.JsonException) { }
            }
            var next = SmsReplyRules.WithSmsOff(NotificationRules.NormalizePrefs(stored));
            await inbox.SavePrefsJsonAsync(userId, next.ToJsonString(), DateTime.UtcNow, ct);
            stopped++;
        }
        if (stopped > 0) await sms.SendAsync(new SmsMessage(from!.Trim(), Confirmation), ct);
        return stopped;
    }
}
