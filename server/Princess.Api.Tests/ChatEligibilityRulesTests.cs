using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-features-research.md, phase 5: who may chat with whom at each stage.</summary>
public class ChatEligibilityRulesTests
{
    [Theory]
    [InlineData(StageRules.Dream)]
    [InlineData(StageRules.Discover)]
    [InlineData(StageRules.Book)]
    public void AGuestWithoutAConfirmedBookingHasOnlyStanley(string stage)
    {
        var e = ChatEligibilityRules.For(stage, hasConfirmedBooking: false);
        Assert.True(e.Stanley);
        Assert.False(e.Party);
        Assert.False(e.People);
        Assert.False(e.GuestServices);
        Assert.False(e.Keep);
        Assert.Equal(ChatEligibilityRules.BeforeBooking, e.Reason);
        Assert.False(ChatEligibilityRules.MayAsk(stage, false));
    }

    [Theory]
    [InlineData(StageRules.Manage)]
    [InlineData(StageRules.Prebook)]
    [InlineData(StageRules.GetToShip)]
    [InlineData(StageRules.Embark)]
    [InlineData(StageRules.Sea)]
    [InlineData(StageRules.Port)]
    [InlineData(StageRules.Disembark)]
    [InlineData(StageRules.Remember)]
    public void ABookedGuestCanChatWithTheirPartyAndTheSailing(string stage)
    {
        var e = ChatEligibilityRules.For(stage, hasConfirmedBooking: true);
        Assert.True(e.Stanley && e.Party && e.People && e.GuestServices && e.Keep);
        Assert.Null(e.Reason);
    }

    [Fact]
    public void AConfirmedBookingDecidesWhateverTheStageNameSays()
    {
        // A guest planning a second cruise is at Discover but still has the first booking.
        Assert.True(ChatEligibilityRules.For(StageRules.Discover, true).People);
    }

    [Fact]
    public void AnUnknownStageIsTreatedAsTheEarliest()
    {
        var e = ChatEligibilityRules.For("nonsense", false);
        Assert.Equal(StageRules.Dream, e.Stage);
        Assert.True(e.Stanley);
        Assert.False(e.People);
    }

    [Fact]
    public void StanleyIsOnAtEveryStage()
    {
        foreach (var stage in StageRules.All)
            foreach (var booked in new[] { false, true })
                Assert.True(ChatEligibilityRules.For(stage, booked).Stanley);
    }
}
