using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Tests;

/// <summary>
/// The reminder grammar and its time rules (docs/stanley-reminders-requirements.md sections 15 and 25.4). The corpus is a table of phrases with the expected reading; a wrong read must be a question or a refusal,
/// never a wrong time. (The plan asks for a 500-phrase corpus; this is the first slice, and every wrong read found in use is added here.)
/// </summary>
public class ReminderParserTests
{
    // Monday 22 March 2027, 14:00 on the ship's clock.
    private static readonly DateTime Now = new(2027, 3, 22, 14, 0, 0);

    private static readonly StanleyActionContext Ctx = new(
        [new("show1", "Evening Show", "20:00", 1, true), new("trivia", "Team Trivia", "11:00", 1, true), new("late", "Late Show", "22:30", 1, true)],
        new StanleyAllAboard("16:30", "ship"), "S1");

    private static ReminderSpec Spec(string text, DateTime? now = null, StanleyActionContext? ctx = null)
    {
        var r = ReminderParser.Read(text, ctx ?? Ctx, now ?? Now);
        Assert.True(r?.Spec is not null, $"\"{text}\" should be read, got {(r is null ? "not a reminder" : r.Ask ?? r.Refuse)}");
        return r!.Spec!;
    }

    private static string Question(string text, DateTime? now = null, StanleyActionContext? ctx = null)
    {
        var r = ReminderParser.Read(text, ctx ?? Ctx, now ?? Now);
        Assert.True(r?.Ask is not null, $"\"{text}\" should ask, got {(r?.Spec is not null ? "a reading" : r?.Refuse ?? "not a reminder")}");
        return r!.Ask!;
    }

    [Theory]
    [InlineData("remind me at 4:15 pm to be back on board", "16:15", null, "be back on board")]
    [InlineData("remind me at 16:15 to be back", "16:15", null, "be back")]
    [InlineData("remind me at 7pm to call mum", "19:00", null, "call mum")]
    [InlineData("remind me to call mum at 7pm", "19:00", null, "call mum")]
    [InlineData("Remind me at noon to eat", "12:00", null, "eat")]
    [InlineData("remind me at midnight", "00:00", null, "Reminder")]
    [InlineData("remind me at 7:30 am", "07:30", null, "Reminder")]
    [InlineData("remind me at 12 pm", "12:00", null, "Reminder")]
    [InlineData("remind me at 12 am", "00:00", null, "Reminder")]
    [InlineData("remind me at 9 in the evening", "21:00", null, "Reminder")]
    [InlineData("remind me at 7 in the morning to wake the kids", "07:00", null, "wake the kids")]
    [InlineData("please remind me at 6 pm about dinner", "18:00", null, "dinner")]
    [InlineData("can you remind me at 8:45 pm to pick up the photos", "20:45", null, "pick up the photos")]
    [InlineData("set a reminder for 5:30 pm to book the spa", "17:30", null, "book the spa")]
    [InlineData("remind me tomorrow at 7 am to wake up", "07:00", "2027-03-23", "wake up")]
    [InlineData("remind me tomorrow at 9:30 pm", "21:30", "2027-03-23", "Reminder")]
    [InlineData("remind me tonight at 9 to read", "21:00", "2027-03-22", "read")]
    [InlineData("remind me today at 5 pm", "17:00", "2027-03-22", "Reminder")]
    [InlineData("remind me on thursday at 8 am", "08:00", "2027-03-25", "Reminder")]
    [InlineData("remind me monday at 8 am", "08:00", "2027-03-29", "Reminder")]
    [InlineData("remind me this evening at 7 to change", "19:00", "2027-03-22", "change")]
    public void ClockWordsAreRead(string phrase, string at, string? date, string text)
    {
        var s = Spec(phrase);
        Assert.Equal((StanleyReminderRules.KindClock, at, date, text), (s.Kind, s.At, s.Date?.ToString("yyyy-MM-dd"), s.Text));
    }

    [Theory]
    [InlineData("remind me in 30 minutes to check the oven", 30, "check the oven")]
    [InlineData("remind me in 5 minutes", 5, "Reminder")]
    [InlineData("remind me in an hour", 60, "Reminder")]
    [InlineData("remind me in 2 hours to call home", 120, "call home")]
    [InlineData("remind me in half an hour", 30, "Reminder")]
    [InlineData("remind me in an hour and a half to move the car", 90, "move the car")]
    [InlineData("remind me to stretch in 20 mins", 20, "stretch")]
    [InlineData("remind me in three hours", 180, "Reminder")]
    public void RelativeWordsAreRead(string phrase, int minutes, string text)
    {
        var s = Spec(phrase);
        Assert.Equal((StanleyReminderRules.KindRelative, minutes, text), (s.Kind, s.InMinutes, s.Text));
    }

