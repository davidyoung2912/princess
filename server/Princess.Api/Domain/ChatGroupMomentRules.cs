namespace Princess.Api.Domain;

/// <summary>
/// The pure rules of a shared Stanley card (docs/chat-features-research.md, 7.4, phase 7b): a suggestion that, once the group's admin confirms, is posted to a group. Stanley never posts to a group on his
/// own. The card goes to an admin first; on their tap the poll appears under their own name, after a line that says whose request it was. A group that has not switched Stanley on, a group with a
/// supervised child in it, and a group that already has a poll or plan are never offered one.
/// </summary>
public static class ChatGroupMomentRules
{
    public const string GroupPollKey = "manage.group-poll", GroupMeetKey = "sea.group-meet", GroupLunchKey = "port.group-lunch";

    /// <summary>Whether a card key is one an admin can post to the group (the poll, the meeting place, the port day for lunch).</summary>
    public static bool IsSharedKey(string? key) => key is GroupPollKey or GroupMeetKey or GroupLunchKey;

    /// <summary>How many of a plan's people say Going before Stanley offers a meeting place, and before he offers the port day for lunch.</summary>
    public const int MeetGoing = 3, LunchGoing = 2;

    /// <summary>A shared offer needs a real group: three or more people, as the group rules say.</summary>
    public const int MinMembers = 3;

    public const string PollQuestion = "What should we do together?";
    public static readonly string[] PollOptions = ["Dinner together", "An excursion", "A show", "Something relaxed"];

    /// <summary>The refusal codes of <see cref="Refusal"/>.</summary>
    public const string NotAdmin = "notAdmin", Off = "off", Child = "child", NotGroup = "notGroup", Already = "already";

    /// <summary>Whether to offer the poll card for this group: an admin, Stanley on, three or more active members, no supervised child, and no poll or plan yet.</summary>
    public static bool Offer(bool isAdmin, bool groupOn, int activeMembers, bool childActive, bool hasPlanning) =>
        Refusal(isAdmin, groupOn, true, childActive, hasPlanning) is null && activeMembers >= MinMembers;

    /// <summary>Why a shared card may not be posted, or null when it may. The checks are repeated when the admin taps, because a lot can change between the card and the tap.</summary>
    public static string? Refusal(bool isAdmin, bool groupOn, bool isGroup, bool childActive, bool hasPlanning)
    {
        if (!isGroup) return NotGroup;
        if (!isAdmin) return NotAdmin;
        if (!groupOn) return Off;
        if (childActive) return Child;
        if (hasPlanning) return Already;
        return null;
    }

    /// <summary>The line above a shared card: it names the admin by first name and last initial, never "Stanley says".</summary>
    public static string ShareLine(string who) => $"{who} asked Stanley to share this";

    /// <summary>The card for the admin's own thread: it opens the group, and the guest chooses whether to post.</summary>
    public static string OfferText => "Make a poll for what your group wants to do?\nI can post it to the group for you, and you stay in charge of it.";

    public const string MeetOfferText = "Post a meet-me-here card for your group?\nA plan has enough people going. I can post the place for you, and you stay in charge of it.";
    public const string LunchOfferText = "Share the port day with your group?\nEveryone can see the port, the times and when to be back. I can post it for you.";

    /// <summary>A plan on a day, as the rules see it: its card and how many said Going.</summary>
    public sealed record DayPlan(ChatCard Card, int Going);

    /// <summary>The plan to offer a meeting place for: on <paramref name="day"/>, at least <see cref="MeetGoing"/> going and a place the ship profile names (matched by name). The best-supported one wins; null when none.</summary>
    public static (string PlaceId, string Title)? Gathering(IEnumerable<DayPlan> plans, int day, IEnumerable<(string Id, string Name)> shipPlaces)
    {
        var places = shipPlaces.ToList();
        foreach (var p in plans.Where(p => p.Card.Day == day && p.Going >= MeetGoing).OrderByDescending(p => p.Going).ThenBy(p => p.Card.Title, StringComparer.Ordinal))
        {
            if (p.Card.Place is null) continue;
            var hit = places.FindIndex(x => x.Name == p.Card.Place);
            if (hit >= 0) return (places[hit].Id, p.Card.Title);
        }
        return null;
    }

    /// <summary>Whether the group has a plan on <paramref name="day"/> with at least <see cref="LunchGoing"/> going.</summary>
    public static bool HasDayPlan(IEnumerable<DayPlan> plans, int day) => plans.Any(p => p.Card.Day == day && p.Going >= LunchGoing);

    /// <summary>Ship time from which "share the port day" is offered: midday.</summary>
    public const int LunchFromHour = 12;

    public static string GroupPath(Guid groupPublicId) => $"/chat?c={groupPublicId}";
}
