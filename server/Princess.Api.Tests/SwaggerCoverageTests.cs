using System.Text.Json;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>The OpenAPI document is the checklist for the frontend phases, so every Phase 6 route from data model 6.1 must be in it with the right verb and public/secured status.</summary>
public class SwaggerCoverageTests : IDisposable
{
    private readonly ApiFactory _f = new();

    public void Dispose()
    {
        _f.Dispose();
        GC.SuppressFinalize(this);
    }

    private async Task<JsonElement> Paths()
    {
        using var http = _f.CreateClient();
        var doc = JsonDocument.Parse(await http.GetStringAsync("/swagger/v1/swagger.json")).RootElement.Clone();
        return doc.GetProperty("paths");
    }

    public static TheoryData<string, string> Routes => new()
    {
        { "get", "/api/v1/bookings/{number}/party" },
        { "get", "/api/v1/users/{id}/profile" },
        { "put", "/api/v1/users/{id}/profile" },
        { "get", "/api/v1/me/helper" },
        { "put", "/api/v1/me/helper" },
        { "delete", "/api/v1/me/helper" },
        { "get", "/api/v1/me/history" },
        { "get", "/api/v1/trips" },
        { "get", "/api/v1/trips/{number}" },
        { "post", "/api/v1/trips/link" },
        { "get", "/api/v1/bookings/{number}" },
        { "get", "/api/v1/sailings" },
        { "get", "/api/v1/bookings/{number}/payments" },
        { "post", "/api/v1/me/cards" },
        { "delete", "/api/v1/me/cards/{id}" },
        { "post", "/api/v1/bookings/{number}/payments/balance" },
        { "get", "/api/v1/bookings/{number}/documents" },
        { "put", "/api/v1/users/{id}/documents/{doc}" },
        { "delete", "/api/v1/users/{id}/documents/{doc}" },
        { "get", "/api/v1/me/notifications" },
        { "post", "/api/v1/me/notifications/read" },
        { "put", "/api/v1/me/notification-prefs" },
        { "get", "/api/v1/me/support-tickets" },
        { "post", "/api/v1/me/support-tickets" },
        { "get", "/api/v1/help/contacts" },
        { "get", "/api/v1/bookings/{number}/privacy" },
        { "put", "/api/v1/users/{id}/consents/{consent}" },
        { "get", "/api/v1/bookings/{number}/budget" },
        { "put", "/api/v1/bookings/{number}/budget" },
        { "get", "/api/v1/me/feedback" },
        { "post", "/api/v1/me/feedback" },
        { "get", "/api/v1/me/favourites" },
        { "post", "/api/v1/me/favourites/toggle" },
    };

    /// <summary>Phase 8 (data model 6.3, plan group); all of them need a sign-in.</summary>
    public static TheoryData<string, string> PlanRoutes => new()
    {
        { "get", "/api/v1/bookings/{number}/plan" },
        { "get", "/api/v1/bookings/{number}/excursions" },
        { "put", "/api/v1/bookings/{number}/excursions/cart/{excursionId}" },
        { "delete", "/api/v1/bookings/{number}/excursions/cart/{excursionId}" },
        { "post", "/api/v1/bookings/{number}/excursions/checkout" },
        { "put", "/api/v1/bookings/{number}/excursions/bookings/{id}" },
        { "delete", "/api/v1/bookings/{number}/excursions/bookings/{id}" },
        { "get", "/api/v1/bookings/{number}/dining" },
        { "get", "/api/v1/bookings/{number}/dining/slots" },
        { "post", "/api/v1/bookings/{number}/dining/reservations" },
        { "delete", "/api/v1/bookings/{number}/dining/reservations/{id}" },
        { "post", "/api/v1/bookings/{number}/dining/reservations/{id}/move" },
        { "post", "/api/v1/bookings/{number}/dining/reservations/{id}/late" },
        { "get", "/api/v1/bookings/{number}/packages" },
        { "post", "/api/v1/bookings/{number}/packages/purchases" },
        { "post", "/api/v1/bookings/{number}/packages/purchases/{id}/claim-drop" },
        { "delete", "/api/v1/bookings/{number}/packages/purchases/{id}" },
        { "get", "/api/v1/bookings/{number}/checklist" },
        { "put", "/api/v1/bookings/{number}/checklist/{id}" },
        { "get", "/api/v1/bookings/{number}/packing" },
        { "put", "/api/v1/bookings/{number}/packing/{id}" },
        { "get", "/api/v1/bookings/{number}/travel" },
        { "put", "/api/v1/bookings/{number}/travel" },
        { "get", "/api/v1/bookings/{number}/assistance" },
        { "post", "/api/v1/bookings/{number}/assistance" },
        { "delete", "/api/v1/bookings/{number}/assistance/{id}" },
    };

    [Theory]
    [MemberData(nameof(PlanRoutes))]
    public async Task EveryPhaseEightRouteIsDocumented(string verb, string route)
    {
        var paths = await Paths();
        Assert.True(paths.TryGetProperty(route, out var path), $"{route} is missing from the OpenAPI document");
        Assert.True(path.TryGetProperty(verb, out var op), $"{verb.ToUpperInvariant()} {route} is missing");
        Assert.False(string.IsNullOrWhiteSpace(op.GetProperty("summary").GetString()));
    }

