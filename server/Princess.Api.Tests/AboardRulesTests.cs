using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The pure rules of Phase 10c, ported from src/domain/services.ts, catalogue.ts, tv.ts and games.ts.</summary>
public class AboardRulesTests
{
    private const long Min = 60_000;

    // ---- Requests ----

    [Theory]
    [InlineData(0, "received")]
    [InlineData(9, "received")]
    [InlineData(10, "onTheWay")]
    [InlineData(19, "onTheWay")]
    [InlineData(20, "done")]
    public void ARequestMovesFromReceivedToOnTheWayToDoneOverItsUsualTime(int minutes, string stage) =>
        Assert.Equal(stage, ServiceRules.RequestStage(0, 20, minutes * Min, false));

    [Fact]
    public void ACancelledRequestStaysCancelled() => Assert.Equal("cancelled", ServiceRules.RequestStage(0, 20, 99 * Min, true));

    // ---- Reports ----

    [Theory]
    [InlineData("theft", "Deck 5 aft", "Wallet taken from a chair", null)]
    [InlineData("nope", "Deck 5", "Wallet taken", "badKind")]
    [InlineData("theft", " ", "Wallet taken", "noWhere")]
    [InlineData("theft", "Deck 5", "tiny", "noNote")]
    public void AReportNeedsAKindAPlaceAndAnote(string kind, string where, string note, string? problem) => Assert.Equal(problem, ServiceRules.ReportProblem(kind, where, note));

    [Fact]
    public void AReportCannotBeTooLongOrOfAPlaceThatDoesNotFit()
    {
        Assert.Equal("tooLong", ServiceRules.ReportProblem("hazard", "Deck 5", new string('x', 601)));
        Assert.Equal("noWhere", ServiceRules.ReportProblem("hazard", new string('x', 81), "Spill by the pool"));
    }

    // ---- Drinks ----

    private static (string, long)[] Beers(int n, long startMin, long everyMin) => [.. Enumerable.Range(0, n).Select(i => ("beer", (startMin + i * everyMin) * Min))];

    [Fact]
    public void DrinksUnderThePackageCapAreCoveredAndTheRestArePaid()
    {
        var s = ServiceRules.DrinkSummary([("beer", 0), ("premiumCocktail", Min)], 15, 2 * Min);
        Assert.Equal((2, 1, 14, 1900L), (s.Today, s.Covered, s.Left, s.Paid));               // the $19 cocktail is over the $15 cap
    }

    [Fact]
    public void NoPackageMeansNothingIsCoveredAndNoDrinksLeftIsNull()
    {
        var s = ServiceRules.DrinkSummary([("wine", 0)], 0, Min);
        Assert.Equal((0, null, 1200L), (s.Covered, s.Left, s.Paid));
    }

    [Fact]
    public void ThePackageCoversFifteenDrinksADay()
    {
        var s = ServiceRules.DrinkSummary([.. Enumerable.Range(0, 16).Select(i => ("soda", i * Min))], 15, 30 * Min);
        Assert.Equal((15, 0, 400L), (s.Covered, s.Left, s.Paid));
    }

    [Theory]
    [InlineData(3, "none")]
    [InlineData(4, "slow")]
    [InlineData(5, "slow")]
    [InlineData(6, "stop")]
    public void FourAlcoholicDrinksInThreeHoursIsANudgeAndSixIsAStop(int drinks, string alert) =>
        Assert.Equal(alert, ServiceRules.DrinkSummary(Beers(drinks, 0, 10), 15, 60 * Min).Alert);

    [Fact]
    public void DrinksMoreThanThreeHoursAgoDoNotCountTowardsTheAlert() =>
        Assert.Equal("none", ServiceRules.DrinkSummary(Beers(6, 0, 1), 15, 200 * Min).Alert);

    [Fact]
    public void SoftDrinksNeverRaiseTheAlert() =>
        Assert.Equal("none", ServiceRules.DrinkSummary([.. Enumerable.Range(0, 8).Select(i => ("soda", i * Min))], 15, 10 * Min).Alert);

