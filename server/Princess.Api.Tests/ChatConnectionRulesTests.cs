using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-plan.md, phase 1: who can be found, who answers a request, and the limits on asking.</summary>
public class ChatConnectionRulesTests
{
    [Theory]
    [InlineData("Sam", "Sam")]
    [InlineData("  sam   rivers ", "sam rivers")]
    [InlineData("O'Neil", "O'Neil")]
    [InlineData("Anne-Marie", "Anne-Marie")]
    [InlineData("José", "José")]
    public void ASearchIsTidiedAndKept(string text, string expected) => Assert.Equal(expected, ChatConnectionRules.CleanQuery(text));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("Sa")]
    [InlineData("100%")]
    [InlineData("a_b_c")]
    [InlineData("[abc]")]
    [InlineData("Sam; DROP")]
    public void ATooShortOrOddSearchIsRefused(string? text) => Assert.Null(ChatConnectionRules.CleanQuery(text));

    [Fact]
    public void ATooLongSearchIsRefused() => Assert.Null(ChatConnectionRules.CleanQuery(new string('a', ChatConnectionRules.MaxQuery + 1)));

    [Theory]
    [InlineData("Sam", "Rivers", "Sam R.")]
    [InlineData(" sam ", " rivers ", "sam R.")]
    [InlineData("Sam", "", "Sam")]
    [InlineData("", "Rivers", "Rivers")]
    [InlineData("", "", "Guest")]
    public void OnlyTheFirstNameAndLastInitialAreShown(string first, string last, string expected) => Assert.Equal(expected, ChatConnectionRules.ShortName(first, last));

    [Fact]
    public void AnAdultAsksAnAdultDirectly() => Assert.Equal(new ChatRoute("pending", null), ChatConnectionRules.Route(false, false));

    [Fact]
    public void AChildsRequestGoesToTheirGuardianFirst() => Assert.Equal(new ChatRoute("awaitingGuardian", "requester"), ChatConnectionRules.Route(true, false));

    [Fact]
    public void ARequestToAChildIsAnsweredByTheirGuardian() => Assert.Equal(new ChatRoute("awaitingGuardian", "target"), ChatConnectionRules.Route(false, true));

    [Fact]
    public void ARequestBetweenChildrenNeedsBothGuardiansInTurn()
    {
        Assert.Equal(new ChatRoute("awaitingGuardian", "requester"), ChatConnectionRules.Route(true, true));
        Assert.Equal(new ChatRoute("awaitingGuardian", "target"), ChatConnectionRules.AfterRequesterGuardian(true));
    }

    [Fact]
    public void AfterTheSendersGuardianApprovesAnAdultTargetAnswersThemselves() => Assert.Equal(new ChatRoute("pending", null), ChatConnectionRules.AfterRequesterGuardian(false));

    [Fact]
    public void OnlyWaitingAndAgreedConnectionsAreOpen()
    {
        foreach (var open in new[] { "awaitingGuardian", "pending", "accepted" }) Assert.True(ChatConnectionRules.IsOpen(open));
        foreach (var shut in new[] { "declined", "cancelled", "expired", "ended", null, "" }) Assert.False(ChatConnectionRules.IsOpen(shut));
        Assert.True(ChatConnectionRules.IsWaiting("pending"));
        Assert.True(ChatConnectionRules.IsWaiting("awaitingGuardian"));
        Assert.False(ChatConnectionRules.IsWaiting("accepted"));
    }

    [Fact]
    public void ARequestExpiresAtItsTime()
    {
        var at = new DateTime(2026, 11, 9, 12, 0, 0, DateTimeKind.Utc);
        Assert.False(ChatConnectionRules.IsExpired(at, at.AddSeconds(-1)));
        Assert.True(ChatConnectionRules.IsExpired(at, at));
    }

    [Fact]
    public void ADeclineBlocksAskingAgainForAWeek()
    {
        var declined = new DateTime(2026, 11, 9, 12, 0, 0, DateTimeKind.Utc);
        Assert.False(ChatConnectionRules.InCooldown(null, declined));
        Assert.True(ChatConnectionRules.InCooldown(declined, declined.AddDays(6)));
        Assert.False(ChatConnectionRules.InCooldown(declined, declined.AddDays(7)));
    }

    [Fact]
    public void NoticesNameOnlyAShortNameAndNeverSayWhyAnAnswerIsNo()
    {
        var (title, body) = ChatConnectionRules.RequestNotice("Sam R.");
        Assert.Equal("Sam R. wants to chat", title);
        Assert.DoesNotContain("@", body);
        var (declinedTitle, declinedBody) = ChatConnectionRules.DeclinedNotice();
        Assert.DoesNotContain("declin", declinedTitle + declinedBody, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Sam", declinedTitle + declinedBody);
    }

    [Fact]
    public void ANoticeKeyIsOnePerEventAndConnection()
    {
        var id = Guid.NewGuid();
        Assert.NotEqual(ChatConnectionRules.NoticeKey("request", id), ChatConnectionRules.NoticeKey("accepted", id));
        Assert.Equal(ChatConnectionRules.NoticeKey("request", id), ChatConnectionRules.NoticeKey("request", id));
        Assert.True(ChatConnectionRules.NoticeKey("request", id).Length <= 120);
    }
}
