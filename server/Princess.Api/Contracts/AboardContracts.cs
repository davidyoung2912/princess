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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] List<Guid>? SeenBy = null);

public sealed record SendChatRequest(string? Text);

public sealed record ChatReceiptsRequest(bool On);

public sealed record ChatBlockRequest(bool On);

public sealed record ChatReportRequest(Guid MessageId, string? Reason);

public sealed record ChatPhotoRequest(string? Type, long Bytes, string? DataUrl, string? Caption);
