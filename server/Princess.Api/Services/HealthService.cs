using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Health on board (SAF-03): Medical Center hours, reporting illness early, and requests for seasickness help, medicine and device power. Ports <c>health</c> of <c>src/api/extrasMock.ts</c>.
/// A report is the reporter's own and is listed only to them (it never shows in the shared account history, SEC-07), but anyone's report makes the whole booking isolating for meals; requests belong to the booking.
/// </summary>
public sealed class HealthService(ScopeLoader scopes, IShipboardStore store)
{
    private async Task<HealthViewDto> ViewAsync(Scope c, CancellationToken ct)
    {
        var aboard = Shipboard.IsAboard(c);
        var day = aboard && Itinerary.PortAt(c.Departure, c.Now).Port != "sea" ? "port" : "sea";
        var time = Shipboard.ShipTime(c);
        var scenarios = await scopes.ScenariosAsync(c.Actor, ct);
        var all = await store.ListHealthReportsAsync(c.Booking.BookingId, ct);
        var mine = all.Where(r => r.ByUserId == c.Actor.Id).OrderByDescending(r => r.At);
        var requests = (await store.ListHealthRequestsAsync(c.Booking.BookingId, ct)).OrderByDescending(r => r.At);
        return new HealthViewDto(
            day, HealthRules.MedicalOpen(day, time), HealthRules.NextOpening(day, time), scenarios.Contains("illness"), HealthRules.Isolating(all.Select(r => r.At), c.Now),
            [.. mine.Select(r => new HealthReportDto(r.PublicId, Shipboard.Ms(r.At), c.Ids(r.GuestUserIds), r.Symptoms, r.StartedHoursAgo))],
            [.. requests.Select(r => new HealthRequestDto(r.PublicId, Shipboard.Ms(r.At), r.Kind, r.Note))],
            [.. c.Party.Select(p => new GuestDto(p.Id, p.Name))]);
    }

    public async Task<HealthViewDto> ViewAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<HealthViewDto> ReportAsync(UserRecord actor, string? number, HealthReportRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        var people = (body?.Guests ?? []).Distinct().Select(c.PersonById).ToList();
        if (people.Any(p => p is null)) throw ApiException.Forbidden("notOnBooking");
        if (HealthRules.ReportProblem(people.Count, body?.Symptoms, body?.StartedHoursAgo) is { } problem) throw ApiException.Invalid(problem);
        await store.AddHealthReportAsync(c.Booking.BookingId, actor.Id, [.. people.Select(p => p!.UserId)], [.. body!.Symptoms!.Distinct()], body.StartedHoursAgo!.Value, c.Now, ct);
        return await ViewAsync(c, ct);
    }

    public async Task<HealthViewDto> RequestAsync(UserRecord actor, string? number, HealthRequestRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        if (body?.Kind is null || !HealthRules.RequestKinds.Contains(body.Kind)) throw ApiException.Invalid("badKind");
        if ((body.Note ?? "").Length > HealthRules.NoteMax) throw ApiException.Invalid("badNote");
        await store.AddHealthRequestAsync(c.Booking.BookingId, body.Kind, (body.Note ?? "").Trim(), c.Now, ct);
        return await ViewAsync(c, ct);
    }
}
