namespace Princess.Api.Contracts;

// Guest-made groups (docs/chat-plan.md, phase 5). People are the public guid of their user (D2); another guest is only ever a first name and a last initial. Instants are epoch ms (D6).

/// <summary>Make a group of people the caller is connected with. At least two, at most 24 (25 with the caller). <c>Name</c> is 1 to 40 characters.</summary>
public sealed record ChatGroupCreateBody(string? Name, List<Guid>? PersonIds);

/// <summary>Invite more people to a group. Only its creator may.</summary>
public sealed record ChatGroupInviteBody(List<Guid>? PersonIds);

public sealed record ChatGroupRenameBody(string? Name);

/// <summary>Remove a member. Only the creator may, and not themself (they leave instead).</summary>
public sealed record ChatGroupRemoveBody(Guid PersonId);

/// <summary>A person in the group. <c>Creator</c> can rename, invite and remove.</summary>
public sealed record ChatGroupMemberDto(Guid Id, string Name, bool You, bool Creator, bool Admin = false, [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)] string? Avatar = null);

/// <summary>An invitation still waiting, seen by the creator. <c>NeedsGuardian</c>: the person is a child and their guardian must say yes.</summary>
public sealed record ChatGroupWaitingDto(Guid InviteId, Guid PersonId, string Name, bool NeedsGuardian);

/// <summary>A group as a member sees it. <c>Id</c> is the conversation id. <c>Waiting</c> is filled only for the creator. <c>Max</c> is the size limit.</summary>
public sealed record ChatGroupDto(Guid Id, string Name, List<ChatGroupMemberDto> Members, List<ChatGroupWaitingDto> Waiting, bool IsCreator, int Max, bool AnnouncementOnly = false, bool IsAdmin = false);

/// <summary>Name or release the group's second admin (the creator only).</summary>
public sealed record ChatGroupAdminBody(bool On);

/// <summary>Make the group announcement-only (only admins post) or open again.</summary>
public sealed record ChatGroupAnnouncementBody(bool On);

/// <summary>
/// An invitation waiting for the caller. <c>Kind</c> is <c>incoming</c> (for the caller) or <c>approval</c> (for a child the caller is guardian of; <c>ChildId</c> and <c>ChildName</c> say which).
/// <c>From</c> is the inviter's short name.
/// </summary>
public sealed record ChatGroupInviteDto(Guid Id, string Kind, string GroupName, string From, Guid? ChildId, string? ChildName, long At, long ExpiresAt);

public sealed record ChatGroupRespondBody(bool Accept);
