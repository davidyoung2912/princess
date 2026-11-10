using System.Text.Json;
using System.Text.Json.Serialization;
using Princess.Api.Domain;

namespace Princess.Api.Contracts;

// Phase 10c wire shapes; they match the views in src/api/aboardTypes.ts and Message in src/api/types.ts.
// Guests and chat members are the public guid of their user (D2). Instants are epoch ms (D6).

// ---- Bookings and orders on board ----

public sealed record SelectionDto(Guid Id, string Item, int Day, string Time, int Qty, long At, long Total);

public sealed record SelectionRequest(string? Item, int Day, string? Time, int Qty);

// ---- One-tap requests ----

public sealed record RequestEventDto(string Kind, long At);

/// <summary>A request with its team, its expected time (restarted by a reopen) and what has happened to it. <c>Team</c> is the group (housekeeping or maintenance); no named person.</summary>
public sealed record ServiceRequestDto(
    Guid Id, string Item, int Qty, string Note, long PlacedAt, long EtaAt, string Stage, bool CanCancel,
    string Team, bool Escalated, bool Confirmed, bool CanEscalate, bool CanConfirm, bool CanReopen, List<RequestEventDto> History);

public sealed record CreateServiceRequest(string? Item, int Qty, string? Note);

// ---- Security reports ----

public sealed record SafetyReportDto(Guid Id, string Kind, string Where, string Note, bool Anonymous, long At, string Reference);

public sealed record CreateSafetyReport(string? Kind, string? Where, string? Note, bool Anonymous);

// ---- Drinks ----

public sealed record DrinkRowDto(Guid Id, string DrinkId, long At);

public sealed record DrinksViewDto(int CapUsd, List<DrinkRowDto> Logs, DrinkSummaryResult Summary, bool Adult);

public sealed record LogDrinkRequest(string? DrinkId);

// ---- Money ----

public sealed record TopUpDto(Guid Id, int Dollars, string Source, long At, long? SettledAt, string Reference);

public sealed record GratuityDto(long Due, string Choice, string Reason, bool CanChange, long? PaidAt);

public sealed record MoneyViewDto(string Currency, List<TopUpDto> TopUps, int TopUpTotal, bool HasCard, bool PinSet, GratuityDto Gratuity, bool CanEdit);

public sealed record TopUpRequest(int? Dollars, string? Source);

public sealed record SetPinRequest(string? Next, string? Current);

public sealed record GratuityRequest(string? Choice, string? Reason);

public sealed record CurrencyRequest(string? Code);

// ---- Cabin parties and group tables ----

public sealed record InviteDto(string Cabin, string Answer);

public sealed record PartyDto(Guid Id, string Title, int Day, string Time, List<InviteDto> Invited);

public sealed record CreatePartyRequest(string? Title, int? Day, string? Time, List<string>? Cabins);

public sealed record GroupTableDto(List<TableFriend> Friends, string Split);

public sealed record AddFriendRequest(string? Name, string? Cabin);

public sealed record SplitRequest(string? Split);

// ---- Games and the TV ----

public sealed record OnRequest(bool On);

public sealed record AnswerRequest(int Option);

/// <summary>A partial change to the TV. <c>Casting</c> and <c>Vod</c> are JSON so that a missing field (leave it) and null (clear it) can be told apart.</summary>
public sealed class TvPatchRequest
{
    public bool? On { get; set; }
    public int? Channel { get; set; }
    public int? Volume { get; set; }
    public bool? Muted { get; set; }
    public JsonElement Casting { get; set; }
    public JsonElement Vod { get; set; }
}

// ---- Last-minute tours ----

public sealed record LastMinuteTourDto(string ExcursionId, string Start, long Leaves, int Left, long Price, string? Closed);

public sealed record LastMinuteGuestDto(Guid Id, string Name, int Age);

public sealed record LastMinuteViewDto(string? Port, List<LastMinuteTourDto> Tours, List<LastMinuteGuestDto> Guests);

public sealed record BookLastMinuteRequest(List<Guid>? Guests);

// ---- Port readiness ----

public sealed record ReadyRequest(bool On);

// ---- Group chat ----

public sealed record ChatMessageDto(
    Guid Id, Guid From, string Text, long At,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Photo = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] List<Guid>? SeenBy = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? FromName = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool System = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool ViaSms = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Urgency = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] List<Guid>? AckedBy = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Acked = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool HasPhoto = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Stanley = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Subtitle = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ChatNoticeDto? Notice = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] List<ChatReactionDto>? Reactions = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ChatQuoteDto? ReplyTo = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Delivered = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Edited = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Deleted = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Kind = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ChatCardDto? Card = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Pinned = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool MentionsYou = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] List<Guid>? Mentions = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ChatPollDto? Poll = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ChatTallyDto? Tally = null);

/// <summary>A poll (phase 4): the question and its two to five options.</summary>
public sealed record ChatPollDto(string Question, List<string> Options);

/// <summary>
/// The answers to a poll or plan as one reader sees them. <c>Counts</c> is one number per poll option, or going, maybe and no for a plan. <c>Mine</c> is the reader's own choice. <c>Closed</c>, <c>ClosesAt</c> and <c>MayClose</c> are for a poll.
/// <c>Going</c> names the others who are going to a plan (first name and last initial; people the reader blocked are left out); a poll's answers are never named. <c>AddedToPlan</c>: the reader's Going put the event on their own programme.
/// </summary>
public sealed record ChatTallyDto(List<int> Counts, int? Mine, bool Closed, long? ClosesAt, bool MayClose,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] List<string>? Going = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool AddedToPlan = false);

/// <summary>A poll option vote: the index of the option, or null to take the vote back.</summary>
public sealed record ChatVoteRequest(int? Option);

