using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

public sealed record PortCrowdDto(int Ships, int Guests, string Level, bool StayAboardNote, string Source);

public sealed record FarePointDto(string Date, long Total);

/// <summary>
/// Simulated feeds of multi-device plan 2, Phase 3, ported from <c>src/domain/portCrowd.ts</c> and <c>fareHistory</c> in <c>src/domain/bookingPrep.ts</c>
/// (same hashes, same figures), so the first version of each is identical on every device. A real provider replaces the body and keeps the shape.
/// </summary>
public static class ShipFeedRules
{
    public const int ShipGuests = 4000;
    private static readonly Dictionary<string, int> Comfort = new() { ["cozumel"] = 12_000, ["belize"] = 6_000, ["roatan"] = 8_000 };
    private static readonly Dictionary<string, int> MaxShips = new() { ["cozumel"] = 5, ["belize"] = 3, ["roatan"] = 4 };
    private static readonly Regex IsoDate = new(@"^[0-9]{4}-[0-9]{2}-[0-9]{2}$", RegexOptions.Compiled);

    public static bool ValidPort(string? port) => port is not null && Comfort.ContainsKey(port);
    public static bool ValidDate(string? date) => date is not null && IsoDate.IsMatch(date) && DateOnly.TryParseExact(date, "yyyy-MM-dd", out _);

    private static uint Fnv(string text)
    {
        unchecked
        {
            uint h = 2166136261;
            foreach (var c in text) h = (h ^ (uint)c) * 16777619;
            return h;
        }
    }

    /// <summary>Ships in port and the expected crowd for a port on a date.</summary>
    public static PortCrowdDto PortCrowd(string port, string date)
    {
        var ships = 1 + (int)(Fnv($"{port}|{date}") % (uint)MaxShips[port]);
        var guests = ships * ShipGuests;
        var ratio = (double)guests / Comfort[port];
        var level = ratio >= 1 ? "busy" : ratio >= 0.6 ? "moderate" : "quiet";
        return new PortCrowdDto(ships, guests, level, level == "busy", FeedRules.Sim);
    }

    public static bool ValidFareQuery(string? number, long total, string? booked, string? today) =>
        number is { Length: > 0 and <= 30 } && number.All(char.IsAsciiLetterOrDigit) && total is >= 0 and <= 1_000_000_000
        && ValidDate(booked) && ValidDate(today) && string.CompareOrdinal(booked, today) <= 0;

    /// <summary>A weekly fare for the same cabin since booking: a gentle wander around the booked fare, the same every time for the same booking.</summary>
    public static List<FarePointDto> FareHistory(string number, long total, string booked, string today)
    {
        unchecked
        {
            uint seed = 0;
            foreach (var c in number) seed = seed * 31 + (uint)c;
            double Next() { seed = seed * 1664525 + 1013904223; return seed / 4294967296.0; }
            var points = new List<FarePointDto>();
            var fare = total;
            var floor = Pricing.JsRound(total * 0.7 / 100) * 100;
            var d = DateOnly.ParseExact(booked, "yyyy-MM-dd");
            for (var n = 0; string.CompareOrdinal(d.ToString("yyyy-MM-dd"), today) <= 0 && n < 26; d = d.AddDays(7), n++)
            {
                fare = Math.Max(floor, Pricing.JsRound(fare * (0.96 + Next() * 0.09) / 100) * 100);
                points.Add(new FarePointDto(d.ToString("yyyy-MM-dd"), n == 0 ? total : fare));
            }
            return points;
        }
    }
}
