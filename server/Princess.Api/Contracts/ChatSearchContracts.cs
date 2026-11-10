using System.Text.Json.Serialization;

namespace Princess.Api.Contracts;

/// <summary>One message a search found. <c>FromName</c> is a first name and last initial, empty for the caller's own message. <c>Text</c> is a snippet around the match.</summary>
public sealed record ChatSearchHitDto(Guid ConversationId, Guid MessageId, string FromName, bool Mine, string Text, long At);

/// <summary>A page of hits, newest first. <c>Before</c> is the message to pass to get the next, older page; absent at the end.</summary>
public sealed record ChatSearchResultDto(List<ChatSearchHitDto> Hits, bool HasMore, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Guid? Before = null);

/// <summary>One line of an export: who said it (a first name and last initial, or "You"), when, and the words. A photo is named, never carried.</summary>
public sealed record ChatExportLineDto(string From, long At, string Text, bool Photo, bool System);

/// <summary>Everything the caller may read of one conversation, oldest first, for saving as a file. <c>Truncated</c> is true when only the newest messages are here.</summary>
public sealed record ChatExportDto(string Name, long At, List<ChatExportLineDto> Lines, bool Truncated);
