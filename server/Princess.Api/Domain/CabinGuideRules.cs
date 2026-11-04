namespace Princess.Api.Domain;

/// <summary>How the sun falls on one side of the ship over the eight days (the heading each day is a simulation).</summary>
public sealed record SunSummaryDto(int Mornings, int Afternoons, int PortAfternoons, string Label, string Text);

/// <summary>A stateroom with its scores (1 to 5, 5 is best), the plain reasons for each, the sun and any cautions. Nothing is hidden for the sake of a sale.</summary>
public sealed record CabinScoreDto(CabinInfo Cabin, string Category, int Sleep, int Motion, int Noise, CabinReasonsDto Reasons, SunSummaryDto? Sun, IReadOnlyList<string> Warnings);

public sealed record CabinReasonsDto(IReadOnlyList<string> Sleep, IReadOnlyList<string> Motion, IReadOnlyList<string> Noise);

public sealed record CabinGuideDto(string SailingId, string Category, IReadOnlyList<CabinScoreDto> Cabins, string Source);

public sealed record CabinFilterDto(bool Quiet, bool CalmSea, bool Accessible, bool ClearView, bool AvailableOnly);

/// <summary>
/// The cabin chooser's scoring (S1-02 to S1-05), moved from <c>cabinScore.ts</c> so every device gets the same answer and a real deck plan can replace
/// the sample one (multi-device plan 3, Phase 4). The ship's heading each day is a simulation.
/// </summary>
public static class CabinGuideRules
{
    private static int Clamp(int n) => Math.Max(1, Math.Min(5, n));

    private static (int Score, List<string> Why) Sleep(CabinInfo c, CabinRules.ShipCabinProfile p, bool sun)
    {
        var why = new List<string>();
        var s = 5;
        if (c.Position == "forward" && c.Deck <= p.LowDeck) { s--; why.Add("The bow thrusters are close by. They run when the ship docks, often early in the morning."); }
        if (c.Position == "aft" && c.Deck <= p.LowDeck + 1) { s--; why.Add("The engine and propellers are near, so you may feel a low hum or vibration."); }
        if (sun && c.Deck >= 16 && c.Position == "midship") { s--; why.Add("The Dome is close by, and its late-night dance party can carry."); }
        if (c.Position == "midship" && c.Deck <= p.LowDeck + 2) { s--; why.Add("A galley and laundry sit nearby, with early-morning deliveries."); }
        if (why.Count == 0) why.Add("Nothing noisy above, below or beside this one in our sample plan.");
        return (Clamp(s), why);
    }

    private static (int Score, List<string> Why) Motion(CabinInfo c)
    {
        var why = new List<string>();
        var s = 5;
        if (c.Position == "forward") { s -= 2; why.Add("The front of the ship pitches the most in a swell."); }
        else if (c.Position == "aft") { s--; why.Add("The back of the ship moves a little more than the middle."); }
        if (c.Deck >= 15) { s -= 2; why.Add("High decks sway more, which can bother anyone prone to seasickness."); }
        else if (c.Deck >= 12) { s--; why.Add("A middle-height deck moves a bit more than a low one."); }
        if (why.Count == 0) why.Add("Midship on a lower deck, the steadiest part of the ship.");
        return (Clamp(s), why);
    }

    private static (int Score, List<string> Why) Noise(CabinInfo c, CabinRules.ShipCabinProfile p)
    {
        var why = new List<string>();
        var s = 5;
        if (c.Position == "midship") { s--; why.Add("Near the elevators, so people walk past all day."); }
        if (c.Deck >= p.PoolDeck) { s -= 2; why.Add("Close to the pool decks, with music and chairs moving in the daytime."); }
        if (c.Accessible) why.Add("An accessible cabin, so a wider door and a hallway built for wheelchairs. Neighbours may need help at any hour.");
        if (why.Count == 0) why.Add("Away from the lifts, stairs and pool decks.");
        return (Clamp(s), why);
    }

    /// <summary>The ship's heading each day (degrees clockwise from north); berthed ships point the way the berth lies. A simulation.</summary>
    private static readonly int[] Headings = [135, 215, 350, 90, 300, 40, 20, 180];

