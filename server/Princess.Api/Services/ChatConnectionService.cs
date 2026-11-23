using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Asking another guest to chat, answering, withdrawing and ending (docs/chat-plan.md, 4.2 and 4.3). A search shows only guests on the same sailing, by first name and last initial.
/// A child's request needs their guardian first, and a request to a child is answered by their guardian. The other person is told at once; if a request is to someone who blocked the
/// sender it looks the same to the sender and is never delivered.
/// </summary>
public sealed class ChatConnectionService(IChatConnectionStore store, IChatStore chat, IChatGroupStore groups, IUserStore users, IUserClock clock, ChatNotifier notifier, ChatKeepService eligibility, StanleyNoticeRelay stanleyThread)
{
    public async Task<List<ChatPersonDto>> SearchAsync(UserRecord actor, string? query, CancellationToken ct)
    {
        await eligibility.RequirePeopleAsync(actor, ct);
        var clean = ChatConnectionRules.CleanQuery(query) ?? throw ApiException.Invalid("query");
        // Only a whole chat nickname or a whole username finds a guest (never an email address, a last name or part of a name), and only a guest who allows being found.
        var people = ChatConnectionRules.IsEmail(clean) ? [] : await store.FindPeopleAsync(actor.Id, clean, null, ChatConnectionRules.MaxResults, ct);
        var list = new List<ChatPersonDto>();
        foreach (var p in people)
        {
            var open = await store.FindOpenBetweenAsync(actor.Id, p.UserId, ct);
            list.Add(new(p.PublicId, ChatConnectionRules.ShortName(p.FirstName, p.LastName), Relation(open, actor.Id), p.Avatar));
        }
        return list;
    }

    private static string Relation(ChatConnectionRow? open, long me) => open?.Status switch
    {
        ChatConnectionRules.Accepted => "connected",
        ChatConnectionRules.AwaitingGuardian => "approval",
        ChatConnectionRules.Pending => open.RequesterId == me ? "asked" : "waiting",
        _ => "none",
    };

    /// <summary>How often the badge numbers may write the "expired" status for one person. A request lasts days, so a few seconds' delay in the count is invisible; the lists still expire at once.</summary>
    private static readonly TimeSpan SummaryExpiryEvery = TimeSpan.FromSeconds(30);
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<long, long> LastSummaryExpiry = new();

    private static bool SummaryExpiryDue(long userId)
    {
        var now = Environment.TickCount64;
        if (LastSummaryExpiry.TryGetValue(userId, out var last) && now - last < SummaryExpiryEvery.TotalMilliseconds) return false;
        // Bounded: forget everyone when it grows, which only makes the next summary of each person expire once more.
        if (LastSummaryExpiry.Count > 50_000) LastSummaryExpiry.Clear();
        LastSummaryExpiry[userId] = now;
        return true;
    }

    public async Task<ChatConnectionsDto> ListAsync(UserRecord actor, CancellationToken ct, bool expire = true)
    {
        if (expire) await store.ExpireAsync(actor.Id, await clock.NowAsync(actor, ct), ct);
        var rows = await store.ListForUserAsync(actor.Id, ct);
        var all = rows.Select(r => (Row: r, Dto: View(actor.Id, r))).Where(x => x.Dto is not null).ToList();
        List<ChatConnectionDto> Of(string kind) => [.. all.Where(x => x.Dto!.Kind == kind).Select(x => x.Dto!)];
        var connected = Of("connected");
        // People this guest once agreed to chat with, whoever sent the request (and with no block between them) can still be invited to a group, whether or not a chat is open with them now. One entry per person.
        var previous = Of("previous").Where(p => connected.All(c => c.PersonId != p.PersonId)).GroupBy(p => p.PersonId).Select(g => g.First()).ToList();
        return new(connected, Of("incoming"), Of("outgoing"), Of("declined"), Of("approval"), previous);
    }

    public async Task<ChatSettingsDto> SettingsAsync(UserRecord actor, CancellationToken ct)
    {
        var (findable, preview, typing) = await store.GetSettingsAsync(actor.Id, ct);
        return new(findable, preview, typing, actor.ChatNickname ?? "");
    }

