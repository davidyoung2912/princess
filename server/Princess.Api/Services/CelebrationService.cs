using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Birthdays and anniversaries during the trip (small delights D2-5). Any guest reads; an adult guest on a confirmed booking saves the list. Saving is telling the ship:
/// each new or changed entry is stamped with the time it was told, and an unchanged one keeps its first time. Only the month and day are kept.
/// </summary>
public sealed class CelebrationService(ScopeLoader scopes, IFinishStore store)
{
    private static CelebrationsViewDto View(IEnumerable<CelebrationRow> rows, bool canEdit) =>
        new(rows.Select(r => new CelebrationDto(r.ClientId, r.Label, r.MonthDay, r.Surprise, TripRules.ToMs(r.ToldAt))).ToList(), canEdit);

    public async Task<CelebrationsViewDto> GetAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        return View(await store.ListCelebrationsAsync(c.Booking.BookingId, ct), c.Confirmed && !c.Actor.IsSupervised);
    }

    public async Task<CelebrationsViewDto> SaveAsync(UserRecord actor, string? number, CelebrationsRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (!c.Confirmed) throw ApiException.Conflict("notConfirmed");
        var items = body?.Items;
        if (CelebrationRules.Problem(items?.Select(i => new CelebrationInputView(i.Id, i.Label, i.Date)).ToList()) is { } problem) throw ApiException.Invalid(problem);
        var before = (await store.ListCelebrationsAsync(c.Booking.BookingId, ct)).ToDictionary(r => r.ClientId);
        var rows = items!.Select(i =>
        {
            var row = new CelebrationRow { ClientId = i.Id!, Label = CelebrationRules.CleanLabel(i.Label)!, MonthDay = CelebrationRules.MonthDay(i.Date)!, Surprise = i.Surprise, ToldAt = c.Now };
            if (before.TryGetValue(row.ClientId, out var old) && old.Label == row.Label && old.MonthDay == row.MonthDay && old.Surprise == row.Surprise) row.ToldAt = old.ToldAt;
            return row;
        }).ToList();
        await store.SaveCelebrationsAsync(c.Booking.BookingId, rows, ct);
        return View(rows, true);
    }
}