    private static int Angle(int a, int b)
    {
        var d = Math.Abs(((a - b) % 360 + 360) % 360);
        return d > 180 ? 360 - d : d;
    }

    /// <summary>Which side of the ship gets the sun in the morning (az 100) or afternoon (az 260).</summary>
    internal static string SunSide(int heading, bool morning)
    {
        var az = morning ? 100 : 260;
        var port = Angle((heading + 270) % 360, az);
        var starboard = Angle((heading + 90) % 360, az);
        if (Math.Min(port, starboard) > 60) return "neither";
        return port <= starboard ? "port" : "starboard";
    }

    public static SunSummaryDto Sun(string side)
    {
        int mornings = 0, afternoons = 0, portAfternoons = 0;
        var days = Itinerary.Days(new DateOnly(2000, 1, 1));
        foreach (var d in days)
        {
            var h = Headings[d.Day - 1];
            if (SunSide(h, true) == side) mornings++;
            if (SunSide(h, false) == side)
            {
                afternoons++;
                if (d.Port != "sea" && d.Port != "fll") portAfternoons++;
            }
        }
        var label = mornings >= 3 && afternoons >= 3 ? "both" : mornings >= 3 ? "morning" : afternoons >= 3 ? "afternoon" : "shaded";
        var text = label switch
        {
            "both" => "Sun on this side in the morning and the afternoon on most days. Bring a hat.",
            "morning" => "Morning sun on most days, shaded in the afternoon. Good for coffee outside, cooler for a nap.",
            "afternoon" => "Shaded in the morning, sun in the afternoon on most days. Warmer in the cabin when you come back from a port.",
            _ => "Little direct sun on this side on most days. Cooler, and kinder to a screen.",
        };
        return new(mornings, afternoons, portAfternoons, label, text);
    }

    public static CabinScoreDto Score(string category, CabinInfo cabin, string shipId = CabinRules.SunShip)
    {
        var profile = CabinRules.ProfileOf(shipId);
        var sleep = Sleep(cabin, profile, shipId == CabinRules.SunShip);
        var motion = Motion(cabin);
        var noise = Noise(cabin, profile);
        var warnings = new List<string>();
        if (cabin.Obstructed) warnings.Add("The view is partly blocked by lifeboats.");
        if (!cabin.Available) warnings.Add("This cabin is already taken on this sailing.");
        if (cabin.Accessible) warnings.Add("Reserved for guests who need an accessible cabin; ask before booking it.");
        return new(cabin, category, sleep.Score, motion.Score, noise.Score, new(sleep.Why, motion.Why, noise.Why), CabinRules.ClassOf(category) != "interior" ? Sun(cabin.Side) : null, warnings);
    }

    public static bool ValidCategory(string? category) => category is "interior" or "oceanview" or "balcony" or "miniSuite" or "sanctuaryMiniSuite" or "signatureSuite" || (category is not null && FareBook.Category(category) is not null);

    /// <summary>Cabins for a room type with their scores. The quiet filter needs good sleep and low noise; the calm-sea filter needs a motion score of 4 or more.</summary>
    public static CabinGuideDto Guide(string sailingId, string category, CabinFilterDto filter, IReadOnlySet<string>? taken)
    {
        var shipId = AboardPlans.ShipOfSailing(sailingId);
        var list = CabinRules.CabinsFor(sailingId, category, taken)
            .Select(c => Score(category, c, shipId))
            .Where(s => (!filter.AvailableOnly || s.Cabin.Available) && (!filter.Quiet || (s.Sleep >= 4 && s.Noise >= 4)) && (!filter.CalmSea || s.Motion >= 4)
                && (!filter.Accessible || s.Cabin.Accessible) && (!filter.ClearView || !s.Cabin.Obstructed))
            .OrderByDescending(s => s.Sleep + s.Motion + s.Noise)
            .ThenBy(s => s.Cabin.Number, StringComparer.Ordinal)
            .ToList();
        return new(sailingId, category, list, FeedRules.Sim);
    }
}
