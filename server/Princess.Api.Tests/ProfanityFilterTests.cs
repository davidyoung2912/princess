using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The word filter in front of Stanley (docs/stanley-plan.md, S1): what it blocks, the disguises it sees through, and the ordinary cruise words it must leave alone.</summary>
public class ProfanityFilterTests
{
    [Theory]
    [InlineData("what the fuck is this")]
    [InlineData("This is BULLSHIT")]
    [InlineData("you absolute motherfucker")]
    [InlineData("fuckingly slow")]
    [InlineData("What a bitch of a delay")]
    [InlineData("you asshole")]
    [InlineData("kiss my ass")]
    [InlineData("shut up")]
    [InlineData("go kill yourself")]
    [InlineData("you are an idiot")]
    [InlineData("damn this app")]
    [InlineData("Is there a pool? wtf")]
    [InlineData("send nudes porn")]
    [InlineData("racist slur: nigger")]
    public void EnglishSwearingIsBlocked(string message) => Assert.True(ProfanityFilter.IsBlocked(message), message);

    [Theory]
    [InlineData("hijo de puta")]
    [InlineData("qué mierda de barco")]
    [InlineData("eres un pendejo")]
    [InlineData("cabrón")]
    [InlineData("CABRON")]
    [InlineData("coño")]
    [InlineData("vete a la mierda")]
    [InlineData("no seas gilipollas")]
    [InlineData("jódete")]
    [InlineData("hdp")]
    public void SpanishSwearingIsBlocked(string message) => Assert.True(ProfanityFilter.IsBlocked(message), message);

    [Theory]
    [InlineData("f u c k")]
    [InlineData("f.u.c.k you")]
    [InlineData("f-u-c-k")]
    [InlineData("sh1t")]
    [InlineData("$h!t")]
    [InlineData("a$$h0le")]
    [InlineData("n1gger")]
    [InlineData("f4g")]
    [InlineData("A$$")]
    [InlineData("b!tch")]
    [InlineData("fuuuuck")]
    [InlineData("fuuck")]
    [InlineData("shiiit")]
    [InlineData("f*ck")]
    [InlineData("sh*t")]
    [InlineData("b**ch")]
    [InlineData("FuCk")]
    [InlineData("fück")]
    public void DisguisedSwearingIsBlocked(string message) => Assert.True(ProfanityFilter.IsBlocked(message), message);

    [Theory]
    [InlineData("Is there a cocktail class, and can someone assist me?")]
    [InlineData("Scunthorpe")]
    [InlineData("Can I eat shiitake mushrooms on board?")]
    [InlineData("How do I get to Hell in Grand Cayman?")]
    [InlineData("Can I book the Essex or Sussex cruise?")]
    [InlineData("Is there a bass fishing trip?")]
    [InlineData("Can I bring my cockatoo to the peacock deck?")]
    [InlineData("Is the Hancock tour worth it?")]
    [InlineData("What is the weather in Amsterdam, Mississippi and Cumberland?")]
    [InlineData("Where is the cockpit tour?")]
    [InlineData("Can I play craps at the casino?")]
    [InlineData("Is there a masquerade ball with balls and a dance class?")]
    [InlineData("I am in cabin 455 on deck 14 with 3 ports and 7 nights")]
    [InlineData("Is the 5-star dinner at 7:30 p.m.?")]
    [InlineData("A$5 coffee and a US$55 tip")]
    [InlineData("Meet at gate A55 or table B455")]
    [InlineData("Pass the grass, Dickens")]
    [InlineData("¿Cuánto cuesta el puerto de Cozumel?")]
    [InlineData("El vuelo está retrasado y no encuentro mi computadora")]
    [InlineData("¿Hay un cono de helado en el año nuevo?")]
    [InlineData("Where is the Fukuoka port?")]
    [InlineData("Niger and Nigeria are not ports")]
    public void OrdinaryCruiseQuestionsAreNotBlocked(string message) => Assert.False(ProfanityFilter.IsBlocked(message), message);

    [Fact]
    public void EmptyAndMissingTextIsNotBlocked()
    {
        Assert.False(ProfanityFilter.IsBlocked(null));
        Assert.False(ProfanityFilter.IsBlocked(""));
        Assert.False(ProfanityFilter.IsBlocked("   "));
    }

    [Fact]
    public void ANewlineOrTabSeparatesWordsLikeASpace()
    {
        Assert.True(ProfanityFilter.IsBlocked("hello\nfuck\tyou"));
        Assert.False(ProfanityFilter.IsBlocked("hello\nclass\tassist"));
    }

    [Fact]
    public void OnlyTheFirstTwoThousandCharactersAreExamined()
    {
        var clean = new string('a', ProfanityFilter.MaxLength);
        Assert.False(ProfanityFilter.IsBlocked(clean + " fuck"));
        Assert.True(ProfanityFilter.IsBlocked("fuck " + clean));
    }

    [Fact]
    public void ReportsWhichTermBlockedTheMessage()
    {
        Assert.Equal("fuck", ProfanityFilter.Find("F U C K"));
        Assert.Equal("shut up", ProfanityFilter.Find("please shut up now"));
        Assert.Null(ProfanityFilter.Find("Which deck is the buffet on?"));
    }

    [Fact]
    public void LongMessagesAreExaminedQuickly()
    {
        var text = string.Join(' ', Enumerable.Repeat("f*** s**t a-b-c-d e.f.g", 80));
        var watch = System.Diagnostics.Stopwatch.StartNew();
        ProfanityFilter.Find(text);
        Assert.True(watch.ElapsedMilliseconds < 1000);
    }
}
