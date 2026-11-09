using Princess.Api.Domain;

namespace Princess.Api.Tests;

public class InstalmentRulesTests
{
    private static readonly DateOnly Final = new(2027, 1, 15);

    [Fact]
    public void EveryPlanAddsUpToTheBalanceAndEndsOnTheFinalDate()
    {
        foreach (var plan in InstalmentRules.Plans(123_457, new DateOnly(2026, 6, 1), Final))
        {
            Assert.Equal(123_457, plan.Payments.Sum(p => p.Cents));
            Assert.Equal(plan.Count, plan.Payments.Count);
            Assert.Equal("2027-01-15", plan.Payments[^1].Date);
        }
    }

    [Fact]
    public void LeftOverCentsGoOnTheEarliestPayments()
    {
        var plan = InstalmentRules.Plans(100_001, new DateOnly(2026, 6, 1), Final).First(p => p.Count == 3);
        Assert.Equal([33_334, 33_334, 33_333], plan.Payments.Select(p => p.Cents));
    }

    [Fact]
    public void OnlyPlansWhoseFirstPaymentIsAfterTodayAreOffered()
    {
        var plans = InstalmentRules.Plans(100_000, new DateOnly(2026, 11, 10), Final);
        Assert.Equal([2, 3], plans.Select(p => p.Count));
        Assert.Empty(InstalmentRules.Plans(100_000, new DateOnly(2026, 12, 20), Final));
        Assert.Empty(InstalmentRules.Plans(0, new DateOnly(2026, 6, 1), Final));
    }

    [Fact]
    public void TheNextPaymentIsTheFirstNotYetCovered()
    {
        var choice = new InstalmentChoice(3, 90_000);
        Assert.Equal(new InstalmentPayment("2026-11-15", 30_000), InstalmentRules.Next(choice, Final, 90_000));
        Assert.Equal(new InstalmentPayment("2026-11-15", 10_000), InstalmentRules.Next(choice, Final, 70_000));
        Assert.Equal(new InstalmentPayment("2026-12-15", 30_000), InstalmentRules.Next(choice, Final, 60_000));
        Assert.Equal(new InstalmentPayment("2027-01-15", 30_000), InstalmentRules.Next(choice, Final, 30_000));
        Assert.Null(InstalmentRules.Next(choice, Final, 0));
    }

    [Fact]
    public void AReminderShowsOnlyWithinAWeekOfThePaymentDate()
    {
        static List<string> Ids(string today) => NotificationRules.BuildNotices(new("paid", "2027-01-15", 0, 0, "done", "2027-01-01", "2026-11-15", 30_000, today)).Select(n => n.Id).ToList();
        Assert.Equal(["instalmentDue"], Ids("2026-11-08"));
        Assert.Equal(["instalmentDue"], Ids("2026-11-20"));
        Assert.Empty(Ids("2026-11-07"));
    }
}
