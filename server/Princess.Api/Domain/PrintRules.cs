namespace Princess.Api.Domain;

public sealed record PrintProduct(string Id, long Cents, int MinPhotos, int MaxPhotos);

/// <summary>
/// Print It (N-R5): a printed memory book or a postcard set made from photos the booking owns. Prices and limits are authored concept values;
/// the print shop itself sits behind <c>IPrintProvider</c>, so a real print-on-demand provider replaces the simulation with no front-end change.
/// </summary>
public static class PrintRules
{
    public static readonly IReadOnlyList<PrintProduct> Products =
    [
        new("book", 3495, 4, 24),
        new("postcards", 1495, 4, 8),
    ];

    public static PrintProduct? Find(string? id) => Products.FirstOrDefault(p => p.Id == id);

    /// <summary>How far an order has got, worked from when it was placed: placed, printing after a day, posted after three, delivered on the promised day.</summary>
    public static string Stage(DateTime placed, DateTime deliverBy, DateTime now) =>
        now >= deliverBy ? "delivered" : now >= placed.AddDays(3) ? "posted" : now >= placed.AddDays(1) ? "printing" : "placed";
}
