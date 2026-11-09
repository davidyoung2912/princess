using System.Text.Json;
using System.Net;
using System.Text.Json.Nodes;
using Princess.Api.Contracts;
using Princess.Api.Domain;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

public class StateRulesTests
{
    [Fact]
    public void OnlyListedKeysHoldingAnObjectUnderTheCapAreAccepted()
    {
        Assert.Null(StateRules.Problem(StateRules.UserKeys, "settings", new JsonObject { ["calm"] = true }));
        Assert.Equal("badKey", StateRules.Problem(StateRules.UserKeys, "port", new JsonObject()));
        Assert.Equal("badKey", StateRules.Problem(StateRules.BookingKeys, "settings", new JsonObject()));
        Assert.Equal("badData", StateRules.Problem(StateRules.UserKeys, "settings", JsonValue.Create("x")));
        Assert.Equal("badData", StateRules.Problem(StateRules.UserKeys, "settings", null));
        Assert.Equal("tooLarge", StateRules.Problem(StateRules.UserKeys, "settings", new JsonObject { ["x"] = new string('a', 5_000) }));
    }
}

public class RecentStateRulesTests
{
    private static JsonObject Doc(params string[] paths) => new() { ["items"] = new JsonArray([.. paths.Select(p => (JsonNode)new JsonObject { ["path"] = p, ["at"] = 1762128000000 })]) };

    [Fact]
    public void UpToThreeAppAddressesAreAccepted()
    {
        Assert.Null(StateRules.Problem(StateRules.UserKeys, "recent", Doc()));
        Assert.Null(StateRules.Problem(StateRules.UserKeys, "recent", Doc("/book/resume/abc", "/plan/dining", "/home/sailings/sun-1?x=1#top")));
        Assert.Equal("badData", StateRules.Problem(StateRules.UserKeys, "recent", Doc("/a", "/b", "/c", "/d")));
    }

    [Theory]
    [InlineData("https://evil.example/x")]
    [InlineData("//evil.example/x")]
    [InlineData("javascript:alert(1)")]
    [InlineData("/ok:colon")]
    [InlineData("plan/dining")]
    [InlineData("/back\\slash")]
    [InlineData("")]
    public void AddressesThatCouldLeaveTheAppAreRefused(string path) =>
        Assert.Equal("badData", StateRules.Problem(StateRules.UserKeys, "recent", Doc(path)));

    [Fact]
    public void ABadShapeIsRefused()
    {
        Assert.Equal("badData", StateRules.Problem(StateRules.UserKeys, "recent", new JsonObject()));
        Assert.Equal("badData", StateRules.Problem(StateRules.UserKeys, "recent", new JsonObject { ["items"] = new JsonArray(JsonValue.Create("/a")) }));
        Assert.Equal("badData", StateRules.Problem(StateRules.UserKeys, "recent", new JsonObject { ["items"] = new JsonArray(new JsonObject { ["path"] = "/a" }) }));
        var big = Doc("/a"); big["note"] = new string('x', 2_000);
        Assert.Equal("tooLarge", StateRules.Problem(StateRules.UserKeys, "recent", big));
    }
}

public class StageWelcomeStateRulesTests
{
    private static JsonObject Doc(params string[] keys) => new() { ["seen"] = new JsonObject(keys.Select(k => KeyValuePair.Create(k, (JsonNode?)JsonValue.Create(1762128000000)))) };

    [Fact]
    public void StageAndStagePlusSailingKeysAreAccepted()
    {
        Assert.Null(StateRules.Problem(StateRules.UserKeys, "stageWelcome", Doc()));
        Assert.Null(StateRules.Problem(StateRules.UserKeys, "stageWelcome", Doc("dream", "discover", "manage:sun-1", "sea:alaska_2027.06")));
    }

    [Theory]
    [InlineData("nonsense")]
    [InlineData("manage:")]
    [InlineData("manage:has space")]
    [InlineData("manage:a/b")]
    [InlineData(":sun-1")]
    public void UnknownStagesAndOddSailingIdsAreRefused(string key) =>
        Assert.Equal("badData", StateRules.Problem(StateRules.UserKeys, "stageWelcome", Doc(key)));

