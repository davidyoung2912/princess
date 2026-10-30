using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public sealed class DocumentService(
    AccessService access, SubjectAccess subjects, IAccountStore accounts, ITripStore trips, IPrivacyStore privacy, IUserClock clock)
{
    private static DateOnly D(DateTime d) => DateOnly.FromDateTime(d);
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");

    public static DocumentRules.Held HeldOf(GuestRow g)
    {
        var held = new DocumentRules.Held();
        foreach (var (doc, expires) in g.Held) held[doc] = DocumentRules.HasExpiry(doc) && expires is { } e ? Iso(D(e)) : null;
        return held;
    }

    public static DateOnly ReturnDate(DateTime departure, int nights) => D(departure).AddDays(nights);

    public static DocumentRules.GuestDocs Check(GuestRow g, DateTime departure, int nights) =>
        DocumentRules.ForGuest(g.Citizenship, AccountRules.AgeOn(D(g.Dob), D(departure)), HeldOf(g), ReturnDate(departure, nights));

    public async Task<DocumentsViewDto> GetAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var m = await access.RequireMemberAsync(actor, number, ct);
        var now = await clock.NowAsync(actor, ct);
        await privacy.AddAccessAsync(actor.Id, actor.FirstName ?? "", "documents:viewed", now, ct);
        return await ViewAsync(actor, m.BookingId, onlyGuest: null, ct);
    }

    /// <summary>Records that a guest holds a document (with its expiry), as the guest, their booker, or a helper with the documents permission.</summary>
    public async Task<DocumentsViewDto> SetAsync(UserRecord actor, Guid guestId, string doc, string? expires, string? bookingNumber, CancellationToken ct)
    {
        var s = await subjects.ResolveAsync(actor, guestId, HelperPermission.Documents, write: true, ct);
        if (!DocumentRules.DocIds.Contains(doc)) throw ApiException.Invalid("unknownDocument");
        DateTime? expiry = null;
        if (DocumentRules.HasExpiry(doc) && expires is not null)
        {
            if (!AccountRules.IsIsoDate(expires)) throw ApiException.Invalid("expires");
            expiry = DateOnly.ParseExact(expires, "yyyy-MM-dd").ToDateTime(TimeOnly.MinValue);
        }
        var bookingId = await BookingForAsync(actor, s, bookingNumber, ct);
        var now = await clock.NowAsync(actor, ct);
        await accounts.SetDocumentAsync(s.Target.Id, doc, expiry, now, ct);
        await Record(actor, s, doc, removed: false, now, ct);
        return await ViewAsync(actor, bookingId, s.ViaHelper ? s.Target.PublicId : null, ct);
    }

    public async Task<DocumentsViewDto> RemoveAsync(UserRecord actor, Guid guestId, string doc, string? bookingNumber, CancellationToken ct)
    {
        var s = await subjects.ResolveAsync(actor, guestId, HelperPermission.Documents, write: true, ct);
        if (!DocumentRules.DocIds.Contains(doc)) throw ApiException.Invalid("unknownDocument");
        var bookingId = await BookingForAsync(actor, s, bookingNumber, ct);
        var now = await clock.NowAsync(actor, ct);
        await accounts.RemoveDocumentAsync(s.Target.Id, doc, ct);
        await Record(actor, s, doc, removed: true, now, ct);
        return await ViewAsync(actor, bookingId, s.ViaHelper ? s.Target.PublicId : null, ct);
    }

    private async Task Record(UserRecord actor, Subject s, string doc, bool removed, DateTime now, CancellationToken ct)
    {
        var first = (await accounts.GetProfileAsync(s.Target.Id, ct))?.FirstName ?? "";
        await privacy.AddAccessAsync(s.Target.Id, actor.FirstName ?? "", "documents:saved", now, ct);
        await accounts.AddHistoryAsync(s.Target.Id, actor.Id, "documents", $"{first}: {DocName(doc)}{(removed ? " removed" : "")}", now, ct);
    }

    private static string DocName(string doc) => doc switch
    {
        "passport" => "Passport",
        "birthCertificate" => "Birth certificate (certified copy)",
        "photoId" => "Government photo ID",
        _ => "Travel insurance",
    };

    /// <summary>The booking whose view comes back: the one the caller names (and is on), else the one they share with the guest.</summary>
    private async Task<long> BookingForAsync(UserRecord actor, Subject s, string? number, CancellationToken ct)
    {
        if (number is not null && !s.ViaHelper) return (await access.RequireMemberAsync(actor, number, ct)).BookingId;
        return s.Booking?.BookingId ?? throw ApiException.NotFound();
    }

    private async Task<DocumentsViewDto> ViewAsync(UserRecord actor, long bookingId, Guid? onlyGuest, CancellationToken ct)
    {
        var b = await trips.GetAsync(bookingId, ct) ?? throw ApiException.NotFound();
        var guests = await accounts.GetPartyAsync(bookingId, ct);
        // A helper sees only the guest who consented, never the rest of the party.
        if (onlyGuest is { } only) guests = guests.Where(g => g.PublicId == only).ToList();
        var departure = D(b.Departure);
        var list = guests.Select(g =>
        {
            var docs = Check(g, b.Departure, b.Nights);
            var held = g.Held.ToDictionary(kv => kv.Key, kv => new HeldDocDto(DocumentRules.HasExpiry(kv.Key) && kv.Value is { } e ? Iso(D(e)) : null));
            var results = docs.Results.Select(r => new ReqResultDto(new RequirementDto(r.Requirement.Id, r.Requirement.Level, r.Requirement.SatisfiedBy), r.Status, r.UsedDoc, r.Problem)).ToList();
            return new GuestDocumentsDto(g.PublicId, AccountService.FullName(g), AccountRules.AgeOn(D(g.Dob), departure), g.Citizenship, held, results, docs.Blocking);
        }).ToList();
        return new DocumentsViewDto(Iso(ReturnDate(b.Departure, b.Nights)), list, !actor.IsSupervised);
    }
}
