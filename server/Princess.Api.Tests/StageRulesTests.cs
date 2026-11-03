using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class StageRulesTests
{
    private static readonly DateOnly Departure = new(2027, 3, 21);
    private static readonly DateTime Now = new(2027, 1, 5, 15, 0, 0, DateTimeKind.Utc);

    private static StageResult Before(string[]? saved = null, JourneyIntent[]? intents = null, string? draft = null, string? cancelled = null, DateTime? now = null) =>
        StageRules.Derive(new StageInput(now ?? Now, saved ?? [], intents ?? [], draft, cancelled, null));

    private static StageResult After(DateTime now, bool paid = false, bool checkinDone = false, JourneyIntent[]? intents = null) =>
        StageRules.Derive(new StageInput(now, [], intents ?? [], null, null, new StageTrip("sun-2027-03-21", Departure, paid, checkinDone)));

    private static DateTime Eastern(DateOnly d, int h, int m = 0) => Itinerary.LocalToUtc(d, new TimeOnly(h, m), Itinerary.ShipHomeZone);

    [Fact]
    public void ANewGuestIsDreamingWithNoSailing() =>
        Assert.Equal(new StageResult("dream", null, "noSailing"), Before());

    [Fact]
    public void SavingASailingMovesToDiscoverAndTheLastSavedIsInFocus() =>
        Assert.Equal(new StageResult("discover", "b", "sailingSaved"), Before(saved: ["a", "b"]));

    [Fact]
    public void LookingAloneIsNotIntentButAPriceOrCabinViewIs()
    {
        Assert.Equal("dream", Before(intents: [new("browse", "a", Now)]).Stage);
        var r = Before(intents: [new("priceView", "a", Now.AddHours(-1))]);
        Assert.Equal(new StageResult("discover", "a", "priceView"), r);
    }

    [Fact]
    public void AnIntentLapsesAfterADayAndTheGuestReturnsToDream() =>
        Assert.Equal("dream", Before(intents: [new("cabinView", "a", Now.AddHours(-25))]).Stage);

    [Fact]
    public void ARecentIntentBeatsASavedSailingForFocus() =>
        Assert.Equal("c", Before(saved: ["a"], intents: [new("lookCloser", "c", Now.AddMinutes(-5))]).FocusSailingId);

    [Fact]
    public void ADraftMovesToBookAndWinsOverSaves() =>
        Assert.Equal(new StageResult("book", "d", "draftStarted"), Before(saved: ["a"], draft: "d"));

    [Fact]
    public void ACancelledBookingReturnsToDiscoverWithItsSailingInFocus() =>
        Assert.Equal(new StageResult("discover", "x", "bookingCancelled"), Before(cancelled: "x"));

    [Fact]
    public void AConfirmedBookingIsManageUntilTwoWeeksOutOrPaidInFull()
    {
        Assert.Equal("manage", After(Now).Stage);
        Assert.Equal(new StageResult("prebook", "sun-2027-03-21", "paidInFull"), After(Now, paid: true));
        Assert.Equal(new StageResult("prebook", "sun-2027-03-21", "twoWeeksOut"), After(Eastern(Departure.AddDays(-14), 12)));
        Assert.Equal("manage", After(Eastern(Departure.AddDays(-15), 12)).Stage);
    }

    [Fact]
    public void CheckinOpeningThreeDaysBeforeMovesToGetToTheShip()
    {
        Assert.Equal("prebook", After(Eastern(Departure.AddDays(-4), 12), paid: true).Stage);
        Assert.Equal(new StageResult("getToShip", "sun-2027-03-21", "checkinOpened"), After(Eastern(Departure.AddDays(-3), 1)));
        Assert.Equal("checkinDone", After(Eastern(Departure.AddDays(-10), 1), checkinDone: true).Reason);
    }

    [Fact]
    public void TheGuestCanMoveThemselvesToEmbarkOnlyOnceCheckinIsOpen()
    {
        var tap = new JourneyIntent("atTerminal", "sun-2027-03-21", Now);
        Assert.Equal("manage", After(Now, intents: [tap]).Stage);
        Assert.Equal("embark", After(Eastern(Departure, 8), intents: [tap]).Stage);
        Assert.Equal("getToShip", After(Eastern(Departure, 8), intents: [new("atTerminal", "another", Now)]).Stage);
    }

    [Fact]
    public void BoardingBeginsAtElevenAndSailawayStartsTheSeaAndPortDays()
    {
        Assert.Equal("getToShip", After(Eastern(Departure, 10, 59)).Stage);
        Assert.Equal("embark", After(Eastern(Departure, 11)).Stage);
        Assert.Equal("sea", After(Eastern(Departure, 15)).Stage);          // sailaway
        Assert.Equal("sea", After(Eastern(Departure.AddDays(1), 12)).Stage);
        Assert.Equal("sea", After(Eastern(Departure.AddDays(2), 7, 59)).Stage);   // day 3 starts at 08:00; still day 2 (sea)
        Assert.Equal("port", After(Eastern(Departure.AddDays(2), 8)).Stage);       // Cozumel
        Assert.Equal("port", After(Eastern(Departure.AddDays(3), 12)).Stage);      // Belize
    }

    [Fact]
    public void TheFinalMorningIsDisembarkAndNoonOnItIsRemember()
    {
        var last = Departure.AddDays(7);
        Assert.Equal("sea", After(Eastern(last.AddDays(-1), 22)).Stage);
        Assert.Equal("disembark", After(Eastern(last, 6)).Stage);
        Assert.Equal(new StageResult("remember", "sun-2027-03-21", "tripEnded"), After(Eastern(last, 12)));
    }
}
