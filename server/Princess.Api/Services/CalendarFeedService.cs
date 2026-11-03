using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The guest's subscribable calendar (next-level plan N3.4, S2-05). The address is shown once, when it is made; making a new one cancels the old, and turning it off removes it.
/// </summary>
public sealed class CalendarFeedService(IPushStore store, IUserStore users, TripService trips, IUserClock clock, IClock wall)
{
    public static string PathFor(string token) => $"/calendar/{token}.ics";

    public async Task<CalendarFeedDto> GetAsync(UserRecord actor, CancellationToken ct) =>
        new(await store.GetFeedHashAsync(actor.Id, ct) is not null, null);

    public async Task<CalendarFeedDto> CreateAsync(UserRecord actor, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var token = CalendarRules.NewToken();
        await store.SaveFeedHashAsync(actor.Id, CalendarRules.Hash(token), await clock.NowAsync(actor, ct), ct);
        return new(true, PathFor(token));
    }

    public async Task<CalendarFeedDto> RevokeAsync(UserRecord actor, CancellationToken ct)
    {
        await store.DeleteFeedAsync(actor.Id, ct);
        return new(false, null);
    }

    /// <summary>The calendar text for an address, or null when the address is not (or no longer) one. No sign-in: the address is the secret.</summary>
    public async Task<string?> RenderAsync(string? token, CancellationToken ct)
    {
        if (!CalendarRules.PlausibleToken(token)) return null;
        if (await store.FindFeedUserAsync(CalendarRules.Hash(token!), ct) is not { } userId || await users.FindByIdAsync(userId, ct) is not { } user) return null;
        var now = await clock.NowAsync(user, ct);
        var entries = new List<CalendarEntry>();
        if (await trips.CurrentAsync(user, now, ct) is { } b)
            entries = CalendarRules.Entries(b.Number, TimelineBook.For(b.SailingId, DateOnly.FromDateTime(b.Departure)), DateOnly.FromDateTime(b.FinalDueDate), b.PaidCents >= b.TotalCents);
        return CalendarRules.Build(entries, wall.UtcNow);
    }
}
