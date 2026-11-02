using System.Text.Json.Nodes;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The party's shared view (next-level plan N4.1, N4.5): the organiser dashboard, what each person has chosen to share, and the log of changes to the shared plan.
/// Every person's switches are kept in their own <c>sharing</c> document; a person's status reaches the others only when that person turned it on.
/// </summary>
public sealed class PartyService(AccessService access, IAccountStore accounts, ITripStore trips, ICheckinStore checkin, IStateStore state, IPortRowStore portRows, IUserClock clock)
{
    private async Task<JsonNode?> SharingOfAsync(long userId, CancellationToken ct) =>
        await state.GetAsync(false, userId, "sharing", ct) is { } row ? JsonNode.Parse(row.Json) : null;

    public async Task<OrganiserDto> OrganiserAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var m = await access.RequireAdultMemberAsync(actor, number, ct);
        var booking = await trips.GetAsync(m.BookingId, ct) ?? throw ApiException.NotFound();
        var now = await clock.NowAsync(actor, ct);
        var departure = DateOnly.FromDateTime(booking.Departure);
        var steps = (await checkin.ListStepsAsync(m.BookingId, ct)).GroupBy(s => s.UserId).ToDictionary(g => g.Key, g => g.Select(s => s.Step).ToHashSet());
        var isBooker = m.BookerUserId == actor.Id;

        var guests = new List<OrganiserGuestDto>();
        foreach (var g in await accounts.GetPartyAsync(m.BookingId, ct))
        {
            var sharing = await SharingOfAsync(g.UserId, ct);
            var shares = PartyRules.Shares(sharing, "status");
            var may = PartyRules.MayViewStatus(actor.Id, g.UserId, g.IsSupervised, g.BookerUserId, sharing);
            var done = steps.TryGetValue(g.UserId, out var d) ? d.Count(CheckinRules.IsGuestStep) : 0;
            guests.Add(new(g.PublicId, AccountService.FullName(g), g.IsSupervised, g.UserId == actor.Id, shares,
                may ? new CheckinShareDto(done, CheckinRules.GuestSteps.Length) : null,
                may ? g.Held.Count : null));
        }

        var money = isBooker ? new OrganiserMoneyDto(booking.PaidCents, booking.TotalCents, booking.PaidCents >= booking.TotalCents, TripRules.ToMs(booking.FinalDueDate)) : null;
        return new(m.Number, booking.ShipName, TripRules.ToMs(booking.Departure), TripRules.DaysBetween(TripRules.Today(now), departure), isBooker, guests, money);
    }

    /// <summary>The newest changes to the shared plan (polls, ideas, meeting places, the ledger), for any guest on the booking.</summary>
    public async Task<List<PartyLogDto>> LogAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var m = await access.RequireMemberAsync(actor, number, ct);
        var rows = (await portRows.ListAsync(m.BookingId, ct)).Select(r => (r.Kind, r.Json is null ? null : JsonNode.Parse(r.Json), r.At, r.Deleted));
        return [.. PartyRules.Log(rows).Select(e => new PartyLogDto(e.Kind, e.Label, e.At, e.Deleted))];
    }
}
