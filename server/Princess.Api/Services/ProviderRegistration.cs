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
        "SmsSender" => "Sms",
        "PrintProvider" => "Print",
        "WalletPassIssuer" => "Wallet",
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
        S<ISmsSender, SimSmsSender>(),
        S<IPrintProvider, SimPrintProvider>(),
        S<IWalletPassIssuer, SimWalletPassIssuer>(),
        S<IServiceStatus, SimServiceStatus>(),
    ];

    public static IServiceCollection AddProviders(this IServiceCollection services, IConfiguration config)
    {
        services.AddSingleton<ProviderHealth>();
        services.AddSingleton<IIncidentFeed, ConfigIncidentFeed>();
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
            // Providers:Email and Providers:Sms = pingram send through Pingram (PingramOptions). The key must be set, or the server stops at start-up and says so.
            if (name == "pingram" && seam.Key is "Email" or "Sms")   // a named special case like openmeteo: it needs an HttpClient, so the contract test builds only the simulations
            {
                if (string.IsNullOrWhiteSpace(config[$"{PingramOptions.Section}:ApiKey"]))
                    throw new InvalidOperationException($"{Section}:{seam.Key} is 'pingram' but {PingramOptions.Section}:ApiKey is not set (user-secrets or an environment variable).");
                services.AddOptions<PingramOptions>().BindConfiguration(PingramOptions.Section);
                services.AddHttpClient<PingramSender>();
                services.AddSingleton(seam.Contract, sp => sp.GetRequiredService<PingramSender>());
                continue;
            }
            if (!seam.Implementations.TryGetValue(name, out var impl))
                throw new InvalidOperationException($"{Section}:{seam.Key} is '{name}', which is not registered. Choose one of: {string.Join(", ", seam.Implementations.Keys)}{(seam.Key == "Weather" ? ", openmeteo" : seam.Key is "Email" or "Sms" ? ", pingram" : "")}.");
            services.AddSingleton(seam.Contract, impl);
        }

        services.AddOptions<ConciergeOptions>().BindConfiguration(ConciergeOptions.Section);
        services.AddOptions<StanleyOptions>().BindConfiguration(StanleyOptions.Section);
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

        // Providers:StanleyLog is database (the default, shared and kept across restarts) or memory (one instance, for tests and trials).
        var tierLog = (config[$"{Section}:StanleyLog"] ?? "database").Trim().ToLowerInvariant();
        switch (tierLog)
        {
            case "database": services.AddScoped<IStanleyTierLog, DapperStanleyTierLog>(); services.AddScoped<IStanleyActionStore, DapperStanleyActionStore>(); services.AddScoped<IStanleyHandoffStore, DapperStanleyHandoffStore>(); services.AddScoped<IStanleyMemoryStore, DapperStanleyMemoryStore>(); services.AddScoped<IStanleyBriefStore, DapperStanleyBriefStore>(); services.AddScoped<IStanleyTravellerStore, DapperStanleyTravellerStore>(); break;
            case "memory": services.AddSingleton<IStanleyTierLog, MemoryStanleyTierLog>(); services.AddSingleton<IStanleyActionStore, MemoryStanleyActionStore>(); services.AddSingleton<IStanleyHandoffStore, MemoryStanleyHandoffStore>(); services.AddSingleton<IStanleyMemoryStore, MemoryStanleyMemoryStore>(); services.AddSingleton<IStanleyBriefStore, MemoryStanleyBriefStore>(); services.AddSingleton<IStanleyTravellerStore, MemoryStanleyTravellerStore>(); break;
            default: throw new InvalidOperationException($"{Section}:StanleyLog is '{tierLog}', which is not registered. Choose one of: database, memory.");
        }
        return services;
    }
}
