using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Ship photos (SHP-02, SHP-07): browse by day, place and person, choose first, see the options priced against the choice, buy and save in resumable batches. Ports <c>photos</c> of <c>src/api/extrasMock.ts</c>.
/// A purchase is one account line. A purchase of photos that the package included is stored with option <c>each</c> and no payment, and shows as <c>included</c>; how many were included is its saving over the price of one.
/// </summary>
public sealed class PhotoService(ScopeLoader scopes, IShipboardStore store, PlanService plan)
{
    private static long Until(Scope c) =>
        Shipboard.Ms(Itinerary.LocalToUtc(Itinerary.Days(c.Departure)[7].Date.AddDays(PhotoRules.RedownloadDays), new TimeOnly(23, 59), Itinerary.ShipHomeZone));

    private static int ThroughDay(Scope c) => Shipboard.IsAboard(c) ? Math.Clamp(FolioRules.CruiseDay(c.Departure, c.Now), 0, 8) : 0;

    private static List<Photo> AllPhotos(Scope c) => PhotoRules.PhotosFor([.. c.Party.Select(p => p.Id)], ThroughDay(c));

    private static int IncludedIn(PhotoPurchaseRow p) => (int)(p.SavedCents / PhotoRules.PriceEach);

    private static PhotoReceiptDto Receipt(PhotoPurchaseRow p)
    {
        var saved = p.Items.Count(i => i.Downloaded);
        return new PhotoReceiptDto(p.PublicId, Shipboard.Ms(p.At), p.PaidCents == 0 ? "included" : p.Option, [.. p.Items.Select(i => i.PhotoId)], p.PaidCents, saved, saved >= p.Items.Count, Shipboard.Ms(p.Until));
    }

    private async Task<int> IncludedLeftAsync(Scope c, IReadOnlyList<PhotoPurchaseRow> purchases, CancellationToken ct) =>
        (await plan.BookerEntitlementsAsync(c.Actor, c.Booking, ct)).Package == "premier" ? Math.Max(0, PhotoRules.IncludedWithPremier - purchases.Sum(IncludedIn)) : 0;

    private static List<string> Choose(Scope c, IReadOnlyList<string>? ids, IReadOnlySet<string> owned)
    {
        if (ids is null || ids.Count == 0) throw ApiException.Invalid("empty");
        var known = AllPhotos(c).Select(p => p.Id).ToHashSet();
        var unique = ids.Distinct().ToList();
        if (!unique.All(known.Contains)) throw ApiException.Invalid("unknownPhoto");
        if (unique.Any(owned.Contains)) throw ApiException.Invalid("alreadyOwned");
        return unique;
    }

    public async Task<PhotosViewDto> ListAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        var purchases = await store.ListPhotoPurchasesAsync(c.Booking.BookingId, ct);
        return new PhotosViewDto(
            AllPhotos(c), await store.ListFavouritesAsync(actor.Id, ct), [.. purchases.SelectMany(p => p.Items.Select(i => i.PhotoId)).Distinct()],
            [.. purchases.Select(Receipt).Reverse()], await IncludedLeftAsync(c, purchases, ct), [.. PhotoRules.Photographers],
            [.. c.Party.Select(p => new GuestDto(p.Id, p.Name))], ThroughDay(c));
    }

    public async Task<List<string>> ToggleFavouriteAsync(UserRecord actor, string? number, string? photoId, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        if (!AllPhotos(c).Any(p => p.Id == photoId)) throw ApiException.Invalid("unknownPhoto");
        return await store.ToggleFavouriteAsync(actor.Id, photoId!, ct);
    }

    public async Task<PhotoQuoteDto> QuoteAsync(UserRecord actor, string? number, PhotoIdsRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        var purchases = await store.ListPhotoPurchasesAsync(c.Booking.BookingId, ct);
        var ids = Choose(c, body?.PhotoIds, purchases.SelectMany(p => p.Items.Select(i => i.PhotoId)).ToHashSet());
        var q = PhotoRules.Options(ids.Count, await IncludedLeftAsync(c, purchases, ct));
        return new PhotoQuoteDto(q.Included, q.Paid, q.Options, PhotoRules.Cheapest(q.Options));
    }

    public async Task<PhotoReceiptDto> BuyAsync(UserRecord actor, string? number, BuyPhotosRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        var purchases = await store.ListPhotoPurchasesAsync(c.Booking.BookingId, ct);
        var owned = purchases.SelectMany(p => p.Items.Select(i => i.PhotoId)).ToHashSet();
        var ids = Choose(c, body?.PhotoIds, owned);
        var q = PhotoRules.Options(ids.Count, await IncludedLeftAsync(c, purchases, ct));
        if (q.Paid > 0 && (body?.Option is null || !PhotoRules.OptionIds.Contains(body.Option))) throw ApiException.Invalid("badOption");
        var chosen = q.Paid == 0 ? null : q.Options.First(o => o.Id == body!.Option);
        var items = chosen?.Id == "all" ? AllPhotos(c).Select(p => p.Id).Where(i => !owned.Contains(i)).ToList() : ids;
        var paid = chosen?.Total ?? 0;
        var included = q.Included;
        var description = chosen?.Id == "all" ? "Photos, all digital for the cruise" : $"Photos, {items.Count} digital";
        var purchase = new PhotoPurchaseRow
        {
            Option = chosen?.Id ?? "each", PaidCents = paid, SavedCents = included * PhotoRules.PriceEach, Until = Shipboard.FromMs(Until(c)), At = c.Now, BuyerUserId = actor.Id,
            Items = [.. items.Select(i => (i, false))],
        };
        var folio = new FolioWrite(actor.Id, Shipboard.DayAt(c, c.Now), "photos", description, paid, included > 0 ? "package" : null, c.Now);
        return Receipt(await store.AddPhotoPurchaseAsync(c.Booking.BookingId, purchase, [folio], ct));
    }

    public async Task<PhotoReceiptDto> DownloadAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var purchase = (await store.ListPhotoPurchasesAsync(c.Booking.BookingId, ct)).FirstOrDefault(p => p.PublicId == id) ?? throw ApiException.NotFound();
        if (Shipboard.Ms(c.Now) > Until(c)) throw ApiException.Conflict("expired");
        return Receipt(await store.SavePhotoBatchAsync(c.Booking.BookingId, id, PhotoRules.DownloadBatch, ct) ?? purchase);
    }
}
