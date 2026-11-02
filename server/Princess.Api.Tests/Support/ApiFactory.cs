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
    public InMemorySignInStore SignIn { get; }
    public InMemoryAccessStore Access { get; } = new();
    public InMemoryJourney Journey { get; } = new();
    public InMemoryBookingStore Bookings { get; }
    public InMemoryPlanStore Plan { get; }
    public InMemoryAheadStore Ahead { get; }
    public InMemoryCheckinStore Checkin { get; }
    public InMemoryOnboardStore Onboard { get; } = new();
    public InMemoryShipboardStore Shipboard { get; }
    public InMemoryAboardStore Aboard { get; }
    public InMemoryChatStore Chat { get; }
    public InMemoryFinishStore Finish { get; }
    public InMemoryStateStore State { get; } = new();
    public FakeClock Clock { get; } = new(DateTime.UtcNow);
    public int LoginAttemptsPerMinute { get; init; } = 1000;

    public ApiFactory()
    {
        SignIn = new InMemorySignInStore(Users, RefreshTokens);
        Bookings = new InMemoryBookingStore(Journey, Access);
        Plan = new InMemoryPlanStore(Journey);
        Ahead = new InMemoryAheadStore(Journey);
        Checkin = new InMemoryCheckinStore(Journey);
        Shipboard = new InMemoryShipboardStore(Onboard);
        Aboard = new InMemoryAboardStore(Shipboard, Plan);
        Chat = new InMemoryChatStore(Users);
        Finish = new InMemoryFinishStore(Shipboard);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:SigningKey"] = "test-signing-key-test-signing-key-0123456789",
            ["Auth:LoginAttemptsPerMinute"] = LoginAttemptsPerMinute.ToString(),
            ["Retention:IntervalMinutes"] = "0",
        }));
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IUserStore>();
            services.RemoveAll<IRefreshTokenStore>();
            services.RemoveAll<ISignInStore>();
            services.RemoveAll<IAccessStore>();
            services.RemoveAll<IAccountStore>();
            services.RemoveAll<ITripStore>();
            services.RemoveAll<IInboxStore>();
            services.RemoveAll<IPrivacyStore>();
            services.RemoveAll<IDemoStore>();
            services.RemoveAll<IBookingStore>();
            services.RemoveAll<IPlanStore>();
            services.RemoveAll<IAheadStore>();
            services.RemoveAll<ICheckinStore>();
            services.RemoveAll<IOnboardStore>();
            services.RemoveAll<IShipboardStore>();
            services.RemoveAll<IAboardStore>();
            services.RemoveAll<IChatStore>();
            services.RemoveAll<IFinishStore>();
            services.RemoveAll<IStateStore>();
            services.RemoveAll<IClock>();
            services.AddSingleton<IUserStore>(Users);
            services.AddSingleton<IRefreshTokenStore>(RefreshTokens);
            services.AddSingleton<ISignInStore>(SignIn);
            services.AddSingleton<IAccessStore>(Access);
            services.AddSingleton<IAccountStore>(Journey);
            services.AddSingleton<ITripStore>(Journey);
            services.AddSingleton<IInboxStore>(Journey);
            services.AddSingleton<IPrivacyStore>(Journey);
            services.AddSingleton<IDemoStore>(Journey);
            services.AddSingleton<IBookingStore>(Bookings);
            services.AddSingleton<IPlanStore>(Plan);
            services.AddSingleton<IAheadStore>(Ahead);
            services.AddSingleton<ICheckinStore>(Checkin);
            services.AddSingleton<IOnboardStore>(Onboard);
            services.AddSingleton<IShipboardStore>(Shipboard);
            services.AddSingleton<IAboardStore>(Aboard);
            services.AddSingleton<IChatStore>(Chat);
            services.AddSingleton<IFinishStore>(Finish);
            services.AddSingleton<IStateStore>(State);
            services.AddSingleton<IClock>(Clock);
        });
    }
}
