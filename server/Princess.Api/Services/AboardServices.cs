using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>Spa, fitness, shop and gift orders and the things to join (ENT-03, SHP-01, SHP-04, SHP-06, ACS-04). Ports <c>selections</c> of <c>src/api/aboardMock.ts</c>. An adult guest books; the charge goes on the account.</summary>
public sealed class SelectionService(ScopeLoader scopes, IAboardStore store)
{
    private static SelectionDto View(SelectionRow r) => new(r.PublicId, r.ItemId, r.Day, r.Time, r.Qty, Shipboard.Ms(r.At), r.TotalCents);

    private async Task<List<SelectionDto>> ListAsync(Scope c, CancellationToken ct) =>
        [.. (await store.ListSelectionsAsync(c.Booking.BookingId, ct)).Select(View).OrderBy(s => s.Day).ThenBy(s => s.Time, StringComparer.Ordinal).ThenBy(s => s.At)];

    public async Task<List<SelectionDto>> ListAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ListAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    private static bool Started(Scope c, CatalogueItem item, int day, string time)
    {
        if (day == 0) return false;
        var date = c.Timeline.Days[day - 1].Date;
        var start = Itinerary.LocalToUtc(date, TimeOnly.Parse(time.Length == 0 ? "23:59" : time), c.Timeline.ShipZoneOnDate(date));
        return item.Mode != "order" && c.Now >= start;
    }

    public async Task<List<SelectionDto>> AddAsync(UserRecord actor, string? number, SelectionRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireOpen(c);
        var ask = new SelectionAsk(body?.Item, body?.Day ?? 0, body?.Time ?? "", body?.Qty ?? 0);
        var item = CatalogueRules.ById(ask.Item);
        var problem = CatalogueRules.Problem(ask, Shipboard.AgeOf(c, actor), c.Timeline, item is null ? 0 : CatalogueRules.TakenByOthers(item, ask.Day, ask.Time ?? ""));
        if (problem == "soldOut") throw ApiException.Conflict("soldOut");
        if (problem is not null) throw ApiException.Invalid(problem);
        var time = ask.Time ?? "";
        if (Started(c, item!, ask.Day, time)) throw ApiException.Conflict("past");
        var existing = (await store.ListSelectionsAsync(c.Booking.BookingId, ct)).Any(r => r.ItemId == item!.Id && r.Day == ask.Day && r.Time == time);
        if (existing && item!.Mode != "order") throw ApiException.Conflict("duplicate");
        var left = CatalogueRules.PlacesLeft(item!, ask.Day, time, 0);
        if (left is { } l && ask.Qty > l) throw ApiException.Conflict("soldOut");
        var cents = CatalogueRules.ChargeFor(item!, ask.Qty);
        var row = new SelectionRow { ItemId = item!.Id, Day = ask.Day, Time = time, Qty = ask.Qty, TotalCents = cents, At = c.Now };
        var folio = cents <= 0 ? [] : new List<FolioWrite>
        {
            new(actor.Id, Shipboard.DayAt(c, c.Now), item.Group is "spa" or "fitness" ? "spa" : "shops", ask.Qty > 1 ? $"{ask.Qty} × {item.Title}" : item.Title, cents, null, c.Now),
        };
        await store.SaveSelectionAsync(c.Booking.BookingId, row, folio, ct);
        return await ListAsync(c, ct);
    }

    public async Task<List<SelectionDto>> RemoveAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (!await store.RemoveSelectionAsync(c.Booking.BookingId, id, ct)) throw ApiException.NotFound();
        return await ListAsync(c, ct);
    }
}

