using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using Princess.Api.Audit;
using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Endpoints;
using Princess.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var services = builder.Services;

services.AddOptions<JwtOptions>().BindConfiguration(JwtOptions.Section).ValidateDataAnnotations().ValidateOnStart();
services.AddOptions<AuthOptions>().BindConfiguration(AuthOptions.Section).ValidateDataAnnotations().ValidateOnStart();

services.AddMemoryCache();
// Brotli/gzip for JSON, also over HTTPS. BREACH needs a secret and attacker-chosen text in one response; the API's JSON has no reflected input beside a token.
services.AddResponseCompression(o =>
{
    o.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
    o.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
    o.EnableForHttps = true;
    o.MimeTypes = ["application/json", "application/problem+json", "text/calendar"];
});
services.Configure<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProviderOptions>(o => o.Level = System.IO.Compression.CompressionLevel.Fastest);
services.Configure<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProviderOptions>(o => o.Level = System.IO.Compression.CompressionLevel.Fastest);
services.AddPrincessDataProtection(builder.Configuration, builder.Environment);
services.AddSingleton<UserCache>();
services.AddSingleton<SailingCache>();
services.AddSingleton<IClock, SystemClock>();
services.AddSingleton<IDbConnectionFactory>(sp =>
    new SqlConnectionFactory(sp.GetRequiredService<IConfiguration>().GetConnectionString("Default")
        ?? throw new InvalidOperationException("ConnectionStrings:Default is not set. Use: dotnet user-secrets set \"ConnectionStrings:Default\" \"<connection string>\"")));
services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
services.AddSingleton<ITokenService, TokenService>();
services.AddScoped<IUserStore, DapperUserStore>();
services.AddScoped<IRefreshTokenStore, DapperRefreshTokenStore>();
services.AddScoped<IAccessStore, DapperAccessStore>();
services.AddScoped<IAuditStore, DapperAuditStore>();
services.AddOptions<AuditWriterOptions>().BindConfiguration(AuditWriterOptions.Section);
services.AddSingleton<AuditQueue>();
services.AddHostedService<AuditWriterService>();
services.AddScoped<IAuditLog, AuditLog>();
services.AddScoped<ISignInStore, DapperSignInStore>();
services.AddScoped<IMessageSender, StubMessageSender>();
services.AddScoped<IAuthService, AuthService>();
services.AddScoped<AccessService>();
services.AddScoped<IAccountStore, DapperAccountStore>();
services.AddScoped<ITripStore, DapperTripStore>();
services.AddScoped<ICatalogueStore, DapperCatalogueStore>();
services.AddScoped<IInboxStore, DapperInboxStore>();
services.AddScoped<IPrivacyStore, DapperPrivacyStore>();
services.AddScoped<IDemoStore, DapperDemoStore>();
services.AddScoped<IBookingStore, DapperBookingStore>();
services.AddScoped<IPlanStore, DapperPlanStore>();
services.AddScoped<IAheadStore, DapperAheadStore>();
services.AddScoped<ICheckinStore, DapperCheckinStore>();
services.AddScoped<IOnboardStore, DapperOnboardStore>();
services.AddScoped<IShipboardStore, DapperShipboardStore>();
services.AddScoped<IAboardStore, DapperAboardStore>();
services.AddScoped<IChatStore, DapperChatStore>();
services.AddScoped<IFinishStore, DapperFinishStore>();
// External sources and the concierge model are chosen by configuration (Providers:*), all defaulting to the simulation.
services.AddProviders(builder.Configuration);
services.AddScoped<IUserClock, UserClock>();
services.AddScoped<SubjectAccess>();
services.AddScoped<AccountService>();
services.AddScoped<TripService>();
services.AddScoped<TripWatchService>();
services.AddScoped<InstalmentChargeService>();
services.AddScoped<DocumentService>();
services.AddScoped<InboxService>();
services.AddScoped<IPushStore, DapperPushStore>();
services.AddScoped<IWatchTargetStore, DapperWatchTargetStore>();
services.AddScoped<IPhoneLookupStore, DapperPhoneLookupStore>();
services.AddScoped<SmsReplyService>();
services.AddScoped<IWatchLock, DapperWatchLock>();
services.AddScoped<PushService>();
services.AddScoped<PhoneCheckService>();
services.AddScoped<EmailCheckService>();
services.AddScoped<ReminderEmailService>();
services.AddScoped<CalendarFeedService>();
services.AddScoped<IShareStore, DapperShareStore>();
services.AddScoped<PartyService>();
services.AddScoped<ShareLinkService>();
services.AddScoped<IStateStore, DapperStateStore>();
services.AddScoped<IFamilyHomeStore, DapperFamilyHomeStore>();
services.AddScoped<IStaffTicketStore, DapperStaffTicketStore>();
services.AddScoped<StateService>();
services.AddScoped<IPortRowStore, DapperPortRowStore>();
services.AddScoped<PortRowService>();
services.AddScoped<FamilyHomeService>();
services.AddScoped<IMediaStore, DapperMediaStore>();
services.AddScoped<MediaService>();
services.AddScoped<DemoService>();
services.AddScoped<ContextService>();
services.AddScoped<JourneyEventService>();
services.AddScoped<AutopilotService>();
services.AddScoped<IStanleyTools, StanleyToolService>();
services.AddScoped<StanleyService>();
services.AddScoped<IStanleyTrips, StanleyTripLoader>();
services.AddScoped<IStanleyPackets, StanleyPacketBuilder>();
services.AddScoped<IStanleyEffects, StanleyEffects>();
services.AddScoped<StanleyActionService>();
services.AddScoped<StanleyHandoffService>();
services.AddScoped<StanleyMemoryService>();
services.AddScoped<StanleyDiscoverService>();
services.AddScoped<StanleyPlannerService>();
services.AddScoped<StanleyTravelService>();
services.AddScoped<StanleyTravellerService>();
services.AddScoped<StanleyChangeService>();
services.AddScoped<StanleyMoneyService>();
services.AddScoped<PrivacyService>();
services.AddScoped<DiscoverService>();
services.AddScoped<BookingService>();
services.AddScoped<PlanService>();
services.AddScoped<ScopeLoader>();
services.AddScoped<WaitService>();
services.AddScoped<AheadService>();
services.AddOptions<PassOptions>().BindConfiguration(PassOptions.Section).ValidateDataAnnotations().ValidateOnStart();
services.AddSingleton<PassLookupGuard>();
services.AddScoped<CheckinService>();
services.AddScoped<OnboardService>();
services.AddScoped<ServiceChatService>();
services.AddScoped<OrderService>();
services.AddScoped<FamilyService>();
services.AddScoped<HealthService>();
services.AddScoped<RoomService>();
services.AddScoped<PhotoService>();
services.AddScoped<LaundryService>();
services.AddScoped<WifiService>();
services.AddScoped<UpdatesService>();
services.AddScoped<SelectionService>();
services.AddScoped<ServiceRequestService>();
services.AddScoped<SafetyReportService>();
services.AddScoped<DrinkService>();
services.AddScoped<MoneyService>();
services.AddScoped<CabinPartyService>();
services.AddScoped<GroupTableService>();
services.AddScoped<GameService>();
services.AddScoped<TvService>();
services.AddScoped<LastMinuteService>();
services.AddScoped<ReadyService>();
services.AddScoped<ChatService>();
services.AddScoped<DisembarkService>();
services.AddScoped<CaseService>();
services.AddScoped<CelebrationService>();
services.AddScoped<SeaService>();
services.AddScoped<PostService>();
services.AddOptions<RetentionOptions>().BindConfiguration(RetentionOptions.Section);
services.AddHostedService<RetentionPurgeService>();
services.AddOptions<SchedulerOptions>().BindConfiguration(SchedulerOptions.Section);
services.AddHostedService<WatchSchedulerService>();
services.AddHttpContextAccessor();
services.AddScoped<ICurrentUser, CurrentUser>();

