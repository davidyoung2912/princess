using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The six Explorer pages (dining, entertainment, shopping, spa, exercise, activities): each venue of the guest's ship with its hours, events and menus for a chosen day, and the events the guest
/// has put in their plan. Any guest on the booking reads. The content is simulated behind <see cref="ExplorerCatalogue"/>, so a real source can replace it with no app change.
/// </summary>
public sealed class ExplorerService(ScopeLoader scopes, IOnboardStore store, IProgramChanges programChanges)
{
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");

    private async Task<(Scope Scope, string ShipId, ShipExplorer Ship, bool Changes)> OpenAsync(UserRecord actor, string? number, string? kind, int day, CancellationToken ct)
    {
        if (!ExplorerCatalogue.ValidKind(kind)) throw ApiException.NotFound("explorer");
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        if (day < 1 || day > Itinerary.MaxDay || day > c.Timeline.Days.Count) throw ApiException.Invalid("day");
        var shipId = AboardPlans.ShipOfSailing(c.Booking.SailingId);
        return (c, shipId, ExplorerCatalogue.Of(shipId), (await scopes.ScenariosAsync(actor, ct)).Contains("planChange"));
    }

    /// <summary>Every venue of one Explorer with its hours and its events for a day (menus come with a venue's own page), and the guest's plan for the day.</summary>
    public async Task<ExplorerDayDto> DayAsync(UserRecord actor, string? number, string? kind, int day, CancellationToken ct)
    {
        var (c, shipId, ship, changes) = await OpenAsync(actor, number, kind, day, ct);
        var venues = ship.Venues.Where(v => v.Explorer == kind).OrderBy(v => v.Order).ToList();
        var ids = venues.Select(v => v.Id).ToHashSet();
        var events = ExplorerRules.EventsOn(ship, c.Timeline, day, changes, programChanges.Current(), ids.Contains);
        var mine = await MineAsync(c, day, events, ct);
        var current = FolioRules.CruiseDay(c.Timeline, c.Now);
        var x = c.Timeline.Days[day - 1];
        var sail = ExplorerRules.SailawayTime(c.Timeline, day);
        long? sailAt = sail is null ? null : TripRules.ToMs(Itinerary.LocalToUtc(x.Date, TimeOnly.ParseExact(sail, "HH:mm"), c.Timeline.ShipZoneOnDate(x.Date)));
        return new ExplorerDayDto(
            kind!, shipId, day, current >= 1 && current <= c.Timeline.Days.Count ? current : null, Iso(x.Date), x.Port, c.Timeline.ShipZoneOnDate(x.Date), sailAt,
            [.. venues.Select(v => ExplorerRules.VenueDay(shipId, ship, v, c.Timeline, day, events, withMenus: false))], mine);
    }

    /// <summary>One venue with its hours, all its events and its menus for a day.</summary>
    public async Task<VenueDayDto> VenueAsync(UserRecord actor, string? number, string? kind, string? venueId, int day, CancellationToken ct)
    {
        var (c, shipId, ship, changes) = await OpenAsync(actor, number, kind, day, ct);
        var venue = ship.Venues.FirstOrDefault(v => v.Explorer == kind && v.Id == venueId) ?? throw ApiException.NotFound("venue");
        var events = ExplorerRules.EventsOn(ship, c.Timeline, day, changes, programChanges.Current(), id => id == venue.Id);
        return ExplorerRules.VenueDay(shipId, ship, venue, c.Timeline, day, events, withMenus: true);
    }

    private async Task<List<string>> MineAsync(Scope c, int day, List<ExplorerEventDto> events, CancellationToken ct)
    {
        var planned = (await store.ListPlanAsync(c.Actor.Id, c.Booking.SailingId, ct)).Where(r => r.Day == day).Select(r => r.EventId).ToHashSet();
        return [.. events.Select(e => e.Id).Where(planned.Contains)];
    }
}
