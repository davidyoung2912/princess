namespace Princess.Api.Domain;

/// <summary>One charge or credit on the onboard account. <see cref="Cents"/> is what was charged (negative is a credit); <see cref="Value"/> is what it would have cost when something else paid.</summary>
public sealed record FolioLine(string Id, int Day, long At, string Category, string Description, Guid Guest, long Cents, long? Value, string? CoveredBy);

public sealed record FolioGuest(Guid Id, string FirstName, int Age, Entitlements Entitlements, bool Suite);

public sealed record DiningCharge(string Id, int Day, string Time, string Venue, IReadOnlyList<Guid> Guests, long Charge, IReadOnlyList<Guid> Covered);

public sealed record FolioTotals(long Charges, long Credits, long Covered, long Balance);

/// <summary>The onboard account (ACC-01), ported from <c>src/domain/folio.ts</c>. The same booking and sailing always give the same list of generated charges; real charges (orders, photos, laundry and so on) are stored lines that sit beside them.</summary>
public static class FolioRules
{
    private sealed record Item(string Category, string Description, long Cents, bool Adult);

    private static readonly Item[] Items =
    [
        new("drinks", "Cocktail, Bellini’s Cocktail Bar", 1400, true),
        new("drinks", "Glass of wine, Crooners", 1200, true),
        new("drinks", "Specialty coffee, Coffee Currents", 600, false),
        new("drinks", "Premium cocktail, Wheelhouse Bar", 1900, true),
        new("drinks", "Pint, O’Malley’s Irish Pub", 850, true),
        new("internet", "Wi-Fi, one device, one day", 1999, false),
        new("spa", "Massage, Lotus Spa", 15900, true),
        new("shops", "Sunscreen, Shops of Princess", 1899, false),
        new("shops", "Souvenir tee, Shops of Princess", 3200, false),
        new("photos", "Portrait print, ship photographers", 2495, false),
        new("laundry", "Self-service laundry, wash and dry", 800, false),
    ];

    /// <summary>The bar service charge added to a bar charge.</summary>
    public const double BarServiceRate = 0.18;

    private sealed class Used { public bool Wifi; }

    /// <summary>A package covers a drink up to its cap (dollars) and the first Wi-Fi device; beyond the cap the guest pays the difference.</summary>
    private static (long Cents, long? Value, string? CoveredBy) Cover(FolioGuest g, Item item, Used used)
    {
        var e = g.Entitlements;
        if (item.Category == "drinks" && e.DrinkCapUsd > 0)
        {
            var cap = e.DrinkCapUsd * 100L;
            return item.Cents <= cap ? (0, item.Cents, "package") : (item.Cents - cap, item.Cents, "package");
        }
        if (item.Category == "internet" && e.WifiDevices > 0 && !used.Wifi)
        {
            used.Wifi = true;
            return (0, item.Cents, "package");
        }
        return (item.Cents, null, null);
    }

