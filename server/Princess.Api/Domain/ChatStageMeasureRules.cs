namespace Princess.Api.Domain;

/// <summary>What the chat data shows over a window, as counts only (no person, no text). Each count is documented where the store works it out.</summary>
public sealed record StageCounts(
    int Huddles, int HuddlesShared, int PartyChats, int PartyChatsUsed48h, int ActiveGroups, int ActiveGroupsWithPlan, int GoingAnswers, int GoingOnProgramme,
    int ReminderPairs, int ReminderPairsMuted, int Messages, int Reports, int KeepsChosen, int RecapsStarted, int RecapsShared, int MeetUps, int Introductions, int HostGuests);

/// <summary>One measure of docs/chat-features-research.md section 13.6: a count, what it is out of (if it is a share), the share, and for the mute signal the rollout verdict.</summary>
public sealed record StageMeasure(string Stages, string Name, int Count, int? Of, double? Rate, string? Verdict);

/// <summary>
/// The "Measures" lines of section 13.6, worked out from the chat data as pure rules so the staff view and its tests share one set of numbers. A share with nothing to divide by has no rate, and a measure the data cannot give is listed
/// as unmeasured: neither is ever shown as good news (the same rule as <see cref="ChatRolloutRules"/>). Nothing here names a guest.
/// </summary>
public static class ChatStageMeasureRules
{
    /// <summary>The measures 13.6 asks for that no table can answer yet, so the view says so instead of showing a zero.</summary>
    public static readonly string[] Unmeasured =
    [
        "lateReturnRate", "timeToMusterConfirmed", "documentsBeforeDue", "changeCardToActionTime", "rsvpToAttendance", "lostItemCasesFromChat", "marketingDuringOpenCase", "billDetailInSharedThread", "bagNightCompletion", "feedbackCompleted",
    ];

    private static double? Share(int part, int whole) => whole <= 0 ? null : Math.Round((double)part / whole, 4);

    /// <summary>The measures in stage order. The reminder mute share carries the rollout verdict (10% rewrite, 20% pause) once there are enough people to judge by.</summary>
    public static List<StageMeasure> Measures(StageCounts c)
    {
        var mutedShare = Share(c.ReminderPairsMuted, c.ReminderPairs);
        string? mutedVerdict = c.ReminderPairs < ChatRolloutRules.MinGuests ? ChatRolloutRules.NotEnough : mutedShare > 0.20 ? ChatRolloutRules.Pause : mutedShare > 0.10 ? ChatRolloutRules.Rewrite : ChatRolloutRules.Ok;
        return
        [
            new("1-2", "huddlesWithSharedShortlist", c.HuddlesShared, c.Huddles, Share(c.HuddlesShared, c.Huddles), null),
            new("3", "partyChatUsedWithin48Hours", c.PartyChatsUsed48h, c.PartyChats, Share(c.PartyChatsUsed48h, c.PartyChats), null),
            new("4", "remindedAndMuted", c.ReminderPairsMuted, c.ReminderPairs, mutedShare, mutedVerdict),
            new("5,8", "groupsWithAPlanOrPoll", c.ActiveGroupsWithPlan, c.ActiveGroups, Share(c.ActiveGroupsWithPlan, c.ActiveGroups), null),
            new("5,8", "goingAnswersOnProgramme", c.GoingOnProgramme, c.GoingAnswers, Share(c.GoingOnProgramme, c.GoingAnswers), null),
            new("8", "meetUpsStarted", c.MeetUps, null, null, null),
            new("8", "introductionsMade", c.Introductions, null, null, null),
            new("8", "guestsInHostRoles", c.HostGuests, null, null, null),
            new("10,11", "chatsKept", c.KeepsChosen, null, null, null),
            new("11", "recapsShared", c.RecapsShared, c.RecapsStarted, Share(c.RecapsShared, c.RecapsStarted), null),
            new("all", "reportsPer1000Messages", c.Reports, c.Messages, c.Messages <= 0 ? null : Math.Round(1000.0 * c.Reports / c.Messages, 2), null),
        ];
    }
}
