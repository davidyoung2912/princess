using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Seams for every external source the app depends on (multi-device plan 2, Phase 1). Each interface is what a real provider must
/// supply; the simulated implementation below is what runs today. The front end only ever sees the contract shapes, so swapping a
/// provider is a registration change in <c>Program.cs</c>.
/// </summary>
public interface IWeatherService
{
    /// <summary>The sky for a cruise day: UV, temperature and any afternoon rain.</summary>
    SkyDto Sky(string sailingId, int day, string port);

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

/// <summary>Live conditions around the ship and its ports. Today only how crowded a port is on a date.</summary>
public interface IShipTelemetry
{
    PortCrowdDto PortCrowd(string port, string date);
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
    public SkyDto Sky(string sailingId, int day, string port) => FeedRules.Sky(sailingId, day, port);
    public Weather Climate(DateOnly date) => PlanRules.WeatherFor(date);
    public WeatherToday Today(DateOnly date, bool rough) => AboardRules.WeatherOn(date, rough);
}

public sealed class SimShipTelemetry : IShipTelemetry
{
    public PortCrowdDto PortCrowd(string port, string date) => ShipFeedRules.PortCrowd(port, date);
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