    // ---- Group tables ----

    [Fact]
    public void AFriendNeedsANameAFourOrFiveDigitCabinAndASeat()
    {
        var table = new List<TableFriend> { new("Ann Lee", "8101") };
        Assert.Null(ServiceRules.FriendProblem("Bo Chan", "8102", table, 3));
        Assert.Equal("noName", ServiceRules.FriendProblem("B", "8102", table, 3));
        Assert.Equal("badCabin", ServiceRules.FriendProblem("Bo Chan", "81", table, 3));
        Assert.Equal("duplicate", ServiceRules.FriendProblem(" ann lee ", "8101", table, 3));
        Assert.Equal("full", ServiceRules.FriendProblem("Bo Chan", "8102", table, 7));                // 7 + 1 friend = 8 seats
    }

    // ---- Money ----

    [Theory]
    [InlineData(25, 0, null)]
    [InlineData(1000, 0, null)]
    [InlineData(30, 0, "badAmount")]
    [InlineData(1025, 0, "badAmount")]
    [InlineData(0, 0, "badAmount")]
    [InlineData(500, 1600, "tooMuch")]
    [InlineData(400, 1600, null)]
    public void ATopUpIsInStepsOfTwentyFiveUpToACapPerBookingAndPerTopUp(int dollars, int already, string? problem) =>
        Assert.Equal(problem, ServiceRules.TopUpProblem(dollars, already));

    [Fact]
    public void ATopUpWithNoAmountIsBad() => Assert.Equal("badAmount", ServiceRules.TopUpProblem(null, 0));

    [Theory]
    [InlineData("1357", null)]
    [InlineData("135", "format")]
    [InlineData("13a7", "format")]
    [InlineData("12345", "format")]
    [InlineData("1111", "weak")]
    [InlineData("1234", "weak")]
    [InlineData("4321", "weak")]
    [InlineData("0123", "weak")]
    public void APinIsFourDigitsAndNotEasyToGuess(string pin, string? problem) => Assert.Equal(problem, ServiceRules.PinProblem(pin));

    [Fact]
    public void GratuitiesAreDuePerNightForGuestsWhoseTierDoesNotIncludeThem()
    {
        Assert.Equal(1_650 * 7 * 2 + 1_850 * 7, ServiceRules.GratuityDue([(false, false), (false, false), (true, false)]));
        Assert.Equal(1_650 * 7, ServiceRules.GratuityDue([(false, false), (false, true)]));
        Assert.Equal(0, ServiceRules.GratuityDue([(false, true)]));
    }

    [Fact]
    public void OnlyKnownCurrenciesAreOffered()
    {
        Assert.Equal("€", ServiceRules.CurrencyByCode("EUR")!.Symbol);
        Assert.Null(ServiceRules.CurrencyByCode("XXX"));
    }

    // ---- Parties ----

    [Fact]
    public void APartyNeedsATitleADayInTheWeekAnEveningTimeAndSomeNeighbours()
    {
        string[] cabins = ["8101", "8102"];
        Assert.Null(ServiceRules.PartyProblem("Birthday", 3, "20:00", cabins));
        Assert.Equal("noTitle", ServiceRules.PartyProblem("B", 3, "20:00", cabins));
        Assert.Equal("badDay", ServiceRules.PartyProblem("Birthday", 8, "20:00", cabins));
        Assert.Equal("badTime", ServiceRules.PartyProblem("Birthday", 3, "8pm", cabins));
        Assert.Equal("quiet", ServiceRules.PartyProblem("Birthday", 3, "23:00", cabins));
        Assert.Equal("quiet", ServiceRules.PartyProblem("Birthday", 3, "07:59", cabins));
        Assert.Equal("noCabins", ServiceRules.PartyProblem("Birthday", 3, "20:00", []));
        Assert.Equal("tooMany", ServiceRules.PartyProblem("Birthday", 3, "20:00", ["8101", "8102", "8103", "8104", "8105", "8106", "8107"]));
        Assert.Equal("badCabin", ServiceRules.PartyProblem("Birthday", 3, "20:00", ["8101", "8101"]));
        Assert.Equal("badCabin", ServiceRules.PartyProblem("Birthday", 3, "20:00", ["81"]));
    }

