using System.Text.Json.Nodes;
using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The "stop these emails" link on payment and travel notice emails.</summary>
public class NoticeEmailRulesTests
{
    private static readonly byte[] Key = NoticeEmailRules.KeyFrom("a-test-signing-key-that-is-long-enough-for-hmac");

    [Fact]
    public void TheLinkIsBoundToTheUserAndTheCategory()
    {
        var token = NoticeEmailRules.Token(Key, 7, "payments")!;
        Assert.Equal((7L, "payments"), NoticeEmailRules.Verify(Key, token));
        Assert.Null(NoticeEmailRules.Verify(Key, token.Replace("7.", "8.")));
        Assert.Null(NoticeEmailRules.Verify(Key, token.Replace("payments", "checkin")));
        Assert.Null(NoticeEmailRules.Verify(Key, token + "x"));
        Assert.Null(NoticeEmailRules.Verify(NoticeEmailRules.KeyFrom("another-key-another-key-another-key-123456"), token));
        Assert.Null(NoticeEmailRules.Verify(Key, "nonsense"));
        Assert.Null(NoticeEmailRules.Verify(Key, null));
    }

    [Fact]
    public void SafetyNoticesHaveNoLinkAndCannotBeUnsubscribed()
    {
        Assert.Null(NoticeEmailRules.Token(Key, 7, "critical"));
        Assert.Null(NoticeEmailRules.Token(Key, 7, "nonsense"));
        Assert.Null(NoticeEmailRules.Verify(Key, "7.critical.abc"));
        var prefs = NoticeEmailRules.WithEmailOff(NotificationRules.NormalizePrefs(null), "critical");
        Assert.True(prefs["channels"]!["critical"]!["email"]!.GetValue<bool>());
    }

    [Fact]
    public void UnsubscribingTurnsOffOnlyThatCategorysEmail()
    {
        var prefs = NoticeEmailRules.WithEmailOff(NotificationRules.NormalizePrefs(null), "payments");
        Assert.False(prefs["channels"]!["payments"]!["email"]!.GetValue<bool>());
        Assert.True(prefs["channels"]!["payments"]!["push"]!.GetValue<bool>());
        Assert.True(prefs["channels"]!["checkin"]!["email"]!.GetValue<bool>());
    }

    [Fact]
    public void TheFooterIsAddedOnlyWhenThereIsALink()
    {
        Assert.Equal("Body", NoticeEmailRules.WithFooter("Body", null));
        Assert.EndsWith("open https://x/y", NoticeEmailRules.WithFooter("Body", "https://x/y"));
    }
}
