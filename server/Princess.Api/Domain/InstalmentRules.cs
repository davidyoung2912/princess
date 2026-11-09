namespace Princess.Api.Domain;

public sealed record InstalmentPayment(string Date, long Cents);

public sealed record InstalmentPlan(int Count, List<InstalmentPayment> Payments);

/// <summary>The plan a guest chose: how many payments, and what was left to pay when they chose.</summary>
/// <summary><see cref="AutoCard"/> (the public id of a saved card) and <see cref="AutoUserId"/> (whose card it is) are set when the guest asked for each payment to be taken automatically.</summary>
public sealed record InstalmentChoice(int Count, long BalanceCents, Guid? AutoCard = null, long? AutoUserId = null);

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
            plans.Add(Schedule(balance, finalDue, count));
        }
        return plans;
    }

    /// <summary><paramref name="count"/> payments one month apart ending on <paramref name="finalDue"/>, adding up to <paramref name="balance"/> exactly.</summary>
    public static InstalmentPlan Schedule(long balance, DateOnly finalDue, int count)
    {
        var each = balance / count;
        var extra = (int)(balance % count);
        var payments = Enumerable.Range(0, count)
            .Select(i => new InstalmentPayment(finalDue.AddMonths(-(count - 1 - i)).ToString("yyyy-MM-dd"), each + (i < extra ? 1 : 0))).ToList();
        return new InstalmentPlan(count, payments);
    }

    /// <summary>
    /// The next payment on a chosen plan, given what is still owed: money paid since the plan was chosen counts against the earliest payments first.
    /// Null when the plan is paid off.
    /// </summary>
    public static InstalmentPayment? Next(InstalmentChoice choice, DateOnly finalDue, long balanceNow)
    {
        var paid = Math.Max(0, choice.BalanceCents - balanceNow);
        long total = 0;
        foreach (var p in Schedule(choice.BalanceCents, finalDue, choice.Count).Payments)
        {
            total += p.Cents;
            if (total > paid) return new InstalmentPayment(p.Date, total - paid);
        }
        return null;
    }

    /// <summary>A reminder shows from this many days before a payment is due, and stays until it is paid.</summary>
    public const int RemindDays = 7;
}
