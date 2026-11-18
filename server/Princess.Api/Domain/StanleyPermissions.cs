using System.Text.Json;
using System.Text.Json.Serialization;

namespace Princess.Api.Domain;

/// <summary>One of the four support levels (docs/stanley-actions-and-proactive-plan.md, 11.2). <c>Available</c> is false for a level whose abilities are not switched on yet.</summary>
public sealed record StanleyLevelDto(int Id, string Name, string Line, bool Available);

/// <summary>One row of the checklist (11.3): what it does in the guest's words, an example, what it never does, and its state for this guest.
/// <c>State</c> is on, off, needsLevel (switched off by a lower level) or soon (the ability is not built yet).</summary>
public sealed record StanleyPermissionRowDto(string Id, string Group, string Wording, string Example, string Never, int NeedsLevel, string State);

/// <summary>Everything the welcome page and Settings show: the chosen level, the level in force and why it differs, the pause, the four levels and the rows.</summary>
public sealed record StanleyPermissionsDto(int Level, int EffectiveLevel, bool VoiceLimited, bool ChildLimited, bool Paused, long? PausedUntil, int WordingVersion, List<StanleyLevelDto> Levels, List<StanleyPermissionRowDto> Rows);

/// <summary>One line of the consent history: what the guest agreed to, which wording, where and when.</summary>
public sealed record StanleyConsentDto(string Ability, string State, int WordingVersion, string Source, long At);

/// <summary>The guest's choices, kept as one document per account. <c>Rows</c> holds only the rows the guest changed by hand; the rest follow the level. <c>PausedUntil</c> is epoch ms in the guest's own clock (0 none, <see cref="long.MaxValue"/> until resumed).</summary>
public sealed record StanleyPermissionDoc(int Level = 4, Dictionary<string, bool>? Rows = null, long PausedUntil = 0)
{
    [JsonIgnore]
    public Dictionary<string, bool> RowMap => Rows ?? [];
}

/// <summary>A row of the checklist as authored. <c>Built</c> is false until the ability behind it exists; an unbuilt row is shown as coming and nothing is claimed for it.</summary>
public sealed record StanleyPermissionRow(string Id, string Group, string Wording, string Example, string Never, int NeedsLevel, bool Built, bool NeverPreTicked = false);

public sealed record StanleyLevelRequest(int? Level, string? Source, string? StepUp);
public sealed record StanleyRowRequest(bool? On, string? Source, string? StepUp);
public sealed record StanleyPauseRequest(string? Until);
public sealed record StanleyStepUpVerifyRequest(string? Code);
public sealed record StanleyStepUpDto(bool Sent, string? Token = null);

/// <summary>
/// What the guest lets Stanley do on his own, and the check every unprompted act goes through. Pure, so it is unit tested. Authority (what he may do) is a separate dial from voice (how much he says);
/// voice off caps authority at level 1. A supervised account is at level 1 only. Nothing here can raise the ceiling in section 3 of the plan: it is only a list of what is switched on.
/// </summary>
public static class StanleyPermissionRules
{
    /// <summary>The version of the consent wording below. Change it whenever a row's wording or the level lines change, so the history shows what the guest agreed to.</summary>
    public const int WordingVersion = 3;
    public const int DefaultLevel = 4;
    public const string StateKey = "stanleyPermissions", ConsentKey = "stanleyConsent", StepUpKey = "stanleyStepUp";
    public static readonly string[] Sources = ["welcome", "settings", "stage"];
    public const int MaxConsent = 200, StepUpTokenMinutes = 10;

    public static StanleyLevelDto[] Levels(bool authority) =>
    [
        new(1, "Just answer", "I answer when you ask, and nothing else.", true),
        new(2, "Give you heads-ups", "I check your trip, tell you about problems and let you know what changed. You decide everything.", true),
        new(3, "Do the legwork", "When something happens, I line up the fix and ask for your yes.", authority),
        new(4, "Handle the small stuff", "For small free things you can undo, I just do them and tell you. I never pay or cancel.", authority),
    ];

    public static readonly IReadOnlyList<StanleyPermissionRow> Rows =
    [
        new("CL-01", "watching", "Check my trip for problems", "Your passport expires within 6 months of the return date.", "Never blocks anything or says a document is official.", 2, true),
        new("CL-02", "watching", "Tell me when something changes and what it means", "Your tour moved to 9:30. You now have 20 minutes less in port.", "Never changes your plans by itself. Safety alerts always reach you.", 2, true),
        new("CL-03", "watching", "Tell me how my spending is going", "Your spending is running ahead of the budget you set.", "Never blocks a purchase and never pays for anything.", 2, true),
        new("CL-04", "watching", "Morning brief and evening look-ahead (you choose the times)", "Today at a glance, and tomorrow's early start.", "Only at the times you choose.", 2, true),
        new("CL-05", "preparing", "Line up a fix when a plan breaks, for my yes", "Your tour is cancelled. Here is the best replacement today.", "Never books it until you say yes.", 3, true),
        new("CL-06", "preparing", "Fill in forms and drafts for me to check", "Check-in is open. I filled it in; please check and send.", "Never sends or signs anything for you.", 3, true),
        new("CL-07", "preparing", "Tell me when a table or space opens, with a ready booking", "A table for four opened on Thursday at 7:30.", "Never holds a table or books it without your yes.", 3, true),
        new("CL-08", "handling", "Set my reminders for me (deadlines, check-in, bag night, all aboard)", "I added 6 reminders for your trip. Change any of them.", "Only reminders tied to a date on your trip.", 4, true),
        new("CL-09", "handling", "Plan my days and keep the plan up to date with free things", "I added a free show at 8:30 as Stanley's pick. Remove it if you like.", "Never removes what you added and never adds anything that costs money.", 4, true),
        new("CL-10", "handling", "Book the free things I always want (main dining, free shows)", "I booked your usual table for four at 6:00. Undo for 2 hours.", "Never books anything with a charge.", 4, true),
        new("CL-11", "handling", "Keep my dinner time when a show moves", "The show moved, so I moved your dinner back to 8:00. Undo for 2 hours.", "Never moves a paid booking or one for another person.", 4, true),
        new("CL-12", "handling", "Repeat a free stateroom request I always make", "I sent the ice you ask for every evening. Cancel it if you like.", "Never orders anything with a charge.", 4, true),
    ];

