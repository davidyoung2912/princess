using System.Text.Json;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

public sealed record TvState(bool On, int Channel, int Volume, bool Muted, string? Casting, string? Vod);

public sealed record GameStateDto(List<string> Found, Dictionary<string, int> Answers, List<int> Marked);

/// <summary>The cabin TV (ENT-06) and the games (ENT-05). Ports <c>src/domain/tv.ts</c> and the stored part of <c>src/domain/games.ts</c>: the bingo card and the called numbers are worked out by the screens, the server keeps what the guest found, answered and marked.</summary>
public static partial class TvAndGameRules
{
    public const int ChannelCount = 12;
    public const int VodChannel = 12;
    public const int DefaultVolume = 20;

    public static readonly IReadOnlyDictionary<string, string> VodRatings = new Dictionary<string, string>
    {
        ["v-reef"] = "G", ["v-cook"] = "G", ["v-captain"] = "G", ["v-comedy"] = "PG-13", ["v-family"] = "PG", ["v-drama"] = "PG-13",
    };

    public static bool ChannelKnown(int n) => n >= 1 && n <= ChannelCount;

    /// <summary>Whether a title is suitable for a guest: PG needs 8 and PG-13 needs 13.</summary>
    public static bool TitleAllowed(string rating, int age) => rating == "G" || (rating == "PG" && age >= 8) || (rating == "PG-13" && age >= 13);

    [GeneratedRegex(@"^[A-Za-z0-9 ._'-]{1,40}$")]
    private static partial Regex DevicePattern();

    public static bool DeviceNameOk(string name) => DevicePattern().IsMatch(name);

    public static readonly TvState DefaultTv = new(false, 1, DefaultVolume, false, null, null);

    /// <summary>The stored state with anything that is not valid put back to its default.</summary>
    public static TvState ParseTv(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return DefaultTv;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var o = doc.RootElement;
            if (o.ValueKind != JsonValueKind.Object) return DefaultTv;
            int? Int(string name) => o.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n) ? n : null;
            string? Str(string name) => o.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
            bool Bool(string name) => o.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.True;
            var channel = Int("channel") is { } c && ChannelKnown(c) ? c : 1;
            var volume = Int("volume") is { } vol && vol >= 0 && vol <= 100 ? vol : DefaultVolume;
            var vod = Str("vod");
            return new TvState(Bool("on"), channel, volume, Bool("muted"), Str("casting"), vod is not null && VodRatings.ContainsKey(vod) ? vod : null);
        }
        catch (JsonException)
        {
            return DefaultTv;
        }
    }

    public static string TvJson(TvState s) => JsonSerializer.Serialize(new { on = s.On, channel = s.Channel, volume = s.Volume, muted = s.Muted, casting = s.Casting, vod = s.Vod });

    // ---- Games ----

    public static readonly string[] HuntClues = ["h-pool", "h-spa", "h-piazza", "h-guest", "h-fitness", "h-shops"];

    /// <summary>Question id to the number of options it has.</summary>
    public static readonly IReadOnlyDictionary<string, int> Trivia = new Dictionary<string, int>
    {
        ["q-ports"] = 3, ["q-clock"] = 3, ["q-decks"] = 3, ["q-muster"] = 3, ["q-allaboard"] = 3, ["q-sun"] = 3,
    };

    public static GameStateDto ParseGame(string? json)
    {
        var found = new List<string>();
        var answers = new Dictionary<string, int>();
        var marked = new List<int>();
        if (!string.IsNullOrWhiteSpace(json))
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var o = doc.RootElement;
                if (o.ValueKind == JsonValueKind.Object)
                {
                    if (o.TryGetProperty("found", out var f) && f.ValueKind == JsonValueKind.Array)
                        found = [.. f.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!).Where(HuntClues.Contains).Distinct()];
                    if (o.TryGetProperty("answers", out var a) && a.ValueKind == JsonValueKind.Object)
                        foreach (var (id, options) in Trivia)
                            if (a.TryGetProperty(id, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n) && n >= 0 && n < options) answers[id] = n;
                    if (o.TryGetProperty("marked", out var m) && m.ValueKind == JsonValueKind.Array)
                        marked = [.. m.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.Number && x.TryGetInt32(out var n) && n >= 1 && n <= 75).Select(x => x.GetInt32()).Distinct()];
                }
            }
            catch (JsonException)
            {
            }
        }
        return new GameStateDto(found, answers, marked);
    }

    public static string GameJson(GameStateDto g) => JsonSerializer.Serialize(new { found = g.Found, answers = g.Answers, marked = g.Marked });
}
