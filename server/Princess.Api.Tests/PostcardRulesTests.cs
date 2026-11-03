using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class PostcardRulesTests
{
    [Fact]
    public void ReadsOnlyUsableItemsAndNeverMoreThanFive()
    {
        Assert.Empty(PostcardRules.Parse(null));
        Assert.Empty(PostcardRules.Parse("[]"));
        Assert.Empty(PostcardRules.Parse("""{"items":3}"""));
        var list = PostcardRules.Parse("""{"items":[{"id":"a","sailingId":"s1"},{"id":"a","sailingId":"s1"},{"sailingId":"s1"},{"id":"b"},{"id":"c"},{"id":"d"},{"id":"e"},{"id":"f"}]}""");
        Assert.Equal(["a", "b", "c", "d", "e"], list.Select(p => p.Id));
        Assert.Equal("", list[1].SailingId);
    }

    [Fact]
    public void ArrivesOnALaterTripWithinSixtyDaysAndNotBefore()
    {
        var cards = new[] { new PostcardRef("a", "s1"), new PostcardRef("b", "s2") };
        Assert.Equal(["a"], PostcardRules.Due(cards, "s2", 60));
        Assert.Empty(PostcardRules.Due(cards, "s2", 61));
        Assert.Empty(PostcardRules.Due(cards, "s2", -1));
        Assert.Equal(["a", "b"], PostcardRules.Due(cards, "other", 0));
    }

    [Fact]
    public void ASingleNoticeCarriesNoneOfTheGuestsWords()
    {
        var input = new PushInput(new DateTime(2027, 1, 1, 12, 0, 0, DateTimeKind.Utc), "ok", "", null, false, 45, false, [], [], 0, [], PostcardIds: ["a", "b"]);
        var note = Assert.Single(PushRules.Build(input));
        Assert.Equal("postcard:a", note.Key);
        Assert.Equal("reminder", note.Kind);
        Assert.False(note.Bypass);
    }

    [Fact]
    public void ThePostcardsDocumentIsAKnownSmallKey() =>
        Assert.Null(StateRules.Problem(StateRules.UserKeys, "postcards", new System.Text.Json.Nodes.JsonObject { ["items"] = new System.Text.Json.Nodes.JsonArray() }));
}
