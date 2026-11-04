using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Princess.Api.Data;

namespace Princess.Api.Domain;

public sealed record CatalogueRegionDto(string Id, string Name);

public sealed record CatalogueShipSummaryDto(string Id, string Name, string Class, string Depth, int Decks, int Tonnage, int Capacity, int? LengthFt, int? BeamFt, int? Crew, int? Staterooms, int? Entered, string HomeZone, string Intro, JsonElement Profile);

public sealed record CatalogueDeckDto(int Number, string Name, string Summary);

public sealed record CatalogueVenueDto(string Id, string Kind, string Name, string Cuisine, int Deck);

public sealed record CatalogueCategoryDto(string Id, string Name, bool Suite, int Capacity, int SizeSqFt, string Description);

public sealed record CatalogueShipDto(CatalogueShipSummaryDto Ship, IReadOnlyList<CatalogueDeckDto> Decks, IReadOnlyList<CatalogueVenueDto> Venues, IReadOnlyList<CatalogueCategoryDto> Categories);

public sealed record CataloguePortDto(string Id, string Name, string Country, string? CountryCode, string? Region, string Zone, bool Tender, double? Lat, double? Lon, string? Currency, JsonElement Languages, string? Tier, string GuideStatus, string? ArtId);

public sealed record CataloguePatternDayDto(int Day, string Port, string? Arrive, string? AllAboard, string? Depart, int? ClockChangeHours, string? ClockChangeAt);

public sealed record CataloguePatternDto(string Id, string Name, string Region, int Nights, string StartPort, string EndPort, string Description, IReadOnlyList<CataloguePatternDayDto> Days);

public sealed record CatalogueLegDto(int Leg, string Pattern, int StartDay);

/// <summary>One sailing in the catalogue. <c>FromCents</c> is the cheapest fare for two sharing times the nights, per person, before taxes (null when the sailing has no fares).</summary>
public sealed record CatalogueSailingDto(string Id, string Ship, string Departure, int Nights, string Title, string? Region, string? StartPort, string? EndPort, IReadOnlyList<CatalogueLegDto> Legs, bool Holiday, bool BookingOpen, string DataStatus, long? FromCents);

public sealed record CatalogueItineraryDayDto(int Day, string Date, string Port, string? Arrive, string? AllAboard, string? Depart, int? ClockChangeHours, string? ClockChangeAt, string? Dress, string? ShipZone = null);

public sealed record CatalogueItineraryDto(string Version, string Sailing, string Ship, int Nights, IReadOnlyList<CatalogueItineraryDayDto> Days);

public sealed record CatalogueListDto<T>(string Version, IReadOnlyList<T> Items);

/// <summary>Query filters for the sailings list. Dates are <c>yyyy-MM-dd</c>; every filter is optional.</summary>
public sealed record SailingFilter(string? Ship, string? Region, string? From, string? To, int? NightsMin, int? NightsMax, string? Port)
{
    public static readonly SailingFilter None = new(null, null, null, null, null, null, null);

    /// <summary>Whether the values are usable: ids are short slugs, dates parse, nights are positive and in order.</summary>
    public bool Valid() =>
        Slug(Ship) && Slug(Region) && Slug(Port) && Date(From) && Date(To)
        && (NightsMin is null or > 0 and <= 365) && (NightsMax is null or > 0 and <= 365) && (NightsMin is null || NightsMax is null || NightsMin <= NightsMax);

    private static bool Slug(string? s) => s is null || (s.Length is > 0 and <= 40 && s.All(c => char.IsAsciiLetterOrDigit(c) || c == '-'));
    private static bool Date(string? s) => s is null || DateOnly.TryParseExact(s, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
}

/// <summary>Pure shaping of the catalogue tables into the served shapes, so it can be tested without a database.</summary>
public static class ShipCatalogueRules
{
    private static readonly JsonSerializerOptions Hash = new(JsonSerializerDefaults.Web);

