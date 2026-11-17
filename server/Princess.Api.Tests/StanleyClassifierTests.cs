using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Classifier flags and the act-or-ask gate (phase P3a): a paid, shared, soon-to-be-fee-bearing or unclassified item can never be acted on, and any one failing test means ask.</summary>
public class StanleyClassifierTests
{
    private const long Hour = 3_600_000L, Day = 24 * Hour;
    private static readonly long Now = new DateTimeOffset(2027, 3, 10, 12, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();

    private static readonly StanleyClassState Ready = new(true, false, false, 0, 2, 120, 0, true);

    private static StanleyGateInput Input(StanleyItemFlags item, StanleyClassState? cls = null, int local = 12 * 60) =>
        new(item, cls ?? Ready, Now, local, 5, 30, true, false, false, false, false);

    private static StanleyItemFlags GoodDinner() => StanleyClassifier.Dining(DiningRules.Venues.First(v => v.Kind == "main"), Now + 2 * Day, 0);

    [Fact]
    public void AFreeOwnReversibleDinnerPassesEveryTest()
    {
        var r = StanleyActGate.Decide(Input(GoodDinner()));
        Assert.True(r.Act);
        Assert.Empty(r.Reasons);
    }

    [Fact]
    public void ASpecialtyDinnerIsPaid()
    {
        var crown = DiningRules.Venues.First(v => v.Id == "crown");
        var flags = StanleyClassifier.Dining(crown, Now + 2 * Day, 0);
        Assert.False(flags.Free);
        Assert.Contains("paid", StanleyActGate.Decide(Input(flags)).Reasons);
    }

    [Fact]
    public void ASharedReservationIsNeverActedOn()
    {
        var flags = StanleyClassifier.Show(Now + 2 * Day, 2);
        Assert.Equal("shared", flags.Failure(Now, 120));
        Assert.False(StanleyActGate.Decide(Input(flags)).Act);
    }

    [Fact]
    public void ToursAndTreatmentsAreAlwaysPaid()
    {
        foreach (var x in ExcursionRules.Catalogue)
            Assert.Equal("paid", StanleyClassifier.Excursion(x, Now + 5 * Day, 0).Failure(Now, 120));
    }

    [Fact]
    public void AnItemWhoseFreeWindowEndsInsideTheUndoWindowFails()
    {
        var soon = new StanleyItemFlags(StanleyItemKind.Show, true, Now + Hour, true, Now + 5 * Hour);
        Assert.Equal("feeSoon", soon.Failure(Now, 120));
        var irreversible = new StanleyItemFlags(StanleyItemKind.Show, true, Now + 5 * Hour, true, Now + Hour);
        Assert.Equal("notReversible", irreversible.Failure(Now, 120));
        var fine = new StanleyItemFlags(StanleyItemKind.Show, true, Now + 5 * Hour, true, Now + 5 * Hour);
        Assert.Null(fine.Failure(Now, 120));
    }

    [Fact]
    public void AnUnclassifiedItemFailsAndKindsOutsideTheListFail()
    {
        Assert.Equal("paid", StanleyItemFlags.Unknown(StanleyItemKind.Dining).Failure(Now, 120));
        Assert.Equal("unclassified", new StanleyItemFlags("cabin", true, Now + Day, true, Now + Day).Failure(Now, 120));
    }

    [Fact]
    public void AStateroomRequestIsFreeAndOwnButOnlyReversibleForAShortTime()
    {
        var flags = StanleyClassifier.Service(ServiceRules.RequestItemById("towels")!, Now);
        Assert.Null(flags.Failure(Now, 5));
        Assert.Equal("feeSoon", flags.Failure(Now, 120));
        Assert.DoesNotContain("quiet", StanleyActGate.Decide(Input(flags, local: 3 * 60)).Reasons);
    }

    [Fact]
    public void ReservationsWaitForTheDay()
    {
        Assert.Contains("quiet", StanleyActGate.Decide(Input(GoodDinner(), local: 23 * 60)).Reasons);
        Assert.Contains("quiet", StanleyActGate.Decide(Input(GoodDinner(), local: 6 * 60 + 59)).Reasons);
        Assert.DoesNotContain("quiet", StanleyActGate.Decide(Input(GoodDinner(), local: 7 * 60)).Reasons);
    }

    [Fact]
    public void EachOtherTestAloneStopsTheAct()
    {
        var item = GoodDinner();
        var cases = new (string Reason, StanleyGateInput Input)[]
        {
            ("classOff", Input(item, Ready with { On = false })),
            ("paused", Input(item, Ready with { Paused = true })),
            ("practice", Input(item, Ready with { Practice = true })),
            ("overCap", Input(item, Ready with { SentToday = 2 })),
            ("declined", Input(item, Ready with { DeclinedOrUndoneOfKind = 2 })),
            ("noStepUp", Input(item, Ready with { StepUpPassed = false })),
            ("stale", Input(item) with { FactAgeMinutes = 31 }),
            ("sourceDown", Input(item) with { SourceHealthy = false }),
            ("overlap", Input(item) with { OverlapsBooked = true }),
            ("seriousCase", Input(item) with { SeriousCase = true }),
            ("shipAlert", Input(item) with { ShipAlert = true }),
            ("child", Input(item) with { SupervisedChild = true }),
        };
        foreach (var (reason, input) in cases)
        {
            var r = StanleyActGate.Decide(input);
            Assert.False(r.Act, reason);
            Assert.Equal([reason], r.Reasons);
            Assert.Contains(reason, StanleyActGate.Reasons);
        }
    }

    [Fact]
    public void EveryReasonTheGateGivesIsInTheClosedSet()
    {
        var worst = new StanleyGateInput(StanleyItemFlags.Unknown("cabin"), new(false, true, true, 9, 1, 120, 5, false), Now, 23 * 60, -1, 30, false, true, true, true, true);
        var r = StanleyActGate.Decide(worst);
        Assert.False(r.Act);
        Assert.All(r.Reasons, x => Assert.Contains(x, StanleyActGate.Reasons));
    }
}
