namespace Princess.Api.Contracts;

/// <summary>Start a huddle. Only a name; nobody is invited by the app.</summary>
public sealed record ChatHuddleStartBody(string? Name);

/// <summary>A link's token, to look at who is in before joining (a POST, so the token is never in an address or a log), or to join with the guest's statement that they are 18 or over.</summary>
public sealed record ChatHuddleTokenBody(string? Token, bool AdultConfirmed = false);

/// <summary>One person in a huddle: first name and last initial.</summary>
public sealed record ChatHuddleMemberDto(Guid Id, string Name, bool You, bool Creator);

/// <summary>A shortlist card: public catalogue facts and when they were true. <c>Fields</c> are plain label to value pairs; the server refuses any that name a person's own money or a booking, cabin or document number.</summary>
public sealed record ChatHuddleCardDto(Guid Id, string Kind, string Title, Dictionary<string, string> Fields, long AsOf, bool Mine);

public sealed record ChatHuddleCardBody(string? Kind, string? Title, Dictionary<string, string>? Fields, long? AsOf);

/// <summary>
/// A huddle as a member sees it. <c>DeleteOn</c> is when it is deleted if nobody speaks (60 days after the last message), and <c>Warn</c> is true from day 50. <c>LinkUntil</c> is when the live link ends, shown only to the creator.
/// </summary>
public sealed record ChatHuddleDto(Guid Id, string Name, List<ChatHuddleMemberDto> Members, List<ChatHuddleCardDto> Shortlist, bool IsCreator, int Max, int SeatsLeft, long DeleteOn, bool Warn, long? LinkUntil);

/// <summary>A link just made. The token is shown once and is kept only as a hash, so it cannot be shown again; making another replaces it.</summary>
public sealed record ChatHuddleLinkDto(string Token, long ExpiresAt);

/// <summary>What anyone with a valid link sees before joining: who is in and how many seats are left. No name of the huddle's topic, no messages, no cards.</summary>
public sealed record ChatHuddlePreviewDto(List<string> Members, int SeatsLeft);

/// <summary>The huddle just joined.</summary>
public sealed record ChatHuddleJoinedDto(Guid Id);