    [Fact]
    public void ANeighboursAnswerIsTheSameEveryTimeAndMatchesTheScreens()
    {
        Assert.Equal(ServiceRules.Rsvp("8101", "Birthday"), ServiceRules.Rsvp("8101", "Birthday"));
        // djb2 of "8101|Birthday" % 3, worked out by the same hash src/domain/services.ts uses
        Assert.Equal(new[] { "yes", "maybe", "no" }[(int)(ExcursionRules.Hash("8101|Birthday") % 3)], ServiceRules.Rsvp("8101", "Birthday"));
    }

    // ---- Safeguards ----

    [Theory]
    [InlineData("image/png", 500, 30, null)]
    [InlineData("image/gif", 500, 30, "type")]
    [InlineData("image/png", 0, 30, "empty")]
    [InlineData("image/png", 1_000_001, 30, "size")]
    [InlineData("image/png", 500, 17, "age")]
    public void APhotoIsAnImageUnderOneMegabyteFromAnAdult(string type, long bytes, int age, string? problem) => Assert.Equal(problem, ServiceRules.PhotoProblem(type, bytes, age));

    [Theory]
    [InlineData("call me on 555 123 4567", 12, "contactInfo")]
    [InlineData("see https://example.com", 12, "contactInfo")]
    [InlineData("see www.example.com", 12, "contactInfo")]
    [InlineData("see you at 7", 12, null)]
    [InlineData("call me on 555 123 4567", 30, null)]
    public void UnderEighteensCannotPassOnANumberOrALink(string text, int age, string? problem) => Assert.Equal(problem, ServiceRules.ChildSafeProblem(text, age));

    [Fact]
    public void TheListOfReportReasonsIsFixed() => Assert.Equal(["spam", "rude", "unsafe", "photo"], ServiceRules.ReportReasons);

    // ---- Catalogue ----

    [Fact]
    public void ABookingNeedsAKnownItemAValidDayAndTimeAndAnAllowedQuantity()
    {
        Assert.Null(CatalogueRules.Problem(new("spa-swedish", 2, "13:00", 1), 30));
        Assert.Equal("unknown", CatalogueRules.Problem(new("nope", 2, "13:00", 1), 30));
        Assert.Equal("badDay", CatalogueRules.Problem(new("fit-yoga", 3, "07:00", 1), 30));
        Assert.Equal("badTime", CatalogueRules.Problem(new("spa-swedish", 2, "12:00", 1), 30));
        Assert.Equal("badTime", CatalogueRules.Problem(new("sp-art", 2, "", 1), 30));
        Assert.Equal("badQty", CatalogueRules.Problem(new("spa-swedish", 2, "13:00", 7), 30));
        Assert.Equal("badQty", CatalogueRules.Problem(new("sp-art", 2, "15:30", 2), 30));            // you just mark that you are going
        Assert.Equal("age", CatalogueRules.Problem(new("spa-swedish", 2, "13:00", 1), 15));
    }

    [Fact]
    public void GoodsAreOrderedWithNoDayOrTimeAndMustBeInStock()
    {
        Assert.Null(CatalogueRules.Problem(new("shop-hat", 0, "", 2), 30));
        Assert.Equal("notBookable", CatalogueRules.Problem(new("shop-hat", 2, "", 2), 30));
        Assert.Equal("notBookable", CatalogueRules.Problem(new("shop-hat", 0, "10:00", 2), 30));
        Assert.Equal("soldOut", CatalogueRules.Problem(new("shop-hat", 0, "", 3), 30, taken: 10));  // 12 in stock, 10 gone
        Assert.Equal("age", CatalogueRules.Problem(new("gift-champagne", 0, "", 1), 20));
    }

