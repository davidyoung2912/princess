using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Bundles and drafts (phase P4): ordered, paced, honest about clashes, booked things kept, and nothing sent.</summary>
public class StanleyBundleTests
{
    private static readonly DateOnly Departure = new(2027, 3, 20);
    private static Timeline Line() => TimelineBook.For(null, Departure);

    private static BundleFacts Facts(int day, IReadOnlyList<CheckTour>? tours = null, IReadOnlyList<StanleyItem>? meals = null) =>
        new(Line(), day, tours ?? [], meals ?? [], false, "any");

    [Fact]
    public void StepsAreInTimeOrderAndNothingIsBooked()
    {
        var b = StanleyBundleRules.Build("day", "packed", Facts(1));
        var starts = b.Steps.Select(s => s.Start).ToList();
        Assert.Equal(starts.OrderBy(x => x, StringComparer.Ordinal), starts);
        Assert.All(b.Steps, s => Assert.Equal("suggested", s.Status));
        Assert.NotEmpty(b.NotChecked);
    }

    [Fact]
    public void PaceSetsHowManySuggestionsGoWithDinner()
    {
        int Others(string pace) => StanleyBundleRules.Build("day", pace, Facts(2)).Steps.Count(s => s.Kind != "dinner");
        Assert.True(Others("relaxed") <= Others("balanced"));
        Assert.True(Others("balanced") <= Others("packed"));
        Assert.True(Others("relaxed") <= StanleyBundleRules.Slots("relaxed") + 1);
    }

    [Fact]
    public void ABookedDinnerIsKeptAndNotDoubled()
    {
        var b = StanleyBundleRules.Build("evening", "balanced", Facts(2, meals: [new StanleyItem(2, "Sabatini's", "20:00")]));
        var dinners = b.Steps.Where(s => s.Kind == "dinner").ToList();
        var d = Assert.Single(dinners);
        Assert.Equal("booked", d.Status);
        Assert.Equal("20:00", d.Start);
    }

    [Fact]
    public void EveningLeavesOutTheMorning() =>
        Assert.All(StanleyBundleRules.Build("evening", "packed", Facts(2)).Steps, s => Assert.True(int.Parse(s.Start[..2]) * 60 >= StanleyBundleRules.EveningFrom || s.Status == "booked"));

    [Fact]
    public void AnUnknownDayHasNoPlanAndNothingIsInvented()
    {
        var b = StanleyBundleRules.Build("day", "balanced", Facts(99));
        Assert.False(b.HasPlan);
        Assert.Empty(b.Steps);
    }

    [Fact]
    public void ClashesAreSaidInWords()
    {
        var day = new ItineraryDay(3, Departure.AddDays(2), "Cabo", new TimeOnly(8, 0), new TimeOnly(17, 0), new TimeOnly(17, 30));
        List<BundleStep> steps =
        [
            new("a", "09:00", 120, "tour", "Whale watch", "booked", "", "/plan/excursions"),
            new("b", "10:00", 60, "event", "Cooking demo", "suggested", "", "/plan"),
            new("c", "14:00", 180, "tour", "Old town", "booked", "", "/plan/excursions"),
        ];
        var clashes = StanleyBundleRules.Clashes(steps, day);
        Assert.Contains(clashes, c => c.Contains("overlap"));
        Assert.Contains(clashes, c => c.Contains("Old town") && c.Contains("after all aboard"));
    }

    [Fact]
    public void ADraftNamesTimesOnlyAndIsNullWithoutAPlan()
    {
        var b = StanleyBundleRules.Build("evening", "balanced", Facts(2));
        var note = StanleyBundleRules.Draft("party-plan", b);
        Assert.NotNull(note);
        Assert.Contains("Plan for tonight", note!.Text);
        Assert.Null(StanleyBundleRules.Draft("party-plan", StanleyBundleRules.Build("day", "balanced", Facts(99))));
        Assert.Null(StanleyBundleRules.Draft("send-now", b));
    }
}