/// <summary>A plan answer: <c>going</c>, <c>maybe</c> or <c>no</c>.</summary>
public sealed record ChatRsvpRequest(string? Choice);

/// <summary>
/// A card or place as a reader sees it (phase 3): a title, and where it applies. Names, times and places only. <c>Type</c> is <c>excursion</c>, <c>dining</c>, <c>booking</c>, <c>portDay</c> or <c>place</c>;
/// <c>Path</c> is the screen it opens; <c>ExpiresAt</c> (ship milliseconds) and <c>Expired</c> are set on a place, and the app shows "no longer available" for anything it cannot open.
/// </summary>
public sealed record ChatCardDto(string Type, string Title,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Subtitle = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Day = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Time = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Place = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Path = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] long? ExpiresAt = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Expired = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Note = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Gone = false);

/// <summary>One pinned message in the pin bar: its id, who said it (null for the reader's own), the words (a card's title) and when.</summary>
public sealed record ChatPinDto(Guid MessageId, string Text, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? FromName, long At, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Kind = null);

/// <summary>Something the guest can share from the app: <c>Ref</c> is sent back to share it (the server rebuilds the card from its own data).</summary>
public sealed record ChatShareableDto(string Ref, string Type, string Title, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Subtitle = null, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Day = null, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Time = null);

/// <summary>A named place on the ship a guest can drop as a meeting point ("Meet me here").</summary>
public sealed record ChatPlaceDto(string Id, string Name, int Deck, string Section);

/// <summary>What the guest can share (<c>Items</c>, from their own booking) and where they can ask to meet (<c>Places</c>, from the ship profile).</summary>
public sealed record ChatShareableListDto(List<ChatShareableDto> Items, List<ChatPlaceDto> Places, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] List<ChatPlannableDto>? Events = null);

/// <summary>A programme event on a day the guest's own sailing runs it, which a plan can be made of. <c>Ref</c> (<c>eventId:day</c>) is sent back to make the plan.</summary>
public sealed record ChatPlannableDto(string Ref, string Title, int Day, string Time, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Place = null);

/// <summary>One chip under a message: the emoji, how many chose it, whether the reader did, and the others' names (first name and last initial) for a screen reader.</summary>
public sealed record ChatReactionDto(string Emoji, int Count, bool Mine, List<string> Names);

/// <summary>The quote above a reply. <c>Id</c> is null and <c>Removed</c> true when the reader may not read the original any more (outside their window, from someone they blocked, or gone); the text is then "Message removed".</summary>
public sealed record ChatQuoteDto(Guid? Id, string Text, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? FromName = null, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Mine = false, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Removed = false);

/// <summary>A reaction to a message: one of the six in <see cref="Princess.Api.Domain.ChatReactionRules.Allowed"/>. Picking the one already held takes it away.</summary>
public sealed record ChatReactRequest(string? Emoji);

/// <summary>What a relayed company or ship notice adds to its message (phase 0b): the lane, the screen it links to, and whether it is still actionable. The text is the message's own.</summary>
/// <summary>A relayed notice. <c>ExpiresAt</c> (ship milliseconds) lets a stale copy on the device drop the actions itself; <c>Actions</c> and <c>Replies</c> are empty once it is expired or replaced.</summary>
public sealed record ChatNoticeDto(string Lane, string Kind, string Path, bool Expired, bool Superseded, long? ExpiresAt = null, IReadOnlyList<string>? Actions = null, IReadOnlyList<string>? Replies = null, string? Subject = null);

/// <summary>A chip on a notice: <c>why</c>, <c>what</c> or <c>later</c>.</summary>
public sealed record ChatNoticeReplyRequest(string? Reply);

/// <summary>Stanley's answer to a chip. <c>RemindAt</c> (ship milliseconds) is set when the reply was Remind me later.</summary>
public sealed record ChatNoticeReplyDto(string Text, long? RemindAt = null);

/// <summary>The photo of one message, as the data URL it was sent as.</summary>
public sealed record ChatPhotoDto(string Photo);

/// <summary>A message to send into one conversation. <c>ClientId</c> is made by the app so a retry never doubles the message. <c>Urgency</c> is normal (default), important or urgent; urgent is for staff and guardians only. <c>ReplyTo</c> is the message being answered.</summary>
/// <summary>
/// A message. <c>Kind</c> (phase 3) is <c>text</c> (the default), <c>card</c> (<c>ShareRef</c> from the shareable list) or <c>place</c> (<c>PlaceId</c> of a named place, an optional <c>Note</c>); a card or place carries no text from the sender.
/// Phase 4 adds <c>poll</c> (a <c>Question</c> and two to five <c>Options</c>) and <c>plan</c> (a <c>ShareRef</c> of <c>eventId:day</c> from the plannable list, an optional <c>Note</c>).
/// <c>Mentions</c> are the public ids of members the message names (at most 10); anyone who is not an active member is left out.
/// </summary>
public sealed record SendChatRequest(string? Text, Guid? ClientId = null, string? Urgency = null, Guid? ReplyTo = null, string? Kind = null, string? ShareRef = null, string? PlaceId = null, string? Note = null, List<Guid>? Mentions = null, string? Question = null, List<string>? Options = null);

/// <summary>Alert me only when I am mentioned in this conversation.</summary>
public sealed record ChatMentionsOnlyRequest(bool On);

public sealed record ChatReceiptsRequest(bool On);

public sealed record ChatBlockRequest(bool On);

public sealed record ChatReportRequest(Guid MessageId, string? Reason);

public sealed record ChatPhotoRequest(string? Type, long Bytes, string? DataUrl, string? Caption);
