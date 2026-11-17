using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using Princess.Api.Audit;
using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// What the guest lets Stanley do on his own (docs/stanley-actions-and-proactive-plan.md, phase P0a), kept against the account so every device sees the same grants. Reads are for the signed-in guest only. Every unprompted
/// Stanley act asks <see cref="MayAsync"/> first: it is the one enforcement point. Raising to level 3 or 4, or switching on a handling row, needs an emailed code (the path the email check uses); lowering and switching off need nothing.
/// The consent history records the guest, the ability, the state, the wording version, where it was chosen and when, and never any text the guest typed. A child account is at level 1 and cannot change anything.
/// </summary>
public sealed class StanleyPermissionService(IStateStore state, IStanleyMemoryStore memory, IUserClock clock, IEmailSender email, IOptions<JwtOptions> jwt, IOptions<StanleyOptions> options, IAuditLog audit)
{
    private byte[] Key => EmailRules.KeyFrom(jwt.Value.SigningKey);
    private bool Authority => options.Value.Switches.Authority;

    private async Task<(StanleyPermissionDoc Doc, int Version)> LoadAsync(long userId, CancellationToken ct) =>
        await state.GetAsync(false, userId, StanleyPermissionRules.StateKey, ct) is { } row ? (StanleyPermissionRules.Parse(row.Json), row.Version) : (new StanleyPermissionDoc(), 0);

    private async Task SaveAsync(long userId, StanleyPermissionDoc doc, int version, DateTime now, CancellationToken ct)
    {
        if (await state.SaveAsync(false, userId, StanleyPermissionRules.StateKey, StanleyPermissionRules.ToJson(doc), version, now, ct) is null) throw ApiException.Conflict("changed");
    }

    private async Task<bool> VoiceOffAsync(long userId, CancellationToken ct) => await memory.GetLevelAsync(userId, ct) == "off";

    private static long Ms(DateTime guestNow) => TripRules.ToMs(guestNow);

