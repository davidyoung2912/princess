using Princess.Api.Services;
using Xunit;

namespace Princess.Api.Tests;

/// <summary>
/// The kill switches (docs/stanley-gap-analysis-and-plan.md, phase 14; docs/runbook.md, Stanley incident playbook). Each of the eight routes can be turned off alone, is then named in the status,
/// and turning one off never turns another off. The behaviour of each route when off is in its own test file; this is the list the playbook relies on.
/// </summary>
public class StanleySwitchTests
{
    private static readonly string[] Names = ["library", "resolver", "model", "tools", "actions", "handoff", "changes", "money"];

    private static void TurnOff(StanleySwitches s, string name)
    {
        switch (name)
        {
            case "library": s.Library = false; break;
            case "resolver": s.Resolver = false; break;
            case "model": s.Model = false; break;
            case "tools": s.Tools = false; break;
            case "actions": s.Actions = false; break;
            case "handoff": s.Handoff = false; break;
            case "changes": s.Changes = false; break;
            case "money": s.Money = false; break;
            default: throw new ArgumentOutOfRangeException(nameof(name));
        }
    }

    [Fact]
    public void EverythingIsOnByDefault() => Assert.Empty(new StanleySwitches().Off());

    [Theory]
    [InlineData("library")]
    [InlineData("resolver")]
    [InlineData("model")]
    [InlineData("tools")]
    [InlineData("actions")]
    [InlineData("handoff")]
    [InlineData("changes")]
    [InlineData("money")]
    public void EachSwitchTurnsOffAloneAndIsNamedInTheStatus(string name)
    {
        var s = new StanleySwitches();
        TurnOff(s, name);
        Assert.Equal([name], s.Off());
    }

    [Fact]
    public void AllEightAreNamedWhenAllAreOff()
    {
        var s = new StanleySwitches();
        foreach (var n in Names) TurnOff(s, n);
        Assert.Equal(Names.OrderBy(x => x), s.Off().OrderBy(x => x));
    }
}
