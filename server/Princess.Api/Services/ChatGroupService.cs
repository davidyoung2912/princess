using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Guest-made groups (docs/chat-plan.md, phase 5). A guest makes a group from people they are already connected with; each person accepts or declines, and a supervised child's guardian answers for them.
/// The creator can invite, remove and rename; anyone can leave. A member reads only what was said from the moment they joined (the window in <see cref="ChatConversationRules.CanRead"/>).
/// A group has 25 people at most, counting the creator and the invitations still waiting. A supervised child cannot make a group. Declines are quiet: the creator is never told who said no.
/// </summary>
public sealed class ChatGroupService(IChatGroupStore store, IUserStore users, IUserClock clock, ChatNotifier notifier)
{
    private static string Short(ChatGroupPersonRow p) => ChatConnectionRules.ShortName(p.FirstName, p.LastName);

    public async Task<ChatGroupDto> CreateAsync(UserRecord actor, ChatGroupCreateBody? body, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var name = ChatGroupRules.CleanName(body?.Name) ?? throw ApiException.Invalid("name");
        if (ProfanityFilter.IsBlocked(name)) throw ApiException.Invalid("blocked");
        var ids = Distinct(actor, body?.PersonIds);
        if (ids.Count < ChatGroupRules.MinInvitedAtStart) throw ApiException.Invalid("tooFew");
        if (!ChatGroupRules.Fits(1, 0, ids.Count)) throw ApiException.Invalid("tooMany");
        var now = await clock.NowAsync(actor, ct);
        // Everyone is checked before anything is made, so a bad person does not leave a half-made group.
        var invitees = await ConnectedAsync(actor, ids, ct);
        var group = await store.CreateAsync(actor.Id, name, now, ct);
        await InviteAllAsync(actor, group, invitees, now, ct);
        return await ViewAsync(actor, group, ct);
    }

    public async Task<ChatGroupDto> GetAsync(UserRecord actor, Guid id, CancellationToken ct) =>
        await ViewAsync(actor, await MemberGroupAsync(actor, id, ct), ct);

    public async Task<ChatGroupDto> InviteAsync(UserRecord actor, Guid id, ChatGroupInviteBody? body, CancellationToken ct)
    {
        var group = await CreatorGroupAsync(actor, id, ct);
        var ids = Distinct(actor, body?.PersonIds);
        if (ids.Count == 0) throw ApiException.Invalid("person");
        var now = await clock.NowAsync(actor, ct);
        await store.ExpireAsync(actor.Id, now, ct);
        var members = await store.ListActiveAsync(group.Id, ct);
        var waiting = await store.ListWaitingAsync(group.Id, ct);
        var fresh = (await ConnectedAsync(actor, ids, ct)).Where(u => members.All(m => m.UserId != u.Id) && waiting.All(w => w.InviteeId != u.Id)).ToList();
        if (!ChatGroupRules.Fits(members.Count, waiting.Count, fresh.Count)) throw ApiException.Conflict("full");
        await InviteAllAsync(actor, group, fresh, now, ct);
        return await ViewAsync(actor, group, ct);
    }

    public async Task<ChatGroupDto> RenameAsync(UserRecord actor, Guid id, ChatGroupRenameBody? body, CancellationToken ct)
    {
        var group = await CreatorGroupAsync(actor, id, ct);
        var name = ChatGroupRules.CleanName(body?.Name) ?? throw ApiException.Invalid("name");
        if (ProfanityFilter.IsBlocked(name)) throw ApiException.Invalid("blocked");
        if (name != group.Name) await store.RenameAsync(group.Id, actor.Id, name, ChatGroupRules.RenamedLine(name), await clock.NowAsync(actor, ct), ct);
        group.Name = name;
        return await ViewAsync(actor, group, ct);
    }

    public async Task RemoveAsync(UserRecord actor, Guid id, ChatGroupRemoveBody? body, CancellationToken ct)
    {
        var group = await CreatorGroupAsync(actor, id, ct);
        var members = await store.ListActiveAsync(group.Id, ct);
        var person = members.FirstOrDefault(m => m.PublicId == body?.PersonId) ?? throw ApiException.NotFound("person");
        if (person.UserId == actor.Id) throw ApiException.Invalid("self");
        await store.RemoveMemberAsync(group.Id, person.UserId, "removed", ChatGroupRules.RemovedLine(Short(person)), await clock.NowAsync(actor, ct), ct);
    }

