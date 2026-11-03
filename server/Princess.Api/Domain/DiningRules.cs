namespace Princess.Api.Domain;

public sealed record Venue(string Id, string Name, string Kind, long Cover, bool WalkIn, string Deck, string Cuisine, string Dress, string Menu);

public sealed record Slot(string Time, int Tables);

public sealed record DiningWindowResult(
    bool Open,
    [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)] string? Reason,
    [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)] string? OpensOn);

public sealed record MealCharge(int Covered, int Pays, long Charge);

/// <summary>A reservation as far as clash checking cares.</summary>
public sealed record ReservedTable(string VenueId, int Day, string Time, IReadOnlyCollection<Guid> Guests);

/// <summary>Dining reservations before sailing, ported from <c>src/domain/dining.ts</c>.</summary>
public static class DiningRules
{
    public static readonly IReadOnlyList<Venue> Venues =
    [
        new("eclipse", "Eclipse Dining Room", "main", 0, false, "Deck 7 aft", "Traditional three-course dinner", "smart", "Seared sea bass, braised short rib, a vegetarian tasting plate, and a different dessert every night."),
        new("crown", "Crown Grill", "specialty", 4_500, false, "Deck 7 aft", "Steakhouse", "smart", "Aged filet, a shared seafood tower, creamed spinach and a warm chocolate soufflé."),
        new("sabatini", "Sabatini’s", "specialty", 4_200, false, "Deck 8 aft", "Italian trattoria", "smart", "Hand-rolled pasta, veal Milanese, a tiramisu made at the table."),
        new("catch", "The Catch by Rudi", "specialty", 4_800, false, "Deck 7 midship", "Seafood", "smart", "Lobster bisque, grilled catch of the day, and a key lime tart."),
        new("love", "Love by Britto", "specialty", 6_500, false, "Deck 17 aft", "Prix fixe with a wake view", "elegant", "Five small courses, with wine pairings available, served as the sun sets behind the ship."),
        new("alfredo", "Alfredo’s Pizzeria", "casual", 1_499, true, "Deck 9 Piazza", "Neapolitan pizza", "casual", "Margherita, diavola and a pizza of the day, with a dessert to share."),
    ];

    public static Venue? VenueById(string? id) => Venues.FirstOrDefault(v => v.Id == id);

    /// <summary>Dinner nights a reservation can be made for (embarkation evening to the second-last night).</summary>
    public static readonly int[] DinnerDays = [1, 2, 3, 4, 5, 6, 7];
    public static readonly string[] DinnerTimes = ["17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30"];
    public const int MaxParty = 8;
    public const int SittingMinutes = 120;
    public const int MinLateMinutes = 5;
    public const int MaxLateMinutes = 30;

    /// <summary>Fixed seatings in the main dining room, which assigns a table for the whole cruise.</summary>
    public static string? Seating(string plan) => plan switch { "early" => "17:00", "late" => "19:30", _ => null };

    /// <summary>The grid for one venue on one night: the same every time for the same sailing. Peak times fill first.</summary>
    public static List<Slot> SlotsFor(string venueId, string sailingId, int day) =>
        DinnerTimes.Select(time =>
        {
            var h = ExcursionRules.Hash($"{venueId}|{sailingId}|{day}|{time}");
            var peak = time is "19:00" or "19:30";
            var full = peak ? h % 3 == 0 : h % 6 == 0;
            return new Slot(time, full ? 0 : 1 + (int)(h % 4));
        }).ToList();

    /// <summary>Who may reserve now: Platinum and Elite guests from booking; everyone else once the cruise is paid in full.</summary>
    public static DiningWindowResult Window(string entitlementWindow, string payment, string finalDue) =>
        entitlementWindow == "atBooking" || payment == "paid" ? new(true, null, null) : new(false, "awaitingPayment", finalDue);

    /// <summary>How many of a party are covered by specialty dinners the package includes, and what the rest pay.</summary>
    public static MealCharge ChargeFor(Venue v, int partySize, int mealsLeft)
    {
        if (v.Kind != "specialty") return new(0, partySize, v.Kind == "main" ? 0 : v.Cover * partySize);
        var covered = Math.Min(partySize, Math.Max(0, mealsLeft));
        var pays = partySize - covered;
        return new(covered, pays, pays * v.Cover);
    }

    private static int Mins(string t) => int.Parse(t[..2]) * 60 + int.Parse(t[3..]);

    /// <summary>Guests who would be at two tables at once on the same night.</summary>
    public static List<Guid> TableClash(IEnumerable<ReservedTable> existing, int day, string time, IReadOnlyCollection<Guid> guests, string? ignoreVenue = null)
    {
        var clash = new HashSet<Guid>();
        foreach (var r in existing)
        {
            if (r.Day != day || r.VenueId == ignoreVenue) continue;
            if (Math.Abs(Mins(r.Time) - Mins(time)) >= SittingMinutes) continue;
            foreach (var g in r.Guests) if (guests.Contains(g)) clash.Add(g);
        }
        return [.. clash];
    }

    /// <summary>Whether a dinner's start has already gone by. The time is on the ship's clock for that night.</summary>
    public static bool DinnerPast(Timeline timeline, int day, string time, DateTime nowUtc)
    {
        var date = timeline.Departure.AddDays(day - 1);
        return Itinerary.LocalToUtc(date, TimeOnly.ParseExact(time, "HH:mm"), timeline.ShipZoneOnDate(date)) <= nowUtc;
    }
}
