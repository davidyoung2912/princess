using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Checking a phone number by text before notices go to it.</summary>
public class PhoneRulesTests
{
    private static readonly byte[] Key = PhoneRules.KeyFrom("a-test-signing-key-that-is-long-enough-for-hmac");
    private const string Phone = "+1 (555) 010-0123";
    private const long Now = 1_700_000_000_000;

    private static PhoneCheckDoc Waiting(string code, string phone = Phone, long sentAt = Now)
    {
        var n = PhoneRules.Normalise(phone);
        return new(null, n, PhoneRules.Hash(Key, "salt", n, code), "salt", sentAt + PhoneRules.CodeMinutes * 60_000L, 0, sentAt);
    }

    [Fact]
    public void NumbersCompareWithoutSpacingOrDashes()
    {
        Assert.Equal("+15550100123", PhoneRules.Normalise(Phone));
        Assert.Equal("5550100123", PhoneRules.Normalise("555-010-0123"));
        Assert.Equal("", PhoneRules.Normalise(" "));
        Assert.Equal("", PhoneRules.Normalise(null));
    }

    [Fact]
    public void TheRightCodeConfirmsThatNumberAndClearsTheCode()
    {
        var (r, doc) = PhoneRules.Check(Waiting("123456"), Key, Phone, " 123456 ", Now + 1000);
        Assert.Equal(PhoneRules.Result.Verified, r);
        Assert.True(PhoneRules.IsVerified(doc, "+1 555 010 0123"));
        Assert.Null(doc.Hash);
    }

    [Fact]
    public void ChangingTheNumberMakesItUnconfirmedAgain()
    {
        var (_, doc) = PhoneRules.Check(Waiting("123456"), Key, Phone, "123456", Now);
        Assert.False(PhoneRules.IsVerified(doc, "+1 555 010 9999"));
        Assert.False(PhoneRules.IsVerified(doc, ""));
        Assert.False(PhoneRules.IsVerified(doc, null));
    }

    [Fact]
    public void ACodeMadeForAnotherNumberDoesNotConfirmTheNewOne()
    {
        var (r, _) = PhoneRules.Check(Waiting("123456"), Key, "+1 555 010 9999", "123456", Now);
        Assert.Equal(PhoneRules.Result.NoCode, r);
    }

    [Fact]
    public void WrongCodesAreCountedAndStopAfterFiveEvenForTheRightCode()
    {
        var doc = Waiting("123456");
        for (var i = 0; i < PhoneRules.MaxAttempts; i++)
        {
            var (r, next) = PhoneRules.Check(doc, Key, Phone, "000000", Now);
            Assert.Equal(PhoneRules.Result.Wrong, r);
            doc = next;
        }
        Assert.Equal(PhoneRules.Result.TooMany, PhoneRules.Check(doc, Key, Phone, "123456", Now).Result);
    }

    [Theory]
    [InlineData("12345")]
    [InlineData("abcdef")]
    [InlineData("")]
    [InlineData(null)]
    public void MalformedCodesAreWrong(string? typed) =>
        Assert.Equal(PhoneRules.Result.Wrong, PhoneRules.Check(Waiting("123456"), Key, Phone, typed, Now).Result);

    [Fact]
    public void ACodeExpiresAfterTenMinutes() =>
        Assert.Equal(PhoneRules.Result.Expired, PhoneRules.Check(Waiting("123456"), Key, Phone, "123456", Now + 11 * 60_000L).Result);

    [Fact]
    public void ACodeCanBeAskedForAgainAfterAMinute()
    {
        var d = Waiting("123456");
        Assert.False(PhoneRules.CanSend(d, Now + 30_000));
        Assert.True(PhoneRules.CanSend(d, Now + 60_000));
        Assert.True(PhoneRules.CanSend(PhoneRules.Parse(null), Now));
    }

    [Fact]
    public void TheDocumentRoundTripsAndBadJsonIsEmpty()
    {
        var d = Waiting("123456");
        Assert.Equal(d, PhoneRules.Parse(PhoneRules.ToJson(d)));
        Assert.Null(PhoneRules.Parse("not json").Hash);
    }
}
