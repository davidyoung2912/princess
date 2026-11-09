using Princess.Api.Audit;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Shared reference data and simulated feeds that every device must see the same (multi-device plan Phase 5, data model section 6.9).</summary>
public static class ReferenceEndpoints
{
    public static void MapReferenceEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/rates", async (RateService rates, CancellationToken ct) => Results.Ok(await rates.CurrentAsync(ct)))
            .WithTags("Reference").WithSummary("Exchange rates per US dollar, the same for every device, with the date they are from (`asOf`). The source is chosen by configuration (`Providers:Rates`, a stub by default) and is asked at most every six hours; when it cannot answer, the last table it gave is kept with its own older date. For reading only: the account is charged in US dollars.");

        api.MapGet("/reference/access", () => Results.Ok(ReferenceRules.Access()))
            .WithTags("Reference").WithSummary("Excursion difficulty (distance, steps, heat, shade, seats, restrooms, wet footing) by excursion id, and the room types that have accessible staterooms. `version` changes when any of it does.");

        api.MapGet("/reference/entry", () => Results.Ok(ReferenceRules.Entry()))
            .WithTags("Reference").WithSummary("How long a passport must stay valid beyond the day the ship is at each stop, by citizenship (`monthsUs`, `monthsOther`), and whether a guest of another nationality should check for a visa. A general guide, not a decision. `version` changes when any of it does.");

        api.MapGet("/reference/catalogue", () => Results.Ok(ReferenceRules.Catalogue()))
            .WithTags("Reference").WithSummary("The authored catalogue the server holds: shore excursions, dining venues and ports (with whether guests tender ashore). The same data the concierge and booking use.");

        api.MapGet("/reference/sailings", async (string? ship, string? region, string? from, string? to, int? nightsMin, int? nightsMax, string? port, ITripStore trips, ICatalogueStore catalogue, CancellationToken ct) =>
            {
                var filter = new SailingFilter(ship, region, from, to, nightsMin, nightsMax, port);
                if (!filter.Valid()) throw ApiException.Invalid("badCatalogueQuery");
                var legacy = ReferenceRules.Sailings(await trips.ListSailingsAsync(ct));
                var entries = ShipCatalogueRules.Sailings(await catalogue.GetAsync(ct), filter);
                return Results.Ok(legacy with { Version = ShipCatalogueRules.SailingsVersion(legacy.Version, entries), Entries = entries });
            })
            .WithTags("Reference").WithSummary("The sailings, the ports and the eight-day itinerary the Sun Princess runs, and the zones the ship's clocks follow (`version` changes when any of it does), plus `entries`: every catalogue sailing with its ship, nights, title, region, start and end port, legs, holiday flag, whether booking is open, its data status (`served`, `sample` or `verified`) and the cheapest per-person fare before taxes. Optional filters: `ship`, `region`, `from` and `to` (`yyyy-MM-dd`), `nightsMin`, `nightsMax`, and `port` (any stop on the route).");

        api.MapGet("/reference/sailings/{id}/itinerary", async (string id, ITripStore trips, ICatalogueStore catalogue, CancellationToken ct) =>
                await ItineraryAsync(trips, catalogue, id, ct) is { } days ? Results.Ok(days) : throw ApiException.NotFound())
            .WithTags("Reference").WithSummary("The days of one sailing: date, port (or `sea`), arrival, all-aboard and departure times local to the port, any change of the ship's clock (`clockChangeHours` at `clockChangeAt`) and the dress code for the evening. Not found for an unknown sailing.");

        api.MapGet("/reference/sailings/{id}/rooms", async (string id, DiscoverService svc, CancellationToken ct) => Results.Ok(await svc.SampleRoomsAsync(id, ct)))
            .WithTags("Reference").WithSummary("The room types of one sailing's ship with sample fares (per person for two sharing, and per night), open for booking or not. 400 for a sailing with no prices.");

