using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-plan.md, phase 4: what a member may read, when sending is closed, and the words on a lock screen.</summary>
public class ChatConversationRulesTests
{
    private static readonly DateTime Joined = new(2027, 3, 21, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void ADirectOrGroupMemberReadsOnlyWhatWasSentWhileTheyWereIn()
    {
        Assert.False(ChatConversationRules.CanRead("direct", Joined.AddMinutes(-1), Joined, null));
        Assert.True(ChatConversationRules.CanRead("direct", Joined, Joined, null));
        Assert.True(ChatConversationRules.CanRead("group", Joined.AddHours(2), Joined, Joined.AddHours(3)));
        Assert.False(ChatConversationRules.CanRead("group", Joined.AddHours(4), Joined, Joined.AddHours(3)));
    }

    [Fact]
    public void TheBookingGroupShowsEverything() => Assert.True(ChatConversationRules.CanRead("party", Joined.AddDays(-30), Joined, null));

    [Theory]
    [InlineData("direct", "active", false, false)]
    [InlineData("direct", "active", true, true)]
    [InlineData("group", "active", true, false)]     // only a direct chat closes when its connection ends
    [InlineData("group", "left", false, true)]
    [InlineData("party", "removed", false, true)]
    public void SendingIsClosedForAnEndedDirectChatOrAMemberWhoIsNoLongerIn(string kind, string status, bool ended, bool closed) =>
        Assert.Equal(closed, ChatConversationRules.IsClosed(kind, status, ended));

    [Fact]
    public void AConversationIsNamedForTheOtherPersonTheBookingOrItsOwnName()
    {
        Assert.Equal("Sam R.", ChatConversationRules.DisplayName("direct", "Direct", ["Sam R."]));
        Assert.Equal("My group", ChatConversationRules.DisplayName("party", "Chat", ["Sam R."]));
        Assert.Equal("Dinner crew", ChatConversationRules.DisplayName("group", " Dinner crew ", ["A", "B"]));
        Assert.Equal("A, B, C", ChatConversationRules.DisplayName("group", "", ["A", "B", "C", "D"]));
    }

    [Theory]
    [InlineData("  hello ", "hello")]
    [InlineData("", null)]
    [InlineData("   ", null)]
    [InlineData(null, null)]
    public void AMessageIsTrimmedAndMustHaveText(string? text, string? expected) => Assert.Equal(expected, ChatConversationRules.CleanText(text));

    [Fact]
    public void AMessageOver2000CharactersIsRefused()
    {
        Assert.NotNull(ChatConversationRules.CleanText(new string('x', 2000)));
        Assert.Null(ChatConversationRules.CleanText(new string('x', 2001)));
    }

    [Fact]
    public void APreviewIsCutWithAnEllipsisAndKeptOnOneLine()
    {
        Assert.Equal("short", ChatConversationRules.Preview("short"));
        Assert.Equal("a b", ChatConversationRules.Preview("a\nb"));
        var cut = ChatConversationRules.Preview(new string('x', 200));
        Assert.Equal(80, cut.Length);
        Assert.EndsWith("…", cut);
    }

    [Theory]
    [InlineData(5, 2, 1, null, true)]
    [InlineData(5, 1, 1, null, false)]    // my own message is never unread
    [InlineData(5, 2, 1, 5L, false)]
    [InlineData(6, 2, 1, 5L, true)]
    public void OnlyOthersMessagesAfterTheLastReadOneAreUnread(long id, long from, long me, long? lastRead, bool unread) =>
        Assert.Equal(unread, ChatConversationRules.IsUnread(id, from, me, lastRead));

    [Theory]
    [InlineData(null, 30)]
    [InlineData(0, 30)]
    [InlineData(10, 10)]
    [InlineData(5000, 100)]
    public void APageIsThirtyByDefaultAndNeverOverAHundred(int? asked, int size) => Assert.Equal(size, ChatConversationRules.ClampPage(asked));

    [Fact]
    public void ThePhoneNamesTheSenderAndHidesTheTextUnlessTheGuestOptedIn()
    {
        Assert.Equal(("New message from Sam R.", "Open Princess to read it."), ChatConversationRules.MessageNotice("Sam R.", "lunch at one?", false));
        Assert.Equal(("New message from Sam R.", "lunch at one?"), ChatConversationRules.MessageNotice("Sam R.", "lunch at one?", true));
        Assert.Equal("Open Princess to read it.", ChatConversationRules.MessageNotice("Sam R.", "  ", true).Body);
    }

    [Fact]
    public void ANoticeCollapsesPerConversationButIsKeyedPerMessage()
    {
        var c = Guid.NewGuid();
        Assert.Equal(ChatConversationRules.NoticeTag(c), ChatConversationRules.NoticeTag(c));
        Assert.NotEqual(ChatConversationRules.NoticeKey(c, Guid.NewGuid()), ChatConversationRules.NoticeKey(c, Guid.NewGuid()));
        Assert.Equal($"/chat?c={c}", ChatConversationRules.NoticePath(c));
    }
}
