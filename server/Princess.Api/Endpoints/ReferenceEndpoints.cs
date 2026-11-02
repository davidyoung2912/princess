using Princess.Api.Data;
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

        api.MapGet("/reference/sailings", async (ITripStore trips, CancellationToken ct) => Results.Ok(ReferenceRules.Sailings(await trips.ListSailingsAsync(ct))))
            .WithTags("Reference").WithSummary("The sailings, the ports and the eight-day itinerary every sailing runs, and the zones the ship's clocks follow. `version` changes when any of it does.");

        api.MapGet("/reference/ship", () => Results.Ok(ShipReference.Get()))
            .WithTags("Reference").WithSummary("The ship (facts, highlights, accessibility notes), its stateroom categories, the deck plan, the six elevator banks and the muster stations. `version` changes when any of it does.");

        api.MapGet("/reference/program", (IProgramChanges changes) => Results.Ok(ProgramRules.Reference(changes.Current())))
            .WithTags("Reference").WithSummary("Every programme event with the days it runs, and the mid-day changes the ship has made (moved or cancelled, with a reason). A guest sees the changes only when the day's plan-change scenario applies to them; `GET /onboard/program/{day}` is the guest's own day.");

        api.MapGet("/reference/ports", () => Results.Ok(PortsReference.Get()))
            .WithTags("Reference").WithSummary("The port guides (landing, access, what to do, excursion summaries), the port knowledge (fair taxi prices, scam alerts, phrases, allergy cards, walks, day passes, family notes, vendors) and the map coordinates, by port id. `version` changes when any of it does.");

        api.MapGet("/reference/packages", () => Results.Ok(PackageRules.Reference()))
            .WithTags("Reference").WithSummary("The add-ons (name, blurb, unit, base price, price change, minimum age), the average drink and cover figures the worth-it screens use, and the refund window in days. Prices a guest pays are still worked out by the server.");

        api.MapGet("/reference/limits", () => Results.Ok(LimitsReference.Get()))
            .WithTags("Reference").WithSummary("The limits, windows, fees and rates the server enforces (request caps, text lengths, notice periods, credits), by the client's constant names. Each value is the rule's own constant. `version` changes when any value does.");

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

        api.MapGet("/feeds/pulse", (string departure, long now, IShipTelemetry ship) =>
            {
                if (!OnboardFeedRules.ValidDate(departure) || !OnboardFeedRules.ValidMoment(now)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(ship.Pulse(DateOnly.ParseExact(departure, "yyyy-MM-dd"), now));
            })
            .WithTags("Reference").WithSummary("How busy each ship venue is at the last five-minute mark and for the next four hours in half hours (0 to 100), for Ship Pulse, the lines and the quiet spaces. A simulated feed; `source` says so.");

        api.MapGet("/feeds/storm", (string departure, int days, IStormOutlook storm) =>
            {
                if (!OnboardFeedRules.ValidStormQuery(departure, days)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(storm.Outlook(departure, days));
            })
            .WithTags("Reference").WithSummary("How likely a named storm is to touch a sailing's route, from authored chances by month, with what the line may do and what a guest can do. Not a forecast; `source` says so.");

        api.MapGet("/feeds/sky-night", (string departure, int day, IShipTelemetry ship) =>
            {
                if (!OnboardFeedRules.ValidSkyQuery(departure, day)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(ship.SkyNight(departure, day));
            })
            .WithTags("Reference").WithSummary("Sunrise, sunset, the moon, easy constellations and the sunset side of the ship for a cruise day. Worked out from the date and an authored position; `source` says so.");

        api.MapGet("/feeds/loungers", (long now, IShipTelemetry ship) =>
            {
                if (!OnboardFeedRules.ValidMoment(now)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(ship.Loungers(now));
            })
            .WithTags("Reference").WithSummary("The other loungers on the pool deck at a minute: free, held (with minutes until due back) or left too long. A guest's own hold stays on their device. A simulated feed.");

        api.MapGet("/feeds/sightings", (int day, IShipTelemetry ship) =>
            {
                if (day is < 1 or > 8) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(ship.Sightings(day));
            })
            .WithTags("Reference").WithSummary("Which kinds of wildlife the ship is said to have seen on a cruise day. A simulated feed.");

        api.MapGet("/feeds/found", (ILostProperty lost) => Results.Ok(lost.Found()))
            .WithTags("Reference").WithSummary("What the lost-property desk has handed in, with the keywords it matches on and where it is held. A simulated list.");

        api.MapGet("/feeds/watch-opening", (string id, long created, long slot, ISlotWatchFeed feed) =>
            {
                if (!OnboardFeedRules.ValidWatchQuery(id, created, slot)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(feed.Opening(id, created, slot));
            })
            .WithTags("Reference").WithSummary("When a place opens up for a slot watch, or null when none does before the slot. A simulated feed; the watch only ever ends in a proposal the guest confirms.");

        api.MapGet("/feeds/sailing-quality", async (string sailing, ISailingQuality quality, ITripStore trips, CancellationToken ct) =>
            {
                var all = (await trips.ListSailingsAsync(ct)).Where(s => Pricing.HasPrice(s.Id)).ToList();
                var row = all.FirstOrDefault(s => s.Id == sailing);
                if (row is null) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(quality.Notes(row, all.Select(s => s.Id)));
            })
            .WithTags("Reference").WithSummary("The decide notes for a sailing: crowds, weather, hurricane season, school holidays and price, each low, medium or high with a plain sentence and why. A simulated feed; `source` says so.");

        api.MapGet("/feeds/embark-queue", (bool? priority, bool? mobility, bool? quiet, string? earliest, IEmbarkQueue queue) =>
            {
                if (!EmbarkQueueRules.ValidEarliest(earliest)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(queue.Queue(priority ?? false, mobility ?? false, quiet ?? false, earliest));
            })
            .WithTags("Reference").WithSummary("The arrival windows a guest can make (not before `earliest`, `HH:mm`), each with its crowd, the wait through the terminal adjusted for mobility, the walk and queue at each of four steps, and the quietest window. A simulated feed; `source` says so.");

        api.MapGet("/feeds/friend-reply", (string name, IFriendReply friends) =>
            {
                if (!SailingQualityRules.ValidFriendName(name)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(friends.Reply(name));
            })
            .WithTags("Reference").WithSummary("How a friend answers a sail-again invitation (accepted or declined). Asked only after the guest has agreed to invite the contact. A simulated feed.");

        api.MapPost("/telemetry", async (TelemetryBatchDto body, ITelemetrySink sink, CancellationToken ct) =>
            {
                if (!TelemetryRules.Valid(body?.Items)) throw ApiException.Invalid("badTelemetry");
                await sink.AcceptAsync(body!.Items!, ct);
                return Results.NoContent();
            })
            .WithTags("Reference").WithSummary("Sends a batch of consented error reports and usage counts (1 to 100 items, known kinds and event names only; no person or typed text). 400 badTelemetry for anything else.");
    }
}
