using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Mirrors the pricing, fares, paying, cancellation and cabin cases of <c>src/domain/booking.test.ts</c> and <c>discover.test.ts</c>.</summary>
public class PricingRulesTests
{
    private static readonly string[] Sailings =
        ["sun-2026-11-08", "sun-2026-11-22", "sun-2026-12-06", "sun-2026-12-27", "sun-2027-01-17", "sun-2027-02-07", "sun-2027-02-28", "sun-2027-03-21"];

    [Fact]
    public void EverySailingAndRoomTypeHasAPrice()
    {
        foreach (var s in Sailings)
            foreach (var c in Pricing.Categories) Assert.NotNull(Pricing.Quote(s, c.Id, 2));
    }

    [Fact]
    public void TheLowestInteriorFareIsTheFromPriceAndHigherRoomsCostMore()
    {
        Assert.Equal(153_900, Sailings.Min(s => Pricing.FromPriceOf(s)!.Fare));
        var totals = Pricing.Categories.Select(c => Pricing.Quote("sun-2027-03-21", c.Id, 2)!.Total).ToList();
        Assert.Equal(totals.Order().ToList(), totals);
        Assert.True(Pricing.FromPriceOf("sun-2026-12-27")!.Fare > Pricing.FromPriceOf("sun-2026-11-08")!.Fare);
    }

    [Fact]
    public void EveryChargeIsALineThatAddsUpToTheTotal()
    {
        foreach (var guests in new[] { 1, 2, 3, 4 })
        {
            var q = Pricing.Quote("sun-2027-03-21", "balcony", guests)!;
            Assert.Equal(q.Total, q.Lines.Sum(l => l.Cents));
            Assert.Equal(Pricing.TaxesAndFees * guests, q.Lines.Single(l => l.Key == "taxes").Cents);
            Assert.Equal(q.Gratuities, q.Lines.Single(l => l.Key == "gratuities").Cents);
            Assert.Equal(Pricing.JsRound((double)q.Total / guests), q.PerPerson);
        }
    }

    [Fact]
    public void ChargesASoloSupplementAndAReducedFareForTheThirdAndFourthGuest()
    {
        Assert.Equal(["fare", "soloSupplement", "taxes", "gratuities"], Pricing.Quote("sun-2027-03-21", "interior", 1)!.Lines.Select(l => l.Key));
        var four = Pricing.Quote("sun-2027-03-21", "interior", 4)!;
        var fare = four.Lines.Single(l => l.Key == "fare");
        var extra = four.Lines.Single(l => l.Key == "extraFare");
        Assert.Equal(2, extra.Guests);
        Assert.True(extra.Cents < fare.Cents);
        Assert.DoesNotContain(Pricing.Quote("sun-2027-03-21", "interior", 2)!.Lines, l => l.Key == "extraFare");
    }

    [Fact]
    public void ChargesTheHigherGratuityInSuitesAndRefusesWhatItCannotPrice()
    {
        long PerNight(string c) => Pricing.Quote("sun-2027-03-21", c, 2)!.Gratuities / (2 * Pricing.Nights);
        Assert.True(PerNight("miniSuite") > PerNight("balcony"));
        Assert.Null(Pricing.Quote("sun-2020-01-01", "interior", 2));
        Assert.Null(Pricing.Quote("sun-2027-03-21", "nope", 2));
        foreach (var guests in new[] { 0, 5, -1 }) Assert.Null(Pricing.Quote("sun-2027-03-21", "interior", guests));
    }

    [Fact]
    public void RoundsHalvesUpLikeTheScreensDo()
    {
        Assert.Equal(3, Pricing.JsRound(2.5));
        Assert.Equal(-2, Pricing.JsRound(-2.5));
        Assert.Equal(187_800, Pricing.FareFor("sun-2026-11-08", "oceanview"));   // 153,900 x 1.22 = 187,758, to the dollar
    }

