using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

public enum NameChangeResult { Allowed, Late, Large }

/// <summary>Ported from <c>src/domain/account.ts</c>: profile validation, the name-change rules and card checks. The server is the authority.</summary>
public static partial class AccountRules
{
    public const int NameTypoLimit = 3;
    public const int NameLockDays = 14;

    public static readonly string[] Dietary = ["vegetarian", "vegan", "glutenFree", "nutAllergy", "shellfishAllergy", "dairyFree", "halal", "kosher"];
    public static readonly string[] Needs = ["mobility", "hearing", "vision", "cpap", "oxygen", "serviceAnimal"];
    public static readonly string[] Bedding = ["queen", "twin", "noPreference"];
    public static readonly string[] CardBrands = ["visa", "mastercard", "amex", "discover"];
    public static readonly string[] Permissions = ["view", "documents", "payments", "profile"];
    public static readonly string[] HelperStatuses = ["active", "requested"];

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex EmailPattern();

    [GeneratedRegex(@"^[\d\s()+.\-]+$")]
    private static partial Regex PhoneChars();

    [GeneratedRegex(@"^\d{4}-\d{2}-\d{2}$")]
    private static partial Regex IsoDate();

    public static bool IsIsoDate(string? s) => s is not null && IsoDate().IsMatch(s) && DateOnly.TryParseExact(s, "yyyy-MM-dd", out _);

    public static bool PhoneOk(string? v)
    {
        if (string.IsNullOrEmpty(v) || !PhoneChars().IsMatch(v)) return false;
        var digits = v.Count(char.IsAsciiDigit);
        return digits is >= 7 and <= 15;
    }

    /// <summary>Whole years between a birth date and a day.</summary>
    public static int AgeOn(DateOnly dob, DateOnly day) => day.Year - dob.Year - (day.Month < dob.Month || (day.Month == dob.Month && day.Day < dob.Day) ? 1 : 0);

    public static int Distance(string a, string b)
    {
        var row = Enumerable.Range(0, b.Length + 1).ToArray();
        for (var i = 1; i <= a.Length; i++)
        {
            var prev = row[0];
            row[0] = i;
            for (var j = 1; j <= b.Length; j++)
            {
                var keep = row[j];
                row[j] = Math.Min(Math.Min(row[j] + 1, row[j - 1] + 1), prev + (a[i - 1] == b[j - 1] ? 0 : 1));
                prev = keep;
            }
        }
        return row[b.Length];
    }

    /// <summary>A spelling fix online up to two weeks before sailing; a different person's name, or any change later, goes through Guest Services.</summary>
    public static NameChangeResult NameChange(string before, string after, int daysToDeparture)
    {
        var a = before.Trim().ToLowerInvariant();
        var b = after.Trim().ToLowerInvariant();
        if (a == b) return NameChangeResult.Allowed;
        if (daysToDeparture < NameLockDays) return NameChangeResult.Late;
        return Distance(a, b) <= NameTypoLimit ? NameChangeResult.Allowed : NameChangeResult.Large;
    }

    /// <summary>The problems with a submitted profile, by field, as <c>validateProfile</c>. Empty means valid. Contact details are optional for children.</summary>
    public static Dictionary<string, string> ValidateProfile(ProfileInput p, DateOnly today, bool child)
    {
        var errors = new Dictionary<string, string>();
        if (string.IsNullOrWhiteSpace(p.FirstName)) errors["firstName"] = "required";
        if (string.IsNullOrWhiteSpace(p.LastName)) errors["lastName"] = "required";
        if (!IsIsoDate(p.Dob)) errors["dob"] = string.IsNullOrEmpty(p.Dob) ? "required" : "date";
        else if (DateOnly.ParseExact(p.Dob!, "yyyy-MM-dd") > today) errors["dob"] = "future";
        var email = p.Email ?? "";
        if (email.Length > 0 ? !EmailPattern().IsMatch(email) : !child) errors["email"] = email.Length > 0 ? "email" : "required";
        if (!string.IsNullOrEmpty(p.Phone) && !PhoneOk(p.Phone)) errors["phone"] = "phone";
        var hasName = !string.IsNullOrWhiteSpace(p.Emergency?.Name);
        var hasPhone = !string.IsNullOrWhiteSpace(p.Emergency?.Phone);
        if (hasName != hasPhone) errors[hasName ? "emergencyPhone" : "emergencyName"] = "pair";
        else if (hasPhone && !PhoneOk(p.Emergency!.Phone)) errors["emergencyPhone"] = "phone";
        return errors;
    }

    /// <summary>Problems with a new card, as <c>validateCard</c>; a card is good through the end of its expiry month. Null means fine.</summary>
    public static string? ValidateCard(string? brand, string? last4, string? expiry, DateOnly today)
    {
        if (brand is null || !CardBrands.Contains(brand)) return "brand";
        if (last4 is null || last4.Length != 4 || !last4.All(char.IsAsciiDigit)) return "last4";
        var m = expiry is null ? null : ExpiryPattern().Match(expiry);
        if (m is null || !m.Success || int.Parse(m.Groups[1].Value) is < 1 or > 12) return "expiry";
        var ym = $"20{m.Groups[2].Value}-{m.Groups[1].Value}";
        return string.CompareOrdinal(ym, today.ToString("yyyy-MM")) < 0 ? "expired" : null;
    }

    [GeneratedRegex(@"^(\d{2})/(\d{2})$")]
    private static partial Regex ExpiryPattern();

    public static bool CardExpired(string expiry, DateOnly today) => ValidateCard("visa", "0000", expiry, today) == "expired";

    /// <summary>Permissions kept to the known set; any permission at all implies <c>view</c>, which the helper needs for everything.</summary>
    public static string[] NormalizePermissions(IEnumerable<string>? requested)
    {
        var asked = (requested ?? []).ToHashSet();
        return Permissions.Where(x => asked.Contains(x) || (x == "view" && asked.Count > 0)).ToArray();
    }

    public static string Trunc(string? s, int max) => s is null ? "" : s.Length <= max ? s : s[..max];
}

public sealed record EmergencyInput(string? Name, string? Phone, string? Relationship);

public sealed record ProfileInput(
    string? FirstName,
    string? LastName,
    string? Dob,
    string? Email,
    string? Phone,
    string? Citizenship,
    string[]? Dietary,
    string[]? Needs,
    string? Bedding,
    string? SpecialRequests,
    EmergencyInput? Emergency);
