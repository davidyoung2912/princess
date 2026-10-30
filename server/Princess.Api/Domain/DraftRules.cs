using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

public sealed class GuestDraft
{
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Dob { get; set; } = "";
    public string Gender { get; set; } = "";
    public string Citizenship { get; set; } = "";
    public string[] Needs { get; set; } = [];
    public string DietaryStatus { get; set; } = "";
    public string[] Dietary { get; set; } = [];
    public string AllergyNote { get; set; } = "";
}

public sealed class LeadContact
{
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Street { get; set; } = "";
    public string City { get; set; } = "";
    public string Region { get; set; } = "";
    public string Postcode { get; set; } = "";
    public string Country { get; set; } = "United States";
}

/// <summary>The booking funnel's answers, as <c>Draft</c> in <c>src/domain/booking.ts</c>. Always passed through <see cref="DraftRules.Normalize"/> before use.</summary>
public sealed class Draft
{
    public string Id { get; set; } = "";
    public string SailingId { get; set; } = "";
    public string Category { get; set; } = "";
    public int Guests { get; set; }
    public string CabinMode { get; set; } = "guaranteed";
    public string CabinNumber { get; set; } = "";
    public string Fare { get; set; } = "";
    public List<GuestDraft> People { get; set; } = [];
    public LeadContact Contact { get; set; } = new();
    public string Dining { get; set; } = "";
    public string Occasion { get; set; } = "none";
    public string LoyaltyNumber { get; set; } = "";
    public bool UseCredit { get; set; }
    public Dictionary<string, bool> Accepted { get; set; } = [];
    public long UpdatedAt { get; set; }
}

public sealed record Problem(string Path, string Code);

/// <summary>Ported from <c>src/domain/booking.ts</c>: cleaning an untrusted draft, and the rules that say a step is complete.</summary>
public static partial class DraftRules
{
    public static readonly string[] Steps = ["sailing", "room", "fare", "guests", "dining", "review", "pay"];
    public static readonly string[] Genders = ["F", "M", "X"];
    public static readonly string[] DiningChoices = ["anytime", "early", "late"];
    public static readonly string[] Occasions = ["none", "birthday", "anniversary", "honeymoon", "other"];
    public const int MinAgeMonths = 6;
    public const int AdultAgeInRoom = 21;
    public const int LeadAge = 18;

    [GeneratedRegex(@"^\p{L}[\p{L}\s'’.-]*$")]
    private static partial Regex NameRx();

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex EmailRx();

    public static GuestDraft BlankGuest() => new();

    private static string Str(string? v, int max = 120) => v is null ? "" : v.Length <= max ? v : v[..max];

    private static string Pick(IEnumerable<string> allowed, string? v, string fallback) => v is not null && allowed.Contains(v) ? v : fallback;

    private static string[] Picks(IEnumerable<string> allowed, string[]? v) => v is null ? [] : [.. v.Where(x => x is not null && allowed.Contains(x)).Distinct()];

    private static GuestDraft NormalizeGuest(GuestDraft? g)
    {
        g ??= new();
        return new GuestDraft
        {
            FirstName = Str(g.FirstName, 60), LastName = Str(g.LastName, 60), Dob = Str(g.Dob, 10),
            Gender = Pick(Genders, g.Gender, ""),
            Citizenship = g.Citizenship is "us" or "other" ? g.Citizenship : "",
            Needs = Picks(AccountRules.Needs, g.Needs),
            DietaryStatus = Pick(["none", "some"], g.DietaryStatus, ""),
            Dietary = Picks(AccountRules.Dietary, g.Dietary),
            AllergyNote = Str(g.AllergyNote, 300),
        };
    }

    /// <summary>Sets the number of guests, keeping the people already entered and adding blanks (or dropping the end).</summary>
    public static void Resize(Draft draft, int guests)
    {
        var n = Math.Min(Pricing.MaxGuests, Math.Max(1, guests));
        draft.Guests = n;
        draft.People = [.. Enumerable.Range(0, n).Select(i => i < draft.People.Count ? draft.People[i] : BlankGuest())];
    }