    [Fact]
    public void WhatOthersHaveTakenIsStableAndNeverEmptiesAClass()
    {
        foreach (var i in CatalogueRules.Items.Where(i => i.Limit is not null))
        {
            var taken = CatalogueRules.TakenByOthers(i, 2, "10:00");
            Assert.Equal(taken, CatalogueRules.TakenByOthers(i, 2, "10:00"));
            Assert.InRange(taken, 0, i.Limit!.Value * 3 / 4);
            Assert.True(CatalogueRules.PlacesLeft(i, 2, "10:00", 0) >= 1);
        }
        Assert.Equal(0, CatalogueRules.TakenByOthers(CatalogueRules.ById("gift-25")!, 0));       // no limit, none taken
        Assert.Null(CatalogueRules.PlacesLeft(CatalogueRules.ById("gift-25")!, 0, "", 0));
    }

    [Fact]
    public void TheChargeIsThePriceTimesTheQuantityAndFreeThingsCostNothing()
    {
        Assert.Equal(5800, CatalogueRules.ChargeFor(CatalogueRules.ById("shop-hat")!, 2));
        Assert.Equal(0, CatalogueRules.ChargeFor(CatalogueRules.ById("fit-yoga")!, 1));
        Assert.Equal(0, CatalogueRules.ChargeFor(CatalogueRules.ById("sp-art")!, 1));
    }

    // ---- TV and games ----

    [Theory]
    [InlineData("G", 3, true)]
    [InlineData("PG", 7, false)]
    [InlineData("PG", 8, true)]
    [InlineData("PG-13", 12, false)]
    [InlineData("PG-13", 13, true)]
    [InlineData("R", 40, false)]
    public void ATitleNeedsTheRightAge(string rating, int age, bool allowed) => Assert.Equal(allowed, TvAndGameRules.TitleAllowed(rating, age));

    [Fact]
    public void StoredTvStateIsRepairedToDefaultsWhereItIsNotValid()
    {
        Assert.Equal(TvAndGameRules.DefaultTv, TvAndGameRules.ParseTv(null));
        Assert.Equal(TvAndGameRules.DefaultTv, TvAndGameRules.ParseTv("not json"));
        var repaired = TvAndGameRules.ParseTv("""{"on":true,"channel":99,"volume":-5,"muted":true,"casting":"Phone","vod":"v-nope"}""");
        Assert.Equal(new TvState(true, 1, 20, true, "Phone", null), repaired);
        Assert.Equal(repaired with { Channel = 12, Vod = "v-reef" }, TvAndGameRules.ParseTv(TvAndGameRules.TvJson(repaired with { Channel = 12, Vod = "v-reef" })));
    }

    [Fact]
    public void DeviceNamesAreShortAndPlain()
    {
        Assert.True(TvAndGameRules.DeviceNameOk("Daniel's phone"));
        Assert.False(TvAndGameRules.DeviceNameOk("<script>"));
        Assert.False(TvAndGameRules.DeviceNameOk(new string('a', 41)));
    }

    [Fact]
    public void StoredGameStateKeepsOnlyKnownCluesQuestionsAndBingoNumbers()
    {
        var g = TvAndGameRules.ParseGame("""{"found":["h-pool","h-pool","nope"],"answers":{"q-ports":1,"q-sun":9,"zzz":0},"marked":[5,5,0,76,75]}""");
        Assert.Equal(["h-pool"], g.Found);
        Assert.Equal(new Dictionary<string, int> { ["q-ports"] = 1 }, g.Answers);
        Assert.Equal([5, 75], g.Marked);
        var again = TvAndGameRules.ParseGame(TvAndGameRules.GameJson(g));
        Assert.Equal(g.Found, again.Found);
        Assert.Equal(g.Marked, again.Marked);
        Assert.Equal(g.Answers, again.Answers);
    }
}