        api.MapGet("/reference/catalogue/ships", async (ICatalogueStore catalogue, CancellationToken ct) => Results.Ok(ShipCatalogueRules.Ships(await catalogue.GetAsync(ct))))
            .WithTags("Reference").WithSummary("Every ship in the catalogue: facts, class, intro and highlights (`profile`), and its depth (`aboard` has decks, cabins, menus and programme in the app; `browse` has facts and stateroom categories only). `version` changes when any of it does.");

        api.MapGet("/reference/catalogue/ships/{id}", async (string id, ICatalogueStore catalogue, CancellationToken ct) =>
                ShipCatalogueRules.Ship(await catalogue.GetAsync(ct), id) is { } ship ? Results.Ok(ship) : throw ApiException.NotFound())
            .WithTags("Reference").WithSummary("One ship with its decks, dining and entertainment venues and stateroom categories (browse depth). Not found for an unknown ship.");

        api.MapGet("/reference/catalogue/regions", async (ICatalogueStore catalogue, CancellationToken ct) => Results.Ok(ShipCatalogueRules.Regions(await catalogue.GetAsync(ct))))
            .WithTags("Reference").WithSummary("The cruise regions (Caribbean, Mediterranean, Alaska and so on) in display order. `version` changes when any of it does.");

        api.MapGet("/reference/catalogue/ports", async (ICatalogueStore catalogue, CancellationToken ct) => Results.Ok(ShipCatalogueRules.Ports(await catalogue.GetAsync(ct))))
            .WithTags("Reference").WithSummary("Every port: country, region, time zone, coordinates, currency, languages, tender flag, content tier (A full guide, B short guide, C link only), guide status and art id. `version` changes when any of it does.");

        api.MapGet("/reference/catalogue/patterns", async (ICatalogueStore catalogue, CancellationToken ct) => Results.Ok(ShipCatalogueRules.Patterns(await catalogue.GetAsync(ct))))
            .WithTags("Reference").WithSummary("The itinerary patterns (the repeating routes) with each day's port and times. A sailing is one or more patterns joined. `version` changes when any of it does.");

        api.MapGet("/reference/ship", () => Results.Ok(ShipReference.Get()))
            .WithTags("Reference").WithSummary("The ship (facts, highlights, accessibility notes), its stateroom categories, the deck plan, the six elevator banks and the muster stations. `version` changes when any of it does.");

        api.MapGet("/reference/ships/{id}/aboard", (string id) => AboardPlans.For(id) is { } plan ? Results.Ok(plan) : throw ApiException.NotFound())
            .WithTags("Reference").WithSummary("One ship's deck plan: its places, the six elevator banks, the six muster stations and accessibility notes. `version` changes when any of it does. Not found for a ship with no plan.");

        api.MapGet("/reference/ships/{id}/venues", (string id) => ShipDining.For(id) is { } dining ? Results.Ok(dining) : throw ApiException.NotFound())
            .WithTags("Reference").WithSummary("One ship's dining: its rooms, the directory with dishes tagged for allergens and diets, the room-service and delivery menu, and the places the crew deliver to on deck. `version` changes when any of it does. Not found for a ship with no dining.");

        api.MapGet("/reference/program", (IProgramChanges changes) => Results.Ok(ProgramRules.Reference(changes.Current())))
            .WithTags("Reference").WithSummary("Every programme event with the days it runs, and the mid-day changes the ship has made (moved or cancelled, with a reason). A guest sees the changes only when the day's plan-change scenario applies to them; `GET /onboard/program/{day}` is the guest's own day.");

        api.MapGet("/reference/ships/{id}/program", (string id, IProgramChanges changes) => ShipPrograms.For(id) is not null ? Results.Ok(ProgramRules.Reference(changes.Current(), id)) : throw ApiException.NotFound())
            .WithTags("Reference").WithSummary("One ship's programme: every event with the days it runs and the mid-day changes the ship has made, in the shape of `GET /reference/program` but with the ship's own rooms. Not found for a ship with no programme.");

