using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services.Mcp;

/// <summary>
/// Where cruise search gets its sailings (docs/mcp-integration-plan.md, phase 8). <c>Providers:CruiseDiscovery</c> is <c>local</c>: our own catalogue. A real provider (an MCP server for cruise
/// search, or Mobi) would be another implementation with the same answer shape, chosen in <c>McpRegistration</c>; callers cannot tell which answered.
/// </summary>
public interface ICruiseDiscovery
{
    Task<List<CatalogueSailingDto>> SearchAsync(SailingFilter filter, CancellationToken ct);
}

public sealed class LocalCruiseDiscovery(ICatalogueStore catalogue) : ICruiseDiscovery
{
    public async Task<List<CatalogueSailingDto>> SearchAsync(SailingFilter filter, CancellationToken ct) =>
        ShipCatalogueRules.Sailings(await catalogue.GetAsync(ct), filter);
}

/// <summary>One place a guest can search for flights, as a plain web address built from the trip. Nothing is fetched and nothing about the guest is sent: only airports and a date.</summary>
public sealed record FlightSearchLink(string Name, string Url);

/// <summary>
/// Flight search (phase 8). <c>Providers:FlightSearch</c> is <c>local</c>: official search pages with the airports and date filled in. A provider that returns fares would be another
/// implementation; until one is verified to work, the app does not guess at prices.
/// </summary>
public interface IFlightSearch
{
    IReadOnlyList<FlightSearchLink> Links(string from, string to, DateOnly date);
}

public sealed class LocalFlightSearch : IFlightSearch
{
    public IReadOnlyList<FlightSearchLink> Links(string from, string to, DateOnly date)
    {
        var day = date.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
        var q = Uri.EscapeDataString($"Flights from {from} to {to} on {day}");
        return [new("Google Flights", $"https://www.google.com/travel/flights?q={q}"), new("Kayak", $"https://www.kayak.com/flights/{from}-{to}/{day}")];
    }

    /// <summary>An IATA airport code: three letters.</summary>
    public static bool IsAirport(string? s) => s is { Length: 3 } && s.All(char.IsAsciiLetter);
}
