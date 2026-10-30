using System.Text.Json.Nodes;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public sealed class PrivacyService(
    AccessService access, IAccountStore accounts, ITripStore trips, IPrivacyStore privacy, IUserStore users, IUserClock clock)
{
    private static DateOnly D(DateTime d) => DateOnly.FromDateTime(d);
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");

    /// <summary>The privacy centre. Anything past its retention date is deleted first (once) and noted.</summary>
    public async Task<PrivacyViewDto> ViewAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var m = await access.RequireMemberAsync(actor, number, ct);
        await PurgeDueAsync(actor, m.BookingId, ct);
        return await BuildAsync(actor, m.BookingId, ct);
    }

    public async Task<PrivacyViewDto> SetConsentAsync(UserRecord actor, Guid personId, string consentId, bool? on, string? bookingNumber, CancellationToken ct)
    {
        if (on is null) throw ApiException.Invalid();
        var target = personId == actor.PublicId ? actor : await users.FindByPublicIdAsync(personId, ct) ?? throw ApiException.NotFound();
        var shared = await accounts.FindSharedBookingAsync(actor.Id, target.Id, ct) ?? throw ApiException.NotFound();
        if (!PrivacyRules.MayDecide(actor.Id, actor.IsSupervised, target.Id, target.IsSupervised, target.BookerUserId)) throw ApiException.Forbidden();

        var bookingId = bookingNumber is null ? shared.BookingId : (await access.RequireMemberAsync(actor, bookingNumber, ct)).BookingId;
        var party = await accounts.GetPartyAsync(bookingId, ct);
        var guest = party.FirstOrDefault(g => g.UserId == target.Id) ?? throw ApiException.NotFound();
        var b = await trips.GetAsync(bookingId, ct) ?? throw ApiException.NotFound();
        var age = AccountRules.AgeOn(D(guest.Dob), D(b.Departure));
        if (!PrivacyRules.ConsentsFor(age).Any(c => c.Id == consentId)) throw ApiException.Invalid("notApplicable");

        await privacy.SetConsentAsync(target.Id, consentId, on.Value, actor.Id, await clock.NowAsync(actor, ct), ct);
        return await BuildAsync(actor, bookingId, ct);
    }

    private async Task PurgeDueAsync(UserRecord actor, long bookingId, CancellationToken ct)
    {
        var b = await trips.GetAsync(bookingId, ct) ?? throw ApiException.NotFound();
        var now = await clock.NowAsync(actor, ct);
        var kinds = PrivacyRules.KindsToDelete(D(b.Departure).AddDays(b.Nights), TripRules.Today(now));
        if (kinds.Count == 0) return;
        var party = await accounts.GetPartyAsync(bookingId, ct);
        var ids = party.Select(g => g.UserId).ToList();
        var done = (await privacy.ListRetentionRunsAsync(ids, ct)).SelectMany(r => r.Kinds.Split(',')).ToHashSet();
        var fresh = kinds.Where(k => !done.Contains(k)).ToList();
        if (fresh.Count == 0) return;
        await privacy.PurgeAsync(bookingId, ids, b.BookerUserId, fresh, now, ct);
        await privacy.AddAccessAsync(actor.Id, actor.FirstName ?? "", "documents:deleted", now, ct);
    }

    private async Task<PrivacyViewDto> BuildAsync(UserRecord actor, long bookingId, CancellationToken ct)
    {
        var b = await trips.GetAsync(bookingId, ct) ?? throw ApiException.NotFound();
        var party = await accounts.GetPartyAsync(bookingId, ct);
        var ids = party.Select(g => g.UserId).ToList();
        var ends = D(b.Departure).AddDays(b.Nights);
        var stored = (await privacy.ListConsentsAsync(ids, ct)).ToLookup(c => c.UserId);

        var people = party.Select(g =>
        {
            var consents = PrivacyRules.ConsentIds.ToDictionary(id => id, id => stored[g.UserId].Any(c => c.ConsentId == id && c.On));
            return new PrivacyPersonDto(g.PublicId, AccountService.FullName(g), AccountRules.AgeOn(D(g.Dob), D(b.Departure)), consents,
                PrivacyRules.MayDecide(actor.Id, actor.IsSupervised, g.UserId, g.IsSupervised, g.BookerUserId));
        }).ToList();

        var runs = (await privacy.ListRetentionRunsAsync(ids, ct)).Select(r => new DeletedRunDto(r.Kinds.Split(','), TripRules.ToMs(r.At))).ToList();
        var access = (await privacy.ListAccessAsync(actor.Id, PrivacyRules.MaxAccess, ct)).Select(Entry).ToList();
        return new PrivacyViewDto(
            Iso(ends), PrivacyRules.Retention.ToDictionary(r => r.Id, r => PrivacyRules.DeleteOn(r, ends) is { } d ? Iso(d) : null), runs, people, access);
    }

    private static AccessEntryDto Entry(AccessRow r)
    {
        var parts = r.Purpose.Split(':', 2);
        return new AccessEntryDto(TripRules.ToMs(r.At), parts[0], parts.Length > 1 ? parts[1] : "viewed", r.Actor);
    }

    // ---- Budget ----

    public async Task<BudgetViewDto> BudgetAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var m = await access.RequireMemberAsync(actor, number, ct);
        return await BudgetViewAsync(actor, m.BookingId, ct);
    }

    public async Task<BudgetViewDto> SaveBudgetAsync(UserRecord actor, string? number, JsonNode? body, CancellationToken ct)
    {
        var m = await access.RequireAdultMemberAsync(actor, number, ct);
        var b = await trips.GetAsync(m.BookingId, ct) ?? throw ApiException.NotFound();
        var kids = (await Kids(m.BookingId, b, ct));
        if (PrivacyRules.ValidateBudget(body, kids.Select(k => k.Id.ToString()).ToHashSet()) is not null) throw ApiException.Invalid();
        // A child's limit is the parent's to set (data model section 7, rule 4).
        if ((body as JsonObject)?["kids"] is JsonObject limits)
            foreach (var (id, _) in limits)
                if (kids.First(k => k.Id.ToString() == id).BookerUserId != actor.Id) throw ApiException.Forbidden();

        await privacy.SaveBudgetJsonAsync(m.BookingId, PrivacyRules.NormalizeBudget(body).ToJsonString(), await clock.NowAsync(actor, ct), ct);
        return await BudgetViewAsync(actor, m.BookingId, ct);
    }

    private sealed record Kid(Guid Id, string Name, int Age, long? BookerUserId);

    private async Task<List<Kid>> Kids(long bookingId, BookingRow b, CancellationToken ct) =>
        (await accounts.GetPartyAsync(bookingId, ct))
            .Select(g => new Kid(g.PublicId, AccountService.FullName(g), AccountRules.AgeOn(D(g.Dob), D(b.Departure)), g.BookerUserId))
            .Where(k => k.Age < 18).ToList();

    private async Task<BudgetViewDto> BudgetViewAsync(UserRecord actor, long bookingId, CancellationToken ct)
    {
        var b = await trips.GetAsync(bookingId, ct) ?? throw ApiException.NotFound();
        JsonNode? stored = null;
        if (await privacy.GetBudgetJsonAsync(bookingId, ct) is { } json)
        {
            try { stored = JsonNode.Parse(json); } catch (System.Text.Json.JsonException) { }
        }
        var kids = (await Kids(bookingId, b, ct)).Select(k => new BudgetKidDto(k.Id, k.Name, k.Age)).ToList();
        return new BudgetViewDto(PrivacyRules.NormalizeBudget(stored), kids, !actor.IsSupervised);
    }
}
