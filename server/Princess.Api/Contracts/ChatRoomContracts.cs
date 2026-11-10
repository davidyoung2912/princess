using System.Text.Json.Serialization;

namespace Princess.Api.Contracts;

/// <summary>
/// What a channel or room adds to a conversation (docs/chat-features-research.md, phase 8). <c>CanPost</c> is false with the reason in <c>Why</c> (a stable code: off, left, closed, staffOnly, muted, rulesNotAccepted);
/// <c>Slow</c> is whether slow mode applies now (staff switched it on, or it is outside moderator hours); <c>RulesAccepted</c> is false until the guest has said yes to <c>Rules</c> (asked on the first post).
/// </summary>
public sealed record ChatRoomInfoDto(string RoomKind, string? Topic, string Rules, bool Slow, bool RulesAccepted, bool CanPost, string? Why, bool StaffOnly, int Members);

/// <summary>A channel or room in the directory. <c>Joined</c>: the guest follows or is in it. <c>Blocked</c>: why they cannot join (off, child, closed, noBooking, full, removed), or null when they can.</summary>
public sealed record ChatRoomListItemDto(Guid Id, string Kind, string? RoomKind, string Name, string? Topic, int Members, bool Joined, string? Blocked, bool Closed);

/// <summary>What a guest may read of a room they are not in: its rules and what staff chose to show (pinned posts of a room; the latest staff posts of a channel). Never a guest's live post.</summary>
public sealed record ChatRoomPreviewDto(Guid Id, string Kind, string Name, string Rules, List<ChatRoomPreviewLineDto> Lines, List<string> Questions);
public sealed record ChatRoomPreviewLineDto(string Text, long At);

/// <summary>A question a guest suggests for a room's popular questions.</summary>
public sealed record ChatRoomQuestionBody(string? Text);

// ---- Staff ----

public sealed record ChatQuestionDto(Guid Id, Guid RoomId, string RoomName, string Text, long At);

/// <summary>Staff decide a suggested question: <c>popular</c> (it shows in the room's preview) or <c>reject</c>.</summary>
public sealed record ChatQuestionDecisionBody(string? Decision);

/// <summary>Opens a channel or room. <c>Kind</c> is channel or room; a room needs <c>RoomKind</c> sailing (with <c>SailingId</c>) or interest (with <c>Topic</c>). <c>ReferenceOffsetMinutes</c> places moderator hours; <c>Cap</c> defaults to 500.</summary>
public sealed record ChatRoomCreateBody(string? Kind, string? RoomKind, string? Name, string? Topic, string? SailingId, int? ReferenceOffsetMinutes, int? Cap, string? Rules);

/// <summary>One staff action on a room: <c>slow</c>, <c>open</c>, <c>close</c>, <c>rules</c> (with <c>Rules</c>), <c>moderator</c> and <c>unmoderator</c> (with <c>PersonId</c>).</summary>
public sealed record ChatRoomActionBody(string? Action, bool? On, string? Rules, Guid? PersonId);

/// <summary>An action on one person: <c>mute</c> (with <c>For</c>: hour, day or room), <c>unmute</c> or <c>remove</c>.</summary>
public sealed record ChatRoomPersonBody(string? Action, string? For);

/// <summary>An action on one message: <c>remove</c> or <c>pin</c>.</summary>
public sealed record ChatRoomMessageBody(string? Action);

public sealed record ChatRoomAdminDto(Guid Id, string Kind, string? RoomKind, string Name, string? Topic, string? SailingId, int Members, int Cap, int Moderators, bool Closed, bool Slow, bool InHours, string Rules);

public sealed record ChatHeldDto(Guid Id, Guid RoomId, string RoomName, string From, string Text, string Reason, long At);

/// <summary>Staff decide a held post: <c>release</c> (it is posted as the guest's) or <c>reject</c>.</summary>
public sealed record ChatHeldDecisionBody(string? Decision);

/// <summary>The weekly moderation summary: reports and staff actions in the room kinds, the busiest rooms, rooms that are open without the rota they need, and posts waiting. No message text and no guest names.</summary>
public sealed record ChatRoomSummaryDto(int Days, int Reports, List<ChatRoomActionCountDto> Actions, List<ChatRoomBusyDto> Busiest, List<ChatRoomGapDto> NoModerator, int Held);
public sealed record ChatRoomActionCountDto(string Action, int Count);
public sealed record ChatRoomBusyDto(Guid Id, string Name, int Posts);
public sealed record ChatRoomGapDto(Guid Id, string Name, int Moderators);

/// <summary>A live post in a room as staff see it, so they can remove or pin it. <c>From</c> is a first name and last initial; <c>FromId</c> is the sender's public id, for a person action.</summary>
public sealed record ChatRoomPostDto(Guid Id, Guid FromId, string From, string Text, long At, bool Pinned);

/// <summary>An active member as staff see them: first name and last initial, with whether staff muted them (and until when).</summary>
public sealed record ChatRoomPersonDto(Guid Id, string Name, bool Muted, long? MutedUntil);

/// <summary>A staff member who could be on the room's rota, and whether they are named.</summary>
public sealed record ChatRoomModeratorDto(Guid Id, string Name, bool Named);
