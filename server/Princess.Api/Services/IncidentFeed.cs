namespace Princess.Api.Services;

/// <summary>One known problem with the service, as guests are told of it on the Status screen (TRU-07).</summary>
public sealed record IncidentDto(string Id, string Area, long StartedAt, string Message, long? ResolvedAt);

/// <summary>What the operator has declared as an incident. A real status page replaces this and keeps the shape.</summary>
public interface IIncidentFeed
{
    IReadOnlyList<IncidentDto> Current();
}

/// <summary>
/// Incidents the operator writes in configuration, so one can be declared or closed without a code change (see the runbook):
/// <c>Status:Incidents:0:Id</c>, <c>Area</c> (one of the Status screen's service ids), <c>StartedAt</c> (ISO 8601, UTC), <c>Message</c> (plain words for guests)
/// and optionally <c>ResolvedAt</c>. Newest first. An entry that is incomplete, names an unknown area or has an unreadable time is left out, never guessed at.
/// Resolved incidents stay listed for a day so a guest who saw a problem can see that it ended.
/// </summary>
public sealed class ConfigIncidentFeed(IConfiguration config) : IIncidentFeed
{
    public static readonly TimeSpan ResolvedStays = TimeSpan.FromHours(24);
    public const int MaxMessage = 300;

    public IReadOnlyList<IncidentDto> Current()
    {
        var now = TimeProvider.System.GetUtcNow();
        var list = new List<IncidentDto>();
        foreach (var item in config.GetSection("Status:Incidents").GetChildren())
        {
            var id = item["Id"]?.Trim();
            var area = item["Area"]?.Trim();
            var message = item["Message"]?.Trim();
            if (string.IsNullOrEmpty(id) || id.Length > 40 || string.IsNullOrEmpty(message) || area is null || !SimServiceStatus.Ids.Contains(area)) continue;
            if (!DateTimeOffset.TryParse(item["StartedAt"], System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeUniversal, out var started) || started > now) continue;
            DateTimeOffset? resolved = null;
            if (!string.IsNullOrWhiteSpace(item["ResolvedAt"]))
            {
                if (!DateTimeOffset.TryParse(item["ResolvedAt"], System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeUniversal, out var r)) continue;
                if (now - r > ResolvedStays) continue;
                resolved = r;
            }
            list.Add(new IncidentDto(id, area, started.ToUnixTimeMilliseconds(), message.Length > MaxMessage ? message[..MaxMessage] : message, resolved?.ToUnixTimeMilliseconds()));
        }
        return [.. list.OrderByDescending(i => i.StartedAt)];
    }
}
