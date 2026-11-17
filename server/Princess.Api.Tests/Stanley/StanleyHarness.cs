using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Tests.Stanley;

// The Stanley test harness (docs/stanley-actions-and-proactive-plan.md, 23.1). A script is a list of typed steps ("at minute N, do X") run against the real
// due worker, queue, arbiter and breakers on a pinned clock. The result is a transcript that is compared with a stored golden, and a structured record the
// invariant tests read. Every later phase adds fixtures here and cards to StanleyRuleCards.All.

/// <summary>What the guest allows right now, as the worker's context loader would report it.</summary>
public sealed record Limits(int Budget = 5, bool Quiet = false, bool Dnd = false, bool Calm = false, bool Ship = false, bool Gone = false, string[]? Off = null);

public abstract record Step(int At);
/// <summary>Queue one due item. <c>DueIn</c> is minutes after <c>At</c>. Queuing the same key twice is a duplicate event.</summary>
public sealed record Queue(int At, string Key, long User = 1, int DueIn = 0, string Class = "plan", int Rank = StanleyRank.Convenience, bool Critical = false, string Subject = "", string Fact = "") : Step(At);
/// <summary>Change what one guest allows (budget, quiet hours, do-not-disturb, calm mode, a ship alert, the guest leaving).</summary>
public sealed record Allow(int At, long User, Limits Limits) : Step(At);
/// <summary>The stop fact for an item has gone (the reminder was removed, the tour was rebooked): nothing may be sent for it.</summary>
public sealed record Withdraw(int At, string Key) : Step(At);
/// <summary>The delivery provider goes down or comes back.</summary>
public sealed record Outage(int At, bool Down) : Step(At);
/// <summary>One pass of the worker.</summary>
public sealed record Run(int At) : Step(At);
/// <summary>The server restarts: a new worker over the same queue.</summary>
public sealed record Restart(int At) : Step(At);

/// <summary>A named fixture: where the clock starts, the operator's options and the steps.</summary>
public sealed record Script(string Name, string Describes, DateTime Start, Step[] Steps, int BreakerLimit = 500, string[]? OffClasses = null);

public sealed record Delivery(DateTime At, long User, string[] Keys, bool Push, bool Critical, int Rank, string Class, Limits Limits, int SentBefore);

public sealed record ScriptResult(Script Script, List<string> Lines, List<Delivery> Deliveries, List<StanleyDueRow> Rows, Dictionary<string, DateTime> Withdrawn, List<(DateTime At, StanleyDueSummary Summary)> Passes);

public static class ScriptRunner
{
    private sealed class Pin(DateTime now) : IClock { public DateTime UtcNow { get; set; } = now; }

    private sealed class World(Script script) : IStanleyDueHandler, IStanleyDueContext
    {
        public Pin Clock = new(script.Start);
        public readonly Dictionary<long, Limits> Limits = [];
        public readonly List<Delivery> Deliveries = [];
        public readonly Dictionary<string, DateTime> Withdrawn = [];
        public readonly Dictionary<string, StanleyDueRow> Queued = [];
        public bool Down;
        public string Trigger => StanleyTrigger.Time;

        public Limits LimitsOf(long user) => Limits.TryGetValue(user, out var l) ? l : new Limits();
        public int SentToday(long user) => Deliveries.Count(d => d.User == user && d.At.Date == Clock.UtcNow.Date);

        public Task<bool> StillNeededAsync(StanleyDue due, CancellationToken ct) => Task.FromResult(!Withdrawn.ContainsKey(due.Key));

        public Task DeliverAsync(long userId, StanleyCard card, CancellationToken ct)
        {
            if (Down) throw new InvalidOperationException("provider down");
            var first = Queued[card.Keys[0]];
            Deliveries.Add(new(Clock.UtcNow, userId, [.. card.Keys], card.Push, card.Critical, card.Rank, first.ClassId, LimitsOf(userId), SentToday(userId)));
            return Task.CompletedTask;
        }

        public Task<ArbiterContext?> LoadAsync(long userId, CancellationToken ct)
        {
            var l = LimitsOf(userId);
            return Task.FromResult<ArbiterContext?>(l.Gone ? null : new(l.Budget, SentToday(userId), l.Quiet, l.Dnd, l.Calm, l.Ship, new HashSet<string>(l.Off ?? [])));
        }
    }

