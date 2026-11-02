using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
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
services.AddScoped<ISignInStore, DapperSignInStore>();
services.AddScoped<IMessageSender, StubMessageSender>();
services.AddScoped<IAuthService, AuthService>();
services.AddScoped<AccessService>();
services.AddScoped<IAccountStore, DapperAccountStore>();
services.AddScoped<ITripStore, DapperTripStore>();
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
services.AddScoped<DocumentService>();
services.AddScoped<InboxService>();
services.AddScoped<IPushStore, DapperPushStore>();
services.AddScoped<PushService>();
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
services.AddScoped<DemoService>();
services.AddScoped<ContextService>();
services.AddScoped<AutopilotService>();
services.AddScoped<ConciergeService>();
services.AddScoped<PrivacyService>();
services.AddScoped<DiscoverService>();
services.AddScoped<BookingService>();
services.AddScoped<PlanService>();
services.AddScoped<ScopeLoader>();
services.AddScoped<WaitService>();
services.AddScoped<AheadService>();
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
services.AddScoped<PartyService>();
services.AddScoped<GroupTableService>();
services.AddScoped<GameService>();
services.AddScoped<TvService>();
services.AddScoped<LastMinuteService>();
services.AddScoped<ReadyService>();
services.AddScoped<ChatService>();
services.AddScoped<DisembarkService>();
services.AddScoped<CaseService>();
services.AddScoped<PostService>();
services.AddOptions<RetentionOptions>().BindConfiguration(RetentionOptions.Section);
services.AddHostedService<RetentionPurgeService>();
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

var app = builder.Build();

app.UseSecurityHeaders(hsts: !app.Environment.IsDevelopment());
app.UseExceptionHandler();
app.UseStatusCodePages();
if (app.Configuration.GetValue("Swagger:Enabled", true))
{
    app.UseSwagger();
    app.UseSwaggerUI(o => o.SwaggerEndpoint("/swagger/v1/swagger.json", "Princess API v1"));
}
app.UseCors();
app.UseAuthentication();
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
v1.MapFamilyHomeEndpoints();
v1.MapDemoEndpoints();

// Printed straight to the console, so it shows even if log filters hide the framework's own "Now listening on" line.
app.Lifetime.ApplicationStarted.Register(() =>
{
    var swagger = app.Configuration.GetValue("Swagger:Enabled", true);
    foreach (var address in app.Urls)
        Console.WriteLine(swagger ? $"Princess API: {address}  (Swagger: {address.TrimEnd('/')}/swagger)" : $"Princess API: {address}");
});

app.Run();

/// <summary>Visible to the test project's WebApplicationFactory.</summary>
public partial class Program;
