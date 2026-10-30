namespace Princess.Api.Domain;

public sealed record ServiceChannel(string Id, int Minutes, string Crew, bool UrgentNote);

public sealed record ChatState(string Status, int WaitedMinutes, int? Queue, int ExpectedMinutes, bool CanEscalate);

/// <summary>Guest Services chat (MSG-02, SUP-08), ported from <c>src/domain/chat.ts</c>: channels, visible response times, queue position and escalation to a phone call. Crew replies are simulated (data model section 8) and appear on read once their time has come.</summary>
public static class ServiceChatRules
{
    public static readonly IReadOnlyList<ServiceChannel> Channels =
    [
        new("guestServices", 5, "Ines, Guest Services", false),
        new("housekeeping", 10, "Marlon, Housekeeping", false),
        new("dining", 8, "Paolo, Dining", false),
        new("medical", 5, "Nurse Aiko, Medical Center", true),
        new("excursions", 12, "Dev, Shore Excursions", false),
    ];

    public static ServiceChannel? ById(string? id) => Channels.FirstOrDefault(c => c.Id == id);

    /// <summary>When chat runs slowly (the scenario) replies take this many times as long.</summary>
    public const int SlowFactor = 5;

    /// <summary>After this many minutes without a reply, the screen offers a phone call instead.</summary>
    public const int EscalateAfterMinutes = 15;

    public const int MaxMessage = 1000;

    public static int Expected(ServiceChannel c, bool slow) => c.Minutes * (slow ? SlowFactor : 1);

    /// <summary>Where a conversation stands: waiting for a first reply, answered, resolved after three times the first-reply time, or handed to a phone call.</summary>
    public static ChatState StateOf(ServiceChannel channel, DateTime sentAt, DateTime now, bool slow, DateTime? escalatedAt)
    {
        var expected = Expected(channel, slow);
        var waited = (int)Math.Max(0, Math.Floor((now - sentAt).TotalMinutes));
        if (escalatedAt is not null) return new ChatState("escalated", waited, null, expected, false);
        if (waited >= expected * 3) return new ChatState("resolved", waited, null, expected, false);
        if (waited >= expected) return new ChatState("answered", waited, null, expected, false);
        var remaining = expected - waited;
        return new ChatState("waiting", waited, Math.Max(1, (int)Math.Ceiling((double)remaining / expected * 4)), expected, waited >= EscalateAfterMinutes || slow);
    }

    /// <summary>When the first reply arrives.</summary>
    public static DateTime ReplyAt(ServiceChannel channel, DateTime sentAt, bool slow) => sentAt.AddMinutes(Expected(channel, slow));

    private static readonly Dictionary<string, string> Replies = new()
    {
        ["guestServices"] = "Thank you for getting in touch. I have your note and am looking into it now. I will update you here.",
        ["housekeeping"] = "Thank you. Your steward has been told and will visit your stateroom soon. You can use Do Not Disturb to say when not to.",
        ["dining"] = "Thank you. I have passed that to the maître d’ and noted any allergies on your reservation. Your table is held.",
        ["medical"] = "Thank you. A nurse will phone your stateroom shortly. If this is an emergency, dial 911 now instead of waiting.",
        ["excursions"] = "Thank you. The Shore Excursions desk on Deck 9 has your question and will reply here, or visit us any time.",
    };

    public static string CrewReply(string channel) => Replies[channel];

    /// <summary>The message trimmed and cut to the limit, or empty when there is nothing to send.</summary>
    public static string Clean(string? text)
    {
        var t = text?.Trim() ?? "";
        return t.Length > MaxMessage ? t[..MaxMessage] : t;
    }
}
