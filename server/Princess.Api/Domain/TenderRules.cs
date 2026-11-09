namespace Princess.Api.Domain;

public sealed record TenderOutlookDto(string Source, string Port, string Date, string Band, int Percent, string[] YouCan);

/// <summary>
/// Tender outlook (X10b): how likely the small boats to shore are to run late or be called off at a tender port on a date. Authored chances by month
/// plus a steady spread by port and day, so the same question gets the same answer. Not a forecast: the captain decides on the day. A real sea-state
/// provider replaces <c>ITenderOutlook</c> and keeps this shape.
/// </summary>
public static class TenderRules
{
    // Chance (percent) by month, January first: winter swell and the hurricane months are higher.
    private static readonly int[] MonthChance = [12, 12, 10, 8, 6, 6, 6, 8, 10, 10, 8, 12];
    private static readonly string[] Advice = ["early", "plan", "excursion"];

    public static bool ValidQuery(string? port, string? date) => ShipFeedRules.ValidPort(port) && ShipFeedRules.ValidDate(date);

    public static TenderOutlookDto Outlook(string port, string date)
    {
        var month = int.Parse(date.AsSpan(5, 2)) - 1;
        var percent = MonthChance[month] + (int)(ShipFeedRules.Fnv($"tender|{port}|{date}") % 9);
        var band = percent < 10 ? "good" : percent < 16 ? "mixed" : "rough";
        return new TenderOutlookDto(FeedRules.Sim, port, date, band, percent, band == "good" ? Advice.Take(1).ToArray() : Advice);
    }
}
