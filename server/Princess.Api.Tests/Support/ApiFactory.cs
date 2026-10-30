using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Tests.Support;

/// <summary>The real pipeline (auth, errors, rate limits, Swagger) over in-memory stores, so no database is needed.</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public InMemoryUserStore Users { get; } = new();
    public InMemoryRefreshTokenStore RefreshTokens { get; } = new();
    public InMemoryAccessStore Access { get; } = new();
    public InMemoryJourney Journey { get; } = new();
    public FakeClock Clock { get; } = new(DateTime.UtcNow);
    public int LoginAttemptsPerMinute { get; init; } = 1000;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:SigningKey"] = "test-signing-key-test-signing-key-0123456789",
            ["Auth:LoginAttemptsPerMinute"] = LoginAttemptsPerMinute.ToString(),
        }));
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IUserStore>();
            services.RemoveAll<IRefreshTokenStore>();
            services.RemoveAll<IAccessStore>();
            services.RemoveAll<IAccountStore>();
            services.RemoveAll<ITripStore>();
            services.RemoveAll<IInboxStore>();
            services.RemoveAll<IPrivacyStore>();
            services.RemoveAll<IDemoStore>();
            services.RemoveAll<IClock>();
            services.AddSingleton<IUserStore>(Users);
            services.AddSingleton<IRefreshTokenStore>(RefreshTokens);
            services.AddSingleton<IAccessStore>(Access);
            services.AddSingleton<IAccountStore>(Journey);
            services.AddSingleton<ITripStore>(Journey);
            services.AddSingleton<IInboxStore>(Journey);
            services.AddSingleton<IPrivacyStore>(Journey);
            services.AddSingleton<IDemoStore>(Journey);
            services.AddSingleton<IClock>(Clock);
        });
    }
}
