namespace Princess.Api.Domain;

public sealed record CabinInfo(string Number, int Deck, string Position, string Side, List<string> Notes, bool Obstructed, bool Accessible, bool Available);

/// <summary>Ported from <c>src/domain/cabins.ts</c>: the sample staterooms of a room type, and which are free on a sailing. The numbers, positions and notes are authored samples, not the real deck plan; they match <c>ref.Cabins</c>.</summary>
public static class CabinRules
{
    private static readonly Dictionary<string, int[]> Decks = new()
    {
        ["interior"] = [8, 9, 10, 11, 12],
        ["oceanview"] = [8, 9, 10],
        ["balcony"] = [10, 11, 12, 14, 15],
        ["miniSuite"] = [14, 15, 16],
        ["sanctuaryMiniSuite"] = [16],
        ["signatureSuite"] = [16],
    };

    private static readonly string[] Positions = ["forward", "midship", "aft"];
    private const int PerCategory = 9;

    /// <summary>FNV-1a over UTF-16 code units, as the screens' <c>hash</c>.</summary>
    private static uint Hash(string text)
    {
        var h = 2166136261u;
        foreach (var c in text) h = unchecked((h ^ c) * 16777619u);
        return h;
    }

    /// <summary>The sample staterooms. The same sailing and room type always give the same answer. <paramref name="taken"/> are numbers already booked on the sailing.</summary>
    public static List<CabinInfo> CabinsFor(string sailingId, string category, IReadOnlySet<string>? taken = null)
    {
        if (!Decks.TryGetValue(category, out var decks)) return [];
        var list = new List<CabinInfo>();
        for (var i = 0; i < PerCategory; i++)
        {
            var deck = decks[i % decks.Length];
            var position = Positions[i % 3];
            var side = i % 2 == 0 ? "port" : "starboard";
            var number = $"{deck}{(100 + ((i * 37 + category.Length * 11) % 400)):000}";
            var obstructed = category is "oceanview" or "balcony" && deck <= 9 && position != "midship";
            var accessible = i == 1 && category is not ("sanctuaryMiniSuite" or "signatureSuite");
            var notes = new List<string>
            {
                position == "midship" ? "Near the elevators" : position == "forward" ? "Toward the front of the ship" : "Toward the back of the ship",
            };
            if (deck >= 14) notes.Add("Close to the pool decks, so some daytime noise");
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
