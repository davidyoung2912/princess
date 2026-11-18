using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class CheckinPrefillTests
{
    private static CheckinRules.PrefillGuest Guest(string first, string last, bool confirmed = false, bool emergency = false, string eName = "Pat Doe", string ePhone = "+1 555 010 2000", string eRel = "Sister") =>
        new(Guid.NewGuid(), $"{first} {last}", first, 40, confirmed, emergency, eName, ePhone, eRel);

    [Fact]
    public void ConfirmsDetailsAndSavesTheEmergencyContactOnFileForEveryGuestWhoLacksThem()
    {
        var items = CheckinRules.PrefillPlan([Guest("Ana", "Lee"), Guest("Bo", "Lee")]);
        Assert.Equal(["confirm", "confirm", "emergency", "emergency"], items.Select(i => i.Step));
        Assert.All(items.Where(i => i.Step == "emergency"), i => Assert.Equal("Pat Doe", i.Name));
    }

    [Fact]
    public void LeavesAlreadyAnsweredStepsAlone()
    {
        var items = CheckinRules.PrefillPlan([Guest("Ana", "Lee", confirmed: true, emergency: true)]);
        Assert.Empty(items);
    }

    [Fact]
    public void NeverFillsAnEmergencyContactThatFailsTheSameChecksAsTyping()
    {
        Assert.DoesNotContain(CheckinRules.PrefillPlan([Guest("Ana", "Lee", eName: "")]), i => i.Step == "emergency");
        Assert.DoesNotContain(CheckinRules.PrefillPlan([Guest("Ana", "Lee", ePhone: "x")]), i => i.Step == "emergency");
        Assert.DoesNotContain(CheckinRules.PrefillPlan([Guest("Ana", "Lee", eRel: " ")]), i => i.Step == "emergency");
        Assert.DoesNotContain(CheckinRules.PrefillPlan([Guest("Ana", "Lee", eName: "Bo Lee"), Guest("Bo", "Lee")]).Where(i => i.Guest != default), i => i.Step == "emergency" && i.Name == "Bo Lee");
    }

    [Fact]
    public void NeverTouchesThePassportPhotoContractHealthOrCard()
    {
        var steps = CheckinRules.PrefillPlan([Guest("Ana", "Lee")]).Select(i => i.Step).Distinct();
        Assert.All(steps, s => Assert.Contains(s, new[] { "confirm", "emergency" }));
    }
}
