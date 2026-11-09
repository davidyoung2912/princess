using Princess.Api.Audit;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>
/// Dream and Discover intelligence (docs/stanley-gap-analysis-and-plan.md, phase 8). The words become filters by rules and every assumption is listed; directions are distinct and calculated; a comparison
/// uses only its listed criteria and labels missing data; the brief is the guest's own and leaves needs out of the shared text; the booking check only hints.
/// </summary>
public class StanleyDiscoverTests
{
    private static readonly DateTime T0 = new(2027, 1, 10, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Today = new(2027, 1, 10);
    private static readonly UserRecord Me = new() { Id = 1, PublicId = Guid.NewGuid() };
    private static readonly UserRecord Other = new() { Id = 2, PublicId = Guid.NewGuid() };
    private static readonly UserRecord Child = new() { Id = 3, PublicId = Guid.NewGuid(), IsSupervised = true };

    private static DiscoverCandidate C(string id, string region, int month, int nights, long? perNight, int? ports = 4, int tenders = 0, string ship = "sun-princess", int day = 1)
    {
        var calls = ports is null ? null : Enumerable.Range(1, ports.Value).Select(i => new DiscoverCall($"Port{i}", 8, i <= tenders)).ToList();
        return new(id, id.ToUpperInvariant(), ship, new DateOnly(2027, month, day), nights, region, perNight, perNight * nights, false, true, calls, calls is null ? null : nights + 1 - 2 - calls.Count);
    }

    // ---- Interview ----

    [Fact]
    public void LateSpringAWeekWarmAndFewTendersBecomeChipsWithAssumptionsListed()
    {
        var r = StanleyDiscoverRules.Interview("late spring, about a week, warm, few tender ports");
        Assert.Equal([5], r.Filters.Months!);
        Assert.Equal((6, 8), (r.Filters.NightsMin, r.Filters.NightsMax));
        Assert.True(r.Filters.Warm);
        Assert.Equal(1, r.Filters.MaxTender);
        Assert.Contains(r.Assumptions, a => a.Contains("Late spring") && a.Contains("may"));
        Assert.Contains(r.Chips, c => c.Key == "months" && c.Assumed);
        Assert.Contains(r.Chips, c => c.Key == "warm" && !c.Assumed);
        Assert.True(r.Understood);
    }

    [Fact]
    public void ANamedMonthAndNightsAreNotAssumed()
    {
        var r = StanleyDiscoverRules.Interview("Caribbean in March for 10 nights, under $200 a night");
        Assert.Equal([3], r.Filters.Months!);
        Assert.Equal((10, 10), (r.Filters.NightsMin, r.Filters.NightsMax));
        Assert.Equal(["caribbean"], r.Filters.Regions!);
        Assert.Equal(20000, r.Filters.MaxPerNightCents);
        Assert.DoesNotContain(r.Chips, c => c.Assumed);
    }

    [Fact]
    public void WordsThatSayNothingGiveNoFiltersAndSayTheyWereNotUnderstood()
    {
        var r = StanleyDiscoverRules.Interview("surprise me");
        Assert.True(r.Filters.IsEmpty);
        Assert.False(r.Understood);
        Assert.Empty(r.Chips);
    }

    private sealed record InterviewCase(string Text, int[]? Months, int? NightsMin, int? NightsMax, string[]? Regions, bool? Warm, int? MaxTender, long? MaxPerNightCents, bool Understood);

    private static string Repo()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
            if (File.Exists(Path.Combine(dir.FullName, "src", "ai", "eval", "discover.json"))) return dir.FullName;
        throw new FileNotFoundException("src/ai/eval/discover.json was not found above the test output folder.");
    }

