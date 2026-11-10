using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Tests;

/// <summary>docs/chat-features-research.md, phase 2: the 15-minute window, the typing indicator, timed mute and the send limit.</summary>
public class ChatControlRulesTests
{
    private static readonly DateTime Sent = new(2027, 3, 22, 16, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void TheWindowIsOpenAtFourteenFiftyNineAndClosedAtFifteenOhOne()
    {
        Assert.True(ChatControlRules.InWindow(Sent, Sent.AddMinutes(14).AddSeconds(59)));
        Assert.True(ChatControlRules.InWindow(Sent, Sent.AddMinutes(15)));
        Assert.False(ChatControlRules.InWindow(Sent, Sent.AddMinutes(15).AddSeconds(1)));
        Assert.True(ChatControlRules.InWindow(Sent, Sent.AddSeconds(-5)));   // a clock a little behind
        Assert.Equal(Sent, ChatControlRules.WindowStart(Sent.AddMinutes(15)));
    }

    [Fact]
    public void OnlyTheSenderChangesAPlainMessageInsideTheWindow()
    {
        string? Why(bool system = false, bool stanley = false, bool mine = true, bool deleted = false, bool photo = false, string urgency = "normal", int minutes = 1, bool edit = true) =>
            ChatControlRules.ChangeProblem(system, stanley, mine, deleted, photo, urgency, Sent, Sent.AddMinutes(minutes), edit);
        Assert.Null(Why());
        Assert.Equal("notMessage", Why(system: true));
        Assert.Equal("notMessage", Why(stanley: true));
        Assert.Equal("notYours", Why(mine: false));
        Assert.Equal("deleted", Why(deleted: true));
        Assert.Equal("tooLate", Why(minutes: 16));
        Assert.Equal("photo", Why(photo: true));
        Assert.Null(Why(photo: true, edit: false));            // a photo can be deleted, not edited
        Assert.Equal("urgent", Why(urgency: "urgent"));
        Assert.Null(Why(urgency: "urgent", edit: false));      // and so can an urgent message
    }

    [Fact]
    public void TypingIsSentOnceEveryThreeSecondsAndShownForSix()
    {
        Assert.True(ChatControlRules.ShouldSendTyping(null, Sent));
        Assert.False(ChatControlRules.ShouldSendTyping(Sent, Sent.AddSeconds(2.9)));
        Assert.True(ChatControlRules.ShouldSendTyping(Sent, Sent.AddSeconds(3)));
        Assert.True(ChatControlRules.IsTyping(Sent, Sent.AddSeconds(5.9)));
        Assert.False(ChatControlRules.IsTyping(Sent, Sent.AddSeconds(6)));
    }

    [Fact]
    public void TheTrackerThrottlesExpiresAndForgetsWhenTheMessageIsSent()
    {
        var t = new ChatTypingTracker();
        Assert.True(t.Touch(1, 10, Sent));
        Assert.False(t.Touch(1, 10, Sent.AddSeconds(1)));
        Assert.True(t.Touch(1, 10, Sent.AddSeconds(3)));
        Assert.True(t.Touch(1, 11, Sent.AddSeconds(3)));
        Assert.Equal([10L, 11L], t.Active(1, except: 99, Sent.AddSeconds(4)).Order());
        Assert.Equal([11L], t.Active(1, except: 10, Sent.AddSeconds(4)));          // never your own
        Assert.Empty(t.Active(2, except: 99, Sent.AddSeconds(4)));                 // another conversation
        Assert.Empty(t.Active(1, except: 99, Sent.AddSeconds(10)));                // expired
        t.Touch(1, 12, Sent.AddSeconds(10));
        t.Clear(1, 12);
        Assert.Empty(t.Active(1, except: 99, Sent.AddSeconds(10)));
    }

    [Fact]
    public void ATimedMuteLastsItsLengthAndAMuteWithNoEndLastsUntilTurnedOff()
    {
        Assert.Equal(TimeSpan.FromHours(1), ChatControlRules.MuteSpan("hour"));
        Assert.Equal(TimeSpan.FromDays(1), ChatControlRules.MuteSpan("day"));
        Assert.Equal(TimeSpan.FromDays(7), ChatControlRules.MuteSpan("week"));
        Assert.Null(ChatControlRules.MuteSpan(null));
        Assert.True(ChatControlRules.IsKnownMuteLength(null));
        Assert.False(ChatControlRules.IsKnownMuteLength("fortnight"));
        Assert.True(ChatControlRules.IsMuted(true, null, Sent));
        Assert.True(ChatControlRules.IsMuted(true, Sent.AddMinutes(1), Sent));
        Assert.False(ChatControlRules.IsMuted(true, Sent, Sent));
        Assert.False(ChatControlRules.IsMuted(false, null, Sent));
    }

    [Fact]
    public void TwentyMessagesAMinuteIsTheLimit()
    {
        Assert.False(ChatControlRules.OverSendLimit(19));
        Assert.True(ChatControlRules.OverSendLimit(20));
    }
}