    /// <summary>A draft from untrusted submitted or stored data: anything unknown falls back to empty, and the people always match the guest count.</summary>
    public static Draft Normalize(Draft? raw, IReadOnlySet<string> knownSailings)
    {
        raw ??= new();
        var category = Pricing.Category(raw.Category) is not null ? raw.Category : "";
        var c = raw.Contact ?? new();
        var d = new Draft
        {
            Id = Str(raw.Id, 40),
            SailingId = raw.SailingId is not null && knownSailings.Contains(raw.SailingId) ? raw.SailingId : "",
            Category = category,
            CabinMode = raw.CabinMode == "pick" ? "pick" : "guaranteed",
            CabinNumber = Str(raw.CabinNumber, 8),
            Fare = raw.Fare is not null && Pricing.Fare(raw.Fare) is not null ? raw.Fare : "",
            People = [.. (raw.People ?? []).Take(Pricing.MaxGuests).Select(NormalizeGuest)],
            Contact = new LeadContact
            {
                Email = Str(c.Email), Phone = Str(c.Phone, 30), Street = Str(c.Street), City = Str(c.City), Region = Str(c.Region), Postcode = Str(c.Postcode, 12),
                Country = Str(c.Country) is { Length: > 0 } country ? country : "United States",
            },
            Dining = Pick(DiningChoices, raw.Dining, ""),
            Occasion = Pick(Occasions, raw.Occasion, "none"),
            LoyaltyNumber = Str(raw.LoyaltyNumber, 9).Trim().ToUpperInvariant(),
            UseCredit = raw.UseCredit,
            Accepted = PolicyRules.LegalIds.Where(id => raw.Accepted?.GetValueOrDefault(id) == true).ToDictionary(id => id, _ => true),
            UpdatedAt = raw.UpdatedAt > 0 ? raw.UpdatedAt : 0,
        };
        Resize(d, raw.Guests >= 1 ? raw.Guests : d.People.Count > 0 ? d.People.Count : 2);
        // A room type that cannot hold the party, a fare it cannot take, or a pick with no number are cleared rather than kept.
        var cap = category.Length > 0 ? Pricing.CapacityOf(category) : Pricing.MaxGuests;
        if (d.Guests > cap) Resize(d, cap);
        if (category.Length > 0 && d.Fare.Length > 0 && !Pricing.FareOptions(category).Contains(d.Fare)) d.Fare = "";
        if (category.Length > 0 && d.Fare.Length == 0) d.Fare = Pricing.FareIncluded(category) ?? "";
        return d;
    }

    /// <summary>Whole months between a birth date and a day.</summary>
    public static int MonthsOn(DateOnly dob, DateOnly day) => (day.Year - dob.Year) * 12 + (day.Month - dob.Month) - (day.Day < dob.Day ? 1 : 0);

    private static DateOnly D(string s) => DateOnly.ParseExact(s, "yyyy-MM-dd");