    /// <summary>Whether the guest has already accepted the photo-sharing terms (asked once, the first time they send a photo).</summary>
    public Task<bool> PhotoTermsAsync(UserRecord actor, CancellationToken ct) => store.PhotoTermsAcceptedAsync(actor.Id, ct);

    public async Task AcceptPhotoTermsAsync(UserRecord actor, CancellationToken ct) => await store.AcceptPhotoTermsAsync(actor.Id, await clock.NowAsync(actor, ct), ct);

    public async Task<ChatSettingsDto> SetSettingsAsync(UserRecord actor, ChatSettingsDto? body, CancellationToken ct)
    {
        if (body is null) throw ApiException.Invalid("settings");
        await store.SetSettingsAsync(actor.Id, body.Findable, body.ShowPreview, body.Typing, ct);
        return body with { Nickname = actor.ChatNickname ?? "" };
    }

    /// <summary>Sets the name shown in chat. Empty clears it and the username shows instead; anything else must be fit and clean of blocked words.</summary>
    public async Task<ChatSettingsDto> SetNicknameAsync(UserRecord actor, NicknameBody? body, CancellationToken ct)
    {
        if (body is null || !NicknameRules.TryClean(body.Nickname, out var nick)) throw ApiException.Invalid("nickname");
        await users.SetChatNicknameAsync(actor.Id, nick, ct);
        actor.ChatNickname = nick;
        return await SettingsAsync(actor, ct);
    }

    /// <summary>The master "Hide me": nobody can find the caller by name, every chat with them ends and every waiting request is withdrawn. The others are not told. Turning being found back on later does not bring chats back.</summary>
    public async Task<ChatSettingsDto> HideAsync(UserRecord actor, CancellationToken ct)
    {
        await store.HideAsync(actor.Id, await clock.NowAsync(actor, ct), ct);
        return await SettingsAsync(actor, ct);
    }

    public async Task<ChatSummaryDto> SummaryAsync(UserRecord actor, CancellationToken ct)
    {
        // The badge is read on every nudge, focus and read, so it only reads: expiry is written at most every 30 seconds per person (the lists, which show the requests themselves, still expire on every read).
        var due = SummaryExpiryDue(actor.Id);
        var now = due ? await clock.NowAsync(actor, ct) : default;
        if (due) await store.ExpireAsync(actor.Id, now, ct);
        // Stanley's thread, with its welcome, is made the first time anything reads chat: a seeded account that has not opened the list yet still has the welcome waiting, so the badge counts it from the first read.
        if (due) await chat.EnsureStanleyAsync(actor.Id, StanleyPersonaRules.Welcome(actor.FirstName), now, ct);
        var l = await ListAsync(actor, ct, expire: false);
        // Group invitations are waiting requests too: one for the guest counts with the people who want to chat, one for their child with the approvals.
        if (due) await groups.ExpireAsync(actor.Id, now, ct);
        var invites = await groups.ListInvitesForAsync(actor.Id, ct);
        var forChild = invites.Count(i => i.GuardianUserId == actor.Id && i.Status == ChatGroupRules.AwaitingGuardian);
        var urgent = await chat.ListUnackedUrgentAsync(actor.Id, ct);
        return new(l.Incoming.Count + invites.Count - forChild, l.Approvals.Count + forChild, l.Answers.Count + await groups.CountAnswersAsync(actor.Id, ct), l.Connected.Count(c => c.IsNew), await chat.UnreadTotalAsync(actor.Id, ct), urgent.Count, [.. urgent.Select(u => u.ConversationId).Distinct()], await chat.CountUnackedEventsAsync(actor.Id, ct));
    }

    /// <summary>The sender has seen the answers (declines, and new connections).</summary>
    public async Task SeenAsync(UserRecord actor, CancellationToken ct)
    {
        var now = await clock.NowAsync(actor, ct);
        await store.MarkAnswersSeenAsync(actor.Id, now, ct);
        await groups.MarkAnswersSeenAsync(actor.Id, now, ct);
    }

