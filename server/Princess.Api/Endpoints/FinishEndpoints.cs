using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Phase 11: disembarkation, cases, the trip history, feedback, loyalty and rebooking (data model section 6.6). Any guest reads, an adult guest writes.</summary>
public static class FinishEndpoints
{
    public static void MapFinishEndpoints(this IEndpointRouteBuilder api)
    {
        var b = api.MapGroup("/bookings/{number}");

        var d = b.MapGroup("/disembark").WithTags("Disembarkation");
        d.MapGet("", async (string number, ICurrentUser me, DisembarkService svc, CancellationToken ct) => Results.Ok(await svc.ViewAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("How the booking gets off: the choice, the luggage tag group, each guest's bags, the times and when each choice can leave the ship.");
        d.MapPut("/choice", async (string number, DisembarkChoiceRequest body, ICurrentUser me, DisembarkService svc, CancellationToken ct) => Results.Ok(await svc.ChooseAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Chooses tagged bags, self-assist or an early walk-off, with the bags of each guest. 400 badOption, badBags, tooManyToCarry or noBags; 403 for a child account; 409 closed or deadline (after the bags-out time).");
        d.MapPut("/tags", async (string number, TagsOnRequest body, ICurrentUser me, DisembarkService svc, CancellationToken ct) => Results.Ok(await svc.SetTagsOnAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Says the luggage tags are on. 409 notTagged when the choice is not tagged bags.");
        d.MapGet("/customs", async (string number, ICurrentUser me, DisembarkService svc, CancellationToken ct) => Results.Ok(await svc.CustomsAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The customs declaration with what must be declared and the family's allowance.");
        d.MapPut("/customs", async (string number, CustomsRequest body, ICurrentUser me, DisembarkService svc, CancellationToken ct) => Results.Ok(await svc.SaveCustomsAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Saves the declaration. 400 badGoods or badNote; 403 for a child account; 409 closed.");
        d.MapGet("/onward", async (string number, ICurrentUser me, DisembarkService svc, CancellationToken ct) => Results.Ok(await svc.OnwardAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The onward travel plan and whether the flight can be made from when the booking leaves the ship.");
        d.MapPut("/onward", async (string number, OnwardRequest body, ICurrentUser me, DisembarkService svc, CancellationToken ct) => Results.Ok(await svc.SaveOnwardAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Saves the plan. 400 badMode, badFlightTime, badFlight or badNote; 403 for a child account.");
        d.MapGet("/night", async (string number, ICurrentUser me, DisembarkService svc, CancellationToken ct) => Results.Ok(await svc.NightAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The final night checklist, each item with when it is due and whether it is done.");
        d.MapPut("/night/{id}", async (string number, string id, NightTickRequest body, ICurrentUser me, DisembarkService svc, CancellationToken ct) => Results.Ok(await svc.TickAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithSummary("Ticks an item or clears it. 400 badItem, or automatic for an item that is done by doing the thing; 403 for a child account; 409 closed.");
        d.MapGet("/final-bill", async (string number, ICurrentUser me, DisembarkService svc, CancellationToken ct) => Results.Ok(await svc.FinalBillAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The final bill: the card charged, the gratuity and what can be kept, the receipts and bill queries.");
        d.MapPut("/final-bill/tip", async (string number, TipKeepRequest body, ICurrentUser me, DisembarkService svc, CancellationToken ct) => Results.Ok(await svc.AdjustTipAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Keeps 100, 75, 50 or 0 percent of the daily gratuity. 400 badTip; 403 for a child account; 409 closed or deadline.");
        d.MapPost("/final-bill/email", async (string number, ICurrentUser me, DisembarkService svc, CancellationToken ct) => Results.Ok(await svc.EmailReceiptAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Emails the receipts to the caller. 400 noEmail; 403 for a child account; 409 closed before the final evening.");

        var cel = b.MapGroup("/celebrations").WithTags("Celebrations");
        cel.MapGet("", async (string number, ICurrentUser me, CelebrationService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The birthdays and anniversaries the booking has told the ship about, each as { id, label, date (MM-DD), surprise, toldAt }, and whether the caller can change them.");
        cel.MapPut("", async (string number, CelebrationsRequest body, ICurrentUser me, CelebrationService svc, CancellationToken ct) => Results.Ok(await svc.SaveAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Replaces the list (at most 12) and tells the ship about every new or changed entry. Only the month and day are kept. 400 badCelebrations, tooManyCelebrations, badLabel or badDate; 403 for a child account; 409 notConfirmed.");

        var cs = b.MapGroup("/cases").WithTags("Cases");
        cs.MapGet("", async (string number, ICurrentUser me, CaseService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The booking's lost-item, bill, claim, complaint and recovery cases, newest first, each with its stage worked out from the clock.");
        cs.MapPost("", async (string number, OpenCaseRequest body, ICurrentUser me, CaseService svc, CancellationToken ct) => Results.Ok(await svc.OpenAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Opens a case. 400 badKind, badSummary, badPlace, noPlace, noLine or badAmount; 403 for a child account; 409 closed, tooManyCases or alreadyQueried.");
        cs.MapDelete("/{id:guid}", async (string number, Guid id, ICurrentUser me, CaseService svc, CancellationToken ct) => Results.Ok(await svc.WithdrawAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Withdraws a case that has not been answered. 409 tooLate once it has.");

        var p = b.MapGroup("").WithTags("After the cruise");
        p.MapGet("/history", async (string number, ICurrentUser me, PostService svc, CancellationToken ct) => Results.Ok(await svc.HistoryAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("This cruise (once the ship has tied up) and the caller's past trips, with the documents ready to open.");
        p.MapGet("/post-feedback", async (string number, ICurrentUser me, PostService svc, CancellationToken ct) => Results.Ok(await svc.FeedbackAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The booking's feedback, whether it can still be changed and the crew to thank.");
        p.MapPut("/post-feedback", async (string number, FeedbackRequest body, ICurrentUser me, PostService svc, CancellationToken ct) => Results.Ok(await svc.SaveFeedbackAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Saves feedback; a poor score with permission to be contacted starts a service-recovery case. 400 noOverall, badRating, badComment or badCrew; 403 for a child account; 409 closed or expired.");
        var r = b.MapGroup("/rebook").WithTags("Rebooking");
        r.MapGet("", async (string number, ICurrentUser me, PostService svc, CancellationToken ct) => Results.Ok(await svc.RebookAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Future departures to hold with their price, deposit and onboard credit, the holds, the future cruise credit and the Future Cruise Desk slots.");
        r.MapPost("/holds", async (string number, HoldRequest body, ICurrentUser me, PostService svc, CancellationToken ct) => Results.Ok(await svc.HoldAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Holds a departure for a week. 400 badDeparture; 403 for a child account; 409 closed, alreadyHeld or tooManyHolds.");
        r.MapDelete("/holds/{id:guid}", async (string number, Guid id, ICurrentUser me, PostService svc, CancellationToken ct) => Results.Ok(await svc.ReleaseHoldAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Lets a hold go and takes back the onboard credit it came with.");
        r.MapPost("/convert-fcc", async (string number, ICurrentUser me, PostService svc, CancellationToken ct) => Results.Ok(await svc.ConvertFccAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Changes the booker's future cruise credit to onboard credit. 400 noCredit; 403 for a child account; 409 closed.");
        r.MapPost("/appointment", async (string number, SlotRequest body, ICurrentUser me, PostService svc, CancellationToken ct) => Results.Ok(await svc.BookSlotAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Books a Future Cruise Desk slot, moving an earlier one. 400 badSlot; 403 for a child account; 409 closed or taken.");
        r.MapDelete("/appointment", async (string number, ICurrentUser me, PostService svc, CancellationToken ct) => Results.Ok(await svc.CancelSlotAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Cancels the Future Cruise Desk appointment.");

        api.MapGet("/me/loyalty-summary", async (ICurrentUser me, PostService svc, CancellationToken ct) => Results.Ok(await svc.LoyaltyAsync(await me.LoadAsync(ct), ct)))
            .WithTags("After the cruise").WithSummary("Captain's Circle progress and the referral code. Once the ship has tied up, the latest cruise's days count.");
    }
}