    /// <summary>
    /// Names or releases the group's second admin (creator only). An admin can pin, close a poll before its time, post in an announcement-only group and switch that on or off; inviting, removing and renaming stay with the creator.
    /// 400 self (the creator is always an admin), child (a supervised child is never made one) or person; 403 creator; 409 adminsFull.
    /// </summary>
    public async Task<ChatGroupDto> SetAdminAsync(UserRecord actor, Guid id, Guid personId, ChatGroupAdminBody? body, CancellationToken ct)
    {
        var group = await CreatorGroupAsync(actor, id, ct);
        var members = await store.ListActiveAsync(group.Id, ct);
        var person = members.FirstOrDefault(m => m.PublicId == personId) ?? throw ApiException.Invalid("person");
        if (person.UserId == group.CreatedByUserId) throw ApiException.Invalid("self");
        var on = body?.On == true;
        if (on && !person.IsAdmin)
        {
            if (!ChatPlanningRules.MayBeAdmin(person.IsSupervised)) throw ApiException.Invalid("child");
            if (!ChatPlanningRules.CanAddAdmin(members.Count(m => m.IsAdmin && m.UserId != group.CreatedByUserId))) throw ApiException.Conflict("adminsFull");
        }
        await store.SetAdminAsync(group.Id, person.UserId, on, ct);
        person.IsAdmin = on;
        await TellAsync(group, members, "admins", ct);
        return await ViewAsync(actor, group, ct);
    }

    /// <summary>Makes the group announcement-only (only admins post; votes, answers and reactions stay open) or opens it again. The creator or the second admin may. 403 admin.</summary>
    public async Task<ChatGroupDto> SetAnnouncementOnlyAsync(UserRecord actor, Guid id, ChatGroupAnnouncementBody? body, CancellationToken ct)
    {
        var group = await MemberGroupAsync(actor, id, ct);
        var members = await store.ListActiveAsync(group.Id, ct);
        var mine = members.FirstOrDefault(m => m.UserId == actor.Id);
        if (!ChatPlanningRules.IsAdmin(group.CreatedByUserId == actor.Id, mine?.IsAdmin == true)) throw ApiException.Forbidden("admin");
        var on = body?.On == true;
        if (on != group.AnnouncementOnly) await store.SetAnnouncementOnlyAsync(group.Id, on, ct);
        group.AnnouncementOnly = on;
        await TellAsync(group, members, "admins", ct);
        return await ViewAsync(actor, group, ct);
    }

    /// <summary>The open apps of everyone in the group refetch (a live nudge, never a phone alert), so the composer and the controls change at once.</summary>
    private Task TellAsync(ChatGroupRow group, List<ChatGroupPersonRow> members, string kind, CancellationToken ct) =>
        Task.WhenAll(members.Select(m => notifier.ThreadChangedAsync(m.UserId, group.PublicId, kind, ct)));