/// <summary>One-tap housekeeping and maintenance requests (MSG-03). Ports <c>requests</c> of <c>src/api/aboardMock.ts</c>. The stage is worked out from the clock; only a request still "received" can be cancelled.</summary>
public sealed class ServiceRequestService(ScopeLoader scopes, IAboardStore store)
{
    private static ServiceRequestDto View(ServiceRequestRow r, long now)
    {
        var item = ServiceRules.RequestItemById(r.ItemId)!;
        var placed = Shipboard.Ms(r.PlacedAt);
        var events = r.Events.Select(e => (e.Kind, Shipboard.Ms(e.At))).ToList();
        var s = ServiceRules.StateOf(placed, item.EtaMin, now, r.Stage == "cancelled", events);
        return new ServiceRequestDto(r.PublicId, r.ItemId, r.Qty, r.Note, placed, s.StartedAtMs + item.EtaMin * 60_000L, s.Stage, s.Stage == "received",
            ServiceRules.TeamFor(item.Group), s.Escalated, s.Confirmed, s.CanEscalate, s.CanConfirm, s.CanReopen, [.. events.Select(e => new RequestEventDto(e.Kind, e.Item2))]);
    }

    private async Task<List<ServiceRequestDto>> ListAsync(Scope c, CancellationToken ct) =>
        [.. (await store.ListRequestsAsync(c.Booking.BookingId, ct)).Where(r => ServiceRules.RequestItemById(r.ItemId) is not null).Select(r => View(r, Shipboard.Ms(c.Now))).OrderByDescending(r => r.PlacedAt)];

    public async Task<List<ServiceRequestDto>> ListAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ListAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<List<ServiceRequestDto>> CreateAsync(UserRecord actor, string? number, CreateServiceRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var item = ServiceRules.RequestItemById(body?.Item) ?? throw ApiException.Invalid("badItem");
        if (body!.Qty < 1 || body.Qty > item.MaxQty) throw ApiException.Invalid("badQuantity");
        var note = (body.Note ?? "").Trim();
        if (note.Length > 200) note = note[..200];
        Shipboard.RequireAboard(c);
        var open = (await ListAsync(c, ct)).Where(r => r.Stage is "received" or "onTheWay").ToList();
        if (open.Any(r => r.Item == item.Id)) throw ApiException.Conflict("duplicate");
        if (open.Count >= ServiceRules.MaxOpenRequests) throw ApiException.Conflict("tooMany");
        await store.AddRequestAsync(c.Booking.BookingId, new ServiceRequestRow { ItemId = item.Id, Qty = body.Qty, Note = note, PlacedAt = c.Now }, ct);
        return await ListAsync(c, ct);
    }

    public async Task<List<ServiceRequestDto>> CancelAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var row = (await ListAsync(c, ct)).FirstOrDefault(r => r.Id == id) ?? throw ApiException.NotFound();
        if (!row.CanCancel) throw ApiException.Conflict("tooLate");
        await store.CancelRequestAsync(c.Booking.BookingId, id, ct);
        return await ListAsync(c, ct);
    }

    /// <summary>Asks for a late request to be taken up by a supervisor (MNG-11).</summary>
    public Task<List<ServiceRequestDto>> EscalateAsync(UserRecord actor, string? number, Guid id, CancellationToken ct) =>
        RecordAsync(actor, number, id, "escalated", r => r.CanEscalate, "notYet", ct);

    /// <summary>The guest says it is fixed; the request closes (SEA-20).</summary>
    public Task<List<ServiceRequestDto>> ConfirmAsync(UserRecord actor, string? number, Guid id, CancellationToken ct) =>
        RecordAsync(actor, number, id, "confirmed", r => r.CanConfirm, "notDone", ct);

    /// <summary>The guest says it is not fixed; the request starts a new round and keeps its earlier history.</summary>
    public Task<List<ServiceRequestDto>> ReopenAsync(UserRecord actor, string? number, Guid id, CancellationToken ct) =>
        RecordAsync(actor, number, id, "reopened", r => r.CanReopen, "cannotReopen", ct);

    private async Task<List<ServiceRequestDto>> RecordAsync(UserRecord actor, string? number, Guid id, string kind, Func<ServiceRequestDto, bool> allowed, string refusal, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var row = (await ListAsync(c, ct)).FirstOrDefault(r => r.Id == id) ?? throw ApiException.NotFound();
        if (!allowed(row)) throw ApiException.Conflict(refusal);
        await store.AddRequestEventAsync(c.Booking.BookingId, id, kind, c.Now, ct);
        return await ListAsync(c, ct);
    }
}