    [Fact]
    public void AnchoredWordsFollowAllAboardOrAPlanItemByName()
    {
        var a = Spec("remind me 45 minutes before all aboard to be back");
        Assert.Equal((StanleyReminderRules.KindAnchored, StanleyReminderRules.AllAboard, 45, "16:30", "be back"), (a.Kind, a.Anchor, a.OffsetMin, a.At, a.Text));
        var b = Spec("remind me an hour before the evening show");
        Assert.Equal(("show1", 60, "20:00"), (b.Anchor, b.OffsetMin, b.At));
        var c = Spec("remind me half an hour before trivia to find a team");
        Assert.Equal(("trivia", 30, "find a team"), (c.Anchor, c.OffsetMin, c.Text));
        Assert.Equal(("show1", 90), (Spec("remind me an hour and a half before the evening show").Anchor, Spec("remind me an hour and a half before the evening show").OffsetMin));
    }

    [Fact]
    public void AnAmbiguousOrUnreadableTimeIsAQuestionNeverAGuess()
    {
        // Two shows match "the show": ask which.
        Assert.Contains("Evening Show at 20:00", Question("remind me an hour before the show"));
        Assert.Contains("Late Show at 22:30", Question("remind me an hour before the show"));
        // A bare "5" at 14:00 could be 5 pm today or 5 am tomorrow.
        var five = Question("remind me at 5");
        Assert.Contains("5:00 PM today", five);
        Assert.Contains("5:00 AM tomorrow", five);
        Assert.Contains("4:30 PM", Question("remind me at half past 4"));
        Assert.Contains("passed", Question("remind me today at 9 am"));
        Assert.Contains("time", Question("remind me later"), StringComparison.OrdinalIgnoreCase);
        Assert.NotEmpty(Question("remind me soon to stretch"));
        Assert.NotEmpty(Question("remind me to stretch"));
        Assert.NotEmpty(Question("remind me tomorrow"));
        Assert.NotEmpty(Question("remind me in a bit"));
        Assert.NotEmpty(Question("remind me in 3 days"));
        Assert.Contains("more than a day", Question("remind me in 30 hours"));
        Assert.NotEmpty(Question("remind me on day 4 at 7 pm"));
        Assert.NotEmpty(Question("remind me after dinner"));
        Assert.NotEmpty(Question("remind me when we dock"));
        Assert.Contains("how long", Question("remind me before all aboard"), StringComparison.OrdinalIgnoreCase);
        Assert.NotEmpty(Question("remind me an hour before the casino opens"));
        Assert.Contains("clock time", Question("remind me 30 minutes before all aboard", ctx: new StanleyActionContext(null, null, "S1")));
    }

    [Fact]
    public void ABareHourOffersOnlyTheTimesStillAheadAndTakesTheOnlyOne()
    {
        // At 18:00 today's 5:00 am and 5:00 pm have gone; only tomorrow's 5:00 am is within a day, so there is nothing to ask.
        var s = Spec("remind me at 5", new DateTime(2027, 3, 22, 18, 0, 0));
        Assert.Equal("05:00", s.At);
        // Tomorrow at a bare 7 is 7 am or 7 pm: ask.
        Assert.Contains("7:00 AM tomorrow", Question("remind me tomorrow at 7"));
    }

    [Fact]
    public void TomorrowJustAfterMidnightAsksTonightOrTomorrow()
    {
        var q = Question("remind me tomorrow at 7 am", new DateTime(2027, 3, 23, 1, 30, 0));
        Assert.Contains("Tonight (Tue 23 Mar)", q);
        Assert.Contains("tomorrow (Wed 24 Mar)", q);
        Assert.Equal("2027-03-24", Spec("remind me tomorrow at 7 am", new DateTime(2027, 3, 23, 5, 0, 0)).Date?.ToString("yyyy-MM-dd"));
    }

    [Theory]
    [InlineData("remind Jordan to bring the sun cream at 5pm")]
    [InlineData("remind us at 5pm to meet")]
    [InlineData("remind everyone about the muster")]
    [InlineData("remind me every night at 10")]
    [InlineData("remind me daily at 8 am to take a walk")]
    public void ARequestForSomeoneElseOrARepeatIsRefusedWithAReason(string phrase)
    {
        var r = ReminderParser.Read(phrase, Ctx, Now);
        Assert.NotNull(r?.Refuse);
        Assert.Null(r!.Spec);
    }

