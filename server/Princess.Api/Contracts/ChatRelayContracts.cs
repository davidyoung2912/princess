using System.Text.Json.Serialization;

namespace Princess.Api.Contracts;

/// <summary>The messages the guest chose to hand to a person, by id (at most ten).</summary>
public sealed record ChatRelayDraftBody(List<Guid>? MessageIds);

/// <summary>
/// The draft of what would go to Guest Services: exactly the text the guest then reads and may edit. <c>Count</c> is how many chosen messages it holds; <c>Skipped</c> how many could not be carried (a photo, a card, a deleted message).
/// Sending goes through <c>POST /me/stanley/handoffs</c> with the guest's consent; nothing is sent here.
/// </summary>
public sealed record ChatRelayDraftDto(string Text, int Count, int Skipped, int Max);

public sealed record ChatRecapPlanDto(Guid MessageId, string Title, int? Day, string? Time, string? Place, bool Mine, string Decision);
public sealed record ChatRecapPhotoDto(Guid MessageId, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? From, bool Mine, string Decision);

/// <summary>
/// The recap as one member sees it. Before it is shared: their own parts (with their decision) and a count of how many parts all members have decided; never another member's parts. After: only approved parts, each photo with
/// the first name and last initial of whoever added it. <c>Photos</c> carries no picture, only ids to fetch one by one.
/// </summary>
public sealed record ChatRecapDto(Guid Id, bool Shared, long StartedAt, long? SharedAt, int Decided, int Total, string Progress, List<ChatRecapPlanDto> Plans, List<ChatRecapPhotoDto> Photos, bool CanShare, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? ShareRefusal);

/// <summary>The caller's photos for the recap: the messages with a photo they sent themselves. Replaces what they chose before.</summary>
public sealed record ChatRecapPhotosBody(List<Guid>? MessageIds);

/// <summary>approved or declined.</summary>
public sealed record ChatRecapDecideBody(string? Decision);

/// <summary>One of the caller's own photo messages they could add to a recap.</summary>
public sealed record ChatRecapChoiceDto(Guid MessageId, long At, bool Chosen);
