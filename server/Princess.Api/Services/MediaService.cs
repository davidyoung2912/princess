using System.Text;
using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>Looks at a picture's bytes before it is kept (N7.1). A real scanner is a provider behind this; the simulation only refuses the standard antivirus test string.</summary>
public interface IMediaScanner
{
    Task<bool> IsCleanAsync(byte[] data, string contentType, CancellationToken ct);
}

public sealed class SimMediaScanner : IMediaScanner
{
    private static readonly byte[] Eicar = Encoding.ASCII.GetBytes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE");

    public Task<bool> IsCleanAsync(byte[] data, string contentType, CancellationToken ct) => Task.FromResult(data.AsSpan().IndexOf(Eicar) < 0);
}

/// <summary>
/// Guest pictures (N7.1 to N7.5). A picture is checked (real type from its bytes, size, pixel count, scanner), cleaned of its metadata and kept under the guest.
/// Only the owner can fetch it, with two exceptions: an approved cabin picture, and only while <c>Media:ShowOthers</c> is on (default off, until the moderation answer is settled),
/// and a postcard picture through a live family link (see <see cref="FamilyHomeService"/>). A supervised child cannot keep pictures. Deleting the account deletes them (cascade).
/// </summary>
public sealed class MediaService(IMediaStore store, IUserClock clock, IMediaScanner scanner, IConfiguration config)
{
    private bool ShowOthers => config.GetValue("Media:ShowOthers", false);

    private static long Ms(DateTime utc) => new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeMilliseconds();

    private static MediaDto Dto(MediaRow r, DateTime now, bool mine) =>
        new(r.PublicId, r.Purpose, r.Reference, r.Kind, r.Caption, r.ContentType, r.Width, r.Height, r.ByteCount, MediaRules.EffectiveStatus(r.Status, r.CreatedAt, now), Ms(r.CreatedAt), mine);

    public async Task<MediaDto> UploadAsync(UserRecord user, string? purpose, string? reference, string? kind, string? caption, byte[] body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden("childCannotUpload");
        if (!MediaRules.KnownPurpose(purpose)) throw ApiException.Invalid("badPurpose");
        if (body.Length == 0) throw ApiException.Invalid("empty");
        if (body.Length > MediaRules.MaxBytes) throw ApiException.Invalid("size");
        if (!MediaRules.ValidRef(purpose!, reference, out var cleanRef)) throw ApiException.Invalid("badRef");
        if (!MediaRules.ValidKind(purpose!, kind, out var cleanKind)) throw ApiException.Invalid("badKind");
        if (!MediaRules.ValidCaption(caption, out var cleanCaption)) throw ApiException.Invalid("badCaption");
        var type = MediaRules.Sniff(body) ?? throw ApiException.Invalid("type");
        if (!MediaRules.TryClean(body, type, out var clean, out var width, out var height)) throw ApiException.Invalid("unreadable");
        if (!await scanner.IsCleanAsync(clean, type, ct)) throw ApiException.Invalid("scan");
        var (count, bytes) = await store.UsageAsync(user.Id, ct);
        if (count >= MediaRules.MaxCount || bytes + clean.Length > MediaRules.MaxTotalBytes) throw ApiException.Conflict("full");
        var now = await clock.NowAsync(user, ct);
        // A cabin picture waits for the moderator; the others are only ever seen by the guest or by the people they chose.
        var status = purpose == "cabin" ? "pending" : "approved";
        var id = await store.AddAsync(user.Id, purpose!, cleanRef, cleanKind, cleanCaption, type, width, height, clean, status, now, ct);
        return Dto((await store.FindAsync(id, ct))!, now, true);
    }

    public async Task<List<MediaDto>> MineAsync(UserRecord user, string? purpose, CancellationToken ct)
    {
        if (purpose is not null && !MediaRules.KnownPurpose(purpose)) throw ApiException.Invalid("badPurpose");
        var now = await clock.NowAsync(user, ct);
        return [.. (await store.ListMineAsync(user.Id, purpose, ct)).Select(r => Dto(r, now, true))];
    }

    public async Task<MediaUsageDto> UsageAsync(UserRecord user, CancellationToken ct)
    {
        var (count, bytes) = await store.UsageAsync(user.Id, ct);
        return new MediaUsageDto(count, bytes, MediaRules.MaxCount, MediaRules.MaxTotalBytes);
    }

    /// <summary>The caller's own pictures of a stateroom category, in any state, and (when switched on) other guests' approved ones.</summary>
    public async Task<List<MediaDto>> CabinAsync(UserRecord user, string category, CancellationToken ct)
    {
        if (!MediaRules.ValidRef("cabin", category, out var clean)) throw ApiException.Invalid("badRef");
        var now = await clock.NowAsync(user, ct);
        var rows = await store.ListByReferenceAsync("cabin", clean, 60, ct);
        return [.. rows.Select(r => Dto(r, now, r.UserId == user.Id)).Where(d => d.Mine || (ShowOthers && d.Status == "approved"))];
    }

    /// <summary>The bytes of a picture the caller may see. 404 for one that does not exist or is not theirs to see, so a guess tells nothing.</summary>
    public async Task<(byte[] Data, string ContentType)> OpenAsync(UserRecord user, Guid id, CancellationToken ct)
    {
        var row = await store.FindAsync(id, ct) ?? throw ApiException.NotFound();
        var now = await clock.NowAsync(user, ct);
        if (!MediaRules.MayView(row.UserId, user.Id, row.Purpose, MediaRules.EffectiveStatus(row.Status, row.CreatedAt, now), ShowOthers)) throw ApiException.NotFound();
        var data = await store.BytesAsync(id, ct) ?? throw ApiException.NotFound();
        return (data, row.ContentType);
    }

    public async Task DeleteAsync(UserRecord user, Guid id, CancellationToken ct)
    {
        if (!await store.DeleteAsync(user.Id, id, ct)) throw ApiException.NotFound();
    }
}
