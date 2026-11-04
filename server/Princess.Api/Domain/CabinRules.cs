namespace Princess.Api.Domain;

public sealed record CabinInfo(string Number, int Deck, string Position, string Side, List<string> Notes, bool Obstructed, bool Accessible, bool Available);

/// <summary>Ported from <c>src/domain/cabins.ts</c>: the sample staterooms of a room type, and which are free on a sailing. The numbers, positions and notes are authored samples, not the real deck plan; they match <c>ref.Cabins</c>.</summary>
public static class CabinRules
{
    /// <summary>How a ship's staterooms are laid out: the decks of each room class, the lowest deck with a pool above it (noise), and the highest deck whose views the lifeboats block.</summary>
    public sealed record ShipCabinProfile(IReadOnlyDictionary<string, int[]> Decks, int PoolDeck, int LowDeck, int LifeboatDeck);

    public const string SunShip = "sun-princess";

    /// <summary>Sun Princess's sample layout, then Sky and Sapphire (concept samples, like their deck plans in <see cref="AboardPlans"/>; the cabin decks sit between the plan's lowest and its Lido deck).</summary>
    private static readonly Dictionary<string, ShipCabinProfile> Profiles = new()
    {
        [SunShip] = new(new Dictionary<string, int[]>
        {
            ["interior"] = [8, 9, 10, 11, 12],
            ["oceanview"] = [8, 9, 10],
            ["balcony"] = [10, 11, 12, 14, 15],
            ["miniSuite"] = [14, 15, 16],
            ["sanctuaryMiniSuite"] = [16],
            ["signatureSuite"] = [16],
        }, 14, 9, 9),
        ["sky-princess"] = new(new Dictionary<string, int[]>
        {
            ["interior"] = [9, 10, 11, 12, 14],
            ["oceanview"] = [9, 10, 11],
            ["balcony"] = [9, 10, 11, 12, 14],
            ["miniSuite"] = [12, 14],
        }, 15, 10, 10),
        ["sapphire-princess"] = new(new Dictionary<string, int[]>
        {
            ["interior"] = [8, 9, 10, 11],
            ["oceanview"] = [8, 9, 10],
            ["balcony"] = [8, 9, 10, 11],
            ["miniSuite"] = [10, 11],
        }, 11, 8, 8),
    };

    /// <summary>The ships whose staterooms are laid out.</summary>
    public static IReadOnlyCollection<string> Ships => Profiles.Keys;

    public static ShipCabinProfile ProfileOf(string shipId) => Profiles.GetValueOrDefault(shipId) ?? Profiles[SunShip];

    /// <summary>The room class of a category id: Sun's six keep their ids; a ship's own ("sky-balcony", "sapphire-minisuite") name the same classes.</summary>
    public static string ClassOf(string category) => category switch
    {
        _ when Profiles[SunShip].Decks.ContainsKey(category) => category,
        _ when category.EndsWith("-interior", StringComparison.Ordinal) => "interior",
        _ when category.EndsWith("-oceanview", StringComparison.Ordinal) => "oceanview",
        _ when category.EndsWith("-balcony", StringComparison.Ordinal) => "balcony",
        _ when category.EndsWith("-minisuite", StringComparison.Ordinal) => "miniSuite",
        _ => category,
    };

    /// <summary>The two top suite types have no accessible staterooms (as <c>hasAccessibleCabins</c> in the client).</summary>
    public static bool HasAccessibleCabins(string category) => ClassOf(category) is not ("sanctuaryMiniSuite" or "signatureSuite");

    /// <summary>The room types that have accessible staterooms, in deck-plan order: Sun's, then each other ship's categories.</summary>
    public static IReadOnlyList<string> AccessibleCategories =>
        [.. Profiles[SunShip].Decks.Keys.Where(HasAccessibleCabins),
         .. Profiles.Where(p => p.Key != SunShip).SelectMany(p => p.Value.Decks.Keys.Select(k => OwnId(p.Key, k)))];

    /// <summary>A ship's own category id for a room class, for example <c>sky-balcony</c>.</summary>
    public static string OwnId(string shipId, string roomClass) => $"{shipId.Replace("-princess", "")}-{roomClass.ToLowerInvariant()}";

    private static readonly string[] Positions = ["forward", "midship", "aft"];
    private const int PerCategory = 9;

    /// <summary>FNV-1a over UTF-16 code units, as the screens' <c>hash</c>.</summary>
    internal static uint Hash(string text)
    {
        var h = 2166136261u;
        foreach (var c in text) h = unchecked((h ^ c) * 16777619u);
        return h;
    }

    /// <summary>The sample staterooms. The same sailing and room type always give the same answer. <paramref name="taken"/> are numbers already booked on the sailing.</summary>
    public static List<CabinInfo> CabinsFor(string sailingId, string category, IReadOnlySet<string>? taken = null) =>
        CabinsOn(AboardPlans.ShipOfSailing(sailingId), sailingId, category, taken);

    /// <summary>The sample staterooms of a room type on a ship. The room class gives the decks; the category id's own text (its length) varies the numbers, as for Sun's.</summary>
    public static List<CabinInfo> CabinsOn(string shipId, string sailingId, string category, IReadOnlySet<string>? taken = null)
    {
        var profile = ProfileOf(shipId);
        var roomClass = ClassOf(category);
        if (!profile.Decks.TryGetValue(roomClass, out var decks)) return [];
        category = roomClass;
        // Sapphire's oceanview and mini-suite share decks and a name length, so the mini-suite gets its own salt there to keep every number unique.
        var salt = shipId != SunShip && roomClass == "miniSuite" ? 12 : roomClass.Length;
        var list = new List<CabinInfo>();
        for (var i = 0; i < PerCategory; i++)
        {
            var deck = decks[i % decks.Length];
            var position = Positions[i % 3];
            var side = i % 2 == 0 ? "port" : "starboard";
            var number = $"{deck}{(100 + ((i * 37 + salt * 11) % 400)):000}";
            var obstructed = category is "oceanview" or "balcony" && deck <= profile.LifeboatDeck && position != "midship";
            var accessible = i == 1 && HasAccessibleCabins(category);
            var notes = new List<string>
            {
                position == "midship" ? "Near the elevators" : position == "forward" ? "Toward the front of the ship" : "Toward the back of the ship",
            };
            if (deck >= profile.PoolDeck) notes.Add("Close to the pool decks, so some daytime noise");
            if (obstructed) notes.Add("View partly blocked by lifeboats");
            if (accessible) notes.Add("Step-free entrance with a roll-in shower");
            // About one in five is taken; the first two are always free so a choice always exists.
            var free = i < 2 || Hash($"{sailingId}|{number}") % 5 != 0;
            list.Add(new CabinInfo(number, deck, position, side, notes, obstructed, accessible, free && taken?.Contains(number) != true));
        }
        return list;
    }

    /// <summary>Whether the number is a real stateroom of that room type on that sailing and free.</summary>
    public static bool Available(string sailingId, string category, string number, IReadOnlySet<string>? taken = null) =>
        CabinsFor(sailingId, category, taken).Any(c => c.Number == number && c.Available);
}
