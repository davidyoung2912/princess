using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-features-research.md, phase 8: who may join and post in a channel or room, the hold on links and numbers, slow mode and moderator hours.</summary>
public class ChatRoomRulesTests
{
    private static readonly DateTime Noon = new(2026, 11, 10, 12, 0, 0, DateTimeKind.Utc);
    private static readonly ChatRoomOptions AllOn = new() { ChannelsOn = true, SailingRoomsOn = true, InterestRoomsOn = true };

    private static string? Join(string kind = ChatRoomRules.Room, string? roomKind = ChatRoomRules.SailingRoom, bool child = false, bool booked = true, bool any = true, int members = 10, int cap = 500, bool on = true, bool closed = false) =>
        ChatRoomRules.JoinProblem(kind, roomKind, child, booked, any, members, cap, on, closed);

    private static string? Post(string kind = ChatRoomRules.Room, bool staff = false, bool active = true, bool closed = false, bool on = true, bool rules = true, DateTime? mutedUntil = null, bool slow = false, TimeSpan? since = null) =>
        ChatRoomRules.PostProblem(kind, staff, active, closed, on, rules, mutedUntil, slow, since, Noon);

    [Fact]
    public void ARoomNeedsABookingOnItsSailing() => Assert.Equal(ChatRoomRules.NoBooking, Join(booked: false));

    [Fact]
    public void AnInterestRoomNeedsAnyBookingNotThisSailing()
    {
        Assert.Null(Join(roomKind: ChatRoomRules.InterestRoom, booked: false, any: true));
        Assert.Equal(ChatRoomRules.NoBooking, Join(roomKind: ChatRoomRules.InterestRoom, booked: true, any: false));
    }

    [Fact]
    public void AChannelIsOpenToAnyGuestEvenWithoutABooking() => Assert.Null(Join(ChatRoomRules.Channel, null, booked: false, any: false));

    [Fact]
    public void ASupervisedChildNeverJoinsAChannelOrARoom()
    {
        Assert.Equal(ChatRoomRules.Child, Join(child: true));
        Assert.Equal(ChatRoomRules.Child, Join(ChatRoomRules.Channel, null, child: true));
    }

    [Fact]
    public void ASwitchedOffKindRefusesFirstAndAClosedRoomRefuses()
    {
        Assert.Equal(ChatRoomRules.Off, Join(on: false, child: true));
        Assert.Equal(ChatRoomRules.Closed, Join(closed: true));
    }

    [Fact]
    public void ARoomIsFullAtItsCapButAChannelNever()
    {
        Assert.Equal(ChatRoomRules.Full, Join(members: 500));
        Assert.Null(Join(members: 499));
        Assert.Null(Join(ChatRoomRules.Channel, null, members: 100_000));
    }

    [Fact]
    public void OnlyStaffPostInAChannel()
    {
        Assert.Equal(ChatRoomRules.StaffOnly, Post(ChatRoomRules.Channel));
        Assert.Null(Post(ChatRoomRules.Channel, staff: true));
    }

    [Fact]
    public void AMemberMustAcceptTheRulesBeforeTheFirstPost()
    {
        Assert.Equal(ChatRoomRules.RulesFirst, Post(rules: false));
        Assert.Null(Post(rules: true));
    }

    [Fact]
    public void AMutedMemberCannotPostUntilTheMuteEnds()
    {
        Assert.Equal(ChatRoomRules.Muted, Post(mutedUntil: Noon.AddMinutes(1)));
        Assert.Null(Post(mutedUntil: Noon.AddMinutes(-1)));
        Assert.Equal(ChatRoomRules.Muted, Post(mutedUntil: ChatRoomRules.NoEnd));
    }

    [Fact]
    public void ClosedAndLeftAndOffSayTheirOwnWordsBeforeAnythingAboutRules()
    {
        Assert.Equal(ChatRoomRules.Off, Post(on: false, rules: false));
        Assert.Equal(ChatRoomRules.Left, Post(active: false, rules: false));
        Assert.Equal(ChatRoomRules.Closed, Post(closed: true, rules: false));
    }

