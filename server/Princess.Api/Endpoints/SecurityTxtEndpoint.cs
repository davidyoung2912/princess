namespace Princess.Api.Endpoints;

public static class SecurityTxtEndpoint
{
    /// <summary>RFC 9116 disclosure file (SEC-10). Replace the contact before any real deployment; the front end serves the same text from <c>public/.well-known</c>.</summary>
    public const string Text = """
        Contact: mailto:security@example.invalid
        Expires: 2027-12-31T00:00:00.000Z
        Preferred-Languages: en
        Policy: /security-policy.html
        """;

    public static void MapSecurityTxt(this IEndpointRouteBuilder app) =>
        app.MapGet("/.well-known/security.txt", () => Results.Text(Text + "\n", "text/plain; charset=utf-8"))
            .AllowAnonymous().ExcludeFromDescription();
}
