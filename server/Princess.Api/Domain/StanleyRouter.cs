using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>
/// What the device tells the gateway about where the guest is (the context packet): the journey stage, the screen id, the sailing the guest is looking at and the
/// proactivity level. All of it is a hint for routing and the log, never a fact the answer is built from, and every field is checked by <see cref="StanleyRouter.Clean"/>.
/// </summary>
public sealed record StanleyContextDto(string? Stage = null, string? Screen = null, string? SailingId = null, string? Level = null);

/// <summary>The checked context packet. Unknown values become empty or "unknown", so nothing a client invents reaches a prompt or the log.</summary>
public sealed record StanleyContext(string Stage, string Screen, string? SailingId, string Level)
{
    public static readonly StanleyContext None = new("unknown", "", null, "");
}

/// <summary>Where a question goes: <c>Trip</c> (the guest's own booking, with the tools), <c>Before</c> (someone still choosing, with the tools) or <c>Open</c> (the open Stanley model).</summary>
public enum StanleyRoute { Open, Trip, Before }

/// <summary><c>Planning</c> flags a request to build a day, week or itinerary, the only kind that may use the large model and the larger call budget.</summary>
public sealed record StanleyRouting(StanleyRoute Route, bool Planning)
{
    /// <summary>A short, closed vocabulary for the tier log: never words from the guest.</summary>
    public string Topic => Planning ? "planning" : Route switch { StanleyRoute.Trip => "trip", StanleyRoute.Before => "before", _ => "open" };
}

/// <summary>
/// The routing that used to live in the browser (<c>stanleyRoute.ts</c>), now in one place with the policy: which source answers a question the device's own library
/// did not. Pure, so it is unit tested. The safety screen and word filter run before this, in <c>StanleyService</c>.
/// </summary>
public static partial class StanleyRouter
{
    /// <summary>The eleven journey stages (customer-journey-priorities.md), as the device names them.</summary>
    public static readonly IReadOnlyList<string> Stages = ["dream", "discover", "book", "manage", "prebook", "getToShip", "embark", "sea", "port", "disembark", "remember"];

    private static readonly string[] BeforeStages = ["dream", "discover", "book"];

    [GeneratedRegex(@"\b(my|our|mine|i owe|owe|bill|balance|checklist|still need|what is next|what's next|plan|booking|booked|reservation|tonight|today|tomorrow|back on (the )?ship|all aboard|dinner time)\b", RegexOptions.IgnoreCase)]
    private static partial Regex TripWords();

    [GeneratedRegex(@"\b(plan|build|organi[sz]e|schedule|put together)\b.*\b(day|days|week|itinerary|trip)\b|\bday plan\b|\bitinerary for\b", RegexOptions.IgnoreCase)]
    private static partial Regex PlanningWords();

    [GeneratedRegex(@"^[A-Za-z0-9_/-]{1,40}$")]
    private static partial Regex Token();

    /// <summary>Checks the packet from the device: a known stage, and short plain tokens for the screen, sailing and level.</summary>
    public static StanleyContext Clean(StanleyContextDto? dto)
    {
        if (dto is null) return StanleyContext.None;
        static string? Plain(string? v) => v is not null && Token().IsMatch(v) ? v : null;
        return new StanleyContext(dto.Stage is { } s && Stages.Contains(s) ? s : "unknown", Plain(dto.Screen) ?? "", Plain(dto.SailingId), Plain(dto.Level) ?? "");
    }

    /// <summary>Picks the source for a message the safety screen has passed. Someone still choosing (before booking) gets the pre-booking facts, a guest with a booking asking about their own plans gets the trip, the rest is open chat.</summary>
    public static StanleyRouting Route(string message, string stage, bool hasBooking)
    {
        var planning = PlanningWords().IsMatch(message);
        if (BeforeStages.Contains(stage) && !hasBooking) return new StanleyRouting(StanleyRoute.Before, planning);
        if (hasBooking && TripWords().IsMatch(message)) return new StanleyRouting(StanleyRoute.Trip, planning);
        return new StanleyRouting(StanleyRoute.Open, planning && hasBooking);
    }
}
