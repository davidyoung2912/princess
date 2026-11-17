namespace Princess.Api.Domain;

/// <summary>
/// Stanley's own message to the guest when they leave the ship at a port ("have a great time") and when they come back ("welcome back"). It is one friendly notice in the guest's Stanley thread, never a phone alert:
/// the guest is busy ashore, so it waits quietly as a badge. The moment is the same one the "tell my chat" feature uses (<see cref="ChatAwayRules.Transition"/>): going ashore, and returning after an
/// ashore. Nothing is said about where the guest is, only that they have left or are back. The first line is the headline and the rest is the body, as for every notice.
/// </summary>
public static class StanleyAwayRules
{
    /// <summary>The notice kind (it matches no lane list, so it is an ordinary informational card) and the screen it opens.</summary>
    public const string Kind = "awayHello", Path = "/ship/port";

    /// <summary>The words for a change, or null when the change says nothing (a repeat, or a first "back" with no ashore before it).</summary>
    public static string? Text(ChatAwayRules.Change change, string? firstName)
    {
        var name = string.IsNullOrWhiteSpace(firstName) ? "" : $", {firstName.Trim()}";
        return change switch
        {
            ChatAwayRules.Change.Left =>
                $"Have a wonderful time ashore{name}!\n"
                + "Go and make some memories. Wander a little, say yes to the thing you did not plan, and try something local if it smells too good to pass up. "
                + "Keep an eye on the clock, and ask me for the all-aboard time whenever you like. The ship will be right here when you are ready to come home.",
            ChatAwayRules.Change.Returned =>
                $"Welcome back aboard{name}!\n"
                + "I hope it was everything you hoped for. Kick off your shoes, find something cold to drink, and let the day settle. "
                + "If you would like help with dinner, tonight's plans or tomorrow's port, just ask. I am glad you are back.",
            _ => null,
        };
    }

    /// <summary>The thread message. One per change: the key carries the moment, so a retry of the same scan adds nothing and a second trip ashore later in the day is a new message.</summary>
    public static StanleyNotice Notice(ChatAwayRules.Change change, string? firstName, string status, long atMs, DateTime now) =>
        new($"away:{status}:{atMs}", StanleyNoticeRules.Info, Kind, Path, Text(change, firstName) ?? "", null, now.AddHours(12), ChatUrgencyRules.Normal);
}
