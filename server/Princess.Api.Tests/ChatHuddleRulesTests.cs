using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public sealed class ChatHuddleRulesTests
{
    [Fact]
    public void AnAdultMayStartWithNoBooking() => Assert.Null(ChatHuddleRules.StartRefusal(false, 18, 0, 0));

    [Theory]
    [InlineData(true, 40, ChatHuddleRules.Supervised)]
    [InlineData(false, 17, ChatHuddleRules.Underage)]
    [InlineData(false, null, ChatHuddleRules.NeedAge)]
    public void NobodyElseMayStart(bool supervised, int? age, string expected) => Assert.Equal(expected, ChatHuddleRules.StartRefusal(supervised, age, 0, 0));

    [Fact]
    public void OneOpenAtATimeAndThreeInAll()
    {
        Assert.Equal(ChatHuddleRules.OpenAlready, ChatHuddleRules.StartRefusal(false, 30, 1, 1));
        Assert.Equal(ChatHuddleRules.TooMany, ChatHuddleRules.StartRefusal(false, 30, 0, 3));
        Assert.Null(ChatHuddleRules.StartRefusal(false, 30, 0, 2));
    }

    [Fact]
    public void AnAdultMayJoin() => Assert.Null(ChatHuddleRules.JoinRefusal(false, 25, false, 3, 0));

    [Fact]
    public void ANonAdultCannotJoin()
    {
        Assert.Equal(ChatHuddleRules.Underage, ChatHuddleRules.JoinRefusal(false, 17, false, 2, 0));
        Assert.Equal(ChatHuddleRules.Underage, ChatHuddleRules.JoinRefusal(false, 16, false, 2, 0)); // 18, not 16
        Assert.Equal(ChatHuddleRules.NeedAge, ChatHuddleRules.JoinRefusal(false, null, false, 2, 0));
    }

    [Fact]
    public void ASupervisedChildIsRefusedWhateverTheirAge() => Assert.Equal(ChatHuddleRules.Supervised, ChatHuddleRules.JoinRefusal(true, 30, false, 2, 0));

    [Fact]
    public void TheSeventhMemberIsRefused()
    {
        Assert.Null(ChatHuddleRules.JoinRefusal(false, 30, false, 5, 0));
        Assert.Equal(ChatHuddleRules.Full, ChatHuddleRules.JoinRefusal(false, 30, false, 12, 0));
        Assert.True(ChatHuddleRules.Fits(11, 1));
        Assert.False(ChatHuddleRules.Fits(12, 1));
    }

    [Fact]
    public void AGuestIsInAtMostThreeHuddles() => Assert.Equal(ChatHuddleRules.TooMany, ChatHuddleRules.JoinRefusal(false, 30, false, 2, 3));

    [Fact]
    public void AgeIsInWholeYears()
    {
        Assert.Equal(17, ChatHuddleRules.AgeOn(new(2008, 6, 2), new(2026, 6, 1)));
        Assert.Equal(18, ChatHuddleRules.AgeOn(new(2008, 6, 2), new(2026, 6, 2)));
    }

    [Fact]
    public void ATokenIsLongRandomAndOnlyItsHashIsKept()
    {
        var a = ChatHuddleRules.NewToken();
        var b = ChatHuddleRules.NewToken();
        Assert.NotEqual(a, b);
        Assert.True(a.Length >= 43);
        Assert.DoesNotContain('=', a);
        var hash = ChatHuddleRules.HashOf(a);
        Assert.NotEqual(a, hash);
        Assert.Equal(hash, ChatHuddleRules.HashOf(a));
        Assert.NotEqual(hash, ChatHuddleRules.HashOf(b));
    }

    [Fact]
    public void ALinkLastsSevenDays() => Assert.Equal(new DateTime(2026, 11, 23), ChatHuddleRules.ExpiresAt(new DateTime(2026, 11, 16)));

    [Fact]
    public void AWrongExpiredAndRevokedLinkFailWithTheSameWords()
    {
        var now = new DateTime(2026, 11, 16, 12, 0, 0);
        var wrong = ChatHuddleRules.LinkRefusal(false, null, null, now);
        var expired = ChatHuddleRules.LinkRefusal(true, now.AddMinutes(-1), null, now);
        var revoked = ChatHuddleRules.LinkRefusal(true, now.AddDays(3), now.AddHours(-1), now);
        Assert.Equal(ChatHuddleRules.InvalidLink, wrong);
        Assert.Equal(wrong, expired);
        Assert.Equal(wrong, revoked);
        Assert.Null(ChatHuddleRules.LinkRefusal(true, now.AddDays(3), null, now));
    }

    [Fact]
    public void TenLinksADay()
    {
        Assert.True(ChatHuddleRules.MayMakeLink(9));
        Assert.False(ChatHuddleRules.MayMakeLink(10));
    }

    [Fact]
    public void ALinkShowsOnlyWhoIsInAndSeatsLeft()
    {
        var p = ChatHuddleRules.PreviewOf([("Alex", "Rivera"), ("Sam", "Okoye")]);
        Assert.Equal(2, p.Members.Count);
        Assert.Equal(4, p.SeatsLeft);
        Assert.DoesNotContain(p.Members, n => n.Contains("Rivera")); // first name and last initial only
        Assert.Equal(2, typeof(ChatHuddleRules.Preview).GetProperties().Length); // nothing but members and seats
    }

    [Fact]
    public void NoPhotosAndNoSms() { Assert.False(ChatHuddleRules.AllowsPhotos); Assert.False(ChatHuddleRules.AllowsSms); }

    [Fact]
    public void StanleyHasFourRolesAndNoBookingTools()
    {
        Assert.True(ChatHuddleRules.StanleyMay("R1"));
        Assert.True(ChatHuddleRules.StanleyMay("R5"));
        foreach (var r in new[] { "R2", "R3", "R6", "R7", "R10", "R12" }) Assert.False(ChatHuddleRules.StanleyMay(r));
    }

    [Fact]
    public void APublicCardWithAFareIsFine() => Assert.Null(ChatHuddleRules.CardRefusal(ChatHuddleRules.Sailing, "Alaska, 7 nights", true, ["ship", "departs", "fareFrom", "asOf"], 0));

    [Theory]
    [InlineData("paidSoFar")]
    [InlineData("balance")]
    [InlineData("splitPerPerson")]
    [InlineData("whoOwes")]
    [InlineData("bookingNumber")]
    [InlineData("cabinNumber")]
    public void NoCardCarriesPersonalMoneyOrNumbers(string field) => Assert.Equal(ChatHuddleRules.NotAllowed, ChatHuddleRules.CardRefusal(ChatHuddleRules.CostBreakdown, "Costs", true, [field], 0));

    [Fact]
    public void ACardNeedsAKnownKindATitleAndAnAsOfTime()
    {
        Assert.Equal(ChatHuddleRules.NotAllowed, ChatHuddleRules.CardRefusal("photo", "x", true, [], 0));
        Assert.Equal(ChatHuddleRules.NotAllowed, ChatHuddleRules.CardRefusal(ChatHuddleRules.Port, " ", true, [], 0));
        Assert.Equal(ChatHuddleRules.NotAllowed, ChatHuddleRules.CardRefusal(ChatHuddleRules.Port, "Juneau", false, [], 0));
    }

    [Fact]
    public void TheShortlistHasALimit() => Assert.Equal(ChatHuddleRules.Full, ChatHuddleRules.CardRefusal(ChatHuddleRules.Port, "Juneau", true, [], 12));

    [Fact]
    public void ConversionSendsBookedMembersToThePartyAndKeepsTheRest()
    {
        var c = ChatHuddleRules.ToPartyChat([new(1, true, true), new(2, true, false), new(3, false, true)]);
        Assert.Equal([1L, 2L], c.Party);
        Assert.Equal([3L], c.Stay);
    }

    [Fact]
    public void HistoryIsCarriedOnlyForBookedMembersWhoSaidOk()
    {
        var c = ChatHuddleRules.ToPartyChat([new(1, true, true), new(2, true, false), new(3, false, true)]);
        Assert.Equal([1L], c.HistoryCarried); // 2 did not agree; 3 is not on the booking
    }

    [Fact]
    public void OnlyTheBookerMayConvertAndOnlyWithSomeoneOnTheBooking()
    {
        Assert.True(ChatHuddleRules.MayConvert(true, [new(1, true, false)]));
        Assert.False(ChatHuddleRules.MayConvert(false, [new(1, true, false)]));
        Assert.False(ChatHuddleRules.MayConvert(true, [new(1, false, false)]));
    }

    [Fact]
    public void RetentionWarnsAtFiftyDaysAndDeletesAtSixty()
    {
        var last = new DateTime(2026, 9, 1);
        Assert.Equal(ChatHuddleRules.KeepStage, ChatHuddleRules.Stage(last, last.AddDays(49)));
        Assert.Equal(ChatHuddleRules.WarnStage, ChatHuddleRules.Stage(last, last.AddDays(50)));
        Assert.Equal(ChatHuddleRules.WarnStage, ChatHuddleRules.Stage(last, last.AddDays(59)));
        Assert.Equal(ChatHuddleRules.DeleteStage, ChatHuddleRules.Stage(last, last.AddDays(60)));
        Assert.Equal(last.AddDays(60), ChatHuddleRules.DeleteOn(last));
    }

    [Fact]
    public void HistoryIsCarriedOnlyWhenEveryoneGoingToThePartyChatAgreed()
    {
        Assert.True(ChatHuddleRules.CarriesHistory(ChatHuddleRules.ToPartyChat([new(1, true, true), new(2, true, true), new(3, false, false)])));
        Assert.False(ChatHuddleRules.CarriesHistory(ChatHuddleRules.ToPartyChat([new(1, true, true), new(2, true, false)])));   // one said no
        Assert.False(ChatHuddleRules.CarriesHistory(ChatHuddleRules.ToPartyChat([new(1, false, true)])));                       // nobody going
    }

    [Fact]
    public void HistoryStartsWhenTheLastOfThemJoined() =>
        Assert.Equal(new DateTime(2026, 11, 5), ChatHuddleRules.CarryFrom([new DateTime(2026, 11, 1), new DateTime(2026, 11, 5), new DateTime(2026, 11, 3)]));

    [Fact]
    public void TheHuddleCarriesOnAsAGroupOnlyWhileSomeoneIsOffTheBooking()
    {
        Assert.True(ChatHuddleRules.KeepsGroup(ChatHuddleRules.ToPartyChat([new(1, true, false), new(2, false, false)])));
        Assert.False(ChatHuddleRules.KeepsGroup(ChatHuddleRules.ToPartyChat([new(1, true, false), new(2, true, false)])));
    }

    [Fact]
    public void StanleyInAHuddleHasOnlyHisFourRoles()
    {
        Assert.Null(Princess.Api.Domain.ChatStanleyRules.Unavailable("huddle", false, false, "R1"));
        Assert.Null(Princess.Api.Domain.ChatStanleyRules.Unavailable("huddle", false, false, "R4"));
        Assert.Null(Princess.Api.Domain.ChatStanleyRules.Unavailable("huddle", false, false, "R9"));
        Assert.NotNull(Princess.Api.Domain.ChatStanleyRules.Unavailable("huddle", false, false, "R3"));   // no catch-up
        Assert.NotNull(Princess.Api.Domain.ChatStanleyRules.Unavailable("huddle", false, false, "R8"));
        Assert.Null(Princess.Api.Domain.ChatStanleyRules.Unavailable("group", false, false, "R3"));       // a made group is unchanged
        Assert.True(Princess.Api.Domain.ChatStanleyRules.MayConfigure("huddle", 5, 5));
        Assert.False(Princess.Api.Domain.ChatStanleyRules.MayConfigure("huddle", 6, 5));
    }
}
