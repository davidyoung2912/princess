using System.Text.Json;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The trip huddle (docs/chat-features-research.md, phase 15): a small private chat around a shortlist, before anyone has booked. An adult starts it and shares an invite link themselves (the app never contacts anyone);
/// an invitee signs in, sees who is in (first name and last initial) and nothing else, says they are 18 or over, and joins. A wrong, expired or revoked link all answer 404 <c>invalidLink</c>. The shortlist holds public cards only.
/// Messages, reads and the member window are the ordinary conversation routes; a huddle has no photos and no SMS bridge. Converting to a party chat is a later slice. Nothing here logs a name, a message or a card's content.
/// </summary>
public sealed class ChatHuddleService(IChatHuddleStore store, IChatGroupStore groups, IUserClock userClock, IClock clock, ChatNotifier notifier)
{
    private static string Short(ChatGroupPersonRow p) => ChatConnectionRules.ShortName(p.FirstName, p.LastName);

    private async Task<int?> AgeAsync(UserRecord actor, CancellationToken ct) =>
        await store.BornAsync(actor.Id, ct) is { } born ? ChatHuddleRules.AgeOn(born, DateOnly.FromDateTime(clock.UtcNow)) : null;

    private async Task<ChatGroupRow> MemberAsync(UserRecord actor, Guid id, CancellationToken ct) =>
        await store.GetForMemberAsync(actor.Id, id, ct) ?? throw ApiException.NotFound();