    [Fact]
    public void SlowModeAllowsOneMessageInThirtySeconds()
    {
        Assert.Equal(ChatRoomRules.Slow, Post(slow: true, since: TimeSpan.FromSeconds(29)));
        Assert.Null(Post(slow: true, since: TimeSpan.FromSeconds(30)));
        Assert.Null(Post(slow: true, since: null));
        Assert.Null(Post(slow: false, since: TimeSpan.FromSeconds(1)));
    }

    [Fact]
    public void TheWaitIsWholeSecondsAndNeverZero()
    {
        Assert.Equal(30, ChatRoomRules.SlowWaitSeconds(TimeSpan.Zero));
        Assert.Equal(1, ChatRoomRules.SlowWaitSeconds(TimeSpan.FromSeconds(29.5)));
        Assert.Equal(1, ChatRoomRules.SlowWaitSeconds(TimeSpan.FromSeconds(40)));
    }

    [Fact]
    public void StaffAreNotHeldToRulesMuteOrSlowMode() =>
        Assert.Null(ChatRoomRules.PostProblem(ChatRoomRules.Room, true, true, false, true, false, ChatRoomRules.NoEnd, true, TimeSpan.Zero, Noon));

    [Theory]
    [InlineData(7, 0, false)]
    [InlineData(8, 0, true)]
    [InlineData(22, 0, true)]
    [InlineData(23, 0, false)]
    public void ModeratorHoursAreEightToElevenInTheRoomsReferenceTime(int hour, int offset, bool inHours) =>
        Assert.Equal(inHours, ChatRoomRules.InModeratorHours(new DateTime(2026, 11, 10, hour, 30, 0, DateTimeKind.Utc), offset));

    [Fact]
    public void TheReferenceOffsetMovesTheHours()
    {
        var utc = new DateTime(2026, 11, 10, 20, 0, 0, DateTimeKind.Utc);   // 20:00 UTC is 05:00 at +9 hours: off duty; at -9 hours it is 11:00: on duty
        Assert.False(ChatRoomRules.InModeratorHours(utc, 9 * 60));
        Assert.True(ChatRoomRules.InModeratorHours(utc, -9 * 60));
    }

    [Fact]
    public void SlowModeComesOnByItselfOutsideHours()
    {
        var night = new DateTime(2026, 11, 10, 2, 0, 0, DateTimeKind.Utc);
        Assert.True(ChatRoomRules.SlowNow(false, night, 0));
        Assert.False(ChatRoomRules.SlowNow(false, Noon, 0));
        Assert.True(ChatRoomRules.SlowNow(true, Noon, 0));
    }

    [Theory]
    [InlineData("Call me on 555 123 4567", true)]
    [InlineData("see https://example.com", true)]
    [InlineData("www.example.com is good", true)]
    [InlineData("write to me at sam@example.com", true)]
    [InlineData("The 3pm excursion was great, 12 of us went", false)]
    public void ALinkOrNumberInARoomIsHeld(string text, bool held) => Assert.Equal(held, ChatRoomRules.NeedsHold(ChatRoomRules.Room, text));

    [Fact]
    public void TheHoldIsForRoomsOnly() => Assert.False(ChatRoomRules.NeedsHold(ChatRoomRules.Channel, "https://example.com"));

    [Theory]
    [InlineData("Man overboard at the pool!", true)]
    [InlineData("there is a medical emergency on deck 9", true)]
    [InlineData("Is the buffet good on sea days?", false)]
    public void EmergencyWordsPointToHelpNotToTheRoom(string text, bool emergency) => Assert.Equal(emergency, ChatRoomRules.LooksLikeEmergency(text));

    [Fact]
    public void ARoomNeedsTwoModeratorsToOpenButAChannelNone()
    {
        Assert.Equal("rota", ChatRoomRules.OpenProblem(ChatRoomRules.Room, 1));
        Assert.Null(ChatRoomRules.OpenProblem(ChatRoomRules.Room, 2));
        Assert.Null(ChatRoomRules.OpenProblem(ChatRoomRules.Channel, 0));
    }

