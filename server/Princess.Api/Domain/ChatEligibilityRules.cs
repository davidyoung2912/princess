namespace Princess.Api.Domain;

/// <summary>What chat a guest may use now, worked out on the server from the journey stage and whether they have a confirmed booking (docs/chat-features-research.md, 6.1 and 6.2).</summary>
/// <param name="Stage">The journey stage the answer is for.</param>
/// <param name="Stanley">The permanent Stanley chat: every account, every stage.</param>
/// <param name="Party">The travel party chat: from the moment a booking is confirmed.</param>
/// <param name="People">Asking another guest on the sailing to chat (and so making a group): once a booking is confirmed.</param>
/// <param name="GuestServices">Guest Services chat (booking help, travel problems): from a confirmed booking, so before boarding as well as aboard.</param>
/// <param name="Keep">"Keep this chat" can be offered: the guest has a booking to count the deletion date from.</param>
/// <param name="Reason">When something is off, why, in words the screen can show; null when everything the stage allows is on.</param>
public sealed record ChatEligibility(string Stage, bool Stanley, bool Party, bool People, bool GuestServices, bool Keep, string? Reason);

/// <summary>
/// Who may chat with whom at each of the eleven stages. Pure: the guest's stage and booking go in, the answer comes out, so the screen never decides who may talk to whom.
/// The permanent Stanley chat is not subject to this. A guest keeps reading and answering the chats they already have at any stage; this only governs starting new ones.
/// </summary>
public static class ChatEligibilityRules
{
    /// <summary>Why a guest before a confirmed booking has only Stanley. A stable code the front end turns into words, so the words are in one place.</summary>
    public const string BeforeBooking = "beforeBooking";

    public static ChatEligibility For(string stage, bool hasConfirmedBooking)
    {
        var known = StageRules.All.Contains(stage) ? stage : StageRules.Dream;
        // Dream, Discover and Book have no people to talk to yet. A guest who has a confirmed booking (an earlier cruise, or one made on another device)
        // is a booked guest whatever their journey is now showing, so the booking decides, not the stage name.
        if (!hasConfirmedBooking) return new(known, Stanley: true, Party: false, People: false, GuestServices: false, Keep: false, BeforeBooking);
        return new(known, Stanley: true, Party: true, People: true, GuestServices: true, Keep: true, null);
    }

    /// <summary>Whether the guest may ask another guest to chat.</summary>
    public static bool MayAsk(string stage, bool hasConfirmedBooking) => For(stage, hasConfirmedBooking).People;
}
