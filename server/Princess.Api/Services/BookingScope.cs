using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public sealed record ScopePerson(Guid Id, long UserId, string Name, int Age, bool Child, string Tier, string First, string Last, long? BookerUserId);

/// <summary>One booking as the person asking may see it: who is on it, how old they are on the sailing date, and what "now" is for them.</summary>
public sealed class Scope
{
    public UserRecord Actor { get; init; } = null!;
    public BookingRow Booking { get; init; } = null!;
    public DateTime Now { get; init; }
    public DateOnly Today { get; init; }
    public DateOnly Departure { get; init; }
    public int Days { get; init; }
    public List<ScopePerson> Party { get; init; } = [];

    public ScopePerson? PersonByUser(long userId) => Party.FirstOrDefault(p => p.UserId == userId);
    public ScopePerson? PersonById(Guid id) => Party.FirstOrDefault(p => p.Id == id);
    public List<Guid> Ids(IEnumerable<long> userIds) => [.. userIds.Select(PersonByUser).OfType<ScopePerson>().Select(p => p.Id)];
    public List<Contracts.GuestDto> Named(IEnumerable<long> userIds) => [.. userIds.Select(PersonByUser).OfType<ScopePerson>().Select(p => new Contracts.GuestDto(p.Id, p.Name))];

    /// <summary>The people named, all of whom must be on the booking. Nobody, a stranger or a repeat is invalid.</summary>
    public List<ScopePerson> GuestsIn(IReadOnlyCollection<Guid>? raw)
    {
        var people = (raw ?? []).Distinct().Select(PersonById).ToList();
        if (people.Count == 0 || people.Any(p => p is null)) throw ApiException.Invalid("guests");
        return people!;
    }

    public bool Confirmed => Booking.Status == "confirmed";
}


/// <summary>Loads a <see cref="Scope"/> after the access check: any guest to read, an adult guest to write (data model section 7). A stranger gets the same <c>notFound</c> as a missing booking.</summary>
public sealed class ScopeLoader(AccessService access, ITripStore trips, IAccountStore accounts, IUserClock clock)
{
    private static DateOnly D(DateTime d) => DateOnly.FromDateTime(d);

    public async Task<Scope> LoadAsync(UserRecord actor, string? number, bool write, CancellationToken ct)
    {
        var m = write ? await access.RequireAdultMemberAsync(actor, number, ct) : await access.RequireMemberAsync(actor, number, ct);
        var booking = await trips.GetAsync(m.BookingId, ct) ?? throw ApiException.NotFound();
        var now = await clock.NowAsync(actor, ct);
        var departure = D(booking.Departure);
        var today = TripRules.Today(now);
        var party = (await accounts.GetPartyAsync(m.BookingId, ct))
            .Select(g => new ScopePerson(g.PublicId, g.UserId, AccountService.FullName(g), AccountRules.AgeOn(D(g.Dob), departure), g.IsSupervised, g.Tier, g.FirstName, g.LastName, g.BookerUserId)).ToList();
        return new Scope { Actor = actor, Booking = booking, Now = now, Today = today, Departure = departure, Days = TripRules.DaysBetween(today, departure), Party = party };
    }
}
