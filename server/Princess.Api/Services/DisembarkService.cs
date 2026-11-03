using System.Text.Json;
using System.Text.Json.Nodes;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>When the stages that Phase 11 cares about begin (<c>stageStarts</c> in <c>src/domain/sailings.ts</c>).</summary>
internal static class FinishStages
{
    public static DateTime EmbarkationAt(Scope c) => Itinerary.LocalToUtc(c.Departure, new TimeOnly(11, 0), c.Timeline.HomeZone);

    /// <summary>The last evening, 08:00 ship time: the final bill opens.</summary>
    public static DateTime FarewellAt(Scope c)
    {
        var date = c.Timeline.Days[^2].Date;
        return Itinerary.LocalToUtc(date, new TimeOnly(8, 0), c.Timeline.ShipZoneOnDate(date));
    }

    /// <summary>The ship has tied up: the stages <c>disembark</c> and <c>postCruise</c>.</summary>
    public static bool Sailed(Scope c) => c.Confirmed && c.Now >= DisembarkRules.Times(c.Timeline).ArrivalAt;

    /// <summary>Photos can be downloaded, and feedback changed, until the end of this many days after the last morning.</summary>
    public static DateTime EndOfDaysAfter(Scope c, int days) => Itinerary.LocalToUtc(c.Timeline.Days[^1].Date.AddDays(days), new TimeOnly(23, 59), c.Timeline.FinalZone);
}

/// <summary>
/// Getting off the ship: the choice, luggage tags, customs, onward travel, the final night and the final bill (DEB-01 to DEB-07). Ports the <c>disembark</c> group of <c>src/api/finishMock.ts</c>.
/// Any guest reads; an adult guest writes. Choices belong to the booking, not to a person.
/// </summary>
public sealed class DisembarkService(ScopeLoader scopes, IFinishStore store, IAccountStore accounts, ITripStore trips, PlanService plan)
{
    private static long Ms(DateTime utc) => TripRules.ToMs(utc);

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private static string ShortOption(string? option) => option ?? "tagged";

    private async Task<(TagGroup Group, bool Priority)> GroupAsync(UserRecord actor, Scope c, CancellationToken ct)
    {
        var ent = await plan.PartyEntitlementsAsync(actor, c.Booking, ct);
        var priority = ent.TryGetValue(c.Booking.BookerUserId, out var e) && e.Perks.Contains("priorityDisembarkation");
        return (DisembarkRules.GroupFor($"{c.Booking.Number}|{c.Booking.SailingId}", priority), priority);
    }

    private static Dictionary<string, long> OffTimes(Scope c, TagGroup g) =>
        DisembarkRules.WalkOffIds.ToDictionary(o => o, o => Ms(DisembarkRules.OffAt(c.Timeline, o, g)));

    // ---- The choice (DEB-01, DEB-02) ----

    private async Task<DisembarkViewDto> ViewAsync(UserRecord actor, Scope c, CancellationToken ct)
    {
        var times = DisembarkRules.Times(c.Timeline);
        var choice = await store.GetChoiceAsync(c.Booking.BookingId, ct);
        var (group, priority) = await GroupAsync(actor, c, ct);
        var needs = (await accounts.GetProfileAsync(c.Booking.BookerUserId, ct))?.Needs ?? [];
        var cabin = Shipboard.Stateroom(c, needs.Contains("mobility")).Number;
        var guests = c.Party.Select(p =>
        {
            var bags = choice?.Bags.GetValueOrDefault(p.UserId) ?? 0;
            var printed = BoardingRules.PassName(p.First, p.Last);
            return new DisembarkGuestDto(p.Id, p.Name, printed, bags, cabin, choice?.Option == "tagged" && bags > 0 ? DisembarkRules.TagLabel(group, printed, cabin) : null);
        }).ToList();
        var closed = c.Now >= times.BagsOutAt;
        return new DisembarkViewDto(
            choice?.Option, group, priority, guests, choice?.TagsOn ?? false, new DisembarkTimesDto(Ms(times.ArrivalAt), Ms(times.BagsOutAt), Ms(times.VacateAt), Ms(times.TipBy)), OffTimes(c, group),
            Shipboard.IsAboard(c) && c.Confirmed && !c.Actor.IsSupervised && !closed, closed, needs.Any(n => n is "mobility" or "hearing" or "vision"),
            await store.GetCustomsAsync(c.Booking.BookingId, ct) is not null, await store.GetOnwardAsync(c.Booking.BookingId, ct) is not null, Ms(FinishStages.EndOfDaysAfter(c, PhotoRules.RedownloadDays)));
    }

