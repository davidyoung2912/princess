using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public sealed record FamilyLinkDto(string Id, string Token, long ExpiresAt);

public sealed record FamilyPostcardDto(string Kind, string Note, long At, string? Photo = null);

/// <summary><c>Reason</c> is malformed, signature, unknown, revoked or expired when <c>Ok</c> is false, matching the page's wording. Ship-level facts only: never where the guest is.</summary>
public sealed record FamilyPublicDto(bool Ok, string? Reason, string GuestFirst, long ExpiresAt, IReadOnlyList<FamilyPostcardDto> Postcards, IReadOnlyList<string> Scenarios, int? DelayedMinutes = null, string? Recap = null);

public sealed record NewFamilyLinkRequest(int? Days);

public sealed record FamilyPostcardRequest(string? Kind, string? Note, string? PhotoId = null);

public sealed record FamilyRecapRequest(string? Text);

/// <summary>
/// Signed family-at-home links and the public page behind them (multi-device plan 2, Phase 6). The link is signed here; the row says if it is live. The contacts' names
/// and addresses stay in the guest's encrypted <c>family</c> document: this service never sees them.
/// </summary>
public sealed class FamilyHomeService(IFamilyHomeStore store, IUserStore users, IUserClock clock, ScopeLoader scopes, IOptions<JwtOptions> jwt, IStateStore state, IMediaStore media)
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
        // A picture on the card must be one of the guest's own postcard pictures; the family sees it through their link and nowhere else.
        Guid? photo = null;
        if (!string.IsNullOrEmpty(body.PhotoId))
        {
            if (!Guid.TryParse(body.PhotoId, out var id) || await media.FindAsync(id, ct) is not { } row || row.UserId != user.Id || row.Purpose != "postcard") throw ApiException.Invalid("badPostcard");
            photo = id;
        }
        await store.AddPostcardAsync(user.Id, body!.Kind!, note, await clock.NowAsync(user, ct), FamilyHomeRules.MaxPostcards, photo, ct);
    }

    /// <summary>Keeps the recap the guest wrote (N6.5). Every live link then shows it; stopping the links stops it. 400 badRecap, 403 childCannotShare.</summary>
    public async Task SetRecapAsync(UserRecord user, FamilyRecapRequest? body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden("childCannotShare");
        if (!FamilyHomeRules.ValidRecap(body?.Text, out var clean)) throw ApiException.Invalid("badRecap");
        var now = await clock.NowAsync(user, ct);
        var json = new JsonObject { ["text"] = clean, ["at"] = Ms(now) }.ToJsonString();
        var row = await state.GetAsync(false, user.Id, FamilyHomeRules.RecapKey, ct);
        if (await state.SaveAsync(false, user.Id, FamilyHomeRules.RecapKey, json, row?.Version ?? 0, now, ct) is null) throw ApiException.Conflict("stale");
    }

    public async Task ClearRecapAsync(UserRecord user, CancellationToken ct) => await state.DeleteAsync(false, user.Id, FamilyHomeRules.RecapKey, ct);

    /// <summary>The recap on the page: the guest's text, checked again on the way out; null when there is none or what is kept is not in the expected shape.</summary>
    private async Task<string?> RecapOfAsync(long userId, CancellationToken ct)
    {
        var row = await state.GetAsync(false, userId, FamilyHomeRules.RecapKey, ct);
        if (row is null) return null;
        try { return JsonNode.Parse(row.Json) is JsonObject o && o["text"] is JsonValue v && v.TryGetValue<string>(out var text) && FamilyHomeRules.ValidRecap(text, out var clean) ? clean : null; }
        catch (System.Text.Json.JsonException) { return null; }
    }

    private static FamilyPublicDto Bad(string reason) => new(false, reason, "", 0, [], []);

    /// <summary>The guest and link behind a token, or the reason it does not work.</summary>
    private async Task<(UserRecord? User, FamilyLinkRow? Link, string? Reason)> LiveAsync(string token, CancellationToken ct)
    {
        if (!FamilyHomeRules.TryRead(Key, token, out var owner, out var linkId, out _)) return (null, null, "signature");
        var link = await store.FindLinkAsync(linkId, ct);
        var user = link is null ? null : await users.FindByIdAsync(link.UserId, ct);
        if (link is null || user is null || user.PublicId != owner) return (null, null, "unknown");
        if (link.RevokedAt is not null) return (null, null, "revoked");
        if (await clock.NowAsync(user, ct) >= link.ExpiresAt) return (null, null, "expired");
        return (user, link, null);
    }

    /// <summary>A picture on one of the postcards the page shows (N7.5). 404 for anything else, whatever the reason, so a guess learns nothing.</summary>
    public async Task<(byte[] Data, string ContentType)> PublicPhotoAsync(string token, string id, CancellationToken ct)
    {
        var (user, _, reason) = await LiveAsync(token, ct);
        if (user is null || reason is not null || !Guid.TryParse(id, out var photo)) throw ApiException.NotFound();
        var shown = (await store.ListPostcardsAsync(user.Id, FamilyHomeRules.MaxPostcards, ct)).Any(p => p.MediaId == photo);
        var row = shown ? await media.FindAsync(photo, ct) : null;
        if (row is null || row.UserId != user.Id || row.Purpose != "postcard") throw ApiException.NotFound();
        return (await media.BytesAsync(photo, ct) ?? throw ApiException.NotFound(), row.ContentType);
    }

    /// <summary>What the page behind a link shows. No sign-in: the signature and the row are the check.</summary>
    public async Task<FamilyPublicDto> PublicAsync(string token, CancellationToken ct)
    {
        var (user, link, reason) = await LiveAsync(token, ct);
        if (user is null || link is null) return Bad(reason!);
        var cards = (await store.ListPostcardsAsync(user.Id, FamilyHomeRules.MaxPostcards, ct)).Select(p => new FamilyPostcardDto(p.Kind, p.Note, Ms(p.SentAt), p.MediaId?.ToString("D"))).ToList();
        var scenarios = (await scopes.ScenariosAsync(user, ct)).Order(StringComparer.Ordinal).ToList();
        // A delay shows only when the guest told their party and left ETA sharing on; it lives in their (unencrypted) hub document.
        var hub = await state.GetAsync(false, user.Id, "hub", ct);
        int? delayed = null;
        try { delayed = FamilyHomeRules.SharedDelayMinutes(hub is null ? null : JsonNode.Parse(hub.Json)); }
        catch (System.Text.Json.JsonException) { }
        return new FamilyPublicDto(true, null, user.FirstName ?? "", Ms(link.ExpiresAt), cards, scenarios, delayed, await RecapOfAsync(user.Id, ct));
    }
}
