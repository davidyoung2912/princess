using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Phase 8b: waits, shows and the before-the-cruise services (data model section 6.3). Booking routes: any guest reads, an adult guest writes. <c>/me</c> routes belong to the signed-in person.</summary>
public static class AheadEndpoints
{
    public static void MapAheadEndpoints(this IEndpointRouteBuilder api)
    {
        var b = api.MapGroup("/bookings/{number}");
        MapWaits(b);
        MapShows(b);
        MapUpgrades(b);
        MapClubs(b);
        MapMedallionAndTags(b);
        MapPeople(api);
    }

    private static void MapWaits(RouteGroupBuilder b)
    {
        var g = b.MapGroup("/waits").WithTags("Waits");
        g.MapGet("", async (string number, ICurrentUser me, WaitService svc, CancellationToken ct) =>
                Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Walk-in places open now, the queues joined and the waitlisted tables. A waitlist set to book itself is booked as soon as the table is offered.");
        g.MapPost("/queue", async (string number, JoinQueueRequest body, ICurrentUser me, WaitService svc, CancellationToken ct) =>
                Results.Ok(await svc.JoinQueueAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Joins the virtual queue for a walk-in place. 409 closed (shut, or not aboard) or duplicate; 400 for a place with no queue.");
        g.MapDelete("/queue/{id:guid}", async (string number, Guid id, ICurrentUser me, WaitService svc, CancellationToken ct) =>
                Results.Ok(await svc.LeaveQueueAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Leaves a queue.");
        g.MapPost("/waitlist", async (string number, JoinWaitlistRequest body, ICurrentUser me, WaitService svc, CancellationToken ct) =>
                Results.Ok(await svc.JoinWaitlistAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Waits for a full table. 409 notFull (a table is free: book it), tooLate, duplicate, closed or clash; 400 for a bad venue, night, time or party.");
        g.MapDelete("/waitlist/{id:guid}", async (string number, Guid id, ICurrentUser me, WaitService svc, CancellationToken ct) =>
                Results.Ok(await svc.LeaveWaitlistAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Leaves a waitlist.");
        g.MapPost("/waitlist/{id:guid}/accept", async (string number, Guid id, ICurrentUser me, WaitService svc, CancellationToken ct) =>
                Results.Ok(await svc.AcceptAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Takes an offered table and returns the dining view. 409 notOffered or expired, or any refusal of POST dining/reservations other than full.");
    }

    private static void MapShows(RouteGroupBuilder b)
    {
        var g = b.MapGroup("/shows").WithTags("Shows");
        g.MapGet("", async (string number, int? day, ICurrentUser me, WaitService svc, CancellationToken ct) =>
                Results.Ok(await svc.SeatsAsync(await me.LoadAsync(ct), number, day ?? 0, ct)))
            .WithSummary("Seats left for each ticketed show and class on a day (1 to 8).");
        g.MapGet("/tickets", async (string number, ICurrentUser me, WaitService svc, CancellationToken ct) =>
                Results.Ok(await svc.TicketsAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Tickets held, soonest first.");
        g.MapPost("/tickets", async (string number, ReserveTicketsRequest body, ICurrentUser me, WaitService svc, CancellationToken ct) =>
                Results.Ok(await svc.ReserveTicketsAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Reserves seats. Seats are counted across every booking on the sailing. 409 soldOut, started, age, duplicate, party, closed; 400 for an unknown show, day or guest.");
        g.MapDelete("/tickets/{id:guid}", async (string number, Guid id, ICurrentUser me, WaitService svc, CancellationToken ct) =>
                Results.Ok(await svc.CancelTicketAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Gives the seats back. 409 started once the show has begun.");
    }

    private static void MapUpgrades(RouteGroupBuilder b)
    {
        var g = b.MapGroup("/upgrades").WithTags("Ahead: upgrades");
        g.MapGet("", async (string number, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.UpgradesAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Room types above the current one with the bid range, and the bids placed.");
        g.MapPost("", async (string number, PlaceBidRequest body, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.BidAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Places a bid. A bid at the buy-now price is accepted at once. 400 badCategory, tooLow, tooHigh or notWhole; 409 closed, duplicate or noCard.");
        g.MapDelete("/{id:guid}", async (string number, Guid id, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.WithdrawBidAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Withdraws an open bid. 409 closed once decided.");
    }

    private static void MapClubs(RouteGroupBuilder b)
    {
        var g = b.MapGroup("/clubs").WithTags("Ahead: clubs");
        g.MapGet("", async (string number, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.ClubsAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Each child on the booking, their club by age, and the registration (health notes only for the child's booker).");
        g.MapPut("/{childId:guid}", async (string number, Guid childId, SaveClubRequest body, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.SaveClubAsync(await me.LoadAsync(ct), number, childId, body, ct)))
            .WithSummary("Registers a child. Only the child's booker may. 400 with a club problem code, 403 for anyone else, 409 closed after sailing.");
        g.MapDelete("/{childId:guid}", async (string number, Guid childId, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.WithdrawClubAsync(await me.LoadAsync(ct), number, childId, ct)))
            .WithSummary("Withdraws a child's registration.");
    }

    private static void MapMedallionAndTags(RouteGroupBuilder b)
    {
        var m = b.MapGroup("/medallion").WithTags("Ahead: medallion");
        m.MapGet("", async (string number, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.MedallionAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Where the medallion is: preparing, shipped, delivered or to collect.");
        m.MapPost("/activate", async (string number, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.ActivateMedallionAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Activates a delivered medallion. 409 notDelivered, already or lost.");
        m.MapPost("/lost", async (string number, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.LostMedallionAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Switches off a lost medallion and orders a replacement for collection. 409 already.");

        var t = b.MapGroup("/bag-tags").WithTags("Ahead: bag tags");
        t.MapGet("", async (string number, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.TagsAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The way tags were chosen, the printed names and where the bags probably are.");
        t.MapPut("/way", async (string number, ChooseTagRequest body, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.ChooseTagsAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Chooses print, e-tag or a mailed set. 400 badWay; 409 tooLate for a mailed set inside 14 days, or closed.");
        t.MapPut("/handed-over", async (string number, HandedOverRequest body, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.HandedOverAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Records that the bags were handed to porters on embarkation day. 409 noTags or notYet.");

        var p = b.MapGroup("/prep").WithTags("Ahead: preparation");
        p.MapGet("", async (string number, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.PrepAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Ids of the health and comfort items ticked off.");
        p.MapPut("/{id}", async (string number, string id, TickRequest body, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.TickPrepAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithSummary("Ticks or unticks an item. 400 badItem.");
    }

    private static void MapPeople(IEndpointRouteBuilder api)
    {
        var adv = api.MapGroup("/me/advisor-requests").WithTags("Ahead: advisors");
        adv.MapGet("", async (ICurrentUser me, AheadService svc, CancellationToken ct) => Results.Ok(await svc.AdvisorsAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("Requests made to travel advisors, newest first.");
        adv.MapPost("", async (AskAdvisorRequest body, ICurrentUser me, AheadService svc, CancellationToken ct) => Results.Ok(await svc.AskAdvisorAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Asks an advisor by chat (a scripted reply comes back) or call-back (promised within a day). 400 badAdvisor, badWay, badPhone or noQuestion.");

        var mk = api.MapGroup("/me/marketing").WithTags("Ahead: marketing");
        mk.MapGet("", async (ICurrentUser me, AheadService svc, CancellationToken ct) => Results.Ok(await svc.MarketingAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("Email and text choices. `demoCode` is filled only for demo users, because the message is not really sent.");
        mk.MapPost("/{channel}/subscribe", async (string channel, SubscribeRequest body, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.SubscribeAsync(await me.LoadAsync(ct), channel, body, ct)))
            .WithSummary("Asks to be contacted. In Canada, the UK and the EU nothing is subscribed until the code is confirmed. 400 badChannel, badEmail, badPhone or badRegion.");
        mk.MapPost("/{channel}/confirm", async (string channel, ConfirmConsentRequest body, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.ConfirmAsync(await me.LoadAsync(ct), channel, body, ct)))
            .WithSummary("Enters the code from the first message. 400 wrongCode; 409 expired or nothingPending.");
        mk.MapDelete("/{channel}", async (string channel, ICurrentUser me, AheadService svc, CancellationToken ct) => Results.Ok(await svc.WithdrawAsync(await me.LoadAsync(ct), channel, ct)))
            .WithSummary("Withdraws consent for a channel.");

        api.MapGet("/me/loyalty", async (ICurrentUser me, AheadService svc, CancellationToken ct) => Results.Ok(await svc.LoyaltyAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Ahead: loyalty").WithSummary("The person's Captain's Circle number and level, and the future cruise credit left.");

        var fix = api.MapGroup("/me/fix-cases").WithTags("Ahead: cases");
        fix.MapGet("", async (ICurrentUser me, AheadService svc, CancellationToken ct) => Results.Ok(await svc.FixCasesAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("Fix-it cases opened, newest first.");
        fix.MapPost("", async (EscalateRequest body, ICurrentUser me, AheadService svc, CancellationToken ct) => Results.Ok(await svc.EscalateAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Opens a case for a flow whose steps did not help. 400 badFlow or noNote; 409 duplicate.");

        var asst = api.MapGroup("/me/assist-cases").WithTags("Ahead: cases");
        asst.MapGet("", async (ICurrentUser me, AheadService svc, CancellationToken ct) => Results.Ok(await svc.AssistCasesAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("Assisted-booking, bereavement and medical cases.");
        asst.MapPost("", async (AskAssistCaseRequest body, ICurrentUser me, AheadService svc, CancellationToken ct) => Results.Ok(await svc.AskAssistAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Asks for help. 400 badKind, badPhone, noNote or noBooking (bereavement and medical need a booking the person made).");
        asst.MapPost("/{id:guid}/choice", async (Guid id, ChoiceRequest body, ICurrentUser me, AheadService svc, CancellationToken ct) =>
                Results.Ok(await svc.ChooseAssistAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Once decided, chooses a refund or future cruise credit. 400 badChoice; 409 notDecided or already.");
    }
}
