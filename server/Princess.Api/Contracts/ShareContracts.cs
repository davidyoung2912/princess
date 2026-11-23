using System.Text.Json.Serialization;

namespace Princess.Api.Contracts;

/// <summary>Makes a hand-over code for a ref (a venue or menu so far). <c>Minutes</c> is 15 (the default), 60 or 1440.</summary>
public sealed record ShareCodeBody(string? Ref, int? Minutes);

/// <summary>A code the caller made. <c>Code</c> is sent only when it is made (only its hash is kept); <c>Path</c> is the address the QR holds.</summary>
public sealed record ShareCodeDto(Guid Id, string Ref, long ExpiresAt, int Scans,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Code = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Path = null);

/// <summary>What a scan shows the receiver: the bundle rebuilt for their own sailing, who it is from (first name and last initial, only for a guest on the same sailing) and the favourites key Save uses.</summary>
public sealed record SharePreviewDto(ChatBundleDto Bundle,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? From = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SaveKey = null);