    public async Task<ChatConnectionDto> RequestAsync(UserRecord actor, ChatRequestBody? body, CancellationToken ct)
    {
        if (body is null || body.ToUserId == Guid.Empty) throw ApiException.Invalid("person");
        if (body.ToUserId == actor.PublicId) throw ApiException.Invalid("self");
        await eligibility.RequirePeopleAsync(actor, ct);
        var now = await clock.NowAsync(actor, ct);
        await store.ExpireAsync(actor.Id, now, ct);

        // Only someone the caller could have found: findable, not blocked either way. Anyone else looks like nobody.
        var person = (await store.FindPeopleAsync(actor.Id, null, body.ToUserId, 1, ct)).FirstOrDefault();
        var target = person is null ? null : await users.FindByIdAsync(person.UserId, ct);
        if (target is null)
        {
            // A person who blocked the caller is not found: a request to them looks fine and goes nowhere. Anything else is just not found.
            if (await users.FindByPublicIdAsync(body.ToUserId, ct) is { } blocker && await store.HasBlockedAsync(blocker.Id, actor.Id, ct) && !await store.HasBlockedAsync(actor.Id, blocker.Id, ct))
                return QuietlyUndelivered(actor, blocker, now);
            throw ApiException.NotFound("person");
        }

        var open = await store.FindOpenBetweenAsync(actor.Id, target.Id, ct);
        if (open is not null)
        {
            if (open.Status == ChatConnectionRules.Accepted) throw ApiException.Conflict("connected");
            // They already asked the caller: asking back is answering yes.
            if (open.RequesterId == target.Id && open.Status == ChatConnectionRules.Pending && !actor.IsSupervised)
                return await RespondAsync(actor, open.PublicId, new(true), ct);
            throw ApiException.Conflict("alreadyAsked");
        }
        if (ChatConnectionRules.InCooldown(await store.LastDeclineAsync(actor.Id, target.Id, ct), now)) throw ApiException.Conflict("cooldown");
        if (await store.CountOpenOutgoingAsync(actor.Id, ct) >= ChatConnectionRules.MaxOpenOutgoing) throw ApiException.Conflict("tooManyOpen");
        if (await store.CountSentSinceAsync(actor.Id, now.AddDays(-1), ct) >= ChatConnectionRules.MaxPerDay) throw ApiException.Conflict("tooMany");

        var route = ChatConnectionRules.Route(actor.IsSupervised, target.IsSupervised);
        long? guardian = null;
        if (route.GuardianFor is not null)
        {
            guardian = route.GuardianFor == "requester" ? actor.BookerUserId : target.BookerUserId;
            if (guardian is null) throw ApiException.Invalid("noGuardian");
        }
        var row = await store.InsertAsync(actor.Id, target.Id, route.Status, guardian, route.GuardianFor, now + ChatConnectionRules.Lifetime, now, ct)
            ?? throw ApiException.Conflict("alreadyAsked");

        if (route.Status == ChatConnectionRules.Pending)
            await notifier.RequestAsync(target.Id, row.PublicId, ChatConnectionRules.ShortName(row.RequesterFirst, row.RequesterLast), ct);
        else
            await notifier.ApprovalAsync(guardian!.Value, row.PublicId, ChildFirstName(row, route.GuardianFor!), ct);
        return View(actor.Id, row)!;
    }

    /// <summary>
    /// Adds the answer to the sender's permanent Stanley chat, so the thread (their one inbox) says the request was declined. It is one message per request, in Stanley's kind words, and names
    /// only the other person's short name. Never fails the answer: the relay swallows and logs its own errors, and the People page still shows the answer either way.
    /// </summary>
    private async Task TellRequesterInStanleyAsync(ChatConnectionRow row, DateTime now, CancellationToken ct)
    {
        if (await users.FindByIdAsync(row.RequesterId, ct) is not { } requester) return;
        var name = ChatConnectionRules.ShortName(row.TargetFirst, row.TargetLast);
        var key = ChatConnectionRules.NoticeKey("declinedThread", row.PublicId);
        await stanleyThread.TellAsync(requester, key, "Chat request declined", ChatStanleyVoice.Declined(name), now, ct);
        await notifier.InfoAsync(requester.Id, key, "Chat request declined", ChatStanleyVoice.Declined(name), ct, phone: false);   // DeclinedAsync has already sent the phone alert
        // The Stanley message is how the sender hears of it, so the Chat badge does not also count the same answer until a page that clears it is opened.
        await store.MarkAnswerSeenAsync(row.Id, now, ct);
    }

