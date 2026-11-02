using System.Net;
using System.Text.Json.Nodes;
using Princess.Api.Domain;
using Princess.Api.Services;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

public class PortRowRulesTests
{
    [Fact]
    public void OnlyKnownKindsShortKeysAndSmallDataAreAccepted()
    {
        var data = new JsonObject { ["status"] = "back" };
        Assert.Null(PortRowRules.Problem("presence", "2027-03-23|daniel", data, false, 5));
        Assert.Null(PortRowRules.Problem("item", "i1", null, true, 5));
        Assert.Equal("badPortRow", PortRowRules.Problem("nope", "k", data, false, 5));
        Assert.Equal("badPortRow", PortRowRules.Problem("item", "has space", data, false, 5));
        Assert.Equal("badPortRow", PortRowRules.Problem("item", new string('k', 91), data, false, 5));
        Assert.Equal("badPortRow", PortRowRules.Problem("item", "i1", null, false, 5));
        Assert.Equal("badPortRow", PortRowRules.Problem("item", "i1", new JsonObject { ["x"] = new string('a', 2_100) }, false, 5));
        Assert.Equal("badPortRow", PortRowRules.Problem("item", "i1", data, false, -1));
    }

    [Fact]
    public void AClockAheadOfTheServerIsCutBack()
    {
        Assert.Equal(1_000 + PortRowRules.FutureSlackMs, PortRowRules.ClampAt(9_999_999_999_999, 1_000));
        Assert.Equal(500, PortRowRules.ClampAt(500, 1_000));
    }
}

public class PortRowApiTests : JourneyWorld
{
    private string Url => $"/api/v1/bookings/{Harper.Number}/port-rows";

    private static PortRowDto Row(string kind, string key, long at, JsonNode? data = null, bool deleted = false) =>
        new(kind, key, deleted ? null : data ?? new JsonObject { ["v"] = 1 }, at, deleted);

    private static PortRowsRequest Ops(params PortRowDto[] ops) => new([.. ops]);

