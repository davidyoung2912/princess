using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Demo controls (data model 6.7). Demo users only; a real account gets 404.</summary>
public static class DemoEndpoints
{
    public static void MapDemoEndpoints(this IEndpointRouteBuilder api)
    {
        var demo = api.MapGroup("/demo").WithTags("Demo");
        demo.MapGet("/state", async (DemoService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(ct)))
            .WithSummary("The demo clock offset (seconds to add to real time), speed and active scenarios. 404 unless the account is a demo account.");
        demo.MapPut("/state", async (DemoStateDto body, DemoService svc, CancellationToken ct) => Results.Ok(await svc.SaveAsync(body, ct)))
            .WithSummary("Sets the demo clock offset, speed and scenarios. 400 for an offset over a year, a speed outside 0 to 3600 or an unknown scenario; 404 unless a demo account.");
    }
}
