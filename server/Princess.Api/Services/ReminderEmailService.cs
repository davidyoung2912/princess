using System.Net;
using Microsoft.Extensions.Options;
using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The optional email for "remind me in a week" (small delights DL5). Sent once for the date the guest chose, only if they turned it on, to the address on their
/// account, through <see cref="IEmailSender"/>. Every email carries a link that switches it off with no sign-in. Like the push check, it runs when the app asks and
/// a scheduler calling <see cref="SendIfDueAsync"/> replaces that with no change to the rules.
/// </summary>
public sealed class ReminderEmailService(IStateStore state, IPushStore pushStore, IEmailSender email, ITripStore trips, IUserClock clock, IOptions<JwtOptions> jwt, IConfiguration config)
{
    private byte[] Key => ReminderRules.KeyFrom(jwt.Value.SigningKey);

    private string UnsubscribeUrl(long userId, long at) =>
        $"{(config["Public:ApiBaseUrl"] ?? "").TrimEnd('/')}/api/v1/public/reminder/unsubscribe/{ReminderRules.Token(Key, userId, at)}";

    /// <summary>Sends the email if it is due and has not gone for this date. Returns whether one was sent now.</summary>
    public async Task<bool> SendIfDueAsync(UserRecord actor, CancellationToken ct)
    {
        var doc = ReminderRules.Parse((await state.GetAsync(false, actor.Id, "reminder", ct))?.Json);
        if (doc is null || !doc.Email) return false;
        var now = await clock.NowAsync(actor, ct);
        var key = ReminderRules.EmailKey(doc.At);
        var sent = (await pushStore.ListDeliveriesAsync(actor.Id, 200, ct)).Any(l => l.NoticeKey == key && l.Outcome == "sent");
        if (!ReminderRules.EmailDue(doc, TripRules.ToMs(now), actor.Email, sent)) return false;

        var departure = (await trips.ListSailingsAsync(ct)).FirstOrDefault(s => s.Id == doc.SailingId)?.Departure.ToString("yyyy-MM-dd");
        var (subject, body) = ReminderRules.Compose(departure, UnsubscribeUrl(actor.Id, doc.At));
        if (!await email.SendAsync(new(actor.Email!, subject, body), ct)) return false;   // not accepted: tried again at the next check
        await pushStore.AddDeliveryAsync(actor.Id, new(key, "reminder", false, "sent", null, 0, "{}", now, true), now, ct);
        return true;
    }

    /// <summary>Switches the email off for the reminder the link was made for. False when the link is not one of ours.</summary>
    public async Task<bool> UnsubscribeAsync(string? token, CancellationToken ct)
    {
        if (ReminderRules.Verify(Key, token) is not { } who) return false;
        if (await state.GetAsync(false, who.UserId, "reminder", ct) is { } row)
            await state.SaveAsync(false, who.UserId, "reminder", ReminderRules.WithoutEmail(row.Json), row.Version, DateTime.UtcNow, ct);
        return true;
    }

    public static string Page(bool ok) =>
        $"<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Reminder email</title><body style=\"font-family:system-ui;max-width:32rem;margin:3rem auto;padding:0 1rem\"><h1>{(ok ? "No more email" : "That link does not work")}</h1><p>{WebUtility.HtmlEncode(ok ? "You will not get the reminder email. Nothing else has changed." : "It may be mistyped or out of date. You can also turn the email off in the app.")}</p></body></html>";
}
