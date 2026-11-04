using System.Threading.Channels;
using Microsoft.Extensions.Options;

namespace Princess.Api.Audit;

public sealed class AuditWriterOptions
{
    public const string Section = "Audit";
    /// <summary>True (default) writes audit rows from a background task, so a request never waits for the database. False writes inside the request.</summary>
    public bool Background { get; set; } = true;
    /// <summary>Rows waiting to be written. When full the oldest waiting row is dropped and counted, so a flood cannot grow memory.</summary>
    public int QueueSize { get; set; } = 10_000;
    /// <summary>Seconds that anonymous 401 and 429 refusals from one address on one route are gathered into a single row. 0 writes each one.</summary>
    public int AggregateSeconds { get; set; } = 60;
    /// <summary>Most distinct address and route pairs gathered at once; beyond it the extra refusals are only counted.</summary>
    public int MaxAggregateKeys { get; set; } = 5000;
}

/// <summary>A bounded in-memory queue between the request (which appends) and <see cref="AuditWriterService"/> (which writes).</summary>
public sealed class AuditQueue
{
    private readonly Channel<AuditEntry> channel;
    private long dropped;

    public AuditQueue(IOptions<AuditWriterOptions> options)
    {
        Options = options.Value;
        channel = Channel.CreateBounded<AuditEntry>(new BoundedChannelOptions(Math.Max(100, Options.QueueSize))
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
        }, _ => Interlocked.Increment(ref dropped));
    }

    public AuditWriterOptions Options { get; }
    public bool Background => Options.Background;
    public ChannelReader<AuditEntry> Reader => channel.Reader;
    public void Complete() => channel.Writer.TryComplete();
    public bool TryEnqueue(AuditEntry entry) => channel.Writer.TryWrite(entry);
    /// <summary>Rows lost to a full queue since the last call.</summary>
    public long TakeDropped() => Interlocked.Exchange(ref dropped, 0);
}

/// <summary>Gathers repeated anonymous refusals (401, 429) into one row per address, route and status per window, so an unauthenticated flood costs one write, not one each.</summary>
public sealed class AuditAggregator(int maxKeys)
{
    private readonly Dictionary<string, (AuditEntry First, int Count, DateTime Last)> pending = [];

    public static bool Applies(AuditEntry e) => e.Category == AuditCategory.Request && e.Outcome == AuditOutcome.Denied
        && e.StatusCode is 401 or 429 && e.ActorPublicId is null && e.SubjectPublicId is null;

    public void Add(AuditEntry e)
    {
        var key = $"{e.Ip}|{e.StatusCode}|{e.Route}";
        if (pending.TryGetValue(key, out var p)) pending[key] = (p.First, p.Count + 1, e.At);
        else if (pending.Count < maxKeys) pending[key] = (e, 1, e.At);
        else
        {
            // Too many distinct sources: fold into one row per status so the memory stays bounded.
            var overflow = $"*|{e.StatusCode}|*";
            if (pending.TryGetValue(overflow, out var o)) pending[overflow] = (o.First, o.Count + 1, e.At);
            else
            {
                e.Ip = null; e.UserAgent = null; e.Route = null; e.Target = null; e.CorrelationId = null;
                e.Action = AuditLog.Cut($"{e.HttpMethod} (many routes)", 120)!;
                pending[overflow] = (e, 1, e.At);
            }
        }
    }

    /// <summary>The gathered rows, each marked with how many refusals it stands for; empties the aggregator.</summary>
    public List<AuditEntry> Drain()
    {
        var rows = new List<AuditEntry>(pending.Count);
        foreach (var (first, count, last) in pending.Values)
        {
            if (count > 1) first.Detail = AuditContext.Json(new { count, first = first.At, last });
            rows.Add(first);
        }
        pending.Clear();
        return rows;
    }
}

/// <summary>Writes queued audit rows to the store and flushes gathered refusals. Never throws out of its loop: a failing write is logged and the row is lost.</summary>
public sealed class AuditWriterService(AuditQueue queue, IServiceScopeFactory scopes, ILogger<AuditWriterService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        if (!queue.Background) return;
        var aggregate = new AuditAggregator(queue.Options.MaxAggregateKeys);
        var window = TimeSpan.FromSeconds(Math.Max(0, queue.Options.AggregateSeconds));
        var flushAt = DateTime.UtcNow + window;
        var reader = queue.Reader;
        try
        {
            while (!stop.IsCancellationRequested)
            {
                using var tick = CancellationTokenSource.CreateLinkedTokenSource(stop);
                if (window > TimeSpan.Zero) tick.CancelAfter(window);
                try
                {
                    if (!await reader.WaitToReadAsync(tick.Token)) break;   // completed
                }
                catch (OperationCanceledException) when (!stop.IsCancellationRequested) { }   // the window passed

                var batch = new List<AuditEntry>();
                while (batch.Count < 500 && reader.TryRead(out var e))
                {
                    if (window > TimeSpan.Zero && AuditAggregator.Applies(e)) aggregate.Add(e); else batch.Add(e);
                }
                if (window <= TimeSpan.Zero || DateTime.UtcNow >= flushAt)
                {
                    batch.AddRange(aggregate.Drain());
                    flushAt = DateTime.UtcNow + window;
                }
                await WriteAsync(batch, CancellationToken.None);
            }
        }
        catch (OperationCanceledException) { }
        // Shutting down: write what is waiting.
        queue.Complete();
        var rest = new List<AuditEntry>();
        while (reader.TryRead(out var e)) { if (AuditAggregator.Applies(e)) aggregate.Add(e); else rest.Add(e); }
        rest.AddRange(aggregate.Drain());
        using var grace = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        await WriteAsync(rest, grace.Token);
    }

    private async Task WriteAsync(List<AuditEntry> rows, CancellationToken ct)
    {
        if (queue.TakeDropped() is > 0 and var lost) log.LogError("Audit queue was full: {Lost} rows were dropped", lost);
        if (rows.Count == 0) return;
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            var store = scope.ServiceProvider.GetRequiredService<IAuditStore>();
            foreach (var row in rows)
            {
                try { await store.AppendAsync(row, ct); }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    log.LogError(ex, "Audit write failed for {Action} ({Outcome})", row.Action, row.Outcome);
                }
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log.LogError(ex, "Audit writer could not open a scope for {Count} rows", rows.Count);
        }
    }
}
