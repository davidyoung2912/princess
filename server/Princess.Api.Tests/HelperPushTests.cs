using Xunit;
using Princess.Api.Domain;

namespace Princess.Api.Tests;

public class HelperPushTests
{
    private static PushInput Input(params string[] prepared) =>
        new(new DateTime(2027, 1, 1, 12, 0, 0, DateTimeKind.Utc), "ok", "", null, false, 45, false, [], [], 0, [], HelperPrepared: prepared);

    [Fact]
    public void One_plain_notice_per_prepared_item_with_no_names()
    {
        var notices = PushRules.Build(Input("a1", "b2")).Where(n => n.Kind == "helper").ToList();
        Assert.Equal(2, notices.Count);
        Assert.All(notices, n => { Assert.False(n.Bypass); Assert.Equal("/me/helper", n.Path); Assert.DoesNotContain("poll", n.Body, StringComparison.OrdinalIgnoreCase); });
        Assert.Equal(["helper:a1", "helper:b2"], notices.Select(n => n.Key).OrderBy(k => k));
    }

    [Fact]
    public void Nothing_prepared_means_no_notice() => Assert.DoesNotContain(PushRules.Build(Input()), n => n.Kind == "helper");

    [Fact]
    public void Helper_is_a_known_kind() => Assert.Contains(PushRules.Kinds, k => k == "helper");
}
