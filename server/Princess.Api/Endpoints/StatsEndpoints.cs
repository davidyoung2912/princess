using System.Globalization;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Endpoints;

/// <summary>The guest's own stats page (docs/stats-plan.md): real numbers from what they have done, a few made-up ones for fun, and a place for the app to add what it sees.</summary>
public static class StatsEndpoints
{
    /// <summary>How many different counters one guest may have, so the table cannot be grown without limit.</summary>
    private const int MaxCounters = 200;

    public static void MapStatsEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/me/stats", async (ICurrentUser me, IStatsStore store, IClock clock, CancellationToken ct) =>
            {
                var user = await me.LoadAsync(ct);
                var now = clock.UtcNow;
                var raw = await store.LoadAsync(user.Id, user.PublicId, now, ct);
                var name = string.IsNullOrWhiteSpace(user.FirstName) ? user.ChatNickname ?? user.Username : user.FirstName;
                return Results.Ok(StatsRules.Build(raw, name, user.PublicId, now));
            })
            .WithTags("Stats").WithSummary("The signed-in person's stats: sections of real numbers, each with a few made-up ones marked as such, then sections that are all made up. Only their own.");

        api.MapPost("/me/stats/track", async (TrackStatsRequest body, ICurrentUser me, IStatsStore store, IClock clock, CancellationToken ct) =>
            {
                var user = await me.LoadAsync(ct);
                var now = clock.UtcNow;
                var asked = body.Counters ?? new Dictionary<string, long>();
                var known = await store.CounterKeysAsync(user.Id, ct);
                var room = MaxCounters - known.Count;
                var keep = new Dictionary<string, long>(StringComparer.Ordinal);
                foreach (var (key, value) in asked.OrderBy(k => k.Key, StringComparer.Ordinal).Take(150))
                {
                    if (!StatsRules.KnownCounter(key, value) || value == 0) continue;
                    if (!known.Contains(key) && room-- <= 0) continue;
                    keep[key] = value;
                }
                var today = DateOnly.FromDateTime(now);
                var day = DateOnly.TryParseExact(body.Day, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) && Math.Abs(d.DayNumber - today.DayNumber) <= 2 ? d : today;
                long Of(string key) => keep.TryGetValue(key, out var n) ? n : 0;
                var seconds = (int)Math.Min(Of("seconds"), 86_400);
                var views = (int)Math.Min(Of("views"), 100_000);
                var opens = (int)Math.Min(Of("opens"), 1_000);
                await store.AddAsync(user.Id, day, keep, seconds, views, opens, now, ct);
                return Results.NoContent();
            })
            .WithTags("Stats").WithSummary("Adds what the device saw since the last report (screen views, seconds in the app, hour of day, shares). Counter keys are of a fixed shape; anything else is ignored. 204.");
    }
}
