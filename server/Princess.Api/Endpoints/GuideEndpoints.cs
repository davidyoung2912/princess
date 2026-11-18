using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>The Journey Guide (docs/next-steps-guidance-plan.md): the guest's plan for the stage they are in.</summary>
public static class GuideEndpoints
{
    public static void MapGuideEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/me/guide", async (GuideService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(ct)))
            .WithTags("Guide").WithSummary("What to do now: every task of the guest's stage in order (open first by urgency, then waiting, then done), the one to do first, what moves the guest to the next stage and how many are done. Worked out on every read; nothing is stored.");
    }
}