        api.MapGet("/reference/ports", () => Results.Ok(PortsReference.Get()))
            .WithTags("Reference").WithSummary("The port guides (landing, access, what to do, excursion summaries), the port knowledge (fair taxi prices, scam alerts, phrases, allergy cards, walks, day passes, family notes, vendors) and the map coordinates, by port id. `version` changes when any of it does.");

        api.MapGet("/reference/packages", () => Results.Ok(PackageRules.Reference()))
            .WithTags("Reference").WithSummary("The add-ons (name, blurb, unit, base price, price change, minimum age), the average drink and cover figures the worth-it screens use, and the refund window in days. Prices a guest pays are still worked out by the server.");

        api.MapGet("/reference/limits", () => Results.Ok(LimitsReference.Get()))
            .WithTags("Reference").WithSummary("The limits, windows, fees and rates the server enforces (request caps, text lengths, notice periods, credits), by the client's constant names. Each value is the rule's own constant. `version` changes when any value does.");

        api.MapGet("/reference/pricing", () => Results.Ok(PricingReference.Get()))
            .WithTags("Reference").WithSummary("The fare tables the screens estimate with: the interior fare per person by sailing (open and next-season), taxes and fees, the nightly gratuity by room type, and the fares (name, nightly price, tagline). Real quotes are still worked out by the server. `version` changes when any of it does.");

        api.MapGet("/reference/content", () => Results.Text(ContentReference.Json, "application/json"))
            .WithTags("Reference").WithSummary("The option lists, menus, texts and tables the screens show (help answers, legal text, request items, menus, quizzes, tags and so on), by `module.NAME`. `version` changes when any of it does.");

        api.MapGet("/feeds/sky", (string date, string port, IWeatherService weather) =>
            {
                if (!DateOnly.TryParseExact(date ?? "", "yyyy-MM-dd", out var on) || string.IsNullOrWhiteSpace(port) || port.Length > 40)
                    throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(weather.Sky(on, port));
            })
            .WithTags("Reference").WithSummary("The sky on a date at a port (UV, temperature, any afternoon rain), from the same model as the packing advice and today's weather. A simulated feed, the same for every device; `source` says so.");

        api.MapGet("/feeds/flight", (string number, string date, IFlightStatusProvider flights) =>
            {
                var n = FeedRules.NormalizeFlight(number ?? "");
                if (!FeedRules.ValidFlightNumber(n) || !System.Text.RegularExpressions.Regex.IsMatch(date ?? "", @"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"))
                    throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(flights.Status(n, date!));
            })
            .WithTags("Reference").WithSummary("Status of a flight on a date (on time, delayed with minutes, or cancelled). A simulated feed, the same for every device; `source` says so.");

        api.MapGet("/feeds/route", async (string sailing, string crowd, IRouteConditionsProvider route, ITripStore trips, CancellationToken ct) =>
            {
                var departure = await DepartureOfAsync(sailing, trips, ct);
                if (!System.Text.RegularExpressions.Regex.IsMatch(departure ?? "", @"^[0-9]{4}-[0-9]{2}-[0-9]{2}$") || !FeedRules.ValidCrowd(crowd ?? ""))
                    throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(route.Conditions(departure!, crowd!));
            })
            .WithTags("Reference").WithSummary("Traffic and weather on the way to the port for a sailing date and arrival-window crowd, with how much earlier to leave. A simulated feed; `source` says so. Name the sailing with `sailing` (an id).");

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

