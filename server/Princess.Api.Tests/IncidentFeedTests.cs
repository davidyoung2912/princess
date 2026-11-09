using Microsoft.Extensions.Configuration;
using Princess.Api.Services;

namespace Princess.Api.Tests;

public class IncidentFeedTests
{
    private static ConfigIncidentFeed Feed(params (string Key, string Value)[] values) =>
        new(new ConfigurationBuilder().AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>($"Status:Incidents:{v.Key}", v.Value))).Build());

    [Fact]
    public void ListsDeclaredIncidentsNewestFirstAndSkipsIncompleteOnes()
    {
        var past = DateTimeOffset.UtcNow.AddHours(-3).ToString("o");
        var older = DateTimeOffset.UtcNow.AddHours(-9).ToString("o");
        var feed = Feed(
            ("0:Id", "a"), ("0:Area", "chat"), ("0:StartedAt", older), ("0:Message", "Chat is slow."),
            ("1:Id", "b"), ("1:Area", "dining"), ("1:StartedAt", past), ("1:Message", "Booking tables is down."),
            ("2:Id", "c"), ("2:Area", "nonsense"), ("2:StartedAt", past), ("2:Message", "Unknown area."),
            ("3:Id", "d"), ("3:Area", "chat"), ("3:StartedAt", "not a time"), ("3:Message", "Bad time."),
            ("4:Id", "e"), ("4:Area", "chat"), ("4:StartedAt", DateTimeOffset.UtcNow.AddHours(2).ToString("o")), ("4:Message", "Not started yet."));
        Assert.Equal(["b", "a"], feed.Current().Select(i => i.Id));
    }

    [Fact]
    public void KeepsAResolvedIncidentForADayThenDropsIt()
    {
        var started = DateTimeOffset.UtcNow.AddDays(-3).ToString("o");
        var recent = DateTimeOffset.UtcNow.AddHours(-2).ToString("o");
        var long_ago = DateTimeOffset.UtcNow.AddDays(-2).ToString("o");
        var feed = Feed(
            ("0:Id", "new"), ("0:Area", "photos"), ("0:StartedAt", started), ("0:Message", "Photos failed."), ("0:ResolvedAt", recent),
            ("1:Id", "old"), ("1:Area", "photos"), ("1:StartedAt", started), ("1:Message", "Photos failed."), ("1:ResolvedAt", long_ago));
        var list = feed.Current();
        Assert.Equal(["new"], list.Select(i => i.Id));
        Assert.NotNull(list[0].ResolvedAt);
    }
}
