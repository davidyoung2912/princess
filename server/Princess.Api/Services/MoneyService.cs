using System.Security.Cryptography;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Top-ups, the account PIN, gratuities and the display currency (ACC-03, ACC-05, ACC-07). Ports <c>money</c> of <c>src/api/aboardMock.ts</c>.
/// The account, its PIN and its gratuity choice belong to the booking (the table has one row per booking). The PIN is a salted PBKDF2 hash; five wrong guesses lock it until Guest Services reset it in person.
/// Top-ups and a prepaid gratuity go on the account as credits.
/// </summary>
public sealed class MoneyService(ScopeLoader scopes, IAboardStore store, ITripStore trips, IOnboardStore onboard, PlanService plan)
{
    private const int PinIterations = 100_000;

    private static byte[] Hash(string pin, byte[] salt) => Rfc2898DeriveBytes.Pbkdf2(pin, salt, PinIterations, HashAlgorithmName.SHA256, 32);

    private static async Task<(long Due, bool CanChange, OnboardAccountRow Account)> GratuityStateAsync(Scope c, IAboardStore store, PlanService plan, UserRecord actor, CancellationToken ct)
    {
        var entitlements = await plan.PartyEntitlementsAsync(actor, c.Booking, ct);
        var suite = Pricing.Category(c.Booking.CategoryId)?.Suite == true;
        var due = ServiceRules.GratuityDue(c.Party.Select(p => (suite, entitlements.TryGetValue(p.UserId, out var e) && e.GratuitiesIncluded)), c.Nights);
        var account = await store.GetAccountAsync(c.Booking.BookingId, ct);
        var aboard = Shipboard.IsAboard(c);
        var canChange = due > 0 && account.GratuityChoice == "standard" && Shipboard.BeforeOrAboard(c) && (!aboard || Shipboard.DayAt(c, c.Now) < 7);
        return (due, canChange, account);
    }

    private async Task<MoneyViewDto> ViewAsync(Scope c, UserRecord actor, CancellationToken ct)
    {
        var now = Shipboard.Ms(c.Now);
        var tops = (await store.ListTopUpsAsync(c.Booking.BookingId, ct))
            .Select(t => new TopUpDto(t.PublicId, t.Dollars, t.Source, Shipboard.Ms(t.At), t.SettledAt is { } s && Shipboard.Ms(s) <= now ? Shipboard.Ms(s) : null, t.Reference))
            .OrderByDescending(t => t.At).ToList();
        var (due, canChange, account) = await GratuityStateAsync(c, store, plan, actor, ct);
        var gratuity = new GratuityDto(due, account.GratuityChoice, account.GratuityReason ?? "", canChange, account.GratuityChoice == "prepaid" && account.GratuityPaidAt is { } p ? Shipboard.Ms(p) : null);
        return new MoneyViewDto(
            ServiceRules.CurrencyByCode(account.DisplayCurrency) is null ? "USD" : account.DisplayCurrency, tops, tops.Sum(t => t.Dollars),
            (await trips.ListCardsAsync(actor.Id, ct)).Count > 0, account.PinHash is not null, gratuity, !actor.IsSupervised);
    }

    public async Task<MoneyViewDto> ViewAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), actor, ct);

    public async Task<MoneyViewDto> TopUpAsync(UserRecord actor, string? number, TopUpRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (body?.Source is not ("card" or "cash")) throw ApiException.Invalid("badSource");
        var tops = await store.ListTopUpsAsync(c.Booking.BookingId, ct);
        var problem = ServiceRules.TopUpProblem(body.Dollars, tops.Sum(t => t.Dollars));
        if (problem == "tooMuch") throw ApiException.Conflict("tooMuch");
        if (problem is not null) throw ApiException.Invalid(problem);
        Shipboard.RequireOpen(c);
        if (body.Source == "card" && (await trips.ListCardsAsync(actor.Id, ct)).Count == 0) throw ApiException.Conflict("noCard");
        var dollars = body.Dollars!.Value;
        var settled = body.Source == "card" ? c.Now : c.Now.AddMinutes(ServiceRules.CashDeskMin);
        var row = new TopUpRow { Dollars = dollars, Source = body.Source, At = c.Now, SettledAt = settled, Reference = $"TOP-{tops.Count + 1:000}" };
        var line = new FolioWrite(c.Booking.BookerUserId, Shipboard.DayAt(c, settled), "credit", body.Source == "cash" ? "Cash deposit" : "Top-up by card", -dollars * 100L, null, settled);
        await store.AddTopUpAsync(c.Booking.BookingId, row, [line], ct);
        return await ViewAsync(c, actor, ct);
    }

    public async Task<MoneyViewDto> SetPinAsync(UserRecord actor, string? number, SetPinRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (ServiceRules.PinProblem(body?.Next) is { } problem) throw ApiException.Invalid(problem);
        var account = await store.GetAccountAsync(c.Booking.BookingId, ct);
        if (account.PinHash is not null && account.PinSalt is not null)
        {
            if (account.PinFails >= ServiceRules.PinFailsAllowed) throw ApiException.Conflict("locked");
            if (!CryptographicOperations.FixedTimeEquals(Hash(body!.Current ?? "", account.PinSalt), account.PinHash))
            {
                await store.RecordPinFailAsync(c.Booking.BookingId, ct);
                throw ApiException.Forbidden("wrongPin");
            }
        }
        var salt = RandomNumberGenerator.GetBytes(16);
        await store.SetPinAsync(c.Booking.BookingId, Hash(body!.Next!, salt), salt, ct);
        return await ViewAsync(c, actor, ct);
    }

    public async Task<MoneyViewDto> ForgotPinAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        await onboard.AddServiceMessageAsync(c.Booking.BookingId, "guestServices", "I have forgotten my account PIN. Please reset it for me when I come to the desk.", c.Now, ct);
        return await ViewAsync(c, actor, ct);
    }

    public async Task<MoneyViewDto> GratuityAsync(UserRecord actor, string? number, GratuityRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (body?.Choice is not ("prepaid" or "removal")) throw ApiException.Invalid("badChoice");
        Shipboard.RequireOpen(c);
        var (due, canChange, _) = await GratuityStateAsync(c, store, plan, actor, ct);
        if (due <= 0) throw ApiException.Conflict("nothingDue");
        if (!canChange) throw ApiException.Conflict("already");
        var reason = (body.Reason ?? "").Trim();
        if (body.Choice == "removal" && reason.Length < ServiceRules.GratuityReasonMin) throw ApiException.Invalid("noReason");
        if (body.Choice == "prepaid" && (await trips.ListCardsAsync(actor.Id, ct)).Count == 0) throw ApiException.Conflict("noCard");
        if (reason.Length > 300) reason = reason[..300];
        IReadOnlyList<FolioWrite> folio = body.Choice == "prepaid"
            ? [new FolioWrite(c.Booking.BookerUserId, Shipboard.DayAt(c, c.Now), "credit", "Gratuities prepaid by card", -due, null, c.Now)]
            : [];
        await store.SaveGratuityAsync(c.Booking.BookingId, body.Choice, reason, c.Now, folio, ct);
        return await ViewAsync(c, actor, ct);
    }

    public async Task<MoneyViewDto> SetCurrencyAsync(UserRecord actor, string? number, CurrencyRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        if (ServiceRules.CurrencyByCode(body?.Code) is not { } currency) throw ApiException.Invalid("badCurrency");
        await store.SetCurrencyAsync(c.Booking.BookingId, currency.Code, ct);
        return await ViewAsync(c, actor, ct);
    }
}
