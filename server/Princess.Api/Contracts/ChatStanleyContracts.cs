using System.Text.Json.Serialization;

namespace Princess.Api.Contracts;

/// <summary>
/// Whether Stanley's help is on in a conversation. <c>Reason</c> (when not available) is <c>kind</c> (his own chat, a channel or room), <c>child</c> (a supervised child is a member) or <c>off</c> (the creator turned it off).
/// <c>CanSwitch</c>: the caller made this group and may turn it off or on; <c>Off</c> is the switch as it stands.
/// </summary>
public sealed record ChatStanleyTapDto(bool Available, bool CanSwitch, bool Off, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Reason = null, bool Muted = false);

public sealed record ChatStanleyOffBody(bool Off);

/// <summary>This member does not want to see Stanley's answers in this conversation (hidden on their devices; nobody is told).</summary>
public sealed record ChatStanleyMuteBody(bool Muted);

/// <summary>
/// A private catch-up. Nothing in it is stored in the thread or shown to anyone else. <c>Label</c> says it is not a full record. <c>Messages</c> is how many it read and <c>Since</c> the time of the oldest (ship ms).
/// <c>Decided</c> and <c>Open</c> are short quotes with their speakers; <c>Latest</c> is the newest few.
/// </summary>
public sealed record ChatCatchUpDto(string Label, int Messages, long Since, List<string> Decided, List<string> Open, List<string> Latest);

/// <summary>A poll the app may offer to post to the group. Nothing is posted by asking for it.</summary>
public sealed record ChatPlanPreviewDto(string Question, List<string> Options);

public sealed record ChatPlanBody(Guid MessageId);

public sealed record ChatTermDto(string Word, string Meaning);

public sealed record ChatTermsDto(List<ChatTermDto> Terms);

/// <summary><c>Kind</c> is <c>late</c> or <c>meet</c>. Minutes (late, 5 to 180), place and time (<c>7</c>, <c>7:30</c>, <c>7 pm</c>) are optional except a place to meet at.</summary>
public sealed record ChatDraftBody(string? Kind, int? Minutes, string? Place, string? Time);

public sealed record ChatDraftDto(string Text);
