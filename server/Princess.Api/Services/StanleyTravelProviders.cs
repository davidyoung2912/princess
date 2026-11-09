using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace Princess.Api.Services;

/// <summary>A machine translation of a few plain words. <see cref="Confidence"/> is low, medium or high.</summary>
public sealed record MachineTranslation(string Text, string Confidence);

/// <summary>
/// Translates plain English into a port's language (phase 10). Returns null when it cannot do it well; the caller then falls back to showing the English words to a person. A real service replaces the simulation
/// through <c>Providers:Translation</c>. It is never asked about health, allergy, legal or emergency words.
/// </summary>
public interface ITranslationProvider
{
    MachineTranslation? Translate(string english, string language);
}

/// <summary>One line read from a photo: the original text, its English and how sure the reader is (0 to 1).</summary>
public sealed record ImageLine(string Original, string English, double Confidence);

/// <summary><see cref="Kind"/> is what the reader thinks the photo shows: sign, menu, document or unknown.</summary>
public sealed record ImageReading(string Kind, IReadOnlyList<ImageLine> Lines);

/// <summary>Reads text from a photo and translates it (phase 10). The bytes are used for the call and never kept. A real service replaces the simulation through <c>Providers:ImageText</c>.</summary>
public interface IImageTextReader
{
    ImageReading Read(byte[] image, string contentType, string language);
}

/// <summary>A small phrase-pattern translator into Spanish for everyday needs. It knows few words, so it often answers null, which is the point of the fallback.</summary>
public sealed class SimTranslationProvider : ITranslationProvider
{
    // Noun, with its definite and indefinite forms.
    private static readonly Dictionary<string, (string Def, string Indef)> Nouns = new()
    {
        ["water"] = ("el agua", "agua"), ["taxi"] = ("el taxi", "un taxi"), ["restroom"] = ("el baño", "un baño"), ["bathroom"] = ("el baño", "un baño"), ["bus"] = ("el autobús", "un autobús"),
        ["pier"] = ("el muelle", "un muelle"), ["market"] = ("el mercado", "un mercado"), ["beach"] = ("la playa", "una playa"), ["bank"] = ("el banco", "un banco"), ["atm"] = ("el cajero automático", "un cajero automático"),
        ["receipt"] = ("el recibo", "un recibo"), ["bill"] = ("la cuenta", "la cuenta"), ["menu"] = ("el menú", "un menú"), ["ice"] = ("el hielo", "hielo"), ["help"] = ("la ayuda", "ayuda"),
    };

    private static readonly Regex NeedOrWant = new(@"^i (?:need|want|would like) (?:a |an |the |some )?(\w+)\W*$", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex WhereIs = new(@"^where (?:is|are) (?:the |a )?(\w+)\W*$", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Plain = new(@"^(?:the |a )?(\w+)\W*$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public MachineTranslation? Translate(string english, string language)
    {
        if (language != "Spanish") return null;
        var q = english.Trim();
        if (WhereIs.Match(q) is { Success: true } w && Nouns.TryGetValue(w.Groups[1].Value.ToLowerInvariant(), out var a)) return new($"¿Dónde está {a.Def}?", "medium");
        if (NeedOrWant.Match(q) is { Success: true } n && Nouns.TryGetValue(n.Groups[1].Value.ToLowerInvariant(), out var b)) return new($"Necesito {b.Indef}, por favor.", "medium");
        if (Plain.Match(q) is { Success: true } p && Nouns.TryGetValue(p.Groups[1].Value.ToLowerInvariant(), out var c)) return new($"{char.ToUpperInvariant(c.Indef[0])}{c.Indef[1..]}, por favor.", "low");
        return null;
    }
}

/// <summary>Stands in for a vision service: a stable reading chosen from the bytes of the photo. It cannot really read an image.</summary>
public sealed class SimImageTextReader : IImageTextReader
{
    public ImageReading Read(byte[] image, string contentType, string language)
    {
        var pick = SHA256.HashData(image)[0] % 5;
        return pick switch
        {
            0 => new("sign", [new("Salida de emergencia", "Emergency exit", 0.93), new("No fumar", "No smoking", 0.9)]),
            1 => new("sign", [new("Prohibido el paso", "No entry", 0.88)]),
            2 => new("menu", [new("Pollo asado", "Grilled chicken", 0.91), new("Sopa de lima", "Lime soup", 0.87), new("Camarones al ajillo", "Garlic shrimp", 0.7)]),
            3 => new("document", []),
            _ => new("unknown", [new("…", "", 0.3)]),
        };
    }
}
