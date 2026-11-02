using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Who is signed in, who is on their trip, which sailing they are on and what time it is, in one call, so a device holds none of it.
/// A real account's sailing is its current trip; a demo account's is the one saved in its demo controls (else its trip). The time is the
/// server's, moved by the demo clock for a demo account.
/// </summary>
public sealed class ContextService(ICurrentUser me, ITripStore trips, IAccountStore accounts, IDemoStore demo, IUserClock clock)
{
    public async Task<ContextDto> GetAsync(CancellationToken ct)
    {
        var user = await me.LoadAsync(ct);
        var now = await clock.NowAsync(user, ct);
        var today = TripRules.Today(now);

        var all = await trips.ListForUserAsync(user.Id, ct);
        var current = all
            .Where(b => b.Status == "confirmed" && b.Kind != "agent" && DateOnly.FromDateTime(b.Departure).AddDays(b.Nights) >= today)
            .OrderBy(b => b.Departure)
            .FirstOrDefault();

        var party = current is null ? [] : await accounts.GetPartyAsync(current.BookingId, ct);
        var bookerId = current is null ? (Guid?)null : party.FirstOrDefault(g => g.UserId == current.BookerUserId)?.PublicId;
        var members = party.Select(g => Person(g, bookerId ?? g.PublicId, today)).ToList();
        var self = members.FirstOrDefault(m => m.Id == user.PublicId) ?? new PersonDto(
            user.PublicId, Name(user.FirstName, user.LastName), user.FirstName ?? "", null, user.IsSupervised, user.BookerPublicId ?? user.PublicId, user.Tier);

        string? sailing = current?.SailingId, zone = null;
        if (user.IsDemo)
        {
            var d = await demo.GetStateAsync(user.Id, ct);
            sailing = d.SailingId ?? sailing;
            zone = d.PhoneZone;
        }

        var booking = current is null ? null : new ContextBookingDto(current.Number, current.SailingId, current.FareId == "standard" ? "none" : current.FareId, current.CategoryId);
        return new ContextDto(self, members, booking, sailing, zone, new DateTimeOffset(DateTime.SpecifyKind(now, DateTimeKind.Utc)).ToUnixTimeMilliseconds(), user.IsDemo);
    }

    private static string Name(string? first, string? last) => $"{first} {last}".Trim();

    private static PersonDto Person(GuestRow g, Guid booker, DateOnly today)
    {
        var age = today.Year - g.Dob.Year - (DateOnly.FromDateTime(g.Dob).AddYears(today.Year - g.Dob.Year) > today ? 1 : 0);
        return new PersonDto(g.PublicId, Name(g.FirstName, g.LastName), g.FirstName, age, g.IsSupervised || age < 18, booker, g.Tier);
    }
}
