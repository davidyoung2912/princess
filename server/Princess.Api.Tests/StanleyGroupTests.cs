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
        Assert.Equal(2, StanleyGroupRules.NotChecked.Length);
    }
}
