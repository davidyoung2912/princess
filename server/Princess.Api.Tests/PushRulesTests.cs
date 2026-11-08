using System.Text.Json.Nodes;
using Princess.Api.Domain;
using Princess.Api.Services;
using Princess.Api.Data;

namespace Princess.Api.Tests;

/// <summary>Next-level plan N3: the budget, calm mode and quiet hours are enforced on the server; safety notices skip them; the five notices come from what the server knows.</summary>
public class PushRulesTests
{
    private static readonly DateTime Now = new(2027, 3, 24, 15, 0, 0, DateTimeKind.Utc);
    private static JsonObject Prefs(string? json = null) => NotificationRules.NormalizePrefs(json is null ? null : JsonNode.Parse(json));
    private static PushNotice Plain(string category = "payments") => new("k", "payment", category, false, 60, "/me/payments", "t", "b", []);
    private static PushNotice Safety() => Plain("critical") with { Bypass = true };
    private static readonly PushSettings Open = new(3, false, []);

    private static PortDayWithState PortDay(int minutesLeft) =>
        new(4, "cozumel", "2027-03-24", "4:30 pm", "3:30 pm", new DateTimeOffset(Now.AddMinutes(minutesLeft)).ToUnixTimeMilliseconds(), 0, 0, "America/New_York", "America/Cancun", false,
            AboardRules.StateOf(Now.AddMinutes(minutesLeft), Now));

    private static PushInput Input(PortDayWithState? port = null, bool notBack = false, int alert = 45, string payment = "ok", IReadOnlyList<PlanChange>? changes = null, IReadOnlyCollection<string>? watch = null, IReadOnlyList<DisruptionDef>? disruptions = null) =>
        new(Now, payment, "2027-03-01", port, port is not null, alert, notBack, changes ?? [], watch ?? [], 4, disruptions ?? []);

    [Fact]
    public void ABudgetOfNoneHoldsEverythingExceptSafety()
    {
        var none = new PushSettings(0, false, []);
        Assert.Equal("budget", PushRules.Decide(Plain(), Prefs(), none, new TimeOnly(12, 0), 0).Reason);
        Assert.True(PushRules.Decide(Safety(), Prefs(), none, new TimeOnly(12, 0), 99).Send);
    }

    [Fact]
    public void TheDaysBudgetIsSpentThenHeld()
    {
        var one = new PushSettings(1, false, []);
        Assert.True(PushRules.Decide(Plain(), Prefs(), one, new TimeOnly(12, 0), 0).Send);
        Assert.Equal("budget", PushRules.Decide(Plain(), Prefs(), one, new TimeOnly(12, 0), 1).Reason);
    }

    [Fact]
    public void CalmModeHoldsSuggestionsButNotSafety()
    {
        var calm = new PushSettings(5, true, []);
        Assert.Equal("calm", PushRules.Decide(Plain(), Prefs(), calm, new TimeOnly(12, 0), 0).Reason);
        Assert.True(PushRules.Decide(Safety(), Prefs(), calm, new TimeOnly(12, 0), 0).Send);
    }

    [Fact]
    public void QuietHoursCrossMidnightAndSafetyStillGoes()
    {
        var prefs = Prefs("""{"quiet":{"on":true,"from":"22:00","to":"07:00"}}""");
        Assert.Equal("quiet", PushRules.Decide(Plain(), prefs, Open, new TimeOnly(23, 30), 0).Reason);
        Assert.Equal("quiet", PushRules.Decide(Plain(), prefs, Open, new TimeOnly(6, 59), 0).Reason);
        Assert.True(PushRules.Decide(Plain(), prefs, Open, new TimeOnly(7, 0), 0).Send);
        Assert.True(PushRules.Decide(Safety(), prefs, Open, new TimeOnly(23, 30), 0).Send);
        Assert.True(PushRules.Decide(Plain(), Prefs(), Open, new TimeOnly(23, 30), 0).Send);
    }

