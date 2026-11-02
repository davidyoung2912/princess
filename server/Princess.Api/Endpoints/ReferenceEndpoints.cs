using Princess.Api.Domain;
using Princess.Api.Services;

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

        api.MapGet("/reference/catalogue", () => Results.Ok(ReferenceRules.Catalogue()))
            .WithTags("Reference").WithSummary("The authored catalogue the server holds: shore excursions, dining venues and ports (with whether guests tender ashore). The same data the concierge and booking use.");

        api.MapGet("/feeds/sky", (string sailing, int day, string port, IWeatherService weather) =>
            {
                if (string.IsNullOrWhiteSpace(sailing) || sailing.Length > 40 || string.IsNullOrWhiteSpace(port) || port.Length > 40 || day is < 1 or > 60)
                    throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(weather.Sky(sailing, day, port));
            })
            .WithTags("Reference").WithSummary("The sky for a cruise day (UV, temperature, any afternoon rain). A simulated feed, the same for every device; `source` says so.");

        api.MapGet("/feeds/flight", (string number, string date, IFlightStatusProvider flights) =>
            {
                var n = FeedRules.NormalizeFlight(number ?? "");
                if (!FeedRules.ValidFlightNumber(n) || !System.Text.RegularExpressions.Regex.IsMatch(date ?? "", @"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"))
                    throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(flights.Status(n, date!));
            })
            .WithTags("Reference").WithSummary("Status of a flight on a date (on time, delayed with minutes, or cancelled). A simulated feed, the same for every device; `source` says so.");

        api.MapGet("/feeds/route", (string departure, string crowd, IRouteConditionsProvider route) =>
            {
                if (!System.Text.RegularExpressions.Regex.IsMatch(departure ?? "", @"^[0-9]{4}-[0-9]{2}-[0-9]{2}$") || !FeedRules.ValidCrowd(crowd ?? ""))
                    throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(route.Conditions(departure!, crowd!));
            })
            .WithTags("Reference").WithSummary("Traffic and weather on the way to the port for a sailing date and arrival-window crowd, with how much earlier to leave. A simulated feed; `source` says so.");

        api.MapGet("/feeds/port-crowd", (string port, string date, IShipTelemetry ship) =>
            {
                if (!ShipFeedRules.ValidPort(port) || !ShipFeedRules.ValidDate(date)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(ship.PortCrowd(port, date));
            })
            .WithTags("Reference").WithSummary("How many ships are in a port on a date and how busy it will be (quiet, moderate or busy). A simulated feed, the same for every device; `source` says so.");

        api.MapGet("/feeds/fares", (string number, long total, string booked, string today, IFareFeed fares) =>
            {
                if (!ShipFeedRules.ValidFareQuery(number, total, booked, today)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(fares.History(number, total, booked, today));
            })
            .WithTags("Reference").WithSummary("The weekly fare for the same cabin since booking (for the price-drop watch), as `[{ date, total }]` in cents, at most 26 points. A simulated feed, the same for every device.");

        api.MapPost("/telemetry", async (TelemetryBatchDto body, ITelemetrySink sink, CancellationToken ct) =>
            {
                if (!TelemetryRules.Valid(body?.Items)) throw ApiException.Invalid("badTelemetry");
                await sink.AcceptAsync(body!.Items!, ct);
                return Results.NoContent();
            })
            .WithTags("Reference").WithSummary("Sends a batch of consented error reports and usage counts (1 to 100 items, known kinds and event names only; no person or typed text). 400 badTelemetry for anything else.");
    }
}
