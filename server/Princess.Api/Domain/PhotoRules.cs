namespace Princess.Api.Domain;

public sealed record PhotoSpot(string Id, int Day, string Venue, string Title, string Time);

public sealed record Photo(string Id, int Day, string Venue, string Title, string Time, List<Guid> People);

public sealed record PhotoOption(string Id, long Total, int Covers);

public sealed record PhotoOptions(int Included, int Paid, List<PhotoOption> Options);

public sealed record PhotographerSlot(int Day, string Time, string PlaceId, string What);

/// <summary>
/// Ship photos (SHP-02, SHP-07), ported from <c>src/domain/photos.ts</c>: browse by day and place, choose photos first, see package options priced against the choice, buy, and download in resumable batches.
/// A photo is one catalogue spot with everyone on the booking in it (<c>PhotoPurchaseItems</c> and <c>PhotoSelections</c> key the spot); the mock's separate portrait for each person is not kept.
/// Prices and places are authored concept values.
/// </summary>
public static class PhotoRules
{
    /// <summary>Elegant evenings for a sailing of this many nights: none under 5, one for 5 to 6, then about one every three and a half nights.</summary>
    public static int FormalCount(int nights) => nights < 5 ? 0 : nights < 7 ? 1 : (int)Math.Floor(nights / 3.5);

    /// <summary>The days of the elegant evenings: the first on day 2, the last on the final night, the rest spread evenly between.</summary>
    public static List<int> FormalDays(int nights)
    {
        var k = FormalCount(nights);
        if (k == 0) return [];
        if (k == 1) return [2];
        return [.. Enumerable.Range(0, k).Select(i => 2 + (int)Math.Round(i * (nights - 2) / (double)(k - 1), MidpointRounding.AwayFromZero))];
    }

    private static string Short(string name) => name.Split(',')[0].Split('(')[0].Trim();

    private static TimeOnly Before(TimeOnly t, int minutes) => t.AddMinutes(-minutes);

    private static string Hm(TimeOnly t) => t.ToString("HH:mm");

    /// <summary>
    /// The photo spots of a sailing, worked out from its days: the gangway on day 1, portraits on each elegant evening, one spot back at the dock on every port call,
    /// and the pool and the dining room on every sea day. Ids carry the day (and the port) so they stay the same for the life of the sailing.
    /// </summary>
    public static List<PhotoSpot> SpotsFor(Timeline timeline)
    {
        var spots = new List<PhotoSpot> { new("gangway", 1, "gangway", "Welcome aboard, the gangway", "12:30") };
        var formal = FormalDays(timeline.Nights);
        foreach (var d in timeline.Days)
        {
            if (formal.Contains(d.Day))
                spots.Add(new($"formal-{d.Day}", d.Day, "portrait", formal[0] == d.Day ? "Formal night portraits, the Piazza" : "Formal night portraits", "18:00"));
            if (d.Port == "sea")
            {
                spots.Add(new($"pool-{d.Day}", d.Day, "pool", "Lido pool, sea day", "11:30"));
                spots.Add(new($"dining-{d.Day}", d.Day, "dining", "Your table, Eclipse Dining Room", "19:15"));
            }
            else if (timeline.IsCall(d))
            {
                var port = Itinerary.PortOf(d.Port);
                var name = Short(port?.Name ?? d.Port);
                var at = d.AllAboard is { } a ? Before(a, port?.Tender == true ? 150 : 60) : new TimeOnly(14, 0);
                spots.Add(new($"port-{d.Day}-{d.Port}", d.Day, "port", port?.Tender == true ? $"{name}, the tender pier" : $"{name}, back at the dock", Hm(at)));
            }
        }
        return [.. spots.OrderBy(s => s.Day)];
    }

    /// <summary>Photos taken so far of the people on the booking.</summary>
    public static List<Photo> PhotosFor(Timeline timeline, IReadOnlyList<Guid> party, int throughDay) =>
        [.. SpotsFor(timeline).Where(s => s.Day <= throughDay).Select(s => new Photo(s.Id, s.Day, s.Venue, s.Title, s.Time, [.. party]))];

    public const long PriceEach = 1995, PriceFive = 7995, PriceAll = 14995;

    public static readonly string[] OptionIds = ["each", "five", "all"];

    /// <summary>Digital photos the Premier package includes.</summary>
    public const int IncludedWithPremier = 12;

    /// <summary>What each way of buying costs for a choice of photos, after any included photos.</summary>
    public static PhotoOptions Options(int selected, int includedLeft)
    {
        var included = Math.Min(selected, Math.Max(0, includedLeft));
        var paid = selected - included;
        return new PhotoOptions(included, paid,
        [
            new("each", paid * PriceEach, paid),
            new("five", (long)Math.Ceiling(paid / 5.0) * PriceFive, paid),
            new("all", paid > 0 ? PriceAll : 0, paid),
        ]);
    }

    public static string Cheapest(IReadOnlyList<PhotoOption> options) => options.Aggregate((a, b) => b.Total < a.Total ? b : a).Id;

    /// <summary>Photos saved per attempt; an attempt that is cut short keeps what it saved.</summary>
    public const int DownloadBatch = 5;

    public const int RedownloadDays = 14;

    /// <summary>The photographers' posted sessions for a sailing, from the same days as the photo spots.</summary>
    public static List<PhotographerSlot> PhotographersFor(Timeline timeline, string? shipId = null)
    {
        var slots = new List<PhotographerSlot> { new(1, "12:00", "landing", "Welcome aboard photos at the gangway") };
        var formal = FormalDays(timeline.Nights);
        foreach (var d in timeline.Days)
        {
            if (formal.Contains(d.Day)) slots.Add(new(d.Day, "18:00", "piazza", formal[0] == d.Day ? "Formal night portraits" : "Another formal night's portraits"));
            if (d.Port == "sea")
            {
                slots.Add(new(d.Day, "11:00", "lido-pool", "Pool and deck photos"));
                slots.Add(new(d.Day, "19:00", AboardPlans.Room(shipId, "eclipse") ?? "eclipse", "Dining room table photos"));
            }
            else if (timeline.IsCall(d))
                slots.Add(new(d.Day, Hm(Before(d.AllAboard ?? new TimeOnly(16, 30), 90)), "landing", $"Back at the ship, {Short(Itinerary.PortOf(d.Port)?.Name ?? d.Port)}"));
        }
        return [.. slots.OrderBy(s => s.Day).ThenBy(s => s.Time)];
    }
}
