using System.Security.Cryptography;
using System.Text;

namespace Princess.Api.Domain;

/// <summary>
/// The option lists, menus, texts and tables the screens show (multi-device plan 3, follow-up to Phase 3 step 6). They live in
/// <c>Content/reference-content.json</c>, written from the client's authored modules by <c>npm run content:gen</c> and embedded in the assembly,
/// so there is one copy to edit. <see cref="Json"/> is <c>{ "version": ..., "values": { "module.NAME": list or record } }</c>; <c>version</c>
/// changes when any of it does.
/// </summary>
public static class ContentReference
{
    private static readonly Lazy<string> Body = new(Load);

    public static string Json => Body.Value;

    private static readonly Lazy<System.Text.Json.JsonDocument> Parsed = new(() => System.Text.Json.JsonDocument.Parse(Body.Value));

    /// <summary>One served list or record by its <c>module.NAME</c> key; throws for a key nobody registered.</summary>
    public static System.Text.Json.JsonElement Value(string key) => Parsed.Value.RootElement.GetProperty("values").GetProperty(key);

    private static string Load()
    {
        using var stream = typeof(ContentReference).Assembly.GetManifestResourceStream("reference-content.json")
            ?? throw new InvalidOperationException("reference-content.json is not embedded.");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        var values = reader.ReadToEnd().Trim();
        var version = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(values))).ToLowerInvariant()[..16];
        return "{\"version\":\"" + version + "\",\"values\":" + values + "}";
    }
}