    [Fact]
    public void StandardPricesLikeTheEstimateAndAPackageSwapsTheGratuitiesLine()
    {
        var std = Pricing.BookingQuote("sun-2027-03-21", "balcony", 2, "standard")!;
        Assert.Equal(Pricing.Quote("sun-2027-03-21", "balcony", 2)!.Total, std.Total);
        Assert.Equal("standard", std.Fare);

        var plus = Pricing.BookingQuote("sun-2027-03-21", "balcony", 2, "plus")!;
        Assert.Equal(["fare", "taxes", "package"], plus.Lines.Select(l => l.Key));
        Assert.Equal(6000 * 7 * 2, plus.Lines.Single(l => l.Key == "package").Cents);
        Assert.Equal(std.Total - std.Gratuities + 6000 * 7 * 2, plus.Total);
        Assert.Equal(plus.Total, plus.Lines.Sum(l => l.Cents));
        Assert.Equal(0, plus.Gratuities);
    }

    [Fact]
    public void SuitesIncludePremierAndAllowOnlyPremier()
    {
        Assert.Equal(["premier"], Pricing.FareOptions("signatureSuite"));
        Assert.Equal("premier", Pricing.FareIncluded("sanctuaryMiniSuite"));
        Assert.Null(Pricing.BookingQuote("sun-2027-03-21", "signatureSuite", 2, "plus"));
        Assert.Equal(0, Pricing.BookingQuote("sun-2027-03-21", "signatureSuite", 2, "premier")!.Lines.Single(l => l.Key == "package").Cents);
        Assert.Equal(["standard", "plus", "premier"], Pricing.FareOptions("balcony"));
    }

    [Fact]
    public void RefusesUnknownSailingsAndTooManyGuests()
    {
        Assert.Null(Pricing.BookingQuote("nope", "balcony", 2, "standard"));
        Assert.Null(Pricing.BookingQuote("sun-2027-03-21", "signatureSuite", 4, "premier"));
        Assert.Equal(3, Pricing.CapacityOf("signatureSuite"));
    }

    [Fact]
    public void GivesAnOnboardCreditOnlyWhenSailingIsFarEnoughAwayAndMoreForSuites()
    {
        Assert.Empty(Pricing.PromotionsFor("balcony", 119));
        Assert.Equal(15_000, Pricing.PromotionsFor("balcony", 120)[0].CreditCents);
        Assert.Equal(30_000, Pricing.PromotionsFor("miniSuite", 200)[0].CreditCents);
    }

    [Fact]
    public void ClosesASailingTheDayItLeaves()
    {
        Assert.True(Pricing.Bookable(1));
        Assert.False(Pricing.Bookable(0));
    }

    [Fact]
    public void OffersADepositUntilTheFinalPaymentDateThenOnlyTheFullAmount()
    {
        var far = Pricing.PayPlanFor(500_000, new DateOnly(2027, 3, 21), 143);
        Assert.Equal(["deposit", "full"], far.Options);
        Assert.Equal(100_000, far.Deposit);
        Assert.Equal("2026-12-21", far.FinalDue);
        Assert.Equal(100_000, Pricing.DueNow(far, "deposit"));
        Assert.Equal(500_000, Pricing.DueNow(far, "full"));
        Assert.Equal(["full"], Pricing.PayPlanFor(500_000, new DateOnly(2027, 3, 21), 90).Options);
        Assert.Equal(["full"], Pricing.PayPlanFor(500_000, new DateOnly(2027, 3, 21), 10, 10).Options);
        Assert.Equal(["deposit", "full"], Pricing.PayPlanFor(500_000, new DateOnly(2027, 3, 21), 11, 10).Options);
    }

    private static PaymentPart Card(Guid id, long cents) => new("card", id, cents);
    private static readonly Guid A = Guid.NewGuid(), B = Guid.NewGuid(), C = Guid.NewGuid();

