namespace Princess.Api.Domain;

/// <summary>
/// Stanley's chat voice (docs/chat-stanley-plan.md, 3.1): the fixed, tested wording around connection requests. Nothing here calls a model or touches a store. The rules it keeps:
/// a decline stays quiet and kind (nobody is told who said no or why, and the word "rejected" is never used), a block is never revealed (a blocked person sees an ordinary waiting request), and a line never carries
/// a message's text, a link or a phone number. Guest-facing wording never says "AI" (owner decision, 2026-11-10).
/// </summary>
public static class ChatStanleyVoice
{
    public const string Waiting = "No reply yet. Requests stay open for 7 days.";
    public const string Sent = "They'll hear from you now. If they say yes, you can message each other.";
    public const string Expired = "That request wasn't answered in time. You can ask again whenever you like.";
    public const string Cooldown = "You can ask this person again in a few days. In the meantime, someone else on the ship may be glad to hear from you.";
    public const string TooManyOpen = "You have a few requests waiting. Give them a little time, or withdraw one before asking someone new.";
    public const string DailyLimit = "That's a lot of hellos for one day. Please try again tomorrow.";
    public const string AlreadyAsked = "You've already asked this person. They'll see it when they next open the app.";
    public const string Blocked = "That message can't be sent. Please reword it.";

    /// <summary>The line under a request someone received. Public facts only: the short name and the shared sailing. It says the answer is theirs and that nobody is told why.</summary>
    public static string Incoming(string name) => $"{name} is also on your sailing. Say yes if you'd like to chat. If not, \"Not now\" is a quiet answer and they won't be told more.";

    /// <summary>The line for the sender of a declined request. It never says who declined or why, and never says "rejected".</summary>
    public static string Declined(string name) => $"{name} isn't able to chat right now. You can ask someone else on the ship.";

    /// <summary>The line a guest sees on a connection of the given kind (<c>incoming</c>, <c>outgoing</c>, <c>declined</c>), or null when Stanley has nothing to add.</summary>
    public static string? Note(string kind, string name) => kind switch
    {
        "incoming" => Incoming(name),
        "outgoing" => Waiting,
        "declined" => Declined(name),
        _ => null,
    };

    /// <summary>The wording for a request that could not be made, by the problem's title (the error codes do not change). Null when there is no kinder line for it.</summary>
    public static string? ForProblem(string? title) => title switch
    {
        "cooldown" => Cooldown,
        "tooManyOpen" => TooManyOpen,
        "tooMany" => DailyLimit,
        "alreadyAsked" => AlreadyAsked,
        _ => null,
    };

    /// <summary>Every line the app can show, keyed by what it is for, so the screens render wording the server wrote.</summary>
    public static Dictionary<string, string> All() => new()
    {
        ["waiting"] = Waiting,
        ["sent"] = Sent,
        ["expired"] = Expired,
        ["cooldown"] = Cooldown,
        ["tooManyOpen"] = TooManyOpen,
        ["tooMany"] = DailyLimit,
        ["alreadyAsked"] = AlreadyAsked,
        ["blocked"] = Blocked,
    };
}