        api.MapGet("/feeds/pulse", async (string sailing, long now, IShipTelemetry ship, ITripStore trips, CancellationToken ct) =>
            {
                var departure = await DepartureOfAsync(sailing, trips, ct);
                if (!OnboardFeedRules.ValidDate(departure) || !OnboardFeedRules.ValidMoment(now)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(ship.Pulse(TimelineBook.For(sailing, DateOnly.ParseExact(departure, "yyyy-MM-dd")), now, AboardPlans.ShipOfSailing(sailing)));
            })
            .WithTags("Reference").WithSummary("How busy each ship venue is at the last five-minute mark and for the next four hours in half hours (0 to 100), for Ship Pulse, the lines and the quiet spaces. A simulated feed; `source` says so. Name the sailing with `sailing` (an id).");

        api.MapGet("/feeds/pulse-day", async (string sailing, int day, IShipTelemetry ship, ITripStore trips, CancellationToken ct) =>
            {
                var departure = await DepartureOfAsync(sailing, trips, ct);
                if (!OnboardFeedRules.ValidPulseDay(departure, day)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(ship.PulseDay(TimelineBook.For(sailing, DateOnly.ParseExact(departure, "yyyy-MM-dd")), day, AboardPlans.ShipOfSailing(sailing)));
            })
            .WithTags("Reference").WithSummary("How busy each ship venue is at every half hour of a cruise day, from midnight ship time (48 levels, 0 to 100), for plans that look across the day. A simulated feed; `source` says so. Name the sailing with `sailing` (an id).");

        api.MapGet("/feeds/storm", async (string sailing, int days, IStormOutlook storm, ITripStore trips, CancellationToken ct) =>
            {
                var departure = await DepartureOfAsync(sailing, trips, ct);
                if (!OnboardFeedRules.ValidStormQuery(departure, days)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(storm.Outlook(departure, days));
            })
            .WithTags("Reference").WithSummary("How likely a named storm is to touch a sailing's route, from authored chances by month, with what the line may do and what a guest can do. Not a forecast; `source` says so. Name the sailing with `sailing` (an id).");

        api.MapGet("/feeds/tender", (string port, string date, ITenderOutlook tender) =>
            {
                if (!TenderRules.ValidQuery(port, date)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(tender.Outlook(port, date));
            })
            .WithTags("Reference").WithSummary("How likely the tender boats at a port are to run late or be called off on a date (good, mixed or rough), with what a guest can do. Not a forecast; `source` says so.");

        api.MapGet("/feeds/sky-night", async (string sailing, int day, IShipTelemetry ship, ITripStore trips, CancellationToken ct) =>
            {
                var departure = await DepartureOfAsync(sailing, trips, ct);
                if (!OnboardFeedRules.ValidSkyQuery(departure, day)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(ship.SkyNight(departure, day, sailing));
            })
            .WithTags("Reference").WithSummary("Sunrise, sunset, the moon, easy constellations and the sunset side of the ship for a cruise day. Worked out from the date and an authored position; `source` says so. Name the sailing with `sailing` (an id).");

        api.MapGet("/feeds/ship-position", async (string sailing, long now, IShipNavigation nav, ITripStore trips, CancellationToken ct) =>
            {
                var departure = await DepartureOfAsync(sailing, trips, ct);
                if (!NavigationRules.ValidQuery(departure, now)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(nav.Position(TimelineBook.For(sailing, DateOnly.ParseExact(departure, "yyyy-MM-dd")), now));
            })
            .WithTags("Reference").WithSummary("Where the ship is at a moment: latitude and longitude, speed in knots, heading, nautical miles sailed since the last port and still to go, the voyage so far, and ship time against local time with the next clock change. A simulated feed; `source` says so. Name the sailing with `sailing` (an id).");

        api.MapGet("/feeds/sea-conditions", async (string sailing, long now, IShipNavigation nav, ITripStore trips, CancellationToken ct) =>
            {
                var departure = await DepartureOfAsync(sailing, trips, ct);
                if (!NavigationRules.ValidQuery(departure, now)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(nav.Sea(TimelineBook.For(sailing, DateOnly.ParseExact(departure, "yyyy-MM-dd")), now));
            })
            .WithTags("Reference").WithSummary("The sea at the ship at a moment: depth below the keel and its class (shelf, slope, deep, trench), water temperature, wind, Beaufort force, sea state, wave and swell height and period. Metric. A simulated feed; `source` says so. Name the sailing with `sailing` (an id).");

        api.MapGet("/feeds/along-the-way", async (string sailing, long now, IShipNavigation nav, ITripStore trips, CancellationToken ct) =>
            {
                var departure = await DepartureOfAsync(sailing, trips, ct);
                if (!NavigationRules.ValidQuery(departure, now)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(nav.Along(TimelineBook.For(sailing, DateOnly.ParseExact(departure, "yyyy-MM-dd")), now));
            })
            .WithTags("Reference").WithSummary("The sea zone the ship is in (habitat and the wildlife to look for) and the landmarks it is passing, has just passed and will pass next, with the side they lie on and when. A simulated feed; `source` says so. Name the sailing with `sailing` (an id).");

        api.MapGet("/feeds/loungers", (long now, IShipTelemetry ship) =>
            {
                if (!OnboardFeedRules.ValidMoment(now)) throw ApiException.Invalid("badFeedQuery");
                return Results.Ok(ship.Loungers(now));
            })
            .WithTags("Reference").WithSummary("The other loungers on the pool deck at a minute: free, held (with minutes until due back) or left too long. A guest's own hold stays on their device. A simulated feed.");

        api.MapGet("/feeds/sightings", (int day, IShipTelemetry ship) =>
            {
                if (day is < 1 or > Itinerary.MaxDay) throw ApiException.Invalid("badFeedQuery");
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

        api.MapPost("/telemetry", async (TelemetryBatchDto body, ITelemetrySink sink, IAuditLog audit, CancellationToken ct) =>
            {
                if (!TelemetryRules.Valid(body?.Items)) throw ApiException.Invalid("badTelemetry");
                await sink.AcceptAsync(body!.Items!, ct);
                // Every problem the app reports from a device goes into the audit trail, against the signed-in person, as a client error.
                foreach (var item in body.Items!.Where(i => i.Type == "error"))
                    await audit.RecordAsync(new AuditEntry
                    {
                        Category = AuditCategory.Error, Action = $"client.{item.Kind}", Outcome = AuditOutcome.Error, ErrorCode = "client",
                        ErrorType = item.Kind, ErrorMessage = AuditLog.Cut(TelemetryRules.Scrub(item.Message ?? ""), 400),
                        Detail = AuditContext.Json(new { source = "app", reportedAt = item.At }),
                    }, CancellationToken.None);
                return Results.NoContent();
            })
            .WithTags("Reference").WithSummary("Sends a batch of error reports (always sent; each is also written to the audit trail as a client error) and usage counts (only with the guest's consent) (1 to 100 items, known kinds and event names only; no person or typed text). 400 badTelemetry for anything else.");
    }

    /// <summary>One sailing's days with the ship's zone for each. Loading the sailings first makes the day rows known to <see cref="TimelineBook"/>, which works the zones out.</summary>
    private static async Task<CatalogueItineraryDto?> ItineraryAsync(ITripStore trips, ICatalogueStore catalogue, string id, CancellationToken ct)
    {
        var snapshot = await catalogue.GetAsync(ct);
        var row = snapshot.Sailings.FirstOrDefault(x => x.Id == id);
        if (row is null) return null;
        await trips.ListSailingsAsync(ct);
        return ShipCatalogueRules.ItineraryOf(snapshot, id, TimelineBook.For(id, DateOnly.FromDateTime(row.Departure)));
    }

    /// <summary>
    /// The departure date a feed works from: the named sailing's date. A sailing id that is not in the catalogue is a bad query.
    /// Loading the sailings also makes each sailing's days known to <see cref="TimelineBook"/>, which the feed engines read.
    /// </summary>
    private static async Task<string> DepartureOfAsync(string? sailing, ITripStore trips, CancellationToken ct)
    {
        var all = await trips.ListSailingsAsync(ct);
        if (string.IsNullOrEmpty(sailing)) throw ApiException.Invalid("badFeedQuery");
        var row = sailing.Length <= 40 ? all.FirstOrDefault(s => s.Id == sailing) : null;
        return row is null ? throw ApiException.Invalid("badFeedQuery") : row.Departure.ToString("yyyy-MM-dd");
    }
}
