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
public sealed class ContextService(ICurrentUser me, ITripStore trips, IAccountStore accounts, IDemoStore demo, IUserClock clock, IInboxStore inbox, IBookingStore bookings)
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

        var stage = await StageAsync(user, all, current, sailing, now, today, ct);
        var booking = current is null ? null : new ContextBookingDto(current.Number, current.SailingId, current.FareId == "standard" ? "none" : current.FareId, current.CategoryId);
        return new ContextDto(self, members, booking, sailing, zone, new DateTimeOffset(DateTime.SpecifyKind(now, DateTimeKind.Utc)).ToUnixTimeMilliseconds(), user.IsDemo,
            stage.Stage, stage.FocusSailingId, stage.Reason);
    }

    /// <summary>
    /// The guest's journey stage (docs/stage-experience-plan.md section 3). The trip is the next one to sail, else one that ended in the last ten days.
    /// An agent booking counts. A demo account that chose another sailing is placed on that sailing's dates, so the testing date still drives the stage.
    /// </summary>
    private async Task<StageResult> StageAsync(UserRecord user, List<BookingRow> all, BookingRow? current, string? sailing, DateTime now, DateOnly today, CancellationToken ct)
    {
        var sailings = (await trips.ListSailingsAsync(ct)).ToDictionary(s => s.Id);
        var confirmed = all.Where(b => b.Status == "confirmed").ToList();
        DateOnly End(BookingRow b) => DateOnly.FromDateTime(b.Departure).AddDays(b.Nights);
        var trip = confirmed.Where(b => End(b) >= today).OrderBy(b => b.Departure).FirstOrDefault()
            ?? confirmed.Where(b => End(b).AddDays(StageRules.RememberDays) >= today).OrderByDescending(b => b.Departure).FirstOrDefault();

        StageTrip? stageTrip = null;
        if (trip is not null)
        {
            var id = current is not null && trip.BookingId == current.BookingId && sailing is not null ? sailing : trip.SailingId;
            var departure = sailings.TryGetValue(id, out var row) ? row.Departure : trip.Departure;
            stageTrip = new StageTrip(id, DateOnly.FromDateTime(departure), trip.PaidCents >= trip.TotalCents, trip.CheckinFinishedAt is not null);
        }

        bool Ahead(string id) => sailings.TryGetValue(id, out var s) && DateOnly.FromDateTime(s.Departure) >= today;
        var saved = (await inbox.ListFavouritesAsync(user.Id, ct)).Where(k => k.StartsWith("sailing:", StringComparison.Ordinal)).Select(k => k["sailing:".Length..]).Where(Ahead).ToList();
        var intents = (await inbox.ListJourneyEventsAsync(user.Id, 20, ct)).Select(e => new JourneyIntent(e.Kind, e.SailingId, e.At)).ToList();
        var draftSailing = (await bookings.GetDraftAsync(user.Id, ct))?.SailingId;
        var cancelled = all.Where(b => b.Status == "cancelled" && Ahead(b.SailingId)).OrderByDescending(b => b.Departure).FirstOrDefault()?.SailingId;

        return StageRules.Derive(new StageInput(now, saved, intents, draftSailing is not null && Ahead(draftSailing) ? draftSailing : null, cancelled, stageTrip));
    }

    private static string Name(string? first, string? last) => $"{first} {last}".Trim();

    private static PersonDto Person(GuestRow g, Guid booker, DateOnly today)
    {
        var age = today.Year - g.Dob.Year - (DateOnly.FromDateTime(g.Dob).AddYears(today.Year - g.Dob.Year) > today ? 1 : 0);
        return new PersonDto(g.PublicId, Name(g.FirstName, g.LastName), g.FirstName, age, g.IsSupervised || age < 18, booker, g.Tier);
    }
}
