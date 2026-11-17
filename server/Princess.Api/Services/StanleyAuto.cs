using System.Text.Json;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// AUT-02, deadline reminders (phase P10a). Runs only when the guest is asked (no background run yet) and only if <see cref="StanleyPermissionService.MayAsync"/> says the CL-08 row is on, which it is not for a child, a pause,
/// a level below 4 or a guest who has not switched it on. Each reminder is a plain clock reminder on the guest's own list with a ledger line (so Did shows it and it can be removed there), is tagged with its key so it is set once, and
/// never touches money, another person or a booking.
/// </summary>
public sealed class StanleyAutoService(StanleyCheckupService checkup, StanleyPermissionService permissions, IStanleyReminderStore reminders, IStanleyActionStore ledger, IClock clock)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<AutoRunDto> RunAsync(UserRecord user, CancellationToken ct)
    {
        var none = new AutoRunDto(false, StanleyAutoRules.ClassId, [], [], StanleyAutoRules.NotChecked.ToList(), null);
        if (!await permissions.MayAsync(user, StanleyAutoRules.Row, ct)) return none;
        var (facts, sailing) = await checkup.FactsAsync(user, ct);
        if (facts is null) return none with { On = true };

        var now = clock.UtcNow;
        var existing = await reminders.ListAsync(user.Id, now.AddDays(-1), ct);
        var have = existing.Where(r => r.State != StanleyReminderRules.StateCancelled && r.AnchorId is not null && r.AnchorId.StartsWith(StanleyAutoRules.Marker, StringComparison.Ordinal))
            .Select(r => r.AnchorId!).ToHashSet(StringComparer.Ordinal);
        var live = existing.Count(r => r.State != StanleyReminderRules.StateCancelled);
        var (add, waiting) = StanleyAutoRules.Plan(StanleyAutoRules.Candidates(facts), have, have.Count, now);

        var made = new List<AutoMade>();
        foreach (var c in add)
        {
            if (live + made.Count >= StanleyReminderRules.MaxPending) { waiting.Add("Your reminders list is full: " + c.Text); continue; }
            var row = new StanleyReminderRow
            {
                PublicId = Guid.NewGuid(), UserId = user.Id, DueAt = c.DueAt, Text = StanleyReminderRules.Clean(c.Text), CreatedAt = now, Kind = StanleyReminderRules.KindClock,
                ZoneId = Itinerary.ShipHomeZone, AnchorType = "auto", AnchorId = c.Key, State = StanleyReminderRules.StateScheduled,
            };
            await reminders.AddAsync(row, ct);
            var receipt = new StanleyActionRow
            {
                PublicId = Guid.NewGuid(), UserId = user.Id, Kind = StanleyActionKinds.RemindMe, Status = StanleyActionStatus.Done, CreatedAt = now, ExpiresAt = now, UpdatedAt = now, DoneAt = now,
                UndoUntil = now.AddMinutes(StanleyAutoRules.UndoMinutes), Ref = row.PublicId.ToString(), IdemKey = c.Key,
                Data = JsonSerializer.Serialize(new StanleyActionData(sailing, "Reminder set: " + row.Text, [], ["You"], null, null, new Dictionary<string, string> { ["class"] = StanleyAutoRules.ClassId }, "Stanley, because you switched on setting your reminders"), Json),
            };
            await ledger.AddAsync(receipt, ct);
            made.Add(new(c.Key, row.Text, c.DueAt, StanleyActionService.Receipt(receipt)));
        }
        return new(true, StanleyAutoRules.ClassId, made, waiting, StanleyAutoRules.NotChecked.ToList(), facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }
}
