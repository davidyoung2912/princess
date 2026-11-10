using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Shared Stanley cards (docs/chat-features-research.md, 7.4, phase 7b): an admin's tap posts a suggested poll to their group, and the group's opt-in switch. It is apart from <see cref="StanleyMomentService"/>
/// because it posts through <see cref="ChatService"/>, which reaches the push path that calls the moment service.
/// </summary>
public sealed class StanleyGroupShareService(IChatStore store, ChatService chat)
{
    /// <summary>
    /// "Post this to the group?" (7.4): the admin's tap on a shared card. Everything is checked again here. The poll is sent by <see cref="ChatService.SendAsync"/> as the admin's own message, under every rule a poll
    /// already has, after a line naming whose request it was. The card is then put away. 400 notMoment or group; 403 notAdmin, off, child or notGroup; 404; 409 already.
    /// </summary>
    public async Task ShareToGroupAsync(UserRecord actor, Guid conversationId, Guid messageId, Guid groupId, DateTime now, CancellationToken ct)
    {
        var member = await store.GetMemberAsync(actor.Id, conversationId, ct) ?? throw ApiException.NotFound();
        if (member.Status != ChatConversationRules.Active) throw ApiException.NotFound();
        if (!ChatConversationRules.IsPermanent(member.Kind)) throw ApiException.Forbidden("stanley");
        var message = await store.FindMessageAsync(member.GroupId, actor.Id, messageId, ct) ?? throw ApiException.NotFound();
        if (!message.FromStanley || message.Lane != ChatProactiveRules.Lane || ChatProactiveRules.KeyOf(message.NoticeKey) != ChatGroupMomentRules.GroupPollKey || message.SupersededAt is not null) throw ApiException.Invalid("notMoment");
        if (message.ExpiresAt is { } e && e <= now) throw ApiException.Invalid("notMoment");
        if (message.NoticeSubject != groupId.ToString()) throw ApiException.Invalid("group");
        var group = await store.GetMemberAsync(actor.Id, groupId, ct) ?? throw ApiException.NotFound();
        if (group.Status != ChatConversationRules.Active) throw ApiException.NotFound();
        var members = (await store.ListMembersAsync(group.GroupId, ct)).Where(p => p.Status == ChatConversationRules.Active).ToList();
        var refusal = ChatGroupMomentRules.Refusal(ChatPlanningService.AdminOf(group, actor.Id), await store.GetGroupStanleyAsync(group.GroupId, ct), group.Kind == ChatConversationRules.Group,
            members.Any(p => p.IsSupervised), await store.HasPlanningAsync(group.GroupId, ct));
        if (refusal == ChatGroupMomentRules.Already) throw ApiException.Conflict("already");
        if (refusal is not null) throw ApiException.Forbidden(refusal);
        await chat.SendAsync(actor, groupId, new(null, Kind: "poll", Question: ChatGroupMomentRules.PollQuestion, Options: [.. ChatGroupMomentRules.PollOptions]), ct);
        await store.AddSystemLineAsync(group.GroupId, actor.Id, ChatGroupMomentRules.ShareLine(ChatConnectionRules.ShortName(actor.FirstName, actor.LastName)), now, ct);
        await store.PutAwayMomentAsync(actor.Id, message.Id, ChatGroupMomentRules.GroupPollKey, now, null, now, ct);
        try { await store.LogNoticeDeliveryAsync(actor.Id, message.NoticeKey!, ChatProactiveRules.KindOf, ChatProactiveRules.Lane, StanleyNoticeRules.EventDismiss, now, ct); }
        catch (Exception e) when (e is not OperationCanceledException) { /* counting never reaches the guest */ }
    }

    /// <summary>Whether Stanley may share cards in this group. Any active member can read it; only an admin can change it.</summary>
    public async Task<GroupStanleyDto> GroupStanleyAsync(UserRecord actor, Guid groupId, CancellationToken ct)
    {
        var member = await store.GetMemberAsync(actor.Id, groupId, ct) ?? throw ApiException.NotFound();
        if (member.Status != ChatConversationRules.Active || member.Kind != ChatConversationRules.Group) throw ApiException.NotFound();
        return new(await store.GetGroupStanleyAsync(member.GroupId, ct), ChatPlanningService.AdminOf(member, actor.Id));
    }

    /// <summary>An admin lets Stanley offer to share cards in the group, or stops him. 403 notAdmin; 404.</summary>
    public async Task<GroupStanleyDto> SetGroupStanleyAsync(UserRecord actor, Guid groupId, GroupStanleyRequest? body, DateTime now, CancellationToken ct)
    {
        var member = await store.GetMemberAsync(actor.Id, groupId, ct) ?? throw ApiException.NotFound();
        if (member.Status != ChatConversationRules.Active || member.Kind != ChatConversationRules.Group) throw ApiException.NotFound();
        if (!ChatPlanningService.AdminOf(member, actor.Id)) throw ApiException.Forbidden(ChatGroupMomentRules.NotAdmin);
        await store.SetGroupStanleyAsync(member.GroupId, body?.On == true, actor.Id, now, ct);
        return new(body?.On == true, true);
    }
}
