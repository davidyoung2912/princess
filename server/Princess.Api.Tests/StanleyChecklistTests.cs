using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The trip checklist and smart defaults (phase P5): outstanding work per traveller with a screen each, ticked off by state, and a remembered preference shown but never applied.</summary>
public class StanleyChecklistTests
{
    private static ChecklistFacts Facts(string state = "open", ChecklistPerson[]? people = null, string[]? bookingLeft = null, int tours = 1, int dinners = 1, string? pref = null) =>
        new(state, people ?? [new(1, false, ["document", "photo"])], bookingLeft ?? ["payment"], 6, 2, 7, tours, dinners, pref);

    [Fact]
    public void ListsOutstandingStepsInCheckinOrderEachWithAScreen()
    {
        var items = StanleyChecklistRules.Items(Facts());
        Assert.Equal(["checkin:document:1", "checkin:photo:1", "checkin:payment"], items.Select(i => i.Id));
        Assert.All(items, i => Assert.Equal("/home/check-in", i.Route));
    }

    [Fact]
    public void TravellersAreNamedByPositionOnlyWhenThereIsMoreThanOne()
    {
        Assert.DoesNotContain("Traveller", StanleyChecklistRules.Items(Facts()).First().Title);
        var two = StanleyChecklistRules.Items(Facts(people: [new(1, false, ["photo"]), new(2, true, ["photo"])]));
        Assert.Contains(two, i => i.Title.StartsWith("Traveller 2: "));
    }

    [Fact]
    public void NothingIsListedForCheckinThatHasNotOpenedAndTheGapIsSaid()
    {
        var f = Facts("notOpen");
        Assert.DoesNotContain(StanleyChecklistRules.Items(f), i => i.Kind == "checkin");
        Assert.Contains(StanleyChecklistRules.NotChecked(f), x => x.Contains("not opened"));
    }

    [Fact]
    public void ADoneChecklistIsCompleteAndCountsTicks()
    {
        var done = StanleyChecklistRules.Build(Facts(people: [new(1, false, [])], bookingLeft: []), "t");
        Assert.True(done.Complete);
        Assert.Equal(done.Total, done.Done);
        var some = StanleyChecklistRules.Build(Facts(), "t");
        Assert.False(some.Complete);
        Assert.Equal(some.Total - 3, some.Done);
    }

    [Fact]
    public void DiningAndToursAreOfferedOnlyWhenNoneIsBooked()
    {
        var f = Facts(people: [new(1, false, [])], bookingLeft: [], tours: 0, dinners: 0);
        Assert.Equal(["dining:none", "tours:none"], StanleyChecklistRules.Items(f).Select(i => i.Id));
        Assert.Empty(StanleyChecklistRules.Items(Facts(people: [new(1, false, [])], bookingLeft: [])));
    }

    [Fact]
    public void ARememberedDinnerPreferenceIsShownWithItsSourceAndNothingIsApplied()
    {
        var d = StanleyChecklistRules.Items(Facts(people: [new(1, false, [])], bookingLeft: [], dinners: 0, pref: "late")).Single(i => i.Kind == "dining").Default;
        Assert.NotNull(d);
        Assert.Contains("late", d!.Label);
        Assert.Contains("I have not set it", d.Source);
        Assert.Null(StanleyChecklistRules.Items(Facts(people: [new(1, false, [])], bookingLeft: [], dinners: 0)).Single(i => i.Kind == "dining").Default);
    }

    [Fact]
    public void OnlyTheGuestsOwnUsableDiningItemIsRead()
    {
        StanleyMemoryRow Row(string kind, string value, string scope = "future", string sailing = "") => new() { Kind = kind, Value = value, Scope = scope, SailingId = sailing, Share = true };
        Assert.Equal("early", StanleyChecklistRules.DiningPreference([Row("dining", "early")], true, "S1"));
        Assert.Null(StanleyChecklistRules.DiningPreference([Row("dining", "early")], false, "S1"));                 // memory off
        Assert.Null(StanleyChecklistRules.DiningPreference([Row("dining", "flexible")], true, "S1"));               // nothing to default
        Assert.Null(StanleyChecklistRules.DiningPreference([Row("dining", "late", "trip", "S2")], true, "S1"));     // another voyage
    }
}
