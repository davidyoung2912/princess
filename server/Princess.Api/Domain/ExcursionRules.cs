namespace Princess.Api.Domain;

public sealed record Excursion(
    string Id, string Port, string Name, string Summary, double Hours, long Price, string Activity, bool Wheelchair, bool Family, string[] Interests,
    double Rating, int Reviews, string Meeting, string Start, int Capacity);

public sealed record TourRefund(long Fee, long Refund, bool Free);

/// <summary>A tour already booked, or in the cart, as far as conflict checking cares.</summary>
public sealed record BookedTour(string ExcursionId, IReadOnlyCollection<Guid> Guests);

/// <summary>Shore excursions, ported from <c>src/domain/excursions.ts</c>. The catalogue is authored concept data and matches <c>ref.Excursions</c>.</summary>
public static class ExcursionRules
{
    public static readonly IReadOnlyList<Excursion> Catalogue =
    [
        new("coz-snorkel", "cozumel", "Reef snorkel by boat", "A short boat ride to Palancar Reef, with gear and a guide in the water.", 3.5, 7900, "moderate", false, true, ["water", "nature"], 4.7, 1284, "Meet on the pier beside the gangway, 10 minutes before the start", "08:30", 36),
        new("coz-ruins", "cozumel", "San Gervasio Mayan ruins", "An air-conditioned coach to the island’s ruins, with a guide on the history.", 4, 6900, "moderate", false, true, ["culture"], 4.5, 902, "Meet on the pier beside the gangway, 10 minutes before the start", "09:00", 40),
        new("coz-beach", "cozumel", "Beach club day pass", "A lounger, shade and a lunch credit at a beach club a short taxi ride away.", 6, 5900, "easy", true, true, ["relax", "water"], 4.6, 2210, "Meet on the pier beside the gangway, 10 minutes before the start", "09:30", 60),
        new("coz-glass", "cozumel", "Glass-bottom boat and town", "See the reef from a dry, level boat deck, then an hour in town.", 2.5, 4900, "easy", true, true, ["nature", "relax"], 4.4, 611, "Meet on the pier beside the gangway, 10 minutes before the start", "13:00", 30),
        new("bze-altunha", "belize", "Altun Ha Mayan temples", "A coach inland to the temples, with time to climb the main pyramid.", 4, 8500, "moderate", false, true, ["culture"], 4.6, 1530, "Meet at the tender landing in town, then follow the guide", "08:30", 40),
        new("bze-cave", "belize", "Cave tubing adventure", "Float through a jungle cave on an inner tube after a walk through the forest.", 6, 12900, "strenuous", false, false, ["adventure", "nature"], 4.8, 2045, "Meet at the tender landing in town, then follow the guide", "08:30", 24),
        new("bze-reef", "belize", "Barrier reef snorkel", "A boat to the second-largest barrier reef in the world, with gear and a guide.", 4, 9900, "moderate", false, true, ["water", "nature"], 4.7, 1178, "Meet at the tender landing in town, then follow the guide", "09:00", 32),
        new("bze-walk", "belize", "Belize City heritage walk", "A slow guided walk past the swing bridge, the old market and the harbour.", 2.5, 4500, "easy", true, true, ["culture", "relax"], 4.3, 388, "Meet at the tender landing in town, then follow the guide", "10:00", 20),
        new("rtb-zip", "roatan", "Zip-line canopy tour", "Ten zip lines through the rainforest canopy, with a harness fitting first.", 3, 8900, "strenuous", false, false, ["adventure", "nature"], 4.8, 1710, "Meet on the pier beside the gangway, 10 minutes before the start", "09:00", 28),
        new("rtb-snorkel", "roatan", "West Bay snorkel", "Calm, clear water off a white beach, with gear and a guide.", 3.5, 7500, "moderate", false, true, ["water"], 4.6, 996, "Meet on the pier beside the gangway, 10 minutes before the start", "09:30", 36),
        new("rtb-wildlife", "roatan", "Wildlife and monkey park", "Sloths, monkeys and tropical birds on flat paths, with a keeper to talk to.", 3, 6500, "easy", true, true, ["nature"], 4.5, 1402, "Meet on the pier beside the gangway, 10 minutes before the start", "10:00", 40),
        new("rtb-drive", "roatan", "Island drive and beach stop", "A van around the island with three photo stops and half an hour on the beach.", 3, 5500, "easy", true, true, ["relax", "culture"], 4.2, 457, "Meet on the pier beside the gangway, 10 minutes before the start", "12:30", 24),
    ];

