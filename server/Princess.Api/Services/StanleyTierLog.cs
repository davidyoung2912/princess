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
    /// <summary>The id of the resolver card that answered (a closed set of ids such as <c>plan.today</c>), or empty. Never words.</summary>
    public string CardId { get; set; } = "";
    /// <summary>The card said it could not answer.</summary>
    public bool Abstained { get; set; }

    /// <summary>A card id that is safe to keep: letters, digits, dots and dashes, at most 40; anything else is dropped to empty.</summary>
    public static string CleanCardId(string? id) => id is { Length: > 0 and <= 40 } && id.All(ch => char.IsAsciiLetterOrDigit(ch) || ch is '.' or '-' or '_') ? id : "";
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

/// <summary>How often one resolver card answered in the period, and how often it said it could not. Only cards answered at least twice are listed.</summary>
public sealed class StanleyCardCount
{
    public string CardId { get; set; } = "";
    public int Replies { get; set; }
    public int Abstained { get; set; }
}

public sealed record StanleyTierSummary(DateTime Since, int Replies, int ModelCalls, long InputTokens, long OutputTokens, List<StanleyTierRow> Rows, List<StanleyCardCount>? Cards = null)
{
    public const int MaxCards = 10;

    public static StanleyTierSummary Of(DateTime since, List<StanleyTierRow> rows, List<StanleyCardCount>? cards = null) =>
        new(since, rows.Sum(r => r.Replies), rows.Sum(r => r.Calls), rows.Sum(r => r.InputTokens), rows.Sum(r => r.OutputTokens), rows, cards ?? []);

    /// <summary>The most often answered cards of a set of entries, at least twice each, most first.</summary>
    public static List<StanleyCardCount> TopCards(IEnumerable<StanleyTierEntry> entries) =>
        [.. entries.Where(e => e.CardId.Length > 0).GroupBy(e => e.CardId)
            .Select(g => new StanleyCardCount { CardId = g.Key, Replies = g.Count(), Abstained = g.Count(e => e.Abstained) })
            .Where(c => c.Replies >= 2).OrderByDescending(c => c.Replies).ThenBy(c => c.CardId, StringComparer.Ordinal).Take(MaxCards)];
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
        var recent = Entries.Where(e => e.At >= since).ToList();
        var rows = recent
            .GroupBy(e => (e.Tier, e.Source, e.Stage, e.Topic, e.Outcome, e.ModelTier))
            .Select(g => new StanleyTierRow
            {
                Tier = g.Key.Tier, Source = g.Key.Source, Stage = g.Key.Stage, Topic = g.Key.Topic, Outcome = g.Key.Outcome, ModelTier = g.Key.ModelTier,
                Replies = g.Count(), Calls = g.Sum(e => e.Calls), InputTokens = g.Sum(e => e.InputTokens), OutputTokens = g.Sum(e => e.OutputTokens),
            }).OrderByDescending(r => r.Replies).ToList();
        return Task.FromResult(StanleyTierSummary.Of(since, rows, StanleyTierSummary.TopCards(recent)));
    }
}
