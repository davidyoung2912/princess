using Microsoft.Extensions.Options;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Checking the guest's email address by emailed code (see <see cref="EmailRules"/>). Until the address on the account is confirmed, payment and travel
/// notice emails are not sent to it. State is kept under a key the client cannot read or write.
/// </summary>
public sealed class EmailCheckService(IStateStore state, IEmailSender email, IUserClock clock, IOptions<JwtOptions> jwt)
{
    private byte[] Key => EmailRules.KeyFrom(jwt.Value.SigningKey);

    private async Task<(PhoneCheckDoc Doc, int Version)> LoadAsync(long userId, CancellationToken ct) =>
        await state.GetAsync(false, userId, EmailRules.StateKey, ct) is { } row ? (PhoneRules.Parse(row.Json), row.Version) : (PhoneRules.Parse(null), 0);

    private async Task SaveAsync(long userId, PhoneCheckDoc doc, int version, DateTime now, CancellationToken ct)
    {
        if (await state.SaveAsync(false, userId, EmailRules.StateKey, PhoneRules.ToJson(doc), version, now, ct) is null) throw ApiException.Conflict("changed");
    }

    /// <summary>Whether notice emails may go to the account's address now.</summary>
    public async Task<bool> IsVerifiedAsync(UserRecord actor, CancellationToken ct) =>
        EmailRules.Normalise(actor.Email).Length > 0 && EmailRules.IsVerified((await LoadAsync(actor.Id, ct)).Doc, actor.Email);

    public async Task<EmailCheckDto> StatusAsync(UserRecord actor, CancellationToken ct)
    {
        var (doc, _) = await LoadAsync(actor.Id, ct);
        var e = EmailRules.Normalise(actor.Email);
        return new(e.Length > 0, EmailRules.IsVerified(doc, actor.Email), doc.Hash is not null && doc.Phone == e);
    }

    /// <summary>Emails a new code to the address on the account.</summary>
    public async Task<EmailCheckDto> SendCodeAsync(UserRecord actor, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var address = EmailRules.Normalise(actor.Email);
        if (address.Length == 0) throw ApiException.Invalid("email");
        var now = await clock.NowAsync(actor, ct);
        var nowMs = TripRules.ToMs(now);
        var (doc, version) = await LoadAsync(actor.Id, ct);
        if (!PhoneRules.CanSend(doc, nowMs)) throw ApiException.Conflict("tooSoon");
        var code = PhoneRules.NewCode();
        var salt = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16));
        var next = doc with { Phone = address, Hash = PhoneRules.Hash(Key, salt, address, code), Salt = salt, ExpiresAt = nowMs + PhoneRules.CodeMinutes * 60_000L, Attempts = 0, SentAt = nowMs };
        if (!await email.SendAsync(new EmailMessage(address, "Your Princess email check code", EmailRules.Compose(code)), ct)) throw ApiException.Conflict("emailUnavailable");
        await SaveAsync(actor.Id, next, version, now, ct);
        return await StatusAsync(actor, ct);
    }

    /// <summary>Checks the typed code; confirms the address on success.</summary>
    public async Task<EmailCheckDto> ConfirmAsync(UserRecord actor, string? code, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var now = await clock.NowAsync(actor, ct);
        var (doc, version) = await LoadAsync(actor.Id, ct);
        var (result, next) = EmailRules.Check(doc, Key, actor.Email, code, TripRules.ToMs(now));
        if (next != doc) await SaveAsync(actor.Id, next, version, now, ct);
        return result switch
        {
            PhoneRules.Result.Verified => await StatusAsync(actor, ct),
            PhoneRules.Result.Wrong => throw ApiException.Invalid("wrongCode"),
            PhoneRules.Result.Expired => throw ApiException.Invalid("expiredCode"),
            PhoneRules.Result.TooMany => throw ApiException.Invalid("tooManyTries"),
            _ => throw ApiException.Invalid("noCode"),
        };
    }
}
