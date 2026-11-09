namespace Princess.Api.Domain;

public sealed record InstalmentPayment(string Date, long Cents);

public sealed record InstalmentPlan(int Count, List<InstalmentPayment> Payments);

/// <summary>
/// Pay in instalments (H19): a plan that splits what is left into equal monthly payments, the last on the final payment date.
/// This is a schedule to follow, not a promise to charge: each payment is made with the normal pay-balance step, so the card provider stays behind its own seam.
/// </summary>
public static class InstalmentRules
{
    public const int MinCount = 2;
    public const int MaxCount = 6;

    /// <summary>
    /// Every plan that fits: <c>count</c> payments one month apart ending on <paramref name="finalDue"/>, the first on a day after <paramref name="today"/>.
    /// Cents that do not divide evenly go on the earliest payments, one cent each, so the plan always adds up to the balance exactly.
    /// </summary>
    public static List<InstalmentPlan> Plans(long balance, DateOnly today, DateOnly finalDue)
    {
        var plans = new List<InstalmentPlan>();
        if (balance < MinCount) return plans;
        for (var count = MinCount; count <= MaxCount; count++)
        {
            var dates = Enumerable.Range(0, count).Select(i => finalDue.AddMonths(-(count - 1 - i))).ToList();
            if (dates[0] <= today) break;
            var each = balance / count;
            var extra = (int)(balance % count);
            var payments = dates.Select((d, i) => new InstalmentPayment(d.ToString("yyyy-MM-dd"), each + (i < extra ? 1 : 0))).ToList();
            plans.Add(new InstalmentPlan(count, payments));
        }
        return plans;
    }
}
