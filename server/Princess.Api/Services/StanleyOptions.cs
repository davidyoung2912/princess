using System.Text.Json.Nodes;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The gateway's switches (docs/stanley-gap-analysis-and-plan.md, phase 1). Each is a route that can be turned off in configuration (<c>Stanley:Switches:Model=false</c>)
/// without a deploy of code; Stanley then answers from what is left and says so (<c>degraded</c> on the reply and on <c>GET /me/stanley/status</c>).
/// <c>Library</c> and <c>Actions</c> are carried out on the device, which reads them from the status.
/// </summary>
public sealed class StanleySwitches
{
    /// <summary>The device's authored answers.</summary>
    public bool Library { get; set; } = true;
    /// <summary>The scripted answers and the ship facts the server builds without a model.</summary>
    public bool Resolver { get; set; } = true;
    /// <summary>Any model call at all.</summary>
    public bool Model { get; set; } = true;
    /// <summary>The tools over the guest's booking and the catalogue (the trip and before routes).</summary>
    public bool Tools { get; set; } = true;
    /// <summary>"Ask your cruise" previews and confirms.</summary>
    public bool Actions { get; set; } = true;

    /// <summary>The names of the routes that are off, for the reply.</summary>
    public List<string> Off() => [.. new (string Name, bool On)[] { ("library", Library), ("resolver", Resolver), ("model", Model), ("tools", Tools), ("actions", Actions) }.Where(x => !x.On).Select(x => x.Name)];
}

/// <summary>
/// Stanley's model use and budget (decision 6). The names are today's models and live only here. Starting numbers: at most <see cref="ChatCalls"/> model calls for a chat
/// request and <see cref="PlanningCalls"/> for a planning one, a token cap per tier, and <see cref="DailyCeiling"/> calls per guest per day. A cap that is reached
/// sends the question to the scripted answers with fallback <c>limit</c>.
/// </summary>
public sealed class StanleyOptions
{
    public const string Section = "Stanley";
    public string SmallModel { get; set; } = "claude-haiku-5-5";
    public string DefaultModel { get; set; } = "claude-sonnet-5-5";
    public string LargeModel { get; set; } = "claude-opus-5-5";
    public int SmallMaxTokens { get; set; } = 300;
    public int DefaultMaxTokens { get; set; } = 900;
    public int LargeMaxTokens { get; set; } = 1500;
    public int ChatCalls { get; set; } = 3;
    public int PlanningCalls { get; set; } = 5;
    public int DailyCeiling { get; set; } = 60;
    /// <summary>The key that turns a guest id into the opaque reference in the context packet. Set it in user-secrets or the environment; the default only keeps a local run working.</summary>
    public string PacketKey { get; set; } = "stanley-local-packet-key";
    public StanleySwitches Switches { get; set; } = new();

    public (string Model, int MaxTokens) For(ModelTier tier) => tier switch
    {
        ModelTier.Small => (SmallModel, SmallMaxTokens),
        ModelTier.Large => (LargeModel, LargeMaxTokens),
        _ => (DefaultModel, DefaultMaxTokens),
    };
}

/// <summary>
/// Counts and caps the model calls of one request: the per-request call cap and the guest's daily ceiling are both enforced here, and the tokens the service reports are
/// added up for the tier log. A cap that is reached throws <c>limit</c>, which the service turns into the scripted answer.
/// </summary>
public sealed class ModelMeter(IConciergeModel model, Func<CancellationToken, Task<bool>> takeDaily, int maxCalls)
{
    public int Calls { get; private set; }
    public long InputTokens { get; private set; }
    public long OutputTokens { get; private set; }
    /// <summary>Read tools the model called, and how many of them were refused (a traveller the guest may not read, bad input). Counts only.</summary>
    public int ToolCalls { get; private set; }
    public int ToolDenials { get; private set; }
    public void CountTool(bool refused) { ToolCalls++; if (refused) ToolDenials++; }
    /// <summary>The largest tier used so far, or null when no call was made.</summary>
    public ModelTier? Highest { get; private set; }

    public async Task<JsonObject> CallAsync(string system, string toolsJson, JsonArray messages, ModelTier tier, CancellationToken ct)
    {
        if (Calls >= maxCalls) throw new ConciergeModelException("limit", "The request's model call budget is spent.");
        if (!await takeDaily(ct)) throw new ConciergeModelException("limit", "The daily model call ceiling is reached.");
        Calls++;
        Highest = Highest is { } h && h > tier ? h : tier;
        var body = await model.CompleteAsync(system, toolsJson, messages, tier, ct);
        if (body["usage"] is JsonObject u)
        {
            InputTokens += u["input_tokens"] is JsonValue i && i.TryGetValue<long>(out var a) ? a : 0;
            OutputTokens += u["output_tokens"] is JsonValue o && o.TryGetValue<long>(out var b) ? b : 0;
        }
        return body;
    }
}
