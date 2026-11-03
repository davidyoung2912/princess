using Dapper;
using Microsoft.Extensions.Caching.Memory;

namespace Princess.Api.Data;

public sealed class CatalogueRegionRow { public string Id { get; set; } = ""; public string Name { get; set; } = ""; public int SortOrder { get; set; } }

public sealed class CatalogueShipRow
{
    public string Id { get; set; } = ""; public string Name { get; set; } = ""; public string Class { get; set; } = "";
    public int Decks { get; set; } public int Tonnage { get; set; } public int Capacity { get; set; }
    public string HomeZone { get; set; } = ""; public string ProfileJson { get; set; } = "{}";
    public int? LengthFt { get; set; } public int? BeamFt { get; set; } public int? Crew { get; set; } public int? Staterooms { get; set; } public int? Entered { get; set; }
    public string Intro { get; set; } = ""; public string Depth { get; set; } = "aboard";
}

public sealed class CatalogueDeckRow { public string ShipId { get; set; } = ""; public int Number { get; set; } public string Name { get; set; } = ""; public string Summary { get; set; } = ""; }

public sealed class CatalogueVenueRow { public string ShipId { get; set; } = ""; public string Id { get; set; } = ""; public string Kind { get; set; } = ""; public string Name { get; set; } = ""; public string Cuisine { get; set; } = ""; public int Deck { get; set; } }

public sealed class CatalogueCategoryRow
{
    public string Id { get; set; } = ""; public string ShipId { get; set; } = ""; public string Name { get; set; } = ""; public bool IsSuite { get; set; }
    public int Capacity { get; set; } public int SizeSqFt { get; set; } public string Description { get; set; } = ""; public int SortOrder { get; set; }
}

public sealed class CataloguePortRow
{
    public string Id { get; set; } = ""; public string Name { get; set; } = ""; public string Country { get; set; } = ""; public string? CountryCode { get; set; }
    public string? RegionId { get; set; } public string TimeZone { get; set; } = ""; public bool Tender { get; set; }
    public decimal? Lat { get; set; } public decimal? Lon { get; set; } public string? Currency { get; set; } public string Languages { get; set; } = "[]";
    public string? Tier { get; set; } public string GuideStatus { get; set; } = "none"; public string? ArtId { get; set; }
}

public sealed class CataloguePatternRow
{
    public string Id { get; set; } = ""; public string Name { get; set; } = ""; public string RegionId { get; set; } = ""; public int Nights { get; set; }
    public string StartPortId { get; set; } = ""; public string EndPortId { get; set; } = ""; public string Description { get; set; } = "";
}

/// <summary>One day of a pattern or of a sailing. Times are local to the port (the ship's clock on a sea day).</summary>
public sealed class CatalogueDayRow
{
    public string OwnerId { get; set; } = ""; public int Day { get; set; } public DateTime? Date { get; set; } public string PortId { get; set; } = "";
    public TimeSpan? ArriveLocal { get; set; } public TimeSpan? DepartLocal { get; set; } public TimeSpan? AllAboardLocal { get; set; }
    public int? ClockChangeHours { get; set; } public TimeSpan? ClockChangeAtLocal { get; set; }
}

public sealed class CatalogueSailingRow
{
    public string Id { get; set; } = ""; public string ShipId { get; set; } = ""; public DateTime Departure { get; set; } public int Nights { get; set; }
    public string Title { get; set; } = ""; public bool IsHoliday { get; set; } public bool BookingOpen { get; set; }
    public string? RegionId { get; set; } public string? StartPortId { get; set; } public string? EndPortId { get; set; } public string DataStatus { get; set; } = "served";
}

public sealed class CatalogueLegRow { public string SailingId { get; set; } = ""; public int LegNo { get; set; } public string PatternId { get; set; } = ""; public int StartDay { get; set; } }

public sealed class CatalogueDressRow { public string SailingId { get; set; } = ""; public int Day { get; set; } public string Code { get; set; } = ""; }

public sealed class CatalogueFareRow { public string SailingId { get; set; } = ""; public string CategoryId { get; set; } = ""; public long PerNightCents { get; set; } }

