using System.Text.Json;

namespace Princess.Api.Domain;

/// <summary>
/// A bundle as it travels in <c>ChatMessages.Payload</c> (docs/chat-bundles-plan.md, section 5.1): something from the app sent into a chat. <c>Title</c>, <c>Subtitle</c>, <c>Path</c>, <c>Day</c>, <c>Time</c> and <c>Place</c>
/// are plain fields so any client can show a bundle without understanding its type; <c>Ref</c> names what it is. Built by the server from its own data, never from what a client sent.
/// </summary>
public sealed record ChatBundle(string Type, int V, string Title, string? Subtitle = null, string? Path = null, int? Day = null, string? Time = null, string? Place = null, string? Ref = null, string? Note = null, string? Data = null, string? From = null);

/// <summary>
/// The pure rules of bundle messages, phase B1: the types the server can build (a venue and a menu so far), their refs, the payload and the words a list line and a phone alert show.
/// A bundle carries no money or identity: it passes <see cref="ChatCardRules.HasForbiddenKey"/> before it is stored, like any card. Nothing here touches a store or a clock.
/// </summary>
public static class ChatBundleRules
{
    public const string Kind = "bundle";

    /// <summary>The shape of the payload. A reader that does not know a larger number shows the title and subtitle only.</summary>
    public const int Version = 1;

    public const string Venue = ChatCardRules.Venue, Menu = ChatCardRules.Menu;

    /// <summary>
    /// Phase B2: things with a day and a time. Their ref is <c>event:&lt;eventId&gt;:&lt;day&gt;</c> (the same <c>eventId:day</c> a plan uses), and the type the bundle carries is <c>excursion</c> for a tour, <c>dinner</c> for a dinner
    /// and <c>event</c> for anything else on the programme or in an Explorer (a show, a class, an activity).
    /// </summary>
    public const string Event = "event", Excursion = "excursion", Dinner = "dinner";

    /// <summary>
    /// Phase B7: a port on the guest's own itinerary (<c>port:&lt;portId&gt;</c>), a place on the ship (<c>place:&lt;placeId&gt;</c>) and a dish on a menu of the guest's ship (<c>dish:&lt;venueId&gt;:&lt;slug&gt;</c>).
    /// None has a day and a time of its own, so none is plannable; a place is a place to find, never a live "meet me here" (that stays the place card).
    /// </summary>
    public const string Port = "port", Place = "place", Dish = "dish";

    /// <summary>
    /// Phase B8: a game puzzle (<c>game:&lt;id&gt;:&lt;start|current&gt;</c>), the one snapshot bundle. The words, the screen and the type (<c>game.&lt;id&gt;</c>) come from <see cref="Games"/>, never from the sender; the sender's puzzle text is kept
    /// in <c>Data</c> only when it passes <see cref="GameDataOk"/>. It is not in <see cref="Types"/>: no poll, board or code can name a game, only a send can carry one.
    /// </summary>
    public const string Game = "game";

    public const int GameDataMax = 4000;

    /// <summary>The games that can be sent, with their name and the number of cells (or sizes) a puzzle may have. The id is the catalogue id and the screen is <c>/games-explorer/&lt;id&gt;</c>.</summary>
    public static readonly Dictionary<string, string> Games = new()
    {
        ["sudoku"] = "Sudoku", ["diagonal-sudoku"] = "Diagonal Sudoku", ["jigsaw-sudoku"] = "Jigsaw Sudoku", ["killer-sudoku"] = "Killer Sudoku", ["binairo"] = "Binairo", ["futoshiki"] = "Futoshiki", ["kenken"] = "KenKen", ["hitori"] = "Hitori", ["crossmath"] = "Crossmath", ["kakuro"] = "Kakuro", ["slitherlink"] = "Slitherlink", ["nurikabe"] = "Nurikabe", ["hashi"] = "Hashi", ["nonogram"] = "Nonogram", ["cruise-wordle"] = "Cruise Wordle", ["word-search"] = "Word Search", ["codeword"] = "Codeword", ["minesweeper"] = "Minesweeper",
    };

    private static readonly string[] Levels = ["easy", "medium", "hard", "expert"];