    public static IEnumerable<object[]> InterviewCases() =>
        System.Text.Json.JsonSerializer.Deserialize<List<InterviewCase>>(File.ReadAllText(Path.Combine(Repo(), "src", "ai", "eval", "discover.json")), new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web))!
            .Select(c => new object[] { c.Text });

    [Theory]
    [MemberData(nameof(InterviewCases))]
    public void EveryDiscoveryPhrasingInTheEvalSetGivesTheExpectedFilters(string text)
    {
        var c = System.Text.Json.JsonSerializer.Deserialize<List<InterviewCase>>(File.ReadAllText(Path.Combine(Repo(), "src", "ai", "eval", "discover.json")), new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web))!.First(x => x.Text == text);
        var r = StanleyDiscoverRules.Interview(c.Text);
        Assert.Equal(new DiscoverFilters(c.Months, c.NightsMin, c.NightsMax, c.Regions, c.Warm, c.MaxTender, c.MaxPerNightCents).Months, r.Filters.Months);
        Assert.Equal((c.NightsMin, c.NightsMax, c.Warm, c.MaxTender, c.MaxPerNightCents), (r.Filters.NightsMin, r.Filters.NightsMax, r.Filters.Warm, r.Filters.MaxTender, r.Filters.MaxPerNightCents));
        Assert.Equal(c.Regions ?? [], r.Filters.Regions ?? []);
        Assert.Equal(c.Understood, r.Understood);
    }

    [Fact]
    public void TheSameWordsAlwaysGiveTheSameChips() =>
        Assert.Equal(StanleyDiscoverRules.Interview("two weeks in the Med in summer").Chips, StanleyDiscoverRules.Interview("two weeks in the Med in summer").Chips);

    [Fact]
    public void ADayCountIsTakenAsOneFewerNightsAndSaysSo()
    {
        var r = StanleyDiscoverRules.Interview("a 8 day trip");
        Assert.Equal(7, r.Filters.NightsMin);
        Assert.Contains(r.Assumptions, a => a.Contains("8 days taken as 7 nights"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task NothingToReadIsRefused(string? text) => Assert.Equal("text", (await Assert.ThrowsAsync<ApiException>(() => Task.Run(() => Svc().Svc.Interview(new(text))))).Message);

    [Fact]
    public async Task TooManyCharactersIsRefused() => Assert.Equal("tooLong", (await Assert.ThrowsAsync<ApiException>(() => Task.Run(() => Svc().Svc.Interview(new(new string('a', 501)))))).Message);

    // ---- Filters ----

    [Fact]
    public void FiltersOutOfRangeAreRefusedAndRepeatsAreRemoved()
    {
        Assert.Null(StanleyDiscoverRules.Clean(new DiscoverFilters(Months: [13])));
        Assert.Null(StanleyDiscoverRules.Clean(new DiscoverFilters(NightsMin: 9, NightsMax: 7)));
        Assert.Null(StanleyDiscoverRules.Clean(new DiscoverFilters(Regions: ["mars"])));
        Assert.Equal([3, 5], StanleyDiscoverRules.Clean(new DiscoverFilters(Months: [5, 3, 5]))!.Months!);
    }

    [Fact]
    public void AMissingCheckIsNoDataNotAMiss()
    {
        var fit = StanleyDiscoverRules.FitOf(new DiscoverFilters(MaxTender: 0, MaxPerNightCents: 10000), C("a", "caribbean", 5, 7, null, ports: null));
        Assert.Empty(fit.Missed);
        Assert.Equal(2, fit.NoData.Count);
        Assert.Null(fit.Ratio);
    }

    // ---- Directions ----

    [Fact]
    public void DirectionsAreDistinctAndTradeOffsAreWorkedOutFromTheClosestFit()
    {
        var all = new List<DiscoverCandidate>
        {
            C("lead", "caribbean", 5, 7, 20000, ports: 4, tenders: 1),
            C("cheap", "caribbean", 5, 7, 12000, ports: 3, tenders: 0, ship: "star-princess"),
            C("ports", "western-med", 5, 7, 25000, ports: 6, tenders: 2),
            C("past", "caribbean", 1, 7, 5000) with { Departure = new DateOnly(2026, 12, 1) },
        };
        var f = new DiscoverFilters(Months: [5], NightsMin: 6, NightsMax: 8, Warm: true);
        var d = StanleyDiscoverRules.Directions(f, all, Today);
        Assert.True(d.Directions.Count >= 2);
        Assert.Equal(d.Directions.Count, d.Directions.Select(x => x.SailingId).Distinct().Count());
        Assert.DoesNotContain(d.Directions, x => x.SailingId == "past");
        // All three fit equally on what has an answer, so the cheapest leads; the others say how they differ from it.
        Assert.Equal(("bestFit", "cheap"), (d.Directions[0].Kind, d.Directions[0].SailingId));
        var lead = d.Directions.First(x => x.SailingId == "lead");
        Assert.Contains(lead.TradeOffs, t => t.Contains("$80 a night more than the closest-fit"));
        Assert.All(d.Directions, x => Assert.NotEmpty(x.TradeOffs));
        // The warm check has no answer for the Mediterranean in May, so it is listed as no data rather than met or missed.
        Assert.Contains(d.Directions.First(x => x.SailingId == "ports").NoData, n => n == "Warm weather");
    }

    [Fact]
    public void SailingsThatMissMostAsksAreNotOffered()
    {
        var f = new DiscoverFilters(Months: [5], Regions: ["caribbean"], NightsMin: 6, NightsMax: 8);
        var d = StanleyDiscoverRules.Directions(f, [C("away", "scandinavia", 9, 14, 30000), C("near", "caribbean", 5, 7, 20000)], Today);
        Assert.Equal(["near"], d.Directions.Select(x => x.SailingId).ToArray());
        Assert.Equal("onlyOne", d.Note);
        Assert.Equal("none", StanleyDiscoverRules.Directions(f, [C("away", "scandinavia", 9, 14, 30000)], Today).Note);
    }

    // ---- Compare ----

    [Fact]
    public void EveryFigureComesFromTheCandidatesAndTheBestPerCriterionIsNamed()
    {
        var a = C("a", "caribbean", 5, 7, 20000, ports: 4, tenders: 0);
        var b = C("b", "caribbean", 5, 7, 15000, ports: 3, tenders: 2);
        var c = StanleyDiscoverRules.Compare([a, b], StanleyDiscoverRules.DefaultWeights(), DiscoverFilters.None);
        Assert.Equal(["b"], c.IfYouValue.First(x => x.Criterion == "price").SailingIds);
        Assert.Equal(["a"], c.IfYouValue.First(x => x.Criterion == "ports").SailingIds);
        Assert.Equal(["a"], c.IfYouValue.First(x => x.Criterion == "tender").SailingIds);
        Assert.Equal("$150 a night", c.Rows.First(r => r.SailingId == "b").Cells.First(x => x.Key == "price").Text);
        Assert.Contains("Port1: 8 hours in port, tender needed", c.Rows.First(r => r.SailingId == "b").PortNotes);
        Assert.Contains("not a particular cabin", c.PriceBasis);
    }

    [Fact]
    public void ChangingTheWeightsChangesTheOrderAndAllZeroGivesNoScore()
    {
        var a = C("a", "caribbean", 5, 7, 20000, ports: 6, tenders: 0);
        var b = C("b", "caribbean", 5, 7, 10000, ports: 3, tenders: 0);
        var byPrice = StanleyDiscoverRules.Compare([a, b], StanleyDiscoverRules.CleanWeights(new() { ["price"] = 5, ["ports"] = 0, ["seaDays"] = 0, ["tender"] = 0, ["fit"] = 0 })!, DiscoverFilters.None);
        var byPorts = StanleyDiscoverRules.Compare([a, b], StanleyDiscoverRules.CleanWeights(new() { ["price"] = 0, ["ports"] = 5, ["seaDays"] = 0, ["tender"] = 0, ["fit"] = 0 })!, DiscoverFilters.None);
        Assert.Equal("b", byPrice.Rows[0].SailingId);
        Assert.Equal("a", byPorts.Rows[0].SailingId);
        var none = StanleyDiscoverRules.Compare([a, b], StanleyDiscoverRules.CleanWeights(new() { ["price"] = 0, ["ports"] = 0, ["seaDays"] = 0, ["tender"] = 0, ["fit"] = 0 })!, DiscoverFilters.None);
        Assert.All(none.Rows, r => Assert.Null(r.Score));
    }

    [Fact]
    public void MissingDataIsLabelledAndNotScoredAsZero()
    {
        var known = C("known", "caribbean", 5, 7, 20000, ports: 4);
        var blank = C("blank", "caribbean", 5, 7, null, ports: null);
        var c = StanleyDiscoverRules.Compare([known, blank], StanleyDiscoverRules.DefaultWeights(), DiscoverFilters.None);
        var row = c.Rows.First(r => r.SailingId == "blank");
        Assert.Contains("Price", row.Missing);
        Assert.Contains("Ports", row.Missing);
        Assert.All(row.Cells, x => Assert.False(x.Known));
        Assert.Null(row.Score);
        Assert.Contains("No itinerary", row.PortNotes[0]);
        Assert.NotNull(c.Rows.First(r => r.SailingId == "known").Score);
    }

    [Fact]
    public void WeightsOutsideTheRangeOrForAnUnknownCriterionAreRefused()
    {
        Assert.Null(StanleyDiscoverRules.CleanWeights(new() { ["price"] = 6 }));
        Assert.Null(StanleyDiscoverRules.CleanWeights(new() { ["price"] = -1 }));
        Assert.Null(StanleyDiscoverRules.CleanWeights(new() { ["commission"] = 5 }));
        Assert.Equal(3, StanleyDiscoverRules.CleanWeights(new() { ["price"] = 5 })!["ports"]);
        // Nothing but the listed criteria can rank a sailing.
        Assert.Equal(["price", "ports", "seaDays", "tender", "fit"], StanleyDiscoverRules.Criteria);
    }

    // ---- Brief ----

    private sealed class FakeAudit : IAuditLog
    {
        public List<AuditEntry> Rows { get; } = [];
        public Task RecordAsync(AuditEntry entry, CancellationToken ct = default) { Rows.Add(entry); return Task.CompletedTask; }
    }

    private sealed class FakeCatalogue : ICatalogueStore
    {
        public Task<CatalogueSnapshot> GetAsync(CancellationToken ct) => Task.FromResult(new CatalogueSnapshot
        {
            Sailings = [new() { Id = "S1", Title = "Caribbean A", ShipId = "sun-princess", Departure = new DateTime(2027, 5, 2), Nights = 7, RegionId = "caribbean" }, new() { Id = "S2", Title = "Med B", ShipId = "star-princess", Departure = new DateTime(2027, 6, 2), Nights = 7, RegionId = "western-med" }],
            Ports = [new() { Id = "aruba", Name = "Aruba" }, new() { Id = "gibraltar", Name = "Gibraltar", Tender = true }],
            SailingDays =
            [
                new() { OwnerId = "S1", Day = 1, PortId = "fll" }, new() { OwnerId = "S1", Day = 2, PortId = "aruba", ArriveLocal = new TimeSpan(8, 0, 0), DepartLocal = new TimeSpan(17, 30, 0) },
                new() { OwnerId = "S1", Day = 3, PortId = "sea" }, new() { OwnerId = "S1", Day = 4, PortId = "fll" },
            ],
            Fares = [new() { SailingId = "S1", CategoryId = "interior", PerNightCents = 14900 }],
        });
    }

    private static (StanleyDiscoverService Svc, FakeAudit Audit) Svc()
    {
        var audit = new FakeAudit();
        return (new StanleyDiscoverService(new FakeCatalogue(), new MemoryStanleyBriefStore(), new FakeClock(T0), audit), audit);
    }

    [Fact]
    public async Task CandidatesComeFromTheCatalogueWithHoursSeaDaysAndPrice()
    {
        var (svc, _) = Svc();
        var all = await svc.CandidatesAsync(default);
        var s1 = all.First(c => c.Id == "S1");
        Assert.Single(s1.Calls!);
        Assert.Equal(9.5, s1.Calls![0].Hours);
        Assert.Equal(1, s1.SeaDays);
        Assert.Equal(14900L, s1.PerNightCents);
        Assert.Equal(14900L * 7, s1.FromCents);
        var s2 = all.First(c => c.Id == "S2");
        Assert.Null(s2.Calls);
        Assert.Null(s2.PerNightCents);
    }

    [Fact]
    public async Task ACompareNeedsTwoToFourKnownSailings()
    {
        var (svc, _) = Svc();
        Assert.Equal("sailings", (await Assert.ThrowsAsync<ApiException>(() => svc.CompareAsync(new(["S1"], null, null), default))).Message);
        Assert.Equal("sailings", (await Assert.ThrowsAsync<ApiException>(() => svc.CompareAsync(new(["S1", "nope"], null, null), default))).Message);
        Assert.Equal("weights", (await Assert.ThrowsAsync<ApiException>(() => svc.CompareAsync(new(["S1", "S2"], new() { ["price"] = 9 }, null), default))).Message);
        Assert.Equal(2, (await svc.CompareAsync(new(["S1", "S2"], null, null), default)).Rows.Count);
    }

    [Fact]
    public async Task TheBriefIsOneGuestsOwnAndComesBackOnAnyDevice()
    {
        var (svc, audit) = Svc();
        Assert.Null((await svc.GetBriefAsync(Me, default)).UpdatedAt);
        await svc.PutBriefAsync(Me, new("late spring", new DiscoverFilters(Months: [5]), ["S1", "S2"], null, ["wheelchair"]), default);
        var back = await svc.GetBriefAsync(Me, default);
        Assert.Equal(T0, back.UpdatedAt);
        Assert.Equal(["S1", "S2"], back.Brief.Shortlist!);
        Assert.Equal([5], back.Brief.Filters!.Months!);
        Assert.Null((await svc.GetBriefAsync(Other, default)).UpdatedAt);
        Assert.All(audit.Rows, r => Assert.DoesNotContain("wheelchair", r.Detail));
        await svc.DeleteBriefAsync(Me, default);
        Assert.Null((await svc.GetBriefAsync(Me, default)).UpdatedAt);
    }

    [Theory]
    [InlineData("shortlist")]
    [InlineData("filters")]
    [InlineData("weights")]
    [InlineData("needs")]
    [InlineData("tooLong")]
    public async Task ABadBriefIsRefusedWithACode(string code)
    {
        var (svc, _) = Svc();
        DiscoverBrief bad = code switch
        {
            "shortlist" => new(null, null, ["S1", "ghost"], null, null),
            "filters" => new(null, new DiscoverFilters(Months: [0]), null, null, null),
            "weights" => new(null, null, null, new() { ["price"] = 7 }, null),
            "needs" => new(null, null, null, null, ["a", "b", "c", "d", "e", "f", "g"]),
            _ => new(new string('x', 501), null, null, null, null),
        };
        Assert.Equal(code, (await Assert.ThrowsAsync<ApiException>(() => svc.PutBriefAsync(Me, bad, default))).Message);
    }

    [Fact]
    public async Task AChildAccountSavesNoBrief() => await Assert.ThrowsAsync<ApiException>(() => Svc().Svc.PutBriefAsync(Child, new("x", null, null, null, null), default));

    [Fact]
    public async Task TheSharedTextLeavesNeedsOutUnlessAsked()
    {
        var (svc, _) = Svc();
        await svc.PutBriefAsync(Me, new("x", new DiscoverFilters(Months: [5], Warm: true), ["S1"], null, ["wheelchair"], "Our ideal cruise"), default);
        var plain = await svc.ShareAsync(Me, false, default);
        Assert.Contains("When: May", plain);
        Assert.Contains("Caribbean A, 2027-05-02", plain);
        Assert.DoesNotContain("wheelchair", plain);
        Assert.Contains("Needs: wheelchair", await svc.ShareAsync(Me, true, default));
        await Assert.ThrowsAsync<ApiException>(() => svc.ShareAsync(Other, false, default));
    }

    // ---- Booking help ----

    [Fact]
    public void LikelySlipsInANameOrDateAreFlaggedAsHintsOnly()
    {
        var r = StanleyDiscoverRules.CheckBooking(new("MR JOHN", "J0NES1", "2030-01-01", "2027-06-01"), Today);
        Assert.Equal(["digits", "title", "case"], r.Flags.Where(f => f.Field is "firstName" or "lastName").Select(f => f.Code).Distinct().Take(3).OrderBy(x => x == "digits" ? 0 : x == "title" ? 1 : 2).ToArray());
        Assert.Contains(r.Flags, f => f.Field == "birthDate" && f.Code == "future");
        Assert.Contains("final decision", r.Authority);
        Assert.Empty(StanleyDiscoverRules.CheckBooking(new("Ana", "Lopez", "1980-04-23", "2027-06-01"), Today).Flags);
    }

    [Fact]
    public void ASailingDatePastAndAFormatSlipAreFlagged()
    {
        var r = StanleyDiscoverRules.CheckBooking(new("Ana", "Lopez", "23/04/1980", "2026-01-01"), Today);
        Assert.Contains(r.Flags, f => f.Code == "format");
        Assert.Contains(r.Flags, f => f.Code == "past");
        Assert.Contains(StanleyDiscoverRules.CheckBooking(new("Ana", "Lopez", "2010-03-01", "2027-02-01"), Today).Flags, f => f.Code == "turns18");
    }
}
