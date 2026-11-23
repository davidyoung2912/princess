using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class ShareCodeRulesTests
{
    [Fact]
    public void ALifeIsFifteenMinutesOneHourOrADay()
    {
        Assert.Equal(15, ShareCodeRules.LifeMinutes(null));
        foreach (var ok in new[] { 15, 60, 1440 }) Assert.Equal(ok, ShareCodeRules.LifeMinutes(ok));
        foreach (var bad in new[] { 0, 1, 90, 10080, -5 }) Assert.Null(ShareCodeRules.LifeMinutes(bad));
    }

    [Fact]
    public void CodesAreLongPlainAndDifferent()
    {
        var codes = Enumerable.Range(0, 50).Select(_ => ShareCodeRules.NewCode()).ToList();
        Assert.Equal(50, codes.Distinct().Count());
        Assert.All(codes, c => { Assert.Equal(16, c.Length); Assert.True(ShareCodeRules.PlausibleCode(c)); });
        foreach (var bad in new[] { null, "", "abc", "has space!", new string('a', 65) }) Assert.False(ShareCodeRules.PlausibleCode(bad));
    }

    [Fact]
    public void ADirectCodeNamesOnlyAKnownTypeAndPlainCharacters()
    {
        Assert.Equal("venue:crown-grill", ShareCodeRules.DirectRef("venue", "crown-grill"));
        Assert.Equal("menu:crown-grill:dinner", ShareCodeRules.DirectRef("menu", "crown-grill:dinner"));
        Assert.Null(ShareCodeRules.DirectRef("excursion", "abc"));
        Assert.Null(ShareCodeRules.DirectRef("venue", "a b"));
        Assert.Null(ShareCodeRules.DirectRef("venue", "../x/y"));
        Assert.Null(ShareCodeRules.DirectRef(null, "x"));
        Assert.Null(ShareCodeRules.DirectRef("venue", new string('a', 81)));
    }

    [Fact]
    public void ACodeOpensUntilItExpiresOrIsStopped()
    {
        var now = new DateTime(2026, 11, 22, 12, 0, 0, DateTimeKind.Utc);
        Assert.True(ShareCodeRules.Live(now.AddMinutes(1), null, now));
        Assert.False(ShareCodeRules.Live(now, null, now));
        Assert.False(ShareCodeRules.Live(now.AddHours(1), now.AddMinutes(-1), now));
    }

    [Fact]
    public void SaveKeyIsTheShipsVenuePinForAVenueOrItsMenu()
    {
        Assert.Equal("venue:aurora.crown-grill", ShareCodeRules.SaveKey("aurora", "venue:crown-grill"));
        Assert.Equal("venue:aurora.crown-grill", ShareCodeRules.SaveKey("aurora", "menu:crown-grill:dinner"));
        Assert.Null(ShareCodeRules.SaveKey("aurora", "excursion:x"));
        Assert.Null(ShareCodeRules.SaveKey("aurora", null));
        Assert.Null(ShareCodeRules.SaveKey(null, "venue:crown-grill"));
    }
}
