using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// What chat a guest may use at their stage, and keeping a chat past the standard 30 days (docs/chat-features-research.md, 6.1, 8.5 and phase 5). Everything is decided here from the guest's stage and bookings,
/// so a guest moving between devices gets the same answer and no screen decides who may talk to whom. A chat is kept only when every person in it agrees; a supervised child's agreement is their guardian's.
/// The chat is deleted 12 months after the cruise rather than 30 days after, and the date is always shown.
/// </summary>
public sealed class ChatKeepService(ContextService context, ITripStore trips, IChatStore chat, IChatKeepStore keeps, IUserStore users, IUserClock clock)
{
    private static string Short(ChatPeerRow p) => ChatConnectionRules.ShortName(p.FirstName, p.LastName);

    private static long Ms(DateOnly day) => TripRules.ToMs(DateTime.SpecifyKind(day.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc));

    private async Task<List<BookingRow>> ConfirmedAsync(UserRecord user, CancellationToken ct) =>
        [.. (await trips.ListForUserAsync(user.Id, ct)).Where(b => b.Status == "confirmed")];

    /// <summary>Whether the guest has a confirmed booking: the one fact the people rule rests on beside the stage.</summary>
    public async Task<bool> HasBookingAsync(UserRecord user, CancellationToken ct) => (await ConfirmedAsync(user, ct)).Count > 0;

    /// <summary>What the caller may use now. The permanent Stanley chat is always on; people and the travel party need a confirmed booking.</summary>
    public async Task<ChatEligibilityDto> EligibilityAsync(UserRecord user, CancellationToken ct)
    {
        var stage = (await context.GetAsync(ct)).Stage;
        var e = ChatEligibilityRules.For(stage, await HasBookingAsync(user, ct));
        return new(e.Stage, e.Stanley, e.Party, e.People, e.Keep, e.Reason);
    }

    /// <summary>Refuses (403 <c>notEligible</c>) a guest who may not ask another guest to chat yet.</summary>
    public async Task RequirePeopleAsync(UserRecord user, CancellationToken ct)
    {
        var stage = (await context.GetAsync(ct)).Stage;
        if (!ChatEligibilityRules.MayAsk(stage, await HasBookingAsync(user, ct))) throw ApiException.Forbidden("notEligible");
    }

    private async Task<DateOnly?> CruiseEndsAsync(UserRecord user, DateTime now, CancellationToken ct) =>
        ChatKeepRules.CruiseEnds((await ConfirmedAsync(user, ct)).Select(b => (DateOnly.FromDateTime(b.Departure), b.Nights)), DateOnly.FromDateTime(now));

    /// <summary>The state of keeping one conversation, for <paramref name="viewer"/> (whose own agreement is <c>Mine</c>).</summary>
    private async Task<ChatKeepDto> StateAsync(UserRecord viewer, ChatMemberRow member, DateTime now, CancellationToken ct)
    {
        var people = (await chat.ListMembersAsync(member.GroupId, ct)).Where(p => p.Status == ChatConversationRules.Active).ToList();
        var keepers = (await keeps.ListAsync([member.GroupId], ct)).Select(k => k.UserId).ToHashSet();
        var ends = await CruiseEndsAsync(viewer, now, ct);
        var reason = ChatKeepRules.Unavailable(ChatConversationRules.IsPermanent(member.Kind), ChatConversationRules.IsClosed(member.Kind, member.Status, member.DirectEnded), ends, DateOnly.FromDateTime(now));
        var ids = people.Select(p => p.UserId).ToList();
        var kept = reason is null && ChatKeepRules.IsKept(ids, keepers);
        var waiting = ChatKeepRules.Missing(ids, keepers).Where(id => id != viewer.Id).Select(id => Short(people.First(p => p.UserId == id))).ToList();
        return new(member.GroupPublicId, reason is null, keepers.Contains(viewer.Id), kept, ids.Count(keepers.Contains), ids.Count, waiting,
            ends is { } e ? Ms(ChatKeepRules.StandardDeleteOn(e)) : null, ends is { } k && reason is null ? Ms(ChatKeepRules.KeptDeleteOn(k)) : null, !ChatKeepRules.MayAgreeOwn(viewer.IsSupervised), reason);
    }

