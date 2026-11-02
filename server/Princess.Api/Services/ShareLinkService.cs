using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Read-only links for someone at home (caregiver) or a travel advisor (next-level plan N4.6). The guest makes them, sees them listed and can end one at any moment;
/// ending a link, or withdrawing the status switch, stops access at once. The view never holds a position, a medical detail or an amount of money other than "paid in full".
/// </summary>
public sealed class ShareLinkService(IShareStore store, AccessService access, ITripStore trips, ICheckinStore checkin, IAccountStore accounts, IStateStore state, IUserStore users, IUserClock clock, IClock wall)
{
    public static string PathFor(string token) => $"/shared/{token}";

    private static ShareLinkDto ToDto(ShareLinkRow r, string? path = null) =>
        new(r.PublicId, r.Kind, r.Label, TripRules.ToMs(r.CreatedAt), TripRules.ToMs(r.ExpiresAt), r.LastCheckInAt is { } at ? TripRules.ToMs(at) : null, r.Note, path);

    public async Task<List<ShareLinkDto>> ListAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var m = await access.RequireAdultMemberAsync(actor, number, ct);
        return [.. (await store.ListAsync(m.BookingId, actor.Id, ct)).Select(r => ToDto(r))];
    }

    /// <summary>Makes a link. The address comes back once; only its hash is kept.</summary>
    public async Task<ShareLinkDto> CreateAsync(UserRecord actor, string? number, ShareLinkRequest? body, CancellationToken ct)
    {
        var m = await access.RequireAdultMemberAsync(actor, number, ct);
        var existing = await store.ListAsync(m.BookingId, actor.Id, ct);
        if (PartyRules.LinkProblem(body?.Kind, body?.Label, m.BookerUserId == actor.Id, existing.Count) is { } problem)
            throw problem is "bookerOnly" ? ApiException.Forbidden(problem) : problem is "tooManyLinks" ? ApiException.Conflict(problem) : ApiException.Invalid(problem);
        var now = await clock.NowAsync(actor, ct);
        var token = CalendarRules.NewToken();
        var row = new ShareLinkRow(0, Guid.NewGuid(), m.BookingId, actor.Id, body!.Kind!, PartyRules.CleanLabel(body.Label)!, now, now.AddDays(PartyRules.LinkDays), null, "");
        await store.AddAsync(row, CalendarRules.Hash(token), ct);
        return ToDto(row, PathFor(token));
    }

    public async Task RevokeAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var m = await access.RequireAdultMemberAsync(actor, number, ct);
        if (!await store.RevokeAsync(m.BookingId, actor.Id, id, ct)) throw ApiException.NotFound();
    }

    /// <summary>The guest's "I'm fine", with a short note, for the person at home to read.</summary>
    public async Task<ShareLinkDto> CheckInAsync(UserRecord actor, string? number, Guid id, ShareCheckInRequest? body, CancellationToken ct)
    {
        var m = await access.RequireAdultMemberAsync(actor, number, ct);
        var now = await clock.NowAsync(actor, ct);
        if (!await store.SaveCheckInAsync(m.BookingId, actor.Id, id, PartyRules.CleanNote(body?.Note), now, ct)) throw ApiException.NotFound();
        return ToDto((await store.ListAsync(m.BookingId, actor.Id, ct)).First(r => r.PublicId == id));
    }

    /// <summary>What the link shows, or null when it is not (or no longer) a link. No sign-in: the address is the secret.</summary>
    public async Task<SharedViewDto?> ViewAsync(string? token, CancellationToken ct)
    {
        if (!CalendarRules.PlausibleToken(token)) return null;
        if (await store.FindAsync(CalendarRules.Hash(token!), ct) is not { } link || !PartyRules.Live(link.ExpiresAt, wall.UtcNow)) return null;
        if (await users.FindByIdAsync(link.UserId, ct) is not { } user || await trips.GetAsync(link.BookingId, ct) is not { } booking) return null;
        var party = await accounts.GetPartyAsync(link.BookingId, ct);
        var me = party.FirstOrDefault(g => g.UserId == link.UserId);
        if (me is null) return null;   // the guest is no longer on the booking
        var now = await clock.NowAsync(user, ct);
        var days = TripRules.DaysBetween(TripRules.Today(now), DateOnly.FromDateTime(booking.Departure));
        var steps = (await checkin.ListStepsAsync(link.BookingId, ct)).GroupBy(s => s.UserId).ToDictionary(g => g.Key, g => g.Select(s => s.Step).Count(CheckinRules.IsGuestStep));
        // The advisor sees only the people whose status the link's owner may see: themself, their supervised children and anyone who shares it.
        var done = 0;
        var total = 0;
        foreach (var g in party)
        {
            var sharing = await state.GetAsync(false, g.UserId, "sharing", ct) is { } row ? System.Text.Json.Nodes.JsonNode.Parse(row.Json) : null;
            if (!PartyRules.MayViewStatus(link.UserId, g.UserId, g.IsSupervised, g.BookerUserId, sharing)) continue;
            done += steps.TryGetValue(g.UserId, out var n) ? n : 0;
            total += CheckinRules.GuestSteps.Length;
        }
        var paid = booking.PaidCents >= booking.TotalCents;

        return link.Kind == "caregiver"
            ? new SharedViewDto(link.Kind, link.Label, me.FirstName, booking.ShipName, TripRules.ToMs(booking.Departure), booking.Nights, days,
                link.LastCheckInAt is { } at ? TripRules.ToMs(at) : null, link.Note, booking.CheckinFinishedAt is not null, null, null, null)
            : new SharedViewDto(link.Kind, link.Label, me.FirstName, booking.ShipName, TripRules.ToMs(booking.Departure), booking.Nights, days,
                null, "", null, paid, new CheckinShareDto(done, total), party.Count);
    }
}
