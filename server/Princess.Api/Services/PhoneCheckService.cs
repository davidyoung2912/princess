using Microsoft.Extensions.Options;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Checking the guest's phone number by text (see <see cref="PhoneRules"/>). Until the number on the profile is confirmed, text notices are not sent to it.
/// The waiting code and the confirmed number are kept in the guest's own state under a key the client cannot read or write.
/// </summary>
public sealed class PhoneCheckService(IStateStore state, IAccountStore profiles, ISmsSender sms, IUserClock clock, IOptions<JwtOptions> jwt)
{
    private byte[] Key => PhoneRules.KeyFrom(jwt.Value.SigningKey);

    private async Task<(PhoneCheckDoc Doc, int Version)> LoadAsync(long userId, CancellationToken ct) =>
        await state.GetAsync(false, userId, PhoneRules.StateKey, ct) is { } row ? (PhoneRules.Parse(row.Json), row.Version) : (PhoneRules.Parse(null), 0);

    private async Task SaveAsync(long userId, PhoneCheckDoc doc, int version, DateTime now, CancellationToken ct)
    {
        if (await state.SaveAsync(false, userId, PhoneRules.StateKey, PhoneRules.ToJson(doc), version, now, ct) is null) throw ApiException.Conflict("changed");
    }

    /// <summary>Whether texts may go to the number on the profile now.</summary>
    public async Task<bool> IsVerifiedAsync(long userId, string? profilePhone, CancellationToken ct) =>
        PhoneRules.Normalise(profilePhone).Length > 0 && PhoneRules.IsVerified((await LoadAsync(userId, ct)).Doc, profilePhone);

    public async Task<PhoneCheckDto> StatusAsync(UserRecord actor, CancellationToken ct)
    {
        var phone = (await profiles.GetProfileAsync(actor.Id, ct))?.Phone;
        var (doc, _) = await LoadAsync(actor.Id, ct);
        return new(PhoneRules.Normalise(phone).Length > 0, PhoneRules.IsVerified(doc, phone), doc.Hash is not null && doc.Phone == PhoneRules.Normalise(phone));
    }

    /// <summary>Texts a new code to the number on the profile.</summary>
    public async Task<PhoneCheckDto> SendCodeAsync(UserRecord actor, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var phone = (await profiles.GetProfileAsync(actor.Id, ct))?.Phone;
        if (!AccountRules.PhoneOk(phone)) throw ApiException.Invalid("phone");
        var now = await clock.NowAsync(actor, ct);
        var nowMs = TripRules.ToMs(now);
        var (doc, version) = await LoadAsync(actor.Id, ct);
        if (!PhoneRules.CanSend(doc, nowMs)) throw ApiException.Conflict("tooSoon");
        var number = PhoneRules.Normalise(phone);
        var code = PhoneRules.NewCode();
        var salt = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16));
        // Asking again does not undo a number already confirmed; the new code only replaces the waiting one.
        var next = doc with { Phone = number, Hash = PhoneRules.Hash(Key, salt, number, code), Salt = salt, ExpiresAt = nowMs + PhoneRules.CodeMinutes * 60_000L, Attempts = 0, SentAt = nowMs };
        if (!await sms.SendAsync(new SmsMessage(phone!.Trim(), PhoneRules.Compose(code)), ct)) throw ApiException.Conflict("smsUnavailable");
        await SaveAsync(actor.Id, next, version, now, ct);
        return await StatusAsync(actor, ct);
    }

    /// <summary>Checks the typed code; confirms the number on success.</summary>
    public async Task<PhoneCheckDto> ConfirmAsync(UserRecord actor, string? code, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var phone = (await profiles.GetProfileAsync(actor.Id, ct))?.Phone;
        var now = await clock.NowAsync(actor, ct);
        var (doc, version) = await LoadAsync(actor.Id, ct);
        var (result, next) = PhoneRules.Check(doc, Key, phone, code, TripRules.ToMs(now));
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