    /// <summary>Keeping, for every conversation the caller is in, so the list can say which are kept. A conversation that cannot be kept is left out.</summary>
    public async Task<List<ChatKeepDto>> ListAsync(UserRecord actor, CancellationToken ct)
    {
        var now = await clock.NowAsync(actor, ct);
        var rows = await chat.ListConversationsAsync(actor.Id, ct);
        var list = new List<ChatKeepDto>();
        foreach (var r in rows.Where(r => !ChatConversationRules.IsPermanent(r.Kind)))
        {
            var s = await StateAsync(actor, r, now, ct);
            if (s.Available) list.Add(s);
        }
        return list;
    }

    public async Task<ChatKeepDto> GetAsync(UserRecord actor, Guid conversationId, CancellationToken ct)
    {
        var member = await chat.GetMemberAsync(actor.Id, conversationId, ct) ?? throw ApiException.NotFound();
        return await StateAsync(actor, member, await clock.NowAsync(actor, ct), ct);
    }

    /// <summary>
    /// The caller agrees to keep the conversation, or takes it back. A supervised child cannot (403 <c>guardian</c>): their guardian decides. 403 <c>stanley</c> for the permanent chat;
    /// 409 <c>closed</c>, <c>noTrip</c> or <c>tooLate</c> when it cannot be kept. Returns the new state.
    /// </summary>
    public async Task<ChatKeepDto> SetAsync(UserRecord actor, Guid conversationId, ChatKeepBody? body, CancellationToken ct)
    {
        if (!ChatKeepRules.MayAgreeOwn(actor.IsSupervised)) throw ApiException.Forbidden("guardian");
        var member = await chat.GetMemberAsync(actor.Id, conversationId, ct) ?? throw ApiException.NotFound();
        return await ApplyAsync(actor, actor, member, body?.On == true, ct);
    }

    /// <summary>A guardian agrees for their supervised child, or takes it back. 404 unless the caller is the child's booker and the child is in the conversation.</summary>
    public async Task<ChatKeepDto> SetForChildAsync(UserRecord guardian, Guid childId, Guid conversationId, ChatKeepBody? body, CancellationToken ct)
    {
        var child = await ChildAsync(guardian, childId, ct);
        var member = await chat.GetMemberAsync(child.Id, conversationId, ct) ?? throw ApiException.NotFound();
        return await ApplyAsync(guardian, child, member, body?.On == true, ct);
    }

    /// <summary>The child's keep state for one of their conversations, as the guardian decides it.</summary>
    public async Task<ChatKeepDto> GetForChildAsync(UserRecord guardian, Guid childId, Guid conversationId, CancellationToken ct)
    {
        var child = await ChildAsync(guardian, childId, ct);
        var member = await chat.GetMemberAsync(child.Id, conversationId, ct) ?? throw ApiException.NotFound();
        // For the guardian the child's own agreement is the one that shows, and the guardian can set it.
        return (await StateAsync(child, member, await clock.NowAsync(guardian, ct), ct)) with { NeedsGuardian = false };
    }

    private async Task<UserRecord> ChildAsync(UserRecord guardian, Guid childId, CancellationToken ct)
    {
        var child = await users.FindByPublicIdAsync(childId, ct);
        if (child is null || !ChatSafetyRules.MayReadAsGuardian(guardian.Id, guardian.IsSupervised, child.IsSupervised, child.BookerUserId)) throw ApiException.NotFound();
        return child;
    }

    private async Task<ChatKeepDto> ApplyAsync(UserRecord actor, UserRecord subject, ChatMemberRow member, bool on, CancellationToken ct)
    {
        var now = await clock.NowAsync(actor, ct);
        var state = await StateAsync(subject, member, now, ct);
        if (ChatConversationRules.IsPermanent(member.Kind)) throw ApiException.Forbidden("stanley");
        if (on && !state.Available) throw ApiException.Conflict(state.Reason ?? "closed");
        await keeps.SetAsync(member.GroupId, subject.Id, on, now, ct);
        var after = await StateAsync(subject, member, now, ct);
        // The date is stored when the last person agrees and cleared when the chat stops being kept, so the daily purge reads one column.
        var ends = await CruiseEndsAsync(subject, now, ct);
        await keeps.SetKeepUntilAsync(member.GroupId, after.Kept && ends is { } e ? DateTime.SpecifyKind(ChatKeepRules.KeptDeleteOn(e).ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc) : null, ct);
        return actor.Id == subject.Id ? after : after with { NeedsGuardian = false };
    }
}