    /// <summary>What is missing or wrong on a step, by field. Empty when the step is complete.</summary>
    public static List<Problem> StepProblems(Draft draft, string step, string? departure, string today, IReadOnlySet<string> knownSailings)
    {
        var out_ = new List<Problem>();
        void Need(string path, string code = "required") => out_.Add(new Problem(path, code));
        switch (step)
        {
            case "sailing":
                if (!knownSailings.Contains(draft.SailingId)) Need("sailingId", "choose");
                break;
            case "room":
                if (Pricing.Category(draft.Category) is null) Need("category", "choose");
                else if (draft.Guests > Pricing.CapacityOf(draft.Category)) Need("guests", "capacity");
                if (draft.CabinMode == "pick" && draft.CabinNumber.Length == 0) Need("cabinNumber", "choose");
                break;
            case "fare":
                if (draft.Category.Length == 0 || draft.Fare.Length == 0 || !Pricing.FareOptions(draft.Category).Contains(draft.Fare)) Need("fare", "choose");
                break;
            case "guests":
            {
                for (var i = 0; i < draft.People.Count; i++)
                {
                    var g = draft.People[i];
                    string P(string f) => $"people.{i}.{f}";
                    if (g.FirstName.Trim().Length == 0) Need(P("firstName"));
                    else if (!NameRx().IsMatch(g.FirstName.Trim())) Need(P("firstName"), "name");
                    if (g.LastName.Trim().Length == 0) Need(P("lastName"));
                    else if (!NameRx().IsMatch(g.LastName.Trim())) Need(P("lastName"), "name");
                    if (g.Dob.Length == 0) Need(P("dob"));
                    else if (!AccountRules.IsIsoDate(g.Dob)) Need(P("dob"), "date");
                    else if (string.CompareOrdinal(g.Dob, today) > 0) Need(P("dob"), "future");
                    else if (departure is not null && MonthsOn(D(g.Dob), D(departure)) < MinAgeMonths) Need(P("dob"), "tooYoung");
                    else if (departure is not null && i == 0 && AccountRules.AgeOn(D(g.Dob), D(departure)) < LeadAge) Need(P("dob"), "leadAge");
                    if (g.Gender.Length == 0) Need(P("gender"), "choose");
                    if (g.Citizenship.Length == 0) Need(P("citizenship"), "choose");
                }
                var dobs = draft.People.Select(g => g.Dob).Where(AccountRules.IsIsoDate).ToList();
                if (departure is not null && dobs.Count == draft.People.Count && !dobs.Any(d => AccountRules.AgeOn(D(d), D(departure)) >= AdultAgeInRoom)) Need("people", "noAdult");
                var c = draft.Contact;
                if (c.Email.Trim().Length == 0) Need("contact.email");
                else if (!EmailRx().IsMatch(c.Email.Trim())) Need("contact.email", "email");
                if (c.Phone.Trim().Length == 0) Need("contact.phone");
                else if (!AccountRules.PhoneOk(c.Phone)) Need("contact.phone", "phone");
                if (c.Street.Trim().Length == 0) Need("contact.street");
                if (c.City.Trim().Length == 0) Need("contact.city");
                if (c.Postcode.Trim().Length == 0) Need("contact.postcode");
                if (c.Country.Trim().Length == 0) Need("contact.country");
                break;
            }
            case "dining":
                if (draft.Dining.Length == 0) Need("dining", "choose");
                for (var i = 0; i < draft.People.Count; i++)
                {
                    var g = draft.People[i];
                    if (g.DietaryStatus.Length == 0) Need($"people.{i}.dietaryStatus", "choose");
                    else if (g.DietaryStatus == "some" && g.Dietary.Length == 0 && g.AllergyNote.Trim().Length == 0) Need($"people.{i}.dietary", "detail");
                }
                break;
            case "review":
                foreach (var id in PolicyRules.LegalIds) if (draft.Accepted.GetValueOrDefault(id) != true) Need($"accepted.{id}", "accept");
                break;
        }
        return out_;
    }

    public static bool Complete(Draft draft, string? departure, string today, IReadOnlySet<string> knownSailings) =>
        Steps.All(s => StepProblems(draft, s, departure, today, knownSailings).Count == 0);

    /// <summary>"j***@example.com", for showing where a message went without printing the whole address.</summary>
    public static string MaskEmail(string email)
    {
        var at = email.IndexOf('@');
        return at < 0 || at == email.Length - 1 ? "***" : $"{email[..Math.Min(1, at)]}***{email[at..]}";
    }

    /// <summary>"***-0142" for a phone number.</summary>
    public static string MaskPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsAsciiDigit).ToArray());
        return $"***-{(digits.Length > 4 ? digits[^4..] : digits)}";
    }
}
