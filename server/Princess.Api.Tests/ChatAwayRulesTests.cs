using Princess.Api.Domain;
using static Princess.Api.Domain.ChatAwayRules;

namespace Princess.Api.Tests;

public class ChatAwayRulesTests
{
    [Theory]
    [InlineData(null, "ashore", Change.Left)]
    [InlineData("back", "ashore", Change.Left)]
    [InlineData("ashore", "back", Change.Returned)]
    [InlineData(null, "back", Change.None)]
    [InlineData("back", "back", Change.None)]
    [InlineData("ashore", "ashore", Change.None)]
    public void OnlyARealChangeTellsAnyone(string? previous, string next, Change change) => Assert.Equal(change, Transition(previous, next));

    [Theory]
    [InlineData("ashore", true)]
    [InlineData("back", true)]
    [InlineData("leaving", false)]
    [InlineData(null, false)]
    public void OnlyAshoreAndBackAreActedOn(string? status, bool acted) => Assert.Equal(acted, IsStatus(status));

    [Fact]
    public void TheWordsShareNothingButTheShip()
    {
        Assert.Equal("Sam R. left the ship", Line("Sam R.", Change.Left));
        Assert.Equal("Sam R. is back on the ship", Line("Sam R.", Change.Returned));
        Assert.Equal(("Sam R. left the ship", "Open Princess to see the chat."), Notice("Sam R.", Change.Left));
    }

    [Fact]
    public void ANoticeKeyIsPerPersonConversationChangeAndMoment()
    {
        var c = Guid.NewGuid();
        Assert.Equal(NoticeKey(c, 1, Change.Left, 5), NoticeKey(c, 1, Change.Left, 5));
        Assert.NotEqual(NoticeKey(c, 1, Change.Left, 5), NoticeKey(c, 2, Change.Left, 5));
        Assert.NotEqual(NoticeKey(c, 1, Change.Left, 5), NoticeKey(c, 1, Change.Returned, 5));
    }

    [Fact]
    public void ASupervisedChildCannotSwitchItOn()
    {
        Assert.False(MayEnable(true));
        Assert.True(MayEnable(false));
    }

    [Fact]
    public void TheHeaderNamesOnlyThoseWhoAreBackInOrder()
    {
        Assert.Equal(["Priya U.", "Sam R."], BackNames([("Sam R.", Back), ("Paul K.", Ashore), ("Priya U.", Back), ("Lee T.", null)]));
        Assert.Empty(BackNames([("Paul K.", Ashore)]));
    }
}