    [Fact]
    public void LinksAreStrippedAndHealthWordsMakeItPrivate()
    {
        var link = Spec("remind me at 5pm to open https://evil.example/x now");
        Assert.Equal(("17:00", "open now"), (link.At, link.Text));
        Assert.DoesNotContain("http", link.Text);
        Assert.True(Spec("remind me at 8 pm to take my tablets").Private);
        Assert.True(Spec("remind me at 8 am to use my inhaler").Private);
        Assert.False(Spec("remind me at 8 pm to call mum").Private);
    }

    [Fact]
    public void WordsThatAreNotAReminderAreNotRead()
    {
        Assert.Null(ReminderParser.Read("what time is dinner", Ctx, Now));
        Assert.Null(ReminderParser.Read("book a table at 7pm", Ctx, Now));
    }

    [Fact]
    public void WithoutTheShipsClockABareHourOneToNineIsTheEvening()
    {
        var s = ReminderParser.Read("remind me at 4:15 to be back on board", Ctx)!.Spec!;
        Assert.Equal(("16:15", "be back on board"), (s.At, s.Text));
    }

    [Fact]
    public void ASpecBecomesTheArgumentsTheActionPipelineCarries()
    {
        var a = Spec("remind me tomorrow at 7 am to wake up").ToArgs();
        Assert.Equal(("07:00", "2027-03-23", "wake up"), (a["at"], a["date"], a["text"]));
        Assert.False(a.ContainsKey("when"));
        var b = Spec("remind me 45 minutes before all aboard").ToArgs();
        Assert.Equal((StanleyReminderRules.KindAnchored, "allAboard", "45"), (b["when"], b["anchor"], b["offset"]));
        Assert.Equal("30", Spec("remind me in 30 minutes").ToArgs()["in"]);
        // And the intent reader accepts them back, unchanged.
        var intent = StanleyIntents.Validate(new System.Text.Json.Nodes.JsonObject { ["kind"] = "remind_me", ["at"] = "07:00", ["date"] = "2027-03-23", ["text"] = "wake up" }, Ctx).Intent!;
        Assert.Equal(("07:00", "2027-03-23"), (intent.Arg("at"), intent.Arg("date")));
    }

    [Fact]
    public void ThePreviewAndTheReminderUseTheSameMoment()
    {
        var zone = "America/New_York";
        var now = new DateTime(2027, 3, 22, 18, 0, 0, DateTimeKind.Utc);   // 14:00 EDT
        Assert.Equal(new DateTime(2027, 3, 23, 11, 0, 0), StanleyReminderRules.Resolve(new Dictionary<string, string> { ["at"] = "07:00", ["date"] = "2027-03-23" }, now, zone));
        Assert.Equal(new DateTime(2027, 3, 22, 18, 30, 0), StanleyReminderRules.Resolve(new Dictionary<string, string> { ["when"] = "relative", ["in"] = "30" }, now, zone));
        Assert.Equal(new DateTime(2027, 3, 22, 19, 45, 0), StanleyReminderRules.Resolve(new Dictionary<string, string> { ["when"] = "anchored", ["at"] = "16:30", ["anchor"] = "allAboard", ["offset"] = "45" }, now, zone));
        Assert.Null(StanleyReminderRules.Resolve(new Dictionary<string, string> { ["at"] = "noon" }, now, zone));
        Assert.Null(StanleyReminderRules.Resolve(new Dictionary<string, string> { ["when"] = "relative", ["in"] = "0" }, now, zone));
        // A wall time that does not exist on a clock-change night takes the first valid instant (3:30 am EDT).
        Assert.Equal(new DateTime(2027, 3, 14, 7, 30, 0), StanleyReminderRules.Resolve(new Dictionary<string, string> { ["at"] = "02:30", ["date"] = "2027-03-14" }, new DateTime(2027, 3, 13, 12, 0, 0, DateTimeKind.Utc), zone));
        Assert.Equal("Tomorrow, Tue 23 Mar, 7:00 AM ship time", StanleyReminderRules.Label(new DateTime(2027, 3, 23, 11, 0, 0), zone, now));
        Assert.Equal("Today, Mon 22 Mar, 3:45 PM ship time", StanleyReminderRules.Label(new DateTime(2027, 3, 22, 19, 45, 0), zone, now));
        Assert.Equal("Thu 25 Mar, 7:00 AM ship time", StanleyReminderRules.Label(new DateTime(2027, 3, 25, 11, 0, 0), zone, now));
    }
}

