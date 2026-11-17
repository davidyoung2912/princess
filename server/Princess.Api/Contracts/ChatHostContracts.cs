namespace Princess.Api.Contracts;

/// <summary>Start a meet-up in a room or made group. Plain words only: no link, number or email.</summary>
public sealed record ChatMeetUpBody(string? Title, string? Place);

/// <summary>Answer a meet-up: <c>in</c>, <c>maybe</c> or <c>no</c>.</summary>
public sealed record ChatMeetUpAnswerBody(string? Answer);

/// <summary>A meet-up as a member sees it: how many are in and how many maybe, and their own answer. Nobody's decline is counted or shown, and no one else's answer is named.</summary>
public sealed record ChatMeetUpDto(Guid Id, string Title, string? Place, int In, int Maybe, string? Mine, bool Started, long At);

/// <summary>Ask to be introduced to someone in this room who shares one interest from the fixed list.</summary>
public sealed record ChatIntroBody(string? Interest);

/// <summary>Where "introduce me" stands for the caller: <c>none</c>, <c>waiting</c> (until <c>EndsAt</c>) or <c>introduced</c> (with the other person's first name and last initial). <c>Interests</c> lists the choices.</summary>
public sealed record ChatIntroDto(string State, string? Interest, long? EndsAt, string? Name, List<string> Interests);

/// <summary>What a room tells a new member: the welcome line (null when Stanley is off for the room, muted by this member, or a child is present) and the questions he can answer.</summary>
public sealed record ChatHostWelcomeDto(string? Line, string Rules, List<string> Topics);

public sealed record ChatHostAskBody(string? Text);

/// <summary>A question to Stanley in a room: <c>Answered</c> with the library answer (also posted to the room), or not, with the words to show only to the asker.</summary>
public sealed record ChatHostAnswerDto(bool Answered, string Text);

/// <summary>Ask Stanley to flag a post to staff. A reason from the list: spam, unsafe, rude, other.</summary>
public sealed record ChatHostFlagBody(string? Reason);

/// <summary>A flag waiting for staff: where, which post, why and when. Never the words; staff read the post in the room.</summary>
public sealed record ChatHostFlagDto(Guid Id, Guid RoomId, string RoomName, Guid MessageId, string Reason, long At);
