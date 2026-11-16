using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public sealed class DietaryRulesTests
{
    private static readonly DateTime Sent = new(2027, 3, 1, 12, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData("diet", "vegan", 0, "received")]
    [InlineData("diet", "vegan", 1, "received")]
    [InlineData("diet", "vegan", 2, "review")]
    [InlineData("diet", "vegan", 9, "review")]
    [InlineData("diet", "vegan", 10, "confirmed")]
    [InlineData("allergy", "peanuts", 10, "contact")]
    [InlineData("other", "low salt", 30, "contact")]
    [InlineData("diet", "Kosher meals", 30, "unable")]
    public void AnswersByHowLongAgoTheRequestWasSent(string kind, string note, int minutes, string expected) =>
        Assert.Equal(expected, DietaryRules.StatusAt(kind, note, Sent, Sent.AddMinutes(minutes)));

    [Fact]
    public void NeverApprovesBeforeTheGalleyHasHadTime()
    {
        foreach (var kind in DietaryRules.Kinds)
            for (var m = 0; m < 10; m++)
                Assert.DoesNotContain(DietaryRules.StatusAt(kind, "x", Sent, Sent.AddMinutes(m)), new[] { DietaryRules.Confirmed, DietaryRules.Unable });
    }

    [Fact]
    public void ChecksKindAndNote()
    {
        Assert.True(DietaryRules.KindOk("allergy"));
        Assert.False(DietaryRules.KindOk("nope"));
        Assert.False(DietaryRules.KindOk(null));
        Assert.False(DietaryRules.NoteOk("   "));
        Assert.Equal(DietaryRules.MaxNote, DietaryRules.CleanNote(new string('a', 500)).Length);
    }
}
