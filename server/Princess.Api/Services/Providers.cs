using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Seams for every external source the app depends on (multi-device plan 2, Phase 1). Each interface is what a real provider must
/// supply; the simulated implementation below is what runs today. The front end only ever sees the contract shapes, so swapping a
/// provider is a registration change in <c>Program.cs</c>.
/// </summary>
public interface IWeatherService
{
    /// <summary>The sky on a date at a port: UV, temperature and any afternoon rain. Agrees with <see cref="Climate"/> and <see cref="Today"/>.</summary>
    SkyDto Sky(DateOnly date, string port);

    /// <summary>The usual weather for the time of year, used for packing advice.</summary>
    Weather Climate(DateOnly date);

    /// <summary>Today's weather on board, with the sea state; <paramref name="rough"/> is a weather scenario or warning.</summary>
    WeatherToday Today(DateOnly date, bool rough);
}

public interface IFlightStatusProvider
{
    /// <summary>Status of a flight (number already normalised) on a <c>YYYY-MM-DD</c> date.</summary>
    FlightStatusDto Status(string normalizedNumber, string date);
}

public interface IRouteConditionsProvider
{
    /// <summary>Traffic and weather on the way to the port on the sailing date, given how busy the guest's arrival window is.</summary>
    RouteConditionsDto Conditions(string departure, string crowd);
}

/// <summary>Live conditions around the ship and its ports: how crowded a port is, how busy the venues are, the loungers, the sun and moon, and what wildlife was seen.</summary>
public interface IShipTelemetry
{
    PortCrowdDto PortCrowd(string port, string date);
    PulseDto Pulse(Timeline timeline, long now, string? shipId = null);
    PulseDayDto PulseDay(Timeline timeline, int day, string? shipId = null);
    LoungersDto Loungers(long now);
    SightingsDto Sightings(int day);
    SkyNightDto SkyNight(string departure, int day, string? sailing = null);
}

/// <summary>Where the ship is, how it is moving, the sea around it and what it is passing. The simulated one follows an authored track; a real one reads the bridge.</summary>
public interface IShipNavigation
{
    ShipPositionDto Position(Timeline timeline, long now);
    SeaConditionsDto Sea(Timeline timeline, long now);
    AlongTheWayDto Along(Timeline timeline, long now);
}

/// <summary>How likely a named storm is to touch a sailing's route, for the storm watch. Not a forecast.</summary>
public interface IStormOutlook
{
    StormDto Outlook(string departure, int daysToDeparture);
}

/// <summary>How likely the tender boats at a port are to run late or be called off on a date. Not a forecast.</summary>
public interface ITenderOutlook
{
    TenderOutlookDto Outlook(string port, string date);
}

public sealed class SimTenderOutlook : ITenderOutlook
{
    public TenderOutlookDto Outlook(string port, string date) => TenderRules.Outlook(port, date);
}

/// <summary>What the lost-property desk has handed in.</summary>
public interface ILostProperty
{
    FoundListDto Found();
}

/// <summary>When a place opens up for a guest's slot watch (Autopilot).</summary>
public interface ISlotWatchFeed
{
    WatchOpeningDto Opening(string watchId, long createdAt, long slotAt);
}

/// <summary>The fare the guest's cabin has been selling at since they booked, for the price-drop watch.</summary>
public interface IFareFeed
{
    IReadOnlyList<FarePointDto> History(string bookingNumber, long bookedTotal, string bookedOn, string today);
}

/// <summary>The guest services desk's queue for calls back, caregiver visits and sensory kits. The simulated one answers at once with a place in a pretend queue; a real one hands the request to staff.</summary>
public interface IStaffQueue
{
    Task<StaffTicketDto> EnqueueAsync(Guid person, string kind, string reason, DateTime now, CancellationToken ct);
}

/// <summary>Where consented error reports and usage counts go. A batch carries no person, booking or typed text.</summary>
public interface ITelemetrySink
{
    Task AcceptAsync(IReadOnlyList<TelemetryItemDto> items, CancellationToken ct);
}

public sealed class SimWeatherService : IWeatherService
{
    public SkyDto Sky(DateOnly date, string port) => FeedRules.Sky(date, port);
    public Weather Climate(DateOnly date) => PlanRules.WeatherFor(date);
    public WeatherToday Today(DateOnly date, bool rough) => AboardRules.WeatherOn(date, rough);
}

public sealed class SimShipTelemetry : IShipTelemetry
{
    public PortCrowdDto PortCrowd(string port, string date) => ShipFeedRules.PortCrowd(port, date);
    public PulseDto Pulse(Timeline timeline, long now, string? shipId = null) => OnboardFeedRules.Pulse(timeline, now, shipId);
    public PulseDayDto PulseDay(Timeline timeline, int day, string? shipId = null) => OnboardFeedRules.PulseDay(timeline, day, shipId);
    public LoungersDto Loungers(long now) => OnboardFeedRules.LoungerBoard(now);
    public SightingsDto Sightings(int day) => OnboardFeedRules.Sightings(day);
    public SkyNightDto SkyNight(string departure, int day, string? sailing = null) => OnboardFeedRules.SkyNight(departure, day, sailing);
}

public sealed class SimShipNavigation : IShipNavigation
{
    public ShipPositionDto Position(Timeline timeline, long now) => NavigationRules.Position(timeline, now);
    public SeaConditionsDto Sea(Timeline timeline, long now) => NavigationRules.Sea(timeline, now);
    public AlongTheWayDto Along(Timeline timeline, long now) => NavigationRules.Along(timeline, now);
}

