using System.Text.RegularExpressions;
using System.Text.Json;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>
/// The REST surface in docs/backend-data-model.md section 6 against the OpenAPI document: every verb and route a table row states in full must be served.
/// (`npm run api:check` does the other half: every method of the TypeScript `Api` interface has a row.) Abbreviated forms such as <c>POST/DELETE /me/cards[/{id}]</c> are skipped.
/// </summary>
public partial class ApiSurfaceTests : IDisposable
{
    private readonly ApiFactory _f = new();

    public void Dispose()
    {
        _f.Dispose();
        GC.SuppressFinalize(this);
    }

    [GeneratedRegex(@"^((?:GET|POST|PUT|PATCH|DELETE)(?:/(?:GET|POST|PUT|PATCH|DELETE))*) (\S+)")]
    private static partial Regex VerbRoute();

    [GeneratedRegex(@"\{[^}/]*\}")]
    private static partial Regex Param();

    private static string Normal(string path) => Param().Replace(path.Split('?')[0].TrimEnd('/'), "{}");

    /// <summary>The data-model document, found by walking up from the test output; null when the server is built without the repo's docs folder (for example a copy of /server on its own).</summary>
    private static string? DocPath()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var file = Path.Combine(dir.FullName, "docs", "backend-data-model.md");
            if (File.Exists(file)) return file;
        }
        return null;
    }

    /// <summary>Every (verb, path) the tables state in full, before the booking prefix is added.</summary>
    private static List<(string Verb, string Path, string Row)> Stated(string docPath)
    {
        var doc = File.ReadAllText(docPath);
        var start = doc.IndexOf("\n## 6. API surface", StringComparison.Ordinal);
        var end = doc.IndexOf("### 6.7", StringComparison.Ordinal);
        var found = new List<(string, string, string)>();
        foreach (var line in doc[start..end].Split('\n').Where(l => l.StartsWith('|')))
        {
            var cells = line.Split('|');
            if (cells.Length < 3) continue;
            string? lastAbsolute = null;
            foreach (Match token in Regex.Matches(cells[2], "`([^`]+)`"))
            {
                var m = VerbRoute().Match(token.Groups[1].Value);
                if (!m.Success) continue;
                var path = m.Groups[2].Value;
                if (path.Contains('['))
                {
                    lastAbsolute = null;
                    continue;
                }
                if (path.StartsWith('…')) path = lastAbsolute is null ? "" : lastAbsolute + path[1..];
                else lastAbsolute = path;
                if (path.Length == 0 || !path.StartsWith('/')) continue;
                foreach (var verb in m.Groups[1].Value.Split('/')) found.Add((verb.ToLowerInvariant(), path, line.Trim()));
            }
        }
        return found;
    }

    [Fact]
    public async Task EveryRouteTheTablesStateInFullIsServed()
    {
        if (DocPath() is not { } docPath) return;   // no docs folder next to this copy of the server: nothing to compare against
        using var http = _f.CreateClient();
        var doc = JsonDocument.Parse(await http.GetStringAsync("/swagger/v1/swagger.json")).RootElement;
        var served = new HashSet<(string, string)>();
        foreach (var path in doc.GetProperty("paths").EnumerateObject())
            foreach (var op in path.Value.EnumerateObject())
                served.Add((op.Name, Normal(path.Name.Replace("/api/v1", ""))));

        var stated = Stated(docPath);
        Assert.True(stated.Count > 150, $"only {stated.Count} routes were read from the tables");
        var missing = stated.Where(s => !served.Contains((s.Verb, Normal(s.Path))) && !served.Contains((s.Verb, Normal("/bookings/{number}" + s.Path))))
            .Select(s => $"{s.Verb.ToUpperInvariant()} {s.Path}").Distinct().ToList();
        Assert.True(missing.Count == 0, "not served: " + string.Join(", ", missing));
    }
}
