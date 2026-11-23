using System.Text.Json.Serialization;

namespace Princess.Api.Contracts;

/// <summary>Makes a hand-over code for a ref (a venue or menu so far). <c>Minutes</c> is 15 (the default), 60 or 1440.</summary>
public sealed record ShareCodeBody(string? Ref, int? Minutes);

/// <summary>A code the caller made. <c>Code</c> is sent only when it is made (only its hash is kept); <c>Path</c> is the address the QR holds.</summary>
public sealed record ShareCodeDto(Guid Id, string Ref, long ExpiresAt, int Scans,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Code = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Path = null);

/// <summary>What a scan shows the receiver: the bundle rebuilt for their own sailing, who it is from (first name and last initial, only for a guest on the same sailing) and the favourites key Save uses.</summary>
public sealed record SharePreviewDto(ChatBundleDto? Bundle,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? From = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SaveKey = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ShareIntroDto? Intro = null);

/// <summary>
/// A scan that introduces a person or a group (phase Q2) instead of a bundle. <c>Kind</c> is <c>invite</c> or <c>connect</c>; <c>Name</c> is the group's name or the person's first name and last initial; <c>Members</c> counts a group's
/// people; <c>State</c> is <c>open</c> (the receiver may act), <c>member</c>, <c>waiting</c>, <c>full</c>, <c>noGuardian</c>, <c>connected</c>, <c>asked</c> or <c>self</c>.
/// </summary>
public sealed record ShareIntroDto(string Kind, string Name, string State,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Members = null);

/// <summary>What tapping Join or Send a connection request did: <c>joined</c>, <c>awaitingGuardian</c> (a child's invitation waits for their guardian), <c>requested</c> or <c>connected</c>.</summary>
public sealed record ShareAcceptDto(string Status);