    [Fact]
    public void ChecksThePartsMakeUpTheAmountDue()
    {
        Assert.Null(PaymentRules.CheckParts([Card(A, 100)], 100));
        Assert.Null(PaymentRules.CheckParts([Card(A, 60), new PaymentPart("wallet", null, 40)], 100));
        Assert.Equal("empty", PaymentRules.CheckParts([], 100));
        Assert.Equal("empty", PaymentRules.CheckParts(null, 100));
        Assert.Equal("tooMany", PaymentRules.CheckParts([Card(A, 50), Card(B, 25), Card(C, 25)], 100));
        Assert.Equal("sum", PaymentRules.CheckParts([Card(A, 99)], 100));
        Assert.Equal("amount", PaymentRules.CheckParts([Card(A, 0), Card(B, 100)], 100));
        Assert.Equal("duplicate", PaymentRules.CheckParts([Card(A, 50), Card(A, 50)], 100));
        Assert.Equal("amount", PaymentRules.CheckParts([new PaymentPart("bitcoin", null, 100)], 100));
        Assert.Equal("amount", PaymentRules.CheckParts([new PaymentPart("card", null, 100)], 100));
    }

    [Fact]
    public void AsksForTheBankCheckOnANewCardOrALargePaymentNeverForTheWallet()
    {
        Assert.False(PaymentRules.ScaRequired("card", true, Pricing.ScaLimit - 100));
        Assert.True(PaymentRules.ScaRequired("card", true, Pricing.ScaLimit));
        Assert.True(PaymentRules.ScaRequired("card", false, 100));
        Assert.False(PaymentRules.ScaRequired("wallet", false, 999_999));
    }
}

public class PolicyRulesTests
{
    [Fact]
    public void CancellationIsFreeForADayWhenSailingIsAWeekAway()
    {
        Assert.Equal(new CancelTerms("free24h", 0, 100_000), PolicyRules.CancelTermsFor(500_000, 100_000, 100_000, 50, 3));
        Assert.Equal("final", PolicyRules.CancelTermsFor(500_000, 100_000, 100_000, 5, 3).Tier);
    }

    [Fact]
    public void ChargesMoreAsSailingGetsCloserAndNeverRefundsMoreThanWasPaid()
    {
        Assert.Equal(new CancelTerms("early", 100_000, 0), PolicyRules.CancelTermsFor(500_000, 100_000, 100_000, 120, 100));
        Assert.Equal(new CancelTerms("mid", 250_000, 250_000), PolicyRules.CancelTermsFor(500_000, 500_000, 100_000, 90, 100));
        Assert.Equal(new CancelTerms("late", 375_000, 125_000), PolicyRules.CancelTermsFor(500_000, 500_000, 100_000, 45, 100));
        Assert.Equal(new CancelTerms("final", 500_000, 0), PolicyRules.CancelTermsFor(500_000, 500_000, 100_000, 14, 100));
        Assert.Equal(0, PolicyRules.CancelTermsFor(500_000, 100_000, 100_000, 30, 100).Refund);
    }

    [Fact]
    public void ADateChangeNeedsTheCurrentAndNewDatesOutsideTheFinalPaymentDate()
    {
        Assert.Equal("ok", PolicyRules.ChangeCheck(143, 200, false));
        Assert.Equal("tooLate", PolicyRules.ChangeCheck(90, 200, false));
        Assert.Equal("newTooSoon", PolicyRules.ChangeCheck(143, 60, false));
        Assert.Equal("same", PolicyRules.ChangeCheck(143, 143, true));
        Assert.Equal("ok", PolicyRules.ChangeCheck(40, 60, false, 10));
    }

    [Fact]
    public void LogsAcceptanceInDocumentOrderWithTheVersionShown()
    {
        Assert.Equal(["terms", "health", "age", "pregnancy"], PolicyRules.LegalIds);
        Assert.Equal(["terms", "age"], PolicyRules.Accepted(new Dictionary<string, bool> { ["age"] = true, ["terms"] = true, ["health"] = false }));
        Assert.Empty(PolicyRules.Accepted(null));
        Assert.Equal("2026-10", PolicyRules.VersionLabel(PolicyRules.LegalVersion));
    }
}

public class LoyaltyRulesTests
{
    private static string WithCheck(string six) => $"CC{six}{six.Select((c, i) => (c - '0') * (i + 1)).Sum() % 10}";

