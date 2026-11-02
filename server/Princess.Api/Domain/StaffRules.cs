namespace Princess.Api.Domain;

/// <summary>A ticket as the guest sees it now: <c>Position</c> counts down as the expected time nears and <c>Status</c> is waiting, due or lapsed.</summary>
public sealed record StaffTicketStatusDto(Guid Id, string Kind, string Reason, long At, int Position, long ReadyAt, string Status, string Source);

public sealed record StaffRequestDto(string? Kind, string? Reason);

/// <summary><c>Position</c> and <c>ReadyAt</c> (milliseconds since 1970) say where the guest is in the staff queue and when the call is expected.</summary>
public sealed record StaffTicketDto(Guid Id, string Kind, string Reason, long At, int Position, long ReadyAt, string Source);

/// <summary>What the guest may ask staff for (multi-device plan 2, Phase 6): a call back, a caregiver visit or a sensory kit.</summary>
public static class StaffRules
{
    public static readonly string[] Kinds = ["callback", "caregiver", "kit"];
    public static readonly string[] CallbackReasons = ["urgent", "changes", "health", "other"];
    public const int MinutesPerPlace = 4;
    /// <summary>A request is kept this long, then lapses (milliseconds).</summary>
    public const long LifetimeMs = 2 * 3_600_000L;

    /// <summary>Where the ticket stands at <paramref name="nowMs"/>: the places still ahead of the guest, and waiting, due or lapsed.</summary>
    public static StaffTicketStatusDto Status(StaffTicketDto t, long nowMs)
    {
        var status = nowMs >= t.At + LifetimeMs ? "lapsed" : nowMs >= t.ReadyAt ? "due" : "waiting";
        var perPlace = MinutesPerPlace * 60_000L;
        var position = status == "waiting" ? (int)Math.Clamp((t.ReadyAt - nowMs + perPlace - 1) / perPlace, 1, t.Position) : 0;
        return new(t.Id, t.Kind, t.Reason, t.At, position, t.ReadyAt, status, t.Source);
    }

    /// <summary>The reason to keep: callbacks carry one of the known reasons (default other); the other kinds carry none.</summary>
    public static bool Valid(StaffRequestDto? r, out string kind, out string reason)
    {
        kind = r?.Kind ?? "";
        reason = "";
        if (Array.IndexOf(Kinds, kind) < 0) return false;
        if (kind != "callback") return r!.Reason is null;
        reason = r!.Reason ?? "other";
        return Array.IndexOf(CallbackReasons, reason) >= 0;
    }
}
