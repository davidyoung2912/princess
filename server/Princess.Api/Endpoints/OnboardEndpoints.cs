using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Phase 10a: the on-board day, the programme, the port day, muster, the emergency card, the account and Guest Services chat (data model section 6.5). Any guest reads, an adult guest writes.</summary>
public static class OnboardEndpoints
{
    public static void MapOnboardEndpoints(this IEndpointRouteBuilder api)
    {
        var b = api.MapGroup("/bookings/{number}");

        var ob = b.MapGroup("/onboard").WithTags("On board");
        ob.MapGet("/today", async (string number, ICurrentUser me, OnboardService svc, CancellationToken ct) => Results.Ok(await svc.TodayAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Today on board: the cruise day, port, weather, the next port day with its all-aboard countdown, muster and any clock change tonight.");
        ob.MapGet("/port", async (string number, ICurrentUser me, OnboardService svc, CancellationToken ct) => Results.Ok(await svc.PortTodayAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The port the ship is in now, or sea.");
        ob.MapGet("/program/{day:int}", async (string number, int day, ICurrentUser me, OnboardService svc, CancellationToken ct) => Results.Ok(await svc.ProgramAsync(await me.LoadAsync(ct), number, day, ct)))
            .WithSummary("The daily programme for cruise day 1 to 8, with the caller's plan for that day. 400 day.");
        ob.MapPut("/plan/{eventId}", async (string number, string eventId, PlanToggleRequest body, ICurrentUser me, OnboardService svc, CancellationToken ct) =>
                Results.Ok(await svc.TogglePlanAsync(await me.LoadAsync(ct), number, eventId, body, ct)))
            .WithSummary("Adds an event to the caller's plan for one day, or removes it, and returns that day's plan. 400 event or day; 403 for a child account.");
        ob.MapGet("/port-day", async (string number, ICurrentUser me, OnboardService svc, CancellationToken ct) =>
                await svc.PortDayAsync(await me.LoadAsync(ct), number, ct) is { } v ? Results.Ok(v) : Results.Text("null", "application/json"))
            .WithSummary("The next port day: all-aboard countdown, tender call time and ship tours. A JSON null once the last port has been left.");
        ob.MapGet("/muster", async (string number, ICurrentUser me, OnboardService svc, CancellationToken ct) => Results.Ok(await svc.MusterAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The muster drill: time, station and who has checked in.");
        ob.MapPost("/muster", async (string number, MusterConfirmRequest body, ICurrentUser me, OnboardService svc, CancellationToken ct) =>
                Results.Ok(await svc.ConfirmMusterAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Checks guests in at the muster station. 400 guests; 403 for a child account; 409 notOpen (more than an hour before the drill) or closed.");
        ob.MapGet("/emergency", async (string number, ICurrentUser me, OnboardService svc, CancellationToken ct) => Results.Ok(await svc.EmergencyAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The emergency card: stateroom, station, who to call and what to say.");
        ob.MapGet("/folio", async (string number, ICurrentUser me, OnboardService svc, CancellationToken ct) => Results.Ok(await svc.FolioAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The onboard account up to today: charges, credits, what packages covered and the balance. 403 for a child account.");

        b.MapGet("/entitlements", async (string number, ICurrentUser me, PlanService svc, CancellationToken ct) => Results.Ok(await svc.OwnEntitlementsAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("On board").WithSummary("The caller's package and tier entitlements and what is left of them.");

        var sv = b.MapGroup("/service").WithTags("Guest Services chat");
        sv.MapGet("/channels", async (string number, ICurrentUser me, ServiceChatService svc, CancellationToken ct) => Results.Ok(await svc.ChannelsAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The five chat channels with the usual wait and whether a reply is awaited.");
        sv.MapGet("/{channel}", async (string number, string channel, ICurrentUser me, ServiceChatService svc, CancellationToken ct) => Results.Ok(await svc.ThreadAsync(await me.LoadAsync(ct), number, channel, ct)))
            .WithSummary("One conversation. Crew replies appear once their time has come. 400 channel.");
        sv.MapPost("/{channel}", async (string number, string channel, ServiceSendRequest body, ICurrentUser me, ServiceChatService svc, CancellationToken ct) =>
                Results.Ok(await svc.SendAsync(await me.LoadAsync(ct), number, channel, body, ct)))
            .WithSummary("Sends a message (up to 1000 characters). 400 text or channel; 403 for a child account.");
        sv.MapPost("/{channel}/escalate", async (string number, string channel, ServiceEscalateRequest body, ICurrentUser me, ServiceChatService svc, CancellationToken ct) =>
                Results.Ok(await svc.EscalateAsync(await me.LoadAsync(ct), number, channel, body, ct)))
            .WithSummary("Asks for a phone call instead of waiting. 400 phone or channel; 403 for a child account.");
    }
}
