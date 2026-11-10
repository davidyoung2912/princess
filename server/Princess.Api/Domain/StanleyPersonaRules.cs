namespace Princess.Api.Domain;

/// <summary>Who Stanley speaks for right now: <see cref="StanleyPersonaRules.Company"/> or <see cref="StanleyPersonaRules.Ship"/>, and the subtitle shown under his name.</summary>
public sealed record StanleyPersona(string Voice, string Subtitle);

/// <summary>
/// The permanent Stanley chat (docs/chat-features-research.md, section 15, phase 0a), as pure rules. Stanley is one character; what changes through the journey is who he speaks for:
/// the company before and after the trip (stages 1 to 6 and 11) and the ship while the guest is on board (stages 7 to 10). The server decides it; the screen only shows the subtitle it is given.
/// No guest-facing string here says "AI" (owner decision, 2026-11-10); a test holds that line.
/// </summary>
public static class StanleyPersonaRules
{
    public const string Company = "company", Ship = "ship";

    /// <summary>The company's name, the subtitle for every stage before and after the ship.</summary>
    public const string CompanyName = "Princess Cruises";

    /// <summary>What the conversation is called in the list.</summary>
    public const string Name = "Stanley";

    /// <summary>The stages in which the ship speaks.</summary>
    public static readonly string[] OnBoard = [StageRules.Embark, StageRules.Sea, StageRules.Port, StageRules.Disembark];

    public static bool IsOnBoard(string stage) => OnBoard.Contains(stage);

    /// <summary>
    /// The persona for the guest's stage. A ship stage with no ship name known falls back to the company rather than showing an empty subtitle.
    /// </summary>
    public static StanleyPersona For(string stage, string? shipName) =>
        IsOnBoard(stage) && !string.IsNullOrWhiteSpace(shipName) ? new(Ship, shipName.Trim()) : new(Company, CompanyName);

    /// <summary>A ship's display name from its id when no booking row carries one ("sun-princess" is "Sun Princess"); null for an empty id.</summary>
    public static string? ShipNameFromId(string? id) =>
        string.IsNullOrWhiteSpace(id) ? null : string.Join(' ', id.Split('-', StringSplitOptions.RemoveEmptyEntries).Select(w => char.ToUpperInvariant(w[0]) + w[1..]));

    /// <summary>Whether the thread needs a line marking a change: nothing before the first persona, nothing when it is unchanged.</summary>
    public static bool Changed(StanleyPersona? previous, StanleyPersona next) =>
        previous is not null && (previous.Voice != next.Voice || previous.Subtitle != next.Subtitle);

    /// <summary>
    /// The system line that marks a change of voice, in Stanley's own words, or null when nothing changed. Earlier messages keep the subtitle they were sent under, so the thread reads truthfully.
    /// </summary>
    public static string? ChangeLine(StanleyPersona? previous, StanleyPersona next)
    {
        if (!Changed(previous, next)) return null;
        if (next.Voice == Ship) return previous!.Voice == Company ? $"You're aboard. I'm now speaking for {next.Subtitle}." : $"I'm now speaking for {next.Subtitle}.";
        return "Welcome home. I'm speaking for Princess Cruises again.";
    }

    /// <summary>The first message in the thread, posted once at registration (or by the backfill): who Stanley is, that this is where Princess will reach the guest, and that it cannot be removed.</summary>
    public static string Welcome(string? firstName)
    {
        var who = string.IsNullOrWhiteSpace(firstName) ? "Hello" : $"Hello, {firstName.Trim()}";
        return $"{who}. I'm Stanley. This is where Princess Cruises will reach you with your reminders and notices, and where you can ask me about your trip. "
             + "The conversation stays with your account and cannot be removed, and you can choose which notices you get in Chat settings.";
    }

    /// <summary>The line pinned in the thread: the company never asks for these in chat.</summary>
    public const string NeverAsk = "Princess Cruises will never ask for your card number, passport number or password in chat.";
}
