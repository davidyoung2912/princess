using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Tests;

/// <summary>
/// The capability catalogue (docs/stanley-actions-and-proactive-plan.md, phase P0): every example is a sentence Stanley really handles, switched-off abilities are left out, booking-only abilities wait for a booking,
/// a supervised account is not shown what prepares, and the guest-facing words never use "AI" as a word.
/// </summary>
public class StanleyCapabilityTests
{
    private static StanleyCapabilitiesDto Get(StanleySwitches? s = null, bool booking = true, bool child = false) => StanleyCapabilityCatalogue.For(s ?? new StanleySwitches(), booking, child);

    [Fact]
    public void EveryExampleReachesStanleyAndIsNotBlockedOrHandedOff()
    {
        foreach (var c in StanleyCapabilityCatalogue.All)
        {
            Assert.False(ProfanityFilter.IsBlocked(c.Example), c.Id);
            Assert.Null(ConciergeRules.Screen(c.Example));
            Assert.InRange(c.Example.Length, 5, 500);
        }
    }

    [Fact]
    public void EveryAbilityHasAKnownGroupAndStages()
    {
        var groups = StanleyCapabilityCatalogue.Groups.Select(g => g.Id).ToHashSet();
        Assert.Equal(StanleyCapabilityCatalogue.All.Count, StanleyCapabilityCatalogue.All.Select(c => c.Id).Distinct().Count());
        foreach (var c in StanleyCapabilityCatalogue.All)
        {
            Assert.Contains(c.Group, groups);
            Assert.All(c.Stages, st => Assert.Contains(st, StanleyRouter.Stages));
            Assert.InRange(c.Rung, 0, 2);
        }
        Assert.All(groups, g => Assert.Contains(StanleyCapabilityCatalogue.All, c => c.Group == g));
    }

    [Fact]
    public void ASwitchedOffAbilityIsLeftOut()
    {
        var off = new StanleySwitches { Actions = false };
        Assert.DoesNotContain(Get(off).Items, i => i.Id == "do-dinner");
        Assert.Contains(Get().Items, i => i.Id == "do-dinner");
        Assert.DoesNotContain(Get(new StanleySwitches { Money = false }).Items, i => i.Id == "ask-bill");
    }

    [Fact]
    public void ABookingOnlyAbilityWaitsForABooking()
    {
        Assert.Equal("needsBooking", Get(booking: false).Items.Single(i => i.Id == "ask-trip").State);
        Assert.Equal("available", Get(booking: true).Items.Single(i => i.Id == "ask-trip").State);
        Assert.Equal("available", Get(booking: false).Items.Single(i => i.Id == "ask-ship").State);
    }

    [Fact]
    public void ASupervisedAccountIsNotShownWhatPrepares()
    {
        var items = Get(child: true).Items;
        Assert.DoesNotContain(items, i => i.Rung >= 2);
        Assert.NotEmpty(items);
    }

    [Fact]
    public void TheWordsNeverSayAI()
    {
        var words = StanleyCapabilityCatalogue.All.SelectMany(c => new[] { c.Title, c.Summary, c.Example })
            .Concat(StanleyCapabilityCatalogue.Groups.SelectMany(g => new[] { g.Title, g.Intro }));
        Assert.All(words, w => Assert.DoesNotMatch(@"\bAI\b", w));
    }
}