    private async Task<ChatGroupRow> CreatorAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var g = await MemberAsync(actor, id, ct);
        return g.CreatedByUserId == actor.Id ? g : throw ApiException.Forbidden("creator");
    }

    /// <summary>Starts a huddle with the caller as its only member. 400 name|blocked; 403 supervised|underage|needAge|openAlready|tooMany.</summary>
    public async Task<ChatHuddleDto> StartAsync(UserRecord actor, ChatHuddleStartBody? body, CancellationToken ct)
    {
        var name = ChatGroupRules.CleanName(body?.Name) ?? throw ApiException.Invalid("name");
        if (ProfanityFilter.IsBlocked(name)) throw ApiException.Invalid("blocked");
        var (open, inside) = await store.CountsAsync(actor.Id, ct);
        if (ChatHuddleRules.StartRefusal(actor.IsSupervised, await AgeAsync(actor, ct), open, inside) is { } no) throw ApiException.Forbidden(no);
        var group = await store.CreateAsync(actor.Id, name, await userClock.NowAsync(actor, ct), ct);
        return await ViewAsync(actor, group, ct);
    }

    public async Task<ChatHuddleDto> GetAsync(UserRecord actor, Guid id, CancellationToken ct) => await ViewAsync(actor, await MemberAsync(actor, id, ct), ct);

    private async Task<ChatHuddleDto> ViewAsync(UserRecord actor, ChatGroupRow g, CancellationToken ct)
    {
        var people = await groups.ListActiveAsync(g.Id, ct);
        var cards = await store.ListCardsAsync(g.Id, ct);
        var now = await userClock.NowAsync(actor, ct);
        var last = await store.LastActivityAsync(g.Id, ct);
        var creator = g.CreatedByUserId == actor.Id;
        long? until = creator && await store.LiveLinkUntilAsync(g.Id, clock.UtcNow, ct) is { } u ? Shipboard.Ms(u) : null;
        return new(g.PublicId, g.Name,
            [.. people.Select(p => new ChatHuddleMemberDto(p.PublicId, Short(p), p.UserId == actor.Id, p.UserId == g.CreatedByUserId))],
            [.. cards.Select(c => new ChatHuddleCardDto(c.PublicId, c.Kind, c.Title, Fields(c.Payload), Shipboard.Ms(c.AsOf), c.AddedBy == actor.Id))],
            creator, ChatHuddleRules.MaxMembers, Math.Max(0, ChatHuddleRules.MaxMembers - people.Count), Shipboard.Ms(ChatHuddleRules.DeleteOn(last)), ChatHuddleRules.Stage(last, now) == ChatHuddleRules.WarnStage, until,
            (await store.ListCarryAsync(g.Id, ct)).Contains(actor.Id));
    }

    private static Dictionary<string, string> Fields(string payload)
    {
        try { return JsonSerializer.Deserialize<Dictionary<string, string>>(payload) ?? []; }
        catch (JsonException) { return []; }
    }

    // ---- The link ----

    /// <summary>A new link (replacing any live one: this is also "refresh"). Creator only. 403 creator|limit.</summary>
    public async Task<ChatHuddleLinkDto> MakeLinkAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var g = await CreatorAsync(actor, id, ct);
        var now = clock.UtcNow;
        if (!ChatHuddleRules.MayMakeLink(await store.LinksMadeSinceAsync(actor.Id, now.AddDays(-1), ct))) throw ApiException.TooMany(ChatHuddleRules.Limit);
        var token = ChatHuddleRules.NewToken();
        var expires = ChatHuddleRules.ExpiresAt(now);
        await store.MakeLinkAsync(g.Id, actor.Id, ChatHuddleRules.HashOf(token), now, expires, ct);
        return new(token, Shipboard.Ms(expires));
    }

    public async Task RevokeLinkAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var g = await CreatorAsync(actor, id, ct);
        await store.RevokeLinksAsync(g.Id, clock.UtcNow, ct);
    }

    private async Task<ChatHuddleLinkRow> LinkAsync(string? token, CancellationToken ct)
    {
        var row = string.IsNullOrWhiteSpace(token) || token.Length > 100 ? null : await store.FindLinkAsync(ChatHuddleRules.HashOf(token), ct);
        // The same answer for no such link, a revoked one and an expired one.
        if (ChatHuddleRules.LinkRefusal(row is not null, row?.ExpiresAt, row?.RevokedAt, clock.UtcNow) is { } no) throw ApiException.NotFound(no);
        return row!;
    }

    /// <summary>Who is in and how many seats are left, for someone with a valid link and nothing else. 404 invalidLink.</summary>
    public async Task<ChatHuddlePreviewDto> PreviewAsync(UserRecord actor, ChatHuddleTokenBody? body, CancellationToken ct)
    {
        var link = await LinkAsync(body?.Token, ct);
        var people = await groups.ListActiveAsync(link.GroupId, ct);
        var p = ChatHuddleRules.PreviewOf(people.Select(x => ((string?)x.FirstName, (string?)x.LastName)));
        return new([.. p.Members], p.SeatsLeft);
    }

    /// <summary>Joins. The caller says they are 18 or over; their profile's date of birth must agree. 404 invalidLink; 403 supervised|underage|needAge|alreadyIn|full|tooMany.</summary>
    public async Task<ChatHuddleJoinedDto> JoinAsync(UserRecord actor, ChatHuddleTokenBody? body, CancellationToken ct)
    {
        var link = await LinkAsync(body?.Token, ct);
        var people = await groups.ListActiveAsync(link.GroupId, ct);
        var (_, inside) = await store.CountsAsync(actor.Id, ct);
        // An age not confirmed by the guest is an age not known: nobody joins without saying.
        var age = body?.AdultConfirmed == true ? await AgeAsync(actor, ct) : null;
        if (ChatHuddleRules.JoinRefusal(actor.IsSupervised, age, people.Any(p => p.UserId == actor.Id), people.Count, inside) is { } no) throw ApiException.Forbidden(no);
        var now = await userClock.NowAsync(actor, ct);
        await store.ConfirmAdultAsync(actor.Id, now, ct);
        var name = ChatConnectionRules.ShortName(actor.FirstName, actor.LastName);
        if (await store.JoinAsync(link.GroupId, actor.Id, $"{name} joined", ChatHuddleRules.MaxMembers, now, ct) is not null) throw ApiException.Forbidden(ChatHuddleRules.Full);
        return new(link.GroupPublicId);
    }

    /// <summary>Removes a member (creator only, never themself) with a line in the thread. 400 self; 403 creator; 404 person.</summary>
    public async Task RemoveMemberAsync(UserRecord actor, Guid id, ChatGroupRemoveBody? body, CancellationToken ct)
    {
        var g = await CreatorAsync(actor, id, ct);
        var person = (await groups.ListActiveAsync(g.Id, ct)).FirstOrDefault(m => m.PublicId == body?.PersonId) ?? throw ApiException.NotFound("person");
        if (person.UserId == actor.Id) throw ApiException.Invalid("self");
        await groups.RemoveMemberAsync(g.Id, person.UserId, "removed", $"{Short(person)} was removed", await userClock.NowAsync(actor, ct), ct);
        await notifier.ChatEndedAsync(person.UserId, g.PublicId, g.Name, false, ct);
    }

    /// <summary>Deletes the whole huddle for everyone (creator only). 403 creator.</summary>
    public async Task DeleteAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var g = await CreatorAsync(actor, id, ct);
        var members = await groups.ListActiveAsync(g.Id, ct);
        await groups.DeleteGroupAsync(g.Id, ct);
        await Task.WhenAll(members.Where(m => m.UserId != actor.Id).Select(m => notifier.ChatEndedAsync(m.UserId, g.PublicId, g.Name, true, ct)));
    }

    public async Task LeaveAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var g = await MemberAsync(actor, id, ct);
        var name = ChatConnectionRules.ShortName(actor.FirstName, actor.LastName);
        await groups.RemoveMemberAsync(g.Id, actor.Id, "left", $"{name} left", await userClock.NowAsync(actor, ct), ct);
    }

    // ---- When someone books ----

    /// <summary>The caller's own OK (or taking it back) to carry the history into the party chat. It changes nothing until the booker makes the party chat. 404.</summary>
    public async Task<ChatHuddleDto> SetCarryAsync(UserRecord actor, Guid id, ChatHuddleCarryBody? body, CancellationToken ct)
    {
        var g = await MemberAsync(actor, id, ct);
        await store.SetCarryAsync(g.Id, actor.Id, body?.Agree == true, await userClock.NowAsync(actor, ct), ct);
        return await ViewAsync(actor, g, ct);
    }

    /// <summary>
    /// "Make this the party chat." Only the booker, for their own confirmed booking, with a member of the huddle on it. Members on the booking join the booking's party chat; the others stay, and the huddle becomes an ordinary group
    /// (deleted if nobody is left outside the booking). The history is copied only if every member going to the party chat said OK, and only text sent since the last of them joined, from those members. 403 booker; 404 noBooking.
    /// </summary>
    public async Task<ChatHuddleConvertedDto> ConvertAsync(UserRecord actor, Guid id, ChatHuddleConvertBody? body, CancellationToken ct)
    {
        var g = await MemberAsync(actor, id, ct);
        var booking = await store.FindBookingAsync(actor.Id, string.IsNullOrWhiteSpace(body?.BookingNumber) ? null : body!.BookingNumber!.Trim(), ct) ?? throw ApiException.NotFound(ChatHuddleRules.NoBooking);
        var active = await groups.ListActiveAsync(g.Id, ct);
        var agreed = await store.ListCarryAsync(g.Id, ct);
        var members = active.Select(p => new HuddleMember(p.UserId, booking.UserIds.Contains(p.UserId), agreed.Contains(p.UserId))).ToList();
        if (!ChatHuddleRules.MayConvert(true, members)) throw ApiException.NotFound(ChatHuddleRules.NoBooking);
        var plan = ChatHuddleRules.ToPartyChat(members);
        var carry = ChatHuddleRules.CarriesHistory(plan);
        var joined = await store.JoinTimesAsync(g.Id, plan.Party, ct);
        var now = await userClock.NowAsync(actor, ct);
        var name = ChatConnectionRules.ShortName(actor.FirstName, actor.LastName);
        var party = await store.ConvertAsync(g.Id, booking.BookingId, plan.Party, carry, joined.Count == 0 ? now : ChatHuddleRules.CarryFrom(joined), ChatHuddleRules.KeepsGroup(plan), $"{name} made this chat from a trip huddle", now, ct);
        return new(party, plan.Party.Count, plan.Stay.Count, carry, ChatHuddleRules.KeepsGroup(plan) ? g.PublicId : null);
    }

    // ---- The shortlist ----

    /// <summary>Adds a public card. 400 card (not allowed: unknown kind, no title or "as of" time, a personal-money or number field, or too long) or blocked; 409 full; 404.</summary>
    public async Task<ChatHuddleDto> AddCardAsync(UserRecord actor, Guid id, ChatHuddleCardBody? body, CancellationToken ct)
    {
        var g = await MemberAsync(actor, id, ct);
        var fields = (body?.Fields ?? []).ToDictionary(f => f.Key.Trim(), f => f.Value.Trim());
        var title = body?.Title?.Trim();
        if (fields.Count > 12 || fields.Any(f => f.Key.Length is 0 or > 40 || f.Value.Length > ChatHuddleRules.MaxShortlistNote) || title is { Length: > 120 }) throw ApiException.Invalid("card");
        if (ProfanityFilter.IsBlocked(title ?? "") || fields.Any(f => ProfanityFilter.IsBlocked(f.Value))) throw ApiException.Invalid("blocked");
        var count = (await store.ListCardsAsync(g.Id, ct)).Count;
        var no = ChatHuddleRules.CardRefusal(body?.Kind, title, body?.AsOf is > 0, fields.Keys, count);
        if (no == ChatHuddleRules.Full) throw ApiException.Conflict(no);
        if (no is not null) throw ApiException.Invalid("card");
        await store.AddCardAsync(g.Id, actor.Id, body!.Kind!, title!, JsonSerializer.Serialize(fields), Shipboard.FromMs(body.AsOf!.Value), await userClock.NowAsync(actor, ct), ct);
        return await ViewAsync(actor, g, ct);
    }

    public async Task<ChatHuddleDto> RemoveCardAsync(UserRecord actor, Guid id, Guid cardId, CancellationToken ct)
    {
        var g = await MemberAsync(actor, id, ct);
        if (!await store.RemoveCardAsync(g.Id, cardId, actor.Id, g.CreatedByUserId == actor.Id, ct)) throw ApiException.NotFound();
        return await ViewAsync(actor, g, ct);
    }
}