    private static long Now => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    [Fact]
    public async Task AdultsShareRowsAndAStrangerAndAnOutsiderSeeNothing()
    {
        var daniel = await SignIn(Daniel);
        var t = Now - 10_000;
        var saved = await Call(HttpMethod.Post, Url, daniel, Ops(Row("item", "i1", t), Row("presence", "2027-03-23|daniel", t)));
        Assert.Equal(HttpStatusCode.OK, saved.Status);
        Assert.Equal(2, saved.Json.GetProperty("rows").GetArrayLength());
        Assert.Equal(2, (await Get(Url, await SignIn(Priya))).Json.GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await Get(Url, await SignIn(Stranger))).Status);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get(Url, null)).Status);
    }

    [Fact]
    public async Task ADeletedRowStaysDeletedWhenAnOlderDeviceSendsItAgain()
    {
        var daniel = await SignIn(Daniel);
        var priya = await SignIn(Priya);
        var t = Now - 60_000;
        await Call(HttpMethod.Post, Url, daniel, Ops(Row("item", "taxi", t)));
        await Call(HttpMethod.Post, Url, priya, Ops(Row("item", "taxi", t + 5_000, deleted: true)));
        // Daniel's phone was offline and sends its old copy of the row again.
        var again = await Call(HttpMethod.Post, Url, daniel, Ops(Row("item", "taxi", t)));
        var row = again.Json.GetProperty("rows").EnumerateArray().Single();
        Assert.True(row.GetProperty("deleted").GetBoolean());
        Assert.Equal(t + 5_000, row.GetProperty("at").GetInt64());
    }

    [Fact]
    public async Task TheLaterChangeWinsAndATieKeepsTheStoredRow()
    {
        var daniel = await SignIn(Daniel);
        var t = Now - 60_000;
        await Call(HttpMethod.Post, Url, daniel, Ops(Row("meetState", "m1|daniel", t, new JsonObject { ["v"] = "onway" })));
        await Call(HttpMethod.Post, Url, daniel, Ops(Row("meetState", "m1|daniel", t, new JsonObject { ["v"] = "tie" })));
        var later = await Call(HttpMethod.Post, Url, daniel, Ops(Row("meetState", "m1|daniel", t + 1, new JsonObject { ["v"] = "here" })));
        Assert.Equal("here", later.Json.GetProperty("rows")[0].GetProperty("data").GetProperty("v").GetString());
        var older = await Call(HttpMethod.Post, Url, daniel, Ops(Row("meetState", "m1|daniel", t - 1, new JsonObject { ["v"] = "waiting" })));
        Assert.Equal("here", older.Json.GetProperty("rows")[0].GetProperty("data").GetProperty("v").GetString());
    }

    [Fact]
    public async Task ABatchKeepsTheLatestChangeOfEachRowAndACloseClockIsNotCut()
    {
        var daniel = await SignIn(Daniel);
        var t = Now - 60_000;
        var saved = await Call(HttpMethod.Post, Url, daniel, Ops(Row("item", "a", t + 9), Row("item", "a", t, deleted: true), Row("setting", "alertBefore", Now + 10_000_000_000)));
        var rows = saved.Json.GetProperty("rows").EnumerateArray().ToList();
        Assert.Equal(2, rows.Count);
        Assert.False(rows.Single(r => r.GetProperty("key").GetString() == "a").GetProperty("deleted").GetBoolean());
        // A clock far ahead is cut back to a few minutes past the server's.
        Assert.True(rows.Single(r => r.GetProperty("kind").GetString() == "setting").GetProperty("at").GetInt64() < Now + 10 * 60_000);
    }

    [Fact]
    public async Task BadRowsTooManyOpsAndAChildAreRefused()
    {
        var daniel = await SignIn(Daniel);
        Assert.Equal("badPortRow", (await Call(HttpMethod.Post, Url, daniel, Ops(Row("nope", "k", 1)))).ProblemTitle);
        Assert.Equal("badPortRow", (await Call(HttpMethod.Post, Url, daniel, Ops())).ProblemTitle);
        Assert.Equal("tooManyOps", (await Call(HttpMethod.Post, Url, daniel, Ops([.. Enumerable.Range(0, 101).Select(i => Row("item", $"i{i}", 1))]))).ProblemTitle);
        var child = MayaToken();
        Assert.Equal(HttpStatusCode.OK, (await Get(Url, child)).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await Call(HttpMethod.Post, Url, child, Ops(Row("presence", "2027-03-23|maya", 1)))).Status);
    }

    [Fact]
    public async Task AFullBookingRefusesNewRowsButStillTakesChangesToOldOnes()
    {
        var daniel = await SignIn(Daniel);
        var t = Now - 60_000;
        for (var b = 0; b < PortRowRules.MaxRows / PortRowRules.MaxOps; b++)
            await Call(HttpMethod.Post, Url, daniel, Ops([.. Enumerable.Range(0, PortRowRules.MaxOps).Select(i => Row("item", $"r{b}-{i}", t))]));
        Assert.Equal("tooManyRows", (await Call(HttpMethod.Post, Url, daniel, Ops(Row("item", "one-more", t)))).ProblemTitle);
        Assert.Equal(HttpStatusCode.OK, (await Call(HttpMethod.Post, Url, daniel, Ops(Row("item", "r0-0", t + 1, deleted: true)))).Status);
    }

    [Fact]
    public async Task OldDeletedRowsAreDroppedAndTheExportListsTheRows()
    {
        var daniel = await SignIn(Daniel);
        var old = Now - (PortRowRules.TombstoneDays + 1) * 86_400_000L;
        await Call(HttpMethod.Post, Url, daniel, Ops(Row("item", "gone", old, deleted: true), Row("item", "kept", Now - 1_000)));
        await Call(HttpMethod.Post, Url, daniel, Ops(Row("item", "kept", Now - 500)));
        Assert.DoesNotContain(F.PortRows.Rows.Keys, k => k.Key == "gone");
        var export = await Get("/api/v1/me/export", daniel);
        var docs = export.Json.GetProperty("bookings").EnumerateArray().Single(b => b.GetProperty("number").GetString() == Harper.Number).GetProperty("documents");
        Assert.Contains(docs.EnumerateArray(), d => d.GetProperty("key").GetString() == "port-rows");
    }
}
