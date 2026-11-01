using System.Text.Json;

namespace Princess.Api.Domain;

public sealed record KidClub(string Id, string Name, string PlaceId, int MinAge, int MaxAge, string Opens, string Closes, int? AloneFrom);

public sealed record Seen(string PlaceId, long At, string Source);

public sealed record Authorisation(List<Guid> Pickup, bool SignOutAlone, bool Photos);

public sealed record ReunionPlan(string PlaceId, string BackupId, string Note);

/// <summary>
/// Finding the family and the children's clubs (SAF-05, ENT-04), ported from <c>src/domain/family.ts</c>. A web page cannot tell where anyone is on the ship, so a child's place comes from the
/// club's check-in or from the children's band (simulated). Ages, hours and places are authored concept values.
/// </summary>
public static class FamilyRules
{
    public static readonly IReadOnlyList<KidClub> Clubs =
    [
        new("firefly", "Firefly Park", "firefly", 3, 7, "09:00", "21:00", null),
        new("neon-grove", "Neon Grove", "neon-grove", 8, 12, "09:00", "22:00", 10),
        new("underground", "The Underground", "underground", 13, 17, "11:00", "23:59", 13),
    ];

    public static KidClub? ClubById(string? id) => Clubs.FirstOrDefault(c => c.Id == id);

    /// <summary>The club for a child's age, or null (under 3, or an adult).</summary>
    public static KidClub? ClubFor(int age) => Clubs.FirstOrDefault(c => age >= c.MinAge && age <= c.MaxAge);

    private static int Mins(string t) => int.Parse(t[..2]) * 60 + int.Parse(t[3..]);

    public static bool ClubOpen(KidClub c, string time) => Mins(time) >= Mins(c.Opens) && Mins(time) < Mins(c.Closes);

    /// <summary>Why a child cannot be checked in to a club now, or null.</summary>
    public static string? CheckInProblem(KidClub club, int age, string time, bool alreadyIn)
    {
        if (age < club.MinAge) return "tooYoung";
        if (age > club.MaxAge) return "tooOld";
        if (alreadyIn) return "alreadyIn";
        if (!ClubOpen(club, time)) return "closed";
        return null;
    }

    /// <summary>Places a parent can allow a child to be.</summary>
    public static readonly string[] KidZones = ["firefly", "neon-grove", "underground", "lido-pool", "piazza", "arena", "dome", "promenade", "eatery", "americana", "lido", "shops", "intl-cafe"];

    /// <summary>Where a child may go before a parent changes it.</summary>
    public static List<string> DefaultZones(int age) =>
        age < 8 ? ["firefly", "lido-pool", "americana", "eatery"]
        : age < 13 ? ["neon-grove", "lido-pool", "piazza", "promenade", "dome", "lido", "americana", "eatery"]
        : [.. KidZones];

    private static readonly Dictionary<string, string[]> Rotation = new()
    {
        ["small"] = ["lido-pool", "americana", "lido-pool", "eatery", "lido-pool", "shops"],
        ["middle"] = ["lido-pool", "piazza", "promenade", "arena", "dome", "lido", "casino"],
        ["teen"] = ["lido-pool", "piazza", "promenade", "shops", "sea-view", "underground", "arena"],
    };

    public static string BandOf(int age) => age < 8 ? "small" : age < 13 ? "middle" : "teen";

    /// <summary>Not heard from for this long, a parent is told to act.</summary>
    public const int OverdueMinutes = 30;

    /// <summary>Where a child was last seen. In the missing-child scenario the youngest child's band last reported a while ago.</summary>
    public static Seen LastSeen(string child, int age, long now, (string ClubId, long At)? club, bool missing)
    {
        if (club is { } c) return new Seen(ClubById(c.ClubId)!.PlaceId, c.At, "club");
        if (missing) return new Seen("lido-pool", now - OverdueMinutes * 60_000L - 15 * 60_000L, "band");
        var rotation = Rotation[BandOf(age)];
        var b = now / (15 * 60_000L);
        var place = rotation[(int)((ExcursionRules.Hash(child) + (ulong)b) % (ulong)rotation.Length)];
        return new Seen(place, Math.Max(b * 15 * 60_000L, now - ExcursionRules.Hash($"{child}{b}") % 10 * 60_000L), "band");
    }

    public static string KidStatus(Seen seen, IReadOnlyCollection<string> zones, long now)
    {
        if (now - seen.At >= OverdueMinutes * 60_000L) return "overdue";
        if (seen.Source == "club") return "inClub";
        return zones.Contains(seen.PlaceId) ? "inZone" : "outOfZone";
    }

    // ---- Stored forms ----

    /// <summary>Authorisation read back from its stored JSON, or the default: every adult on the booking may collect.</summary>
    public static Authorisation NormalizeAuth(string? json, IReadOnlyCollection<Guid> adults)
    {
        var pickup = adults.ToList();
        var alone = false;
        var photos = false;
        if (!string.IsNullOrWhiteSpace(json))
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var o = doc.RootElement;
                if (o.ValueKind == JsonValueKind.Object)
                {
                    if (o.TryGetProperty("pickup", out var p) && p.ValueKind == JsonValueKind.Array)
                        pickup = [.. p.EnumerateArray().Select(x => x.ValueKind == JsonValueKind.String && Guid.TryParse(x.GetString(), out var g) ? g : Guid.Empty).Where(adults.Contains)];
                    alone = o.TryGetProperty("signOutAlone", out var a) && a.ValueKind == JsonValueKind.True;
                    photos = o.TryGetProperty("photos", out var ph) && ph.ValueKind == JsonValueKind.True;
                }
            }
            catch (JsonException) { }
        }
        return new Authorisation(pickup, alone, photos);
    }

    public static string AuthJson(Authorisation a) => JsonSerializer.Serialize(new { pickup = a.Pickup, signOutAlone = a.SignOutAlone, photos = a.Photos });

    public static List<string>? ZonesOf(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<List<string>>(json); }
        catch (JsonException) { return null; }
    }

    public static readonly ReunionPlan DefaultReunion = new("guest-services", "piazza", "");

    /// <summary>Places a family can pick to meet: easy to find and always staffed or central.</summary>
    public static readonly string[] MeetingPlaces = ["guest-services", "piazza", "lido-pool", "eatery", "promenade", "excursions-desk"];

    public static ReunionPlan NormalizeReunion(string? place, string? backup, string? note) =>
        new(place is not null && MeetingPlaces.Contains(place) ? place : DefaultReunion.PlaceId,
            backup is not null && MeetingPlaces.Contains(backup) ? backup : DefaultReunion.BackupId,
            note is null ? "" : note.Length > 200 ? note[..200] : note);

    public static string? ZonesProblem(IReadOnlyCollection<string>? zones) =>
        zones is null || zones.Count == 0 || !zones.All(KidZones.Contains) ? "badZones" : null;

    public static string? MeetingProblem(string? place, string? backup) =>
        place is null || backup is null || !MeetingPlaces.Contains(place) || !MeetingPlaces.Contains(backup) || place == backup ? "badMeeting" : null;
}
