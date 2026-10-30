using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Phase 9: online check-in, boarding passes and embarkation day (data model section 6.4). Any guest reads, an adult guest writes. The pass lookup is public and rate-limited.</summary>
public static class CheckinEndpoints
{
    public const string LookupLimiter = "pass-lookup";

    public static void MapCheckinEndpoints(this IEndpointRouteBuilder api)
    {
        var b = api.MapGroup("/bookings/{number}");

        var ci = b.MapGroup("/checkin").WithTags("Check-in");
        ci.MapGet("", async (string number, ICurrentUser me, CheckinService svc, CancellationToken ct) => Results.Ok(await svc.ViewAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Everything check-in shows: each guest's answers and progress, the card and arrival window, and whether the person can edit (not a child, and not after it closes).");
        ci.MapGet("/status", async (string number, ICurrentUser me, CheckinService svc, CancellationToken ct) => Results.Ok(await svc.StatusAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("notOpen, open, closed or done, with when it opens (three days before sailing) and closes (10:00 on sailing day).");
        ci.MapGet("/receipt", async (string number, ICurrentUser me, CheckinService svc, CancellationToken ct) => Results.Ok(await svc.ReceiptAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("What is on file, in words and never the whole passport number.");
        ci.MapPut("/steps/{step}", async (string number, string step, CheckinSaveRequest body, ICurrentUser me, CheckinService svc, CancellationToken ct) =>
                Results.Ok(await svc.SaveAsync(await me.LoadAsync(ct), number, step, body, ct)))
            .WithSummary("Saves one step: confirm, document, photo, emergency, contract, health, payment or arrival. 400 with a problem code such as document:expired or photo:dark; 402 declined; 403 for a child account; 409 notOpen or closed.");
        ci.MapPost("/submit", async (string number, ICurrentUser me, CheckinService svc, CancellationToken ct) => Results.Ok(await svc.SubmitAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Finishes check-in and issues the boarding passes. Repeating it is harmless. 409 notOpen, closed or incomplete.");

        var bd = b.MapGroup("/boarding").WithTags("Boarding");
        bd.MapGet("", async (string number, ICurrentUser me, CheckinService svc, CancellationToken ct) => Results.Ok(await svc.PassAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The booking's passes. The QR text is empty until check-in is finished.");
        bd.MapPost("/wallet", async (string number, ICurrentUser me, CheckinService svc, CancellationToken ct) => Results.Ok(await svc.AddToWalletAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Records that the passes are in the phone wallet. 409 notDone before check-in is finished.");

        var em = b.MapGroup("/embark").WithTags("Boarding");
        em.MapGet("", async (string number, ICurrentUser me, CheckinService svc, CancellationToken ct) => Results.Ok(await svc.EmbarkAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Embarkation day: times, luggage, carry-on list, the step-by-step companion and who the terminal nurse will see.");
        em.MapPut("/companion/{id}", async (string number, string id, TickRequest body, ICurrentUser me, CheckinService svc, CancellationToken ct) =>
                Results.Ok(await svc.SetCompanionAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithSummary("Ticks a companion card: terminal, security, photo, gangway, muster or cabin. 400 step.");
        em.MapPut("/carry-on/{id}", async (string number, string id, TickRequest body, ICurrentUser me, CheckinService svc, CancellationToken ct) =>
                Results.Ok(await svc.SetCarryOnAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithSummary("Ticks a carry-on item: documents, medication, swimwear, chargers or valuables. 400 item.");
        em.MapPut("/bags", async (string number, BagsRequest body, ICurrentUser me, CheckinService svc, CancellationToken ct) => Results.Ok(await svc.SetBagsAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Records that the bags were dropped with the porters now, or not.");

        api.MapGet("/pass/lookup", async (string? number, string? lastName, CheckinService svc, CancellationToken ct) => Results.Ok(await svc.LookupAsync(number, lastName, ct)))
            .AllowAnonymous().RequireRateLimiting(LookupLimiter).WithTags("Boarding")
            .WithSummary("A pass by booking number and any guest's last name, with no sign-in. Rate-limited; every mismatch is the same 404.");
    }
}
