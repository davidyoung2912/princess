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
            .WithSummary("Sends a message (1 to 2000 characters) to one conversation; the other members are told. `replyTo` names the message being answered (one a person said and the caller may read; 400 replyTo otherwise). `clientId` makes a retry safe: a repeat returns the stored message and tells nobody twice. 400 text, blocked (the word filter; nothing is stored) or contactInfo (an under-18 sharing a number or link); 404 not a member; 409 closed.");
        chat.MapPost("/conversations/{id:guid}/messages/{messageId:guid}/ack", async (Guid id, Guid messageId, ICurrentUser me, ChatService svc, CancellationToken ct) => { await svc.AckAsync(await me.LoadAsync(ct), id, messageId, ct); return Results.NoContent(); })
            .WithSummary("Acknowledges an urgent message from someone else (\"Got it\"). Only this call does it; reading the thread does not. Repeating it changes nothing. The sender is nudged and sees who has acknowledged. 400 notUrgent (not urgent, a system line or the caller's own); 404 for a message the caller cannot read.");
        chat.MapPost("/conversations/{id:guid}/messages/{messageId:guid}/react", async (Guid id, Guid messageId, ChatReactRequest body, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.ReactAsync(await me.LoadAsync(ct), id, messageId, body, ct)))
            .WithSummary("Reacts to a message with one of 👍 ❤️ 😂 😮 😢 🙏. One reaction per person: a different one replaces it, the same one again takes it away. Returns the chips now under the message (emoji, count, whether the caller chose it, the others' names). Other members' open apps are nudged to refetch; nobody gets a phone alert. 400 emoji or notMessage; 403 stanley; 404 for a message the caller cannot read; 409 closed.");
        chat.MapPut("/conversations/{id:guid}/messages/{messageId:guid}/reaction", async (Guid id, Guid messageId, ChatReactRequest body, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.SetReactionAsync(await me.LoadAsync(ct), id, messageId, body, ct)))
            .WithSummary("Sets the caller's reaction to exactly `emoji` (one of 👍 ❤️ 😂 😮 😢 🙏), or clears it when `emoji` is null or empty. Idempotent, so a reaction queued offline can be replayed safely; the last write wins. Returns the chips now under the message. Same refusals as the toggle: 400 emoji or notMessage; 403 stanley; 404; 409 closed.");
        chat.MapPost("/conversations/{id:guid}/delivered", async (Guid id, ICurrentUser me, ChatService svc, CancellationToken ct) => { await svc.DeliveredAsync(await me.LoadAsync(ct), id, ct); return Results.NoContent(); })
            .WithSummary("A device of the caller has the messages others sent in this conversation. The senders see Delivered (when both sides have read receipts on), once; repeating it changes nothing. Never a phone alert. 404 not a member.");
        chat.MapPost("/conversations/{id:guid}/messages/{messageId:guid}/reply", async (Guid id, Guid messageId, ChatNoticeReplyRequest body, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.NoticeReplyAsync(await me.LoadAsync(ct), id, messageId, body, ct)))
            .WithSummary("A chip on a relayed Stanley notice: reply `why`, `what` or `later`. Why and what are answered from the notice's kind and state, not from chat history; later sets a reminder an hour on (never for a critical notice). Returns { text, remindAt? }. 400 reply or notNotice; 404; 409 expired.");
        chat.MapGet("/do-not-disturb", async (ICurrentUser me, PushService svc, CancellationToken ct) => Results.Ok(await svc.DndAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("Whether do-not-disturb is on and when it ends (`until`, milliseconds; 0 when off or ended).");
        chat.MapPut("/do-not-disturb", async (ChatDndRequest body, ICurrentUser me, PushService svc, CancellationToken ct) => Results.Ok(await svc.SetDndAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Turns do-not-disturb on for an hour (`hour`), until the morning (`morning`, the end of the guest's quiet hours or 07:00) or off (`off`). It is kept with the notification preferences, holds phone alerts and the in-app pop-up except urgent chat messages, and ends by itself. 400 mode; 403 supervised.");
        chat.MapPost("/conversations/{id:guid}/read", async (Guid id, ICurrentUser me, ChatService svc, CancellationToken ct) => { await svc.ReadAsync(await me.LoadAsync(ct), id, ct); return Results.NoContent(); })
            .WithSummary("Marks the conversation read now, on every device. Who read what is recorded only when the caller has read receipts on. 404 not a member.");
        chat.MapPut("/conversations/{id:guid}/mute", async (Guid id, ChatMuteRequest body, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.MuteAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Mutes or unmutes a conversation: no phone alert for its messages. The unread count still shows. `for` (`hour`, `day` or `week`) ends the mute by itself; without it the mute lasts until turned off. The conversation carries `mutedUntil` while a timed mute runs. Returns the new state. 400 for; 403 stanley; 404 not a member.");
        chat.MapPut("/conversations/{id:guid}/archive", async (Guid id, ChatArchiveRequest body, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.ArchiveAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Moves a conversation into the caller's archive, or back. A new message from someone else brings it back unless it is muted. Returns the new state. 403 stanley; 404 not a member.");
        chat.MapPatch("/conversations/{id:guid}/messages/{messageId:guid}", async (Guid id, Guid messageId, ChatEditRequest body, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.EditAsync(await me.LoadAsync(ct), id, messageId, body, ct)))
            .WithSummary("Edits the caller's own message within 15 minutes of sending (server time). The new text is checked like a send; the first text is kept for staff review of a report. Others' open apps are nudged; nobody gets a phone alert. 400 text, blocked, contactInfo, notMessage, photo or urgent; 403 notYours or stanley; 404; 409 closed, deleted or tooLate.");
        chat.MapDelete("/conversations/{id:guid}/messages/{messageId:guid}", async (Guid id, Guid messageId, ICurrentUser me, ChatService svc, CancellationToken ct) => { await svc.DeleteAsync(await me.LoadAsync(ct), id, messageId, ct); return Results.NoContent(); })
            .WithSummary("Deletes the caller's own message for everyone within 15 minutes of sending. Its text and photo are gone from every member's view; staff keep the original for a report. Repeating it changes nothing. 403 notYours or stanley; 404; 409 closed or tooLate.");
        chat.MapPost("/conversations/{id:guid}/typing", async (Guid id, ICurrentUser me, ChatService svc, CancellationToken ct) => { await svc.TypingAsync(await me.LoadAsync(ct), id, ct); return Results.NoContent(); })
            .WithSummary("The caller is typing. Not stored; at most one nudge in three seconds to the other members' open apps (never a phone alert, never to someone with the indicator off or who answers by text). Does nothing when the caller has it off. 403 stanley; 404 not a member.");
        chat.MapGet("/conversations/{id:guid}/typing", async (Guid id, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.TypingNowAsync(await me.LoadAsync(ct), id, ct)))
            .WithSummary("Who is typing here now (first name and last initial); a person drops off six seconds after their last event. Empty when the caller has the indicator off. 404 not a member.");
        chat.MapPost("/conversations/{id:guid}/people/{personId:guid}/report", async (Guid id, Guid personId, ChatPersonReportRequest body, ICurrentUser me, ChatService svc, CancellationToken ct) => { await svc.ReportPersonAsync(await me.LoadAsync(ct), id, personId, body, ct); return Results.NoContent(); })
            .WithSummary("Reports a person from the conversation's header: filed against the newest message they said there that the caller can read. 400 badReason or notInChat; 403 stanley; 404 when nothing of theirs can be read.");
        chat.MapPut("/conversations/{id:guid}/pins/{messageId:guid}", async (Guid id, Guid messageId, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.PinAsync(await me.LoadAsync(ct), id, messageId, true, ct)))
            .WithSummary("Pins a message (up to 3 per conversation): either person in a direct chat, any member of the booking's group, the creator of a made group. Returns the pin bar. 400 notMessage; 403 stanley or pin; 404; 409 closed or pinsFull.");
        chat.MapDelete("/conversations/{id:guid}/pins/{messageId:guid}", async (Guid id, Guid messageId, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.PinAsync(await me.LoadAsync(ct), id, messageId, false, ct)))
            .WithSummary("Takes a pin away; repeating it changes nothing. Returns the pin bar. Same refusals as pinning.");
        chat.MapPut("/conversations/{id:guid}/mentions-only", async (Guid id, ChatMentionsOnlyRequest body, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.MentionsOnlyAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Alerts the caller only for messages that mention them in this conversation (it still shows and counts everything). Returns the new state. 403 stanley; 404.");
        chat.MapPut("/conversations/{id:guid}/messages/{messageId:guid}/vote", async (Guid id, Guid messageId, ChatVoteRequest body, ICurrentUser me, ChatPlanningService svc, CancellationToken ct) => Results.Ok(await svc.VoteAsync(await me.LoadAsync(ct), id, messageId, body, ct)))
            .WithSummary("Votes for one option of a poll, or changes the vote until the poll closes. Returns the counts (a poll's answers are counted, never named). 400 option|notPoll; 403 stanley; 404; 409 closed|pollClosed.");
        chat.MapPost("/conversations/{id:guid}/messages/{messageId:guid}/close", async (Guid id, Guid messageId, ICurrentUser me, ChatPlanningService svc, CancellationToken ct) => Results.Ok(await svc.CloseAsync(await me.LoadAsync(ct), id, messageId, ct)))
            .WithSummary("Closes a poll before its 24 hours are up: the person who asked it, or an admin of the group. Closing a closed poll changes nothing. Returns the counts. 400 notPoll; 403 close; 404; 409 closed.");
        chat.MapPut("/conversations/{id:guid}/messages/{messageId:guid}/rsvp", async (Guid id, Guid messageId, ChatRsvpRequest body, ICurrentUser me, ChatPlanningService svc, CancellationToken ct) => Results.Ok(await svc.RsvpAsync(await me.LoadAsync(ct), id, messageId, body, ct)))
            .WithSummary("Answers a plan going, maybe or no. Going puts the plan's programme event on the caller's own programme when their sailing runs it that day (a supervised child's answer never changes their programme); another answer takes it off again if the plan put it there. Returns the answers. 400 choice|notPlan; 403 stanley; 404; 409 closed.");
        chat.MapGet("/shareable", async (ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.ShareableAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("What the caller can share into a chat from their own booking (the booking, booked excursions and dinners, port days), each with a ref to send back, the named ship places a meeting point can be dropped at, and the programme events a plan can be made of (`events`, ref `eventId:day`). Names, times and places only: no price, folio line, cabin or booking number.");
        chat.MapPut("/conversations/{id:guid}/notify-away", async (Guid id, ChatNotifyAwayRequest body, ICurrentUser me, ChatService svc, CancellationToken ct) => Results.Ok(await svc.NotifyAwayAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Turns on or off telling the other connected people in this conversation when the caller leaves or returns to the ship (off by default; only the ship-level change is shared, never where in port). Returns the new state. 403 supervised; 404 not a member.");
        chat.MapGet("/conversations/{id:guid}/messages/{messageId:guid}/photo", async (Guid id, Guid messageId, ICurrentUser me, ChatService svc, HttpContext http, CancellationToken ct) =>
            {
                var photo = await svc.PhotoAsync(await me.LoadAsync(ct), id, messageId, ct);
                http.Response.Headers.CacheControl = "private, max-age=31536000, immutable";   // a sent photo never changes
                return Results.Ok(photo);
            })
            .WithSummary("The photo of one message as a data URL (`photo`). The thread lists `hasPhoto` instead of carrying it. Cacheable by the app. 404 when the message is not one the caller can read.");
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