    [Fact]
    public async Task PlanRoutesRefuseAnonymousCallers()
    {
        using var http = _f.CreateClient();
        foreach (var (verb, route) in PlanRoutes.Select(r => ((string)r[0], (string)r[1])))
        {
            var url = route.Replace("{number}", "PC243902").Replace("{id}", Guid.NewGuid().ToString()).Replace("{excursionId}", "coz-snorkel");
            var res = await http.SendAsync(new HttpRequestMessage(new HttpMethod(verb.ToUpperInvariant()), url));
            Assert.True(res.StatusCode == System.Net.HttpStatusCode.Unauthorized, $"{verb.ToUpperInvariant()} {route} answered {(int)res.StatusCode} without a token");
        }
    }

    /// <summary>Phase 7 (data model 6.2); the first five are public.</summary>
    public static TheoryData<string, string> BookingRoutes => new()
    {
        { "get", "/api/v1/sailings/offers" },
        { "get", "/api/v1/sailings/bookable" },
        { "get", "/api/v1/sailings/{id}/quote" },
        { "get", "/api/v1/sailings/{id}/rooms" },
        { "get", "/api/v1/sailings/{id}/cabins" },
        { "post", "/api/v1/booking/fares" },
        { "post", "/api/v1/booking/quote" },
        { "get", "/api/v1/me/booking-prefill" },
        { "get", "/api/v1/me/draft" },
        { "put", "/api/v1/me/draft" },
        { "delete", "/api/v1/me/draft" },
        { "post", "/api/v1/me/draft/resume-link" },
        { "post", "/api/v1/bookings" },
        { "get", "/api/v1/bookings/{number}/detail" },
        { "post", "/api/v1/bookings/{number}/pay-balance" },
        { "get", "/api/v1/bookings/{number}/change" },
        { "post", "/api/v1/bookings/{number}/change" },
        { "post", "/api/v1/bookings/{number}/cancel" },
    };

    [Theory]
    [MemberData(nameof(BookingRoutes))]
    public async Task EveryPhaseSevenRouteIsDocumented(string verb, string route)
    {
        var paths = await Paths();
        Assert.True(paths.TryGetProperty(route, out var path), $"{route} is missing from the OpenAPI document");
        Assert.True(path.TryGetProperty(verb, out var op), $"{verb.ToUpperInvariant()} {route} is missing");
        Assert.False(string.IsNullOrWhiteSpace(op.GetProperty("summary").GetString()));
    }

    [Fact]
    public async Task OnlyDiscoverIsOpenToTheWorldAndBookingNeedsASignIn()
    {
        using var http = _f.CreateClient();
        foreach (var (verb, route) in BookingRoutes.Select(r => ((string)r[0], (string)r[1])))
        {
            var url = route.Replace("{number}", "PC243902").Replace("{id}", "sun-2027-03-21");
            var res = await http.SendAsync(new HttpRequestMessage(new HttpMethod(verb.ToUpperInvariant()), url));
            var isPublic = route.StartsWith("/api/v1/sailings/");
            Assert.True(isPublic ? res.StatusCode != System.Net.HttpStatusCode.Unauthorized : res.StatusCode == System.Net.HttpStatusCode.Unauthorized,
                $"{verb.ToUpperInvariant()} {route} answered {(int)res.StatusCode}");
        }
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task EveryPhaseSixRouteIsDocumented(string verb, string route)
    {
        var paths = await Paths();
        Assert.True(paths.TryGetProperty(route, out var path), $"{route} is missing from the OpenAPI document");
        Assert.True(path.TryGetProperty(verb, out var op), $"{verb.ToUpperInvariant()} {route} is missing");
        Assert.False(string.IsNullOrWhiteSpace(op.GetProperty("summary").GetString()));
    }

    [Fact]
    public async Task OnlySailingsAndHelpContactsAreOpenToTheWorld()
    {
        // Anonymous endpoints must work without a token; every other new route must refuse one.
        using var http = _f.CreateClient();
        Assert.Equal(System.Net.HttpStatusCode.OK, (await http.GetAsync("/api/v1/sailings")).StatusCode);
        Assert.Equal(System.Net.HttpStatusCode.OK, (await http.GetAsync("/api/v1/help/contacts")).StatusCode);
        foreach (var (verb, route) in Routes.Select(r => ((string)r[0], (string)r[1])).Where(r => r.Item2 is not ("/api/v1/sailings" or "/api/v1/help/contacts")))
        {
            var url = route.Replace("{number}", "PC243902").Replace("{id}", Guid.NewGuid().ToString()).Replace("{doc}", "passport").Replace("{consent}", "improve");
            var res = await http.SendAsync(new HttpRequestMessage(new HttpMethod(verb.ToUpperInvariant()), url));
            Assert.True(res.StatusCode == System.Net.HttpStatusCode.Unauthorized, $"{verb.ToUpperInvariant()} {route} answered {(int)res.StatusCode} without a token");
        }
    }
}