public sealed class SimStormOutlook : IStormOutlook
{
    public StormDto Outlook(string departure, int daysToDeparture) => OnboardFeedRules.Storm(departure, daysToDeparture);
}

public sealed class SimLostProperty : ILostProperty
{
    public FoundListDto Found() => OnboardFeedRules.FoundList();
}

public sealed class SimSlotWatchFeed : ISlotWatchFeed
{
    public WatchOpeningDto Opening(string watchId, long createdAt, long slotAt) => OnboardFeedRules.WatchOpening(watchId, createdAt, slotAt);
}

/// <summary>Scores for the staterooms of a room type (sleep, motion, noise, sun), with the reasons. A real deck plan and ship data replace the sample ones and keep the shape.</summary>
public interface ICabinGuide
{
    CabinGuideDto Guide(string sailingId, string category, CabinFilterDto filter, IReadOnlySet<string>? taken);
}

public sealed class SimCabinGuide : ICabinGuide
{
    public CabinGuideDto Guide(string sailingId, string category, CabinFilterDto filter, IReadOnlySet<string>? taken) => CabinGuideRules.Guide(sailingId, category, filter, taken);
}

/// <summary>Queue times through the terminal for each arrival window, for the embarkation plan.</summary>
public interface IEmbarkQueue
{
    EmbarkQueueDto Queue(bool priority, bool mobility, bool quiet, string? earliest);
}

public sealed class SimEmbarkQueue : IEmbarkQueue
{
    public EmbarkQueueDto Queue(bool priority, bool mobility, bool quiet, string? earliest) => EmbarkQueueRules.Queue(priority, mobility, quiet, earliest);
}

/// <summary>The dream and decide notes for a sailing: crowds, weather, hurricane season, school holidays and price.</summary>
public interface ISailingQuality
{
    SailingQualityDto Notes(SailingRow sailing, IEnumerable<string> allSailingIds);
}

/// <summary>How a guest's friend answers a sail-again invitation. A real build would carry an actual reply back; the simulated one makes it up.</summary>
public interface IFriendReply
{
    FriendReplyDto Reply(string name);
}

public sealed class SimSailingQuality : ISailingQuality
{
    public SailingQualityDto Notes(SailingRow sailing, IEnumerable<string> allSailingIds) => SailingQualityRules.For(sailing, allSailingIds);
}

public sealed class SimFriendReply : IFriendReply
{
    public FriendReplyDto Reply(string name) => SailingQualityRules.Reply(name);
}

/// <summary>The mid-day changes the ship makes to the programme (moved or cancelled events, with a reason). A real operations feed replaces the simulated one.</summary>
public interface IProgramChanges
{
    IReadOnlyList<PlanChange> Current();
}

public sealed class SimProgramChanges : IProgramChanges
{
    public IReadOnlyList<PlanChange> Current() => ProgramRules.PlanChanges;
}

public sealed class SimFareFeed : IFareFeed
{
    public IReadOnlyList<FarePointDto> History(string bookingNumber, long bookedTotal, string bookedOn, string today) => ShipFeedRules.FareHistory(bookingNumber, bookedTotal, bookedOn, today);
}

public sealed class SimStaffQueue(ILogger<SimStaffQueue> log) : IStaffQueue
{
    public Task<StaffTicketDto> EnqueueAsync(Guid person, string kind, string reason, DateTime now, CancellationToken ct)
    {
        var at = new DateTimeOffset(DateTime.SpecifyKind(now, DateTimeKind.Utc)).ToUnixTimeMilliseconds();
        var position = 1 + (int)(CabinRules.Hash($"{at / 300_000}|{person}") % 6);
        var ticket = new StaffTicketDto(Guid.NewGuid(), kind, reason, at, position, at + position * StaffRules.MinutesPerPlace * 60_000L, FeedRules.Sim);
        log.LogInformation("Staff request {Kind} queued at place {Position}", kind, position);
        return Task.FromResult(ticket);
    }
}

public sealed class SimFlightStatusProvider : IFlightStatusProvider
{
    public FlightStatusDto Status(string normalizedNumber, string date) => FeedRules.Flight(normalizedNumber, date);
}

public sealed class SimRouteConditionsProvider : IRouteConditionsProvider
{
    public RouteConditionsDto Conditions(string departure, string crowd) => FeedRules.Route(departure, crowd);
}

/// <summary>Counts the batch in the log and keeps nothing; a real sink replaces this.</summary>
public sealed class LoggingTelemetrySink(ILogger<LoggingTelemetrySink> log) : ITelemetrySink
{
    public Task AcceptAsync(IReadOnlyList<TelemetryItemDto> items, CancellationToken ct)
    {
        log.LogInformation("Telemetry batch: {Errors} errors, {Events} events", items.Count(i => i.Type == "error"), items.Count(i => i.Type == "event"));
        return Task.CompletedTask;
    }
}

public sealed record PrintSubmission(string Reference, DateTime DeliverBy);

/// <summary>A print-on-demand shop. A real one takes the order and answers with its own reference and promised delivery; the simulated one answers at once.</summary>
public interface IPrintProvider
{
    PrintSubmission Submit(string product, int photos, DateTime now);
}

public sealed class SimPrintProvider : IPrintProvider
{
    public PrintSubmission Submit(string product, int photos, DateTime now) =>
        new($"PR-{Math.Abs(HashCode.Combine(product, photos, now.Ticks)) % 1_000_000:D6}", now.AddDays(product == "book" ? 10 : 7));
}
