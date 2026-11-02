using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Tests;

/// <summary>The reminder email: only when asked for, once, with a link that cannot be made up, and a fake sender that records.</summary>
public class ReminderRulesTests
{
    private static readonly byte[] Key = ReminderRules.KeyFrom("a-test-signing-key-that-is-long-enough-for-hmac");

    [Fact]
    public void TheUnsubscribeLinkIsBoundToTheUserAndTheDate()
    {
        var token = ReminderRules.Token(Key, 7, 1_700_000_000_000);
        Assert.Equal((7L, 1_700_000_000_000L), ReminderRules.Verify(Key, token));
        Assert.Null(ReminderRules.Verify(Key, token.Replace("7.", "8.")));
        Assert.Null(ReminderRules.Verify(Key, token + "x"));
        Assert.Null(ReminderRules.Verify(ReminderRules.KeyFrom("another-key-another-key-another-key-123456"), token));
        Assert.Null(ReminderRules.Verify(Key, "nonsense"));
        Assert.Null(ReminderRules.Verify(Key, null));
    }

    [Fact]
    public void ParsingKeepsOnlyWhatIsValid()
    {
        Assert.Equal(new ReminderDoc(5, "s1", true), ReminderRules.Parse("""{"at":5,"sailingId":"s1","email":true}"""));
        Assert.False(ReminderRules.Parse("""{"at":5}""")!.Email);
        Assert.Null(ReminderRules.Parse("{}"));
        Assert.Null(ReminderRules.Parse("not json"));
        Assert.Null(ReminderRules.Parse("""{"at":-1}"""));
        Assert.Contains("\"email\":false", ReminderRules.WithoutEmail("""{"at":5,"email":true}"""));
    }

    [Theory]
    [InlineData(true, 100, "a@b.c", false, true)]
    [InlineData(false, 100, "a@b.c", false, false)]   // not asked for
    [InlineData(true, 99, "a@b.c", false, false)]     // too early
    [InlineData(true, 100, "", false, false)]         // no address
    [InlineData(true, 100, "a@b.c", true, false)]     // already sent for this date
    public void AnEmailIsDueOnlyWhenEveryConditionHolds(bool asked, long now, string address, bool sent, bool due) =>
        Assert.Equal(due, ReminderRules.EmailDue(new ReminderDoc(100, "s1", asked), now, address, sent));

    [Fact]
    public async Task TheFakeSenderRecordsAndTheEmailCarriesTheUnsubscribeLink()
    {
        var (subject, body) = ReminderRules.Compose("2027-03-20", "https://x.test/u");
        Assert.Contains("https://x.test/u", body);
        Assert.Contains("2027-03-20", body);
        var sender = new SimEmailSender();
        Assert.True(await sender.SendAsync(new("a@b.c", subject, body), CancellationToken.None));
        Assert.Single(sender.Sent);
    }
}

public class FirstNameTests
{
    [Theory]
    [InlineData("Jane Smith", "Jane")]
    [InlineData("  Jane  ", "Jane")]
    [InlineData("", "")]
    [InlineData(null, "")]
    public void TheFirstWordOfAName(string? name, string first) => Assert.Equal(first, PlanRules.FirstName(name));
}