    public async Task<DisembarkViewDto> ViewAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ViewAsync(actor, await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<DisembarkViewDto> ChooseAsync(UserRecord actor, string? number, DisembarkChoiceRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        if (c.Now >= DisembarkRules.Times(c.Timeline).BagsOutAt) throw ApiException.Conflict("deadline");
        if (body?.Option is null || !DisembarkRules.WalkOffIds.Contains(body.Option)) throw ApiException.Invalid("badOption");
        var given = body.Bags ?? [];
        if (given.Keys.Any(id => c.PersonById(id) is null)) throw ApiException.Invalid("badBags");
        var bags = c.Party.ToDictionary(p => p.Id, p => given.GetValueOrDefault(p.Id));
        if (DisembarkRules.ChoiceProblem(body.Option, bags) is { } problem) throw ApiException.Invalid(problem);
        var before = await store.GetChoiceAsync(c.Booking.BookingId, ct);
        await store.SaveChoiceAsync(c.Booking.BookingId, body.Option, body.Option == "tagged" && (before?.TagsOn ?? false), c.Party.ToDictionary(p => p.UserId, p => bags[p.Id]), c.Now, ct);
        return await ViewAsync(actor, c, ct);
    }

    public async Task<DisembarkViewDto> SetTagsOnAsync(UserRecord actor, string? number, TagsOnRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        var choice = await store.GetChoiceAsync(c.Booking.BookingId, ct);
        if (choice?.Option != "tagged") throw ApiException.Conflict("notTagged");
        await store.SetTagsOnAsync(c.Booking.BookingId, body?.On ?? false, ct);
        return await ViewAsync(actor, c, ct);
    }

    // ---- Customs (DEB-04) ----

    /// <summary>Reads the stored declaration; a hand-written row may hold fewer fields (or <c>goods</c> instead of <c>goodsUsd</c>).</summary>
    private static CustomsDeclaration ParseDeclaration(string json)
    {
        JsonObject o;
        try { o = JsonNode.Parse(json) as JsonObject ?? []; }
        catch (JsonException) { o = []; }
        bool Flag(string key) => o[key] is JsonValue v && v.TryGetValue<bool>(out var b) && b;
        return new CustomsDeclaration(Flag("food"), Flag("cash"), o["goodsUsd"] is JsonValue g && g.TryGetValue<int>(out var usd) ? usd : 0, o["note"] is JsonValue n && n.TryGetValue<string>(out var s) ? s : "");
    }

    private async Task<CustomsViewDto> CustomsViewAsync(Scope c, CancellationToken ct)
    {
        var stored = await store.GetCustomsAsync(c.Booking.BookingId, ct);
        var declaration = stored is null ? null : ParseDeclaration(stored.Json);
        var summary = DisembarkRules.CustomsSummaryOf(declaration ?? DisembarkRules.BlankCustoms(), c.Party.Count);
        return new CustomsViewDto(
            declaration is null ? null : new CustomsDeclarationDto(declaration.Food, declaration.Cash, declaration.GoodsUsd, declaration.Note), stored is null ? null : Ms(stored.SubmittedAt),
            c.Party.Count, summary.AllowanceUsd, summary.Declare, summary.OverUsd, Shipboard.IsAboard(c) && c.Confirmed && !c.Actor.IsSupervised);
    }

    public async Task<CustomsViewDto> CustomsAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await CustomsViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<CustomsViewDto> SaveCustomsAsync(UserRecord actor, string? number, CustomsRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        if (body is null) throw ApiException.Invalid("badAnswer");
        var declaration = new CustomsDeclaration(body.Food, body.Cash, body.GoodsUsd, body.Note ?? "");
        if (DisembarkRules.CustomsProblem(declaration) is { } problem) throw ApiException.Invalid(problem);
        declaration = declaration with { Note = declaration.Note.Trim() };
        await store.SaveCustomsAsync(c.Booking.BookingId, JsonSerializer.Serialize(new { declaration.Food, declaration.Cash, declaration.GoodsUsd, declaration.Note }, Web), c.Now, ct);
        return await CustomsViewAsync(c, ct);
    }

    // ---- Onward travel (DEB-05) ----

    private async Task<OnwardViewDto> OnwardViewAsync(UserRecord actor, Scope c, CancellationToken ct)
    {
        var stored = await store.GetOnwardAsync(c.Booking.BookingId, ct);
        var choice = await store.GetChoiceAsync(c.Booking.BookingId, ct);
        var (group, _) = await GroupAsync(actor, c, ct);
        var offFrom = DisembarkRules.OffAt(c.Timeline, ShortOption(choice?.Option), group);
        var plan = stored is null ? null : new OnwardPlan(stored.Mode, stored.FlightAt, stored.Flight, stored.Note);
        return new OnwardViewDto(
            plan is null ? null : new OnwardPlanDto(plan.Mode, plan.FlightAt, plan.Flight, plan.Note), plan is not null && DisembarkRules.OnwardMode(plan.Mode) is not null ? DisembarkRules.CheckOnward(c.Timeline, plan, offFrom) : null,
            Ms(offFrom), c.Party.Count, !c.Actor.IsSupervised);
    }

    public async Task<OnwardViewDto> OnwardAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await OnwardViewAsync(actor, await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<OnwardViewDto> SaveOnwardAsync(UserRecord actor, string? number, OnwardRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var plan = new OnwardPlan(body?.Mode ?? "", body?.FlightAt ?? "", body?.Flight ?? "", body?.Note ?? "");
        if (DisembarkRules.OnwardProblem(plan) is { } problem) throw ApiException.Invalid(problem);
        await store.SaveOnwardAsync(c.Booking.BookingId, new OnwardRow { Mode = plan.Mode, FlightAt = plan.FlightAt, Flight = plan.Flight.Trim().ToUpperInvariant(), Note = plan.Note.Trim() }, ct);
        return await OnwardViewAsync(actor, c, ct);
    }

    // ---- The final night (DEB-07) ----

    private async Task<NightViewDto> NightViewAsync(Scope c, CancellationToken ct)
    {
        var choice = await store.GetChoiceAsync(c.Booking.BookingId, ct);
        var customs = await store.GetCustomsAsync(c.Booking.BookingId, ct) is not null;
        var ticks = await store.ListNightTicksAsync(c.Booking.BookingId, ct);
        return new NightViewDto(DisembarkRules.NightEntries(c.Timeline, c.Now, choice?.Option, customs, choice?.TagsOn ?? false, ticks), choice?.Option);
    }

    public async Task<NightViewDto> NightAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await NightViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<NightViewDto> TickAsync(UserRecord actor, string? number, string? id, NightTickRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        var item = DisembarkRules.NightItemById(id) ?? throw ApiException.Invalid("badItem");
        if (item.Auto is not null) throw ApiException.Invalid("automatic");
        await store.SetNightTickAsync(c.Booking.BookingId, item.Id, body?.Done ?? false, c.Now, ct);
        return await NightViewAsync(c, ct);
    }

    // ---- The final bill (DEB-03) ----

    private async Task<FinalBillViewDto> BillViewAsync(UserRecord actor, Scope c, CancellationToken ct)
    {
        var times = DisembarkRules.Times(c.Timeline);
        var ent = await plan.PartyEntitlementsAsync(actor, c.Booking, ct);
        var suite = Pricing.Category(c.Booking.CategoryId)?.Suite == true;
        var charged = DisembarkRules.GratuityCharged(c.Party.Select(p => new GratuityGuest(suite, ent.TryGetValue(p.UserId, out var e) && e.GratuitiesIncluded)), c.Nights);
        var bill = await store.GetFinalBillAsync(c.Booking.BookingId, ct);
        var keep = bill?.TipKeepPercent ?? 100;
        var cards = await trips.ListCardsAsync(c.Booking.BookerUserId, ct);
        var card = cards.OrderByDescending(x => x.IsDefault).FirstOrDefault();
        var open = c.Now >= FinishStages.FarewellAt(c);
        var cases = await store.ListCasesAsync(c.Booking.BookingId, ct);
        var queries = cases.Where(x => x.Kind == "billing").Select(x => (Row: x, Status: CaseService.StatusOf(x, c.Now))).ToList();
        return new FinalBillViewDto(
            card is null ? null : $"{TripService.BrandName(card.Brand)} ending {card.Last4}",
            new TipDto(charged, keep, DisembarkRules.TipCredit(charged, keep), Ms(times.TipBy), Shipboard.IsAboard(c) && c.Confirmed && !c.Actor.IsSupervised && c.Now < times.TipBy && charged > 0),
            [new("folio", open), new("gratuities", open), new("fare", true)], bill?.EmailedAt is { } at ? Ms(at) : null, bill?.EmailedTo,
            [.. queries.Select(q => new BillQueryDto(q.Row.PublicId, q.Row.LineId, q.Row.Number, q.Status.Stage, q.Row.Cents))],
            open && (bill?.SettledAt is { } s && s <= c.Now || !queries.Any(q => q.Status.Stage is "received" or "inReview")));
    }

    public async Task<FinalBillViewDto> FinalBillAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await BillViewAsync(actor, await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<FinalBillViewDto> AdjustTipAsync(UserRecord actor, string? number, TipKeepRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        if (body is null || !DisembarkRules.TipKeep.Contains(body.KeepPercent)) throw ApiException.Invalid("badTip");
        if (c.Now >= DisembarkRules.Times(c.Timeline).TipBy) throw ApiException.Conflict("deadline");
        var ent = await plan.PartyEntitlementsAsync(actor, c.Booking, ct);
        var suite = Pricing.Category(c.Booking.CategoryId)?.Suite == true;
        var credit = DisembarkRules.TipCredit(DisembarkRules.GratuityCharged(c.Party.Select(p => new GratuityGuest(suite, ent.TryGetValue(p.UserId, out var e) && e.GratuitiesIncluded)), c.Nights), body.KeepPercent);
        FolioWrite[] folio = credit > 0 ? [new(c.Booking.BookerUserId, 7, "credit", $"Gratuity adjustment (keeping {body.KeepPercent}%)", -credit, null, c.Now)] : [];
        await store.SaveTipAsync(c.Booking.BookingId, body.KeepPercent, folio, ct);
        return await BillViewAsync(actor, c, ct);
    }

    public async Task<FinalBillViewDto> EmailReceiptAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (c.Now < FinishStages.FarewellAt(c)) throw ApiException.Conflict("closed");
        var email = (await accounts.GetProfileAsync(actor.Id, ct))?.Email;
        if (string.IsNullOrWhiteSpace(email)) throw ApiException.Invalid("noEmail");
        await store.SaveEmailedAsync(c.Booking.BookingId, c.Now, DraftRules.MaskEmail(email), ct);
        return await BillViewAsync(actor, c, ct);
    }
}
