using Princess.Api.Domain;
using Princess.Api.Services;
using Xunit;

namespace Princess.Api.Tests;

public sealed class ChatRolloutRulesTests
{
    private static RolloutSample Sample(int cards = 400, int guests = 100, int dismissed = 100, int dont = 10, int muted = 2, int sent = 0, int remMuted = 0, int lines = 0, int reports = 0, int catchUps = 0, int wrong = 0, double? push = null, int acted = 100)
        => new("m", cards, guests, dismissed, dont, muted, sent, remMuted, lines, reports, catchUps, wrong, push, acted);

    [Fact]
    public void TooFewToJudge() => Assert.Equal(ChatRolloutRules.NotEnough, ChatRolloutRules.Judge(Sample(cards: 199, guests: 49, dismissed: 199)).Verdict);

    [Theory]
    [InlineData(200, 0, true)]
    [InlineData(0, 50, true)]
    [InlineData(199, 49, false)]
    public void MinimumSample(int cards, int guests, bool enough) => Assert.Equal(enough, ChatRolloutRules.EnoughSample(cards, guests));

    [Fact]
    public void AHealthyMomentIsOk() => Assert.Equal(ChatRolloutRules.Ok, ChatRolloutRules.Judge(Sample()).Verdict);

    [Theory]
    [InlineData(240, ChatRolloutRules.Ok)]      // exactly 60% is not above 60%
    [InlineData(241, ChatRolloutRules.Rewrite)]
    [InlineData(320, ChatRolloutRules.Rewrite)] // exactly 80%
    [InlineData(321, ChatRolloutRules.Pause)]
    public void DismissLines(int dismissed, string expected) => Assert.Equal(expected, ChatRolloutRules.Judge(Sample(dismissed: dismissed)).Signals.Single(s => s.Name == "dismiss").Verdict);

    [Theory]
    [InlineData(40, ChatRolloutRules.Ok)]
    [InlineData(41, ChatRolloutRules.Rewrite)]
    [InlineData(81, ChatRolloutRules.Pause)]
    public void DontShowAgainLines(int n, string expected) => Assert.Equal(expected, ChatRolloutRules.Judge(Sample(dont: n)).Signals.Single(s => s.Name == "dontShowAgain").Verdict);

    [Theory]
    [InlineData(5, ChatRolloutRules.Ok)]
    [InlineData(6, ChatRolloutRules.Rewrite)]
    [InlineData(11, ChatRolloutRules.Pause)]
    public void MuteLinesAreOfGuestsExposed(int muted, string expected) => Assert.Equal(expected, ChatRolloutRules.Judge(Sample(muted: muted)).Signals.Single(s => s.Name == "mute").Verdict);

    [Theory]
    [InlineData(100, 10, ChatRolloutRules.Ok)]
    [InlineData(100, 11, ChatRolloutRules.Rewrite)]
    [InlineData(100, 21, ChatRolloutRules.Pause)]
    public void ReminderMuteLines(int sent, int muted, string expected) => Assert.Equal(expected, ChatRolloutRules.Judge(Sample(sent: sent, remMuted: muted)).Signals.Single(s => s.Name == "remindersMuted").Verdict);

    [Theory]
    [InlineData(1000, 1, ChatRolloutRules.Ok)]
    [InlineData(1000, 2, ChatRolloutRules.Rewrite)]
    [InlineData(1000, 4, ChatRolloutRules.Pause)]
    public void ReportsPerThousandLines(int lines, int reports, string expected) => Assert.Equal(expected, ChatRolloutRules.Judge(Sample(lines: lines, reports: reports)).Signals.Single(s => s.Name == "reportsPer1000").Verdict);

    [Theory]
    [InlineData(100, 5, ChatRolloutRules.Ok)]
    [InlineData(100, 6, ChatRolloutRules.Rewrite)]
    [InlineData(100, 11, ChatRolloutRules.Pause)]
    public void CatchUpWrongLines(int uses, int wrong, string expected) => Assert.Equal(expected, ChatRolloutRules.Judge(Sample(catchUps: uses, wrong: wrong)).Signals.Single(s => s.Name == "catchUpWrong").Verdict);

    [Theory]
    [InlineData(1.0, ChatRolloutRules.Ok)]
    [InlineData(1.5, ChatRolloutRules.Rewrite)]
    [InlineData(2.5, ChatRolloutRules.Pause)]
    public void PushOptOutLines(double points, string expected) => Assert.Equal(expected, ChatRolloutRules.Judge(Sample(push: points)).Signals.Single(s => s.Name == "pushOptOutPoints").Verdict);

    [Theory]
    [InlineData(32, ChatRolloutRules.Ok)]       // 8% is not below 8%
    [InlineData(31, ChatRolloutRules.Rewrite)]
    [InlineData(11, ChatRolloutRules.Pause)]    // below 3%
    [InlineData(12, ChatRolloutRules.Rewrite)]  // exactly 3%
    public void ActionRateIsALowerBound(int acted, string expected) => Assert.Equal(expected, ChatRolloutRules.Judge(Sample(acted: acted, dismissed: 0)).Signals.Single(s => s.Name == "actionRate").Verdict);

    [Fact]
    public void TheWorstSignalDecides()
    {
        var v = ChatRolloutRules.Judge(Sample(dismissed: 250, dont: 90));
        Assert.Equal(ChatRolloutRules.Pause, v.Verdict);
    }

