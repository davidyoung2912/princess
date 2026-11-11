using System.Text;

namespace Princess.Api.Domain;

/// <summary>What the person who must act on a request is asked, and what happens next (docs/chat-plan.md, 4.3).</summary>
public sealed record ChatRoute(string Status, string? GuardianFor);

/// <summary>
/// The rules for asking another guest to chat (docs/chat-plan.md, 4.2 and 4.3), kept apart from the store and the endpoints so they can be tested alone.
/// A request is between two people. A supervised child's request first needs their guardian, and a request to a child is answered by the child's guardian.
/// </summary>
public static class ChatConnectionRules
{
    public const string AwaitingGuardian = "awaitingGuardian", Pending = "pending", Accepted = "accepted", Declined = "declined", Cancelled = "cancelled", Expired = "expired", Ended = "ended";

    public const int MinQuery = 3, MaxQuery = 40, MaxResults = 10;
    /// <summary>Requests a person may have waiting at once, and may send in a day.</summary>
    public const int MaxOpenOutgoing = 10, MaxPerDay = 20;
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);
    /// <summary>After a decline the same person cannot ask the same person again for this long.</summary>
    public static readonly TimeSpan DeclineCooldown = TimeSpan.FromDays(7);

    /// <summary>A live connection: waiting for someone to answer, or agreed.</summary>
    public static bool IsOpen(string? status) => status is AwaitingGuardian or Pending or Accepted;

    /// <summary>Waiting for someone to answer.</summary>
    public static bool IsWaiting(string? status) => status is AwaitingGuardian or Pending;

    /// <summary>
    /// The text to search for, or null when it is too short, too long or has anything but letters, spaces, hyphens, apostrophes and full stops.
    /// Those characters cannot be wildcards, so the value is safe in a LIKE pattern.
    /// </summary>
    public static string? CleanQuery(string? text)
    {
        if (text is null) return null;
        var sb = new StringBuilder();
        foreach (var part in text.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (sb.Length > 0) sb.Append(' ');
            sb.Append(part);
        }
        var clean = sb.ToString();
        if (clean.Length < MinQuery || clean.Length > MaxQuery) return null;
        return clean.All(c => char.IsLetter(c) || c is ' ' or '-' or '\'' or '.') ? clean : null;
    }

    /// <summary>The first name and the first letter of the last name ("Sam R."): all another guest sees of a person.</summary>
    public static string ShortName(string? first, string? last)
    {
        var f = (first ?? "").Trim();
        var l = (last ?? "").Trim();
        if (f.Length == 0) return l.Length == 0 ? "Guest" : l;
        return l.Length == 0 ? f : $"{f} {char.ToUpperInvariant(l[0])}.";
    }

    /// <summary>Who answers first: the sender's guardian when the sender is a child, otherwise the other person (or their guardian when they are a child).</summary>
    public static ChatRoute Route(bool requesterSupervised, bool targetSupervised) =>
        requesterSupervised ? new(AwaitingGuardian, "requester") : targetSupervised ? new(AwaitingGuardian, "target") : new(Pending, null);

    /// <summary>Where a request goes once the sender's guardian approves it.</summary>
    public static ChatRoute AfterRequesterGuardian(bool targetSupervised) =>
        targetSupervised ? new(AwaitingGuardian, "target") : new(Pending, null);

    public static bool IsExpired(DateTime expiresAt, DateTime now) => now >= expiresAt;

    /// <summary>Whether the last decline is recent enough that the same request cannot be made again yet.</summary>
    public static bool InCooldown(DateTime? lastDeclinedAt, DateTime now) => lastDeclinedAt is { } at && now - at < DeclineCooldown;

    /// <summary>The key a notice is logged and de-duplicated under: one per event on one connection.</summary>
    public static string NoticeKey(string kind, Guid connectionId) => $"chat:{kind}:{connectionId:N}";

    // The words a phone shows on a locked screen. They name a person only by first name and last initial and say nothing about why an answer is no.
    public static (string Title, string Body) RequestNotice(string requester) => ($"{requester} wants to chat", "Open Princess to say yes, or not now.");
    public static (string Title, string Body) AcceptedNotice(string target) => ($"{target} accepted your chat request", "You can message each other now.");
    public static (string Title, string Body) DeclinedNotice() => ("Your chat request has an answer", "Open Princess to see it.");
    public static (string Title, string Body) ApprovalNotice(string child) => ("A chat request needs your approval", $"Open Princess to review it for {child}.");
}