    /// <summary>Every generated charge up to <paramref name="throughDay"/> (1 to 8), in time order. Days that have not started have no charges.</summary>
    public static List<FolioLine> Build(string sailingId, DateOnly departure, int throughDay, IReadOnlyList<FolioGuest> guests, IReadOnlyList<DiningCharge> dining, bool welcomeCredit)
    {
        var days = Itinerary.Days(departure);
        var lines = new List<FolioLine>();
        var last = Math.Min(throughDay, days.Count - 1);
        DateTime At(int day, int hour, int minute = 0)
        {
            var date = days[day - 1].Date;
            return Itinerary.LocalToUtc(date, new TimeOnly(hour, minute), Itinerary.ShipZoneOnDate(departure, date));
        }
        var used = new Dictionary<Guid, Used>();

        if (welcomeCredit && last >= 1 && guests.Count > 0)
            lines.Add(new FolioLine("credit-welcome", 1, TripRules.ToMs(At(1, 16)), "credit", "Welcome gift: onboard credit", guests[0].Id, -5000, null, null));

        for (var day = 1; day <= last; day++)
        {
            foreach (var g in guests)
            {
                if (!used.TryGetValue(g.Id, out var state)) used[g.Id] = state = new Used();
                var rate = g.Suite ? Pricing.GratuityPerNightSuite : Pricing.GratuityPerNight;
                if (day <= 7)
                {
                    var tipAt = TripRules.ToMs(At(day, 6));
                    lines.Add(g.Entitlements.GratuitiesIncluded
                        ? new FolioLine($"tip-{g.Id}-{day}", day, tipAt, "gratuities", "Daily gratuity", g.Id, 0, rate, "package")
                        : new FolioLine($"tip-{g.Id}-{day}", day, tipAt, "gratuities", "Daily gratuity", g.Id, rate, null, null));
                }
                if (day == 1 || day >= 8) continue;
                var picks = CabinRules.Hash($"{sailingId}|{g.Id}|{day}");
                var count = g.Age < 18 ? 0 : picks % 4 == 0 ? 0 : 1 + (int)(picks % 2);
                for (var n = 0; n < count; n++)
                {
                    var item = Items[(int)((picks >> (3 * n + 2)) % (uint)Items.Length)];
                    if (g.Age < 18 || (item.Adult && g.Age < 21)) continue;
                    if (item.Category == "spa" && day % 2 == 1) continue;
                    var (cents, value, coveredBy) = Cover(g, item, state);
                    var hour = 11 + (int)((picks >> (n + 5)) % 10);
                    var baseLine = new FolioLine($"x-{g.Id}-{day}-{n}", day, TripRules.ToMs(At(day, hour, (int)(picks % 4) * 15)), item.Category, item.Description, g.Id, cents, value, coveredBy);
                    lines.Add(baseLine);
                    if (item.Category == "drinks" && cents > 0)
                        lines.Add(new FolioLine($"{baseLine.Id}-svc", day, baseLine.At + 1, "tips", $"Bar service charge ({Math.Round(BarServiceRate * 100)}%)", g.Id, Pricing.JsRound(cents * BarServiceRate), null, null));
                }
            }
        }

        foreach (var t in dining)
        {
            if (t.Day > last || t.Charge <= 0) continue;
            var date = days[t.Day - 1].Date;
            var dinnerAt = TripRules.ToMs(Itinerary.LocalToUtc(date, TimeOnly.ParseExact(t.Time, "HH:mm"), Itinerary.ShipZoneOnDate(departure, date)));
            var paying = t.Guests.Where(x => !t.Covered.Contains(x)).ToList();
            var each = paying.Count > 0 ? Pricing.JsRound((double)t.Charge / paying.Count) : 0;
            for (var i = 0; i < paying.Count; i++)
                lines.Add(new FolioLine($"{t.Id}-{paying[i]}", t.Day, dinnerAt + i, "dining", $"Cover charge, {t.Venue}", paying[i], each, null, null));
            foreach (var guest in t.Covered)
                lines.Add(new FolioLine($"{t.Id}-{guest}-cov", t.Day, dinnerAt, "dining", $"Specialty dinner, {t.Venue}", guest, 0, 0, "package"));
        }
        return Sorted(lines);
    }

    /// <summary>By time, then by id so two lines in the same minute keep a stable order.</summary>
    public static List<FolioLine> Sorted(IEnumerable<FolioLine> lines) => [.. lines.OrderBy(l => l.At).ThenBy(l => l.Id, StringComparer.Ordinal)];

    /// <summary>What was charged, what was credited, what packages paid for, and what is owed (charges less credits).</summary>
    public static FolioTotals Totals(IReadOnlyCollection<FolioLine> lines)
    {
        var charges = lines.Where(l => l.Cents > 0).Sum(l => l.Cents);
        var credits = -lines.Where(l => l.Cents < 0).Sum(l => l.Cents);
        var covered = lines.Where(l => l.CoveredBy is not null).Sum(l => (l.Value ?? 0) - l.Cents);
        return new FolioTotals(charges, credits, covered, charges - credits);
    }

    /// <summary>The cruise day (1 to 8) for a moment in ship time; 0 before the first day and 9 after the last.</summary>
    public static int CruiseDay(DateOnly departure, DateTime now)
    {
        var days = Itinerary.Days(departure);
        var (date, _) = Itinerary.LocalAt(now, Itinerary.ShipZoneAt(departure, now));
        if (date < days[0].Date) return 0;
        if (date > days[7].Date) return 9;
        return days.FirstOrDefault(d => d.Date == date)?.Day ?? 0;
    }
}
