using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Stanley's trip so far (phase P9a): honest counts from the ledger and suggestions that are only ever words.</summary>
public class StanleyTripSoFarTests
{
    private static LedgerTally T(string kind, bool undone = false) => new(kind, undone);

    [Fact]
    public void CountsWhatWasDoneAndUndone()
    {
        var r = StanleyTripSoFarRules.Build([T("remind_me"), T("remind_me"), T("order_item", true)], "now");
        Assert.Equal((2, 3, 1), (r.Done, r.Confirmed, r.Undone));
    }

    [Fact]
    public void ThreeYesesWithNoUndoOffersMoreOnce()
    {
        var s = Assert.Single(StanleyTripSoFarRules.Suggestions([T("reserve_dinner"), T("reserve_dinner"), T("reserve_dinner")]));
        Assert.Equal("more", s.Direction);
        Assert.Contains("3 times", s.Text);
        Assert.Contains("Nothing changes unless you choose it", s.Text);
    }

    [Fact]
    public void TwoYesesOrAnyUndoDoesNotOfferMore()
    {
        Assert.Empty(StanleyTripSoFarRules.Suggestions([T("reserve_dinner"), T("reserve_dinner")]));
        Assert.Empty(StanleyTripSoFarRules.Suggestions([T("reserve_dinner"), T("reserve_dinner"), T("reserve_dinner"), T("reserve_dinner", true)]));
    }

    [Fact]
    public void TwoUndosOffersToAskFirst()
    {
        var s = Assert.Single(StanleyTripSoFarRules.Suggestions([T("add_excursion", true), T("add_excursion", true), T("add_excursion")]));
        Assert.Equal("ask-first", s.Direction);
    }

    [Fact]
    public void SuggestionsNeverRaiseAuthorityAndOnlyPointAtAScreen()
    {
        var all = StanleyTripSoFarRules.Suggestions(StanleyActionKinds.All.SelectMany(k => new[] { T(k), T(k), T(k) }).ToList());
        Assert.Equal(StanleyActionKinds.All.Length, all.Count);
        Assert.All(all, s => Assert.StartsWith("/", s.Route));
    }

    [Fact]
    public void SaysWhatItDoesNotMeasure() =>
        Assert.Contains(StanleyTripSoFarRules.NotMeasured(), x => x.StartsWith("Time saved"));
}
