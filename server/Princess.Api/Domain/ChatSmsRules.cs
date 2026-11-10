using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>What a text from a guest ashore means.</summary>
public enum SmsCommand { Message, Stop, Help, Back, List }

/// <summary>A parsed inbound text: a command, or a message with the conversation number the guest named (null for "the one I was last texted from").</summary>
public sealed record InboundText(SmsCommand Command, int? Code, string Text);

/// <summary>How many of a guest's texts have gone out today and in the last hour, for the caps.</summary>
public enum SmsSendVerdict { Send, Digest, Skip, Capped }

/// <summary>
/// The text bridge for guests ashore (docs/chat-plan.md, 4.9 and phase 6), pure: parsing a reply, wording each text, the caps, and deciding whether a guest counts as ashore.
/// Nothing here reads a clock, a store or a phone number.
/// </summary>
public static partial class ChatSmsRules
{
    /// <summary>Most texts one guest is sent in a day, across every conversation.</summary>
    public const int DailyCap = 30;
    /// <summary>Most texts one guest is sent from one conversation in an hour; after these, one line says to open the app.</summary>
    public const int HourlyConversationCap = 5;
    /// <summary>Most texts one guest may send in per hour; more are ignored.</summary>
    public const int InboundPerHour = 30;
    /// <summary>A guest with no live app connection for this long counts as ashore, when they chose that.</summary>
    public const int IdleMinutes = 30;
    public const int MaxLine = 300;

    public const string Welcome = "Princess: chat by text is on. People on the ship can reach you here while you are ashore. Texts pass through your phone company. Reply LIST, HELP, BACK or STOP.";
    public const string Help = "Princess chat by text. Reply to answer the last chat. Start with a number to pick one, like \"2 on my way\". LIST shows your chats, BACK says you are on board, STOP turns this off.";
    public const string StopDone = "Chat by text is off. Chat continues in the app. Reply STOP again to stop other Princess texts too.";
    public const string BackDone = "Back on board: chat continues in the app.";
    public const string Blocked = "That message can't be sent. Please reword it.";
    public const string NoChats = "You have no chats open. Open the app to start one.";
    public const string NotThere = "That chat is not open. Reply LIST to see your chats.";
    public const string Closed = "You can't send to that chat any more.";
    public const string NoTarget = "Reply with a chat number first, like \"2 hello\". Reply LIST to see your chats.";

    private static readonly string[] HelpWords = ["help", "?", "info"];

    [GeneratedRegex(@"^\[?(\d{1,2})\]?\s*[:.\-]?\s+(\S.*)$", RegexOptions.Singleline)]
    private static partial Regex Numbered();

    /// <summary>Reads a reply. STOP, HELP, BACK and LIST stand alone; a leading number (optionally in brackets) picks a conversation; anything else is a message.</summary>
    public static InboundText Parse(string? body)
    {
        var text = (body ?? "").Trim();
        var word = text.TrimEnd('.', '!').Trim().ToLowerInvariant();
        if (SmsReplyRules.IsStop(text)) return new(SmsCommand.Stop, null, "");
        if (Array.IndexOf(HelpWords, word) >= 0) return new(SmsCommand.Help, null, "");
        if (word == "back") return new(SmsCommand.Back, null, "");
        if (word == "list") return new(SmsCommand.List, null, "");
        if (Numbered().Match(text) is { Success: true } m && int.TryParse(m.Groups[1].Value, out var code) && code > 0)
            return new(SmsCommand.Message, code, m.Groups[2].Value.Trim());
        return new(SmsCommand.Message, null, text);
    }

    /// <summary>The text a guest gets for a message: "Sam: ..." or "[2] Sam: ..." when they have more than one chat. A photo with no caption says so.</summary>
    public static string Outbound(int? code, string from, string? text, bool photo)
    {
        var body = (text ?? "").Trim();
        var line = body.Length == 0 && photo ? $"{from} sent a photo. Open the app to see it." : $"{from}: {body}";
        if (line.Length > MaxLine) line = line[..(MaxLine - 1)].TrimEnd() + "…";
        return code is { } c ? $"[{c}] {line}" : line;
    }

    /// <summary>The one line that stands in for the rest once a conversation has used its hourly texts.</summary>
    public static string Digest(int? code) => (code is { } c ? $"[{c}] " : "") + "More messages here. Open the app to read them.";

    /// <summary>The numbered list of a guest's chats, for LIST.</summary>
    public static string ListText(IReadOnlyList<(int Code, string Name)> chats) =>
        chats.Count == 0 ? NoChats : "Your chats: " + string.Join(", ", chats.Select(c => $"[{c.Code}] {c.Name}")) + ". Start a reply with a number to pick one.";

    /// <summary>Whether the next text should go out, be replaced by the digest line, be dropped quietly, or be refused for the daily cap.</summary>
    public static SmsSendVerdict Verdict(int sentToday, int sentThisHourFromConversation)
    {
        if (sentToday >= DailyCap) return SmsSendVerdict.Capped;
        if (sentThisHourFromConversation < HourlyConversationCap) return SmsSendVerdict.Send;
        return sentThisHourFromConversation == HourlyConversationCap ? SmsSendVerdict.Digest : SmsSendVerdict.Skip;
    }

    public static bool InboundAllowed(int receivedThisHour) => receivedThisHour < InboundPerHour;

    /// <summary>
    /// Whether the guest counts as ashore. Away From Ship counts when the app is not open (an open app already gets the message); a guest who chose it also counts after
    /// <see cref="IdleMinutes"/> with no live connection. After BACK, neither counts until the guest is next away (or next goes quiet) after that moment.
    /// </summary>
    public static bool IsAshore(bool awayFlow, long? awayAtMs, bool connected, bool idleOn, DateTime? quietSince, DateTime now, DateTime? backAt)
    {
        if (connected) return false;
        var back = backAt is { } b ? new DateTimeOffset(DateTime.SpecifyKind(b, DateTimeKind.Utc)).ToUnixTimeMilliseconds() : (long?)null;
        if (awayFlow && (back is null || awayAtMs is { } at && at > back)) return true;
        if (!idleOn || quietSince is not { } since) return false;
        if (backAt is { } bk && since <= bk) return false;
        return now - since >= TimeSpan.FromMinutes(IdleMinutes);
    }

    /// <summary>The carrier's message id as the idempotency key for a stored message: the same id always gives the same Guid, so a delivery repeated by the provider never doubles.</summary>
    public static Guid KeyFor(string? carrierId, long userId, string body) =>
        new(System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes(string.IsNullOrWhiteSpace(carrierId) ? $"{userId}|{Guid.NewGuid():N}|{body}" : $"{userId}|{carrierId.Trim()}")));

    /// <summary>The 1-based number of a conversation among the guest's open ones, which are numbered by when they were made so a number does not change while they chat.</summary>
    public static int? CodeOf(IReadOnlyList<long> openGroupIdsOrdered, long groupId) =>
        openGroupIdsOrdered.ToList().IndexOf(groupId) is var i and >= 0 ? i + 1 : null;
}
