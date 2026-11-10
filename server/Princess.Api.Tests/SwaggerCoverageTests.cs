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
        { "post", "/api/v1/me/helper/accept" },
        { "post", "/api/v1/me/helper/code" },
        { "delete", "/api/v1/me/helper" },
        { "get", "/api/v1/me/history" },
        { "get", "/api/v1/me/export" },
        { "get", "/api/v1/rates" },
        { "get", "/api/v1/reference/access" },
        { "get", "/api/v1/reference/sailings" },
        { "get", "/api/v1/reference/ship" },
        { "get", "/api/v1/reference/ships/{id}/aboard" },
        { "get", "/api/v1/reference/ships/{id}/venues" },
        { "get", "/api/v1/reference/ships/{id}/program" },
        { "get", "/api/v1/reference/program" },
        { "get", "/api/v1/reference/ports" },
        { "get", "/api/v1/reference/packages" },
        { "get", "/api/v1/reference/limits" },
        { "get", "/api/v1/reference/pricing" },
        { "get", "/api/v1/reference/content" },
        { "get", "/api/v1/feeds/sky" },
        { "get", "/api/v1/feeds/flight" },
        { "get", "/api/v1/feeds/route" },
        { "get", "/api/v1/reference/catalogue" },
        { "get", "/api/v1/feeds/port-crowd" },
        { "get", "/api/v1/feeds/fares" },
        { "get", "/api/v1/feeds/pulse" },
        { "get", "/api/v1/feeds/storm" },
        { "get", "/api/v1/feeds/sky-night" },
        { "get", "/api/v1/feeds/ship-position" },
        { "get", "/api/v1/feeds/sea-conditions" },
        { "get", "/api/v1/feeds/along-the-way" },
        { "get", "/api/v1/feeds/ship-weather" },
        { "get", "/api/v1/feeds/ship-nautical" },
        { "get", "/api/v1/feeds/loungers" },
        { "get", "/api/v1/feeds/sightings" },
        { "get", "/api/v1/feeds/found" },
        { "get", "/api/v1/feeds/watch-opening" },
        { "get", "/api/v1/feeds/sailing-quality" },
        { "get", "/api/v1/feeds/friend-reply" },
        { "get", "/api/v1/feeds/embark-queue" },
        { "get", "/api/v1/feeds/pulse-day" },
        { "post", "/api/v1/telemetry" },
        { "post", "/api/v1/me/stanley" },
        { "get", "/api/v1/me/stanley/status" },
        { "get", "/api/v1/me/stanley/facts" },
        { "get", "/api/v1/me/stanley/tiers" },
        { "post", "/api/v1/me/stanley/actions/prepare" },
        { "post", "/api/v1/me/stanley/actions/{id}/confirm" },
        { "get", "/api/v1/me/stanley/actions/{id}" },
        { "post", "/api/v1/me/stanley/actions/{id}/undo" },
        { "get", "/api/v1/me/stanley/receipts" },
        { "post", "/api/v1/me/stanley/handoffs" },
        { "get", "/api/v1/me/stanley/handoffs" },
        { "get", "/api/v1/me/stanley/handoffs/{id}" },
        { "get", "/api/v1/me/stanley/memory" },
        { "put", "/api/v1/me/stanley/memory/items" },
        { "patch", "/api/v1/me/stanley/memory/items/{id}" },
        { "delete", "/api/v1/me/stanley/memory/items/{id}" },
        { "delete", "/api/v1/me/stanley/memory" },
        { "put", "/api/v1/me/stanley/memory/settings" },
        { "post", "/api/v1/stanley/discover/interview" },
        { "post", "/api/v1/stanley/discover/directions" },
        { "post", "/api/v1/stanley/discover/compare" },
        { "post", "/api/v1/stanley/discover/booking-check" },
        { "post", "/api/v1/me/stanley/plan/shape" },
        { "post", "/api/v1/me/stanley/plan/hour" },
        { "post", "/api/v1/me/stanley/plan/evening" },
        { "post", "/api/v1/me/stanley/plan/preview" },
        { "post", "/api/v1/me/stanley/plan/meeting" },
        { "post", "/api/v1/me/stanley/plan/compare-tours" },
        { "get", "/api/v1/me/stanley/travel/flight" },
        { "post", "/api/v1/me/stanley/travel/traffic" },
        { "post", "/api/v1/me/stanley/travel/port" },
        { "post", "/api/v1/me/stanley/travel/phrases" },
        { "post", "/api/v1/me/stanley/travel/port-pack" },
        { "post", "/api/v1/me/stanley/travel/read" },
        { "post", "/api/v1/me/stanley/travel/connection" },
        { "post", "/api/v1/me/stanley/travel/embark-tour" },
        { "get", "/api/v1/me/stanley/travel/entry" },
        { "get", "/api/v1/me/stanley/changes" },
        { "get", "/api/v1/me/stanley/changes/missed" },
        { "post", "/api/v1/me/stanley/changes/caught-up" },
        { "post", "/api/v1/me/stanley/changes/deliver" },
        { "get", "/api/v1/me/stanley/changes/{id}/explain" },
        { "post", "/api/v1/me/stanley/changes/{id}/dismiss" },
        { "post", "/api/v1/stanley/group/status" },
        { "get", "/api/v1/me/stanley/travellers" },
        { "put", "/api/v1/me/stanley/travellers/{id}" },
        { "delete", "/api/v1/me/stanley/travellers/{id}" },
        { "get", "/api/v1/me/stanley/discover/brief" },
        { "put", "/api/v1/me/stanley/discover/brief" },
        { "delete", "/api/v1/me/stanley/discover/brief" },
        { "get", "/api/v1/me/stanley/discover/brief/share" },
        { "post", "/api/v1/me/staff-requests" },
        { "get", "/api/v1/me/staff-requests" },
        { "delete", "/api/v1/me/staff-requests/{id}" },
        { "post", "/api/v1/me/autopilot/plan" },
        { "post", "/api/v1/me/day-plan" },
        { "post", "/api/v1/me/family-links" },
        { "delete", "/api/v1/me/family-links/{id}" },
        { "delete", "/api/v1/me/family-links" },
        { "post", "/api/v1/me/family-postcards" },
        { "put", "/api/v1/me/family-recap" },
        { "delete", "/api/v1/me/family-recap" },
        { "post", "/api/v1/public/trial-day" },
        { "post", "/api/v1/me/media" },
        { "get", "/api/v1/me/media" },
        { "get", "/api/v1/me/media/usage" },
        { "delete", "/api/v1/me/media/{id}" },
        { "get", "/api/v1/media/{id}" },
        { "get", "/api/v1/cabin-photos/{category}" },
        { "get", "/api/v1/public/family/{token}/photos/{id}" },
        { "get", "/api/v1/bookings/{number}/port-rows" },
        { "post", "/api/v1/bookings/{number}/port-rows" },
        { "get", "/api/v1/me/context" },
        { "post", "/api/v1/me/journey/events" },
        { "get", "/api/v1/auth/demo-accounts" },
        { "get", "/api/v1/demo/state" },
        { "put", "/api/v1/demo/state" },
        { "delete", "/api/v1/me/state" },
        { "get", "/api/v1/trips" },
        { "get", "/api/v1/trips/{number}" },
        { "post", "/api/v1/trips/link" },
        { "get", "/api/v1/bookings/{number}" },
        { "get", "/api/v1/sailings" },
        { "get", "/api/v1/bookings/{number}/payments" },
        { "post", "/api/v1/me/cards" },
        { "delete", "/api/v1/me/cards/{id}" },
        { "post", "/api/v1/bookings/{number}/payments/balance" },
        { "get", "/api/v1/me/helping" },
        { "delete", "/api/v1/me/helping/{guestId}" },
        { "get", "/api/v1/guests/{guestId}/bookings/{number}/payments" },
        { "get", "/api/v1/guests/{guestId}/bookings/{number}/folio" },
        { "get", "/api/v1/guests/{guestId}/bookings/{number}/checkin/status" },
        { "get", "/api/v1/guests/{guestId}/bookings/{number}/trip" },
        { "post", "/api/v1/guests/{guestId}/bookings/{number}/payments/balance" },
        { "get", "/api/v1/bookings/{number}/documents" },
        { "put", "/api/v1/users/{id}/documents/{doc}" },
        { "delete", "/api/v1/users/{id}/documents/{doc}" },
        { "get", "/api/v1/me/notifications" },
        { "post", "/api/v1/me/notifications/read" },
        { "put", "/api/v1/me/notification-prefs" },
        { "get", "/api/v1/me/support-tickets" },
        { "post", "/api/v1/me/support-tickets" },
        { "get", "/api/v1/help/contacts" },
        { "get", "/api/v1/help/status" },
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
        { "post", "/api/v1/bookings/{number}/packing" },
        { "delete", "/api/v1/bookings/{number}/packing/{id}" },
        { "put", "/api/v1/bookings/{number}/packing/{id}/hidden" },
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

    /// <summary>Phase 8b (data model 6.3, waits, shows and ahead groups); all of them need a sign-in.</summary>
    public static TheoryData<string, string> AheadRoutes => new()
    {
        { "get", "/api/v1/bookings/{number}/waits" },
        { "post", "/api/v1/bookings/{number}/waits/queue" },
        { "delete", "/api/v1/bookings/{number}/waits/queue/{id}" },
        { "post", "/api/v1/bookings/{number}/waits/waitlist" },
        { "delete", "/api/v1/bookings/{number}/waits/waitlist/{id}" },
        { "post", "/api/v1/bookings/{number}/waits/waitlist/{id}/accept" },
        { "get", "/api/v1/bookings/{number}/shows" },
        { "get", "/api/v1/bookings/{number}/shows/tickets" },
        { "post", "/api/v1/bookings/{number}/shows/tickets" },
        { "delete", "/api/v1/bookings/{number}/shows/tickets/{id}" },
        { "get", "/api/v1/bookings/{number}/upgrades" },
        { "post", "/api/v1/bookings/{number}/upgrades" },
        { "delete", "/api/v1/bookings/{number}/upgrades/{id}" },
        { "get", "/api/v1/bookings/{number}/clubs" },
        { "put", "/api/v1/bookings/{number}/clubs/{childId}" },
        { "delete", "/api/v1/bookings/{number}/clubs/{childId}" },
        { "get", "/api/v1/bookings/{number}/medallion" },
        { "post", "/api/v1/bookings/{number}/medallion/activate" },
        { "post", "/api/v1/bookings/{number}/medallion/lost" },
        { "get", "/api/v1/bookings/{number}/bag-tags" },
        { "put", "/api/v1/bookings/{number}/bag-tags/way" },
        { "put", "/api/v1/bookings/{number}/bag-tags/handed-over" },
        { "get", "/api/v1/bookings/{number}/prep" },
        { "put", "/api/v1/bookings/{number}/prep/{id}" },
        { "get", "/api/v1/me/advisor-requests" },
        { "post", "/api/v1/me/advisor-requests" },
        { "get", "/api/v1/me/marketing" },
        { "post", "/api/v1/me/marketing/{channel}/subscribe" },
        { "post", "/api/v1/me/marketing/{channel}/confirm" },
        { "delete", "/api/v1/me/marketing/{channel}" },
        { "get", "/api/v1/me/loyalty" },
        { "get", "/api/v1/me/fix-cases" },
        { "post", "/api/v1/me/fix-cases" },
        { "get", "/api/v1/me/assist-cases" },
        { "post", "/api/v1/me/assist-cases" },
        { "post", "/api/v1/me/assist-cases/{id}/choice" },
    };

    [Theory]
    [MemberData(nameof(AheadRoutes))]
    public async Task EveryPhaseEightBRouteIsDocumented(string verb, string route)
    {
        var paths = await Paths();
        Assert.True(paths.TryGetProperty(route, out var path), $"{route} is missing from the OpenAPI document");
        Assert.True(path.TryGetProperty(verb, out var op), $"{verb.ToUpperInvariant()} {route} is missing");
        Assert.False(string.IsNullOrWhiteSpace(op.GetProperty("summary").GetString()));
    }

    [Fact]
    public async Task AheadRoutesRefuseAnonymousCallers()
    {
        using var http = _f.CreateClient();
        foreach (var (verb, route) in AheadRoutes.Select(r => ((string)r[0], (string)r[1])))
        {
            var url = route.Replace("{number}", "PC243902").Replace("{id}", Guid.NewGuid().ToString()).Replace("{childId}", Guid.NewGuid().ToString()).Replace("{channel}", "email");
            var res = await http.SendAsync(new HttpRequestMessage(new HttpMethod(verb.ToUpperInvariant()), url));
            Assert.True(res.StatusCode == System.Net.HttpStatusCode.Unauthorized, $"{verb.ToUpperInvariant()} {route} answered {(int)res.StatusCode} without a token");
        }
    }

    /// <summary>Phase 9 (data model 6.4, check-in and boarding); all need a sign-in except the pass lookup.</summary>
    public static TheoryData<string, string> CheckinRoutes => new()
    {
        { "get", "/api/v1/bookings/{number}/checkin" },
        { "get", "/api/v1/bookings/{number}/checkin/status" },
        { "get", "/api/v1/bookings/{number}/checkin/receipt" },
        { "put", "/api/v1/bookings/{number}/checkin/steps/{step}" },
        { "post", "/api/v1/bookings/{number}/checkin/submit" },
        { "get", "/api/v1/bookings/{number}/boarding" },
        { "post", "/api/v1/bookings/{number}/boarding/wallet" },
        { "get", "/api/v1/bookings/{number}/embark" },
        { "put", "/api/v1/bookings/{number}/embark/companion/{id}" },
        { "put", "/api/v1/bookings/{number}/embark/carry-on/{id}" },
        { "put", "/api/v1/bookings/{number}/embark/bags" },
    };

    [Theory]
    [MemberData(nameof(CheckinRoutes))]
    public async Task EveryPhaseNineRouteIsDocumented(string verb, string route)
    {
        var paths = await Paths();
        Assert.True(paths.TryGetProperty(route, out var path), $"{route} is missing from the OpenAPI document");
        Assert.True(path.TryGetProperty(verb, out var op), $"{verb.ToUpperInvariant()} {route} is missing");
        Assert.False(string.IsNullOrWhiteSpace(op.GetProperty("summary").GetString()));
    }

    /// <summary>Phase 10a (data model 6.5, the on-board day and Guest Services chat); all need a sign-in.</summary>
    public static TheoryData<string, string> OnboardRoutes => new()
    {
        { "get", "/api/v1/bookings/{number}/onboard/today" },
        { "get", "/api/v1/bookings/{number}/onboard/port" },
        { "get", "/api/v1/bookings/{number}/onboard/program/{day}" },
        { "put", "/api/v1/bookings/{number}/onboard/plan/{eventId}" },
        { "get", "/api/v1/bookings/{number}/onboard/port-day" },
        { "get", "/api/v1/bookings/{number}/onboard/muster" },
        { "post", "/api/v1/bookings/{number}/onboard/muster" },
        { "get", "/api/v1/bookings/{number}/onboard/emergency" },
        { "get", "/api/v1/bookings/{number}/onboard/folio" },
        { "get", "/api/v1/bookings/{number}/entitlements" },
        { "get", "/api/v1/bookings/{number}/service/channels" },
        { "get", "/api/v1/bookings/{number}/service/{channel}" },
        { "post", "/api/v1/bookings/{number}/service/{channel}" },
        { "post", "/api/v1/bookings/{number}/service/{channel}/escalate" },
    };

    [Theory]
    [MemberData(nameof(OnboardRoutes))]
    public async Task EveryPhaseTenARouteIsDocumented(string verb, string route)
    {
        var paths = await Paths();
        Assert.True(paths.TryGetProperty(route, out var path), $"{route} is missing from the OpenAPI document");
        Assert.True(path.TryGetProperty(verb, out var op), $"{verb.ToUpperInvariant()} {route} is missing");
        Assert.False(string.IsNullOrWhiteSpace(op.GetProperty("summary").GetString()));
    }

    [Fact]
    public async Task OnboardRoutesRefuseAnonymousCallers()
    {
        using var http = _f.CreateClient();
        foreach (var (verb, route) in OnboardRoutes.Select(r => ((string)r[0], (string)r[1])))
        {
            var url = route.Replace("{number}", "PC243902").Replace("{day}", "2").Replace("{eventId}", "trivia").Replace("{channel}", "dining");
            var res = await http.SendAsync(new HttpRequestMessage(new HttpMethod(verb.ToUpperInvariant()), url));
            Assert.True(res.StatusCode == System.Net.HttpStatusCode.Unauthorized, $"{verb.ToUpperInvariant()} {route} answered {(int)res.StatusCode} without a token");
        }
    }

    /// <summary>Phase 10b (data model 6.5: orders, family, health, stateroom, photos, laundry, Wi-Fi, trip updates); all need a sign-in.</summary>
    public static TheoryData<string, string> ShipboardRoutes => new()
    {
        { "get", "/api/v1/bookings/{number}/orders/menu" },
        { "get", "/api/v1/bookings/{number}/orders" },
        { "post", "/api/v1/bookings/{number}/orders" },
        { "post", "/api/v1/bookings/{number}/orders/{id}/resolve" },
        { "delete", "/api/v1/bookings/{number}/orders/{id}" },
        { "put", "/api/v1/bookings/{number}/orders/{id}/location" },
        { "post", "/api/v1/bookings/{number}/orders/{id}/contact" },
        { "get", "/api/v1/bookings/{number}/family" },
        { "put", "/api/v1/bookings/{number}/family/{child}/zones" },
        { "put", "/api/v1/bookings/{number}/family/{child}/auth" },
        { "post", "/api/v1/bookings/{number}/family/{child}/check-in" },
        { "post", "/api/v1/bookings/{number}/family/{child}/check-out" },
        { "put", "/api/v1/bookings/{number}/family/reunion" },
        { "get", "/api/v1/bookings/{number}/health" },
        { "post", "/api/v1/bookings/{number}/health/reports" },
        { "post", "/api/v1/bookings/{number}/health/requests" },
        { "get", "/api/v1/bookings/{number}/room" },
        { "patch", "/api/v1/bookings/{number}/room/housekeeping" },
        { "patch", "/api/v1/bookings/{number}/room/devices" },
        { "get", "/api/v1/bookings/{number}/photos" },
        { "put", "/api/v1/bookings/{number}/photos/{photoId}/favourite" },
        { "post", "/api/v1/bookings/{number}/photos/quote" },
        { "post", "/api/v1/bookings/{number}/photos/purchases" },
        { "post", "/api/v1/bookings/{number}/photos/purchases/{id}/download" },
        { "get", "/api/v1/bookings/{number}/laundry" },
        { "post", "/api/v1/bookings/{number}/laundry" },
        { "delete", "/api/v1/bookings/{number}/laundry/{id}" },
        { "get", "/api/v1/bookings/{number}/wifi" },
        { "post", "/api/v1/bookings/{number}/wifi/devices" },
        { "put", "/api/v1/bookings/{number}/wifi/devices/{id}" },
        { "delete", "/api/v1/bookings/{number}/wifi/devices/{id}" },
        { "get", "/api/v1/bookings/{number}/updates" },
        { "post", "/api/v1/bookings/{number}/updates/{id}/ack" },
    };

    /// <summary>Phase 10c (data model 6.5: on-board bookings, requests, reports, drinks, money, parties, group tables, games, TV, last-minute tours, readiness, group chat); all need a sign-in.</summary>
    public static TheoryData<string, string> AboardRoutes => new()
    {
        { "get", "/api/v1/bookings/{number}/selections" },
        { "post", "/api/v1/bookings/{number}/selections" },
        { "delete", "/api/v1/bookings/{number}/selections/{id}" },
        { "get", "/api/v1/bookings/{number}/requests" },
        { "post", "/api/v1/bookings/{number}/requests" },
        { "delete", "/api/v1/bookings/{number}/requests/{id}" },
        { "get", "/api/v1/bookings/{number}/safety-reports" },
        { "post", "/api/v1/bookings/{number}/safety-reports" },
        { "get", "/api/v1/bookings/{number}/drinks" },
        { "post", "/api/v1/bookings/{number}/drinks" },
        { "delete", "/api/v1/bookings/{number}/drinks/{id}" },
        { "get", "/api/v1/bookings/{number}/money" },
        { "post", "/api/v1/bookings/{number}/money/top-ups" },
        { "put", "/api/v1/bookings/{number}/money/pin" },
        { "post", "/api/v1/bookings/{number}/money/forgot-pin" },
        { "put", "/api/v1/bookings/{number}/money/gratuity" },
        { "put", "/api/v1/bookings/{number}/money/currency" },
        { "get", "/api/v1/bookings/{number}/parties" },
        { "post", "/api/v1/bookings/{number}/parties" },
        { "delete", "/api/v1/bookings/{number}/parties/{id}" },
        { "get", "/api/v1/bookings/{number}/dining/reservations/{reservation}/group" },
        { "post", "/api/v1/bookings/{number}/dining/reservations/{reservation}/group/friends" },
        { "delete", "/api/v1/bookings/{number}/dining/reservations/{reservation}/group/friends/{index}" },
        { "put", "/api/v1/bookings/{number}/dining/reservations/{reservation}/group/split" },
        { "get", "/api/v1/bookings/{number}/games" },
        { "put", "/api/v1/bookings/{number}/games/clues/{clue}" },
        { "put", "/api/v1/bookings/{number}/games/trivia/{question}" },
        { "put", "/api/v1/bookings/{number}/games/bingo/{n}" },
        { "get", "/api/v1/bookings/{number}/tv" },
        { "patch", "/api/v1/bookings/{number}/tv" },
        { "get", "/api/v1/bookings/{number}/last-minute" },
        { "post", "/api/v1/bookings/{number}/last-minute/{excursionId}" },
        { "get", "/api/v1/bookings/{number}/ready" },
        { "put", "/api/v1/bookings/{number}/ready/{id}" },
        { "get", "/api/v1/me/chat/messages" },
        { "post", "/api/v1/me/chat/messages" },
        { "get", "/api/v1/me/chat/receipts" },
        { "put", "/api/v1/me/chat/receipts" },
        { "post", "/api/v1/me/chat/seen" },
        { "get", "/api/v1/me/chat/blocks" },
        { "put", "/api/v1/me/chat/blocks/{id}" },
        { "post", "/api/v1/me/chat/reports" },
        { "post", "/api/v1/me/chat/photos" },
    };

    [Theory]
    [MemberData(nameof(ShipboardRoutes))]
    public async Task EveryPhaseTenBRouteIsDocumented(string verb, string route)
    {
        var paths = await Paths();
        Assert.True(paths.TryGetProperty(route, out var path), $"{route} is missing from the OpenAPI document");
        Assert.True(path.TryGetProperty(verb, out var op), $"{verb.ToUpperInvariant()} {route} is missing");
        Assert.False(string.IsNullOrWhiteSpace(op.GetProperty("summary").GetString()));
    }

    [Theory]
    [MemberData(nameof(AboardRoutes))]
    public async Task EveryPhaseTenCRouteIsDocumented(string verb, string route)
    {
        var paths = await Paths();
        Assert.True(paths.TryGetProperty(route, out var path), $"{route} is missing from the OpenAPI document");
        Assert.True(path.TryGetProperty(verb, out var op), $"{verb.ToUpperInvariant()} {route} is missing");
        Assert.False(string.IsNullOrWhiteSpace(op.GetProperty("summary").GetString()));
    }

    /// <summary>Phase 11 (data model 6.6: disembarkation, cases, the trip history, feedback, loyalty, rebooking); all need a sign-in.</summary>
    public static TheoryData<string, string> FinishRoutes => new()
    {
        { "get", "/api/v1/bookings/{number}/disembark" },
        { "put", "/api/v1/bookings/{number}/disembark/choice" },
        { "put", "/api/v1/bookings/{number}/disembark/tags" },
        { "get", "/api/v1/bookings/{number}/disembark/customs" },
        { "put", "/api/v1/bookings/{number}/disembark/customs" },
        { "get", "/api/v1/bookings/{number}/disembark/onward" },
        { "put", "/api/v1/bookings/{number}/disembark/onward" },
        { "get", "/api/v1/bookings/{number}/disembark/night" },
        { "put", "/api/v1/bookings/{number}/disembark/night/{id}" },
        { "get", "/api/v1/bookings/{number}/disembark/final-bill" },
        { "put", "/api/v1/bookings/{number}/disembark/final-bill/tip" },
        { "post", "/api/v1/bookings/{number}/disembark/final-bill/email" },
        { "get", "/api/v1/bookings/{number}/cases" },
        { "post", "/api/v1/bookings/{number}/cases" },
        { "delete", "/api/v1/bookings/{number}/cases/{id}" },
        { "get", "/api/v1/bookings/{number}/history" },
        { "get", "/api/v1/bookings/{number}/post-feedback" },
        { "put", "/api/v1/bookings/{number}/post-feedback" },
        { "get", "/api/v1/me/loyalty-summary" },
        { "get", "/api/v1/bookings/{number}/rebook" },
        { "post", "/api/v1/bookings/{number}/rebook/holds" },
        { "delete", "/api/v1/bookings/{number}/rebook/holds/{id}" },
        { "post", "/api/v1/bookings/{number}/rebook/convert-fcc" },
        { "post", "/api/v1/bookings/{number}/rebook/appointment" },
        { "delete", "/api/v1/bookings/{number}/rebook/appointment" },
    };

    [Theory]
    [MemberData(nameof(FinishRoutes))]
    public async Task EveryPhaseElevenRouteIsDocumented(string verb, string route)
    {
        var paths = await Paths();
        Assert.True(paths.TryGetProperty(route, out var path), $"{route} is missing from the OpenAPI document");
        Assert.True(path.TryGetProperty(verb, out var op), $"{verb.ToUpperInvariant()} {route} is missing");
        Assert.False(string.IsNullOrWhiteSpace(op.GetProperty("summary").GetString()));
    }

    [Fact]
    public async Task FinishRoutesRefuseAnonymousCallers()
    {
        using var http = _f.CreateClient();
        foreach (var (verb, route) in FinishRoutes.Select(r => ((string)r[0], (string)r[1])))
        {
            var url = route.Replace("{number}", "PC243902").Replace("{id}", Guid.NewGuid().ToString());
            var res = await http.SendAsync(new HttpRequestMessage(new HttpMethod(verb.ToUpperInvariant()), url));
            Assert.True(res.StatusCode == System.Net.HttpStatusCode.Unauthorized, $"{verb.ToUpperInvariant()} {route} answered {(int)res.StatusCode} without a token");
        }
    }

    [Fact]
    public async Task AboardRoutesRefuseAnonymousCallers()
    {
        using var http = _f.CreateClient();
        foreach (var (verb, route) in AboardRoutes.Select(r => ((string)r[0], (string)r[1])))
        {
            var url = route.Replace("{number}", "PC243902").Replace("{id}", Guid.NewGuid().ToString()).Replace("{reservation}", Guid.NewGuid().ToString()).Replace("{index}", "0")
                .Replace("{clue}", "h-pool").Replace("{question}", "q-ports").Replace("{n}", "5").Replace("{excursionId}", "coz-glass");
            var res = await http.SendAsync(new HttpRequestMessage(new HttpMethod(verb.ToUpperInvariant()), url));
            Assert.True(res.StatusCode == System.Net.HttpStatusCode.Unauthorized, $"{verb.ToUpperInvariant()} {route} answered {(int)res.StatusCode} without a token");
        }
    }

    [Fact]
    public async Task ShipboardRoutesRefuseAnonymousCallers()
    {
        using var http = _f.CreateClient();
        foreach (var (verb, route) in ShipboardRoutes.Select(r => ((string)r[0], (string)r[1])))
        {
            var url = route.Replace("{number}", "PC243902").Replace("{id}", Guid.NewGuid().ToString()).Replace("{child}", Guid.NewGuid().ToString()).Replace("{photoId}", "gangway");
            var res = await http.SendAsync(new HttpRequestMessage(new HttpMethod(verb.ToUpperInvariant()), url));
            Assert.True(res.StatusCode == System.Net.HttpStatusCode.Unauthorized, $"{verb.ToUpperInvariant()} {route} answered {(int)res.StatusCode} without a token");
        }
    }

    [Fact]
    public async Task CheckinRoutesRefuseAnonymousCallers()
    {
        using var http = _f.CreateClient();
        foreach (var (verb, route) in CheckinRoutes.Select(r => ((string)r[0], (string)r[1])))
        {
            var url = route.Replace("{number}", "PC243902").Replace("{step}", "confirm").Replace("{id}", "terminal");
            var res = await http.SendAsync(new HttpRequestMessage(new HttpMethod(verb.ToUpperInvariant()), url));
            Assert.True(res.StatusCode == System.Net.HttpStatusCode.Unauthorized, $"{verb.ToUpperInvariant()} {route} answered {(int)res.StatusCode} without a token");
        }
    }

    [Fact]
    public async Task ThePassLookupIsTheOnePublicCheckinRoute()
    {
        var paths = await Paths();
        var op = paths.GetProperty("/api/v1/pass/lookup").GetProperty("get");
        Assert.False(string.IsNullOrWhiteSpace(op.GetProperty("summary").GetString()));
        Assert.False(op.TryGetProperty("security", out var security) && security.GetArrayLength() > 0, "the pass lookup must not ask for a token");
        using var http = _f.CreateClient();
        Assert.NotEqual(System.Net.HttpStatusCode.Unauthorized, (await http.GetAsync("/api/v1/pass/lookup?number=PC243902&lastName=Harper")).StatusCode);
    }

    [Fact]
    public async Task TheFamilyPageIsTheOnePublicFamilyRoute()
    {
        var paths = await Paths();
        var op = paths.GetProperty("/api/v1/public/family/{token}").GetProperty("get");
        Assert.False(string.IsNullOrWhiteSpace(op.GetProperty("summary").GetString()));
        Assert.False(op.TryGetProperty("security", out var security) && security.GetArrayLength() > 0, "the family page must not ask for a token");
        using var http = _f.CreateClient();
        Assert.NotEqual(System.Net.HttpStatusCode.Unauthorized, (await http.GetAsync("/api/v1/public/family/nonsense")).StatusCode);
    }

    [Fact]
    public async Task TheTrialDayIsPublicAndSignedOutGuestsCanAskForOne()
    {
        var paths = await Paths();
        var op = paths.GetProperty("/api/v1/public/trial-day").GetProperty("post");
        Assert.False(op.TryGetProperty("security", out var security) && security.GetArrayLength() > 0, "the trial day must not ask for a token");
        using var http = _f.CreateClient();
        var bad = await http.PostAsync("/api/v1/public/trial-day", new StringContent("""{"day":1,"wish":null}""", System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, bad.StatusCode);
    }

    /// <summary>Phase 7 (data model 6.2); the first five are public.</summary>
    public static TheoryData<string, string> BookingRoutes => new()
    {
        { "get", "/api/v1/sailings/offers" },
        { "get", "/api/v1/sailings/bookable" },
        { "get", "/api/v1/sailings/{id}/quote" },
        { "get", "/api/v1/sailings/{id}/rooms" },
        { "get", "/api/v1/sailings/{id}/cabins" },
        { "get", "/api/v1/sailings/{id}/cabin-guide" },
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
        Assert.Equal(System.Net.HttpStatusCode.OK, (await http.GetAsync("/api/v1/auth/demo-accounts")).StatusCode);   // lists the seeded demo accounts outside production
        foreach (var (verb, route) in Routes.Select(r => ((string)r[0], (string)r[1])).Where(r => r.Item2 is not ("/api/v1/sailings" or "/api/v1/help/contacts" or "/api/v1/auth/demo-accounts" or "/api/v1/stanley/discover/interview" or "/api/v1/stanley/discover/directions" or "/api/v1/stanley/discover/compare" or "/api/v1/stanley/discover/booking-check" or "/api/v1/stanley/group/status")))
        {
            var url = route.Replace("{number}", "PC243902").Replace("{id}", Guid.NewGuid().ToString()).Replace("{doc}", "passport").Replace("{consent}", "improve");
            var res = await http.SendAsync(new HttpRequestMessage(new HttpMethod(verb.ToUpperInvariant()), url));
            Assert.True(res.StatusCode == System.Net.HttpStatusCode.Unauthorized, $"{verb.ToUpperInvariant()} {route} answered {(int)res.StatusCode} without a token");
        }
    }
}