services.AddExceptionHandler<ApiExceptionHandler>();
services.AddProblemDetails(o => o.CustomizeProblemDetails = ctx => Problems.Normalise(ctx.ProblemDetails));

services.ConfigureOptions<ConfigureJwtBearer>();
services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
// Secure by default: every endpoint needs a signed-in user unless it says AllowAnonymous.
services.AddAuthorizationBuilder().SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.OnRejected = (ctx, _) => new ValueTask(Problems.Write(ctx.HttpContext, ApiErrorCode.Forbidden, "tooManyRequests", StatusCodes.Status429TooManyRequests));
});
services.AddOptions<RateLimiterOptions>().Configure<IOptions<AuthOptions>>((o, auth) =>
{
    o.AddPolicy(AuthEndpoints.LoginLimiter, http =>
        RateLimitPartition.GetFixedWindowLimiter(http.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = auth.Value.LoginAttemptsPerMinute,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
    // The public pass lookup answers to anyone, so it is limited by address.
    o.AddPolicy(CheckinEndpoints.LookupLimiter, http =>
        RateLimitPartition.GetFixedWindowLimiter(http.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = auth.Value.LoginAttemptsPerMinute,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
    // Guessing agent booking numbers is the thing to stop, so the window is per signed-in person (their sub), falling back to the address.
    o.AddPolicy(JourneyEndpoints.LinkLimiter, http =>
        RateLimitPartition.GetFixedWindowLimiter(http.User.FindFirst(Claims.Subject)?.Value ?? http.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = auth.Value.LoginAttemptsPerMinute,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
});

// A global limit for everything else (signed-in routes and public reads), per person or, failing that, per address. Health probes are exempt.
services.AddOptions<RateLimiterOptions>().Configure<IConfiguration>((o, config) =>
{
    var perMinute = config.GetValue("RateLimit:RequestsPerMinute", 300);
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(http =>
        http.Request.Path.StartsWithSegments("/health")
            ? RateLimitPartition.GetNoLimiter("health")
            : RateLimitPartition.GetFixedWindowLimiter(http.User.FindFirst(Claims.Subject)?.Value ?? http.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = perMinute,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
});

// Behind a reverse proxy the socket address is the proxy's. Trust X-Forwarded-* only from the proxies and networks listed in ForwardedHeaders:*.
var knownProxies = builder.Configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? [];
var knownNetworks = builder.Configuration.GetSection("ForwardedHeaders:KnownNetworks").Get<string[]>() ?? [];
var forwarded = knownProxies.Length + knownNetworks.Length > 0;
if (forwarded)
    services.Configure<ForwardedHeadersOptions>(o =>
    {
        o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        o.ForwardLimit = builder.Configuration.GetValue("ForwardedHeaders:ForwardLimit", 1);
        o.KnownProxies.Clear();
        o.KnownNetworks.Clear();   // the loopback defaults are replaced by the configured list
        foreach (var p in knownProxies) o.KnownProxies.Add(System.Net.IPAddress.Parse(p));
        foreach (var n in knownNetworks)
        {
            var parts = n.Split('/');
            o.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(System.Net.IPAddress.Parse(parts[0]), int.Parse(parts[1])));
        }
    });

// Request-size and connection limits (Limits:*). The API takes small JSON bodies only.
builder.WebHost.ConfigureKestrel(k =>
{
    k.AddServerHeader = false;
    k.Limits.MaxRequestBodySize = builder.Configuration.GetValue("Limits:MaxRequestBodyBytes", 1_048_576L);
    k.Limits.MaxRequestHeadersTotalSize = 32 * 1024;
    k.Limits.MaxConcurrentConnections = builder.Configuration.GetValue<long?>("Limits:MaxConcurrentConnections", 2000);
    k.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(15);
});

var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));

services.AddEndpointsApiExplorer();
services.AddSwaggerGen(o =>
{
    o.SwaggerDoc("v1", new OpenApiInfo { Title = "Princess API", Version = "v1" });
    o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Paste the accessToken from POST /api/v1/auth/login.",
    });
    o.AddSecurityRequirement(doc => new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference("Bearer", doc)] = [] });
});

// Structured logs for operations: set Logging:Json=true to write one JSON object per line to the console (off by default).
if (builder.Configuration.GetValue<bool>("Logging:Json"))
{
    builder.Logging.ClearProviders();
    builder.Logging.AddJsonConsole(o => { o.IncludeScopes = true; o.UseUtcTimestamp = true; o.TimestampFormat = "yyyy-MM-ddTHH:mm:ssZ "; });
}

var app = builder.Build();

if (forwarded) app.UseForwardedHeaders();
app.UseSecurityHeaders(hsts: !app.Environment.IsDevelopment());
app.UseResponseCompression();
app.UseReferenceCaching(TimeSpan.FromSeconds(app.Configuration.GetValue("Reference:MaxAgeSeconds", 300)));
app.UseExceptionHandler();
app.UseStatusCodePages();
if (app.Configuration.GetValue("Swagger:Enabled", false))
{
    app.UseSwagger();
    app.UseSwaggerUI(o => o.SwaggerEndpoint("/swagger/v1/swagger.json", "Princess API v1"));
}
app.UseCors();
app.UseAuthentication();
// After authentication (so the actor is known) and before the rate limiter and authorization (so refusals are seen).
app.UseMiddleware<AuditMiddleware>();
app.UseRateLimiter();
app.UseAuthorization();

app.MapHealthEndpoints();
app.MapSecurityTxt();
var v1 = app.MapGroup("/api/v1");
v1.MapAuthEndpoints();
v1.MapJourneyEndpoints();
v1.MapPushEndpoints();
v1.MapBookingEndpoints();
v1.MapPlanEndpoints();
v1.MapAheadEndpoints();
v1.MapCheckinEndpoints();
v1.MapOnboardEndpoints();
v1.MapShipboardEndpoints();
v1.MapAboardEndpoints();
v1.MapFinishEndpoints();
v1.MapStateEndpoints();
v1.MapPortRowEndpoints();
v1.MapPartyEndpoints();
v1.MapReferenceEndpoints();
v1.MapConciergeEndpoints();
v1.MapStanleyEndpoints();
v1.MapFamilyHomeEndpoints();
v1.MapMediaEndpoints();
v1.MapDemoEndpoints();
v1.MapAuditEndpoints();
v1.MapReviewEndpoints();

// Printed straight to the console, so it shows even if log filters hide the framework's own "Now listening on" line.
app.Lifetime.ApplicationStarted.Register(() =>
{
    var swagger = app.Configuration.GetValue("Swagger:Enabled", false);
    foreach (var address in app.Urls)
        Console.WriteLine(swagger ? $"Princess API: {address}  (Swagger: {address.TrimEnd('/')}/swagger)" : $"Princess API: {address}");
});

app.Run();

/// <summary>Visible to the test project's WebApplicationFactory.</summary>
public partial class Program;
