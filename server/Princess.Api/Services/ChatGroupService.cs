using Microsoft.Extensions.Options;
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
public sealed class ChatGroupService(IChatGroupStore store, IUserStore users, IUserClock clock, ChatNotifier notifier, IChatStore chat, IChatStanleyStore stanley, IOptions<StanleyOptions> options, IChatConnectionStore people, StanleyNoticeRelay stanleyThread)
{
    private static string Short(ChatGroupPersonRow p) => ChatConnectionRules.ShortName(p.FirstName, p.LastName);

    public async Task<ChatGroupDto> CreateAsync(UserRecord actor, ChatGroupCreateBody? body, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var name = ChatGroupRules.CleanName(body?.Name) ?? throw ApiException.Invalid("name");
        if (ProfanityFilter.IsBlocked(name)) throw ApiException.Invalid("blocked");
        var ids = Distinct(actor, body?.PersonIds);
        var found = Distinct(actor, body?.InvitePersonIds).Where(f => !ids.Contains(f)).ToList();
        if (ids.Count + found.Count < ChatGroupRules.MinInvitedAtStart) throw ApiException.Invalid("tooFew");
        if (!ChatGroupRules.Fits(1, 0, ids.Count + found.Count)) throw ApiException.Invalid("tooMany");
        var now = await clock.NowAsync(actor, ct);
        // Everyone is checked before anything is made, so a bad person does not leave a half-made group.
        var invitees = await ConnectedAsync(actor, ids, ct);
        invitees.AddRange(await FoundAsync(actor, found, ct));
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

    /// <summary>The creator takes back an invitation that has not been answered. It leaves the invitee's list; an answered one is 409 answered.</summary>
    public async Task RevokeInviteAsync(UserRecord actor, Guid id, Guid inviteId, CancellationToken ct)
    {
        var group = await CreatorGroupAsync(actor, id, ct);
        var row = await store.GetInviteAsync(inviteId, ct);
        if (row is null || row.GroupId != group.Id) throw ApiException.NotFound("invite");
        if (!await store.SetInviteStatusAsync(row.Id, [ChatGroupRules.Pending, ChatGroupRules.AwaitingGuardian], ChatGroupRules.Cancelled, await clock.NowAsync(actor, ct), ct)) throw ApiException.Conflict("answered");
        await TellTakenBackAsync(row, ct);
    }

    /// <summary>The inviter takes back an invitation that has not been answered, from the main chat page. 404 for anyone else's; 409 once answered.</summary>
    public async Task RevokeSentAsync(UserRecord actor, Guid inviteId, CancellationToken ct)
    {
        var row = await store.GetInviteAsync(inviteId, ct);
        if (row is null || row.InviterId != actor.Id) throw ApiException.NotFound("invite");
        if (!await store.SetInviteStatusAsync(row.Id, [ChatGroupRules.Pending, ChatGroupRules.AwaitingGuardian], ChatGroupRules.Cancelled, await clock.NowAsync(actor, ct), ct)) throw ApiException.Conflict("answered");
        await TellTakenBackAsync(row, ct);
    }

    /// <summary>The invitee's (and a guardian's) open app is nudged so the invitation leaves their list and the badge drops at once.</summary>
    private async Task TellTakenBackAsync(ChatGroupInviteRow row, CancellationToken ct)
    {
        await notifier.ChangedAsync(row.InviteeId, ct);
        if (row.GuardianUserId is long guardian) await notifier.ChangedAsync(guardian, ct);
    }

    /// <summary>The invitations the caller sent that nobody has answered yet.</summary>
    public async Task<List<ChatGroupInviteDto>> SentInvitesAsync(UserRecord actor, CancellationToken ct) =>
        [.. (await store.ListSentInvitesAsync(actor.Id, ct)).Select(r => new ChatGroupInviteDto(r.PublicId, "outgoing", r.GroupName, ChatConnectionRules.ShortName(r.InviteeFirst, r.InviteeLast), null, null, TripRules.ToMs(r.CreatedAt), TripRules.ToMs(r.ExpiresAt), r.InviteeAvatar))];

    public async Task RemoveAsync(UserRecord actor, Guid id, ChatGroupRemoveBody? body, CancellationToken ct)
    {
        var group = await CreatorGroupAsync(actor, id, ct);
        var members = await store.ListActiveAsync(group.Id, ct);
        var person = members.FirstOrDefault(m => m.PublicId == body?.PersonId) ?? throw ApiException.NotFound("person");
        if (person.UserId == actor.Id) throw ApiException.Invalid("self");
        await store.RemoveMemberAsync(group.Id, person.UserId, "removed", ChatGroupRules.RemovedLine(Short(person)), await clock.NowAsync(actor, ct), ct);
        // The person is told at once, and the others' open apps refetch so the line and the member count show.
        await notifier.ChatEndedAsync(person.UserId, group.PublicId, group.Name, false, ct);
        await TellAsync(group, [.. members.Where(m => m.UserId != person.UserId && m.UserId != actor.Id)], "members", ct);
        // Everyone affected gets a Stanley message; everyone but the leader (who just did it) also gets a popup if they are not looking at the chat.
        var now = await clock.NowAsync(actor, ct);
        var leader = members.First(m => m.UserId == actor.Id);
        var gone = Short(person);
        var stamp = $"{group.PublicId:N}:{person.PublicId:N}:{now.Ticks}";
        var staying = members.Where(m => m.UserId != person.UserId && m.UserId != actor.Id).ToList();
        await AnnounceAsync(actor.Id, $"chat:removed:{stamp}", $"{gone} was removed", $"You removed {gone} from “{group.Name}”. They have been told, and they can no longer read or write in the group. You can invite them back from the group page any time.", null, now, true, false, ct, group.PublicId);
        await AnnounceAsync(person.UserId, $"chat:removedYou:{stamp}", $"You were removed from “{group.Name}”", $"{Short(leader)} removed you from “{group.Name}”, so it is no longer in your chats and you won't see anything new there. If you think this was a mistake, you can ask {Short(leader)} to invite you back.",
            $"{Short(leader)} removed {gone} from “{group.Name}”, so it is no longer in their chats. If you think this was a mistake, you can ask {Short(leader)} to invite them back.", now, true, false, ct);
        foreach (var m in staying)
            await AnnounceAsync(m.UserId, $"chat:removedOther:{stamp}", $"{gone} was removed from “{group.Name}”", $"{Short(leader)} removed {gone} from “{group.Name}”. With {gone} gone, {PeopleLeft(staying.Count + 1)}.", null, now, true, false, ct, group.PublicId);
    }

    /// <summary>
    /// Tells one person about a change to a chat: a message in their Stanley chat to refer back to and, when <paramref name="popup"/>, a bottom popup (shown by an open app that is not on the main chat page) that stays until Got it.
    /// A child's guardian is told too, in words about the child. <paramref name="phone"/> is false where another alert for the same event already reaches the phone, and for the person who made the change themself.
    /// </summary>
    private async Task AnnounceAsync(long userId, string keyBase, string title, string body, string? guardianBody, DateTime now, bool popup, bool phone, CancellationToken ct, Guid? conversation = null)
    {
        // A notice about a group that still exists for the person links to it, and stays quiet while they are looking at it.
        var path = conversation is Guid c ? $"/chat/c/{c:D}" : "/chat";
        if (await users.FindByIdAsync(userId, ct) is not { } person) return;
        var key = $"{keyBase}:{userId}";
        await stanleyThread.TellAsync(person, key, title, body, now, ct, popup ? "chatEvent" : "chatNote", path);
        if (popup) await notifier.InfoAsync(userId, key, title, body, ct, phone, path);
        if (guardianBody is not null && person.IsSupervised && person.BookerUserId is long guardianId && guardianId != userId && await users.FindByIdAsync(guardianId, ct) is { } guardian)
        {
            var gkey = $"{keyBase}:guardian:{guardianId}:{userId}";
            await stanleyThread.TellAsync(guardian, gkey, title, guardianBody, now, ct, "chatEvent", path);
            if (popup) await notifier.InfoAsync(guardianId, gkey, title, guardianBody, ct, phone, path);
        }
    }

    /// <summary>The words about a person leaving or going, for everyone who stays: how many are left.</summary>
    private static string PeopleLeft(int count) => count == 1 ? "just you are left" : $"{count} people are still in it";

    /// <summary>Makes the group announcement-only (only admins post; votes, answers and reactions stay open) or opens it again. Only the creator (the group's only admin) may. 403 admin.</summary>
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

    /// <summary>Deletes the whole group for everyone (creator only). The others' open apps refetch, and the group is gone from their lists. 403 creator.</summary>
    public async Task DeleteAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var group = await CreatorGroupAsync(actor, id, ct);
        var members = await store.ListActiveAsync(group.Id, ct);
        var waiting = await store.ListWaitingAsync(group.Id, ct);
        await store.DeleteGroupAsync(group.Id, ct);
        var others = members.Where(m => m.UserId != actor.Id).ToList();
        await Task.WhenAll(others.Select(m => notifier.ChatEndedAsync(m.UserId, group.PublicId, group.Name, true, ct)));
        // Everyone is out at once, and each is told in words: a popup that stays until Got it, and a message in their Stanley chat to refer back to.
        var leader = members.FirstOrDefault(m => m.UserId == actor.Id);
        var now = await clock.NowAsync(actor, ct);
        var body = $"{(leader is null ? "The leader" : Short(leader))} closed “{group.Name}”, so it has now been removed from your chats. Thank you for being part of the conversation!";
        var name = leader is null ? "The leader" : Short(leader);
        foreach (var m in others)
            await AnnounceAsync(m.UserId, $"chat:groupEnded:{group.PublicId:N}", "A chat group has ended", body, $"{name} closed “{group.Name}”, so it has been removed from {Short(m)}'s chats.", now, true, false, ct);   // ChatEndedAsync has already sent the phone alert
        // The leader keeps a record of closing it, and anyone still deciding on an invitation is told it is no longer open.
        await AnnounceAsync(actor.Id, $"chat:groupClosed:{group.PublicId:N}", "You closed a chat group", $"You closed “{group.Name}”. Everyone in it has been told and it has been removed from their chats, too.", null, now, false, false, ct);
        foreach (var w in waiting)
        {
            var text = $"{name} closed “{group.Name}” before the invitation was answered, so there is nothing to join now. You can still ask {name} to start a new group.";
            await AnnounceAsync(w.InviteeId, $"chat:inviteClosed:{group.PublicId:N}:{w.PublicId:N}", "A chat group invitation was withdrawn", text, null, now, true, true, ct);
            if (w.GuardianUserId is long guardianId && w.Status == ChatGroupRules.AwaitingGuardian)
                await AnnounceAsync(guardianId, $"chat:inviteClosedGuardian:{group.PublicId:N}:{w.PublicId:N}", "A chat group invitation was withdrawn", $"{name} closed “{group.Name}” before the invitation for {w.InviteeFirst} was answered, so there is nothing to approve now.", null, now, true, true, ct);
        }
    }

