using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Cases for lost items, bill queries, claims and complaints (DEB-06, POS-07, POS-11). Ports the <c>cases</c> group of <c>src/api/finishMock.ts</c>.
/// A case belongs to the booking; any guest reads, an adult guest opens and withdraws. The stage, outcome and refund are worked out from the clock.
/// </summary>
public sealed class CaseService(ScopeLoader scopes, IFinishStore store)
{
    private static long Ms(DateTime utc) => TripRules.ToMs(utc);

    internal static CaseStatus StatusOf(CaseRow c, DateTime now) =>
        PostCruiseRules.StatusOf(new CaseTimes(c.Kind, c.Number, c.OpenedAt, c.Cents, c.WithdrawnAt), now);

    private async Task<CasesViewDto> ViewAsync(Scope c, CancellationToken ct)
    {
        var cases = (await store.ListCasesAsync(c.Booking.BookingId, ct)).OrderByDescending(x => x.OpenedAt).ThenByDescending(x => x.Number, StringComparer.Ordinal).Select(x =>
        {
            var s = StatusOf(x, c.Now);
            return new CaseDto(
                x.PublicId, x.Kind, x.Number, x.Summary, x.Place, x.Cents, Ms(x.OpenedAt), Ms(s.DueAt), s.Stage, s.Outcome, s.Refund is null ? null : new CaseRefundDto(s.Refund.Cents, s.Refund.Sent, s.Refund.ExpectedBy),
                PostCruiseRules.Withdrawable(s), x.FromFeedback);
        }).ToList();
        return new CasesViewDto(cases, c.Confirmed && c.Now >= FinishStages.EmbarkationAt(c) && !c.Actor.IsSupervised);
    }

    public async Task<CasesViewDto> ListAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    /// <summary>Opens a case with a number nobody else holds. Used here and by the service-recovery case that poor feedback starts.</summary>
    internal async Task<CaseRow> AddAsync(Scope c, UserRecord actor, string kind, string summary, string place, string lineId, long cents, bool fromFeedback, CancellationToken ct)
    {
        var seq = (await store.ListCasesAsync(c.Booking.BookingId, ct)).Count;
        for (var attempt = 0; attempt < 50; attempt++)
        {
            var row = new CaseRow
            {
                UserId = actor.Id, Kind = kind, Number = PostCruiseRules.CaseNumber(kind, c.Booking.Number, seq + attempt), Summary = summary, Place = place, Cents = cents, LineId = lineId,
                OpenedAt = c.Now, DueAt = c.Now.AddHours(PostCruiseRules.SlaHours(kind)), FromFeedback = fromFeedback,
            };
            if (await store.AddCaseAsync(c.Booking.BookingId, row, ct) is { } added) return added;
        }
        throw new InvalidOperationException("No free case number.");
    }

    public async Task<CasesViewDto> OpenAsync(UserRecord actor, string? number, OpenCaseRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (!c.Confirmed || c.Now < FinishStages.EmbarkationAt(c)) throw ApiException.Conflict("closed");
        if (PostCruiseRules.CaseProblem(body?.Kind, body?.Summary, body?.Place, body?.LineId, body?.Cents ?? 0) is { } problem) throw ApiException.Invalid(problem);
        var kind = body!.Kind!;
        var open = (await store.ListCasesAsync(c.Booking.BookingId, ct)).Where(x => PostCruiseRules.Withdrawable(StatusOf(x, c.Now))).ToList();
        if (open.Count >= PostCruiseRules.MaxOpenCases) throw ApiException.Conflict("tooManyCases");
        if (kind == "billing" && open.Any(x => x.Kind == "billing" && x.LineId == body.LineId)) throw ApiException.Conflict("alreadyQueried");
        await AddAsync(c, actor, kind, body.Summary!.Trim(), (body.Place ?? "").Trim(), kind == "billing" ? body.LineId! : "", kind is "billing" or "claim" ? body.Cents : 0, fromFeedback: false, ct);
        return await ViewAsync(c, ct);
    }

    public async Task<CasesViewDto> WithdrawAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var row = (await store.ListCasesAsync(c.Booking.BookingId, ct)).FirstOrDefault(x => x.PublicId == id) ?? throw ApiException.NotFound();
        if (!PostCruiseRules.Withdrawable(StatusOf(row, c.Now)) || !await store.WithdrawCaseAsync(c.Booking.BookingId, id, c.Now, ct)) throw ApiException.Conflict("tooLate");
        return await ViewAsync(c, ct);
    }
}
