using System.Text.Json;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

public sealed record PhotoMetrics(double? Width, double? Height, double? Brightness, double? Sharpness);

public sealed record GuestProgress(List<string> Done, List<string> Left, bool Complete);

public sealed record NextStep(string Step, Guid? Guest);

public sealed record CheckinProgress(int Done, int Total, bool Complete, List<string> BookingLeft, NextStep? Next);

/// <summary>Ported from <c>src/domain/checkin.ts</c>: online check-in, eight steps. Six are answered for each guest, two once for the booking. A parent or guardian completes every step for a child.</summary>
public static partial class CheckinRules
{
    public static readonly string[] GuestSteps = ["confirm", "document", "photo", "emergency", "contract", "health"];
    public static readonly string[] BookingSteps = ["payment", "arrival"];

    /// <summary>The order the steps are shown in; the guest-level and booking-level steps are mixed the way the guest meets them.</summary>
    public static readonly string[] StepOrder = ["confirm", "document", "photo", "emergency", "payment", "contract", "health", "arrival"];

    public static bool IsGuestStep(string step) => GuestSteps.Contains(step);

    /// <summary>Check-in opens three days before sailing and closes at 10:00 on sailing day; after that the terminal desk takes over (CHK-08). The times are <see cref="TripRules"/>.</summary>
    public const int OpenDaysBefore = TripRules.CheckinOpenDaysBefore;

    /// <summary>The booking terms in the version in force; the contract step records it. Matches <c>LEGAL</c> id <c>terms</c> in <c>src/domain/policy.ts</c>.</summary>
    public const string ContractVersion = "2026-10";

    // ---- Travel document ----

    public static string NormalizePassportNumber(string v) => NumberJunk().Replace(v, "").ToUpperInvariant();

    [GeneratedRegex(@"[\s-]")]
    private static partial Regex NumberJunk();

    [GeneratedRegex("^[A-Z0-9]{6,9}$")]
    private static partial Regex PassportNumber();

    /// <summary>
    /// The problem with the document details, or null. A passport needs a number and an expiry six months past the return date; a US guest on a closed-loop cruise
    /// may instead bring a certified birth certificate.
    /// </summary>
    public static string? ValidateDocument(string? kind, string? country, string? number, string? expires, string citizenship, DateOnly returnDate)
    {
        if (kind is not ("passport" or "birthCertificate")) return "kind";
        if (kind == "birthCertificate") return citizenship == "us" ? null : "notAllowed";
        if (country is null || country.Trim().Length < 2) return "country";
        if (number is null || !PassportNumber().IsMatch(NormalizePassportNumber(number))) return "number";
        if (!AccountRules.IsIsoDate(expires)) return "expiry";
        var held = new DocumentRules.Held { ["passport"] = expires };
        return DocumentRules.DocStatus("passport", held, returnDate) switch { "expired" => "expired", "tooSoon" => "tooSoon", _ => null };
    }

    // ---- Security photo ----

    public const int MinSide = 400;
    public const double MinRatio = 0.6, MaxRatio = 1.4, MinBrightness = 70, MaxBrightness = 200, MinSharpness = 12;

    /// <summary>Everything wrong with a photo, so the guest can fix it in one go. Empty when it is good. The server sees only the measurements; the picture is never sent or kept.</summary>
    public static List<string> JudgePhoto(PhotoMetrics? m)
    {
        if (m is not { Width: { } w, Height: { } h, Brightness: { } b, Sharpness: { } s } || !new[] { w, h, b, s }.All(double.IsFinite)) return ["small"];
        var problems = new List<string>();
        if (Math.Min(w, h) < MinSide) problems.Add("small");
        var ratio = w / Math.Max(1, h);
        if (ratio < MinRatio || ratio > MaxRatio) problems.Add("shape");
        if (b < MinBrightness) problems.Add("dark");
        if (b > MaxBrightness) problems.Add("bright");
        if (s < MinSharpness) problems.Add("blurry");
        return problems;
    }

    // ---- Emergency contact ----

    /// <summary>The contact must be someone who is not on the ship: not one of the guests on this booking.</summary>
    public static string? ValidateEmergency(string name, string phone, string relationship, IEnumerable<string> guestNames)
    {
        var n = name.Trim().ToLowerInvariant();
        if (n.Length < 2) return "name";
        if (!AccountRules.PhoneOk(phone)) return "phone";
        if (string.IsNullOrWhiteSpace(relationship)) return "relationship";
        return guestNames.Any(g => g.Trim().ToLowerInvariant() == n) ? "travelling" : null;
    }

    // ---- Health questions ----

    public static readonly string[] HealthQuestions = ["symptoms", "positive", "contact"];

    /// <summary>Every question needs a true or false answer. Any "yes" is passed on to the terminal nurse; it never blocks check-in. Null when an answer is missing or not a boolean.</summary>
    public static (Dictionary<string, bool> Answers, bool Flagged)? ValidateHealth(IReadOnlyDictionary<string, JsonElement>? raw)
    {
        var answers = new Dictionary<string, bool>();
        foreach (var q in HealthQuestions)
        {
            if (raw is null || !raw.TryGetValue(q, out var v) || v.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return null;
            answers[q] = v.GetBoolean();
        }
        return (answers, answers.Values.Any(a => a));
    }

    // ---- Progress ----

    public static GuestProgress GuestProgressOf(IReadOnlySet<string> done) =>
        new([.. GuestSteps.Where(done.Contains)], [.. GuestSteps.Where(s => !done.Contains(s))], GuestSteps.All(done.Contains));

    public static CheckinProgress ProgressOf(IReadOnlyList<(Guid Id, GuestProgress Progress)> guests, bool paymentDone, bool arrivalDone)
    {
        var bookingLeft = new List<string>();
        if (!paymentDone) bookingLeft.Add("payment");
        if (!arrivalDone) bookingLeft.Add("arrival");
        var done = guests.Sum(g => g.Progress.Done.Count) + (BookingSteps.Length - bookingLeft.Count);
        var total = (guests.Count * GuestSteps.Length) + BookingSteps.Length;
        NextStep? next = null;
        foreach (var step in StepOrder)
        {
            if (IsGuestStep(step))
            {
                var g = guests.FirstOrDefault(x => x.Progress.Left.Contains(step));
                if (g.Progress is not null) { next = new NextStep(step, g.Id); break; }
            }
            else if (bookingLeft.Contains(step)) { next = new NextStep(step, null); break; }
        }
        return new CheckinProgress(done, total, next is null, bookingLeft, next);
    }

    /// <summary>Online check-in at a moment: <c>notOpen</c>, <c>open</c> or <c>closed</c>. A finished check-in is <c>done</c> whatever the clock says.</summary>
    public static string State(bool finished, DateTime now, DateTime opensAt, DateTime closesAt) =>
        finished ? "done" : TripRules.CheckinWindow(now, opensAt, closesAt);
}