/// <summary>Security and man-overboard reports (SAF-04). Ports <c>reports</c> of <c>src/api/aboardMock.ts</c>. Any guest aboard may report, a supervised child included; an urgent kind is never anonymous.</summary>
public sealed class SafetyReportService(ScopeLoader scopes, IAboardStore store)
{
    private async Task<List<SafetyReportDto>> ListAsync(Scope c, CancellationToken ct) =>
        [.. (await store.ListReportsAsync(c.Booking.BookingId, ct)).Select(r => new SafetyReportDto(r.PublicId, r.Kind, r.Place, r.Note, r.Anonymous, Shipboard.Ms(r.At), r.Reference)).OrderByDescending(r => r.At).ThenByDescending(r => r.Reference, StringComparer.Ordinal)];

    public async Task<List<SafetyReportDto>> ListAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ListAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<List<SafetyReportDto>> CreateAsync(UserRecord actor, string? number, CreateSafetyReport? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        if (ServiceRules.ReportProblem(body?.Kind, body?.Where, body?.Note) is { } problem) throw ApiException.Invalid(problem);
        Shipboard.RequireAboard(c);
        var count = (await store.ListReportsAsync(c.Booking.BookingId, ct)).Count;
        var row = new SafetyReportRow
        {
            Kind = body!.Kind!, Place = body.Where!.Trim(), Note = body.Note!.Trim(), Anonymous = body.Anonymous && !ServiceRules.UrgentReports.Contains(body.Kind!), Reference = $"SEC-{count + 1:000}", At = c.Now,
        };
        await store.AddReportAsync(c.Booking.BookingId, row, ct);
        return await ListAsync(c, ct);
    }
}

/// <summary>The drinks tracker (DIN-06): the person's own drinks today against their package cap. Ports <c>drinks</c> of <c>src/api/aboardMock.ts</c>. Any guest may log; a child cannot log alcohol.</summary>
public sealed class DrinkService(ScopeLoader scopes, IAboardStore store, PlanService plan)
{
    private async Task<DrinksViewDto> ViewAsync(Scope c, UserRecord actor, CancellationToken ct)
    {
        var day = Shipboard.DayAt(c, c.Now);
        var logs = (await store.ListDrinksAsync(actor.Id, c.Now.AddDays(-2), ct)).Where(l => Shipboard.DayAt(c, l.At) == day).OrderBy(l => l.At).ToList();
        var cap = (await plan.PartyEntitlementsAsync(actor, c.Booking, ct)).TryGetValue(actor.Id, out var e) ? e.DrinkCapUsd : 0;
        var summary = ServiceRules.DrinkSummary([.. logs.Select(l => (l.DrinkId, Shipboard.Ms(l.At)))], cap, Shipboard.Ms(c.Now));
        return new DrinksViewDto(cap, [.. logs.Select(l => new DrinkRowDto(l.PublicId, l.DrinkId, Shipboard.Ms(l.At)))], summary, Shipboard.AgeOf(c, actor) >= ServiceRules.DrinkingAge);
    }

    public async Task<DrinksViewDto> ViewAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), actor, ct);

    public async Task<DrinksViewDto> LogAsync(UserRecord actor, string? number, LogDrinkRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        var drink = ServiceRules.DrinkById(body?.DrinkId) ?? throw ApiException.Invalid("badDrink");
        if (drink.Alcohol && Shipboard.AgeOf(c, actor) < ServiceRules.DrinkingAge) throw ApiException.Forbidden("age");
        Shipboard.RequireAboard(c);
        await store.AddDrinkAsync(actor.Id, drink.Id, c.Now, ct);
        return await ViewAsync(c, actor, ct);
    }

    public async Task<DrinksViewDto> UndoAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        if (!await store.RemoveDrinkAsync(actor.Id, id, ct)) throw ApiException.NotFound();
        return await ViewAsync(c, actor, ct);
    }
}