public class StanleyReminderListTests
{
    private const string Zone = "America/New_York";
    private static readonly DateTime Start = new(2027, 3, 22, 18, 0, 0, DateTimeKind.Utc);   // 14:00 EDT
    private static readonly UserRecord Me = new() { Id = 1, PublicId = Guid.NewGuid() };

    private static (StanleyReminderService Svc, Support.FakeClock Clock) Make()
    {
        var clock = new Support.FakeClock(Start);
        return (new StanleyReminderService(new MemoryStanleyReminderStore(), clock), clock);
    }

    private static Dictionary<string, string> Anchored(string anchor = "show1", string title = "Evening Show", string at = "20:00", int offset = 60) => new()
    {
        ["when"] = "anchored", ["at"] = at, ["anchor"] = anchor, ["anchorTitle"] = title, ["anchorDay"] = "1", ["offset"] = offset.ToString(), ["text"] = "Get ready",
    };

    private static StanleyActionContext Plan(string id, string start, bool listed = true) => new([new(id, "Evening Show", start, 1, listed), new("other", "Trivia", "11:00", 1, true)], null, "S1");

    [Fact]
    public async Task ThePlanItemMovingMovesTheReminderAndLeavesOneLine()
    {
        var (svc, _) = Make();
        await svc.AddAsync(Me, Anchored(), Zone, default);
        var first = Assert.Single(await svc.ListAsync(Me, default));
        Assert.Equal(("Today, Mon 22 Mar, 7:00 PM ship time", "1 hour before", "Evening Show"), (first.When, first.Lead, first.Anchor));
        Assert.Equal(1, await svc.FollowAsync(Me, Plan("show1", "21:00"), default));
        var moved = Assert.Single(await svc.ListAsync(Me, default));
        Assert.Equal("Today, Mon 22 Mar, 8:00 PM ship time", moved.When);
        Assert.Equal("Moved to 8:00 PM because Evening Show is now at 21:00.", moved.Note);
        // Nothing changed, nothing to say.
        Assert.Equal(0, await svc.FollowAsync(Me, Plan("show1", "21:00"), default));
    }

    [Fact]
    public async Task ADroppedPlanItemEndsTheReminderWithALineAndItCanBeKeptAsAPlainOne()
    {
        var (svc, clock) = Make();
        var id = await svc.AddAsync(Me, Anchored(), Zone, default);
        Assert.Equal(1, await svc.FollowAsync(Me, Plan("show1", "20:00", listed: false), default));
        var ended = Assert.Single(await svc.ListAsync(Me, default));
        Assert.Equal(StanleyReminderRules.StateCancelled, ended.State);
        Assert.Contains("no longer in your plan", ended.Note);
        // It is not silently dropped from the list, and it is not sent.
        clock.UtcNow = Start.AddHours(10);
        Assert.Empty(await svc.DueAsync(Me.Id, clock.UtcNow, default));
        clock.UtcNow = Start;
        var kept = await svc.UpdateAsync(Me, id, new StanleyReminderEdit(null, null, null, null, true), default);
        Assert.Equal((StanleyReminderRules.StateScheduled, StanleyReminderRules.KindClock, null, null), (kept.State, kept.Kind, kept.Anchor, kept.Note));
    }

    [Fact]
    public async Task APlanForAnotherDayOrWithoutTheItemsDayDoesNotEndAReminder()
    {
        var (svc, _) = Make();
        await svc.AddAsync(Me, Anchored(), Zone, default);
        var otherDay = new StanleyActionContext([new("trivia", "Trivia", "11:00", 2, true)], null, "S1");
        Assert.Equal(0, await svc.FollowAsync(Me, otherDay, default));
        Assert.Equal(0, await svc.FollowAsync(Me, new StanleyActionContext(null, null, "S1"), default));
        Assert.Equal(StanleyReminderRules.StateScheduled, Assert.Single(await svc.ListAsync(Me, default)).State);
    }

    [Fact]
    public async Task AllAboardMovingMovesOnlyTodaysAnchoredReminderAndNeverIntoThePast()
    {
        var (svc, _) = Make();
        var args = new Dictionary<string, string> { ["when"] = "anchored", ["at"] = "16:30", ["anchor"] = "allAboard", ["offset"] = "45", ["text"] = "Be back", ["anchorDay"] = "0" };
        await svc.AddAsync(Me, args, Zone, default);   // 15:45
        Assert.Equal(1, await svc.FollowAsync(Me, new StanleyActionContext(null, new StanleyAllAboard("17:30", "ship"), "S1"), default));
        Assert.Equal("Today, Mon 22 Mar, 4:45 PM ship time", Assert.Single(await svc.ListAsync(Me, default)).When);
        // All aboard pulled forward to 14:30 would put the reminder in the past: it ends, with a line, rather than firing at once.
        Assert.Equal(1, await svc.FollowAsync(Me, new StanleyActionContext(null, new StanleyAllAboard("14:30", "ship"), "S1"), default));
        var ended = Assert.Single(await svc.ListAsync(Me, default));
        Assert.Equal(StanleyReminderRules.StateCancelled, ended.State);
    }

