using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Sea-day delights that need the server (small delights DL7): thank-yous for a team (D6-7) and messages added to a celebration by the people on the booking (D6-8).
/// Anyone on the booking reads. A supervised child may add a celebration message but not a thank-you. Messages show the author's first name only.
/// </summary>
public sealed class SeaService(ScopeLoader scopes, IFinishStore store)
{
    public async Task<ThanksViewDto> ThanksAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        return ThanksView(c, await store.ListThanksAsync(c.Booking.BookingId, ct));
    }

    public async Task<ThanksViewDto> AddThanksAsync(UserRecord actor, string? number, ThanksRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (!c.Confirmed) throw ApiException.Conflict("notConfirmed");
        var team = SeaRules.CleanTeam(body?.Team) ?? throw ApiException.Invalid("badTeam");
        var text = SeaRules.CleanThanks(body?.Text) ?? throw ApiException.Invalid("badText");
        var rows = await store.ListThanksAsync(c.Booking.BookingId, ct);
        if (rows.Count >= SeaRules.MaxThanksPerBooking) throw ApiException.Conflict("tooMany");
        var row = new ThanksRow { Id = Guid.NewGuid(), UserId = c.Actor.Id, Team = team, Body = text, CreatedAt = c.Now };
        await store.AddThanksAsync(c.Booking.BookingId, row, ct);
        rows.Add(row);
        return ThanksView(c, rows);
    }

    private static ThanksViewDto ThanksView(Scope c, IEnumerable<ThanksRow> rows) =>
        new(rows.Select(r => new ThanksDto(r.Id, r.Team, r.Body, TripRules.ToMs(r.CreatedAt), r.UserId == c.Actor.Id)).ToList(), c.Confirmed && !c.Actor.IsSupervised);

    public async Task<WishesViewDto> WishesAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        return WishView(c, await store.ListWishesAsync(c.Booking.BookingId, ct));
    }

    public async Task<WishesViewDto> AddWishAsync(UserRecord actor, string? number, string celebrationId, WishRequest? body, CancellationToken ct)
    {
        // Any member may add, including a supervised child, so this reads as a member (not an adult) and checks the booking is confirmed itself.
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        if (!c.Confirmed) throw ApiException.Conflict("notConfirmed");
        var text = SeaRules.CleanWish(body?.Text) ?? throw ApiException.Invalid("badText");
        var celebrations = await store.ListCelebrationsAsync(c.Booking.BookingId, ct);
        if (celebrations.All(x => x.ClientId != celebrationId)) throw ApiException.NotFound();
        var rows = await store.ListWishesAsync(c.Booking.BookingId, ct);
        if (rows.Count(r => r.UserId == c.Actor.Id && r.CelebrationClientId == celebrationId) >= SeaRules.MaxWishesPerPersonPerCelebration) throw ApiException.Conflict("tooMany");
        var author = c.PersonByUser(c.Actor.Id)?.First is { Length: > 0 } first ? first : "Guest";
        var row = new WishRow { Id = Guid.NewGuid(), UserId = c.Actor.Id, CelebrationClientId = celebrationId, Author = SeaRules.Clean(author, 60) ?? "Guest", Body = text, CreatedAt = c.Now };
        await store.AddWishAsync(c.Booking.BookingId, row, ct);
        rows.Add(row);
        return WishView(c, rows);
    }

    private static WishesViewDto WishView(Scope c, IEnumerable<WishRow> rows) =>
        new(rows.Select(r => new WishDto(r.Id, r.CelebrationClientId, r.Author, r.Body, TripRules.ToMs(r.CreatedAt), r.UserId == c.Actor.Id)).ToList(), c.Confirmed);
}