    [Fact]
    public void ANumberIsCcAndSevenDigitsWithACheckDigit()
    {
        var good = WithCheck("123456");
        Assert.True(Pricing.LoyaltyNumberOk(good));
        Assert.False(Pricing.LoyaltyNumberOk(good[..^1] + (good[^1] == '0' ? '1' : '0')));
        Assert.False(Pricing.LoyaltyNumberOk("CC12345"));
        Assert.False(Pricing.LoyaltyNumberOk("XX1234567"));
        Assert.False(Pricing.LoyaltyNumberOk(null));
    }

    [Fact]
    public void TakesAMemberDiscountByLevelAndCreditNeverBelowTheMinimumPaid()
    {
        var n = WithCheck("123456");
        Assert.Equal(new Pricing.PerkSums(0, 0, 500_000), Pricing.ApplyPerks(500_000, "", "none", false, 0));
        Assert.Equal(new Pricing.PerkSums(10_000, 0, 490_000), Pricing.ApplyPerks(500_000, n, "gold", false, 0));
        Assert.Equal(new Pricing.PerkSums(35_000, 0, 465_000), Pricing.ApplyPerks(500_000, n, "elite", false, 0));
        Assert.Equal(new Pricing.PerkSums(0, 50_000, 450_000), Pricing.ApplyPerks(500_000, "", "none", true, 50_000));
        Assert.Equal(new Pricing.PerkSums(0, 490_000, 10_000), Pricing.ApplyPerks(500_000, "", "none", true, 900_000));
        Assert.Equal(0, Pricing.ApplyPerks(5_000, "", "none", true, 900_000).Credit);
    }

    [Fact]
    public void AnyOtherValidNumberJoinsAtGold()
    {
        var own = WithCheck("111111");
        Assert.Equal("platinum", Pricing.TierForNumber(own, own, "platinum"));
        Assert.Equal("gold", Pricing.TierForNumber(WithCheck("222222"), own, "platinum"));
    }
}

public class CabinRulesTests
{
    [Fact]
    public void GivesTheSameSampleRoomsEveryTimeWithFreeOnesToChoose()
    {
        var a = CabinRules.CabinsFor("sun-2027-03-21", "balcony");
        Assert.Equal(a.Select(c => c.Number), CabinRules.CabinsFor("sun-2027-03-21", "balcony").Select(c => c.Number));
        Assert.Equal(9, a.Count);
        Assert.True(a[0].Available && a[1].Available);
        Assert.Equal(9, a.Select(c => c.Number).Distinct().Count());
        foreach (var s in new[] { "sun-2026-11-08", "sun-2027-03-21" })
            foreach (var c in Pricing.Categories) Assert.Contains(CabinRules.CabinsFor(s, c.Id), x => x.Available);
        Assert.Empty(CabinRules.CabinsFor("sun-2027-03-21", "nope"));
    }

    [Fact]
    public void MatchesTheSeededStaterooms()
    {
        // db/seed/reference/01-ship.sql lists interior 8188, 9225 and 10262 first.
        Assert.Equal(["8188", "9225", "10262"], CabinRules.CabinsFor("sun-2027-03-21", "interior").Take(3).Select(c => c.Number));
        Assert.True(CabinRules.CabinsFor("sun-2027-03-21", "interior")[1].Accessible);
    }

    [Fact]
    public void ChecksANumberAgainstTheFreeRoomsOfThatTypeAndDropsBookedOnes()
    {
        var first = CabinRules.CabinsFor("sun-2027-03-21", "interior")[0].Number;
        Assert.True(CabinRules.Available("sun-2027-03-21", "interior", first));
        Assert.False(CabinRules.Available("sun-2027-03-21", "interior", "99999"));
        Assert.False(CabinRules.Available("sun-2027-03-21", "balcony", first));
        Assert.False(CabinRules.Available("sun-2027-03-21", "interior", first, new HashSet<string> { first }));
        Assert.False(CabinRules.CabinsFor("sun-2027-03-21", "interior", new HashSet<string> { first })[0].Available);
    }
}
