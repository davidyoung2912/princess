using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Hand-over by QR code (docs/chat-bundles-plan.md, 5.6, phase Q1). A public item opens from a direct code; a handoff code names a stored share with a short life that its sender can stop. A scan only finds the bundle:
/// the receiver's server rebuilds it from the ship's data for their own sailing (so a venue their ship lacks says so), and nothing is added to anyone's plan or chats by scanning. A wrong, stopped or expired code is one
/// <c>notFound</c> and never says whether the code ever existed.
/// </summary>
public sealed class BundleShareService(IBundleShareStore store, ChatShareService share, IUserStore users, IClock clock)
{
    private static ChatBundleDto Dto(ChatBundle b) => new(b.Type, b.V, b.Title, b.Subtitle, b.Path, b.Day, b.Time, b.Place, b.Ref, b.Note);

    private static ShareCodeDto Dto(BundleShareRow r, string? code = null) => new(r.PublicId, r.Ref, Shipboard.Ms(r.ExpiresAt), r.Scans, code, code is null ? null : $"/s/{code}");

    private async Task<string?> SaveKeyAsync(UserRecord actor, string shareRef, CancellationToken ct) =>
        await share.SailingOfAsync(actor, ct) is { } sailing ? ShareCodeRules.SaveKey(AboardPlans.ShipOfSailing(sailing), shareRef) : null;

    /// <summary>What a direct code (<c>t</c> and <c>r</c>) shows this guest. 400 <c>shareRef</c> when it names nothing the guest's sailing has.</summary>
    public async Task<SharePreviewDto> DirectAsync(UserRecord actor, string? type, string? r, CancellationToken ct)
    {
        var shareRef = ShareCodeRules.DirectRef(type, r) ?? throw ApiException.Invalid("shareRef");
        var bundle = await share.BundleAsync(actor, shareRef, null, ct);
        return new(Dto(bundle), null, await SaveKeyAsync(actor, shareRef, ct));
    }

    /// <summary>Makes a handoff code. The ref is checked as for a chat bundle (400 <c>shareRef</c>), the life is 15 minutes, 1 hour or 24 hours (400 <c>minutes</c>), and a person holds at most 20 live codes (409 <c>tooMany</c>).</summary>
    public async Task<ShareCodeDto> CreateAsync(UserRecord actor, ShareCodeBody? body, CancellationToken ct)
    {
        var minutes = ShareCodeRules.LifeMinutes(body?.Minutes) ?? throw ApiException.Invalid("minutes");
        await share.BundleAsync(actor, body?.Ref, null, ct);
        var now = clock.UtcNow;
        if ((await store.ListLiveAsync(actor.Id, now, ct)).Count >= ShareCodeRules.MaxLive) throw ApiException.Conflict("tooMany");
        var code = ShareCodeRules.NewCode();
        var row = new BundleShareRow(0, Guid.NewGuid(), actor.Id, body!.Ref!, now, now.AddMinutes(minutes), null, 0);
        await store.AddAsync(row, CalendarRules.Hash(code), ct);
        return Dto(row, code);
    }

    /// <summary>The caller's codes that still open, with how many times each was scanned. The code itself is never listed again.</summary>
    public async Task<List<ShareCodeDto>> ListAsync(UserRecord actor, CancellationToken ct) => [.. (await store.ListLiveAsync(actor.Id, clock.UtcNow, ct)).Select(r => Dto(r))];

    /// <summary>Stops a code of the caller's at once. 404 for one that is not theirs.</summary>
    public async Task StopAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        if (!await store.RevokeAsync(actor.Id, id, clock.UtcNow, ct)) throw ApiException.NotFound();
    }

    /// <summary>What a handoff code shows this guest, and counts the scan (the sender's own scan is not counted). 404 <c>notFound</c> for a wrong, stopped or expired code; 400 <c>shareRef</c> when the guest's sailing does not have it.</summary>
    public async Task<SharePreviewDto> OpenAsync(UserRecord actor, string? code, CancellationToken ct)
    {
        if (!ShareCodeRules.PlausibleCode(code) || await store.FindAsync(CalendarRules.Hash(code!), ct) is not { } row || !ShareCodeRules.Live(row.ExpiresAt, row.RevokedAt, clock.UtcNow)) throw ApiException.NotFound();
        var bundle = await share.BundleAsync(actor, row.Ref, null, ct);
        string? from = null;
        if (row.UserId != actor.Id)
        {
            await store.AddScanAsync(row.Id, ct);
            if (await users.FindByIdAsync(row.UserId, ct) is { } sender && await share.SailingOfAsync(sender, ct) is { } theirs && theirs == await share.SailingOfAsync(actor, ct))
                from = ChatConnectionRules.ShortName(sender.FirstName, sender.LastName);
        }
        return new(Dto(bundle), from, await SaveKeyAsync(actor, row.Ref, ct));
    }
}
