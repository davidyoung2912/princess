using System.Text.Json;

namespace Princess.Api.Domain;

/// <summary>
/// The daily programme of each ship at <c>aboard</c> depth. Sun Princess's is <see cref="ProgramRules.Events"/>; Sky Princess and Sapphire Princess are **concept samples**
/// from <c>Content/ship-programmes.json</c>, written by <c>npm run shipprogrammes:gen</c> (the same rows seed <c>ref.Events</c>). Event ids are the same on every ship, so a
/// booking's plan and tickets name an event and the booking's ship says which programme it belongs to; only the places differ (the ship's own theatre, pool and lounges).
/// </summary>
public static class ShipPrograms
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    private static readonly Lazy<IReadOnlyDictionary<string, IReadOnlyList<ShipEvent>>> All = new(() =>
    {
        var all = new Dictionary<string, IReadOnlyList<ShipEvent>> { [ShipDining.SunId] = ProgramRules.Events };
        using var stream = typeof(ShipPrograms).Assembly.GetManifestResourceStream("ship-programmes.json")
            ?? throw new InvalidOperationException("ship-programmes.json is not embedded.");
        using var doc = JsonDocument.Parse(stream);
        foreach (var ship in doc.RootElement.EnumerateObject())
            all[ship.Name] = ship.Value.Deserialize<List<ShipEvent>>(Options)!;
        return all;
    });

    /// <summary>The ships that have a programme.</summary>
    public static IReadOnlyCollection<string> Ships => [.. All.Value.Keys];

    /// <summary>The programme of a ship, or null for a ship with none.</summary>
    public static IReadOnlyList<ShipEvent>? For(string shipId) => All.Value.GetValueOrDefault(shipId);

    /// <summary>The programme of a ship (Sun Princess's for an unknown or missing ship).</summary>
    public static IReadOnlyList<ShipEvent> Of(string? shipId) => shipId is not null && All.Value.TryGetValue(shipId, out var e) ? e : ProgramRules.Events;
}
