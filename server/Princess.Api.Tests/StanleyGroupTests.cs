using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Group, voice and shared briefs (phase P11): the shared daily digest (VAL-07) and guardian copies (reminders R8). Pure rules.</summary>
public class StanleyGroupTests
{
    private static ChatGroupMomentRules.DayPlan Plan(int day, string title, string? time, string? place, int going) => new(new ChatCard(ChatCardRules.Plan, title, null, day, time, place), going);

    [Fact]
    public void TheDigestListsTodaysPlansInTimeOrderWithTheirPlace()
    {
        var text = ChatGroupMomentRules.Digest([Plan(3, "Trivia", "15:00", "The Piazza", 2), Plan(3, "Breakfast", "08:30", null, 1), Plan(4, "Elsewhere", "09:00", null, 5)], 3);
        Assert.Equal("Today's plan for the group:\n- 08:30 Breakfast\n- 15:00 Trivia at The Piazza", text);
    }

    [Fact]
    public void TheDigestSaysNothingWhenNobodyIsGoingOrNothingIsPlanned()
    {
        Assert.Null(ChatGroupMomentRules.Digest([], 3));
        Assert.Null(ChatGroupMomentRules.Digest([Plan(3, "Trivia", "15:00", null, 0)], 3));
        Assert.Null(ChatGroupMomentRules.Digest([Plan(2, "Trivia", "15:00", null, 4)], 3));
    }

    [Fact]
    public void TheDigestIsCappedAtSixPlans() =>
        Assert.Equal(ChatGroupMomentRules.DigestMax + 1, ChatGroupMomentRules.Digest(Enumerable.Range(0, 9).Select(i => Plan(3, $"P{i}", $"{8 + i:00}:00", null, 1)), 3)!.Split('\n').Length);

    [Fact]
    public void TheDigestIsASharedCardOfferedOnlyInTheMorningOfAnOnboardDay()
    {
        var g = Guid.NewGuid();
        var now = new DateTime(2027, 3, 22, 9, 0, 0, DateTimeKind.Utc);
        Assert.True(ChatGroupMomentRules.IsSharedKey(ChatGroupMomentRules.GroupDigestKey));
        foreach (var stage in new[] { StageRules.Sea, StageRules.Port })
        {
            var offer = Assert.Single(ChatProactiveRules.AboardToDisembark(new(now, stage, 0, false, null, DigestGroup: g, CruiseDay: 3, ShipHour: 9)), c => c.Key == ChatGroupMomentRules.GroupDigestKey);
            Assert.Equal(g.ToString(), offer.Subject);
            Assert.DoesNotContain(ChatProactiveRules.AboardToDisembark(new(now, stage, 0, false, null, DigestGroup: g, CruiseDay: 3, ShipHour: 5)), c => c.Key == ChatGroupMomentRules.GroupDigestKey);
            Assert.DoesNotContain(ChatProactiveRules.AboardToDisembark(new(now, stage, 0, false, null, DigestGroup: g, CruiseDay: 3, ShipHour: 12)), c => c.Key == ChatGroupMomentRules.GroupDigestKey);
        }
        Assert.DoesNotContain(ChatProactiveRules.AboardToDisembark(new(now, StageRules.Embark, 0, false, null, DigestGroup: g, ShipHour: 9)), c => c.Key == ChatGroupMomentRules.GroupDigestKey);
        Assert.DoesNotContain(ChatGroupMomentRules.DigestOfferText, c => char.IsDigit(c));
    }

    [Fact]
    public void TheDigestRefusalsAreTheSharedOnes()
    {
        Assert.Equal(ChatGroupMomentRules.NotAdmin, ChatGroupMomentRules.Refusal(false, true, true, false, false));
        Assert.Equal(ChatGroupMomentRules.Off, ChatGroupMomentRules.Refusal(true, false, true, false, false));
        Assert.Equal(ChatGroupMomentRules.Child, ChatGroupMomentRules.Refusal(true, true, true, true, false));
        Assert.Null(ChatGroupMomentRules.Refusal(true, true, true, false, false));
    }

