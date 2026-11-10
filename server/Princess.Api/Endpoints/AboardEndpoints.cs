using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Phase 10c: bookings and orders on board, requests, reports, drinks, money, parties, group tables, games, the TV, last-minute tours, port readiness and the group chat (data model section 6.5). Any guest reads, an adult guest writes (unless said otherwise).</summary>
public static class AboardEndpoints
{
    public static void MapAboardEndpoints(this IEndpointRouteBuilder api)
    {
        var b = api.MapGroup("/bookings/{number}");

        var s = b.MapGroup("/selections").WithTags("Bookings on board");
        s.MapGet("", async (string number, ICurrentUser me, SelectionService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Spa, fitness, shop, gift and community bookings on the booking, by day and time.");
        s.MapPost("", async (string number, SelectionRequest body, ICurrentUser me, SelectionService svc, CancellationToken ct) => Results.Ok(await svc.AddAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Books or orders an item and puts the charge on the account. 400 unknown, badDay, badTime, badQty, age or notBookable; 403 for a child account; 409 soldOut, closed, past or duplicate.");
        s.MapDelete("/{id:guid}", async (string number, Guid id, ICurrentUser me, SelectionService svc, CancellationToken ct) => Results.Ok(await svc.RemoveAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Cancels a booking and takes its charge off the account.");

        var r = b.MapGroup("/requests").WithTags("Stateroom requests");
        r.MapGet("", async (string number, ICurrentUser me, ServiceRequestService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("One-tap housekeeping and maintenance requests, newest first, each with its stage worked out from the clock.");
        r.MapPost("", async (string number, CreateServiceRequest body, ICurrentUser me, ServiceRequestService svc, CancellationToken ct) => Results.Ok(await svc.CreateAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Asks for an item or a repair. 400 badItem or badQuantity; 403 for a child account; 409 closed before boarding, tooMany open requests or duplicate of one still open.");
        r.MapDelete("/{id:guid}", async (string number, Guid id, ICurrentUser me, ServiceRequestService svc, CancellationToken ct) => Results.Ok(await svc.CancelAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Cancels a request. 409 tooLate once the crew is on the way.");
        r.MapPost("/{id:guid}/escalate", async (string number, Guid id, ICurrentUser me, ServiceRequestService svc, CancellationToken ct) => Results.Ok(await svc.EscalateAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Asks a supervisor to take up a request that is late. 409 notYet while it is still within its expected time or already escalated.");
        r.MapPost("/{id:guid}/confirm", async (string number, Guid id, ICurrentUser me, ServiceRequestService svc, CancellationToken ct) => Results.Ok(await svc.ConfirmAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Confirms that a finished request is fixed. 409 notDone.");
        r.MapPost("/{id:guid}/reopen", async (string number, Guid id, ICurrentUser me, ServiceRequestService svc, CancellationToken ct) => Results.Ok(await svc.ReopenAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Says a finished request is not fixed and starts it again, keeping its history. 409 cannotReopen once confirmed or after two reopens.");

        var sr = b.MapGroup("/safety-reports").WithTags("Safety reports");
        sr.MapGet("", async (string number, ICurrentUser me, SafetyReportService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The booking's security and man-overboard reports, newest first.");
        sr.MapPost("", async (string number, CreateSafetyReport body, ICurrentUser me, SafetyReportService svc, CancellationToken ct) => Results.Ok(await svc.CreateAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Files a report; any guest aboard, a child included, may. 400 badKind, noWhere, noNote or tooLong; 409 closed.");

        var d = b.MapGroup("/drinks").WithTags("Drinks tracker");
        d.MapGet("", async (string number, ICurrentUser me, DrinkService svc, CancellationToken ct) => Results.Ok(await svc.ViewAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The caller's drinks today, the package cap and whether to slow down.");
        d.MapPost("", async (string number, LogDrinkRequest body, ICurrentUser me, DrinkService svc, CancellationToken ct) => Results.Ok(await svc.LogAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Logs a drink for the caller. 400 badDrink; 403 age for alcohol under 21; 409 closed.");
        d.MapDelete("/{id:guid}", async (string number, Guid id, ICurrentUser me, DrinkService svc, CancellationToken ct) => Results.Ok(await svc.UndoAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Takes back one of the caller's own drinks.");

        var m = b.MapGroup("/money").WithTags("Money");
        m.MapGet("", async (string number, ICurrentUser me, MoneyService svc, CancellationToken ct) => Results.Ok(await svc.ViewAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Top-ups, whether a card and a PIN are set, the gratuity choice and the display currency.");
        m.MapPost("/top-ups", async (string number, TopUpRequest body, ICurrentUser me, MoneyService svc, CancellationToken ct) => Results.Ok(await svc.TopUpAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Adds money to the account by card or cash (cash counts after the desk enters it). 400 badSource or badAmount; 409 tooMuch, noCard or closed.");
        m.MapPut("/pin", async (string number, SetPinRequest body, ICurrentUser me, MoneyService svc, CancellationToken ct) => Results.Ok(await svc.SetPinAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Sets or changes the account PIN. 400 format or weak; 403 wrongPin; 409 locked after five wrong guesses.");
        m.MapPost("/forgot-pin", async (string number, ICurrentUser me, MoneyService svc, CancellationToken ct) => Results.Ok(await svc.ForgotPinAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Asks Guest Services, in chat, to reset the PIN in person.");
        m.MapPut("/gratuity", async (string number, GratuityRequest body, ICurrentUser me, MoneyService svc, CancellationToken ct) => Results.Ok(await svc.GratuityAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Prepays gratuities or asks for them to be removed (with a reason). 400 badChoice or noReason; 409 nothingDue, already, noCard or closed.");
        m.MapPut("/currency", async (string number, CurrencyRequest body, ICurrentUser me, MoneyService svc, CancellationToken ct) => Results.Ok(await svc.SetCurrencyAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Chooses the currency the account is shown in. 400 badCurrency.");

        var p = b.MapGroup("/parties").WithTags("Cabin parties");
        p.MapGet("", async (string number, ICurrentUser me, CabinPartyService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The booking's cabin parties with the neighbours invited.");
        p.MapPost("", async (string number, CreatePartyRequest body, ICurrentUser me, CabinPartyService svc, CancellationToken ct) => Results.Ok(await svc.CreateAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Plans a party. 400 noTitle, badDay, badTime, quiet, noCabins, tooMany or badCabin; 403 age under 21; 409 closed or past.");
        p.MapDelete("/{id:guid}", async (string number, Guid id, ICurrentUser me, CabinPartyService svc, CancellationToken ct) => Results.Ok(await svc.CancelAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Cancels a party.");

        var g = b.MapGroup("/dining/reservations/{reservation:guid}/group").WithTags("Group tables");
        g.MapGet("", async (string number, Guid reservation, ICurrentUser me, GroupTableService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), number, reservation, ct)))
            .WithSummary("The friends joining a dinner table and how the bill is split.");
        g.MapPost("/friends", async (string number, Guid reservation, AddFriendRequest body, ICurrentUser me, GroupTableService svc, CancellationToken ct) => Results.Ok(await svc.AddFriendAsync(await me.LoadAsync(ct), number, reservation, body, ct)))
            .WithSummary("Adds a friend by name and cabin. 400 noName, badCabin or duplicate; 409 full at eight seats.");
        g.MapDelete("/friends/{index:int}", async (string number, Guid reservation, int index, ICurrentUser me, GroupTableService svc, CancellationToken ct) => Results.Ok(await svc.RemoveFriendAsync(await me.LoadAsync(ct), number, reservation, index, ct)))
            .WithSummary("Removes the friend at that place in the list.");
        g.MapPut("/split", async (string number, Guid reservation, SplitRequest body, ICurrentUser me, GroupTableService svc, CancellationToken ct) => Results.Ok(await svc.SetSplitAsync(await me.LoadAsync(ct), number, reservation, body, ct)))
            .WithSummary("Chooses to pay for your own party (mine) or split the bill evenly (even). 400 badSplit.");

        var gm = b.MapGroup("/games").WithTags("Games");
        gm.MapGet("", async (string number, ICurrentUser me, GameService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The caller's scavenger-hunt finds, trivia answers and bingo marks.");
        gm.MapPut("/clues/{clue}", async (string number, string clue, OnRequest body, ICurrentUser me, GameService svc, CancellationToken ct) => Results.Ok(await svc.FindAsync(await me.LoadAsync(ct), number, clue, body, ct)))
            .WithSummary("Marks a clue found or not. 400 badClue.");
        gm.MapPut("/trivia/{question}", async (string number, string question, AnswerRequest body, ICurrentUser me, GameService svc, CancellationToken ct) => Results.Ok(await svc.AnswerAsync(await me.LoadAsync(ct), number, question, body, ct)))
            .WithSummary("Answers a trivia question once. 400 badAnswer; 409 answered.");
        gm.MapPut("/bingo/{n:int}", async (string number, int n, OnRequest body, ICurrentUser me, GameService svc, CancellationToken ct) => Results.Ok(await svc.MarkAsync(await me.LoadAsync(ct), number, n, body, ct)))
            .WithSummary("Marks a bingo number or clears it. 400 badNumber.");

        var tv = b.MapGroup("/tv").WithTags("Cabin TV");
        tv.MapGet("", async (string number, ICurrentUser me, TvService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The stateroom TV: power, channel, volume, casting and video on demand.");
        tv.MapPatch("", async (string number, TvPatchRequest body, ICurrentUser me, TvService svc, CancellationToken ct) => Results.Ok(await svc.SetAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Changes any of power, channel, volume, mute, casting (null stops it) and a title (null clears it). 400 badChannel, badVolume, badDevice or badTitle; 403 age for a title above the caller's age.");

        var lm = b.MapGroup("/last-minute").WithTags("Last-minute tours");
        lm.MapGet("", async (string number, ICurrentUser me, LastMinuteService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Tours still open to book in today's port, why each is closed if it is, and the booking's guests.");
        lm.MapPost("/{excursionId}", async (string number, string excursionId, BookLastMinuteRequest body, ICurrentUser me, LastMinuteService svc, CancellationToken ct) => Results.Ok(await svc.BookAsync(await me.LoadAsync(ct), number, excursionId, body, ct)))
            .WithSummary("Books a tour to the onboard account. 400 badTour or guests; 403 for a child account; 409 closed, soldOut, tooLate, started, duplicate or age.");

        var rd = b.MapGroup("/ready").WithTags("Port readiness");
        rd.MapGet("", async (string number, ICurrentUser me, ReadyService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The things ticked off the get-ready list today.");
        rd.MapPut("/{id}", async (string number, string id, ReadyRequest body, ICurrentUser me, ReadyService svc, CancellationToken ct) => Results.Ok(await svc.SetAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithSummary("Ticks or unticks an item. 400 badItem.");

        var chat = api.MapGroup("/me/chat").WithTags("Chat");
        chat.MapGet("/conversations", async (ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.ConversationsAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The caller's conversations, newest activity first: the booking's \"My group\" and a direct chat for each connection. Each has its members, its last line, the unread count (the same on every device), whether it is muted and whether sending is closed. Nothing from a conversation the caller is not in.");
        chat.MapGet("/conversations/{id:guid}/messages", async (Guid id, Guid? before, int? limit, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.ThreadAsync(await me.LoadAsync(ct), id, before, limit, ct)))
            .WithSummary("The latest 30 messages of one conversation, oldest first (`limit` up to 100), or the page before the message `before`. `hasMore` says older ones exist. Messages from before the caller joined, and from people the caller blocked, are left out. 404 for a conversation the caller is not in.");
        chat.MapPost("/conversations/{id:guid}/messages", async (Guid id, SendChatRequest body, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.SendAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Sends a message (1 to 2000 characters) to one conversation; the other members are told. `clientId` makes a retry safe: a repeat returns the stored message and tells nobody twice. 400 text, blocked (the word filter; nothing is stored) or contactInfo (an under-18 sharing a number or link); 404 not a member; 409 closed.");
        chat.MapPost("/conversations/{id:guid}/read", async (Guid id, ICurrentUser me, ChatService svc, CancellationToken ct) => { await svc.ReadAsync(await me.LoadAsync(ct), id, ct); return Results.NoContent(); })
            .WithSummary("Marks the conversation read now, on every device. Who read what is recorded only when the caller has read receipts on. 404 not a member.");
        chat.MapPut("/conversations/{id:guid}/mute", async (Guid id, ChatMuteRequest body, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.MuteAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Mutes or unmutes a conversation: no phone alert for its messages. The unread count still shows. Returns the new state. 404 not a member.");
        chat.MapPost("/conversations/{id:guid}/photos", async (Guid id, ChatPhotoRequest body, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.SendPhotoAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Sends a photo (JPEG, PNG or WebP under 1 MB, as a data URL) with an optional caption to one conversation. 400 type, size, empty, contactInfo or blocked; 403 age (under 18); 404 not a member; 409 closed.");
        chat.MapGet("/receipts", async (ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.ReceiptsAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("Whether the caller shows and sees read receipts.");
        chat.MapPut("/receipts", async (ChatReceiptsRequest body, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.SetReceiptsAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Turns read receipts on or off and returns the new setting.");
        chat.MapGet("/blocks", async (ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.BlockedAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The people the caller has blocked.");
        chat.MapPut("/blocks/{id:guid}", async (Guid id, ChatBlockRequest body, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.BlockAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Hides a person's messages from the caller, or shows them again. 400 notInChat for someone who shares no group.");
        chat.MapPost("/reports", async (ChatReportRequest body, ICurrentUser me, ChatService svc, CancellationToken ct) => { await svc.ReportAsync(await me.LoadAsync(ct), body, ct); return Results.NoContent(); })
            .WithSummary("Reports a message the caller can see. 400 badReason; 404 for a message the caller cannot see.");
    }
}
