using Princess.Api.Auth;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Guest pictures (N7): upload, list, fetch and delete, and the pictures other guests took of a stateroom type.</summary>
public static class MediaEndpoints
{
    public static void MapMediaEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapPost("/me/media", async (HttpRequest req, ICurrentUser me, MediaService svc, CancellationToken ct) =>
            {
                // The picture is the request body (image/jpeg or image/png); the rest is in the query. Read no more than the limit plus one byte, so a huge body is refused without being kept.
                if (req.ContentLength > MediaRules.MaxBytes) throw ApiException.Invalid("size");
                using var buffer = new MemoryStream();
                var chunk = new byte[16 * 1024];
                int n;
                while ((n = await req.Body.ReadAsync(chunk, ct)) > 0)
                {
                    buffer.Write(chunk, 0, n);
                    if (buffer.Length > MediaRules.MaxBytes) throw ApiException.Invalid("size");
                }
                return Results.Ok(await svc.UploadAsync(await me.LoadAsync(ct), req.Query["purpose"], req.Query["ref"], req.Query["kind"], req.Query["caption"], buffer.ToArray(), ct));
            })
            .WithTags("Pictures")
            .WithSummary("Keeps a picture the guest sends as the request body (JPEG or PNG, at most 2 MB, at most 8000 pixels a side and 25 million in all), with ?purpose=cabin|book|postcard, ?ref= (a stateroom category for cabin, a cruise day 1 to 8 or cover for book, none for postcard), ?kind= (room, view, obstruction or noise for cabin) and ?caption= (at most 140 characters). The type is read from the bytes, the EXIF and other metadata are removed, and a scanner looks at it first. A cabin picture waits for moderation. 400 badPurpose, empty, size, badRef, badKind, badCaption, type, unreadable or scan; 403 childCannotUpload; 409 full (40 pictures or 20 MB).");

        api.MapGet("/me/media", async (string? purpose, ICurrentUser me, MediaService svc, CancellationToken ct) => Results.Ok(await svc.MineAsync(await me.LoadAsync(ct), purpose, ct)))
            .WithTags("Pictures")
            .WithSummary("The guest's own pictures, newest first, optionally for one purpose, each with its moderation status (pending, approved or rejected).");

        api.MapGet("/me/media/usage", async (ICurrentUser me, MediaService svc, CancellationToken ct) => Results.Ok(await svc.UsageAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Pictures")
            .WithSummary("How many pictures and bytes the guest has kept, and the limits.");

        api.MapGet("/media/{id:guid}", async (Guid id, ICurrentUser me, MediaService svc, CancellationToken ct) =>
            {
                var (data, type) = await svc.OpenAsync(await me.LoadAsync(ct), id, ct);
                return Results.File(data, type);
            })
            .WithTags("Pictures")
            .WithSummary("The picture itself. The owner always; another guest only an approved cabin picture, and only while the server shows other guests' pictures (off by default). 404 otherwise.");

        api.MapDelete("/me/media/{id:guid}", async (Guid id, ICurrentUser me, MediaService svc, CancellationToken ct) =>
            {
                await svc.DeleteAsync(await me.LoadAsync(ct), id, ct);
                return Results.NoContent();
            })
            .WithTags("Pictures")
            .WithSummary("Deletes one of the guest's pictures at once, and takes it off any postcard. 404 for a picture that is not theirs.");

        api.MapGet("/cabin-photos/{category}", async (string category, ICurrentUser me, MediaService svc, CancellationToken ct) => Results.Ok(await svc.CabinAsync(await me.LoadAsync(ct), category, ct)))
            .WithTags("Pictures")
            .WithSummary("Pictures of one stateroom category: the guest's own in any state, and other guests' approved ones only while the server shows them (off by default). 400 badRef.");
    }
}
