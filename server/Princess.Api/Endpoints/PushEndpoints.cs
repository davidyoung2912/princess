using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Next-level plan N3: alerts to the phone (with the log of what was sent or held) and the subscribable calendar.</summary>
public static class PushEndpoints
{
    public static void MapPushEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/me/push", async (string? endpoint, ICurrentUser me, PushService svc, CancellationToken ct) =>
                Results.Ok(await svc.StatusAsync(await me.LoadAsync(ct), endpoint, ct)))
            .WithTags("Push").WithSummary("Whether alerts can reach this phone, the limits it asked for, and the log of what was sent or held back and why.");

        api.MapPut("/me/push/subscription", async (PushSubscribeRequest body, ICurrentUser me, PushService svc, CancellationToken ct) =>
                Results.Ok(await svc.SubscribeAsync(await me.LoadAsync(ct), body, ct)))
            .WithTags("Push").WithSummary("Registers this phone for alerts, or updates its limits (budget, calm mode, events to watch).");

        api.MapPost("/me/push/unsubscribe", async (PushUnsubscribeRequest body, ICurrentUser me, PushService svc, CancellationToken ct) =>
                Results.Ok(await svc.UnsubscribeAsync(await me.LoadAsync(ct), body, ct)))
            .WithTags("Push").WithSummary("Stops alerts to this phone.");

        api.MapPost("/me/push/dispatch", async (string? endpoint, ICurrentUser me, PushService svc, ReminderEmailService reminders, CancellationToken ct) =>
            {
                var actor = await me.LoadAsync(ct);
                await reminders.SendIfDueAsync(actor, ct);   // the "remind me" email, if the guest asked for it and the time has come
                return Results.Ok(await svc.DispatchAsync(actor, endpoint, ct));
            })
            .WithTags("Push").WithSummary("Checks what the guest should hear now and sends it within their limits, and sends the reminder email if they asked for one and it is due.");

        api.MapGet("/public/reminder/unsubscribe/{token}", async (string token, ReminderEmailService svc, CancellationToken ct) =>
                Results.Content(ReminderEmailService.Page(await svc.UnsubscribeAsync(token, ct)), "text/html"))
            .AllowAnonymous().RequireRateLimiting(CheckinEndpoints.LookupLimiter)
            .WithTags("Push").WithSummary("The link in the reminder email: switches that email off with no sign-in and answers a small page. A link that was not made here gets the same page saying it does not work. Rate-limited.");

        api.MapGet("/public/notice/unsubscribe/{token}", async (string token, PushService svc, CancellationToken ct) =>
                Results.Content(PushService.UnsubscribePage(await svc.UnsubscribeEmailAsync(token, ct)), "text/html"))
            .AllowAnonymous().RequireRateLimiting(CheckinEndpoints.LookupLimiter)
            .WithTags("Push").WithSummary("The link in a payment or travel notice email: switches that category's email off with no sign-in and answers a small page. A link that was not made here gets the same page saying it does not work. Rate-limited.");

        api.MapPost("/public/notice/unsubscribe/{token}", async (string token, PushService svc, CancellationToken ct) =>
                await svc.UnsubscribeEmailAsync(token, ct) ? Results.Ok() : Results.NotFound())
            .AllowAnonymous().RequireRateLimiting(CheckinEndpoints.LookupLimiter)
            .WithTags("Push").WithSummary("The one-click unsubscribe a mail app posts to (RFC 8058, from the List-Unsubscribe headers on notice emails). Same link and effect as the page; 404 for a link that was not made here. Rate-limited.");

        api.MapPost("/me/push/read", async (ICurrentUser me, PushService svc, CancellationToken ct) =>
                Results.Ok(await svc.MarkReadAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Push").WithSummary("Marks the sent alerts as seen (clears the unread count).");

        api.MapGet("/me/phone-check", async (ICurrentUser me, PhoneCheckService svc, CancellationToken ct) =>
                Results.Ok(await svc.StatusAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Push").WithSummary("Whether the phone number on the profile has been confirmed by text.");

        api.MapPost("/me/phone-check/code", async (ICurrentUser me, PhoneCheckService svc, CancellationToken ct) =>
                Results.Ok(await svc.SendCodeAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Push").WithSummary("Texts a six-digit code to the number on the profile (400 phone when there is none; 409 tooSoon within a minute of the last).");

        api.MapPost("/me/phone-check/confirm", async (PhoneCodeRequest body, ICurrentUser me, PhoneCheckService svc, CancellationToken ct) =>
                Results.Ok(await svc.ConfirmAsync(await me.LoadAsync(ct), body.Code, ct)))
            .WithTags("Push").WithSummary("Confirms the number with the code (400 wrongCode, expiredCode, tooManyTries or noCode). Text notices go only to a confirmed number.");

        api.MapGet("/me/email-check", async (ICurrentUser me, EmailCheckService svc, CancellationToken ct) =>
                Results.Ok(await svc.StatusAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Push").WithSummary("Whether the email address on the account has been confirmed by an emailed code.");

        api.MapPost("/me/email-check/code", async (ICurrentUser me, EmailCheckService svc, CancellationToken ct) =>
                Results.Ok(await svc.SendCodeAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Push").WithSummary("Emails a six-digit code to the address on the account (400 email when there is none; 409 tooSoon within a minute of the last).");

        api.MapPost("/me/email-check/confirm", async (PhoneCodeRequest body, ICurrentUser me, EmailCheckService svc, CancellationToken ct) =>
                Results.Ok(await svc.ConfirmAsync(await me.LoadAsync(ct), body.Code, ct)))
            .WithTags("Push").WithSummary("Confirms the address with the code (400 wrongCode, expiredCode, tooManyTries or noCode). Payment and travel notice emails go only to a confirmed address.");

        api.MapGet("/me/calendar-feed", async (ICurrentUser me, CalendarFeedService svc, CancellationToken ct) =>
                Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Calendar").WithSummary("Whether the guest has a calendar feed.");

        api.MapPost("/me/calendar-feed", async (ICurrentUser me, CalendarFeedService svc, CancellationToken ct) =>
                Results.Ok(await svc.CreateAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Calendar").WithSummary("Makes the calendar feed (replacing any older address). The address is returned once.");

        api.MapDelete("/me/calendar-feed", async (ICurrentUser me, CalendarFeedService svc, CancellationToken ct) =>
                Results.Ok(await svc.RevokeAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Calendar").WithSummary("Turns the calendar feed off; its address stops working at once.");

        api.MapGet("/calendar/{token}", async (string token, CalendarFeedService svc, CancellationToken ct) =>
            {
                var text = token.EndsWith(".ics", StringComparison.Ordinal) ? await svc.RenderAsync(token[..^4], ct) : null;
                return text is null ? Results.NotFound() : Results.Text(text, "text/calendar; charset=utf-8");
            })
            .AllowAnonymous().WithTags("Calendar").WithSummary("The calendar feed itself. The address is the secret; no sign-in.");
    }
}