    [Fact]
    public async Task TheGuestCanEditTheWordsTheTimeAndTheLeadAndRemoveAReminder()
    {
        var (svc, _) = Make();
        var id = await svc.AddAsync(Me, new Dictionary<string, string> { ["at"] = "16:15", ["text"] = "Be back" }, Zone, default);
        var edited = await svc.UpdateAsync(Me, id, new StanleyReminderEdit("Be back on deck 5", "17:00", "2027-03-23", null, null), default);
        Assert.Equal(("Be back on deck 5", "Tomorrow, Tue 23 Mar, 5:00 PM ship time"), (edited.Text, edited.When));
        await Assert.ThrowsAsync<ApiException>(() => svc.UpdateAsync(Me, id, new StanleyReminderEdit("  ", null, null, null, null), default));
        Assert.Equal("past", (await Assert.ThrowsAsync<ApiException>(() => svc.UpdateAsync(Me, id, new StanleyReminderEdit(null, "09:00", "2027-03-22", null, null), default))).Title);
        Assert.Equal("tooFar", (await Assert.ThrowsAsync<ApiException>(() => svc.UpdateAsync(Me, id, new StanleyReminderEdit(null, "09:00", "2027-06-22", null, null), default))).Title);
        await Assert.ThrowsAsync<ApiException>(() => svc.UpdateAsync(new UserRecord { Id = 2, PublicId = Guid.NewGuid() }, id, new StanleyReminderEdit("x", null, null, null, null), default));

        var anchored = await svc.AddAsync(Me, Anchored(), Zone, default);
        var lead = await svc.UpdateAsync(Me, anchored, new StanleyReminderEdit(null, null, null, 30, null), default);
        Assert.Equal(("Today, Mon 22 Mar, 7:30 PM ship time", "30 minutes before"), (lead.When, lead.Lead));
        Assert.Equal("past", (await Assert.ThrowsAsync<ApiException>(() => svc.UpdateAsync(Me, anchored, new StanleyReminderEdit(null, null, null, 400, null), default))).Title);

        Assert.True(await svc.CancelAsync(Me, id, default));
        Assert.Equal(["Get ready"], (await svc.ListAsync(Me, default)).Select(r => r.Text));
    }

    [Fact]
    public async Task ALimitOfFortyAndTheTripLengthApplyAndHealthWordsStayPrivate()
    {
        var (svc, _) = Make();
        Assert.Equal(40, StanleyReminderRules.MaxPending);
        for (var i = 0; i < StanleyReminderRules.MaxPending; i++) await svc.AddAsync(Me, new Dictionary<string, string> { ["when"] = "relative", ["in"] = (30 + i).ToString(), ["text"] = "r" + i }, Zone, default);
        Assert.Equal("tooMany", (await Assert.ThrowsAsync<ApiException>(() => svc.AddAsync(Me, new Dictionary<string, string> { ["at"] = "23:00", ["text"] = "one more" }, Zone, default))).Title);
        Assert.Equal("tooFar", (await Assert.ThrowsAsync<ApiException>(() => svc.AddAsync(new UserRecord { Id = 5, PublicId = Guid.NewGuid() }, new Dictionary<string, string> { ["at"] = "09:00", ["date"] = "2027-06-01", ["text"] = "x" }, Zone, default))).Title);
        Assert.Equal("past", (await Assert.ThrowsAsync<ApiException>(() => svc.AddAsync(new UserRecord { Id = 5, PublicId = Guid.NewGuid() }, new Dictionary<string, string> { ["at"] = "09:00", ["date"] = "2027-03-22", ["text"] = "x" }, Zone, default))).Title);
        var other = new UserRecord { Id = 6, PublicId = Guid.NewGuid() };
        await svc.AddAsync(other, new Dictionary<string, string> { ["at"] = "20:00", ["text"] = "take my tablets", ["private"] = "1" }, Zone, default);
        Assert.True(Assert.Single(await svc.ListAsync(other, default)).Private);
        Assert.Empty(await svc.ListAsync(new UserRecord { Id = 7, PublicId = Guid.NewGuid() }, default));
    }
}