    [Fact]
    public void ASignalWithNothingToDivideByIsLeftOut()
    {
        var names = ChatRolloutRules.Judge(Sample()).Signals.Select(s => s.Name).ToList();
        Assert.DoesNotContain("remindersMuted", names);
        Assert.DoesNotContain("reportsPer1000", names);
        Assert.DoesNotContain("catchUpWrong", names);
        Assert.DoesNotContain("pushOptOutPoints", names);
    }

    [Fact]
    public void TheWindowIsAtLeastFourteenDays()
    {
        Assert.Equal(14, ChatRolloutRules.WindowDays(7));
        Assert.Equal(21, ChatRolloutRules.WindowDays(21));
    }

    [Theory]
    [InlineData(ChatRolloutRules.PrivateFact)]
    [InlineData(ChatRolloutRules.ChildLine)]
    [InlineData(ChatRolloutRules.Unconfirmed)]
    public void HardStops(string kind) => Assert.True(ChatRolloutRules.IsHardStop(kind));

    [Fact]
    public void NothingElseIsAHardStop() { Assert.False(ChatRolloutRules.IsHardStop("dismiss")); Assert.False(ChatRolloutRules.IsHardStop(null)); }

    [Fact]
    public void AHardStopBlocksEveryStage()
    {
        Assert.False(ChatRolloutRules.MayWiden(ChatRolloutRules.StageStaff, true, []));
        Assert.False(ChatRolloutRules.MayWiden(ChatRolloutRules.StageCohort, true, [ChatRolloutRules.Judge(Sample())]));
    }

    [Fact]
    public void StaffNeedNoThresholds() => Assert.True(ChatRolloutRules.MayWiden(ChatRolloutRules.StageStaff, false, []));

    [Fact]
    public void EveryoneNeedsNoPauseAndAtMostOneRewrite()
    {
        var ok = ChatRolloutRules.Judge(Sample());
        var oneRewrite = ChatRolloutRules.Judge(Sample(dismissed: 250));
        var twoRewrites = ChatRolloutRules.Judge(Sample(dismissed: 250, dont: 41));
        var paused = ChatRolloutRules.Judge(Sample(dismissed: 330));
        Assert.True(ChatRolloutRules.MayWiden(ChatRolloutRules.StageCohort, false, [ok]));
        Assert.True(ChatRolloutRules.MayWiden(ChatRolloutRules.StageCohort, false, [oneRewrite]));
        Assert.False(ChatRolloutRules.MayWiden(ChatRolloutRules.StageCohort, false, [twoRewrites]));
        Assert.False(ChatRolloutRules.MayWiden(ChatRolloutRules.StageCohort, false, [ok, paused]));
    }

    [Fact]
    public void AnUnmeasuredCohortDoesNotPass()
    {
        Assert.False(ChatRolloutRules.MayWiden(ChatRolloutRules.StageCohort, false, []));
        Assert.False(ChatRolloutRules.MayWiden(ChatRolloutRules.StageCohort, false, [ChatRolloutRules.Judge(Sample(cards: 10, guests: 10))]));
    }

    [Fact]
    public void CohortIsAboutFivePercent()
    {
        Assert.Equal(5, Enumerable.Range(0, 100).Count(b => ChatRolloutRules.InCohort(b, false, ChatRolloutRules.StageCohort)));
        Assert.Equal(0, Enumerable.Range(0, 100).Count(b => ChatRolloutRules.InCohort(b, false, ChatRolloutRules.StageStaff)));
        Assert.True(ChatRolloutRules.InCohort(99, true, ChatRolloutRules.StageStaff));
        Assert.Equal(100, Enumerable.Range(0, 100).Count(b => ChatRolloutRules.InCohort(b, false, ChatRolloutRules.StageEveryone)));
    }

    [Fact]
    public void EachChatRoleHasItsOwnSwitchThatTurnsOffAlone()
    {
        string[] roles = ["chatHerald", "chatCatchUp", "chatPlan", "chatWords", "chatDraft", "chatCoordinator", "chatRelay"];
        Action<StanleySwitches>[] off = [s => s.ChatHerald = false, s => s.ChatCatchUp = false, s => s.ChatPlan = false, s => s.ChatWords = false, s => s.ChatDraft = false, s => s.ChatCoordinator = false, s => s.ChatRelay = false];
        for (var i = 0; i < roles.Length; i++)
        {
            var s = new StanleySwitches();
            off[i](s);
            Assert.Equal([roles[i]], s.Off());
        }
    }

    [Fact]
    public void TheSuggestionLogGivesOnlyWhatItKnows()
    {
        var sample = ChatRolloutRules.FromSuggestionLog([("posted", 300), ("snooze", 120), ("dismiss", 30), ("acked", 5)]);
        Assert.Equal(300, sample.CardsShown);
        Assert.Equal(150, sample.Dismissed);
        Assert.Equal(30, sample.DontShowAgain);
        Assert.Null(sample.Acted);
        var names = ChatRolloutRules.Judge(sample).Signals.Select(x => x.Name).ToList();
        Assert.DoesNotContain("actionRate", names); // not logged, so never counted as good or bad
        Assert.DoesNotContain("mute", names);
        Assert.Equal(ChatRolloutRules.Ok, ChatRolloutRules.Judge(sample).Verdict);
    }
}
