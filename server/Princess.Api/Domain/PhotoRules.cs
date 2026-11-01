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
    public static readonly IReadOnlyList<PhotoSpot> Spots =
    [
        new("gangway", 1, "gangway", "Welcome aboard, the gangway", "12:30"),
        new("formal1", 2, "portrait", "Formal night portraits, the Piazza", "18:00"),
        new("cozumel", 3, "port", "Cozumel, back at the dock", "16:00"),
        new("belize", 4, "port", "Belize City tender pier", "13:30"),
        new("roatan", 5, "port", "Roatán, the cruise pier", "14:00"),
        new("pool", 6, "pool", "Lido pool, sea day", "11:30"),
        new("dining", 6, "dining", "Your table, Eclipse Dining Room", "19:15"),
        new("formal2", 7, "portrait", "Second formal night portraits", "18:00"),
    ];

    /// <summary>Photos taken so far of the people on the booking.</summary>
    public static List<Photo> PhotosFor(IReadOnlyList<Guid> party, int throughDay) =>
        [.. Spots.Where(s => s.Day <= throughDay).Select(s => new Photo(s.Id, s.Day, s.Venue, s.Title, s.Time, [.. party]))];

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

    /// <summary>The photographers' posted sessions.</summary>
    public static readonly IReadOnlyList<PhotographerSlot> Photographers =
    [
        new(1, "12:00", "landing", "Welcome aboard photos at the gangway"),
        new(2, "18:00", "piazza", "Formal night portraits"),
        new(3, "15:30", "landing", "Back at the ship, Cozumel"),
        new(6, "11:00", "lido-pool", "Pool and deck photos"),
        new(6, "19:00", "eclipse", "Dining room table photos"),
        new(7, "18:00", "piazza", "Second formal night portraits"),
    ];
}
