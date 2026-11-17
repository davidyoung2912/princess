using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The Get to the ship and Embark pack, first part (phase P9c): check-in open, phone and money in the last three days, muster on sailing day. Nothing is filled in or sent.</summary>
public class StanleyEmbarkTests
{
    private static readonly DateOnly Today = new(2027, 1, 10);

    private static EmbarkFacts Facts(int toGo, string checkin = "notOpen") => new(Today, Today.AddDays(toGo), checkin, Today.AddDays(toGo).ToDateTime(new TimeOnly(12, 0)));

    [Fact]
    public void CheckinOpenPointsToCheckinAndNeverFillsItIn()
    {
        var f = Assert.Single(StanleyEmbarkRules.Findings(Facts(10, "open")));
        Assert.Equal("SR-6.1", f.Rule);
        Assert.Equal("/home/check-in", f.Route);
        Assert.Contains("do not fill it in", f.Detail);
    }

    [Fact]
    public void NoCheckinNoteWhenNotOpenOrDone()
    {
        Assert.Empty(StanleyEmbarkRules.Findings(Facts(10, "notOpen")));
        Assert.Empty(StanleyEmbarkRules.Findings(Facts(10, "done")));
    }

    [Theory]
    [InlineData(4, false)]
    [InlineData(3, true)]
    [InlineData(1, true)]
    [InlineData(0, false)]
    public void PhoneAndMoneyOnlyInTheLastThreeDays(int toGo, bool shown) =>
        Assert.Equal(shown, StanleyEmbarkRules.Findings(Facts(toGo)).Any(x => x.Rule == "SR-6.6" && x.Route == "/plan/phone"));

    [Fact]
    public void MusterOnlyOnSailingDay()
    {
        Assert.Contains(StanleyEmbarkRules.Findings(Facts(0)), x => x.Rule == "SR-7.2" && x.Route == "/ship/muster");
        Assert.DoesNotContain(StanleyEmbarkRules.Findings(Facts(1)), x => x.Rule == "SR-7.2");
        Assert.Empty(StanleyEmbarkRules.Findings(Facts(-1, "open")));
    }

    [Fact]
    public void ItSaysWhatItCannotSee() =>
        Assert.Contains(StanleyEmbarkRules.NotChecked(Facts(2)), x => x.Contains("cannot see"));
}
