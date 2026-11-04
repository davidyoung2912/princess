namespace Princess.Api.Endpoints;

public static class SecurityTxtEndpoint
{
    /// <summary>RFC 9116 disclosure file (SEC-10). The contact comes from <c>Security:Contact</c> (a mailto: or https: URI); the default is a placeholder that must be set before a real deployment. The front end serves the same text from <c>public/.well-known</c>.</summary>
    public const string PlaceholderContact = "mailto:security@example.invalid";

    public static string Build(string? contact) => $"""
        Contact: {(string.IsNullOrWhiteSpace(contact) ? PlaceholderContact : contact)}
        Expires: 2027-12-31T00:00:00.000Z
        Preferred-Languages: en
        Policy: /security-policy.html
        """;

    public static void MapSecurityTxt(this IEndpointRouteBuilder app) =>
        app.MapGet("/.well-known/security.txt", (IConfiguration config) => Results.Text(Build(config["Security:Contact"]) + "\n", "text/plain; charset=utf-8"))
            .AllowAnonymous().ExcludeFromDescription();
}
