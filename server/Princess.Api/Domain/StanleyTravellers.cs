using System.Globalization;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>What the guest saves about a traveller they plan for. <see cref="CheckedOn"/> is the date they last confirmed the access details (needed when the source is verified); <see cref="AsOf"/> is set by the server when it was saved.</summary>
public sealed record TravellerRecord(string Id, string Name, string Mobility, string Pace, string Source, string? CheckedOn, string? Note, string? AsOf);

/// <summary>A record as the guest sees it, with how far to trust it and whether a verification has gone stale.</summary>
public sealed record TravellerRecordDto(string Id, string Name, string Mobility, string Pace, string Source, string? CheckedOn, string? Note, string? AsOf, string Confidence, bool Stale);

public sealed record TravellerListDto(IReadOnlyList<TravellerRecordDto> Travellers, int StaleAfterDays, int Max);

/// <summary>
/// Access and pace details for named travellers, kept as sourced, dated data (docs/stanley-gap-analysis-and-plan.md, phase 9). The source is verified, reported (what the guest was told) or unknown. Confidence is high only
/// for a verification no older than <see cref="StaleDays"/>; a verification older than that counts as reported, so a person is asked to check again. Pure.
/// </summary>
public static partial class StanleyTravellerRules
{
    public const int Max = 8, StaleDays = 180, NoteMax = 100, IdMax = 40;

    [GeneratedRegex(@"^[A-Za-z0-9_-]{1,40}$")]
    private static partial Regex IdShape();

    public static bool ValidId(string? id) => id is not null && IdShape().IsMatch(id);

    private static bool TryDate(string? s, out DateOnly d) => DateOnly.TryParseExact(s, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out d);

    /// <summary>The first thing wrong with a record, as a short code, or null. A verified record needs a date that is not in the future; other sources keep no date.</summary>
    public static string? Problem(TravellerRecord? r, DateOnly today)
    {
        if (r is null || !ValidId(r.Id)) return "id";
        if (string.IsNullOrWhiteSpace(r.Name) || r.Name.Trim().Length > StanleyPlannerRules.NameMax) return "name";
        if (!DayPlanRules.Mobilities.Contains(r.Mobility)) return "mobility";
        if (!StanleyPlannerRules.Paces.Contains(r.Pace)) return "pace";
        if (!StanleyPlannerRules.Sources.Contains(r.Source)) return "source";
        if ((r.Note ?? "").Length > NoteMax) return "note";
        if (r.Source == "verified" && (!TryDate(r.CheckedOn, out var d) || d > today)) return "checkedOn";
        return null;
    }

    /// <summary>The record as it is kept: trimmed, the date only for a verified source, and stamped with today's date when it is new or changed.</summary>
    public static TravellerRecord Clean(TravellerRecord r, TravellerRecord? before, DateOnly today)
    {
        var clean = r with { Name = r.Name.Trim(), Note = string.IsNullOrWhiteSpace(r.Note) ? null : r.Note.Trim(), CheckedOn = r.Source == "verified" ? r.CheckedOn : null, AsOf = null };
        return clean with { AsOf = before is not null && before with { AsOf = null } == clean ? before.AsOf : today.ToString("yyyy-MM-dd") };
    }

    public static bool Stale(TravellerRecord r, DateOnly today) => r.Source == "verified" && (!TryDate(r.CheckedOn, out var d) || today.DayNumber - d.DayNumber > StaleDays);

    /// <summary>high: verified within the window. medium: reported, or a verification that has gone stale. low: unknown.</summary>
    public static string Confidence(TravellerRecord r, DateOnly today) => r.Source switch
    {
        "verified" => Stale(r, today) ? "medium" : "high",
        "reported" => "medium",
        _ => "low",
    };

    public static TravellerRecordDto View(TravellerRecord r, DateOnly today) => new(r.Id, r.Name, r.Mobility, r.Pace, r.Source, r.CheckedOn, r.Note, r.AsOf, Confidence(r, today), Stale(r, today));

    public static TravellerProfile Profile(TravellerRecord r) => new(r.Name, r.Mobility, r.Pace, r.Source, r.CheckedOn);
}
