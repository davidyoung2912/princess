using Microsoft.Extensions.Options;
using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public sealed record FamilyLinkDto(string Id, string Token, long ExpiresAt);

public sealed record FamilyPostcardDto(string Kind, string Note, long At);

/// <summary><c>Reason</c> is malformed, signature, unknown, revoked or expired when <c>Ok</c> is false, matching the page's wording. Ship-level facts only: never where the guest is.</summary>
public sealed record FamilyPublicDto(bool Ok, string? Reason, string GuestFirst, long ExpiresAt, IReadOnlyList<FamilyPostcardDto> Postcards, IReadOnlyList<string> Scenarios);

public sealed record NewFamilyLinkRequest(int? Days);

public sealed record FamilyPostcardRequest(string? Kind, string? Note);

/// <summary>
/// Signed family-at-home links and the public page behind them (multi-device plan 2, Phase 6). The link is signed here; the row says if it is live. The contacts' names
/// and addresses stay in the guest's encrypted <c>family</c> document: this service never sees them.
/// </summary>
public sealed class FamilyHomeService(IFamilyHomeStore store, IUserStore users, IUserClock clock, ScopeLoader scopes, IOptions<JwtOptions> jwt)
{
    private byte[] Key => FamilyHomeRules.KeyFrom(jwt.Value.SigningKey);

    private static long Ms(DateTime utc) => new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeMilliseconds();

    public async Task<FamilyLinkDto> IssueAsync(UserRecord user, NewFamilyLinkRequest? body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden("childCannotShare");
        var now = await clock.NowAsync(user, ct);
        if (await store.CountLiveAsync(user.Id, now, ct) >= FamilyHomeRules.MaxLiveLinks) throw ApiException.Conflict("tooManyLinks");
        // Whole seconds, so the expiry in the token is exactly the one the row keeps.
        var expires = new DateTime(now.AddDays(FamilyHomeRules.DaysOrDefault(body?.Days)).Ticks / TimeSpan.TicksPerSecond * TimeSpan.TicksPerSecond, DateTimeKind.Utc);
        var id = await store.AddLinkAsync(user.Id, expires, now, ct);
        return new FamilyLinkDto(id.ToString("N"), FamilyHomeRules.Token(Key, user.PublicId, id, Ms(expires)), Ms(expires));
    }

    public async Task RevokeAsync(UserRecord user, string id, CancellationToken ct)
    {
        if (!Guid.TryParseExact(id, "N", out var link) || !await store.RevokeAsync(user.Id, link, await clock.NowAsync(user, ct), ct)) throw ApiException.NotFound();
    }

    public async Task RevokeAllAsync(UserRecord user, CancellationToken ct) => await store.RevokeAllAsync(user.Id, await clock.NowAsync(user, ct), ct);

    public async Task PostcardAsync(UserRecord user, FamilyPostcardRequest? body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden("childCannotShare");
        if (!FamilyHomeRules.ValidPostcard(body?.Kind, body?.Note, out var note)) throw ApiException.Invalid("badPostcard");
        await store.AddPostcardAsync(user.Id, body!.Kind!, note, await clock.NowAsync(user, ct), FamilyHomeRules.MaxPostcards, ct);
    }

    private static FamilyPublicDto Bad(string reason) => new(false, reason, "", 0, [], []);

    /// <summary>What the page behind a link shows. No sign-in: the signature and the row are the check.</summary>
    public async Task<FamilyPublicDto> PublicAsync(string token, CancellationToken ct)
    {
        if (!FamilyHomeRules.TryRead(Key, token, out var owner, out var linkId, out _)) return Bad("signature");
        var link = await store.FindLinkAsync(linkId, ct);
        var user = link is null ? null : await users.FindByIdAsync(link.UserId, ct);
        if (link is null || user is null || user.PublicId != owner) return Bad("unknown");
        if (link.RevokedAt is not null) return Bad("revoked");
        if (await clock.NowAsync(user, ct) >= link.ExpiresAt) return Bad("expired");
        var cards = (await store.ListPostcardsAsync(user.Id, FamilyHomeRules.MaxPostcards, ct)).Select(p => new FamilyPostcardDto(p.Kind, p.Note, Ms(p.SentAt))).ToList();
        var scenarios = (await scopes.ScenariosAsync(user, ct)).Order(StringComparer.Ordinal).ToList();
        return new FamilyPublicDto(true, null, user.FirstName ?? "", Ms(link.ExpiresAt), cards, scenarios);
    }
}
