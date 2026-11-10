using System.Text.Json.Nodes;

namespace Princess.Api.Contracts;

// Next-level plan N3: reaching the guest. Instants are epoch ms.

public sealed record PushSubscribeRequest(string? Endpoint, string? P256dh, string? Auth, int? Budget, bool? Calm, List<string>? Watch);

public sealed record PushUnsubscribeRequest(string? Endpoint);
public sealed record PushAckRequest(string? Key);

public sealed record PushLogDto(string Key, string Kind, string Outcome, string? Reason, bool Critical, int Devices, JsonNode Params, long At, bool Read, bool Acked = false);

/// <summary>What this server can do for the guest's phone, and what it has done. <see cref="PublicKey"/> is null when it cannot send at all.</summary>
public sealed record PushStatusDto(bool Available, string? PublicKey, bool Subscribed, int Devices, int Budget, bool Calm, List<string> Watch, int Unread, List<PushLogDto> Log);

public sealed record CalendarFeedDto(bool On, string? Path);

/// <summary>Whether the guest has a phone number on the profile, whether it has been confirmed by text, and whether a code is waiting.</summary>
public sealed record PhoneCheckDto(bool HasPhone, bool Verified, bool Pending);

/// <summary>Whether the account has an email address, whether it has been confirmed by an emailed code, and whether a code is waiting.</summary>
public sealed record EmailCheckDto(bool HasEmail, bool Verified, bool Pending);

/// <summary>A text sent back to the notice number, as the text provider's adapter passes it on.</summary>
/// <summary><c>Id</c> is the provider's message id; a delivery repeated with the same id is stored once.</summary>
public sealed record InboundSmsRequest(string? From, string? Body, string? Id = null);

public sealed record PhoneCodeRequest(string? Code);
