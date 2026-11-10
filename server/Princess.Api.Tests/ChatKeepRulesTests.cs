using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-features-research.md, 8.5 and phase 5: keeping a chat past 30 days.</summary>
public class ChatKeepRulesTests
{
    private static readonly DateOnly Ends = new(2027, 3, 20);

    [Fact]
    public void TheStandardDateIs30DaysAndAKeptDateIs12MonthsAfterTheCruise()
    {
        Assert.Equal(new DateOnly(2027, 4, 19), ChatKeepRules.StandardDeleteOn(Ends));
        Assert.Equal(new DateOnly(2028, 3, 20), ChatKeepRules.KeptDeleteOn(Ends));
    }

    [Fact]
    public void AChatIsKeptOnlyWhenEveryActiveMemberAgreed()
    {
        long[] members = [1, 2, 3];
        Assert.True(ChatKeepRules.IsKept(members, new HashSet<long> { 1, 2, 3 }));
        Assert.False(ChatKeepRules.IsKept(members, new HashSet<long> { 1, 2 }));
        Assert.False(ChatKeepRules.IsKept([], new HashSet<long>()));
        Assert.Equal([3L], ChatKeepRules.Missing(members, new HashSet<long> { 1, 2 }));
    }

    [Fact]
    public void ANewMemberEndsTheKeepUntilTheyAgreeAndALeaverStopsCounting()
    {
        var agreed = new HashSet<long> { 1, 2 };
        Assert.True(ChatKeepRules.IsKept([1, 2], agreed));
        Assert.False(ChatKeepRules.IsKept([1, 2, 4], agreed));   // joined later
        Assert.True(ChatKeepRules.IsKept([1, 2], new HashSet<long> { 1, 2, 3 }));   // 3 left; their agreement is ignored
    }

    [Fact]
    public void ASupervisedChildNeverAgreesForThemself() => Assert.False(ChatKeepRules.MayAgreeOwn(true));

    [Fact]
    public void AnAdultAgreesForThemself() => Assert.True(ChatKeepRules.MayAgreeOwn(false));

    [Fact]
    public void WhyAChatCannotBeKept()
    {
        var today = new DateOnly(2027, 3, 25);
        Assert.Equal(ChatKeepRules.Permanent, ChatKeepRules.Unavailable(true, false, Ends, today));
        Assert.Equal(ChatKeepRules.Closed, ChatKeepRules.Unavailable(false, true, Ends, today));
        Assert.Equal(ChatKeepRules.NoTrip, ChatKeepRules.Unavailable(false, false, null, today));
        Assert.Null(ChatKeepRules.Unavailable(false, false, Ends, today));
        Assert.Null(ChatKeepRules.Unavailable(false, false, Ends, new DateOnly(2027, 4, 18)));   // the last day before the messages go
        Assert.Equal(ChatKeepRules.TooLate, ChatKeepRules.Unavailable(false, false, Ends, new DateOnly(2027, 4, 19)));
    }

    [Fact]
    public void TheCruiseEndCountedFromIsTheCurrentTripElseTheLatestEnded()
    {
        var today = new DateOnly(2027, 3, 1);
        // On a trip that ends 7 days after it starts, with an older one behind.
        Assert.Equal(new DateOnly(2027, 3, 5), ChatKeepRules.CruiseEnds([(new DateOnly(2027, 2, 26), 7), (new DateOnly(2026, 6, 1), 7), (new DateOnly(2027, 9, 1), 7)], today));
        // Nothing ahead: the most recent one that ended.
        Assert.Equal(new DateOnly(2026, 6, 8), ChatKeepRules.CruiseEnds([(new DateOnly(2026, 6, 1), 7), (new DateOnly(2025, 1, 1), 7)], today));
        Assert.Null(ChatKeepRules.CruiseEnds([], today));
    }
}
