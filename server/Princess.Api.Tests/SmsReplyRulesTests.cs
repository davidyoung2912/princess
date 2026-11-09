using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Stopping text notices by replying STOP.</summary>
public class SmsReplyRulesTests
{
    [Theory]
    [InlineData("STOP")]
    [InlineData(" stop. ")]
    [InlineData("Unsubscribe")]
    [InlineData("StopAll")]
    [InlineData("quit!")]
    public void StopWordsAreRecognised(string body) => Assert.True(SmsReplyRules.IsStop(body));

    [Theory]
    [InlineData("please stop texting me")]
    [InlineData("stopping by later")]
    [InlineData("")]
    [InlineData(null)]
    public void OtherRepliesAreNot(string? body) => Assert.False(SmsReplyRules.IsStop(body));

    [Fact]
    public void NumbersMatchWithoutFormattingOrWithACountryCode()
    {
        Assert.True(SmsReplyRules.SameNumber("+15550100123", "(555) 010-0123 ".Replace("(555)", "+1 555")));
        Assert.True(SmsReplyRules.SameNumber("+15550100123", "555-010-0123"));
        Assert.False(SmsReplyRules.SameNumber("+15550100123", "555-010-9999"));
        Assert.False(SmsReplyRules.SameNumber("123", "123"));
        Assert.False(SmsReplyRules.SameNumber(null, "555-010-0123"));
    }

    [Fact]
    public void TheTailNarrowsTheSearch()
    {
        Assert.Equal("0123", SmsReplyRules.Tail("+1 555 010 0123"));
        Assert.Null(SmsReplyRules.Tail("12345"));
    }

    [Fact]
    public void StoppingTurnsTextOffForEveryCategoryButSafety()
    {
        var next = SmsReplyRules.WithSmsOff(NotificationRules.NormalizePrefs(null));
        var ch = next["channels"]!.AsObject();
        foreach (var c in NotificationRules.Categories)
        {
            var row = ch[c]!.AsObject();
            Assert.Equal(c == "critical", row["sms"]!.GetValue<bool>());
        }
        Assert.True(ch["critical"]!["push"]!.GetValue<bool>());
    }

    [Fact]
    public void ASignatureMustMatchTheBodyAndBeRecent()
    {
        const string key = "provider-signing-key", body = "{\"from\":\"+15550100123\",\"body\":\"STOP\"}";
        const long now = 1_700_000_000;
        var sig = SmsReplyRules.Sign(key, now.ToString(), body);
        Assert.True(SmsReplyRules.SignatureOk(key, now.ToString(), sig, body, now + 60));
        Assert.True(SmsReplyRules.SignatureOk(key, now.ToString(), sig.ToUpperInvariant().Replace("SHA256=", "sha256="), body, now));
        Assert.False(SmsReplyRules.SignatureOk(key, now.ToString(), sig, body.Replace("STOP", "HELP"), now));
        Assert.False(SmsReplyRules.SignatureOk("other-key", now.ToString(), sig, body, now));
        Assert.False(SmsReplyRules.SignatureOk(key, now.ToString(), sig, body, now + SmsReplyRules.SignatureToleranceSeconds + 1));
        Assert.False(SmsReplyRules.SignatureOk(key, "soon", sig, body, now));
        Assert.False(SmsReplyRules.SignatureOk("", now.ToString(), sig, body, now));
        Assert.False(SmsReplyRules.SignatureOk(key, now.ToString(), "", body, now));
    }

    [Fact]
    public void TheSecretMustMatchAndMustBeSet()
    {
        Assert.True(SmsReplyRules.SecretOk("s3cret", "s3cret"));
        Assert.False(SmsReplyRules.SecretOk("s3cret", "other"));
        Assert.False(SmsReplyRules.SecretOk("", ""));
        Assert.False(SmsReplyRules.SecretOk(null, "x"));
        Assert.False(SmsReplyRules.SecretOk("s3cret", null));
    }
}
