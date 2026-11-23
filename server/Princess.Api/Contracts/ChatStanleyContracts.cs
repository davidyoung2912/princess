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
/// <c>Decided</c> and <c>Open</c> are short quotes with their speakers (or, when <c>Written</c> is true, short sentences a model wrote from the same messages); <c>Latest</c> is the newest few, always real quotes.
/// </summary>
public sealed record ChatCatchUpDto(string Label, int Messages, long Since, List<string> Decided, List<string> Open, List<string> Latest, bool Written = false);

/// <summary>A poll the app may offer to post to the group. Nothing is posted by asking for it.</summary>
public sealed record ChatPlanPreviewDto(string Question, List<string> Options);

public sealed record ChatPlanBody(Guid MessageId);

public sealed record ChatTermDto(string Word, string Meaning);

public sealed record ChatTermsDto(List<ChatTermDto> Terms);

/// <summary><c>Kind</c> is <c>late</c> or <c>meet</c>. Minutes (late, 5 to 180), place and time (<c>7</c>, <c>7:30</c>, <c>7 pm</c>) are optional except a place to meet at.</summary>
public sealed record ChatDraftBody(string? Kind, int? Minutes, string? Place, string? Time);

public sealed record ChatDraftDto(string Text);

/// <summary>Whether Stanley's chat help is on for this guest, and the lines the screens show (keyed by what each is for), so the app renders wording the server wrote.</summary>
public sealed record ChatStanleyStatusDto(bool On, Dictionary<string, string> Lines);

/// <summary><c>Mode</c> is <c>reword</c> (a blocked message), <c>friendlier</c>, <c>shorter</c>, <c>formal</c>, <c>fix</c>, <c>cheerful</c> or <c>clearer</c>.</summary>
public sealed record ChatRewordBody(string? Text, string? Mode);

/// <summary>One suggestion, or none. <c>Reason</c> (when there is none) is <c>unavailable</c>, <c>limit</c>, <c>safety</c> or <c>none</c>; <c>Message</c> is what Stanley says either way.</summary>
public sealed record ChatRewordDto([property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Suggestion, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Reason, string Message);

/// <summary><c>More</c>: the guest tapped "More ideas", so a model may be used.</summary>
public sealed record ChatIcebreakersBody(bool More = false);

/// <summary>Up to three openers. <c>CanMore</c>: another set can be asked for.</summary>
public sealed record ChatIcebreakersDto(List<string> Lines, bool CanMore);

/// <summary>One thing a chosen message asks for (<c>Key</c>: money, giftCard, phone, offApp or pressure) and Stanley's plain words about it.</summary>
public sealed record ChatCheckFlagDto(string Key, string Text);

/// <summary>Stanley's private look at one message: a headline, what it asks for, and up to three polite replies to use. Nothing is sent, stored or told to the sender.</summary>
public sealed record ChatCheckDto(string Headline, List<ChatCheckFlagDto> Flags, List<string> Replies, string Note, bool Worrying);
