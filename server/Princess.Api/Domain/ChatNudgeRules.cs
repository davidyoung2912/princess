using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>
/// "Ask Stanley about this message" (docs/chat-stanley-plan.md, 3.6 and phase 4). Pure pattern checks over one message a guest chose: money, gift cards, a phone number, a move off the app and pressure.
/// No model is used, so nothing in a message can steer Stanley: he only names what the words ask for and offers fixed, polite replies. Nothing here touches a store or a clock, and nothing is stored or logged.
/// </summary>
public static partial class ChatNudgeRules
{
    public const string Money = "money", GiftCard = "giftCard", Phone = "phone", OffApp = "offApp", Pressure = "pressure";

    /// <summary>The order the flags are listed in.</summary>
    public static readonly string[] Order = [Money, GiftCard, Phone, OffApp, Pressure];

    [GeneratedRegex(@"\b(send|lend|loan|transfer|wire|pay|owe|venmo|paypal|zelle|cash ?app|bank|bitcoin|crypto|western union|donat\w*)\b.{0,40}\b(money|cash|funds|payment|fee|deposit|dollars?|euros?)\b|[\$€£]\s?\d|\b\d[\d,.]*\s?(usd|dollars?|euros?|bucks)\b|\b(money|cash)\b.{0,30}\b(send|lend|loan|transfer|wire)\b|\b(venmo|paypal|zelle|cash ?app|bitcoin|western union)\b", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex MoneyPattern();

    [GeneratedRegex(@"\b(gift ?cards?|itunes|google play|steam card|prepaid card|vanilla card|amazon card)\b", RegexOptions.IgnoreCase)]
    private static partial Regex GiftCardPattern();

    [GeneratedRegex(@"\+?\d[\d\s().-]{6,}\d")]
    private static partial Regex PhonePattern();

    [GeneratedRegex(@"\b(whats ?app|telegram|snap ?chat|instagram|insta|facebook|messenger|wechat|viber|kik|text me|call me|email me|e-?mail me|dm me|message me on|talk (?:on|over)|continue (?:on|over)|move (?:this )?(?:to|off)|off (?:the )?app|outside (?:the )?app)\b|https?://|www\.", RegexOptions.IgnoreCase)]
    private static partial Regex OffAppPattern();

    [GeneratedRegex(@"\b(urgent(?:ly)?|right now|immediately|asap|act now|hurry|last chance|only today|don'?t tell|do not tell|keep (?:this|it) (?:a )?secret|between us|you must|you have to|or else|before it'?s too late|limited time|emergency)\b", RegexOptions.IgnoreCase)]
    private static partial Regex PressurePattern();

    /// <summary>The kinds of thing a message asks for, in <see cref="Order"/>. Empty for an ordinary message or blank text.</summary>
    public static List<string> Check(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return [];
        var found = new HashSet<string>();
        if (MoneyPattern().IsMatch(text)) found.Add(Money);
        if (GiftCardPattern().IsMatch(text)) found.Add(GiftCard);
        if (PhonePattern().IsMatch(text)) found.Add(Phone);
        if (OffAppPattern().IsMatch(text)) found.Add(OffApp);
        if (PressurePattern().IsMatch(text)) found.Add(Pressure);
        return [.. Order.Where(found.Contains)];
    }

    /// <summary>What Stanley says about one kind of request, in plain words.</summary>
    public static string Explain(string flag) => flag switch
    {
        Money => "This message talks about money. You never have to send money to someone you met on the ship, and you can say no.",
        GiftCard => "This message mentions gift cards. Asking for gift cards is a common scam, because they are hard to get back.",
        Phone => "This message has a phone number. You don't have to share yours or call anyone.",
        OffApp => "This message asks you to move to another app or a link. Staying in this chat keeps you protected: you can report and block here.",
        Pressure => "This message tries to hurry you or keep a secret. A real friend will wait while you think.",
        _ => "",
    };

    /// <summary>Whether it is worth a warning at all: money, gift cards and pressure are, a number or a new app on its own is only mentioned.</summary>
    public static bool Looks(IReadOnlyCollection<string> flags) => flags.Contains(Money) || flags.Contains(GiftCard) || flags.Count >= 2;

    /// <summary>The line above the explanation. It never says the sender is a scammer: the guest decides.</summary>
    public static string Headline(IReadOnlyCollection<string> flags) =>
        flags.Count == 0 ? "I don't see anything worrying in this message."
        : Looks(flags) ? "Heads up: a few things in this message are worth a second look."
        : "One thing in this message is worth knowing.";

    /// <summary>Up to three polite replies the guest may use. Fixed words, no names, no facts. They are offered even for an ordinary message (a gentle way to say no).</summary>
    public static List<string> Replies(IReadOnlyCollection<string> flags)
    {
        var replies = new List<string>();
        if (flags.Contains(Money) || flags.Contains(GiftCard)) replies.Add("Sorry, I'm not able to help with money or gift cards. I hope you understand.");
        if (flags.Contains(Phone) || flags.Contains(OffApp)) replies.Add("I'd rather keep chatting here in the app, thanks.");
        if (flags.Contains(Pressure)) replies.Add("I'll need some time to think about it, so please don't rush me.");
        replies.Add("Thanks for the message, but I'm going to pass.");
        replies.Add("I'm busy at the moment. Maybe another time!");
        return [.. replies.Distinct().Take(3)];
    }

    /// <summary>The words Stanley adds when nothing is wrong, so a quiet answer is still an answer.</summary>
    public const string Calm = "You can still say no politely, or report or block anyone at any time.";

    /// <summary>
    /// Whether Stanley may look at a message: another person's ordinary message of normal urgency. Never the guest's own, never a supervised child's, and never an important or urgent message
    /// (those come only from staff or a guardian, and are shown as they are, never explained away).
    /// </summary>
    public static string? Refusal(bool own, bool fromSupervised, string urgency) =>
        own ? "notMessage" : fromSupervised ? "child" : urgency != ChatUrgencyRules.Normal ? "urgent" : null;
}
