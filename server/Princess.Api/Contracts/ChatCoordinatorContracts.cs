using System.Text.Json.Serialization;

namespace Princess.Api.Contracts;

/// <summary>
/// What the organiser sees before posting a tally or sending a reminder (docs/chat-features-research.md, phase 11). <c>ShareText</c> is exactly what would be posted to the group; <c>ReminderText</c> exactly what each person
/// reminded would read. <c>WillRemind</c> is a count: nobody is named. <c>Reason</c> says why a reminder cannot go now (<c>closed</c>, <c>tooSoon</c>, <c>none</c>).
/// </summary>
public sealed record ChatCoordinatorPreviewDto(string Status, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Compromise, string ShareText, string ReminderText, int WillRemind, bool CanRemind,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Reason = null);

/// <summary>How many people were reminded, and the sentence to show the organiser.</summary>
public sealed record ChatRemindedDto(int Reminded, string Line);

/// <summary>One poll or plan the organiser is waiting on: counts only, never who.</summary>
public sealed record ChatRemainingItemDto(Guid MessageId, string Kind, string Title, int Answered, int Total, bool Closed, long? ClosesAt);

/// <summary>The organiser's private "what remains": how many polls and plans still wait for someone, and how many answers are missing in all.</summary>
public sealed record ChatRemainingDto(int Waiting, int Outstanding, List<ChatRemainingItemDto> Items);

/// <summary>The caller does not want Stanley's reminders in this group.</summary>
public sealed record ChatRemindersMuteBody(bool Muted);

public sealed record ChatRemindersDto(bool Muted);
