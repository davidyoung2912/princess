using Microsoft.Extensions.Caching.Memory;
using Princess.Api.Data;
using Xunit;

namespace Princess.Api.Tests;

public class DataCacheTests
{
    private static UserRecord User(Guid id, string name) => new() { Id = 1, PublicId = id, FirstName = name };

    [Fact]
    public async Task AUserIsLoadedOnceThenServedFromTheCacheAsACopy()
    {
        using var memory = new MemoryCache(new MemoryCacheOptions());
        var cache = new UserCache(memory);
        var id = Guid.NewGuid();
        var loads = 0;
        Task<UserRecord?> Load() { loads++; return Task.FromResult<UserRecord?>(User(id, "Ann")); }

        var first = await cache.GetOrLoadAsync(id, Load);
        first!.FirstName = "changed by a caller";
        var second = await cache.GetOrLoadAsync(id, Load);

        Assert.Equal(1, loads);
        Assert.Equal("Ann", second!.FirstName);
    }

    [Fact]
    public async Task InvalidateMakesTheNextReadGoToTheDatabase()
    {
        using var memory = new MemoryCache(new MemoryCacheOptions());
        var cache = new UserCache(memory);
        var id = Guid.NewGuid();
        var name = "Ann";
        Task<UserRecord?> Load() => Task.FromResult<UserRecord?>(User(id, name));

        await cache.GetOrLoadAsync(id, Load);
        name = "Anne";
        cache.Invalidate();

        Assert.Equal("Anne", (await cache.GetOrLoadAsync(id, Load))!.FirstName);
    }

    [Fact]
    public async Task AnInvalidateDuringALoadDiscardsTheResult()
    {
        using var memory = new MemoryCache(new MemoryCacheOptions());
        var cache = new UserCache(memory);
        var id = Guid.NewGuid();
        var loads = 0;

        await cache.GetOrLoadAsync(id, () => { loads++; cache.Invalidate(); return Task.FromResult<UserRecord?>(User(id, "old")); });
        await cache.GetOrLoadAsync(id, () => { loads++; return Task.FromResult<UserRecord?>(User(id, "new")); });

        Assert.Equal(2, loads);
    }

    [Fact]
    public async Task AMissingUserIsNotCached()
    {
        using var memory = new MemoryCache(new MemoryCacheOptions());
        var cache = new UserCache(memory);
        var id = Guid.NewGuid();
        var loads = 0;

        Assert.Null(await cache.GetOrLoadAsync(id, () => { loads++; return Task.FromResult<UserRecord?>(null); }));
        Assert.Null(await cache.GetOrLoadAsync(id, () => { loads++; return Task.FromResult<UserRecord?>(null); }));

        Assert.Equal(2, loads);
    }

    [Fact]
    public async Task SailingsAreLoadedOnceAndEachCallerGetsItsOwnRows()
    {
        using var memory = new MemoryCache(new MemoryCacheOptions());
        var cache = new SailingCache(memory);
        var loads = 0;
        Task<List<SailingRow>> Load() { loads++; return Task.FromResult(new List<SailingRow> { new() { Id = "s1", BookingOpen = true } }); }

        var first = await cache.GetOrLoadAsync(Load);
        first[0].BookingOpen = false;
        var second = await cache.GetOrLoadAsync(Load);

        Assert.Equal(1, loads);
        Assert.True(second[0].BookingOpen);

        cache.Invalidate();
        await cache.GetOrLoadAsync(Load);
        Assert.Equal(2, loads);
    }
}
