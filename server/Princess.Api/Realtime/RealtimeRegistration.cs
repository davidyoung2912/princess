namespace Princess.Api.Realtime;

public static class RealtimeRegistration
{
    /// <summary>The live connection: WebSockets only (the browsers Princess supports all have them), a 15 s keep-alive and a 30 s client timeout.</summary>
    public static IServiceCollection AddPrincessRealtime(this IServiceCollection services)
    {
        services.AddSingleton<RealtimeState>();
        services.AddSingleton<IRealtimeHub, SignalRRealtimeHub>();
        services.AddSignalR(o =>
        {
            o.KeepAliveInterval = TimeSpan.FromSeconds(15);
            o.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
            o.MaximumReceiveMessageSize = 4 * 1024;   // the only thing a client ever sends is an acknowledgement id
            o.EnableDetailedErrors = false;
        });
        return services;
    }

    public static IEndpointRouteBuilder MapPrincessRealtime(this IEndpointRouteBuilder app)
    {
        app.MapHub<ChatHub>(ChatHub.Path, o => o.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.WebSockets);
        return app;
    }
}