    public async Task<ChatConnectionDto> RespondAsync(UserRecord actor, Guid id, ChatRespondBody? body, CancellationToken ct)
    {
        if (body is null) throw ApiException.Invalid("body");
        var now = await clock.NowAsync(actor, ct);
        var row = await store.GetAsync(id, ct) ?? throw ApiException.NotFound();
        var asTarget = row.Status == ChatConnectionRules.Pending && row.TargetId == actor.Id && !actor.IsSupervised;
        var asGuardian = row.Status == ChatConnectionRules.AwaitingGuardian && row.GuardianUserId == actor.Id && !actor.IsSupervised;
        if (!asTarget && !asGuardian)
        {
            // Not theirs to answer: a stranger finds nothing, and someone involved is told it has moved on.
            var involved = actor.Id == row.RequesterId || actor.Id == row.TargetId || actor.Id == row.GuardianUserId;
            throw involved ? ApiException.Conflict("answered") : ApiException.NotFound();
        }
        if (ChatConnectionRules.IsExpired(row.ExpiresAt, now))
        {
            await store.SetStatusAsync(row.Id, [row.Status], ChatConnectionRules.Expired, row.GuardianUserId, row.GuardianFor, false, now, ct);
            throw ApiException.Conflict("expired");
        }

        if (!body.Accept)
        {
            if (!await store.SetStatusAsync(row.Id, [row.Status], ChatConnectionRules.Declined, row.GuardianUserId, row.GuardianFor, true, now, ct)) throw ApiException.Conflict("answered");
            // Blocking acts for the person who said no: the child when their guardian answered for them.
            var (blocker, other) = row.GuardianFor == "requester" && asGuardian ? (row.RequesterId, row.TargetId)
                : row.GuardianFor == "target" && asGuardian ? (row.TargetId, row.RequesterId) : (actor.Id, row.RequesterId);
            if (body.Block) await chat.SetBlockAsync(blocker, other, true, ct);
            // The sender hears an answer, unless their own guardian was the one who said no (then it is for the guardian to explain).
            if (asGuardian && row.GuardianFor == "requester") await store.MarkAnswersSeenAsync(row.RequesterId, now, ct);
            else
            {
                await notifier.DeclinedAsync(row.RequesterId, row.PublicId, ct);
                await TellRequesterInStanleyAsync(row, now, ct);
            }
            return Answer(actor.Id, (await store.GetAsync(id, ct))!);
        }

        // The sender's guardian says yes: the request moves on to the other person (or their guardian), it is not agreed yet.
        if (asGuardian && row.GuardianFor == "requester")
        {
            var next = ChatConnectionRules.AfterRequesterGuardian(row.TargetSupervised);
            long? nextGuardian = null;
            if (next.GuardianFor == "target")
            {
                nextGuardian = (await users.FindByIdAsync(row.TargetId, ct))?.BookerUserId ?? throw ApiException.Invalid("noGuardian");
            }
            if (!await store.SetStatusAsync(row.Id, [ChatConnectionRules.AwaitingGuardian], next.Status, nextGuardian, next.GuardianFor, false, now, ct)) throw ApiException.Conflict("answered");
            if (next.Status == ChatConnectionRules.Pending)
                await notifier.RequestAsync(row.TargetId, row.PublicId, ChatConnectionRules.ShortName(row.RequesterFirst, row.RequesterLast), ct);
            else
                await notifier.ApprovalAsync(nextGuardian!.Value, row.PublicId, row.TargetFirst, ct);
            return Answer(actor.Id, (await store.GetAsync(id, ct))!);
        }

        // The person themself, or their guardian for a child, says yes: they can now chat.
        var chatId = await store.AcceptAsync(row.Id, now, ct) ?? throw ApiException.Conflict("answered");
        await notifier.AcceptedAsync(row.RequesterId, row.PublicId, ChatConnectionRules.ShortName(row.TargetFirst, row.TargetLast), ct);
        // The person who said yes (not a guardian answering for a child, and never where a child is one of the two) is thanked by Stanley inside the new chat.
        if (asTarget && !row.RequesterSupervised && !row.TargetSupervised)
        {
            try
            {
                if (await chat.GetMemberAsync(actor.Id, chatId, ct) is { } member)
                    await chat.AddGroupStanleyMessageAsync(member.GroupId, ChatHostRules.AcceptThanks(ChatConnectionRules.ShortName(row.TargetFirst, row.TargetLast)), false, now, ct, [actor.Id]);
            }
            catch (Exception e) when (e is not OperationCanceledException) { }
        }
        return Answer(actor.Id, (await store.GetAsync(id, ct))!);
    }