    /// <summary>The puzzle text: letters, digits, <c>=</c>, <c>;</c> and <c>,</c> only, a level, and the clues at a size the game has (81 cells; 6, 8, 10 or 12 squared for Binairo; 4 to 7 squared for Futoshiki and KenKen; 5, 6, 8 or 10 squared for Hitori; 6, 8, 9 or 10 squared for Kakuro; 5, 7, 8 or 10 squared for Slitherlink; four digits of rows and columns for Crossmath, Nurikabe and Hashi; a size of 5, 8, 10 or 15 for Nonogram; a word-list place of up to four digits for Cruise Wordle; a size of 6, 8, 10 or 12 for Word Search, 7, 9, 11 or 13 for Codeword; rows and columns for Minesweeper).</summary>
    public static bool GameDataOk(string game, string? data)
    {
        if (data is not { Length: > 0 and <= GameDataMax } || !data.All(c => char.IsAsciiLetterOrDigit(c) || c is '=' or ';' or ',')) return false;
        var pairs = new Dictionary<string, string>();
        foreach (var part in data.Split(';'))
        {
            var at = part.IndexOf('=');
            if (at < 1 || !pairs.TryAdd(part[..at], part[(at + 1)..])) return false;
        }
        if (!pairs.TryGetValue("d", out var level) || !Levels.Contains(level) || !pairs.TryGetValue("p", out var clues) || !clues.All(char.IsAsciiDigit)) return false;
        return game switch
        {
            "binairo" => clues.Length is 36 or 64 or 100 or 144,
            "futoshiki" or "kenken" => clues.Length is 16 or 25 or 36 or 49,
            "hitori" => clues.Length is 25 or 36 or 64 or 100,
            "kakuro" => clues.Length is 36 or 64 or 81 or 100,
            "slitherlink" => clues.Length is 25 or 49 or 64 or 100,
            "crossmath" or "nurikabe" or "hashi" => clues.Length == 4,
            "nonogram" => clues is "5" or "8" or "10" or "15",
            "cruise-wordle" => clues.Length is >= 1 and <= 4,
            "word-search" => clues is "6" or "8" or "10" or "12",
            "codeword" => clues is "7" or "9" or "11" or "13",
            "minesweeper" => clues is "0808" or "1010" or "1214" or "1616",
            _ => clues.Length == 81,
        };
    }

    /// <summary>The seconds in a result's <c>tm</c> pair (1 to 359999), or null when there is none or it is not a sensible number.</summary>
    public static int? ResultSeconds(string? data)
    {
        var pair = (data ?? "").Split(';').FirstOrDefault(p => p.StartsWith("tm=", StringComparison.Ordinal));
        return pair is { Length: > 3 and <= 9 } && pair[3..].All(char.IsAsciiDigit) && int.Parse(pair[3..]) is >= 1 and <= 359999 and var n ? n : null;
    }

    /// <summary>The bundle for a game puzzle, or null for a ref that is not <c>game:&lt;id&gt;:&lt;start|current|result&gt;</c>, an unknown game or puzzle text that fails <see cref="GameDataOk"/>.</summary>
    public static ChatBundle? BuildGame(string? shareRef, string? data, string? note)
    {
        var parts = (shareRef ?? "").Split(':');
        if (parts.Length != 3 || parts[0] != Game || !Games.TryGetValue(parts[1], out var name) || parts[2] is not ("start" or "current" or "result") || !GameDataOk(parts[1], data)) return null;
        // Phase B10: a result is the starting position and a time (<c>tm</c>, 1 to 359999 seconds); anything else in the text is the same puzzle text as for a start.
        var seconds = ResultSeconds(data);
        if (parts[2] == "result" ? seconds is null : seconds is not null) return null;
        var level = data!.Split(';').First(p => p.StartsWith("d=", StringComparison.Ordinal))[2..];
        var subtitle = $"{char.ToUpperInvariant(level[0])}{level[1..]}, {parts[2] switch { "start" => "starting position", "current" => "board so far", _ => $"solved in {seconds / 60}:{seconds % 60:00}" }}";
        return new ChatBundle($"{Game}.{parts[1]}", Version, name, subtitle, $"/games-explorer/{parts[1]}", Ref: shareRef, Note: ChatCardRules.CleanNote(note), Data: data);
    }

    /// <summary>The types a ref can name today (the prefix of the ref). More arrive one phase at a time.</summary>
    public static readonly string[] Types = [Venue, Menu, Event, Port, Place, Dish];