    public static async Task<ScriptResult> RunAsync(Script script)
    {
        var world = new World(script);
        var store = new MemoryStanleyDueStore();
        var breakers = new MemoryStanleyBreakerStore();
        var sp = new ServiceCollection().AddSingleton<IStanleyDueStore>(store).AddSingleton<IStanleyBreakerStore>(breakers)
            .AddSingleton<IStanleyDueHandler>(world).AddSingleton<IStanleyDueContext>(world).BuildServiceProvider();
        var options = Options.Create(new SchedulerOptions { BreakerLimit = script.BreakerLimit, OffClasses = script.OffClasses ?? [] });
        StanleyDueWorker NewWorker() => new(sp.GetRequiredService<IServiceScopeFactory>(), options, world.Clock, NullLogger<StanleyDueWorker>.Instance);
        var worker = NewWorker();

        var lines = new List<string>();
        var passes = new List<(DateTime, StanleyDueSummary)>();
        string Stamp() => $"T{(int)(world.Clock.UtcNow - script.Start).TotalMinutes:+000;-000}";
        foreach (var step in script.Steps)
        {
            world.Clock.UtcNow = script.Start.AddMinutes(step.At);
            switch (step)
            {
                case Queue q:
                    var row = new StanleyDueRow { UserId = q.User, IdemKey = q.Key, DueAt = world.Clock.UtcNow.AddMinutes(q.DueIn), ClassId = q.Class, RankNo = q.Rank, Critical = q.Critical, Subject = q.Subject, FactKey = q.Fact, CreatedAt = world.Clock.UtcNow };
                    var added = await store.EnqueueAsync(row, default);
                    world.Queued.TryAdd(q.Key, row);
                    lines.Add($"{Stamp()} queue {q.Key} user={q.User} due=T{q.At + q.DueIn:+000;-000} class={q.Class} rank={q.Rank}{(q.Critical ? " critical" : "")}{(added ? "" : " DUPLICATE-IGNORED")}");
                    break;
                case Allow a:
                    world.Limits[a.User] = a.Limits;
                    lines.Add($"{Stamp()} allow user={a.User} {Describe(a.Limits)}");
                    break;
                case Withdraw w:
                    world.Withdrawn.TryAdd(w.Key, world.Clock.UtcNow);
                    lines.Add($"{Stamp()} withdraw {w.Key}");
                    break;
                case Outage o:
                    world.Down = o.Down;
                    lines.Add($"{Stamp()} provider {(o.Down ? "down" : "up")}");
                    break;
                case Restart:
                    worker = NewWorker();
                    lines.Add($"{Stamp()} restart");
                    break;
                case Run:
                    var before = world.Deliveries.Count;
                    var s = await worker.RunOnceAsync(default);
                    passes.Add((world.Clock.UtcNow, s));
                    lines.Add($"{Stamp()} run claimed={s.Claimed} cards={s.Cards} held={s.Held} dropped={s.Dropped} back={s.Rescheduled}");
                    foreach (var d in world.Deliveries.Skip(before)) lines.Add($"  card user={d.User} [{string.Join(",", d.Keys)}] rank={d.Rank} push={(d.Push ? "yes" : "no")}{(d.Critical ? " critical" : "")}");
                    break;
            }
        }
        var rows = store.Snapshot();
        foreach (var r in rows) lines.Add($"end {r.IdemKey} {r.State}{(r.Reason is null ? "" : " " + r.Reason)}");
        return new(script, lines, world.Deliveries, rows, world.Withdrawn, passes);
    }

    private static string Describe(Limits l) =>
        $"budget={l.Budget}{(l.Quiet ? " quiet" : "")}{(l.Dnd ? " dnd" : "")}{(l.Calm ? " calm" : "")}{(l.Ship ? " shipAlert" : "")}{(l.Gone ? " gone" : "")}{(l.Off is { Length: > 0 } ? " off=" + string.Join("+", l.Off) : "")}";
}

/// <summary>Goldens: the expected transcript of each script, stored as JSON under <c>Goldens/stanley</c>. A change is a reviewed diff. Set <c>STANLEY_UPDATE_GOLDENS=1</c> to rewrite them.</summary>
public static class Goldens
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    private static string Dir([System.Runtime.CompilerServices.CallerFilePath] string here = "") =>
        Path.GetFullPath(Path.Combine(Path.GetDirectoryName(here)!, "..", "Goldens", "stanley"));

    public static string PathFor(string name) => Path.Combine(Dir(), name + ".json");

    public static void Check(ScriptResult r)
    {
        var path = PathFor(r.Script.Name);
        var actual = JsonSerializer.Serialize(new { name = r.Script.Name, describes = r.Script.Describes, lines = r.Lines }, Json).ReplaceLineEndings("\n") + "\n";
        if (Environment.GetEnvironmentVariable("STANLEY_UPDATE_GOLDENS") == "1")
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, actual);
            return;
        }
        Assert.True(File.Exists(path), $"No golden for \"{r.Script.Name}\". Run once with STANLEY_UPDATE_GOLDENS=1, read the file and commit it.");
        Assert.Equal(File.ReadAllText(path).ReplaceLineEndings("\n"), actual);
    }
}