    public const int ChildAge = 12;
    public const double ChildShare = 0.7;
    public const int AdultAge = 18;
    /// <summary>Cancelling a ship tour is free until two days before the port day, then no refund.</summary>
    public const int FreeCancelDays = 2;

    private static readonly Dictionary<string, string[]> SoldOut = new() { ["sun-2027-03-21"] = ["rtb-zip"] };

    public static Excursion? ById(string? id) => Catalogue.FirstOrDefault(x => x.Id == id);

    public static long GuestPrice(Excursion x, int age) => age < ChildAge ? Pricing.JsRound(x.Price * ChildShare / 100) * 100 : x.Price;

    /// <summary>Tours that need real fitness or sure footing have a minimum age.</summary>
    public static int MinAge(Excursion x) => x.Activity == "strenuous" ? 12 : 0;

    public static bool NeedsTender(Excursion x) => Itinerary.Ports[x.Port].Tender;

    /// <summary>The same 32-bit hash the screens use (djb2 over UTF-16 units), so a sailing's grid is the same on both sides.</summary>
    public static uint Hash(string text)
    {
        uint h = 5381;
        foreach (var ch in text) h = unchecked(h * 33 + ch);
        return h;
    }

    /// <summary>Places left on a tour on a sailing: the same number every time, never fewer than 5 unless it is sold out.</summary>
    public static int SpotsLeft(Excursion x, string sailingId, int bookedHere = 0)
    {
        if (SoldOut.TryGetValue(sailingId, out var ids) && ids.Contains(x.Id)) return 0;
        var taken = (int)(Hash($"{x.Id}|{sailingId}") % (uint)(x.Capacity - 4));
        return Math.Max(0, x.Capacity - taken - bookedHere);
    }

    public static ItineraryDay DayOf(DateOnly departure, Excursion x) => Itinerary.Days(departure).First(d => d.Port == x.Port);

    private static int Minutes(TimeOnly t) => t.Hour * 60 + t.Minute;
    private static int Minutes(string hhmm) => Minutes(TimeOnly.ParseExact(hhmm, "HH:mm"));

    /// <summary>Minutes a guest needs to get ashore and to the meeting point, and to get back and aboard: longer at a tender port.</summary>
    public static (int Out, int Back) LandingBuffer(string port) => Itinerary.Ports[port].Tender ? (75, 90) : (30, 45);

    public static int EndMinutes(Excursion x) => Minutes(x.Start) + (int)Pricing.JsRound(x.Hours * 60);

    /// <summary>Whether a tour fits the ship's day: not before guests can be ashore, and finished with time to be back before all aboard.</summary>
    public static string? TimingProblem(Excursion x, ItineraryDay day)
    {
        if (day.Arrive is not { } arrive || day.AllAboard is not { } allAboard) return null;
        var (o, back) = LandingBuffer(x.Port);
        if (Minutes(x.Start) < Minutes(arrive) + o) return "tooEarly";
        if (EndMinutes(x) + back > Minutes(allAboard)) return "tooLate";
        return null;
    }

    /// <summary>When the guest must be back at the landing to be safe, "HH:mm" local port time.</summary>
    public static string BackBy(Excursion x, ItineraryDay day)
    {
        var t = (day.AllAboard is { } a ? Minutes(a) : 23 * 60 + 59) - LandingBuffer(x.Port).Back;
        return $"{t / 60:00}:{t % 60:00}";
    }

    public static bool Overlaps(Excursion a, Excursion b) => a.Port == b.Port && Minutes(a.Start) < EndMinutes(b) && Minutes(b.Start) < EndMinutes(a);

    /// <summary>Guests on both a tour already booked and the new one, where the hours overlap.</summary>
    public static List<Guid> ConflictingGuests(IEnumerable<BookedTour> booked, Excursion x, IReadOnlyCollection<Guid> guests)
    {
        var clash = new HashSet<Guid>();
        foreach (var b in booked)
        {
            var other = ById(b.ExcursionId);
            if (other is null || other.Id == x.Id || !Overlaps(other, x)) continue;
            foreach (var g in b.Guests) if (guests.Contains(g)) clash.Add(g);
        }
        return [.. clash];
    }

    public static TourRefund Refund(long paid, int daysToTour) => daysToTour >= FreeCancelDays ? new(0, paid, true) : new(paid, 0, false);

    public static int DaysToTour(DateOnly today, DateOnly departure, Excursion x) => DayOf(departure, x).Date.DayNumber - today.DayNumber;
}
