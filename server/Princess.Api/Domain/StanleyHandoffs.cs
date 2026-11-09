namespace Princess.Api.Domain;

/// <summary>What the guest sends to a person (<c>POST /me/stanley/handoffs</c>). Every field is text the guest has seen in the preview and agreed to send.</summary>
public sealed record StanleyHandoffRequest(string? Topic, string? Issue, string? Outcome, string? Reference, string? Tried, string? Attachment, string? Role, bool Consent);

/// <summary>A handoff as the guest sees it: the case reference, who has it, where it stands, when the next update is due and whether that time has passed.</summary>
public sealed record StanleyHandoffDto(Guid Id, string Topic, string Reference, string Owner, string Status, long OpenedAt, long NextUpdateAt, bool Overdue, bool Escalated, string Issue, string Outcome, string Source);

/// <summary>The stored form of one handoff. The guest's issue text is kept only so the guest and the desk see the same case; it is deleted with the retention job.</summary>
public sealed class StanleyHandoffRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long UserId { get; set; }
    public string Topic { get; set; } = "";
    public string Reference { get; set; } = "";
    public string Issue { get; set; } = "";
    public string Outcome { get; set; } = "";
    public string BookingRef { get; set; } = "";
    public string Tried { get; set; } = "";
    public string Attachment { get; set; } = "";
    public string Role { get; set; } = "";
    public DateTime OpenedAt { get; set; }
    public string Source { get; set; } = "";
}

/// <summary>
/// Handing a guest to a person (docs/stanley-gap-analysis-and-plan.md, phase 6). What can be handed over, what a valid handoff holds, and where a case stands at a given time. Pure.
/// There is no staff side in this repo, so the desk's work is simulated from the clock behind <see cref="StanleyHandoffRules.StatusOf"/>; a real desk would replace the answer, not the shape.
/// An emergency is never a handoff: it has no topic here and only ever shows the numbers.
/// </summary>
public static class StanleyHandoffRules
{
    /// <summary>The topics that make a case: a person, a cabin issue, lost property, a billing dispute, an allergy request, a special request, a disruption summary for the port team, and a missed ship.</summary>
    public static readonly string[] Topics = ["person", "cabin", "lostProperty", "billing", "allergy", "special", "disruption", "missedShip"];
    public static readonly string[] Roles = ["", "guest", "organiser", "caregiver"];
    public const int IssueMax = 1000, OutcomeMax = 200, ReferenceMax = 40, TriedMax = 300, AttachmentMax = 120, MaxOpen = 10;

    /// <summary>Hours from opening to the first acknowledgement, to the next update and to escalation, by topic.</summary>
    public static (int AckMinutes, int UpdateHours, int EscalateHours) Times(string topic) => topic switch
    {
        "missedShip" => (5, 1, 2),
        "allergy" => (20, 6, 12),
        "disruption" => (30, 4, 8),
        "cabin" => (30, 4, 8),
        "billing" => (60, 24, 48),
        "lostProperty" => (60, 24, 72),
        "special" => (60, 12, 24),
        _ => (15, 4, 8),
    };

    /// <summary>The desk that holds a topic. A real roster would name a person; the simulation names the desk, never invents a staff member.</summary>
    public static string Owner(string topic) => topic switch
    {
        "billing" => "Guest Services (Purser's desk)",
        "cabin" => "Housekeeping and Guest Services",
        "allergy" => "Dining and Guest Services",
        "disruption" or "missedShip" => "Guest Services and the port team",
        "lostProperty" => "Lost and Found",
        _ => "Guest Services",
    };

    /// <summary>The first problem with a request, or null: <c>consent</c> (the guest did not agree to send it), <c>topic</c>, <c>issue</c> (empty or too long) or <c>tooLong</c>.</summary>
    public static string? Problem(StanleyHandoffRequest? r)
    {
        if (r is null) return "issue";
        if (!r.Consent) return "consent";
        if (Array.IndexOf(Topics, r.Topic ?? "") < 0) return "topic";
        if (string.IsNullOrWhiteSpace(r.Issue)) return "issue";
        if (r.Issue.Length > IssueMax || (r.Outcome?.Length ?? 0) > OutcomeMax || (r.Reference?.Length ?? 0) > ReferenceMax || (r.Tried?.Length ?? 0) > TriedMax || (r.Attachment?.Length ?? 0) > AttachmentMax) return "tooLong";
        if (Array.IndexOf(Roles, r.Role ?? "") < 0) return "role";
        return null;
    }

    /// <summary>A short reference the guest can read out: <c>GS-</c> and six letters or digits, made from the booking or user and the count so far, never from the text.</summary>
    public static string Reference(string seed, int sequence)
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var h = (uint)Hash($"{seed}|{sequence}");
        var chars = new char[6];
        for (var i = 0; i < 6; i++) { chars[i] = alphabet[(int)(h % (uint)alphabet.Length)]; h = h / (uint)alphabet.Length + (uint)(i + 1) * 2654435761u; }
        return "GS-" + new string(chars);
    }

    private static int Hash(string s) { unchecked { var h = 17; foreach (var ch in s) h = h * 31 + ch; return h & 0x7fffffff; } }

    /// <summary>
    /// Where the case stands at <paramref name="now"/>: <c>submitted</c> (with the desk, not yet read), <c>acknowledged</c> (a person has it and the next update is due),
    /// or, for a special request, <c>fulfilled</c> once the update time has passed twice over. <c>Overdue</c> is true when the next update time has passed with no update, and
    /// <c>Escalated</c> when the escalation time has passed: the case then shows the escalation to the supervisor, never a claim that it is solved.
    /// </summary>
    public static (string Status, DateTime NextUpdateAt, bool Overdue, bool Escalated) StatusOf(string topic, DateTime openedAt, DateTime now)
    {
        var (ack, update, escalate) = Times(topic);
        var ackAt = openedAt.AddMinutes(ack);
        var next = openedAt.AddHours(update);
        if (now < ackAt) return ("submitted", ackAt, false, false);
        if (topic == "special" && now >= openedAt.AddHours(update * 2)) return ("fulfilled", openedAt.AddHours(update * 2), false, false);
        var overdue = now >= next;
        return ("acknowledged", next, overdue, now >= openedAt.AddHours(escalate));
    }

    public static StanleyHandoffDto View(StanleyHandoffRow r, DateTime now)
    {
        var (status, next, overdue, escalated) = StatusOf(r.Topic, r.OpenedAt, now);
        return new(r.PublicId, r.Topic, r.Reference, Owner(r.Topic), status, TripRules.ToMs(r.OpenedAt), TripRules.ToMs(next), overdue, escalated, r.Issue, r.Outcome, r.Source);
    }
}
