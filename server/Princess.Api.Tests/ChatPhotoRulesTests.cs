using Princess.Api.Domain;

namespace Princess.Api.Tests;

public class ChatPhotoRulesTests
{
    [Fact]
    public void A_message_may_carry_ten_photos_in_all() => Assert.Equal(9, ChatPhotoRules.MaxMore);

    [Fact]
    public void Photos_within_the_total_are_accepted() =>
        Assert.False(ChatPhotoRules.TotalTooLarge([new string('a', 1_000_000), new string('b', 1_000_000)]));

    [Fact]
    public void Photos_over_the_total_are_refused() =>
        Assert.True(ChatPhotoRules.TotalTooLarge(Enumerable.Repeat(new string('a', 1_400_000), 5)));
}
