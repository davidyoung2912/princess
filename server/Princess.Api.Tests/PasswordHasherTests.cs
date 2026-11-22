using Princess.Api.Auth;

namespace Princess.Api.Tests;

public class PasswordHasherTests
{
    private readonly Pbkdf2PasswordHasher _hasher = new();

    [Fact]
    public void HashesAndVerifies()
    {
        var stored = _hasher.Hash("Sailaway!2027");
        Assert.StartsWith("pbkdf2$600000$", stored);
        Assert.True(_hasher.Verify("Sailaway!2027", stored));
        Assert.False(_hasher.Verify("sailaway!2027", stored));
    }

    [Fact]
    public void SamePasswordGetsDifferentSalts() =>
        Assert.NotEqual(_hasher.Hash("same"), _hasher.Hash("same"));

    [Fact]
    public void VerifiesTheHashTheTypeScriptSeedGeneratorWrote()
    {
        // gerald, from db/seed/personas/01-users.sql (scripts/persona-seed.ts hashPassword): a seeded account's password is its username.
        const string seeded = "pbkdf2$600000$g48+sA3WWTtOwPb66gYJhw==$Fo+MDDU1YsZzOBvE1iR8uaxIR0yzl3vL1jvzJ7GHK770pMQ/GpTdvAhmWzix4XyejOsoP7r9AHlO7bX3l368Fw==";
        Assert.True(_hasher.Verify("gerald", seeded));
        Assert.False(_hasher.Verify("Sailaway!2027", seeded));
        Assert.False(_hasher.Verify("wrong", seeded));
    }

    [Theory]
    [InlineData("")]
    [InlineData("plaintext")]
    [InlineData("pbkdf2$x$y$z")]
    [InlineData("pbkdf2$1000$not base64!$AAAA")]
    [InlineData("md5$1000$AAAA$AAAA")]
    [InlineData("pbkdf2$1000$AAAA$")]
    public void MalformedStoredHashIsRejectedNotThrown(string stored) =>
        Assert.False(_hasher.Verify("anything", stored));
}
