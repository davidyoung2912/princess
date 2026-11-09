using System.Text.Json.Nodes;
using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Next-level plan N4: sharing inside a party is off until each person turns it on, and a status reaches the others only with that person's say.</summary>
public class PartyRulesTests
{
    private static JsonNode Json(string text) => JsonNode.Parse(text)!;

    [Fact]
    public void EverythingIsOffUntilThePersonTurnsItOn()
    {
        foreach (var f in PartyRules.Facets) Assert.False(PartyRules.Shares(null, f));
        Assert.False(PartyRules.Shares(Json("{}"), "status"));
        Assert.False(PartyRules.Shares(Json("""{"status":"yes"}"""), "status"));
        Assert.True(PartyRules.Shares(Json("""{"status":true}"""), "status"));
    }

    [Fact]
    public void TheMedicalCardHasNoSwitchAndIsNeverShared()
    {
        Assert.False(PartyRules.Shares(Json("""{"medical":true}"""), "medical"));
        Assert.DoesNotContain("medical", PartyRules.Facets);
        Assert.Null(PartyRules.Clean(Json("""{"medical":true,"plans":true}"""))["medical"]);
    }

    [Fact]
    public void CleanKeepsOnlyTheFourSwitchesAndDefaultsToOff()
    {
        var clean = PartyRules.Clean(Json("""{"plans":true,"extra":1}"""));
        Assert.Equal("""{"plans":true,"status":false,"spending":false,"photos":false}""", clean.ToJsonString());
    }

    [Fact]
    public void AStatusIsSeenByThePersonTheirBookerForAChildAndAnyoneItIsSharedWith()
    {
        // Another adult sees nothing unless the person shares.
        Assert.False(PartyRules.MayViewStatus(viewerId: 1, subjectId: 2, subjectSupervised: false, subjectBookerId: null, subjectSharing: null));
        Assert.True(PartyRules.MayViewStatus(1, 2, false, null, Json("""{"status":true}""")));
        // The person themself, and the booker of a supervised child.
        Assert.True(PartyRules.MayViewStatus(2, 2, false, null, null));
        Assert.True(PartyRules.MayViewStatus(1, 3, true, 1, null));
        // Not a different adult's child.
        Assert.False(PartyRules.MayViewStatus(4, 3, true, 1, null));
        // Switching it off again hides it at once.
        Assert.False(PartyRules.MayViewStatus(1, 2, false, null, Json("""{"status":false}""")));
    }

    [Fact]
    public void TheLogShowsTheNewestChangesToTheSharedPlanOnly()
    {
        var rows = new List<(string, JsonNode?, long, bool)>
        {
            ("poll", Json("""{"question":"Where to eat?"}"""), 100, false),
            ("presence", Json("""{"back":true}"""), 400, false),
            ("idea", Json("""{"text":"Swim with rays"}"""), 300, false),
            ("meet", Json("""{"place":"Atrium"}"""), 200, true),
            ("vote", Json("\"o1\""), 500, false),
        };
        var log = PartyRules.Log(rows);
        Assert.Equal(["idea", "meet", "poll"], log.Select(e => e.Kind));
        Assert.Equal("Swim with rays", log[0].Label);
        Assert.True(log[1].Deleted);
    }

    [Fact]
    public void ALogLabelIsShortAndPlain()
    {
        Assert.Equal("", PartyRules.LabelOf(null));
        Assert.Equal("", PartyRules.LabelOf(Json("""{"amount":5}""")));
        Assert.Equal(60, PartyRules.LabelOf(Json($$"""{"text":"{{new string('x', 100)}}"}""")).Length);
    }

    [Fact]
    public void ALinkNeedsAKnownKindAndALabelAndAdvisorsAreForTheBooker()
    {
        Assert.Null(PartyRules.LinkProblem("caregiver", "Mum", isBooker: false, existing: 0));
        Assert.Equal("badShareLink", PartyRules.LinkProblem("friend", "Mum", false, 0));
        Assert.Equal("badShareLink", PartyRules.LinkProblem("caregiver", "  ", false, 0));
        Assert.Equal("bookerOnly", PartyRules.LinkProblem("advisor", "Pat at the agency", false, 0));
        Assert.Null(PartyRules.LinkProblem("advisor", "Pat at the agency", true, 0));
        Assert.Equal("tooManyLinks", PartyRules.LinkProblem("caregiver", "Mum", true, PartyRules.MaxLinks));
    }

    [Fact]
    public void ALinkEndsAtItsExpiry()
    {
        var now = new DateTime(2027, 3, 1, 0, 0, 0, DateTimeKind.Utc);
        Assert.True(PartyRules.Live(now.AddDays(1), now));
        Assert.False(PartyRules.Live(now, now));
        Assert.False(PartyRules.Live(now.AddDays(-1), now));
    }

    [Fact]
    public void ANoteIsTrimmedAndCutToTheLimit()
    {
        Assert.Equal("All good", PartyRules.CleanNote("  All good "));
        Assert.Equal("", PartyRules.CleanNote(null));
        Assert.Equal(PartyRules.MaxNote, PartyRules.CleanNote(new string('a', 500)).Length);
    }

    [Fact]
    public void ThePartyBoardKindsAreAcceptedAsPortRows()
    {
        foreach (var k in new[] { "poll", "vote", "answer", "idea", "heart", "date" }) Assert.Null(PortRowRules.Problem(k, "k1", Json("1"), false, 1));
        Assert.Equal("badPortRow", PortRowRules.Problem("nonsense", "k1", Json("1"), false, 1));
    }

    [Fact]
    public void TheSharingDocumentIsAllowedAndSmall()
    {
        Assert.Null(StateRules.Problem(StateRules.UserKeys, "sharing", Json("""{"plans":true}""")));
    }
}
