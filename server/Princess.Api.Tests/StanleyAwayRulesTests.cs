using Princess.Api.Domain;

namespace Princess.Api.Tests;

public class StanleyAwayRulesTests
{
    [Fact]
    public void Leaving_the_ship_is_wished_well_with_the_first_name() =>
        Assert.StartsWith("Have a wonderful time ashore, Sam!\n", StanleyAwayRules.Text(ChatAwayRules.Change.Left, "Sam"));

    [Fact]
    public void Coming_back_is_welcomed_with_the_first_name() =>
        Assert.StartsWith("Welcome back aboard, Sam!\n", StanleyAwayRules.Text(ChatAwayRules.Change.Returned, " Sam "));

    [Fact]
    public void Without_a_first_name_the_greeting_still_reads_well() =>
        Assert.StartsWith("Welcome back aboard!\n", StanleyAwayRules.Text(ChatAwayRules.Change.Returned, null));

    [Fact]
    public void No_change_says_nothing() => Assert.Null(StanleyAwayRules.Text(ChatAwayRules.Change.None, "Sam"));

    [Fact]
    public void The_notice_is_a_quiet_information_card_keyed_by_the_moment()
    {
        var now = new DateTime(2027, 3, 24, 9, 0, 0, DateTimeKind.Utc);
        var n = StanleyAwayRules.Notice(ChatAwayRules.Change.Left, "Sam", ChatAwayRules.Ashore, 1234, now);
        Assert.Equal("away:ashore:1234", n.Key);
        Assert.Equal(StanleyNoticeRules.Info, n.Lane);
        Assert.Equal(ChatUrgencyRules.Normal, n.Urgency);
        Assert.DoesNotContain(StanleyAwayRules.Kind, StanleyNoticeRules.BypassKinds);
    }
}