    /// <summary>Anyone in the group can leave. They keep nothing of what is said after, and the others are told by a line in the thread.</summary>
    public async Task LeaveAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var group = await MemberGroupAsync(actor, id, ct);
        var me = (await store.ListActiveAsync(group.Id, ct)).First(m => m.UserId == actor.Id);
        if (!await store.RemoveMemberAsync(group.Id, actor.Id, "left", ChatGroupRules.LeftLine(Short(me)), await clock.NowAsync(actor, ct), ct)) throw ApiException.NotFound();
    }

    /// <summary>Invitations waiting for the caller, and for children they are guardian of.</summary>
    public async Task<List<ChatGroupInviteDto>> InvitesAsync(UserRecord actor, CancellationToken ct)
    {
        await store.ExpireAsync(actor.Id, await clock.NowAsync(actor, ct), ct);
        return [.. (await store.ListInvitesForAsync(actor.Id, ct)).Select(r => View(actor.Id, r))];
    }

    /// <summary>The invitee answers, or their guardian does for a child (a yes from the guardian is the acceptance).</summary>
    public async Task RespondAsync(UserRecord actor, Guid id, ChatGroupRespondBody? body, CancellationToken ct)
    {
        if (body is null) throw ApiException.Invalid("body");
        var now = await clock.NowAsync(actor, ct);
        var row = await store.GetInviteAsync(id, ct) ?? throw ApiException.NotFound();
        var asInvitee = row.Status == ChatGroupRules.Pending && row.InviteeId == actor.Id && !actor.IsSupervised;
        var asGuardian = row.Status == ChatGroupRules.AwaitingGuardian && row.GuardianUserId == actor.Id && !actor.IsSupervised;
        if (!asInvitee && !asGuardian)
        {
            var involved = actor.Id == row.InviteeId || actor.Id == row.InviterId || actor.Id == row.GuardianUserId;
            throw involved ? ApiException.Conflict("answered") : ApiException.NotFound();
        }
        if (now >= row.ExpiresAt)
        {
            await store.SetInviteStatusAsync(row.Id, [row.Status], ChatGroupRules.Expired, now, ct);
            throw ApiException.Conflict("expired");
        }
        if (!body.Accept)
        {
            if (!await store.SetInviteStatusAsync(row.Id, [row.Status], ChatGroupRules.Declined, now, ct)) throw ApiException.Conflict("answered");
            return;   // quiet: the creator is not told
        }
        var who = ChatConnectionRules.ShortName(row.InviteeFirst, row.InviteeLast);
        var result = await store.AcceptInviteAsync(row.Id, ChatGroupRules.JoinedLine(who), ChatGroupRules.MaxMembers, now, ct);
        if (result == "full") throw ApiException.Conflict("full");
        if (result is not null) throw ApiException.Conflict("answered");
    }

    // ---- helpers ----

    private static List<Guid> Distinct(UserRecord actor, List<Guid>? ids) =>
        [.. (ids ?? []).Where(i => i != Guid.Empty && i != actor.PublicId).Distinct()];

    /// <summary>The caller's active place in the group, or a 404 that is the same whether it does not exist or is someone else's.</summary>
    private async Task<ChatGroupRow> MemberGroupAsync(UserRecord actor, Guid id, CancellationToken ct) =>
        await store.GetForMemberAsync(actor.Id, id, ct) ?? throw ApiException.NotFound();

    private async Task<ChatGroupRow> CreatorGroupAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var group = await MemberGroupAsync(actor, id, ct);
        if (group.CreatedByUserId != actor.Id) throw ApiException.Forbidden("creator");
        return group;
    }

    /// <summary>The people asked for, all of whom the caller is connected with (400 notConnected otherwise). A person who blocked the caller is left out quietly.</summary>
    private async Task<List<UserRecord>> ConnectedAsync(UserRecord actor, List<Guid> ids, CancellationToken ct)
    {
        var list = new List<UserRecord>();
        foreach (var id in ids)
        {
            var user = await users.FindByPublicIdAsync(id, ct) ?? throw ApiException.Invalid("notConnected");
            if (!await store.AreConnectedAsync(actor.Id, user.Id, ct)) throw ApiException.Invalid("notConnected");
            if (await store.HasBlockedAsync(user.Id, actor.Id, ct)) continue;   // looks like any other invitation to the sender
            if (user.IsSupervised && user.BookerUserId is null) throw ApiException.Invalid("noGuardian");
            list.Add(user);
        }
        return list;
    }

    private async Task InviteAllAsync(UserRecord actor, ChatGroupRow group, List<UserRecord> invitees, DateTime now, CancellationToken ct)
    {
        var me = (await store.ListActiveAsync(group.Id, ct)).FirstOrDefault(m => m.UserId == actor.Id);
        var from = me is null ? "Guest" : Short(me);
        foreach (var user in invitees)
        {
            var status = ChatGroupRules.StatusFor(user.IsSupervised);
            var row = await store.InviteAsync(group.Id, actor.Id, user.Id, status, user.IsSupervised ? user.BookerUserId : null, now + ChatGroupRules.Lifetime, now, ct);
            if (row is null) continue;
            if (status == ChatGroupRules.Pending) await notifier.GroupInviteAsync(user.Id, row.PublicId, from, group.Name, ct);
            else await notifier.GroupApprovalAsync(user.BookerUserId!.Value, row.PublicId, row.InviteeFirst, ct);
        }
    }

    private async Task<ChatGroupDto> ViewAsync(UserRecord actor, ChatGroupRow group, CancellationToken ct)
    {
        var members = await store.ListActiveAsync(group.Id, ct);
        var creator = group.CreatedByUserId == actor.Id;
        var waiting = creator
            ? [.. (await store.ListWaitingAsync(group.Id, ct)).Select(w => new ChatGroupWaitingDto(w.PublicId, w.InviteePublicId, ChatConnectionRules.ShortName(w.InviteeFirst, w.InviteeLast), w.Status == ChatGroupRules.AwaitingGuardian))]
            : new List<ChatGroupWaitingDto>();
        var admin = ChatPlanningRules.IsAdmin(creator, members.Any(m => m.UserId == actor.Id && m.IsAdmin));
        return new(group.PublicId, group.Name,
            [.. members.Select(m => new ChatGroupMemberDto(m.PublicId, Short(m), m.UserId == actor.Id, m.UserId == group.CreatedByUserId, m.IsAdmin, m.Avatar))],
            waiting, creator, ChatGroupRules.MaxMembers, group.AnnouncementOnly, admin);
    }

    private static ChatGroupInviteDto View(long me, ChatGroupInviteRow r)
    {
        var from = ChatConnectionRules.ShortName(r.InviterFirst, r.InviterLast);
        return r.GuardianUserId == me && r.Status == ChatGroupRules.AwaitingGuardian
            ? new(r.PublicId, "approval", r.GroupName, from, r.InviteePublicId, r.InviteeFirst, TripRules.ToMs(r.CreatedAt), TripRules.ToMs(r.ExpiresAt))
            : new(r.PublicId, "incoming", r.GroupName, from, null, null, TripRules.ToMs(r.CreatedAt), TripRules.ToMs(r.ExpiresAt));
    }
}
