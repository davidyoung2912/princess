using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Services;

namespace Princess.Api.Tests;

public class WatchSchedulerTests
{
    private sealed class Lock(bool free) : IWatchLock
    {
        public int Released;
        public Task<IAsyncDisposable?> TryAcquireAsync(CancellationToken ct) => Task.FromResult<IAsyncDisposable?>(free ? new Handle(this) : null);
        private sealed class Handle(Lock l) : IAsyncDisposable { public ValueTask DisposeAsync() { l.Released++; return ValueTask.CompletedTask; } }
    }

    private sealed class Targets(List<long> ids) : IWatchTargetStore
    {
        public int Calls;
        public Task<List<long>> ListUserIdsAsync(int max, CancellationToken ct) { Calls++; return Task.FromResult(ids); }
    }

    private static WatchSchedulerService Make(Lock l, Targets t)
    {
        var services = new ServiceCollection().AddSingleton<IWatchLock>(l).AddSingleton<IWatchTargetStore>(t).BuildServiceProvider();
        return new(services.GetRequiredService<IServiceScopeFactory>(), Options.Create(new SchedulerOptions()), NullLogger<WatchSchedulerService>.Instance);
    }

    [Fact]
    public async Task SkipsThePassWhenAnotherInstanceHoldsTheLock()
    {
        var targets = new Targets([1, 2]);
        Assert.Equal(0, await Make(new Lock(false), targets).RunOnceAsync(CancellationToken.None));
        Assert.Equal(0, targets.Calls);
    }

    [Fact]
    public async Task ReleasesTheLockAfterAPassAndChecksNobodyWhenThereIsNobody()
    {
        var l = new Lock(true);
        var targets = new Targets([]);
        Assert.Equal(0, await Make(l, targets).RunOnceAsync(CancellationToken.None));
        Assert.Equal(1, targets.Calls);
        Assert.Equal(1, l.Released);
    }
}