    [Fact]
    public void NoTimelineMeansNoGuardianCopies()
    {
        var now = new DateTime(2027, 3, 22, 9, 0, 0, DateTimeKind.Utc);
        var facts = new CheckupFacts(DateOnly.FromDateTime(now), now, new(2027, 3, 20), 7, null!, "paid", null, "open", TripRules.CheckinOpensAt(new(2027, 3, 20)), TripRules.CheckinClosesAt(new(2027, 3, 20)), false, [], [], []);
        Assert.Empty(StanleyGroupRules.GuardianCandidates(facts, [(Guid.NewGuid(), "Sam")]));
        Assert.StartsWith("grp:", StanleyGroupRules.Marker);
        Assert.Single(StanleyGroupRules.NotChecked);
    }

    [Fact]
    public void AHelperIsCopiedOnlyOnTheReminderKindsThatKeepTheGuestOnTime()
    {
        Assert.True(StanleyGroupRules.HelperCopy("allAboard", "allAboard", false));
        Assert.True(StanleyGroupRules.HelperCopy("guardian", "grp:aboard:x:2027-03-22", false));
        Assert.True(StanleyGroupRules.HelperCopy("auto", "aut02:aboard:2027-03-22", false));
        Assert.True(StanleyGroupRules.HelperCopy("auto", "aut02:exit:2027-03-27", false));
        Assert.True(StanleyGroupRules.HelperCopy("auto", "aut02:bags:2027-03-27", false));
        Assert.False(StanleyGroupRules.HelperCopy("auto", "aut02:pay7:2027-01-20", false));
        Assert.False(StanleyGroupRules.HelperCopy("auto", "aut02:portpack:2027-03-21", false));
        Assert.False(StanleyGroupRules.HelperCopy("plan", "evening-show", false));
        Assert.False(StanleyGroupRules.HelperCopy(null, null, false));
    }

    [Fact]
    public void APrivateReminderIsNeverCopiedToAHelper()
    {
        Assert.False(StanleyGroupRules.HelperCopy("allAboard", "allAboard", true));
        Assert.False(StanleyGroupRules.HelperCopy("guardian", "grp:aboard:x:2027-03-22", true));
    }

    [Fact]
    public void ACopyNamesTheGuestByFirstNameAndStaysShort()
    {
        Assert.Equal("Rosa: All aboard in Cozumel is in an hour.", StanleyGroupRules.HelperText("Rosa", "All aboard in Cozumel is in an hour."));
        Assert.True(StanleyGroupRules.HelperText("Rosa", new string('x', 200)).Length <= StanleyReminderRules.TextMax);
    }

    [Fact]
    public void TheHelperChoiceIsOffUntilTheGuestSwitchesItOnAndReadsBack()
    {
        Assert.False(StanleyGroupRules.ParseChoice(null).On);
        Assert.False(StanleyGroupRules.ParseChoice("not json").On);
        var at = new DateTime(2027, 3, 1, 8, 0, 0, DateTimeKind.Utc);
        var on = StanleyGroupRules.ParseChoice(StanleyGroupRules.ChoiceJson(true, at));
        Assert.True(on.On);
        Assert.Equal(at, on.At);
        Assert.False(StanleyGroupRules.ParseChoice(StanleyGroupRules.ChoiceJson(false, at)).On);
    }

    [Fact]
    public void AMeetingReminderIsBeforeThePlansTimeInTheShipZone()
    {
        var date = new DateOnly(2027, 3, 22);
        var thirty = StanleyGroupRules.MeetingDue(date, "15:00", 30, "UTC")!.Value;
        var none = StanleyGroupRules.MeetingDue(date, "15:00", 0, "UTC")!.Value;
        Assert.Equal(TimeSpan.FromMinutes(30), none - thirty);
        Assert.Equal(new DateTime(2027, 3, 22, 15, 0, 0), none);
        Assert.Null(StanleyGroupRules.MeetingDue(date, "3pm", 30, "UTC"));
        Assert.Null(StanleyGroupRules.MeetingDue(date, null, 30, "UTC"));
    }

    [Fact]
    public void AMeetingReminderSaysTheTitleAndHowSoon()
    {
        Assert.Equal("Trivia starts in 30 minutes.", StanleyGroupRules.MeetingText("Trivia", 30));
        Assert.Equal("Trivia starts in 1 hour.", StanleyGroupRules.MeetingText("Trivia", 60));
        Assert.Equal("Trivia is starting now.", StanleyGroupRules.MeetingText("Trivia", 0));
    }
}
