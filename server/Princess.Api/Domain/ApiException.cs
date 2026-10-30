namespace Princess.Api.Domain;

/// <summary>The error codes of <c>src/api/errors.ts</c> that the server can produce. The client alone produces network, timeout and offline.</summary>
public enum ApiErrorCode
{
    Invalid,
    Conflict,
    Forbidden,
    NotFound,
    Challenge,
    Declined,
    Server,
}

/// <summary>A failure with a code the screens switch on and a title token such as <c>badCredentials</c>. Rendered as RFC 7807 problem details.</summary>
public sealed class ApiException(ApiErrorCode code, string title, int status) : Exception(title)
{
    public ApiErrorCode Code { get; } = code;
    public string Title { get; } = title;
    public int Status { get; } = status;

    public static ApiException Invalid(string title = "invalid") => new(ApiErrorCode.Invalid, title, StatusCodes.Status400BadRequest);
    public static ApiException Unauthenticated(string title = "unauthenticated") => new(ApiErrorCode.Forbidden, title, StatusCodes.Status401Unauthorized);
    public static ApiException Forbidden(string title = "forbidden") => new(ApiErrorCode.Forbidden, title, StatusCodes.Status403Forbidden);
    public static ApiException NotFound(string title = "notFound") => new(ApiErrorCode.NotFound, title, StatusCodes.Status404NotFound);
    public static ApiException Conflict(string title = "conflict") => new(ApiErrorCode.Conflict, title, StatusCodes.Status409Conflict);
    /// <summary>The bank wants its one-time code: title <c>required</c> when missing, <c>wrong</c> when it does not match.</summary>
    public static ApiException Challenge(string title) => new(ApiErrorCode.Challenge, title, StatusCodes.Status402PaymentRequired);
    /// <summary>The bank declined the payment; the title names the method that was declined.</summary>
    public static ApiException Declined(string title) => new(ApiErrorCode.Declined, title, StatusCodes.Status402PaymentRequired);

    public static string CodeName(ApiErrorCode code) => code switch
    {
        ApiErrorCode.Invalid => "invalid",
        ApiErrorCode.Conflict => "conflict",
        ApiErrorCode.Forbidden => "forbidden",
        ApiErrorCode.NotFound => "notFound",
        ApiErrorCode.Challenge => "challenge",
        ApiErrorCode.Declined => "declined",
        _ => "server",
    };
}
