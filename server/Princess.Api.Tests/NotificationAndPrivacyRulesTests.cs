using System.Text.Json.Nodes;
using Princess.Api.Domain;

namespace Princess.Api.Tests;

public class NotificationRulesTests
{
    [Fact]
    public void DefaultsAndCriticalCannotBeSwitchedOff()
    {
        var prefs = NotificationRules.NormalizePrefs(JsonNode.Parse("""{"channels":{"critical":{"push":false,"email":false,"sms":false},"offers":{"push":true}},"quiet":{"on":true,"from":"23:30"}}"""));
        Assert.True((bool)prefs["channels"]!["critical"]!["sms"]!);
        Assert.True((bool)prefs["channels"]!["offers"]!["push"]!);
        Assert.False((bool)prefs["channels"]!["offers"]!["email"]!);
        Assert.True((bool)prefs["channels"]!["payments"]!["email"]!);
        Assert.True((bool)prefs["quiet"]!["on"]!);
        Assert.Equal("23:30", (string)prefs["quiet"]!["from"]!);
        Assert.Equal("07:00", (string)prefs["quiet"]!["to"]!);
    }

    [Fact]
    public void GarbageFallsBackToDefaults()
    {
        var prefs = NotificationRules.NormalizePrefs(JsonNode.Parse("""{"channels":"x","quiet":{"on":"yes","from":"25:99"}}"""));
        Assert.False((bool)prefs["quiet"]!["on"]!);
        Assert.Equal("22:00", (string)prefs["quiet"]!["from"]!);
        Assert.Equal(5, prefs["channels"]!.AsObject().Count);
        Assert.Equal(5, NotificationRules.NormalizePrefs(null)["channels"]!.AsObject().Count);
    }

    [Fact]
    public void NoticesAreDerivedMostUrgentFirst()
    {
        var ids = NotificationRules.BuildNotices(new("overdue", "2027-03-11", 2, 1, "notOpen", "2027-03-18")).Select(n => n.Id);
        Assert.Equal(["payOverdue", "passportProblem", "documentsMissing", "checkinOpens"], ids);
        Assert.Equal(["checkinOpens"], NotificationRules.BuildNotices(new("paid", "2027-03-11", 0, 0, "open", "2027-03-18")).Select(n => n.Id));
        Assert.Empty(NotificationRules.BuildNotices(new("paid", "2027-03-11", 0, 0, "done", "2027-03-18")));
    }

    [Fact]
    public void TicketsAdvanceWithAgeAndNeverGoBackwards()
    {
        var at = new DateTime(2027, 3, 5, 12, 0, 0, DateTimeKind.Utc);
        Assert.Equal("received", NotificationRules.TicketStatus(at, at.AddMinutes(9), "open"));
        Assert.Equal("inProgress", NotificationRules.TicketStatus(at, at.AddMinutes(10), "open"));
        Assert.Equal("resolved", NotificationRules.TicketStatus(at, at.AddMinutes(60), "open"));
        Assert.Equal("resolved", NotificationRules.TicketStatus(at, at.AddMinutes(1), "done"));
        Assert.Equal("inProgress", NotificationRules.TicketStatus(at, at.AddMinutes(1), "inProgress"));
    }
}

public class PrivacyRulesTests
{
    private static readonly DateOnly Ends = new(2027, 3, 28);

    [Fact]
    public void RetentionDatesCountFromTheLastDay()
    {
        var byId = PrivacyRules.Retention.ToDictionary(r => r.Id);
        Assert.Equal(new DateOnly(2027, 4, 27), PrivacyRules.DeleteOn(byId["idDocuments"], Ends));
        Assert.Equal(new DateOnly(2027, 6, 26), PrivacyRules.DeleteOn(byId["health"], Ends));
        Assert.Null(PrivacyRules.DeleteOn(byId["payment"], Ends));
    }

    [Theory]
    [InlineData("2027-04-26", 0)]
    [InlineData("2027-04-27", 2)]   // ci-guest, documents
    [InlineData("2027-06-26", 4)]   // plus illness, clubReg
    public void KindsToDeleteGrowAsRulesFallDue(string today, int count) =>
        Assert.Equal(count, PrivacyRules.KindsToDelete(Ends, DateOnly.Parse(today)).Count);

    [Fact]
    public void AKindNeededByARuleStillInForceIsKept()
    {
        // 'photo' and 'idDocuments' both name ci-guest; with an extra rule still running a shared kind would be kept.
        Assert.Contains("documents", PrivacyRules.KindsToDelete(Ends, new DateOnly(2027, 4, 27)));
        Assert.DoesNotContain("illness", PrivacyRules.KindsToDelete(Ends, new DateOnly(2027, 4, 27)));
    }

    [Theory]
    [InlineData(40, "marketingEmail,marketingSms,improve,shipPhotos")]
    [InlineData(13, "marketingEmail,marketingSms,improve,shipPhotos")]
    [InlineData(12, "shipPhotos,parent")]
    [InlineData(8, "shipPhotos,parent")]
    public void ConsentsDependOnAge(int age, string expected) =>
        Assert.Equal(expected.Split(','), PrivacyRules.ConsentsFor(age).Select(c => c.Id).OrderBy(id => Array.IndexOf(PrivacyRules.ConsentIds, id)));

    [Fact]
    public void OnlyTheAdultOrTheChildsBookerDecides()
    {
        Assert.True(PrivacyRules.MayDecide(1, false, 1, false, null));          // yourself
        Assert.True(PrivacyRules.MayDecide(1, false, 3, true, 1));              // your child
        Assert.False(PrivacyRules.MayDecide(2, false, 3, true, 1));             // someone else's child
        Assert.False(PrivacyRules.MayDecide(1, false, 2, false, null));         // another adult
        Assert.False(PrivacyRules.MayDecide(3, true, 3, true, 1));              // a supervised account decides nothing
    }

    [Fact]
    public void BudgetNormalisingDropsAnythingOutOfRange()
    {
        var b = PrivacyRules.NormalizeBudget(JsonNode.Parse("""{"total":-5,"alertAt":70,"kids":{"a":25000,"b":0,"c":5000000}}"""));
        Assert.Null(b["total"]);
        Assert.Equal(80, (int)b["alertAt"]!);
        Assert.Equal(["a"], b["kids"]!.AsObject().Select(kv => kv.Key));
        Assert.Equal(50, (int)PrivacyRules.NormalizeBudget(JsonNode.Parse("""{"alertAt":50,"total":100000}"""))["alertAt"]!);
    }

    [Theory]
    [InlineData("""{"total":100000,"alertAt":80,"kids":{"kid1":2000}}""", null)]
    [InlineData("""{"total":null,"alertAt":100,"kids":{}}""", null)]
    [InlineData("""{"total":0,"alertAt":80,"kids":{}}""", "total")]
    [InlineData("""{"total":1000001,"alertAt":80,"kids":{}}""", "total")]
    [InlineData("""{"total":5,"alertAt":75,"kids":{}}""", "alertAt")]
    [InlineData("""{"total":5,"alertAt":80,"kids":{"stranger":2000}}""", "kid")]
    [InlineData("""{"total":5,"alertAt":80,"kids":{"kid1":0}}""", "kid")]
    public void BudgetValidation(string json, string? problem) =>
        Assert.Equal(problem, PrivacyRules.ValidateBudget(JsonNode.Parse(json), new HashSet<string> { "kid1" }));
}