    [Fact]
    public void AChannelTurnedOffHoldsItsCategory()
    {
        var prefs = Prefs("""{"channels":{"payments":{"push":false}}}""");
        Assert.Equal("channelOff", PushRules.Decide(Plain("payments"), prefs, Open, new TimeOnly(12, 0), 0).Reason);
        Assert.True(PushRules.Decide(Plain("documents"), prefs, Open, new TimeOnly(12, 0), 0).Send);
    }

    [Fact]
    public void AllAboardSpeaksInTheFinalNinetyMinutesAndEscalates()
    {
        Assert.DoesNotContain(PushRules.Build(Input(PortDay(120))), n => n.Kind == "allAboard");
        var at80 = PushRules.Build(Input(PortDay(80))).Single(n => n.Kind == "allAboard");
        Assert.EndsWith(":90", at80.Key);
        var at50 = PushRules.Build(Input(PortDay(50))).Single(n => n.Kind == "allAboard");
        var at25 = PushRules.Build(Input(PortDay(25))).Single(n => n.Kind == "allAboard");
        var at5 = PushRules.Build(Input(PortDay(5))).Single(n => n.Kind == "allAboard");
        Assert.EndsWith(":60", at50.Key);
        Assert.EndsWith(":30", at25.Key);
        Assert.EndsWith(":10", at5.Key);
        Assert.All(new[] { at50, at25, at5 }, n => Assert.True(n.Bypass));
    }

    [Fact]
    public void AllAboardIsSilentBeforeArrivalAndAfterTheTime()
    {
        var port = PortDay(50);
        Assert.DoesNotContain(PushRules.Build(Input(port) with { ArrivedInPort = false }), n => n.Kind == "allAboard");
        Assert.DoesNotContain(PushRules.Build(Input(PortDay(-5))), n => n.Kind == "allAboard");
    }

    [Fact]
    public void TheBackAboardNudgeNeedsSomeoneNotBackAndTheGuestsLeadTime()
    {
        Assert.Contains(PushRules.Build(Input(PortDay(40), notBack: true, alert: 45)), n => n.Kind == "backAboard");
        Assert.DoesNotContain(PushRules.Build(Input(PortDay(40), notBack: false, alert: 45)), n => n.Kind == "backAboard");
        Assert.DoesNotContain(PushRules.Build(Input(PortDay(100), notBack: true, alert: 45)), n => n.Kind == "backAboard");
        Assert.False(PushRules.Build(Input(PortDay(40), notBack: true)).Single(n => n.Kind == "backAboard").Bypass);
    }

    [Fact]
    public void AScheduleChangeIsOnlyForAWatchedEventOnTodayOrTomorrow()
    {
        var changes = new[] { new PlanChange("bingo", 4, "moved", "15:00", "Moved for the show"), new PlanChange("trivia", 4, "cancelled", null, "x"), new PlanChange("late", 7, "cancelled", null, "x") };
        var kinds = PushRules.Build(Input(changes: changes, watch: ["bingo", "late"])).Where(n => n.Kind == "scheduleChange").ToList();
        Assert.Single(kinds);
        Assert.Contains("bingo", kinds[0].Key);
        Assert.False(kinds[0].Bypass);
    }

    [Fact]
    public void ADisruptionBypassesOnlyWhenCritical()
    {
        var list = PushRules.Build(Input(disruptions: DisruptionRules.All.Where(d => d.Id is "portSkipped" or "clockChange").ToList())).Where(n => n.Kind == "disruption").ToList();
        Assert.True(list.Single(n => n.Key.EndsWith("portSkipped")).Bypass);
        Assert.False(list.Single(n => n.Key.EndsWith("clockChange")).Bypass);
    }

    [Fact]
    public void PaymentDueIsASuggestionAndOverdueIsNot()
    {
        Assert.False(PushRules.Build(Input(payment: "dueSoon")).Single(n => n.Kind == "payment").Bypass);
        Assert.True(PushRules.Build(Input(payment: "overdue")).Single(n => n.Kind == "payment").Bypass);
        Assert.Empty(PushRules.Build(Input(payment: "ok")));
    }

    [Fact]
    public void SafetyComesFirst()
    {
        var order = PushRules.Build(Input(PortDay(20), payment: "dueSoon")).Select(n => n.Kind).ToList();
        Assert.Equal("allAboard", order[0]);
    }