    private async Task RecordAsync(string action, string detail, CancellationToken ct) =>
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "stanley.permission." + action, Outcome = AuditOutcome.Success, Detail = detail }, ct);

    private async Task LogConsentAsync(UserRecord user, string ability, string stateWord, string source, DateTime now, CancellationToken ct)
    {
        var row = await state.GetAsync(false, user.Id, StanleyPermissionRules.ConsentKey, ct);
        var log = StanleyPermissionRules.AppendConsent(StanleyPermissionRules.ParseConsent(row?.Json), new(ability, stateWord, StanleyPermissionRules.WordingVersion, source, Ms(now)));
        await state.SaveAsync(false, user.Id, StanleyPermissionRules.ConsentKey, StanleyPermissionRules.ConsentJson(log), row?.Version ?? 0, now, ct);
        await RecordAsync(ability, stateWord, ct);
    }

    private static string CleanSource(string? source) => source is not null && StanleyPermissionRules.Sources.Contains(source) ? source : throw ApiException.Invalid("source");

    /// <summary>The choices and what is in force now.</summary>
    public async Task<StanleyPermissionsDto> GetAsync(UserRecord user, CancellationToken ct)
    {
        var (doc, _) = await LoadAsync(user.Id, ct);
        var now = await clock.NowAsync(user, ct);
        return StanleyPermissionRules.View(doc, user.IsSupervised, await VoiceOffAsync(user.Id, ct), Authority, Ms(now));
    }

    /// <summary>The one enforcement point: whether Stanley may take this unprompted step for the guest now. False for an unknown row, an unbuilt one, a paused account, a child account, a level that does not reach it or a row switched off.</summary>
    public async Task<bool> MayAsync(UserRecord user, string rowId, CancellationToken ct)
    {
        if (StanleyPermissionRules.Row(rowId) is not { } row) return false;
        var (doc, _) = await LoadAsync(user.Id, ct);
        var now = await clock.NowAsync(user, ct);
        var eff = StanleyPermissionRules.EffectiveLevel(doc, user.IsSupervised, await VoiceOffAsync(user.Id, ct));
        return StanleyPermissionRules.IsOn(doc, row, eff, StanleyPermissionRules.IsPaused(doc, Ms(now)));
    }

    public async Task<StanleyPermissionsDto> SetLevelAsync(UserRecord user, StanleyLevelRequest? body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        if (body?.Level is not { } level || level is < 1 or > 4) throw ApiException.Invalid("level");
        var source = CleanSource(body.Source);
        var (doc, version) = await LoadAsync(user.Id, ct);
        var now = await clock.NowAsync(user, ct);
        if (level > 2 && !Authority) throw ApiException.Conflict("notYet");
        if (level != doc.Level)
        {
            if (StanleyPermissionRules.NeedsStepUp(doc.Level, level)) await ConsumeTokenAsync(user, body.StepUp, now, ct);
            await SaveAsync(user.Id, StanleyPermissionRules.WithLevel(doc, level), version, now, ct);
            await LogConsentAsync(user, "level", level.ToString(), source, now, ct);
        }
        return await GetAsync(user, ct);
    }

    public async Task<StanleyPermissionsDto> SetRowAsync(UserRecord user, string? id, StanleyRowRequest? body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        var row = StanleyPermissionRules.Row(id) ?? throw ApiException.NotFound();
        if (body?.On is not { } on) throw ApiException.Invalid("on");
        var source = CleanSource(body.Source);
        if (on && !row.Built) throw ApiException.Conflict("notYet");
        var (doc, version) = await LoadAsync(user.Id, ct);
        var now = await clock.NowAsync(user, ct);
        if (on && doc.Level < row.NeedsLevel) throw ApiException.Conflict("needsLevel");
        var already = StanleyPermissionRules.IsOn(doc, row, doc.Level, false);
        if (already != on)
        {
            if (StanleyPermissionRules.RowNeedsStepUp(row, on)) await ConsumeTokenAsync(user, body.StepUp, now, ct);
            await SaveAsync(user.Id, StanleyPermissionRules.WithRow(doc, row.Id, on), version, now, ct);
            await LogConsentAsync(user, row.Id, on ? "on" : "off", source, now, ct);
        }
        return await GetAsync(user, ct);
    }

    /// <summary>Pauses everything Stanley does unprompted (<c>today</c> or until resumed). Notices and answers carry on. Anyone may pause; a child account has nothing to pause.</summary>
    public async Task<StanleyPermissionsDto> PauseAsync(UserRecord user, StanleyPauseRequest? body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        var (doc, version) = await LoadAsync(user.Id, ct);
        var now = await clock.NowAsync(user, ct);
        var until = StanleyPermissionRules.PauseUntil(body?.Until, now) ?? throw ApiException.Invalid("until");
        await SaveAsync(user.Id, doc with { PausedUntil = until }, version, now, ct);
        await LogConsentAsync(user, "pause", body!.Until!, "settings", now, ct);
        return await GetAsync(user, ct);
    }

    public async Task<StanleyPermissionsDto> ResumeAsync(UserRecord user, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        var (doc, version) = await LoadAsync(user.Id, ct);
        var now = await clock.NowAsync(user, ct);
        if (doc.PausedUntil != 0)
        {
            await SaveAsync(user.Id, doc with { PausedUntil = 0 }, version, now, ct);
            await LogConsentAsync(user, "pause", "off", "settings", now, ct);
        }
        return await GetAsync(user, ct);
    }

    public async Task<List<StanleyConsentDto>> HistoryAsync(UserRecord user, CancellationToken ct) =>
        [.. StanleyPermissionRules.ParseConsent((await state.GetAsync(false, user.Id, StanleyPermissionRules.ConsentKey, ct))?.Json).AsEnumerable().Reverse().Take(50)];

    // ---- Step-up: the emailed code, then a ten-minute single-use token -------------------------------------------------------------------------------------------------

    private async Task<(JsonObject Doc, int Version)> LoadStepUpAsync(long userId, CancellationToken ct) =>
        await state.GetAsync(false, userId, StanleyPermissionRules.StepUpKey, ct) is { } row && JsonNode.Parse(row.Json) is JsonObject o ? (o, row.Version) : (new JsonObject(), 0);

    private static PhoneCheckDoc CodeDoc(JsonObject o) => PhoneRules.Parse(o["code"]?.ToJsonString());
    private static string TokenHash(byte[] key, string token) => Convert.ToBase64String(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes("stepup|" + token)));

    /// <summary>Emails a code to the address on the account.</summary>
    public async Task<StanleyStepUpDto> SendStepUpAsync(UserRecord user, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        var address = EmailRules.Normalise(user.Email);
        if (address.Length == 0) throw ApiException.Invalid("email");
        var now = await clock.NowAsync(user, ct);
        var nowMs = Ms(now);
        var (o, version) = await LoadStepUpAsync(user.Id, ct);
        var doc = CodeDoc(o);
        if (!PhoneRules.CanSend(doc, nowMs)) throw ApiException.Conflict("tooSoon");
        var code = PhoneRules.NewCode();
        var salt = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
        var next = doc with { Phone = address, Hash = PhoneRules.Hash(Key, salt, address, code), Salt = salt, ExpiresAt = nowMs + PhoneRules.CodeMinutes * 60_000L, Attempts = 0, SentAt = nowMs };
        if (!await email.SendAsync(new EmailMessage(address, "Your Princess code to change what Stanley may do", StanleyPermissionRules.ComposeStepUp(code)), ct)) throw ApiException.Conflict("emailUnavailable");
        o["code"] = JsonNode.Parse(PhoneRules.ToJson(next));
        if (await state.SaveAsync(false, user.Id, StanleyPermissionRules.StepUpKey, o.ToJsonString(), version, now, ct) is null) throw ApiException.Conflict("changed");
        return new(true);
    }

    /// <summary>Checks the typed code and, if right, answers a token that works once for ten minutes.</summary>
    public async Task<StanleyStepUpDto> VerifyStepUpAsync(UserRecord user, StanleyStepUpVerifyRequest? body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        var now = await clock.NowAsync(user, ct);
        var nowMs = Ms(now);
        var (o, version) = await LoadStepUpAsync(user.Id, ct);
        var (result, next) = EmailRules.Check(CodeDoc(o), Key, user.Email, body?.Code, nowMs);
        string? token = null;
        o["code"] = JsonNode.Parse(PhoneRules.ToJson(next));
        if (result == PhoneRules.Result.Verified)
        {
            token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24)).Replace('+', '-').Replace('/', '_').TrimEnd('=');
            o["token"] = TokenHash(Key, token);
            o["tokenExpires"] = nowMs + StanleyPermissionRules.StepUpTokenMinutes * 60_000L;
        }
        if (result is PhoneRules.Result.Verified or PhoneRules.Result.Wrong)
            if (await state.SaveAsync(false, user.Id, StanleyPermissionRules.StepUpKey, o.ToJsonString(), version, now, ct) is null) throw ApiException.Conflict("changed");
        return result switch
        {
            PhoneRules.Result.Verified => new(true, token),
            PhoneRules.Result.Wrong => throw ApiException.Invalid("wrongCode"),
            PhoneRules.Result.Expired => throw ApiException.Invalid("expiredCode"),
            PhoneRules.Result.TooMany => throw ApiException.Invalid("tooManyTries"),
            _ => throw ApiException.Invalid("noCode"),
        };
    }

    /// <summary>Accepts a token once: a missing, wrong or old one is refused with 403 <c>stepUp</c>, and a used one is gone.</summary>
    private async Task ConsumeTokenAsync(UserRecord user, string? token, DateTime now, CancellationToken ct)
    {
        var (o, version) = await LoadStepUpAsync(user.Id, ct);
        var stored = o["token"] is JsonValue v && v.TryGetValue<string>(out var s) ? s : null;
        var expires = o["tokenExpires"] is JsonValue e && e.TryGetValue<long>(out var l) ? l : 0;
        if (string.IsNullOrEmpty(token) || stored is null || Ms(now) > expires
            || !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(stored), Encoding.UTF8.GetBytes(TokenHash(Key, token)))) throw ApiException.Forbidden("stepUp");
        o.Remove("token"); o.Remove("tokenExpires");
        if (await state.SaveAsync(false, user.Id, StanleyPermissionRules.StepUpKey, o.ToJsonString(), version, now, ct) is null) throw ApiException.Forbidden("stepUp");
    }
}
