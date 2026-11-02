using Princess.Api.Domain;

namespace Princess.Api.Endpoints;

/// <summary>Shared reference data and simulated feeds that every device must see the same (multi-device plan Phase 5, data model section 6.9).</summary>
public static class ReferenceEndpoints
{
    public static void MapReferenceEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/rates", (IClock clock) => Results.Ok(RatesRules.TableFor(DateOnly.FromDateTime(clock.UtcNow))))
            .WithTags("Reference").WithSummary("Today's exchange rates per US dollar (a stub feed, the same for every device). For reading only: the account is charged in US dollars.");

        api.MapGet("/reference/access", () => Results.Ok(ReferenceRules.Access()))
            .WithTags("Reference").WithSummary("Excursion difficulty (distance, steps, heat, shade, seats, restrooms, wet footing) by excursion id, and the room types that have accessible staterooms.");

        api.MapGet("/feeds/sky", (string sailing, int day, string port) =>
            {
                if (string.IsNullOrWhiteSpace(sailing) || sailing.Length > 40 || string.IsNullOrWhiteSpace(port) || port.Length > 40 || day is < 1 or > 60)
                    throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(FeedRules.Sky(sailing, day, port));
            })
            .WithTags("Reference").WithSummary("The sky for a cruise day (UV, temperature, any afternoon rain). A simulated feed, the same for every device; `source` says so.");

        api.MapGet("/feeds/flight", (string number, string date) =>
            {
                var n = FeedRules.NormalizeFlight(number ?? "");
                if (!FeedRules.ValidFlightNumber(n) || !System.Text.RegularExpressions.Regex.IsMatch(date ?? "", @"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"))
                    throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(FeedRules.Flight(n, date!));
            })
            .WithTags("Reference").WithSummary("Status of a flight on a date (on time, delayed with minutes, or cancelled). A simulated feed, the same for every device; `source` says so.");

        api.MapGet("/feeds/route", (string departure, string crowd) =>
            {
                if (!System.Text.RegularExpressions.Regex.IsMatch(departure ?? "", @"^[0-9]{4}-[0-9]{2}-[0-9]{2}$") || !FeedRules.ValidCrowd(crowd ?? ""))
                    throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(FeedRules.Route(departure!, crowd!));
            })
            .WithTags("Reference").WithSummary("Traffic and weather on the way to the port for a sailing date and arrival-window crowd, with how much earlier to leave. A simulated feed; `source` says so.");
    }
}
