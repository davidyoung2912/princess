using Princess.Api.Data;

namespace Princess.Api.Domain;

public sealed record QualityNoteDto(string Key, string Level, string Text, string Why);

public sealed record SailingQualityDto(string SailingId, IReadOnlyList<QualityNoteDto> Notes, string Source);

public sealed record FriendReplyDto(string Reply, string Source);

/// <summary>
/// Simulated dream and decide notes for a sailing (crowds, weather, hurricane season, school holidays, price) and the pretend replies a guest's
/// friends give to a sail-again invitation. Both moved here from the screens (multi-device plan 3, Phase 4); a real provider replaces the body and
/// keeps the shape.
/// </summary>
public static class SailingQualityRules
{
    private static readonly string[] Levels = ["low", "medium", "high"];

    private static QualityNoteDto Say(string key, string level, IReadOnlyDictionary<string, string> texts, string why) => new(key, level, texts[level], why);

    private static Dictionary<string, string> Texts(string low, string medium, string high) => new() { ["low"] = low, ["medium"] = medium, ["high"] = high };

    /// <summary>The notes for one sailing. <paramref name="allSailingIds"/> are the sailings on offer, for the price comparison.</summary>
    public static SailingQualityDto For(SailingRow sailing, IEnumerable<string> allSailingIds)
    {
        var departure = DateOnly.FromDateTime(sailing.Departure);
        var m = departure.Month;
        var ports = Itinerary.Days(departure).Count(d => d.Port != "sea" && d.Port != "fll");
        // Ships in port the same day: the winter season is the busiest, so it leans higher, and every sailing has its own stable draw.
        var baseLevel = m is 12 or 1 or 2 or 3 ? 1 : 0;
        var crowd = Levels[Math.Min(2, baseLevel + (int)(CabinRules.Hash($"crowd|{sailing.Id}") % 2))];
        var hurricane = m is >= 8 and <= 10 ? "high" : m is 6 or 7 or 11 ? "medium" : "low";
        var school = sailing.IsHoliday ? "high" : m == 3 || (m == 11 && departure.Day >= 22) ? "medium" : "low";
        var totals = allSailingIds.Select(id => Pricing.Quote(id, "interior", 2)?.Total).Where(t => t.HasValue).Select(t => t!.Value).ToList();
        var cheapest = totals.Count > 0 ? totals.Min() : 0;
        var mine = Pricing.Quote(sailing.Id, "interior", 2)?.Total ?? cheapest;
        var premium = cheapest > 0 ? (double)mine / cheapest : 1;
        var price = premium > 1.4 ? "high" : premium > 1.15 ? "medium" : "low";
        var weather = m >= 12 || m <= 4 ? "low" : "medium";
        return new(sailing.Id,
        [
            Say("crowds", crowd, Texts("Quiet ports: few other ships expected.", "Some other ships in port on a day or two.", $"Busy ports: expect other ships in all {ports} of them."), "Winter is the Caribbean’s busiest season, and every sailing has a different mix of ships."),
            Say("weather", weather, Texts("Dry season: mostly sun and little rain.", "Showers are likely in the afternoons.", "Wet season."), "Based on the month, not a forecast."),
            Say("hurricane", hurricane, Texts("Outside hurricane season.", "Edges of the hurricane season. A route change is possible but unlikely.", "The peak of hurricane season. A change of route is more likely; check the cancellation terms."), "The Atlantic season runs 1 June to 30 November, and peaks in August to October."),
            Say("school", school, Texts("Few children on board.", "More families than usual.", "School holiday: many children, busy pools and clubs."), "Based on school calendars in the US."),
            Say("price", price, Texts("Near the lowest fare of the season.", "A little above the lowest fare.", "Well above the lowest fare, for the holiday or a popular week."), "Compared with the cheapest sailing on offer."),
        ], FeedRules.Sim);
    }

    public const int FriendNameMax = 30;

    public static bool ValidFriendName(string? name) => !string.IsNullOrWhiteSpace(name) && name.Length <= FriendNameMax;

    /// <summary>A pretend answer to a sail-again invitation: about one friend in four declines, the same for the same name.</summary>
    public static FriendReplyDto Reply(string name) => new(CabinRules.Hash($"reply|{name.ToLowerInvariant()}") % 4 == 0 ? "declined" : "accepted", FeedRules.Sim);
}
