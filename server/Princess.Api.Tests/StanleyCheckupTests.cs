using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Trip check-up, plan lint and deadline radar (phase P3): a clean trip raises nothing, each problem is found once with a fix, and the order is by consequence.</summary>
public class StanleyCheckupTests
{
    private static readonly DateOnly Departure = new(2027, 3, 20);
    private static readonly DateTime Now = new(2027, 2, 1, 15, 0, 0, DateTimeKind.Utc);

    private static DocumentRules.GuestDocs Docs(string passportExpires = "2030-01-01", bool photoId = true)
    {
        var held = new DocumentRules.Held { ["passport"] = passportExpires };
        if (photoId) held["photoId"] = "2030-01-01";
        return DocumentRules.ForGuest("us", 40, held, Departure.AddDays(7));
    }

    private static CheckupFacts Clean(
        IReadOnlyList<CheckTraveller>? travellers = null, IReadOnlyList<CheckTour>? tours = null, IReadOnlyList<StanleyItem>? meals = null,
        string payment = "upcoming", string checkin = "notOpen", bool agent = false, DateTime? now = null) =>
        new(TripRules.Today(now ?? Now), now ?? Now, Departure, 7, TimelineBook.For(null, Departure), payment, Departure.AddDays(-75), checkin,
            TripRules.CheckinOpensAt(Departure), TripRules.CheckinClosesAt(Departure), agent, travellers ?? [new(1, 40, Docs())], tours ?? [], meals ?? []);

    [Fact]
    public void ACleanTripRaisesNothing()
    {
        var f = Clean(tours: [new(3, "Beach", "09:00", 4)], meals: [new(3, "Crown Grill", "19:30")]);
        Assert.Empty(StanleyCheckupRules.Findings(f));
        Assert.True(StanleyCheckupRules.Build(f, "x").Clean);
    }

    [Fact]
    public void ACleanResultStillSaysWhatItCouldNotSee()
    {
        var notChecked = StanleyCheckupRules.NotChecked(Clean());
        Assert.Contains(notChecked, x => x.Contains("Flights"));
        Assert.Contains(notChecked, x => x.Contains("names match"));
    }

    [Fact]
    public void APassportTooCloseToExpiringIsFoundAndSentToDocuments()
    {
        var f = Clean([new(1, 40, Docs("2027-06-01"))]);
        var x = Assert.Single(StanleyCheckupRules.Findings(f));
        Assert.Equal("CHK-01", x.Rule);
        Assert.Equal(ChangeConsequence.LostReservation, x.Consequence);
        Assert.Equal("/me/documents", x.Fix.Route);
        Assert.Contains("too close", x.Title);
    }

    [Fact]
    public void ATravellerIsNamedByPositionOnlyWhenThereIsMoreThanOne()
    {
        var f = Clean([new(1, 40, Docs()), new(2, 12, Docs("2027-06-01"))]);
        Assert.All(StanleyCheckupRules.Findings(f), x => Assert.StartsWith("Traveller 2", x.Title));
        Assert.StartsWith("Your", StanleyCheckupRules.Findings(Clean([new(1, 40, Docs("2027-06-01"))])).First().Title);
    }

    [Fact]
    public void AMissingRequiredDocumentIsMoreSeriousTheCloserTheSailing()
    {
        var none = new CheckTraveller(1, 40, DocumentRules.ForGuest("us", 40, new DocumentRules.Held(), Departure.AddDays(7)));
        var far = StanleyCheckupRules.Findings(Clean([none], now: Now)).First(x => x.Id.StartsWith("doc:1:"));
        var near = StanleyCheckupRules.Findings(Clean([none], now: Departure.AddDays(-5).ToDateTime(new TimeOnly(15, 0), DateTimeKind.Utc))).First(x => x.Id.StartsWith("doc:1:"));
        Assert.Equal(ChangeConsequence.Conflict, far.Consequence);
        Assert.Equal(ChangeConsequence.LostReservation, near.Consequence);
    }

    [Fact]
    public void AnAgentBookingSkipsDocumentsAndSaysSo()
    {
        var f = Clean([new(1, 40, Docs("2027-06-01"))], agent: true);
        Assert.DoesNotContain(StanleyCheckupRules.Findings(f), x => x.Id.StartsWith("doc:"));
        Assert.Contains(StanleyCheckupRules.NotChecked(f), x => x.StartsWith("Documents"));
        Assert.DoesNotContain(StanleyCheckupRules.Deadlines(f), x => x.Id.StartsWith("documents:"));
    }

    [Fact]
    public void OverduePaymentOutranksCheckinNotDone()
    {
        var f = Clean(payment: "overdue", checkin: "open", now: Departure.AddDays(-2).ToDateTime(new TimeOnly(15, 0), DateTimeKind.Utc));
        var list = StanleyCheckupRules.Findings(f);
        Assert.Equal("pay:overdue", list[0].Id);
        Assert.Contains(list, x => x.Id == "checkin:open");
    }