    public static StanleyPermissionRow? Row(string? id) => Rows.FirstOrDefault(r => r.Id == id);

    public static StanleyPermissionDoc Parse(string? json)
    {
        try
        {
            var d = JsonSerializer.Deserialize<StanleyPermissionDoc>(json ?? "null", Json);
            if (d is not null) return d with { Level = d.Level is >= 1 and <= 4 ? d.Level : DefaultLevel, Rows = d.RowMap.Where(kv => Row(kv.Key) is not null).ToDictionary(kv => kv.Key, kv => kv.Value) };
        }
        catch (JsonException) { }
        return new();
    }

    public static string ToJson(StanleyPermissionDoc d) => JsonSerializer.Serialize(d, Json);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>The level in force: a supervised account is at 1, voice off caps it at 1, otherwise the chosen level.</summary>
    public static int EffectiveLevel(StanleyPermissionDoc doc, bool supervised, bool voiceOff) => supervised || voiceOff ? 1 : doc.Level;

    public static bool IsPaused(StanleyPermissionDoc doc, long nowMs) => nowMs < doc.PausedUntil;

    /// <summary>
    /// Whether a row is on for this guest: its ability exists, no pause is in force, the level in force reaches it, and the guest has not switched it off. A row follows the level unless the guest changed it by hand;
    /// CL-04 (briefs) follows the level like the rest; a brief is still only sent once the guest has chosen its times. This is the one check every unprompted act uses.
    /// </summary>
    public static bool IsOn(StanleyPermissionDoc doc, StanleyPermissionRow row, int effectiveLevel, bool paused)
    {
        if (!row.Built || paused || effectiveLevel < row.NeedsLevel) return false;
        return doc.RowMap.TryGetValue(row.Id, out var chosen) ? chosen : !row.NeverPreTicked;
    }

    public static string State(StanleyPermissionDoc doc, StanleyPermissionRow row, int effectiveLevel, bool paused) =>
        !row.Built ? "soon" : effectiveLevel < row.NeedsLevel ? "needsLevel" : IsOn(doc, row, effectiveLevel, paused) ? "on" : "off";

    /// <summary>What the screens show. Rows are the same list for everyone; their state is the guest's.</summary>
    public static StanleyPermissionsDto View(StanleyPermissionDoc doc, bool supervised, bool voiceOff, bool authority, long nowMs)
    {
        var eff = EffectiveLevel(doc, supervised, voiceOff);
        var paused = IsPaused(doc, nowMs);
        return new(doc.Level, eff, voiceOff && !supervised && doc.Level > 1, supervised, paused, paused ? doc.PausedUntil : null, WordingVersion, [.. Levels(authority)],
            [.. Rows.Select(r => new StanleyPermissionRowDto(r.Id, r.Group, r.Wording, r.Example, r.Never, r.NeedsLevel, State(doc, r, eff, paused)))]);
    }

    /// <summary>Raising to level 3 or 4, or switching on a row of the handling group, needs the emailed code; lowering or switching off never does.</summary>
    public static bool NeedsStepUp(int fromLevel, int toLevel) => toLevel >= 3 && toLevel > fromLevel;
    public static bool RowNeedsStepUp(StanleyPermissionRow row, bool on) => on && row.NeedsLevel >= 4;

    /// <summary>The document after a level change: rows the guest set by hand above the new level are dropped, so a lower level switches them off at once.</summary>
    public static StanleyPermissionDoc WithLevel(StanleyPermissionDoc doc, int level) =>
        doc with { Level = level, Rows = doc.RowMap.Where(kv => Row(kv.Key) is { } r && r.NeedsLevel <= level).ToDictionary(kv => kv.Key, kv => kv.Value) };

    public static StanleyPermissionDoc WithRow(StanleyPermissionDoc doc, string id, bool on) => doc with { Rows = new Dictionary<string, bool>(doc.RowMap) { [id] = on } };

    /// <summary>Pause until the end of the guest's day (<c>today</c>) or until resumed (<c>forever</c>), as epoch ms in the guest's own clock. Null for anything else.</summary>
    public static long? PauseUntil(string? until, DateTime guestNow) => until switch
    {
        "today" => new DateTimeOffset(DateTime.SpecifyKind(guestNow.Date.AddDays(1), DateTimeKind.Utc)).ToUnixTimeMilliseconds(),
        "forever" => long.MaxValue,
        _ => null,
    };

    public static List<StanleyConsentDto> AppendConsent(List<StanleyConsentDto> log, StanleyConsentDto entry) => [.. log.Append(entry).TakeLast(MaxConsent)];

    public static List<StanleyConsentDto> ParseConsent(string? json)
    {
        try { return JsonSerializer.Deserialize<List<StanleyConsentDto>>(json ?? "[]", Json) ?? []; }
        catch (JsonException) { return []; }
    }

    public static string ConsentJson(List<StanleyConsentDto> log) => JsonSerializer.Serialize(log, Json);

    public static string ComposeStepUp(string code) =>
        $"Your Princess code to change what Stanley may do is {code}. It works for {PhoneRules.CodeMinutes} minutes. If you did not ask for it, ignore this email and nothing will change.";
}