    [Fact]
    public void SettingsAreCleaned()
    {
        var s = PushRules.NormalizeSettings(7, null, ["bingo", "bad id", "", "bingo", new string('x', 50)]);
        Assert.Equal(PushRules.DefaultBudget, s.Budget);
        Assert.Equal(["bingo"], s.Watch);
        Assert.Equal(0, PushRules.NormalizeSettings(0, true, null).Budget);
    }

    [Fact]
    public void OnlyHttpsEndpointsAreAccepted()
    {
        Assert.True(PushRules.ValidEndpoint("https://fcm.googleapis.com/fcm/send/abc"));
        Assert.False(PushRules.ValidEndpoint("http://fcm.googleapis.com/fcm/send/abc"));
        Assert.False(PushRules.ValidEndpoint("javascript:alert(1)"));
        Assert.False(PushRules.ValidEndpoint(new string('a', 500)));
    }

    [Fact]
    public async Task TheSimulatedSenderRecordsAndDeliversNothing()
    {
        var sender = new SimPushSender();
        Assert.NotNull(sender.PublicKey);
        Assert.Equal(87, sender.PublicKey!.Length); // an uncompressed P-256 point, 65 bytes in base64url
        var result = await sender.SendAsync(new PushSubscriptionRow("https://push.example/a", "k", "a", 3, false, ""), new PushMessage("k", "payment", "t", "b", "/", false, []), CancellationToken.None);
        Assert.Equal(PushResult.Delivered, result);
        Assert.Single(sender.Sent);
    }

    [Fact]
    public void TheCalendarHasPaymentsPortDaysAndAllAboardWithAReminder()
    {
        var entries = CalendarRules.Entries("PR123", new DateOnly(2027, 3, 21), new DateOnly(2027, 1, 20), paid: false);
        Assert.Contains(entries, e => e.Uid == "payment-PR123");
        Assert.Contains(entries, e => e.Uid.StartsWith("allaboard-PR123") && e.RemindBefore == 60);
        var text = CalendarRules.Build(entries, Now);
        Assert.StartsWith("BEGIN:VCALENDAR", text);
        Assert.Contains("BEGIN:VALARM", text);
        Assert.EndsWith("END:VCALENDAR\r\n", text);
        Assert.DoesNotContain(CalendarRules.Entries("PR123", new DateOnly(2027, 3, 21), new DateOnly(2027, 1, 20), paid: true), e => e.Uid.StartsWith("payment"));
    }

    [Fact]
    public void ACalendarTokenIsLongRandomAndOnlyItsHashIsKept()
    {
        var a = CalendarRules.NewToken();
        var b = CalendarRules.NewToken();
        Assert.NotEqual(a, b);
        Assert.True(CalendarRules.PlausibleToken(a));
        Assert.False(CalendarRules.PlausibleToken("short"));
        Assert.Equal(64, CalendarRules.Hash(a).Length);
        Assert.NotEqual(CalendarRules.Hash(a), CalendarRules.Hash(b));
    }

    [Fact]
    public void AReminderSpeaksOnceTheTimeHasPassedAndKeepsToTheGuestsLimits()
    {
        var at = new DateTimeOffset(Now.AddHours(-1)).ToUnixTimeMilliseconds();
        var notices = PushRules.Build(Input() with { ReminderAt = at });
        var note = Assert.Single(notices);
        Assert.Equal("reminder", note.Kind);
        Assert.Equal($"reminder:{at}", note.Key);
        Assert.False(note.Bypass);
        Assert.Equal("calm", PushRules.Decide(note, Prefs(), new PushSettings(3, true, []), new TimeOnly(12, 0), 0).Reason);
        Assert.Equal("budget", PushRules.Decide(note, Prefs(), new PushSettings(0, false, []), new TimeOnly(12, 0), 0).Reason);
    }

    [Fact]
    public void AReminderForLaterIsNotBuiltYet()
    {
        var later = new DateTimeOffset(Now.AddHours(1)).ToUnixTimeMilliseconds();
        Assert.Empty(PushRules.Build(Input() with { ReminderAt = later }));
        Assert.Empty(PushRules.Build(Input()));
    }
}