    [Fact]
    public void AnOpenRoomWithAThinRotaIsAGapInTheSummary()
    {
        Assert.True(ChatRoomRules.NeedsModerator(ChatRoomRules.Room, false, 1));
        Assert.False(ChatRoomRules.NeedsModerator(ChatRoomRules.Room, true, 0));
        Assert.False(ChatRoomRules.NeedsModerator(ChatRoomRules.Channel, false, 0));
    }

    [Fact]
    public void EachKindHasItsOwnSwitch()
    {
        var o = new ChatRoomOptions();
        Assert.True(ChatRoomRules.IsOn(o, ChatRoomRules.Channel, null));
        Assert.False(ChatRoomRules.IsOn(o, ChatRoomRules.Room, ChatRoomRules.SailingRoom));
        Assert.False(ChatRoomRules.IsOn(o, ChatRoomRules.Room, ChatRoomRules.InterestRoom));
        Assert.True(ChatRoomRules.IsOn(AllOn, ChatRoomRules.Room, ChatRoomRules.InterestRoom));
        Assert.False(ChatRoomRules.IsOn(new ChatRoomOptions { SailingRoomsOn = true }, ChatRoomRules.Room, ChatRoomRules.InterestRoom));
    }

    [Fact]
    public void AStaffMuteEndsAtTheChosenTime()
    {
        Assert.Equal(Noon.AddHours(1), ChatRoomRules.MuteEnd("hour", Noon));
        Assert.Equal(Noon.AddDays(1), ChatRoomRules.MuteEnd("day", Noon));
        Assert.Equal(ChatRoomRules.NoEnd, ChatRoomRules.MuteEnd("room", Noon));
        Assert.Null(ChatRoomRules.MuteEnd("week", Noon));
        Assert.Null(ChatRoomRules.MuteEnd(null, Noon));
    }

    [Fact]
    public void CleaningKeepsRulesNamesAndTopicsInBounds()
    {
        Assert.Null(ChatRoomRules.CleanRules("  "));
        Assert.Null(ChatRoomRules.CleanRules(new string('x', ChatRoomRules.MaxRules + 1)));
        Assert.Equal("Be kind.", ChatRoomRules.CleanRules("  Be kind.  "));
        Assert.Null(ChatRoomRules.CleanName(new string('x', ChatRoomRules.MaxName + 1)));
        Assert.Equal("photography", ChatRoomRules.CleanTopic(" Photography "));
        Assert.Null(ChatRoomRules.CleanTopic("not a topic!"));
    }

    [Fact]
    public void AChannelAndARoomAreOpenToLateJoinersAndCloseWithStaff()
    {
        var sent = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);
        var joined = sent.AddDays(3);
        Assert.True(ChatConversationRules.CanRead(ChatConversationRules.Room, sent, joined, null));
        Assert.True(ChatConversationRules.CanRead(ChatConversationRules.Channel, sent, joined, null));
        Assert.False(ChatConversationRules.CanRead(ChatConversationRules.Group, sent, joined, null));
        Assert.True(ChatConversationRules.IsClosed(ChatConversationRules.Room, ChatConversationRules.Active, directEnded: true));
        Assert.False(ChatConversationRules.IsClosed(ChatConversationRules.Room, ChatConversationRules.Active, directEnded: false));
        Assert.True(ChatConversationRules.IsClosed(ChatConversationRules.Channel, "left", directEnded: false));
    }
}

public class ChatRoomQuestionRulesTests
{
    [Fact]
    public void AQuestionIsFiveToTwoHundredCharacters()
    {
        Assert.Null(ChatRoomRules.CleanQuestion("Hi"));
        Assert.Null(ChatRoomRules.CleanQuestion(new string('x', 201)));
        Assert.Equal("Is the 3pm tour worth it?", ChatRoomRules.CleanQuestion("  Is the 3pm tour worth it?  "));
    }

    [Fact]
    public void AQuestionCarriesNoContactDetailsAndAGuestHasThreeWaiting()
    {
        Assert.Equal("contactInfo", ChatRoomRules.QuestionProblem("email me at sam@example.com", 0));
        Assert.Equal("tooMany", ChatRoomRules.QuestionProblem("Is the buffet good?", 3));
        Assert.Null(ChatRoomRules.QuestionProblem("Is the buffet good?", 2));
    }
}