    [Fact]
    public void ABadShapeOrTooManyEntriesIsRefused()
    {
        Assert.Equal("badData", StateRules.Problem(StateRules.UserKeys, "stageWelcome", new JsonObject()));
        Assert.Equal("badData", StateRules.Problem(StateRules.UserKeys, "stageWelcome", new JsonObject { ["seen"] = new JsonObject { ["dream"] = "yes" } }));
        var many = Doc([.. Enumerable.Range(0, StateRules.StageWelcomeMaxEntries + 1).Select(i => $"manage:s{i}")]);
        Assert.Equal("badData", StateRules.Problem(StateRules.UserKeys, "stageWelcome", many));
    }
}

public class StateApiTests : JourneyWorld
{
    private static SaveStateRequest Doc(string field, int baseVersion) => new(new JsonObject { [field] = true }, baseVersion);

    [Fact]
    public async Task ADocumentSavedOnOneDeviceIsReadOnAnother()
    {
        var phone = await SignIn(Daniel);
        var desktop = await SignIn(Daniel);
        Assert.Equal(JsonValueKind.Null, (await Get("/api/v1/me/state/settings", phone)).Json.ValueKind);
        var saved = await Call(HttpMethod.Put, "/api/v1/me/state/settings", phone, Doc("calm", 0));
        Assert.Equal(HttpStatusCode.OK, saved.Status);
        Assert.Equal(1, saved.Json.GetProperty("version").GetInt32());
        var read = await Get("/api/v1/me/state/settings", desktop);
        Assert.True(read.Json.GetProperty("data").GetProperty("calm").GetBoolean());
        var list = await Get("/api/v1/me/state", desktop);
        Assert.Equal(["settings"], list.Json.EnumerateArray().Select(x => x.GetProperty("key").GetString()));
    }

    [Fact]
    public async Task ASaveBasedOnAnOldVersionIsRefusedAndNobodyElsesStateIsVisible()
    {
        var phone = await SignIn(Daniel);
        await Call(HttpMethod.Put, "/api/v1/me/state/offers", phone, Doc("a", 0));
        var second = await Call(HttpMethod.Put, "/api/v1/me/state/offers", phone, Doc("b", 1));
        Assert.Equal(2, second.Json.GetProperty("version").GetInt32());
        var stale = await Call(HttpMethod.Put, "/api/v1/me/state/offers", phone, Doc("c", 1));
        Assert.Equal(HttpStatusCode.Conflict, stale.Status);
        Assert.Equal("stale", stale.ProblemTitle);
        var first = await Call(HttpMethod.Put, "/api/v1/me/state/offers", phone, Doc("d", 0));
        Assert.Equal(HttpStatusCode.Conflict, first.Status);
        Assert.Equal(JsonValueKind.Null, (await Get("/api/v1/me/state/offers", await SignIn(Priya))).Json.ValueKind);
    }