    public static string VersionOf(object content) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(content, Hash)))).ToLowerInvariant()[..16];

    private static string? Hm(TimeSpan? t) => t is { } v ? $"{v.Hours:00}:{v.Minutes:00}" : null;
    private static string Iso(DateTime d) => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static JsonElement Json(string? text, string fallback)
    {
        try { return JsonDocument.Parse(string.IsNullOrWhiteSpace(text) ? fallback : text).RootElement.Clone(); }
        catch (JsonException) { return JsonDocument.Parse(fallback).RootElement.Clone(); }
    }

    public static CatalogueListDto<CatalogueRegionDto> Regions(CatalogueSnapshot s)
    {
        var items = s.Regions.Select(r => new CatalogueRegionDto(r.Id, r.Name)).ToList();
        return new(VersionOf(items), items);
    }

    private static CatalogueShipSummaryDto ShipSummary(CatalogueShipRow r) =>
        new(r.Id, r.Name, r.Class, r.Depth, r.Decks, r.Tonnage, r.Capacity, r.LengthFt, r.BeamFt, r.Crew, r.Staterooms, r.Entered, r.HomeZone, r.Intro, Json(r.ProfileJson, "{}"));

    public static CatalogueListDto<CatalogueShipSummaryDto> Ships(CatalogueSnapshot s)
    {
        var items = s.Ships.Select(ShipSummary).ToList();
        return new(VersionOf(items), items);
    }

    /// <summary>One ship with its deck list, venue list and stateroom categories (browse depth). Null for an unknown id.</summary>
    public static CatalogueShipDto? Ship(CatalogueSnapshot s, string id)
    {
        var row = s.Ships.FirstOrDefault(x => x.Id == id);
        if (row is null) return null;
        return new(ShipSummary(row),
            [.. s.Decks.Where(d => d.ShipId == id).Select(d => new CatalogueDeckDto(d.Number, d.Name, d.Summary))],
            [.. s.Venues.Where(v => v.ShipId == id).Select(v => new CatalogueVenueDto(v.Id, v.Kind, v.Name, v.Cuisine, v.Deck))],
            [.. s.Categories.Where(c => c.ShipId == id).Select(c => new CatalogueCategoryDto(c.Id, c.Name, c.IsSuite, c.Capacity, c.SizeSqFt, c.Description))]);
    }

    public static CatalogueListDto<CataloguePortDto> Ports(CatalogueSnapshot s)
    {
        var items = s.Ports.Select(p => new CataloguePortDto(p.Id, p.Name, p.Country, p.CountryCode, p.RegionId, p.TimeZone, p.Tender,
            p.Lat is { } la ? (double)la : null, p.Lon is { } lo ? (double)lo : null, p.Currency, Json(p.Languages, "[]"), p.Tier, p.GuideStatus, p.ArtId)).ToList();
        return new(VersionOf(items), items);
    }

    public static CatalogueListDto<CataloguePatternDto> Patterns(CatalogueSnapshot s)
    {
        var days = s.PatternDays.ToLookup(d => d.OwnerId);
        var items = s.Patterns.Select(p => new CataloguePatternDto(p.Id, p.Name, p.RegionId, p.Nights, p.StartPortId, p.EndPortId, p.Description,
            [.. days[p.Id].OrderBy(d => d.Day).Select(d => new CataloguePatternDayDto(d.Day, d.PortId, Hm(d.ArriveLocal), Hm(d.AllAboardLocal), Hm(d.DepartLocal), d.ClockChangeHours, Hm(d.ClockChangeAtLocal)))])).ToList();
        return new(VersionOf(items), items);
    }

    /// <summary>The sailings that pass the filter, soonest first. <c>Port</c> matches any day of the route, not just the start and end.</summary>
    public static List<CatalogueSailingDto> Sailings(CatalogueSnapshot s, SailingFilter f)
    {
        var legs = s.Legs.ToLookup(l => l.SailingId);
        var ports = s.SailingDays.Where(d => f.Port is not null && d.PortId == f.Port).Select(d => d.OwnerId).ToHashSet();
        var cheapest = s.Fares.GroupBy(x => x.SailingId).ToDictionary(g => g.Key, g => g.Min(x => x.PerNightCents));
        var from = f.From is null ? (DateTime?)null : DateTime.ParseExact(f.From, "yyyy-MM-dd", CultureInfo.InvariantCulture);
        var to = f.To is null ? (DateTime?)null : DateTime.ParseExact(f.To, "yyyy-MM-dd", CultureInfo.InvariantCulture);
        return s.Sailings
            .Where(x => (f.Ship is null || x.ShipId == f.Ship) && (f.Region is null || x.RegionId == f.Region)
                && (from is null || x.Departure.Date >= from) && (to is null || x.Departure.Date <= to)
                && (f.NightsMin is null || x.Nights >= f.NightsMin) && (f.NightsMax is null || x.Nights <= f.NightsMax)
                && (f.Port is null || ports.Contains(x.Id) || x.StartPortId == f.Port || x.EndPortId == f.Port))
            .OrderBy(x => x.Departure).ThenBy(x => x.Id, StringComparer.Ordinal)
            .Select(x => new CatalogueSailingDto(x.Id, x.ShipId, Iso(x.Departure), x.Nights, x.Title, x.RegionId, x.StartPortId, x.EndPortId,
                [.. legs[x.Id].OrderBy(l => l.LegNo).Select(l => new CatalogueLegDto(l.LegNo, l.PatternId, l.StartDay))],
                x.IsHoliday, x.BookingOpen, x.DataStatus, cheapest.TryGetValue(x.Id, out var n) ? n * x.Nights : null))
            .ToList();
    }

    /// <summary>The days of one sailing with ports, times, clock changes, the zone the ship's clocks follow each day (when a <paramref name="timeline"/> is given) and the dress code for the evening. Null for an unknown id.</summary>
    public static CatalogueItineraryDto? ItineraryOf(CatalogueSnapshot s, string sailingId, Timeline? timeline = null)
    {
        var sailing = s.Sailings.FirstOrDefault(x => x.Id == sailingId);
        if (sailing is null) return null;
        var dress = s.Dress.Where(d => d.SailingId == sailingId).ToDictionary(d => d.Day, d => d.Code);
        var days = s.SailingDays.Where(d => d.OwnerId == sailingId).OrderBy(d => d.Day)
            .Select(d => new CatalogueItineraryDayDto(d.Day, Iso(d.Date ?? sailing.Departure.AddDays(d.Day - 1)), d.PortId, Hm(d.ArriveLocal), Hm(d.AllAboardLocal), Hm(d.DepartLocal),
                d.ClockChangeHours, Hm(d.ClockChangeAtLocal), dress.GetValueOrDefault(d.Day), timeline?.ShipZoneOnDate(DateOnly.FromDateTime(d.Date ?? sailing.Departure.AddDays(d.Day - 1))))).ToList();
        return new(VersionOf(days), sailing.Id, sailing.ShipId, sailing.Nights, days);
    }

    /// <summary>The version string for the extended sailings list, covering the entries as well as the legacy fields.</summary>
    public static string SailingsVersion(string legacy, IReadOnlyList<CatalogueSailingDto> entries) => VersionOf(new { legacy, entries });
}
