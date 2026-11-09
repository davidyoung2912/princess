using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Checking an email address by emailed code before notice emails go to it.</summary>
public class EmailRulesTests
{
    private static readonly byte[] Key = EmailRules.KeyFrom("a-test-signing-key-that-is-long-enough-for-hmac");
    private const string Email = "Guest@Example.com";
    private const long Now = 1_700_000_000_000;

    private static PhoneCheckDoc Waiting(string code, string email = Email)
    {
        var n = EmailRules.Normalise(email);
        return new(null, n, PhoneRules.Hash(Key, "salt", n, code), "salt", Now + PhoneRules.CodeMinutes * 60_000L, 0, Now);
    }

    [Fact]
    public void CapitalLettersDoNotMatter() => Assert.Equal("guest@example.com", EmailRules.Normalise("  Guest@Example.COM "));

    [Fact]
    public void TheRightCodeConfirmsThatAddress()
    {
        var (r, doc) = EmailRules.Check(Waiting("123456"), Key, Email, " 123456 ", Now + 1000);
        Assert.Equal(PhoneRules.Result.Verified, r);
        Assert.True(EmailRules.IsVerified(doc, "guest@example.com"));
        Assert.Null(doc.Hash);
    }

    [Fact]
    public void ChangingTheAddressMakesItUnconfirmedAgain()
    {
        var (_, doc) = EmailRules.Check(Waiting("123456"), Key, Email, "123456", Now);
        Assert.False(EmailRules.IsVerified(doc, "other@example.com"));
        Assert.False(EmailRules.IsVerified(doc, null));
    }

    [Fact]
    public void ACodeForAnotherAddressIsNotAccepted()
    {
        var (r, _) = EmailRules.Check(Waiting("123456"), Key, "other@example.com", "123456", Now);
        Assert.Equal(PhoneRules.Result.NoCode, r);
    }

    [Fact]
    public void WrongCodesAreCountedAndStopAfterTheLimit()
    {
        var d = Waiting("123456");
        for (var i = 0; i < PhoneRules.MaxAttempts; i++)
        {
            var (r, next) = EmailRules.Check(d, Key, Email, "000000", Now);
            Assert.Equal(PhoneRules.Result.Wrong, r);
            d = next;
        }
        Assert.Equal(PhoneRules.Result.TooMany, EmailRules.Check(d, Key, Email, "123456", Now).Result);
    }

    [Fact]
    public void ACodeRunsOut() =>
        Assert.Equal(PhoneRules.Result.Expired, EmailRules.Check(Waiting("123456"), Key, Email, "123456", Now + (PhoneRules.CodeMinutes * 60_000L) + 1).Result);

    [Fact]
    public void ThePhoneKeyDoesNotOpenTheEmailCheck()
    {
        var phoneKey = PhoneRules.KeyFrom("a-test-signing-key-that-is-long-enough-for-hmac");
        Assert.NotEqual(phoneKey, Key);
    }
}
