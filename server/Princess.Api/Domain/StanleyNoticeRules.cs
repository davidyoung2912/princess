namespace Princess.Api.Domain;

/// <summary>A notice as it is written into the guest's Stanley thread (docs/chat-features-research.md, section 15.4). One per <see cref="Key"/>; a newer one with the same <see cref="SupersedeKey"/> replaces the older.</summary>
public sealed record StanleyNotice(string Key, string Lane, string Kind, string Path, string Text, string? SupersedeKey, DateTime? ExpiresAt, string Urgency);

/// <summary>
/// The notice relay's pure rules (phase 0b): which lane a push notice belongs to, how long it stays useful, what it supersedes and the words of the thread message. The delivery path
/// (the thread first, the phone push always, and the push alone when writing to the thread fails) is in <see cref="Services.StanleyNoticeRelay"/> and <see cref="Services.PushService"/>.
/// </summary>
public static class StanleyNoticeRules
{
    public const string Critical = "critical", Important = "important", Reminder = "reminder", Info = "info";
    public static readonly string[] Lanes = [Critical, Important, Reminder, Info];

    /// <summary>
    /// The notice kinds allowed to bypass quiet hours, calm mode and the budget: safety, and deadlines that decide whether the guest makes the trip. This list is under change control:
    /// a test fails when a built notice bypasses with a kind that is not here.
    /// </summary>
    public static readonly string[] BypassKinds = ["allAboard", "backAboard", "disruption", "payment", "travel", "scheduleChange"];

    /// <summary>Kinds that need action soon without being safety: they are Important when they do not bypass.</summary>
    private static readonly string[] ImportantKinds = ["allAboard", "backAboard", "disruption", "payment", "travel", "reservation", "case", "helper"];

    public static string LaneOf(PushNotice n) =>
        n.Bypass ? Critical
        : ImportantKinds.Contains(n.Kind) ? Important
        : n.Kind == "reminder" ? Reminder
        : Info;

    /// <summary>How long a message stays actionable. A muster or all-aboard prompt is stale within hours; a payment reminder lasts days; information does not expire.</summary>
    public static DateTime? ExpiryOf(string lane, DateTime now) => lane switch
    {
        Critical => now.AddHours(6),
        Important => now.AddHours(48),
        Reminder => now.AddHours(24),
        _ => null,
    };

    /// <summary>The same occasion with new facts (the all-aboard time moved) shares a tag; a notice with no tag supersedes nothing.</summary>
    public static string? SupersedeKeyOf(PushNotice n) => string.IsNullOrWhiteSpace(n.Tag) ? null : $"{n.Kind}:{n.Tag}";

    /// <summary>Critical and important messages ask for Got it, through the existing urgency flag, so the acknowledgement store and the urgent style are the ones chat already has.</summary>
    public static string UrgencyOf(string lane) => lane switch { Critical => ChatUrgencyRules.Urgent, Important => ChatUrgencyRules.Important, _ => ChatUrgencyRules.Normal };

    /// <summary>The thread message for a notice: title, then body. The notice passed in has already been through <see cref="PushRules.Redact"/> only for the lock screen; the thread shows the full text.</summary>
    public static StanleyNotice Build(PushNotice n, DateTime now)
    {
        var lane = LaneOf(n);
        var text = string.IsNullOrWhiteSpace(n.Body) ? n.Title : $"{n.Title}\n{n.Body}";
        return new(n.Key, lane, n.Kind, n.Path, text.Length > 1000 ? text[..1000] : text, SupersedeKeyOf(n), ExpiryOf(lane, now), UrgencyOf(lane));
    }

    /// <summary>Whether a message can still be acted on: not replaced, not past its expiry.</summary>
    public static bool Active(DateTime? expiresAt, bool superseded, DateTime now) => !superseded && (expiresAt is null || expiresAt > now);
}
