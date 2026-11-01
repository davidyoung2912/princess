namespace Princess.Api.Domain;

public sealed record LaundryKind(string Id, string Unit, long Cents, int Hours, int MaxQty);

public sealed record PickupOption(string Date, int Day, string Time, long At);

public sealed record LaundryPrice(long Total, long Free);

/// <summary>Laundry, pressing and dry cleaning (SHP-03), ported from <c>src/domain/laundry.ts</c>: request, pick-up window, tracking. Prices and turnaround are authored concept values.</summary>
public static class LaundryRules
{
    public static readonly IReadOnlyList<LaundryKind> Services =
    [
        new("washFold", "bag", 1800, 24, 3),
        new("press", "item", 300, 12, 20),
        new("dryClean", "item", 900, 48, 20),
    ];

    public static LaundryKind? ServiceById(string? id) => Services.FirstOrDefault(s => s.Id == id);

    public const int NoteMax = 200;

    public static readonly string[] Windows = ["08:00", "13:00", "18:00"];

    private const long Hour = 3_600_000;

    /// <summary>What a request costs; a guest with the laundry perk has the first wash-and-fold bag free.</summary>
    public static LaundryPrice Price(LaundryKind s, int qty, bool freeBagLeft)
    {
        var gross = s.Cents * qty;
        var free = s.Id == "washFold" && freeBagLeft ? s.Cents : 0;
        return new LaundryPrice(gross - free, free);
    }

    /// <summary>The next pick-up windows with an hour's notice, whose return is in time for the last morning.</summary>
    public static List<PickupOption> PickupOptions(DateOnly departure, DateTime now, LaundryKind service, int count = 6)
    {
        var days = Itinerary.Days(departure);
        var last = days[^1];
        var lastMorning = TripRules.ToMs(Itinerary.LocalToUtc(last.Date, new TimeOnly(7, 0), Itinerary.ShipZoneOnDate(departure, last.Date)));
        var nowMs = TripRules.ToMs(now);
        var result = new List<PickupOption>();
        foreach (var d in days)
        {
            var zone = Itinerary.ShipZoneOnDate(departure, d.Date);
            foreach (var time in Windows)
            {
                var at = TripRules.ToMs(Itinerary.LocalToUtc(d.Date, TimeOnly.ParseExact(time, "HH:mm"), zone));
                if (at - nowMs >= Hour && at + service.Hours * Hour <= lastMorning) result.Add(new PickupOption(d.Date.ToString("yyyy-MM-dd"), d.Day, time, at));
            }
            if (result.Count >= count) break;
        }
        return [.. result.Take(count)];
    }

    public static (string Stage, long ReturnAt) Stage(long pickupAt, int hours, bool cancelled, long now)
    {
        var returnAt = pickupAt + hours * Hour;
        if (cancelled) return ("cancelled", returnAt);
        return (now < pickupAt ? "requested" : now < returnAt ? "cleaning" : "returned", returnAt);
    }

    /// <summary>A request can be cancelled until the steward collects it.</summary>
    public static bool Cancellable(string stage) => stage == "requested";
}