    [Fact]
    public async Task BadKeysBodiesAndDeletesAreHandled()
    {
        var token = await SignIn(Daniel);
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Put, "/api/v1/me/state/nope", token, Doc("a", 0))).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await Get("/api/v1/me/state/nope", token)).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Put, "/api/v1/me/state/shop", token, new SaveStateRequest(JsonValue.Create(3), 0))).Status);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/v1/me/state", null)).Status);
        await Call(HttpMethod.Put, "/api/v1/me/state/phone", token, Doc("a", 0));
        Assert.Equal(HttpStatusCode.NoContent, (await Call(HttpMethod.Delete, "/api/v1/me/state/phone", token)).Status);
        Assert.Equal(JsonValueKind.Null, (await Get("/api/v1/me/state/phone", token)).Json.ValueKind);
    }

    [Fact]
    public async Task BookingStateIsSharedByAdultGuestsAndHiddenFromStrangers()
    {
        var daniel = await SignIn(Daniel);
        var priya = await SignIn(Priya);
        var url = $"/api/v1/bookings/{Harper.Number}/state/port";
        Assert.Equal(HttpStatusCode.OK, (await Call(HttpMethod.Put, url, daniel, Doc("x", 0))).Status);
        Assert.True((await Get(url, priya)).Json.GetProperty("data").GetProperty("x").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, (await Call(HttpMethod.Put, url, priya, Doc("y", 1))).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await Get(url, await SignIn(Stranger))).Status);
        var child = await MayaToken_();
        Assert.Equal(HttpStatusCode.OK, (await Get(url, child)).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await Call(HttpMethod.Put, url, child, Doc("z", 2))).Status);
    }

    private Task<string> MayaToken_() => Task.FromResult(MayaToken());

    [Fact]
    public async Task ExportListsOwnDocumentsAndDeleteAllRemovesThemWithoutTouchingOthers()
    {
        var phone = await SignIn(Daniel);
        await Call(HttpMethod.Put, "/api/v1/me/state/settings", phone, Doc("calm", 0));
        await Call(HttpMethod.Put, "/api/v1/me/state/offers", phone, Doc("a", 0));
        var priya = await SignIn(Priya);
        await Call(HttpMethod.Put, "/api/v1/me/state/settings", priya, Doc("x", 0));

        var export = await Get("/api/v1/me/export", phone);
        Assert.Equal(HttpStatusCode.OK, export.Status);
        Assert.Equal(["offers", "settings"], export.Json.GetProperty("account").EnumerateArray().Select(x => x.GetProperty("key").GetString()));
        Assert.Equal(JsonValueKind.Array, export.Json.GetProperty("trips").ValueKind);

        var gone = await Call(HttpMethod.Delete, "/api/v1/me/state", phone);
        Assert.Equal(HttpStatusCode.NoContent, gone.Status);
        Assert.Equal(0, (await Get("/api/v1/me/export", phone)).Json.GetProperty("account").GetArrayLength());
        Assert.Equal(1, (await Get("/api/v1/me/export", priya)).Json.GetProperty("account").GetArrayLength());
    }

    [Fact]
    public async Task HealthDetailsNeedConsentAndAreEncryptedAtRest()
    {
        var phone = await SignIn(Daniel);
        var refused = await Call(HttpMethod.Put, "/api/v1/me/state/health", phone, new SaveStateRequest(new JsonObject { ["allergy"] = "peanuts" }, 0));
        Assert.Equal(HttpStatusCode.Forbidden, refused.Status);

        await Call(HttpMethod.Put, "/api/v1/me/state/settings", phone, new SaveStateRequest(new JsonObject { ["syncPrivate"] = true }, 0));
        var saved = await Call(HttpMethod.Put, "/api/v1/me/state/health", phone, new SaveStateRequest(new JsonObject { ["allergy"] = "peanuts" }, 0));
        Assert.Equal(HttpStatusCode.OK, saved.Status);

        var stored = F.State.Rows.Single(r => r.Key.Key == "health").Value.Json;
        Assert.DoesNotContain("peanuts", stored);
        Assert.Equal("peanuts", (await Get("/api/v1/me/state/health", phone)).Json.GetProperty("data").GetProperty("allergy").GetString());
        var export = await Get("/api/v1/me/export", phone);
        Assert.Contains("peanuts", export.Json.GetProperty("account").EnumerateArray().First(x => x.GetProperty("key").GetString() == "health").GetProperty("data").ToString());
    }

    [Fact]
    public void SavedTravellersAreKeptEncryptedAndTheReminderInTheClear()
    {
        Assert.Contains("travellers", StateRules.EncryptedKeys);
        Assert.DoesNotContain("reminder", StateRules.EncryptedKeys);
        Assert.Null(StateRules.Problem(StateRules.UserKeys, "travellers", new JsonObject { ["travellers"] = new JsonArray() }));
        Assert.Null(StateRules.Problem(StateRules.UserKeys, "reminder", new JsonObject { ["at"] = 1 }));
        Assert.Equal("badData", StateRules.Problem(StateRules.UserKeys, "reminder", new JsonArray()));
    }
}
