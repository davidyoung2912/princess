using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Tests;

/// <summary>Away From Ship on the server: who is away, when to be at the gangway, and the "head back" notices. Ported from <c>src/domain/awayFromShip.ts</c>.</summary>
public class AwayRulesTests
{
    private static readonly DateTime Now = new(2027, 3, 24, 15, 0, 0, DateTimeKind.Utc);
    private static long Ms(DateTime t) => new DateTimeOffset(t).ToUnixTimeMilliseconds();

    private static PortDayWithState Day(int minutesToAllAboard, bool tender = false)
    {
        var at = Now.AddMinutes(minutesToAllAboard);
        return new(4, "cozumel", "2027-03-24", "4:30 pm", "3:30 pm", Ms(at), 0, 0, "America/New_York", "America/Cancun", tender, AboardRules.StateOf(at, Now));
    }

    private static PushInput Input(PortDayWithState port, bool away) =>
        new(Now, "ok", "2027-03-01", port, true, 45, false, [], [], 4, [], GuestAway: away);

    [Fact]
    public void TheLandingTimeAllowsTheWalkTheQueueAndTheBuffer()
    {
        var allAboard = Ms(Now);
        Assert.Equal(allAboard - 75 * 60_000L, AwayRules.LandingByMs(allAboard, false, null));
        Assert.Equal(allAboard - 90 * 60_000L, AwayRules.LandingByMs(allAboard, false, 60));
        Assert.Equal(allAboard - 115 * 60_000L, AwayRules.LandingByMs(allAboard, true, null));
        Assert.Equal(allAboard - 75 * 60_000L, AwayRules.LandingByMs(allAboard, false, 3));
    }

    [Fact]
    public void LeavingAndAshoreAreAwayAndNothingElseIs()
    {
        Assert.True(AwayRules.IsAway("ashore"));
        Assert.True(AwayRules.IsAway("leaving"));
        Assert.False(AwayRules.IsAway("back"));
        Assert.False(AwayRules.IsAway(null));
    }

    [Fact]
    public void ThePresenceKeyAndStatusMatchWhatTheAppWrites()
    {
        var id = Guid.Parse("0f8fad5b-d9cb-469f-a165-70867728950e");
        Assert.Equal("2027-03-24|0f8fad5b-d9cb-469f-a165-70867728950e", AwayRules.PresenceKey("2027-03-24", id));
        Assert.Equal("back", AwayRules.StatusOf(AwayRules.PresenceJson("back", 5)));
        Assert.Null(AwayRules.StatusOf("not json"));
        Assert.Null(AwayRules.StatusOf(null));
    }

    [Fact]
    public void AHeadsUpComesWithinHalfAnHourOfTheLandingTimeThenTheNoticeToGo()
    {
        var soon = Assert.Single(AwayRules.ReturnNotices(Day(100), null, Now));
        Assert.Equal("awayReturn:2027-03-24:soon", soon.Key);
        Assert.True(soon.Bypass);
        var go = Assert.Single(AwayRules.ReturnNotices(Day(60), null, Now));
        Assert.Equal("awayReturn:2027-03-24:now", go.Key);
        Assert.Contains("pier gate", go.Body);
        Assert.Contains("tender landing", Assert.Single(AwayRules.ReturnNotices(Day(60, tender: true), null, Now)).Body);
    }

    [Fact]
    public void NothingIsSaidTooEarlyOrOnceAllAboardHasPassed()
    {
        Assert.Empty(AwayRules.ReturnNotices(Day(200), null, Now));
        Assert.Empty(AwayRules.ReturnNotices(Day(0), null, Now));
        Assert.Empty(AwayRules.ReturnNotices(Day(-5), null, Now));
    }

    [Fact]
    public void OnlyAGuestWhoIsAwayIsToldToHeadBack()
    {
        Assert.Contains(PushRules.Build(Input(Day(60), away: true)), n => n.Key == "awayReturn:2027-03-24:now");
        Assert.DoesNotContain(PushRules.Build(Input(Day(60), away: false)), n => n.Key.StartsWith("awayReturn", StringComparison.Ordinal));
    }

    [Fact]
    public void TheHeadBackNoticeIsRecognisedAndReachesATextEvenWithTheChannelOff()
    {
        var notice = Assert.Single(AwayRules.ReturnNotices(Day(60), null, Now));
        Assert.True(AwayRules.IsReturnNotice(notice));
        Assert.False(AwayRules.IsReturnNotice(notice with { Key = "allAboard:2027-03-24:30" }));
        var textOff = NotificationRules.NormalizePrefs(System.Text.Json.Nodes.JsonNode.Parse("{\"channels\":{\"critical\":{\"sms\":false}},\"quiet\":{\"on\":true,\"from\":\"00:00\",\"to\":\"23:59\"}}"));
        Assert.True(PushRules.Reach(notice, textOff, "sms", new TimeOnly(12, 0)));
    }

    [Fact]
    public void AGangwayDirectionIsOnOrOffAndNothingElse()
    {
        Assert.Equal(GangwayDirection.On, GangwayService.ParseDirection("on"));
        Assert.Equal(GangwayDirection.Off, GangwayService.ParseDirection("off"));
        Assert.Null(GangwayService.ParseDirection("ON"));
        Assert.Null(GangwayService.ParseDirection(null));
    }
}
