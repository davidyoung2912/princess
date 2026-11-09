using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>One reply, as the tier log keeps it (AI-SEC-08): where it came from and what it cost. There is no field for the guest's words, and none for who asked.</summary>
public sealed class StanleyTierEntry
{
    public DateTime At { get; set; }
    /// <summary>blocked, handoff, offtopic, unavailable, trip, before or model.</summary>
    public string Tier { get; set; } = "";
    /// <summary>claude, scripted or empty.</summary>
    public string Source { get; set; } = "";
    public string Stage { get; set; } = "unknown";
    /// <summary>A closed set from <see cref="StanleyRouting.Topic"/>, or safety.</summary>
    public string Topic { get; set; } = "";
    /// <summary>ok, or why not: blocked, handoff, offtopic, limit, auth, rate, network, bad or off.</summary>
    public string Outcome { get; set; } = "ok";
    /// <summary>small, default or large; empty when no model was called.</summary>
    public string ModelTier { get; set; } = "";
    public int Calls { get; set; }
    public long InputTokens { get; set; }
    public long OutputTokens { get; set; }
}

/// <summary>Replies grouped by tier, source, stage, topic, outcome and model tier.</summary>
public sealed class StanleyTierRow
{
    public string Tier { get; set; } = "";
    public string Source { get; set; } = "";
    public string Stage { get; set; } = "";
    public string Topic { get; set; } = "";
    public string Outcome { get; set; } = "";
    public string ModelTier { get; set; } = "";
    public int Replies { get; set; }
    public int Calls { get; set; }
    public long InputTokens { get; set; }
    public long OutputTokens { get; set; }
}

public sealed record StanleyTierSummary(DateTime Since, int Replies, int ModelCalls, long InputTokens, long OutputTokens, List<StanleyTierRow> Rows)
{
    public static StanleyTierSummary Of(DateTime since, List<StanleyTierRow> rows) =>
        new(since, rows.Sum(r => r.Replies), rows.Sum(r => r.Calls), rows.Sum(r => r.InputTokens), rows.Sum(r => r.OutputTokens), rows);
}

public interface IStanleyTierLog
{
    Task RecordAsync(StanleyTierEntry entry, CancellationToken ct);
    Task<StanleyTierSummary> SummaryAsync(DateTime since, CancellationToken ct);
}

/// <summary>Kept in memory. For tests and a single-instance trial: <c>Providers:StanleyLog</c> = <c>memory</c>.</summary>
public sealed class MemoryStanleyTierLog : IStanleyTierLog
{
    private readonly List<StanleyTierEntry> _entries = [];

    public IReadOnlyList<StanleyTierEntry> Entries { get { lock (_entries) return [.. _entries]; } }

    public Task RecordAsync(StanleyTierEntry entry, CancellationToken ct)
    {
        lock (_entries) _entries.Add(entry);
        return Task.CompletedTask;
    }

    public Task<StanleyTierSummary> SummaryAsync(DateTime since, CancellationToken ct)
    {
        var rows = Entries.Where(e => e.At >= since)
            .GroupBy(e => (e.Tier, e.Source, e.Stage, e.Topic, e.Outcome, e.ModelTier))
            .Select(g => new StanleyTierRow
            {
                Tier = g.Key.Tier, Source = g.Key.Source, Stage = g.Key.Stage, Topic = g.Key.Topic, Outcome = g.Key.Outcome, ModelTier = g.Key.ModelTier,
                Replies = g.Count(), Calls = g.Sum(e => e.Calls), InputTokens = g.Sum(e => e.InputTokens), OutputTokens = g.Sum(e => e.OutputTokens),
            }).OrderByDescending(r => r.Replies).ToList();
        return Task.FromResult(StanleyTierSummary.Of(since, rows));
    }
}