    /// <summary>Anyone in the group can leave except its leader, who has to delete the group instead (403 leader). The others are told by a line in the thread and read nothing said after.</summary>
    public async Task LeaveAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var group = await MemberGroupAsync(actor, id, ct);
        if (group.CreatedByUserId == actor.Id) throw ApiException.Forbidden("leader");
        var me = (await store.ListActiveAsync(group.Id, ct)).First(m => m.UserId == actor.Id);
        var now = await clock.NowAsync(actor, ct);
        if (!await store.RemoveMemberAsync(group.Id, actor.Id, "left", ChatGroupRules.LeftLine(Short(me)), now, ct)) throw ApiException.NotFound();
        // Everyone affected hears of it in their Stanley chat, and in a popup if they are not looking at the chat: the leader, the people who stay, the person who left (a record only) and a child's guardian.
        var members = await store.ListActiveAsync(group.Id, ct);
        var stamp = $"{group.PublicId:N}:{actor.Id}:{now.Ticks}";
        var who = Short(me);
        var leaderRow = members.FirstOrDefault(m => m.UserId == group.CreatedByUserId);
        await AnnounceAsync(actor.Id, $"chat:leftYou:{stamp}", $"You left “{group.Name}”", $"You left “{group.Name}”. It is no longer in your chats, and nothing said there from now on will reach you. If you change your mind, ask {(leaderRow is null ? "the leader" : Short(leaderRow))} to invite you back.",
            null, now, false, false, ct);
        if (group.CreatedByUserId is long leaderId)
            await AnnounceAsync(leaderId, $"chat:left:{stamp}", $"{who} left your chat group", $"{who} chose to leave “{group.Name}”. {(members.Count == 1 ? "Now it is just you." : $"{members.Count} people are still in it.")} You can invite {who} back from the group page any time.", null, now, true, true, ct, group.PublicId);
        foreach (var m in members.Where(x => x.UserId != group.CreatedByUserId))
            await AnnounceAsync(m.UserId, $"chat:leftOther:{stamp}", $"{who} left “{group.Name}”", $"{who} chose to leave “{group.Name}”. With {who} gone, {PeopleLeft(members.Count)}.", null, now, true, false, ct, group.PublicId);
        // The guardian of the child who left is told in words about the child (the child's own notice is above).
        if (actor.IsSupervised && actor.BookerUserId is long parent && parent != actor.Id)
            await AnnounceAsync(parent, $"chat:leftChild:{stamp}", $"{who} left “{group.Name}”", $"{who} left “{group.Name}”, so it is no longer in their chats.", null, now, true, false, ct);
    }

    /// <summary>Invitations waiting for the caller, and for children they are guardian of.</summary>
    public async Task<List<ChatGroupInviteDto>> InvitesAsync(UserRecord actor, CancellationToken ct)
    {
        var now = await clock.NowAsync(actor, ct);
        await store.ExpireAsync(actor.Id, now, ct);
        await store.MarkAnswersSeenAsync(actor.Id, now, ct);   // opening the chat page is seeing who answered
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
            await notifier.GroupAnsweredAsync(row.InviterId, row.PublicId, ChatConnectionRules.ShortName(row.InviteeFirst, row.InviteeLast), row.GroupName, false, ct);
            return;
        }
        var who = ChatConnectionRules.ShortName(row.InviteeFirst, row.InviteeLast);
        var result = await store.AcceptInviteAsync(row.Id, ChatGroupRules.JoinedLine(who), ChatGroupRules.MaxMembers, now, ct);
        if (result == "full") throw ApiException.Conflict("full");
        if (result is not null) throw ApiException.Conflict("answered");
        await notifier.GroupAnsweredAsync(row.InviterId, row.PublicId, who, row.GroupName, true, ct);
        // The person who said yes (not a guardian answering for a child) is thanked by Stanley inside the group they joined.
        if (asInvitee) await ThanksAsync(row.GroupId, who, now, ct);
        await WelcomeAsync(row.GroupId, row.GroupName, now, ct);
    }

    /// <summary>Stanley's thank-you in the group, as his own message. Held back in the same cases as his welcome: no child in the group, his help off there, or his chat route switched off. A failure never undoes the join.</summary>
    private async Task ThanksAsync(long groupId, string who, DateTime now, CancellationToken ct)
    {
        if (!options.Value.Switches.Chat) return;
        try
        {
            var members = await store.ListActiveAsync(groupId, ct);
            if (members.Any(m => m.IsSupervised) || await stanley.IsOffAsync(groupId, ct)) return;
            await chat.AddGroupStanleyMessageAsync(groupId, ChatHostRules.AcceptThanks(who), false, now, ct);
        }
        catch (Exception e) when (e is not OperationCanceledException) { }
    }

    /// <summary>
    /// Stanley's one welcome line when a made group first has someone besides its creator (docs/chat-stanley-plan.md, phase 5). It names the group and says what he can do, no one's name and no plans. Never where a supervised child is
    /// a member, where the creator turned his help off, or where his chat route is switched off. A person who muted him hides it like any of his lines. A failure here never undoes the join.
    /// </summary>
    private async Task WelcomeAsync(long groupId, string groupName, DateTime now, CancellationToken ct)
    {
        if (!options.Value.Switches.Chat) return;
        try
        {
            var members = await store.ListActiveAsync(groupId, ct);
            if (!ChatHostRules.ShouldWelcome(members.Count == 2, false) || members.Any(m => m.IsSupervised) || await stanley.IsOffAsync(groupId, ct)) return;
            await chat.AddGroupStanleyMessageAsync(groupId, ChatHostRules.GroupWelcome(groupName), true, now, ct);
        }
        catch (Exception e) when (e is not OperationCanceledException) { }
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

    /// <summary>People the caller found by searching: each must be someone the search could have shown (findable, not blocked either way). Anyone else looks like nobody (400 person).</summary>
    private async Task<List<UserRecord>> FoundAsync(UserRecord actor, List<Guid> ids, CancellationToken ct)
    {
        var list = new List<UserRecord>();
        foreach (var id in ids)
        {
            var row = (await people.FindPeopleAsync(actor.Id, null, id, 1, ct)).FirstOrDefault();
            var user = row is null ? null : await users.FindByIdAsync(row.UserId, ct);
            if (user is null) throw ApiException.Invalid("person");
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
            ? [.. (await store.ListWaitingAsync(group.Id, ct)).Select(w => new ChatGroupWaitingDto(w.PublicId, w.InviteePublicId, ChatConnectionRules.ShortName(w.InviteeFirst, w.InviteeLast), w.Status == ChatGroupRules.AwaitingGuardian, w.InviteeAvatar))]
            : new List<ChatGroupWaitingDto>();
        var admin = ChatPlanningRules.IsAdmin(creator, members.Any(m => m.UserId == actor.Id && m.IsAdmin));
        return new(group.PublicId, group.Name,
            [.. members.Select(m => new ChatGroupMemberDto(m.PublicId, Short(m), m.UserId == actor.Id, m.UserId == group.CreatedByUserId, m.IsAdmin, m.Avatar, TripRules.ToMs(m.JoinedAt), m.LastMessageAt is { } lm ? TripRules.ToMs(lm) : null, m.MessageCount, m.LastActiveAt is { } la ? TripRules.ToMs(la) : null))],
            waiting, creator, ChatGroupRules.MaxMembers, group.AnnouncementOnly, admin);
    }

    private static ChatGroupInviteDto View(long me, ChatGroupInviteRow r)
    {
        var from = ChatConnectionRules.ShortName(r.InviterFirst, r.InviterLast);
        return r.GuardianUserId == me && r.Status == ChatGroupRules.AwaitingGuardian
            ? new(r.PublicId, "approval", r.GroupName, from, r.InviteePublicId, r.InviteeFirst, TripRules.ToMs(r.CreatedAt), TripRules.ToMs(r.ExpiresAt), r.InviterAvatar)
            : new(r.PublicId, "incoming", r.GroupName, from, null, null, TripRules.ToMs(r.CreatedAt), TripRules.ToMs(r.ExpiresAt), r.InviterAvatar);
    }
}
