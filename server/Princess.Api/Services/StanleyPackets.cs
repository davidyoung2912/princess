using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>The active voyage choice for a request, and the data the read tools may touch (null when there is no voyage to speak about).</summary>
public sealed record StanleyPacketResult(StanleyVoyageChoice.Choice Choice, StanleyReadData? Data);

/// <summary>Builds the context packet and the tool data for one request, so the gateway can be tested without the stores.</summary>
public interface IStanleyPackets
{
    Task<StanleyPacketResult> BuildAsync(UserRecord user, StanleyContext context, CancellationToken ct);
}

/// <summary>
/// Builds <see cref="StanleyPacket"/> and <see cref="StanleyReadData"/> from the stores (docs/stanley-gap-analysis-and-plan.md, phase 4). The voyage is the one the device named, or the only one the guest has; with two
/// possible and none named, nothing is chosen and Stanley asks. The access to each traveller is worked out here from the booking, the supervised flag and who booked, never from the request. Only data from the active
/// voyage is loaded, and only for travellers the guest may read at all.
/// </summary>
public sealed class StanleyPacketBuilder(ITripStore trips, IAccountStore accounts, IPlanStore plan, IFinishStore finish, IUserClock clock, Microsoft.Extensions.Options.IOptions<StanleyOptions> options) : IStanleyPackets
{
    public async Task<StanleyPacketResult> BuildAsync(UserRecord user, StanleyContext context, CancellationToken ct)
    {
        var now = await clock.NowAsync(user, ct);
        var today = DateOnly.FromDateTime(now);
        var bookings = (await trips.ListForUserAsync(user.Id, ct)).Where(b => b.Status == "confirmed" && DateOnly.FromDateTime(b.Departure).AddDays(b.Nights) >= today)
            .OrderBy(b => b.Departure).GroupBy(b => b.SailingId).Select(g => g.First()).ToList();
        var candidates = bookings.Select(b => new StanleyVoyage(b.SailingId, DateOnly.FromDateTime(b.Departure), b.ShipName, b.Nights)).ToList();
        var choice = StanleyVoyageChoice.Pick(candidates, context.SailingId);
        if (choice.Chosen is not { } voyage) return new StanleyPacketResult(choice, null);

        var booking = bookings.First(b => b.SailingId == voyage.SailingId);
        var party = await accounts.GetPartyAsync(booking.BookingId, ct);
        var actorOnBooking = booking.BookerUserId == user.Id || party.Any(g => g.UserId == user.Id);
        var travellers = new List<StanleyTraveller>();
        var refs = new Dictionary<long, string>();
        foreach (var (g, i) in party.OrderBy(g => g.Seq).Select((g, i) => (g, i)))
        {
            var dob = DateOnly.FromDateTime(g.Dob);
            var age = today.Year - dob.Year - (today < dob.AddYears(today.Year - dob.Year) ? 1 : 0);
            var access = StanleyPermissions.AccessFor(new AccessFacts(g.UserId == user.Id, user.IsSupervised, booking.BookerUserId == user.Id, g.IsSupervised, g.BookerUserId == user.Id, actorOnBooking, false, false));
            var tref = "t" + (i + 1);
            refs[g.UserId] = tref;
            travellers.Add(new StanleyTraveller(tref, g.FirstName, age, g.IsSupervised, g.UserId == user.Id, access));
        }
        // Only travellers the guest may read for something are kept at all. A traveller the guest may not read is not in the packet, so the model never sees a name or a reference for them.
        travellers = [.. travellers.Where(t => t.Access != TravellerAccess.None)];

        var packet = new StanleyPacket(StanleyPacket.RefFor(user.PublicId, options.Value.PacketKey), user.Role, voyage, context.Stage, context.Screen,
            ["trip", "party first names and ages", "tours", "dinners", "packages", "cases (stage only)", "published schedule"], StanleyReadTools.Names, travellers, user.IsSupervised);

        List<string> Who(IEnumerable<long> ids) => [.. ids.Where(refs.ContainsKey).Select(id => refs[id])];
        var tours = (await plan.ListToursAsync(booking.BookingId, ct)).Where(x => x.Status == "booked").Select(x => new StanleyTourFact(x.ExcursionId, x.Day, Who(x.GuestIds))).ToList();
        var meals = (await plan.ListTablesAsync(booking.BookingId, ct)).Select(x => new StanleyMealFact(x.VenueId, x.Day, x.Time, Who(x.GuestIds))).ToList();
        var packages = (await plan.ListPurchasesAsync(booking.BookingId, ct)).Where(x => x.Status == "active").Select(x => new StanleyPackageFact(x.ItemId, x.Units, Who(x.GuestIds))).ToList();
        var cases = (await finish.ListCasesAsync(booking.BookingId, ct)).Where(c => refs.ContainsKey(c.UserId)).Select(c =>
        {
            var s = CaseService.StatusOf(c, now);
            return new StanleyCaseFact(refs[c.UserId], c.Kind, c.Number, s.Stage, s.Outcome, s.DueAt);
        }).ToList();
        return new StanleyPacketResult(choice, new StanleyReadData(packet, now, tours, meals, packages, cases));
    }
}
