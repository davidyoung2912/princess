using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-features-research.md, phase 11: the group coordinator. Tallies in counts, compromises from public options, reminders that never nag or name anyone.</summary>
public class ChatCoordinatorRulesTests
{
    private static readonly DateTime Sent = new(2026, 11, 10, 9, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Now = Sent.AddHours(13);
    private static readonly HashSet<long> None = [];

    private static readonly ChatPoll Poll = new("What should we do together?", ["Dinner together", "An excursion", "A show"]);

    // ---- Counts ----

    [Fact]
    public void AnswersAreCountedAmongActiveMembersOnly()
    {
        var p = ChatCoordinatorRules.CountAnswers([1, 2, 3, 4, 5], [1, 2, 3, 9, 3]);   // 9 left the group; 3 answered twice
        Assert.Equal(new ChatCoordinatorRules.Progress(3, 5), p);
    }

    [Fact]
    public void TheUnansweredAreFoundByIdAndOnlyAmongTheActive() =>
        Assert.Equal(new long[] { 4, 5 }, ChatCoordinatorRules.Unanswered([1, 2, 4, 5], [1, 2, 9]));

    [Theory]
    [InlineData(3, 5, "3 of 5 have answered.")]
    [InlineData(0, 1, "0 of 1 has answered.")]
    public void TheStatusIsCounts(int answered, int total, string expected) => Assert.Equal(expected, ChatCoordinatorRules.Answered(new(answered, total)));

    [Fact]
    public void ClosingIsSaidInWordsNeedingNoClock()
    {
        var closes = ChatPlanningRules.ClosesAt(Sent);
        Assert.Equal("Closes in about 11 hours.", ChatCoordinatorRules.ClosesPhrase(false, closes, Now));
        Assert.Equal("Closes within the hour.", ChatCoordinatorRules.ClosesPhrase(false, closes, closes.AddMinutes(-20)));
        Assert.Equal("The poll is closed.", ChatCoordinatorRules.ClosesPhrase(true, closes, Now));
    }

    // ---- Compromise ----

    [Fact]
    public void NoVotesMeansNoCompromise() => Assert.Null(ChatCoordinatorRules.Compromise(Poll.Options, [0, 0, 0]));

    [Fact]
    public void AClearLeaderMeansNoCompromise() => Assert.Null(ChatCoordinatorRules.Compromise(Poll.Options, [4, 1, 0]));

    [Fact]
    public void TwoLevelOptionsAreSuggestedTogether() =>
        Assert.Equal("Dinner together and A show are level. Could the group do both?", ChatCoordinatorRules.Compromise(Poll.Options, [2, 0, 2]));

    [Fact]
    public void ThreeLevelOptionsAreListed() =>
        Assert.Equal("Dinner together, An excursion and A show are level. Could the group fit more than one in?", ChatCoordinatorRules.Compromise(Poll.Options, [1, 1, 1]));

    [Fact]
    public void ASingleVoteLeadIsASuggestionToDoBoth() =>
        Assert.Equal("Dinner together is just ahead of A show. Could the group do both?", ChatCoordinatorRules.Compromise(Poll.Options, [3, 0, 2]));

    [Fact]
    public void ACompromiseNeverNamesAPerson()
    {
        // The only words that can appear are the poll's own options and fixed phrases: there is no name argument to leak.
        var text = ChatCoordinatorRules.Compromise(Poll.Options, [2, 2, 0])!;
        Assert.DoesNotContain("Sam", text);
        Assert.All(text.Split(' '), w => Assert.False(w.Length > 0 && char.IsDigit(w[0])));
    }

    [Fact]
    public void APlanLeaningAgainstItGetsAGentleSuggestion()
    {
        Assert.Contains("different time", ChatCoordinatorRules.PlanCompromise(1, 0, 3));
        Assert.Contains("Nobody is sure", ChatCoordinatorRules.PlanCompromise(0, 2, 0));
        Assert.Null(ChatCoordinatorRules.PlanCompromise(3, 1, 1));
        Assert.Null(ChatCoordinatorRules.PlanCompromise(0, 0, 1));
    }

    // ---- The shared tally ----

    [Fact]
    public void ThePollTallyIsCountsAndPublicWordsOnly()
    {
        var text = ChatCoordinatorRules.PollTally(Poll, [2, 0, 2], new(4, 5), false, ChatPlanningRules.ClosesAt(Sent), Now)!;
        Assert.Contains("Poll: What should we do together?", text);
        Assert.Contains("4 of 5 have answered.", text);
        Assert.Contains("Dinner together 2, An excursion 0, A show 2", text);
        Assert.Contains("are level", text);
        Assert.True(text.Length <= ChatCoordinatorRules.MaxTally);
    }

    [Fact]
    public void ATallyThatBreaksTheWordFilterIsNotPosted()
    {
        var rude = new ChatPoll("Who is a shit?", ["a", "b"]);
        Assert.Null(ChatCoordinatorRules.PollTally(rude, [1, 1], new(2, 3), false, ChatPlanningRules.ClosesAt(Sent), Now));
    }

    [Fact]
    public void ThePlanTallyIsCounts()
    {
        var text = ChatCoordinatorRules.PlanTally("Trivia", 3, 1, 1, new(5, 6))!;
        Assert.Contains("Plan: Trivia", text);
        Assert.Contains("3 going, 1 maybe, 1 cannot go.", text);
    }

    // ---- Reminders ----

    [Fact]
    public void ARemindersWaitsForHalfOfThePollsTime()
    {
        Assert.Equal(Sent.AddHours(12), ChatCoordinatorRules.RemindFrom(Sent));
        Assert.Equal(ChatCoordinatorRules.TooSoon, ChatCoordinatorRules.ReminderRefusal(false, Sent, Sent.AddHours(11)));
        Assert.Null(ChatCoordinatorRules.ReminderRefusal(false, Sent, Sent.AddHours(12)));
    }

    [Fact]
    public void AClosedPollIsNeverReminded() => Assert.Equal(ChatCoordinatorRules.Closed, ChatCoordinatorRules.ReminderRefusal(true, Sent, Now));

    [Fact]
    public void ARecipientIsSomeoneWhoHasNotAnsweredAndHasNotAskedToBeLeftAlone()
    {
        var last = new Dictionary<long, DateTime>();
        var got = ChatCoordinatorRules.Recipients([1, 2, 3, 4, 5, 6], askerId: 1, supervised: new HashSet<long> { 6 }, muted: new HashSet<long> { 3 }, blocked: new HashSet<long> { 4 }, last, Now);
        Assert.Equal(new long[] { 2, 5 }, got);   // not the asker (1), the muted (3), the blocked (4) or the child (6)
    }

    [Fact]
    public void NobodyIsRemindedTwiceInThreeDays()
    {
        var last = new Dictionary<long, DateTime> { [2] = Now.AddDays(-2), [3] = Now.AddDays(-3), [4] = Now.AddDays(-10) };
        Assert.Equal(new long[] { 3, 4, 5 }, ChatCoordinatorRules.Recipients([2, 3, 4, 5], 1, None, None, None, last, Now));
    }

    [Fact]
    public void TheReminderNamesTheOrganiserAndSaysNothingElse()
    {
        var poll = ChatCoordinatorRules.ReminderText("Alex R.", true);
        Assert.Equal("Alex R. asked Stanley to remind you: a poll in your group chat is waiting for your answer.", poll);
        Assert.Contains("plan", ChatCoordinatorRules.ReminderText("Alex R.", false));
        // No question, option, time, place, price or other person's name can be in it: the only inputs are the organiser and the kind.
        Assert.DoesNotContain("$", poll);
        Assert.DoesNotContain("Dinner", poll);
    }

    [Fact]
    public void TheOrganiserIsToldACountNeverNames()
    {
        Assert.Equal("Nobody needed a reminder.", ChatCoordinatorRules.RemindedLine(0));
        Assert.Equal("Reminded 1 person.", ChatCoordinatorRules.RemindedLine(1));
        Assert.Equal("Reminded 3 people.", ChatCoordinatorRules.RemindedLine(3));
    }

    // ---- What remains ----

    [Fact]
    public void WhatRemainsCountsOnlyOpenItemsThatStillWaitForSomeone()
    {
        var (waiting, outstanding) = ChatCoordinatorRules.Remaining([
            new(true, new(3, 5)),    // waiting, 2 missing
            new(true, new(5, 5)),    // everyone answered
            new(false, new(1, 5)),   // closed
            new(true, new(0, 5))]);  // waiting, 5 missing
        Assert.Equal(2, waiting);
        Assert.Equal(7, outstanding);
    }

    // ---- The group gates (shared with the other shared cards) ----

    [Fact]
    public void TheSameGatesAsOtherSharedCardsApply()
    {
        Assert.Equal(ChatGroupMomentRules.NotAdmin, ChatGroupMomentRules.Refusal(false, true, true, false, false));
        Assert.Equal(ChatGroupMomentRules.Off, ChatGroupMomentRules.Refusal(true, false, true, false, false));
        Assert.Equal(ChatGroupMomentRules.Child, ChatGroupMomentRules.Refusal(true, true, true, true, false));
        Assert.Equal(ChatGroupMomentRules.NotGroup, ChatGroupMomentRules.Refusal(true, true, false, false, false));
        Assert.Null(ChatGroupMomentRules.Refusal(true, true, true, false, false));
    }
}
