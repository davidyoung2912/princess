using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Morning brief and evening look-ahead (phase P7): off until chosen, one per guest, kind and ship day, and built only for a sailing day.</summary>
public class StanleyBriefTests
{
    private static readonly DateOnly Departure = new(2027, 3, 20);
    private static readonly Timeline Line = TimelineBook.For(null, Departure);

    private static BriefFacts Facts(int day, IReadOnlyList<CheckTour>? tours = null, IReadOnlyList<StanleyItem>? meals = null, IReadOnlyList<CheckDeadline>? deadlines = null)
    {
        var today = Line.Days.FirstOrDefault(d => d.Day == day);
        var tomorrow = Line.Days.FirstOrDefault(d => d.Day == day + 1);
        return new(today?.Date ?? Departure.AddDays(day - 1), 7, today, tomorrow, tours ?? [], meals ?? [], deadlines ?? []);
    }

    [Fact]
    public void BothBriefsAreOffUntilTheGuestChoosesAndABadTimeIsRefused()
    {
        var s = new BriefSettings();
        Assert.False(StanleyBriefRules.Wanted(s, StanleyBriefRules.Morning));
        Assert.False(StanleyBriefRules.Wanted(s, StanleyBriefRules.Evening));
        Assert.Null(StanleyBriefRules.Apply(s, new(true, "7:30", null, null), out var problem));
        Assert.Equal("morningAt", problem);
        Assert.Null(StanleyBriefRules.Apply(s, null, out _));
        var on = StanleyBriefRules.Apply(s, new(true, "06:45", null, null), out _)!;
        Assert.True(on.Morning);
        Assert.Equal("06:45", on.MorningAt);
        Assert.False(on.Evening);
    }

    [Fact]
    public void SettingsRoundTripAndABrokenDocumentFallsBackToOff()
    {
        var s = new BriefSettings(true, "08:00", true, "18:30");
        Assert.Equal(s, StanleyBriefRules.Parse(StanleyBriefRules.ToJson(s)));
        Assert.Equal(new BriefSettings(), StanleyBriefRules.Parse("not json"));
        Assert.Equal("07:30", StanleyBriefRules.Parse("""{"morning":true,"morningAt":"25:99"}""").MorningAt);
    }

    [Fact]
    public void AKeyNamesOneBriefOnOneDayAndOnlyBriefKeysAreRead()
    {
        var key = StanleyBriefRules.Key(7, StanleyBriefRules.Evening, new(2027, 3, 21));
        Assert.Equal("brief:7:evening:20270321", key);
        Assert.Equal(StanleyBriefRules.Evening, StanleyBriefRules.KindOfKey(key));
        Assert.Null(StanleyBriefRules.KindOfKey("reminder:7:abc"));
        Assert.Null(StanleyBriefRules.KindOfKey("brief:7:noon:20270321"));
    }

    [Fact]
    public void TheMorningBriefIsTodayAndTheEveningLookAheadIsTomorrow()
    {
        var f = Facts(2, tours: [new(2, "Beach", "09:00", 4), new(3, "Ruins", "07:00", 5)], meals: [new(2, "Crown Grill", "19:30")]);
        var morning = StanleyBriefRules.Compose(StanleyBriefRules.Morning, f)!;
        Assert.Contains(morning.Lines, l => l.Text.Contains("Beach"));
        Assert.DoesNotContain(morning.Lines, l => l.Text.Contains("Ruins"));
        Assert.Contains(morning.Lines, l => l.Text.Contains("Crown Grill"));
        Assert.DoesNotContain(morning.Lines, l => l.Text.Contains("No dinner"));
        var evening = StanleyBriefRules.Compose(StanleyBriefRules.Evening, f)!;
        Assert.Contains(evening.Lines, l => l.Text.Contains("Ruins"));
        Assert.Contains(evening.Lines, l => l.Text.Contains("early start"));
        Assert.Equal(Line.Days.Single(d => d.Day == 3).Date.ToString("yyyy-MM-dd"), evening.Date);
    }

    [Fact]
    public void AnUnbookedDinnerAndAnEmptyPortDayAreSaidWithAScreenToFixThem()
    {
        var port = Line.Days.First(d => d.Arrive is not null && d.Day > 1);
        var brief = StanleyBriefRules.Compose(StanleyBriefRules.Morning, Facts(port.Day))!;
        Assert.Contains(brief.Lines, l => l.Text.Contains("No dinner") && l.Route == "/dining-today");
        Assert.Contains(brief.Lines, l => l.Text.Contains("Nothing is booked") && l.Route == "/excursions-explorer");
    }

    [Fact]
    public void ADeadlineWithinThreeDaysIsAddedAndALaterOneIsNot()
    {
        var fix = new CheckFix("Open", "/me/payments");
        var soon = new CheckDeadline("a", ChangeConsequence.Conflict, "Final payment", "2027-03-22", 2, fix);
        var later = new CheckDeadline("b", ChangeConsequence.Conflict, "Check-in closes", "2027-04-22", 30, fix);
        var brief = StanleyBriefRules.Compose(StanleyBriefRules.Morning, Facts(2, deadlines: [soon, later]))!;
        Assert.Contains(brief.Lines, l => l.Text == "Final payment: in 2 days." && l.Route == "/me/payments");
        Assert.DoesNotContain(brief.Lines, l => l.Text.Contains("Check-in closes"));
    }

    [Fact]
    public void ABriefNeverClaimsNothingChangedAndIsNullOutsideTheSailing()
    {
        var brief = StanleyBriefRules.Compose(StanleyBriefRules.Morning, Facts(2))!;
        Assert.Contains(brief.Lines, l => l.Text.Contains("what changed") && l.Route is not null);
        Assert.DoesNotContain(brief.Lines, l => l.Text.Contains("nothing changed", StringComparison.OrdinalIgnoreCase));
        Assert.Null(StanleyBriefRules.Compose(StanleyBriefRules.Morning, Facts(0)));
        Assert.Null(StanleyBriefRules.Compose(StanleyBriefRules.Evening, Facts(Line.Days.Count)));
        Assert.Null(StanleyBriefRules.Compose("noon", Facts(2)));
    }

    [Fact]
    public void TheBriefRowIsBuiltAndOnByDefaultWhileTheGuestCanSwitchItOff()
    {
        var row = StanleyPermissionRules.Row("CL-04")!;
        Assert.True(row.Built);
        Assert.True(StanleyPermissionRules.IsOn(new(), row, 2, false));
        Assert.False(StanleyPermissionRules.IsOn(StanleyPermissionRules.WithRow(new(), "CL-04", false), row, 2, false));
    }
}
