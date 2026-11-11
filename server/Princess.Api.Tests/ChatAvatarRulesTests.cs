using Princess.Api.Domain;

namespace Princess.Api.Tests;

public class ChatAvatarRulesTests
{
    [Fact]
    public void An_id_is_trimmed_and_lower_cased() => Assert.Equal("bottts-31", ChatAvatarRules.Normalise(" Bottts-31 "));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Blank_means_the_initials(string? value) => Assert.Null(ChatAvatarRules.Normalise(value));

    [Theory]
    [InlineData("sea:anchor")]
    [InlineData("../etc")]
    [InlineData("bottts_31")]
    [InlineData("<script>")]
    [InlineData("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
    public void A_malformed_id_is_refused(string value)
    {
        Assert.False(ChatAvatarRules.WellFormed(value));
        Assert.Null(ChatAvatarRules.Normalise(value));
    }
}
