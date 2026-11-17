using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public sealed class ChatHostRulesTests
{
    private static readonly DateTime T = new(2026, 11, 16, 12, 0, 0, DateTimeKind.Utc);
    private static IntroCandidate C(long id, string interest, int mins = 0, bool adult = true, bool sup = false, int today = 0) => new(id, interest, T.AddMinutes(mins), adult, sup, today);
    private static bool Never(long a, long b) => false;

    [Fact]
    public void ABothOptInIntroductionPairsTwoGuestsWithTheSameInterest()
    {
        var pairs = ChatHostRules.Match([C(1, "trivia"), C(2, "trivia", 1)], Never, Never);
        Assert.Single(pairs);
        Assert.Equal(("trivia", 1L, 2L), (pairs[0].Interest, pairs[0].A, pairs[0].B));
    }

    [Fact]
    public void NobodyIsIntroducedWithoutASecondOptIn() => Assert.Empty(ChatHostRules.Match([C(1, "trivia"), C(2, "wine")], Never, Never));

    [Fact]
    public void ASupervisedChildAndANonAdultAreNeverMatched() =>
        Assert.Empty(ChatHostRules.Match([C(1, "games"), C(2, "games", sup: true), C(3, "games", adult: false)], Never, Never));

    [Fact]
    public void ABlockOrAnEarlierIntroductionStopsAMatch()
    {
        Assert.Empty(ChatHostRules.Match([C(1, "music"), C(2, "music")], (a, b) => a == 2 && b == 1, Never));
        Assert.Empty(ChatHostRules.Match([C(1, "music"), C(2, "music")], Never, (a, b) => true));
    }

    [Fact]
    public void TheDailyCapStopsAFurtherIntroductionAndAGuestIsInOnePairPerRun()
    {
        Assert.Empty(ChatHostRules.Match([C(1, "ports", today: ChatHostRules.IntroductionsPerDay), C(2, "ports")], Never, Never));
        Assert.Single(ChatHostRules.Match([C(1, "ports"), C(2, "ports", 1), C(3, "ports", 2)], Never, Never));
    }

    [Fact]
    public void OnlyAListedInterestIsAccepted()
    {
        Assert.Equal("wine", ChatHostRules.CleanInterest(" Wine "));
        Assert.Null(ChatHostRules.CleanInterest("my cabin is 8042"));
        Assert.Equal(ChatHostRules.Unknown, ChatHostRules.OptInRefusal(false, true, "politics", 0));
        Assert.Equal(ChatHostRules.Supervised, ChatHostRules.OptInRefusal(true, true, "wine", 0));
        Assert.Equal(ChatHostRules.NotAdult, ChatHostRules.OptInRefusal(false, false, "wine", 0));
        Assert.Equal(ChatHostRules.Limit, ChatHostRules.OptInRefusal(false, true, "wine", 2));
        Assert.Null(ChatHostRules.OptInRefusal(false, true, "wine", 0));
    }

    [Fact]
    public void AnOptInLapsesAfterADayAndCanBeWithdrawn()
    {
        var end = ChatHostRules.OptInEnds(T);
        Assert.True(ChatHostRules.OptInLive(end, null, T.AddHours(23)));
        Assert.False(ChatHostRules.OptInLive(end, null, T.AddHours(24)));
        Assert.False(ChatHostRules.OptInLive(end, T, T.AddHours(1)));
    }

    [Fact]
    public void AnIntroductionNamesTwoShortNamesAndOneInterestOnly() =>
        Assert.Equal("Alex T. and Sam R. both said they would like to meet someone who enjoys trivia.", ChatHostRules.IntroLine("Alex T.", "Sam R.", "trivia"));

    [Fact]
    public void AMeetUpNeverCountsOrShowsADecline()
    {
        var counts = ChatHostRules.CountMeetUp(["in", "no", "maybe", "no", "in"]);
        Assert.Equal((2, 1), (counts.In, counts.Maybe));
        Assert.Equal(2, typeof(ChatHostRules.MeetUpCounts).GetProperties().Length);
    }

    [Fact]
    public void AMeetUpTextHasNoContactDetailAndANewGuestMayStartThreeADay()
    {
        Assert.Null(ChatHostRules.CleanMeetUpText("Call me on 555 123 4567", 80));
        Assert.Null(ChatHostRules.CleanMeetUpText("see www.example.com", 80));
        Assert.Equal("Trivia at the Piazza", ChatHostRules.CleanMeetUpText("  Trivia   at the Piazza ", 80));
        Assert.Equal(ChatHostRules.Limit, ChatHostRules.MeetUpRefusal(false, true, false, 3));
        Assert.Equal(ChatHostRules.Supervised, ChatHostRules.MeetUpRefusal(true, true, false, 0));
        Assert.Equal(ChatHostRules.Closed, ChatHostRules.MeetUpRefusal(false, true, true, 0));
        Assert.Null(ChatHostRules.MeetUpRefusal(false, true, false, 2));
    }

    [Fact]
    public void AMeetUpAnswerIsOneOfThree()
    {
        Assert.Equal("in", ChatHostRules.ParseMeetAnswer("in"));
        Assert.Null(ChatHostRules.ParseMeetAnswer("going"));
    }

    [Fact]
    public void TheTableFriendsOfferNeedsAnotherAdultAndNeverGoesToAChild()
    {
        Assert.True(ChatHostRules.OfferTableFriends(true, false, 1));
        Assert.False(ChatHostRules.OfferTableFriends(true, false, 0));
        Assert.False(ChatHostRules.OfferTableFriends(true, true, 2));
        Assert.False(ChatHostRules.OfferTableFriends(false, false, 2));
    }

    [Fact]
    public void ARoomAnswerComesOnlyFromTheLibrary()
    {
        Assert.Equal("showtimes", ChatHostRules.FindAnswer("What time is the show tonight?")?.Id);
        Assert.Null(ChatHostRules.FindAnswer("Who is the captain's favourite person?"));
        Assert.Null(ChatHostRules.FindAnswer(null));
        Assert.All(ChatHostRules.Library, e => Assert.DoesNotMatch(@"\d{1,2}:\d{2}|\$", e.Answer)); // no live time or price
    }

    [Fact]
    public void StanleyNeverTakesAStaffAction()
    {
        foreach (var a in new[] { "remove", "mute", "kick", "close", "pin", "slow", "ban", "unmute", "rules" }) Assert.False(ChatHostRules.StanleyMay(a));
        foreach (var a in new[] { "welcome", "answer", "meetup", "introduce", "flag" }) Assert.True(ChatHostRules.StanleyMay(a));
    }

    [Fact]
    public void AFlagNeedsAListedReasonAndFiveADayAtMost()
    {
        Assert.Null(ChatHostRules.FlagRefusal("spam", 4));
        Assert.Equal(ChatHostRules.Limit, ChatHostRules.FlagRefusal("rude", 5));
        Assert.Equal(ChatHostRules.Unknown, ChatHostRules.FlagRefusal("because", 0));
    }

    [Fact]
    public void StanleyIsSilentWhereTheMemberMutedHimOrAChildIsPresent()
    {
        Assert.True(ChatHostRules.MaySpeak(false, false));
        Assert.False(ChatHostRules.MaySpeak(true, false));
        Assert.False(ChatHostRules.MaySpeak(false, true));
        Assert.False(ChatHostRules.ShouldWelcome(true, true));
        Assert.False(ChatHostRules.ShouldWelcome(false, false));
        Assert.True(ChatHostRules.ShouldWelcome(true, false));
    }
}
