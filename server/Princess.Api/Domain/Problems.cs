using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Princess.Api.Domain;

/// <summary>Builds the problem-details body: <c>type</c> is the ApiErrorCode string, <c>title</c> the message token.</summary>
public static class Problems
{
    public static ProblemDetails Create(ApiErrorCode code, string title, int status) =>
        new() { Type = ApiException.CodeName(code), Title = title, Status = status };

    /// <summary>Gives framework-made errors (bad JSON, 405, 415, unmatched routes) the same type and title tokens as ours.</summary>
    public static void Normalise(ProblemDetails p)
    {
        var (code, title) = (p.Status ?? 500) switch
        {
            401 => (ApiErrorCode.Forbidden, "unauthenticated"),
            403 => (ApiErrorCode.Forbidden, "forbidden"),
            404 => (ApiErrorCode.NotFound, "notFound"),
            409 => (ApiErrorCode.Conflict, "conflict"),
            >= 400 and < 500 => (ApiErrorCode.Invalid, "invalid"),
            _ => (ApiErrorCode.Server, "server"),
        };
        p.Type = ApiException.CodeName(code);
        p.Title = title;
    }

    public static Task Write(HttpContext http, ApiErrorCode code, string title, int status)
    {
        http.Response.StatusCode = status;
        return http.Response.WriteAsJsonAsync(Create(code, title, status), (System.Text.Json.JsonSerializerOptions?)null, "application/problem+json");
    }
}

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> log) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception exception, CancellationToken ct)
    {
        switch (exception)
        {
            case ApiException api:
                await Problems.Write(http, api.Code, api.Title, api.Status);
                return true;
            case BadHttpRequestException or System.Text.Json.JsonException:
                await Problems.Write(http, ApiErrorCode.Invalid, "invalid", StatusCodes.Status400BadRequest);
                return true;
            default:
                log.LogError(exception, "Unhandled exception");
                await Problems.Write(http, ApiErrorCode.Server, "server", StatusCodes.Status500InternalServerError);
                return true;
        }
    }
}
