using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Finding the family and the children's clubs (SAF-05, ENT-04). Ports <c>family</c> of <c>src/api/extrasMock.ts</c>. Any guest reads; an adult guest sets places, pick-up and the meeting point and checks a child in;
/// the child, or an adult the parent listed, checks out. A child's place comes from the club check-in or the simulated band (<c>FamilyRules.LastSeen</c>).
/// </summary>
public sealed class FamilyService(ScopeLoader scopes, IShipboardStore store)
{
    private static bool IsKid(ScopePerson p) => p.Age < 18;

    private async Task<FamilyViewDto> ViewAsync(Scope c, CancellationToken ct)
    {
        var now = Shipboard.Ms(c.Now);
        var time = Shipboard.ShipTime(c);
        var scenarios = await scopes.ScenariosAsync(c.Actor, ct);
        var kids = c.Party.Where(IsKid).ToList();
        var adults = c.Party.Where(p => !IsKid(p)).ToList();
        var adultIds = adults.Select(a => a.Id).ToList();
        var youngest = kids.Count == 0 ? null : kids.Aggregate((best, g) => g.Age < best.Age ? g : best);
        var zones = (await store.ListFamilyZonesAsync(c.Booking.BookingId, ct)).ToDictionary(z => z.ChildUserId);
        var open = (await store.ListOpenCheckinsAsync([.. kids.Select(k => k.UserId)], ct)).ToDictionary(x => x.ChildUserId);
        var me = c.PersonByUser(c.Actor.Id);

        var ship = AboardPlans.ShipOfSailing(c.Booking.SailingId);
        var list = new List<FamilyKidDto>();
        foreach (var g in kids)
        {
            var club = FamilyRules.ClubFor(g.Age);
            InClubDto? inClub = open.TryGetValue(g.UserId, out var o) && FamilyRules.ClubById(o.ClubId) is { } oc ? new InClubDto(oc.Id, Shipboard.Ms(o.InAt)) : null;
            zones.TryGetValue(g.UserId, out var z);
            var allowed = FamilyRules.ZonesOf(z?.ZoneIds) is { Count: > 0 } stored ? stored : FamilyRules.DefaultZones(g.Age, ship);
            var auth = FamilyRules.NormalizeAuth(z?.Auth, adultIds);
            var seen = FamilyRules.LastSeen(g.Id.ToString(), g.Age, now, inClub is null ? null : (inClub.ClubId, inClub.At), scenarios.Contains("childMissing") && youngest is not null && g.Id == youngest.Id && inClub is null, ship);
            var self = me is not null && me.Id == g.Id && auth.SignOutAlone && club?.AloneFrom is { } from && g.Age >= from;
            list.Add(new FamilyKidDto(
                g.Id, g.Name, g.Age, club is null ? null : new KidClubDto(club.Id, club.Name, FamilyRules.ClubOpen(club, time), club.Opens, club.Closes),
                inClub, seen, FamilyRules.KidStatus(seen, allowed, now), allowed, auth, inClub is not null && ((me is not null && auth.Pickup.Contains(me.Id)) || self)));
        }
        var reunion = await store.GetReunionAsync(c.Booking.BookingId, ct);
        var log = (await store.ListFamilyLogAsync(c.Booking.BookingId, 10, ct)).Select(l => new FamilyLogDto(l.PublicId, Shipboard.Ms(l.At), l.Text)).ToList();
        return new FamilyViewDto(
            list, [.. adults.Select(a => new GuestDto(a.Id, a.Name))], FamilyRules.NormalizeReunion(reunion?.PlaceId, reunion?.BackupId, reunion?.Note), log, !c.Actor.IsSupervised);
    }

    private static ScopePerson KidOf(Scope c, Guid id) => c.PersonById(id) is { } p && IsKid(p) ? p : throw ApiException.Forbidden("notYourChild");

    public async Task<FamilyViewDto> ViewAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<FamilyViewDto> SetZonesAsync(UserRecord actor, string? number, Guid child, SetZonesRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var kid = KidOf(c, child);
        if (FamilyRules.ZonesProblem(body?.Zones, AboardPlans.ShipOfSailing(c.Booking.SailingId)) is { } problem) throw ApiException.Invalid(problem);
        await store.SaveZonesAsync(c.Booking.BookingId, kid.UserId, System.Text.Json.JsonSerializer.Serialize(body!.Zones!.Distinct()), ct);
        return await ViewAsync(c, ct);
    }

    public async Task<FamilyViewDto> SetAuthAsync(UserRecord actor, string? number, Guid child, SetAuthRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var kid = KidOf(c, child);
        var club = FamilyRules.ClubFor(kid.Age);
        var adultIds = c.Party.Where(p => !IsKid(p)).Select(p => p.Id).ToList();
        var pickup = (body?.Pickup ?? []).Where(adultIds.Contains).Distinct().ToList();
        if (pickup.Count == 0) throw ApiException.Invalid("noPickup");
        if (body!.SignOutAlone && (club?.AloneFrom is not { } from || kid.Age < from)) throw ApiException.Invalid("tooYoungAlone");
        await store.SaveAuthAsync(c.Booking.BookingId, kid.UserId, FamilyRules.AuthJson(new Authorisation(pickup, body.SignOutAlone, body.Photos)), ct);
        return await ViewAsync(c, ct);
    }

    public async Task<FamilyViewDto> CheckInAsync(UserRecord actor, string? number, Guid child, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        var kid = KidOf(c, child);
        var club = FamilyRules.ClubFor(kid.Age) ?? throw ApiException.Invalid("tooYoung");
        var already = (await store.ListOpenCheckinsAsync([kid.UserId], ct)).Count > 0;
        if (FamilyRules.CheckInProblem(club, kid.Age, Shipboard.ShipTime(c), already) is { } problem) throw ApiException.Invalid(problem);
        await store.ClubCheckInAsync(c.Booking.BookingId, kid.UserId, club.Id, c.Now, actor.Id, $"{kid.First} checked in to {club.Name} (by {actor.FirstName})", ct);
        return await ViewAsync(c, ct);
    }

    public async Task<FamilyViewDto> CheckOutAsync(UserRecord actor, string? number, Guid child, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        var kid = KidOf(c, child);
        var view = (await ViewAsync(c, ct)).Kids.First(k => k.Id == kid.Id);
        if (view.InClub is null) throw ApiException.Conflict("notIn");
        if (!view.CanCheckOut) throw ApiException.Forbidden("notAuthorised");
        await store.ClubCheckOutAsync(c.Booking.BookingId, kid.UserId, c.Now, actor.Id, $"{kid.First} checked out of {FamilyRules.ClubById(view.InClub.ClubId)!.Name} (by {actor.FirstName})", ct);
        return await ViewAsync(c, ct);
    }

    public async Task<FamilyViewDto> SetReunionAsync(UserRecord actor, string? number, SetReunionRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (FamilyRules.MeetingProblem(body?.PlaceId, body?.BackupId) is { } problem) throw ApiException.Invalid(problem);
        var plan = FamilyRules.NormalizeReunion(body!.PlaceId, body.BackupId, body.Note);
        await store.SaveReunionAsync(c.Booking.BookingId, plan.PlaceId, plan.BackupId, plan.Note, ct);
        return await ViewAsync(c, ct);
    }
}