    [Fact]
    public void CheckinClosingWithinADayIsLostReservation()
    {
        var f = Clean(checkin: "open", now: TripRules.CheckinClosesAt(Departure).AddHours(-3));
        Assert.Equal(ChangeConsequence.LostReservation, StanleyCheckupRules.Findings(f).Single(x => x.Id == "checkin:open").Consequence);
    }

    [Fact]
    public void ATourEndingAfterAllAboardIsFoundAndATightOneIsAWarning()
    {
        // Cozumel (day 3): all aboard 16:30.
        var late = StanleyCheckupRules.Findings(Clean(tours: [new(3, "Long Tour", "13:00", 4.5)])).Single();
        Assert.EndsWith("after-aboard", late.Id);
        Assert.Equal(ChangeConsequence.LostReservation, late.Consequence);
        var tight = StanleyCheckupRules.Findings(Clean(tours: [new(3, "Tour", "12:00", 4)])).Single();
        Assert.EndsWith("tight", tight.Id);
        Assert.Equal(ChangeConsequence.Conflict, tight.Consequence);
        Assert.Equal("/plan/excursions", tight.Fix.Route);
    }

    [Fact]
    public void ATourStartingBeforeTheShipCanBeAshoreOrOverlappingAnotherOrDinnerIsFound()
    {
        Assert.Contains(StanleyCheckupRules.Findings(Clean(tours: [new(3, "Early", "07:10", 2)])), x => x.Id.EndsWith(":early"));
        Assert.Contains(StanleyCheckupRules.Findings(Clean(tours: [new(3, "A", "09:00", 3), new(3, "B", "11:00", 2)])), x => x.Id.StartsWith("overlap:3"));
        Assert.Contains(StanleyCheckupRules.Findings(Clean(tours: [new(3, "Day Out", "09:00", 5)], meals: [new(3, "Early Dinner", "14:00")])), x => x.Id.EndsWith(":dinner"));
    }

    [Fact]
    public void ADinnerWhileTheShipIsStillLoadingIsFlaggedAndAtSeaIsNot()
    {
        Assert.Contains(StanleyCheckupRules.Findings(Clean(meals: [new(3, "Early Dinner", "16:00")])), x => x.Id == "dinner:3:late-port");
        Assert.Empty(StanleyCheckupRules.Findings(Clean(meals: [new(2, "Crown Grill", "18:30")])));
    }

    [Fact]
    public void BadTimesAreIgnoredNotCrashed()
    {
        Assert.Empty(StanleyCheckupRules.Findings(Clean(tours: [new(3, "Odd", "soon", 2), new(3, "Odd2", "", 2)], meals: [new(3, "X", "late")])));
    }

    [Fact]
    public void FindingsAreRankedMostSeriousFirstAndAreStable()
    {
        var f = Clean([new(1, 40, Docs("2027-06-01"))], [new(3, "Tour", "12:00", 4)], payment: "dueSoon");
        var a = StanleyCheckupRules.Findings(f);
        Assert.Equal(a.Select(x => x.Id), StanleyCheckupRules.Findings(f).Select(x => x.Id));
        Assert.Equal(a.Select(x => ChangeConsequence.Rank(x.Consequence)).OrderBy(x => x), a.Select(x => ChangeConsequence.Rank(x.Consequence)));
        Assert.Equal(a.Count, a.Select(x => x.Id).Distinct().Count());
        Assert.All(a, x => Assert.False(string.IsNullOrWhiteSpace(x.Fix.Route)));
    }

    [Fact]
    public void TheRadarListsOnlyOpenDatesByConsequenceThenDate()
    {
        var radar = StanleyCheckupRules.Deadlines(Clean());
        Assert.Equal(["final-payment", "checkin-closes", "checkin-opens"], radar.Select(x => x.Id));
        Assert.Equal("final-payment", radar[0].Id);
        Assert.True(radar.Select(x => ChangeConsequence.Rank(x.Consequence)).SequenceEqual(radar.Select(x => ChangeConsequence.Rank(x.Consequence)).OrderBy(x => x)));
        Assert.DoesNotContain(StanleyCheckupRules.Deadlines(Clean(payment: "paid")), x => x.Id == "final-payment");
        Assert.DoesNotContain(StanleyCheckupRules.Deadlines(Clean(checkin: "done")), x => x.Id.StartsWith("checkin"));
    }

    [Fact]
    public void NothingInTheAnswerCarriesAnythingPersonal()
    {
        var f = Clean([new(1, 40, Docs("2027-06-01")), new(2, 12, Docs())], [new(3, "Tour", "12:00", 4)], payment: "overdue");
        var text = System.Text.Json.JsonSerializer.Serialize(StanleyCheckupRules.Build(f, "x"));
        Assert.DoesNotContain("2030-01-01", text);   // no document dates
    }
}
