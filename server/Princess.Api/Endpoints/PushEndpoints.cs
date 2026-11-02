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


        api.MapPost("/me/push/read", async (ICurrentUser me, PushService svc, CancellationToken ct) =>
                Results.Ok(await svc.MarkReadAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Push").WithSummary("Marks the sent alerts as seen (clears the unread count).");

        api.MapGet("/me/calendar-feed", async (ICurrentUser me, CalendarFeedService svc, CancellationToken ct) =>
                Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Calendar").WithSummary("Whether the guest has a calendar feed.");

        api.MapPost("/me/calendar-feed", async (ICurrentUser me, CalendarFeedService svc, CancellationToken ct) =>
                Results.Ok(await svc.CreateAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Calendar").WithSummary("Makes the calendar feed (replacing any older address). The address is returned once.");

        api.MapDelete("/me/calendar-feed", async (ICurrentUser me, CalendarFeedService svc, CancellationToken ct) =>
                Results.Ok(await svc.RevokeAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Calendar").WithSummary("Turns the calendar feed off; its address stops working at once.");

        api.MapGet("/calendar/{file}", async (string file, CalendarFeedService svc, CancellationToken ct) =>
            {
                var text = file.EndsWith(".ics", StringComparison.Ordinal) ? await svc.RenderAsync(file[..^4], ct) : null;
                return text is null ? Results.NotFound() : Results.Text(text, "text/calendar; charset=utf-8");
            })
            .AllowAnonymous().WithTags("Calendar").WithSummary("The calendar feed itself. The address is the secret; no sign-in.");
    }
}