    /// <summary>The id in a <c>port:</c> or <c>place:</c> ref, or null when the ref is not one or the id has anything but letters, digits, dashes and underscores.</summary>
    public static string? IdOf(string? shareRef, string type) =>
        shareRef is { } r && r.StartsWith(type + ":", StringComparison.Ordinal) && r[(type.Length + 1)..] is { Length: > 0 and <= 60 } id && id.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_') ? id : null;

    /// <summary>The venue id and dish slug in a <c>dish:&lt;venueId&gt;:&lt;slug&gt;</c> ref, or null.</summary>
    public static (string VenueId, string Slug)? ParseDishRef(string? shareRef)
    {
        if (shareRef is not { } r || !r.StartsWith("dish:", StringComparison.Ordinal)) return null;
        var parts = r[5..].Split(':');
        return parts.Length == 2 && parts.All(p => p.Length is > 0 and <= 60 && p.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_')) ? (parts[0], parts[1]) : null;
    }

    /// <summary>
    /// Phase B11: the name a forwarded bundle carries. A forward of a forward keeps the first sender's name; a person's own bundle forwarded by them carries none;
    /// otherwise the sender's short name (null when they are no longer in the chat).
    /// </summary>
    public static string? ForwardName(string? earlierFrom, bool senderIsForwarder, string? senderName) =>
        earlierFrom is { Length: > 0 } ? earlierFrom : senderIsForwarder ? null : senderName is { Length: > 0 } ? senderName : null;

    /// <summary>The stored choice that means "I did it" on a bundle. Not <see cref="ChatPlanningRules.Going"/> (0): taking it back stores 0, and that must not count.</summary>
    public const int DoneChoice = 1;

    /// <summary>The types a bundle can carry that have a day and a time: they can be proposed (Going, Maybe, No) and added to a day.</summary>
    public static readonly string[] Plannable = [Event, Excursion, Dinner];

    public static bool IsPlannable(string? type) => type is not null && Plannable.Contains(type);

    /// <summary>The type of a bundle made from an event id: a tour, a dinner or an ordinary event.</summary>
    public static string TypeOfEvent(string eventId) => ChatPlanningRules.ParseTourEvent(eventId) is not null ? Excursion : ChatPlanningRules.ParseDinnerEvent(eventId) is not null ? Dinner : Event;

    /// <summary>The <c>eventId:day</c> part of an <c>event:</c> ref, or null when the ref is not one.</summary>
    public static string? PlanRefOf(string? shareRef) => shareRef is { } r && r.StartsWith("event:", StringComparison.Ordinal) && r.Length > 6 ? r[6..] : null;

    public static bool IsKnownType(string? type) => type is not null && Types.Contains(type);

    /// <summary>The type a ref names (the part before the first colon), or null when the ref is empty or names no known type.</summary>
    public static string? TypeOfRef(string? shareRef)
    {
        if (string.IsNullOrWhiteSpace(shareRef)) return null;
        var colon = shareRef.IndexOf(':');
        var type = colon < 0 ? shareRef : shareRef[..colon];
        return IsKnownType(type) ? type : null;
    }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };

    public static string Serialise(ChatBundle bundle) => JsonSerializer.Serialize(bundle, Json);

    /// <summary>The bundle in a payload, or null when it is empty, malformed or has no type or title. An unknown type still parses: the reader decides how to show it.</summary>
    public static ChatBundle? Parse(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload)) return null;
        try { return JsonSerializer.Deserialize<ChatBundle>(payload, Json) is { Type.Length: > 0, Title.Length: > 0 } b ? b : null; }
        catch (JsonException) { return null; }
    }

    /// <summary>A card (built from the server's own data) as a bundle of the type its ref names.</summary>
    public static ChatBundle FromCard(string type, string shareRef, ChatCard card, string? note) =>
        new(type, Version, card.Title, card.Subtitle, card.Path, card.Day, card.Time, card.Place, shareRef, ChatCardRules.CleanNote(note));

    /// <summary>The words a list line, a pin and a phone alert show for a bundle (never the payload).</summary>
    public static string Preview(ChatBundle? bundle) => bundle is null ? "Shared from the app" : bundle.Subtitle is { Length: > 0 } s ? $"{bundle.Title}: {s}" : bundle.Title;
}
