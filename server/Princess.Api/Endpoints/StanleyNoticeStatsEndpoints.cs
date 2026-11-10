using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Endpoints;

/// <summary>One line of the relay's counts. No person, no text.</summary>
public sealed record StanleyNoticeCountDto(string Kind, string Lane, string Event, int Count);

/// <summary>What the notice relay has done since a time: aggregate counts by kind, lane and event, plus the share of notices that reached the phone only through the fail-open path.</summary>
public sealed record StanleyNoticeSummaryDto(long Since, IReadOnlyList<StanleyNoticeCountDto> Counts, int Posted, int FailOpen, int Acked, double FailOpenShare);

/// <summary>Staff view of the Stanley notice relay (docs/chat-features-research.md, 15.8 and 15.12). Aggregate counts only: never who read or acknowledged what (15.8 rule 8).</summary>
public static class StanleyNoticeStatsEndpoints
{
    public static void MapStanleyNoticeStatsEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/admin/stanley-notices/summary", async (int? hours, ICurrentUser me, IChatStore store, IClock clock, CancellationToken ct) =>
            {
                if (me.ActorPublicId is not null) throw ApiException.Forbidden();
                if ((await me.LoadAsync(ct)).Role != "admin") throw ApiException.Forbidden();
                var since = clock.UtcNow.AddHours(-StanleyNoticeRules.StatsWindowHours(hours));
                var counts = await store.NoticeDeliverySummaryAsync(since, ct);
                return Results.Ok(Summarise(TripRules.ToMs(since), counts));
            })
            .WithTags("Stanley")
            .WithSummary("Administrators only (403 otherwise): how many notices the Stanley relay posted, how many reached the phone only because the thread write failed, and how many guests tapped Got it, by kind and lane, over the last `hours` (default 24, 1 to 720). Aggregate counts only.");
    }

    /// <summary>The totals and the fail-open share (of notices posted or failed open) from the log's grouped counts.</summary>
    public static StanleyNoticeSummaryDto Summarise(long sinceMs, IReadOnlyList<NoticeDeliveryCount> rows)
    {
        int Sum(string evt) => rows.Where(r => r.Event == evt).Sum(r => r.Count);
        var posted = Sum(StanleyNoticeRules.EventPosted);
        var failed = Sum(StanleyNoticeRules.EventFailOpen);
        var share = posted + failed == 0 ? 0 : (double)failed / (posted + failed);
        return new(sinceMs, [.. rows.Select(r => new StanleyNoticeCountDto(r.Kind, r.Lane, r.Event, r.Count))], posted, failed, Sum(StanleyNoticeRules.EventAcked), share);
    }
}