    /// <summary>The sender withdraws a request that is still waiting (or their guardian does). The other person's list simply drops it.</summary>
    public async Task CancelAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var row = await store.GetAsync(id, ct) ?? throw ApiException.NotFound();
        var mine = row.RequesterId == actor.Id || (row.GuardianUserId == actor.Id && row.GuardianFor == "requester");
        if (!mine) throw ApiException.NotFound();
        if (!ChatConnectionRules.IsWaiting(row.Status)) throw ApiException.Conflict("answered");
        if (!await store.SetStatusAsync(row.Id, [ChatConnectionRules.AwaitingGuardian, ChatConnectionRules.Pending], ChatConnectionRules.Cancelled, row.GuardianUserId, row.GuardianFor, false, await clock.NowAsync(actor, ct), ct))
            throw ApiException.Conflict("answered");
        // The other person's open app is nudged so the request leaves their list and the badge drops at once (and their guardian's, for a child).
        await notifier.ChangedAsync(row.TargetId, ct);
        if (row.GuardianUserId is long guardian && guardian != actor.Id) await notifier.ChangedAsync(guardian, ct);
    }

    /// <summary>Either person leaves a personal chat. The chat is deleted for both, and the other person's open app is told so it leaves their list.</summary>
    public async Task EndAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var row = await store.GetAsync(id, ct) ?? throw ApiException.NotFound();
        if (actor.Id != row.RequesterId && actor.Id != row.TargetId) throw ApiException.NotFound();
        if (row.Status != ChatConnectionRules.Accepted) throw ApiException.Conflict("notConnected");
        if (!await store.EndAsync(row.Id, actor.Id, await clock.NowAsync(actor, ct), ct)) throw ApiException.Conflict("notConnected");
        var otherId = actor.Id == row.RequesterId ? row.TargetId : row.RequesterId;
        if (row.ConversationId is Guid conversationId) await notifier.PersonalChatEndedAsync(otherId, conversationId, ct);
        // Both people hear of it in their Stanley chat: the other person also gets a popup (when not looking at the chat), the one who ended it only a record to refer back to.
        var now = await clock.NowAsync(actor, ct);
        var iAmTarget = actor.Id == row.TargetId;
        var who = iAmTarget ? ChatConnectionRules.ShortName(row.TargetFirst, row.TargetLast) : ChatConnectionRules.ShortName(row.RequesterFirst, row.RequesterLast);
        var them = iAmTarget ? ChatConnectionRules.ShortName(row.RequesterFirst, row.RequesterLast) : ChatConnectionRules.ShortName(row.TargetFirst, row.TargetLast);
        var key = ChatConnectionRules.NoticeKey("personalLeft", row.PublicId);
        var title = $"{who} ended your personal chat";
        var body = $"{who} chose to leave your personal chat, so the chat and its messages have been removed for both of you. You are welcome to send {who} a new chat request any time.";
        if (await users.FindByIdAsync(otherId, ct) is { } other)
        {
            await stanleyThread.TellAsync(other, key, title, body, now, ct);
            await notifier.InfoAsync(other.Id, key, title, body, ct, phone: false);   // PersonalChatEndedAsync has already sent the phone alert
        }
        await stanleyThread.TellAsync(actor, ChatConnectionRules.NoticeKey("personalLeftYou", row.PublicId), $"You ended your chat with {them}", $"You left your personal chat with {them}, so the chat and its messages have been removed for both of you. You can send {them} a new chat request any time.", now, ct, "chatNote");
    }

    // ---- shaping ----

    /// <summary>The row as the caller sees it, or null when it is not for them.</summary>
    private static ChatConnectionDto? View(long me, ChatConnectionRow r)
    {
        var mine = me == r.RequesterId;
        var other = mine ? (r.TargetPublicId, ChatConnectionRules.ShortName(r.TargetFirst, r.TargetLast), r.TargetAvatar) : (r.RequesterPublicId, ChatConnectionRules.ShortName(r.RequesterFirst, r.RequesterLast), r.RequesterAvatar);
        var isNew = r.Status == ChatConnectionRules.Accepted && mine && r.RequesterSeenAt is null;
        ChatConnectionDto Make(string kind, Guid? child = null, string? childName = null) =>
            new(r.PublicId, kind, other.Item1, other.Item2, r.ConversationId, child, childName, isNew, TripRules.ToMs(r.CreatedAt), TripRules.ToMs(r.ExpiresAt), other.Item3, ChatStanleyVoice.Note(kind, other.Item2));

        if (r.GuardianUserId == me && r.Status == ChatConnectionRules.AwaitingGuardian && !mine && me != r.TargetId)
        {
            // A guardian reviewing: show who the child would be talking to, and which child.
            var forRequester = r.GuardianFor == "requester";
            var childPublic = forRequester ? r.RequesterPublicId : r.TargetPublicId;
            var childName = forRequester ? r.RequesterFirst : r.TargetFirst;
            var personPublic = forRequester ? r.TargetPublicId : r.RequesterPublicId;
            var personName = forRequester ? ChatConnectionRules.ShortName(r.TargetFirst, r.TargetLast) : ChatConnectionRules.ShortName(r.RequesterFirst, r.RequesterLast);
            return new(r.PublicId, "approval", personPublic, personName, null, childPublic, childName, false, TripRules.ToMs(r.CreatedAt), TripRules.ToMs(r.ExpiresAt), forRequester ? r.TargetAvatar : r.RequesterAvatar);
        }
        return r.Status switch
        {
            ChatConnectionRules.Accepted when mine || me == r.TargetId => Make("connected"),
            ChatConnectionRules.Pending when me == r.TargetId => Make("incoming"),
            ChatConnectionRules.Pending or ChatConnectionRules.AwaitingGuardian when mine => Make("outgoing"),
            ChatConnectionRules.Declined when mine => Make("declined"),
            ChatConnectionRules.Ended when mine || me == r.TargetId => Make("previous"),
            _ => null,
        };
    }

    /// <summary>The row as the person who just answered it sees it. They are not always one of the two people (a guardian answers for a child), so it never comes back empty.</summary>
    private static ChatConnectionDto Answer(long me, ChatConnectionRow r) =>
        View(me, r) ?? new(r.PublicId,
            r.Status switch { ChatConnectionRules.Accepted => "connected", ChatConnectionRules.Declined => "declined", _ => "outgoing" },
            r.TargetPublicId, ChatConnectionRules.ShortName(r.TargetFirst, r.TargetLast), r.ConversationId, null, null, false, TripRules.ToMs(r.CreatedAt), TripRules.ToMs(r.ExpiresAt), r.TargetAvatar);

    private static string ChildFirstName(ChatConnectionRow r, string guardianFor) => guardianFor == "requester" ? r.RequesterFirst : r.TargetFirst;

    /// <summary>What a sender sees for a request to someone who blocked them: an ordinary waiting request that goes nowhere and expires.</summary>
    private static ChatConnectionDto QuietlyUndelivered(UserRecord actor, UserRecord target, DateTime now) =>
        new(Guid.NewGuid(), "outgoing", target.PublicId, "Guest", null, null, null, false, TripRules.ToMs(now), TripRules.ToMs(now + ChatConnectionRules.Lifetime), null, ChatStanleyVoice.Waiting);
}
