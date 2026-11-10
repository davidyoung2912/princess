using Princess.Api.Domain;

namespace Princess.Api.Tests;

public class ChatAvatarRulesTests
{
    [Fact]
    public void A_known_colour_and_icon_is_kept() => Assert.Equal("coral:anchor", ChatAvatarRules.Normalise(" Coral:Anchor "));

    [Fact]
    public void Initials_is_an_icon() => Assert.Equal("sea:initials", ChatAvatarRules.Normalise("sea:initials"));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("red:anchor")]
    [InlineData("sea:skull")]
    [InlineData("sea")]
    [InlineData("sea:anchor:extra")]
    [InlineData("<script>:x")]
    public void Anything_else_is_refused(string? value) => Assert.Null(ChatAvatarRules.Normalise(value));
}
