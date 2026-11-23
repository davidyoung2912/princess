using Princess.Api.Audit;
using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Endpoints;

public sealed record ChatSuggestionUsedBody(string? Kind);

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

    /// <summary>Staff view of the rollout thresholds for suggestion cards (chat phase 14): the worst signal decides, and a sample that is too small says so. Aggregate counts only.</summary>
    public static void MapChatRolloutEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/admin/chat-rollout/summary", async (int? days, ICurrentUser me, IChatStore store, IChatHostStore host, IClock clock, CancellationToken ct) =>
            {
                if (me.ActorPublicId is not null) throw ApiException.Forbidden();
                if ((await me.LoadAsync(ct)).Role != "admin") throw ApiException.Forbidden();
                var window = ChatRolloutRules.WindowDays(Math.Clamp(days ?? 0, 0, 90));
                var counts = await store.NoticeDeliverySummaryAsync(clock.UtcNow.AddDays(-window), ct);
                var sample = ChatRolloutRules.FromSuggestionLog(counts.Where(r => r.Lane == ChatProactiveRules.Lane).Select(r => (r.Event, r.Count)));
                var h = await host.CountsSinceAsync(clock.UtcNow.AddDays(-window), ct);
                // The host roles (chat phase 12): R6 meet-ups and introductions, R11 library answers in rooms. Only what the data holds is counted; the rest is listed as unmeasured.
                var verdicts = new[] { ChatRolloutRules.Judge(sample), ChatHostRules.Verdict(ChatHostRules.Host, h.MeetUps + h.Introductions, h.HostGuests), ChatHostRules.Verdict(ChatHostRules.RoomHost, h.RoomLines, 0) };
                return Results.Ok(new { windowDays = window, verdicts, flagsRaised = h.Flags, unmeasured = new[] { "guestsExposed", "mute", "remindersMuted", "reports", "catchUpWrong", "pushOptOut", "actionRate" } });
            })
            .WithTags("Stanley")
            .WithSummary("Administrators only (403 otherwise): the suggestion cards' dismiss and don't-show-again rates, and the host roles R6 and R11 (counts of what they did), against the rollout thresholds (notEnough, ok, rewrite or pause) over the last `days` (at least 14), with the signals the logs cannot yet give listed as unmeasured. Aggregate counts only.");
    }

    /// <summary>Staff view of the "Measures" lines of section 13.6 across the 11 stages. Aggregate counts only; a measure the data cannot give is listed as unmeasured, never shown as zero.</summary>
    public static void MapChatStageMeasureEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/admin/chat-stages/summary", async (int? days, ICurrentUser me, IChatStageStatsStore stats, IClock clock, CancellationToken ct) =>
            {
                if (me.ActorPublicId is not null) throw ApiException.Forbidden();
                if ((await me.LoadAsync(ct)).Role != "admin") throw ApiException.Forbidden();
                var window = ChatRolloutRules.WindowDays(Math.Clamp(days ?? 0, 0, 90));
                var counts = await stats.CountsSinceAsync(clock.UtcNow.AddDays(-window), ct);
                return Results.Ok(new { windowDays = window, measures = ChatStageMeasureRules.Measures(counts), unmeasured = ChatStageMeasureRules.Unmeasured });
            })
            .WithTags("Stanley")
            .WithSummary("Administrators only (403 otherwise): how chat is used at each stage (shortlists shared in huddles, party chats used within 48 hours, reminders that ended up muted, groups with a plan or poll, meet-ups, kept chats, recaps shared, reports per 1000 messages) over the last `days` (at least 14). Aggregate counts only; measures the data cannot give are listed as unmeasured.");
    }

    /// <summary>Staff view of Stanley in chat (stanley plan, phase 7): his calls per day and the share of his suggestions guests used. Counts only, from audit rows that hold no text and no person.</summary>
    public static void MapChatStanleyUseEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/admin/chat-stanley/summary", async (int? days, ICurrentUser me, IAuditStore audit, IClock clock, CancellationToken ct) =>
            {
                if (me.ActorPublicId is not null) throw ApiException.Forbidden();
                if ((await me.LoadAsync(ct)).Role != "admin") throw ApiException.Forbidden();
                var window = Math.Clamp(days ?? 7, 1, 30);
                var now = clock.UtcNow;
                var from = now.Date.AddDays(-(window - 1));
                var rows = new List<AuditEntry>();
                var truncated = false;
                foreach (var action in ChatStanleyUseRules.CallActions.Append(ChatStanleyUseRules.UsedAction))
                {
                    var page = await audit.QueryAsync(new AuditQuery { ActionPrefix = action, Category = AuditCategory.Domain, From = from, Max = 500 }, ct);
                    truncated |= page.Count >= 500;
                    rows.AddRange(page);
                }
                return Results.Ok(ChatStanleyUseRules.Summarise(rows, now, window, truncated));
            })
            .WithTags("Stanley")
            .WithSummary("Administrators only (403 otherwise): Stanley's chat calls per day (reword, icebreakers, catch-up, @Stanley, ask about a message), by kind, and the share of his suggestions that guests used, over the last `days` (1 to 30, default 7). The share is absent until 20 suggestions were given. Counts only: no text, no person.");

        api.MapPost("/me/chat/stanley/used", async (ChatSuggestionUsedBody body, ICurrentUser me, IAuditLog audit, CancellationToken ct) =>
            {
                await me.LoadAsync(ct);
                var kind = ChatStanleyUseRules.ParseUsed(body?.Kind) ?? throw ApiException.Invalid("kind");
                await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = ChatStanleyUseRules.UsedAction, Outcome = AuditOutcome.Success, Target = "chat", Detail = kind }, ct);
                return Results.NoContent();
            })
            .RequireRateLimiting(ChatConnectionEndpoints.SearchLimiter)
            .WithTags("Chat: Stanley")
            .WithSummary("The guest tapped Use this on one of Stanley's suggestions (`kind`: reword, icebreakers or reply). Counts only: nothing about the text or the conversation is kept. 400 kind.");
    }

    /// <summary>The totals and the fail-open share (of notices posted or failed open) from the log's grouped counts.</summary>
    public static StanleyNoticeSummaryDto Summarise(long sinceMs, IReadOnlyList<NoticeDeliveryCount> rows)
    {
        // Suggestion cards are in the counts by lane, but not in the totals: they are not notices, and they would hide how often a real notice failed open.
        int Sum(string evt) => rows.Where(r => r.Event == evt && r.Lane != ChatProactiveRules.Lane).Sum(r => r.Count);
        var posted = Sum(StanleyNoticeRules.EventPosted);
        var failed = Sum(StanleyNoticeRules.EventFailOpen);
        var share = posted + failed == 0 ? 0 : (double)failed / (posted + failed);
        return new(sinceMs, [.. rows.Select(r => new StanleyNoticeCountDto(r.Kind, r.Lane, r.Event, r.Count))], posted, failed, Sum(StanleyNoticeRules.EventAcked), share);
    }
}
