using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>
/// Card details are never sent to a model and never kept (AI-SEC-06). A card number (13 to 19 digits, which may be grouped by spaces or dashes) and the code beside the words
/// CVV, CVC or security code are replaced before a message becomes part of a prompt. The same two patterns are on the device (<c>src/ai/cardData.ts</c>). Payment itself never
/// goes through Stanley; this only keeps a number a guest pastes by mistake out of every prompt and log.
/// </summary>
public static partial class CardData
{
    public const string NumberMask = "[card number removed]";
    public const string CodeMask = "[code removed]";

    [GeneratedRegex(@"(?<![\d])(?:\d[ -]?){12,18}\d(?![\d])")]
    private static partial Regex Number();

    [GeneratedRegex(@"\b(cvv2?|cvc2?|csc|security code|card verification (?:value|code|number))\b([^\d\r\n]{0,12})\d{3,4}(?!\d)", RegexOptions.IgnoreCase)]
    private static partial Regex Code();

    public static bool Contains(string? text) => !string.IsNullOrEmpty(text) && (Number().IsMatch(text) || Code().IsMatch(text));

    public static string Redact(string text) => Code().Replace(Number().Replace(text, NumberMask), m => $"{m.Groups[1].Value}{m.Groups[2].Value}{CodeMask}");
}
