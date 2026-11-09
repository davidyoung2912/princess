using Princess.Api.Data;

namespace Princess.Api.Services;

/// <summary>
/// One place that chooses every external provider from configuration (multi-device plan 3, Phase 6). <c>Providers:Weather</c>, <c>Flight</c>,
/// <c>Route</c>, <c>Telemetry</c>, <c>StaffQueue</c>, <c>Concierge</c> and the rest default to <c>sim</c>. A real provider is added by
/// writing the class and one line in <see cref="Catalogue"/>, then setting its name in configuration; no front-end change. A name that
/// is not registered stops the server at start-up, naming the choices, rather than silently falling back to the simulation.
/// </summary>
public static class ProviderRegistration
{
    public const string Section = "Providers";
    public const string Sim = "sim";

    /// <summary>A provider seam: the configuration key, the interface and its implementations by name. Used by <see cref="AddProviders"/> and by the contract tests.</summary>
    public sealed record Seam(string Key, Type Contract, IReadOnlyDictionary<string, Type> Implementations);

    private static Seam S<TContract, TSim>() where TSim : class, TContract =>
        new(Key(typeof(TContract).Name[1..]), typeof(TContract), new Dictionary<string, Type> { [Sim] = typeof(TSim) });

    // IWeatherService -> Weather, IFlightStatusProvider -> Flight and so on: the configuration key is the interface name without I and the usual suffix.
    private static string Key(string name) => name switch
    {
        "WeatherService" => "Weather",
        "FlightStatusProvider" => "Flight",
        "RouteConditionsProvider" => "Route",
        "ShipTelemetry" => "Telemetry",
        "ShipNavigation" => "Navigation",
        "EmailSender" => "Email",
        "PrintProvider" => "Print",
        _ => name,
    };

    /// <summary>Every seam and the names it can be set to. Add a real implementation to the dictionary of its seam.</summary>
    public static readonly IReadOnlyList<Seam> Catalogue =
    [
        S<IWeatherService, SimWeatherService>(),
        S<IFlightStatusProvider, SimFlightStatusProvider>(),
        S<IRouteConditionsProvider, SimRouteConditionsProvider>(),
        S<IShipTelemetry, SimShipTelemetry>(),
        S<IShipNavigation, SimShipNavigation>(),
        S<IStaffQueue, SimStaffQueue>(),
        S<IFareFeed, SimFareFeed>(),
        S<IProgramChanges, SimProgramChanges>(),
        S<IStormOutlook, SimStormOutlook>(),
        S<ITenderOutlook, SimTenderOutlook>(),
        S<ILostProperty, SimLostProperty>(),
        S<ISlotWatchFeed, SimSlotWatchFeed>(),
        S<ISailingQuality, SimSailingQuality>(),
        S<IEmbarkQueue, SimEmbarkQueue>(),
        S<ICabinGuide, SimCabinGuide>(),
        S<IFriendReply, SimFriendReply>(),
        S<IPaymentGateway, MockPaymentGateway>(),
        S<ITelemetrySink, LoggingTelemetrySink>(),
        S<IPushSender, SimPushSender>(),
        S<IMediaScanner, SimMediaScanner>(),
        S<IEmailSender, SimEmailSender>(),
        S<IPrintProvider, SimPrintProvider>(),
    ];

    public static IServiceCollection AddProviders(this IServiceCollection services, IConfiguration config)
    {
        services.AddSingleton<ProviderHealth>();
        foreach (var seam in Catalogue)
        {
            var name = (config[$"{Section}:{seam.Key}"] ?? Sim).Trim().ToLowerInvariant();
            // Providers:Weather is sim or openmeteo (a real forecast for the sky, falling back to the simulation). Off by default.
            if (seam.Key == "Weather" && name == "openmeteo")
            {
                services.AddHttpClient();
                services.AddOptions<OpenMeteoOptions>().BindConfiguration(OpenMeteoOptions.Section);
                services.AddSingleton<IWeatherService, OpenMeteoWeatherService>();
                continue;
            }
            if (!seam.Implementations.TryGetValue(name, out var impl))
                throw new InvalidOperationException($"{Section}:{seam.Key} is '{name}', which is not registered. Choose one of: {string.Join(", ", seam.Implementations.Keys)}{(seam.Key == "Weather" ? ", openmeteo" : "")}.");
            services.AddSingleton(seam.Contract, impl);
        }

        services.AddOptions<ConciergeOptions>().BindConfiguration(ConciergeOptions.Section);
        var hasKey = !string.IsNullOrWhiteSpace(config[$"{ConciergeOptions.Section}:ApiKey"]);
        // Providers:Concierge is sim (the scripted concierge) or anthropic. Unset: anthropic when a key is present, else sim.
        var concierge = (config[$"{Section}:Concierge"] ?? (hasKey ? "anthropic" : Sim)).Trim().ToLowerInvariant();
        switch (concierge)
        {
            case Sim:
                services.AddSingleton<IConciergeModel, UnavailableConciergeModel>();
                break;
            case "anthropic":
                if (!hasKey) throw new InvalidOperationException($"{Section}:Concierge is 'anthropic' but {ConciergeOptions.Section}:ApiKey is not set (user-secrets or an environment variable).");
                services.AddHttpClient<IConciergeModel, AnthropicConciergeModel>(c => c.Timeout = TimeSpan.FromSeconds(30));
                break;
            default:
                throw new InvalidOperationException($"{Section}:Concierge is '{concierge}', which is not registered. Choose one of: sim, anthropic.");
        }

        // Providers:Rates is sim (the stub table) or http (a Frankfurter-compatible feed, see RateOptions). Off by default; a feed that fails falls back to the last table it gave.
        services.AddOptions<RateOptions>().BindConfiguration(RateOptions.Section);
        var rates = (config[$"{Section}:Rates"] ?? Sim).Trim().ToLowerInvariant();
        switch (rates)
        {
            case Sim:
                services.AddSingleton<IRateFeed, SimRateFeed>();
                break;
            case "http":
                services.AddHttpClient<IRateFeed, HttpRateFeed>();
                break;
            default:
                throw new InvalidOperationException($"{Section}:Rates is '{rates}', which is not registered. Choose one of: sim, http.");
        }
        services.AddSingleton<RateService>();

        // Providers:ConciergeLimit is database (the default, shared and kept across restarts) or memory (one instance, for tests and trials).
        var limit = (config[$"{Section}:ConciergeLimit"] ?? "database").Trim().ToLowerInvariant();
        switch (limit)
        {
            case "database": services.AddScoped<IConciergeLimiter, DapperConciergeLimiter>(); break;
            case "memory": services.AddSingleton<IConciergeLimiter, MemoryConciergeLimiter>(); break;
            default: throw new InvalidOperationException($"{Section}:ConciergeLimit is '{limit}', which is not registered. Choose one of: database, memory.");
        }
        return services;
    }
}