/// <summary>Everything the catalogue endpoints serve, read once and held for ten minutes (the API never writes these tables).</summary>
public sealed class CatalogueSnapshot
{
    public List<CatalogueRegionRow> Regions { get; init; } = [];
    public List<CatalogueShipRow> Ships { get; init; } = [];
    public List<CatalogueDeckRow> Decks { get; init; } = [];
    public List<CatalogueVenueRow> Venues { get; init; } = [];
    public List<CatalogueCategoryRow> Categories { get; init; } = [];
    public List<CataloguePortRow> Ports { get; init; } = [];
    public List<CataloguePatternRow> Patterns { get; init; } = [];
    public List<CatalogueDayRow> PatternDays { get; init; } = [];
    public List<CatalogueSailingRow> Sailings { get; init; } = [];
    public List<CatalogueLegRow> Legs { get; init; } = [];
    public List<CatalogueDayRow> SailingDays { get; init; } = [];
    public List<CatalogueDressRow> Dress { get; init; } = [];
    public List<CatalogueFareRow> Fares { get; init; } = [];
}

public interface ICatalogueStore
{
    Task<CatalogueSnapshot> GetAsync(CancellationToken ct);
}

public sealed class DapperCatalogueStore(IDbConnectionFactory db, IMemoryCache cache) : ICatalogueStore
{
    public static readonly TimeSpan Ttl = TimeSpan.FromMinutes(10);
    private const string Key = "ref:catalogue";

    public async Task<CatalogueSnapshot> GetAsync(CancellationToken ct)
    {
        if (cache.TryGetValue(Key, out CatalogueSnapshot? hit) && hit is not null) return hit;
        await using var c = await db.OpenAsync(ct);
        async Task<List<T>> Q<T>(string sql) => (await c.QueryAsync<T>(Sql.Cmd(sql, null, null, ct))).ToList();
        var snapshot = new CatalogueSnapshot
        {
            Regions = await Q<CatalogueRegionRow>("SELECT Id, Name, SortOrder FROM ref.Regions ORDER BY SortOrder, Id"),
            Ships = await Q<CatalogueShipRow>("SELECT Id, Name, Class, Decks, Tonnage, Capacity, HomeZone, ProfileJson, LengthFt, BeamFt, Crew, Staterooms, Entered, Intro, Depth FROM ref.Ships ORDER BY Id"),
            Decks = await Q<CatalogueDeckRow>("SELECT ShipId, Number, Name, Summary FROM ref.Decks ORDER BY ShipId, Number"),
            Venues = await Q<CatalogueVenueRow>("SELECT ShipId, Id, Kind, Name, Cuisine, Deck FROM ref.Venues ORDER BY ShipId, Deck, Name"),
            Categories = await Q<CatalogueCategoryRow>("SELECT Id, ShipId, Name, IsSuite, Capacity, SizeSqFt, Description, SortOrder FROM ref.CabinCategories ORDER BY ShipId, SortOrder, Id"),
            Ports = await Q<CataloguePortRow>("SELECT Id, Name, Country, CountryCode, RegionId, TimeZone, Tender, Lat, Lon, Currency, Languages, Tier, GuideStatus, ArtId FROM ref.Ports ORDER BY Id"),
            Patterns = await Q<CataloguePatternRow>("SELECT Id, Name, RegionId, Nights, StartPortId, EndPortId, Description FROM ref.ItineraryPatterns ORDER BY Id"),
            PatternDays = await Q<CatalogueDayRow>("SELECT PatternId AS OwnerId, [Day], PortId, ArriveLocal, DepartLocal, AllAboardLocal, ClockChangeHours, ClockChangeAtLocal FROM ref.ItineraryPatternDays ORDER BY PatternId, [Day]"),
            Sailings = await Q<CatalogueSailingRow>("SELECT Id, ShipId, Departure, Nights, Title, IsHoliday, BookingOpen, RegionId, StartPortId, EndPortId, DataStatus FROM ref.Sailings ORDER BY Departure, Id"),
            Legs = await Q<CatalogueLegRow>("SELECT SailingId, LegNo, PatternId, StartDay FROM ref.SailingLegs ORDER BY SailingId, LegNo"),
            SailingDays = await Q<CatalogueDayRow>("SELECT SailingId AS OwnerId, [Day], [Date], PortId, ArriveLocal, DepartLocal, AllAboardLocal, ClockChangeHours, ClockChangeAtLocal FROM ref.ItineraryDays ORDER BY SailingId, [Day]"),
            Dress = await Q<CatalogueDressRow>("SELECT SailingId, [Day], Code FROM ref.DressNights ORDER BY SailingId, [Day]"),
            Fares = await Q<CatalogueFareRow>("SELECT SailingId, CategoryId, PerNightCents FROM ref.SailingFares ORDER BY SailingId, CategoryId"),
        };
        cache.Set(Key, snapshot, Ttl);
        return snapshot;
    }
}
