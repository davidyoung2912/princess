using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Mirrors the <c>drafts</c> cases of <c>src/domain/booking.test.ts</c>.</summary>
public class DraftRulesTests
{
    private static readonly HashSet<string> Known = ["sun-2027-03-21", "sun-2027-02-07"];
    private const string Departure = "2027-03-21";
    private const string Today = "2026-10-29";

    private static GuestDraft Person(string first, string dob) => new()
    {
        FirstName = first, LastName = "Whitfield", Dob = dob, Gender = "M", Citizenship = "us", DietaryStatus = "none",
    };

    private static Draft Complete() => new()
    {
        Id = "d1", SailingId = "sun-2027-03-21", Category = "balcony", Guests = 2, Fare = "plus", Dining = "anytime",
        People = [Person("Gerald", "1950-05-05"), Person("Linda", "1952-06-06")],
        Contact = new LeadContact { Email = "g@example.com", Phone = "555 010 0142", Street = "1 Main St", City = "Reno", Postcode = "89501", Country = "United States" },
        Accepted = PolicyRules.LegalIds.ToDictionary(id => id, _ => true),
    };

    private static List<Problem> Problems(Draft d, string step) => DraftRules.StepProblems(d, step, Departure, Today, Known);

    [Fact]
    public void TurnsAnythingSubmittedIntoASafeDraftWithPeopleMatchingTheGuestCount()
    {
        var d = DraftRules.Normalize(null, Known);
        Assert.Equal(2, d.Guests);
        Assert.Equal(2, d.People.Count);
        Assert.Equal("guaranteed", d.CabinMode);
        Assert.Equal("none", d.Occasion);
        Assert.Equal("United States", d.Contact.Country);

        var messy = DraftRules.Normalize(new Draft
        {
            SailingId = "sun-1999-01-01", Category = "palace", Fare = "gold", Dining = "brunch", Occasion = "party", CabinMode = "swim", Guests = 9,
            LoyaltyNumber = "cc1234567 ", Accepted = new() { ["terms"] = true, ["bogus"] = true },
            People = [new GuestDraft { FirstName = new string('x', 200), Gender = "Q", Citizenship = "mars", Needs = ["mobility", "jetpack"], Dietary = ["vegan", "vegan", "pizza"] }],
        }, Known);
        Assert.Equal("", messy.SailingId);
        Assert.Equal("", messy.Category);
        Assert.Equal("", messy.Fare);
        Assert.Equal("", messy.Dining);
        Assert.Equal("none", messy.Occasion);
        Assert.Equal("guaranteed", messy.CabinMode);
        Assert.Equal(4, messy.Guests);
        Assert.Equal(4, messy.People.Count);
        Assert.Equal("CC1234567", messy.LoyaltyNumber);
        Assert.Equal(["terms"], messy.Accepted.Keys);
        Assert.Equal(60, messy.People[0].FirstName.Length);
        Assert.Equal("", messy.People[0].Gender);
        Assert.Equal("", messy.People[0].Citizenship);
        Assert.Equal(["mobility"], messy.People[0].Needs);
        Assert.Equal(["vegan"], messy.People[0].Dietary);
    }

    [Fact]
    public void KeepsEnteredPeopleWhenTheGuestCountChanges()
    {
        var d = Complete();
        d.Guests = 3;
        var three = DraftRules.Normalize(d, Known);
        Assert.Equal(3, three.People.Count);
        Assert.Equal("Gerald", three.People[0].FirstName);
        Assert.Equal("", three.People[2].FirstName);
        three.Guests = 1;
        Assert.Equal("Gerald", DraftRules.Normalize(three, Known).People.Single().FirstName);
    }

    [Fact]
    public void ARoomThatCannotHoldThePartyOrTakeTheFareIsClearedAndASuiteGetsItsIncludedFare()
    {
        var suite = Complete();
        suite.Category = "signatureSuite";
        suite.Guests = 4;
        suite.Fare = "plus";
        var n = DraftRules.Normalize(suite, Known);
        Assert.Equal(3, n.Guests);
        Assert.Equal("premier", n.Fare);

        var open = Complete();
        open.Fare = "";
        Assert.Equal("", DraftRules.Normalize(open, Known).Fare);
        open.Category = "sanctuaryMiniSuite";
        Assert.Equal("premier", DraftRules.Normalize(open, Known).Fare);
    }

    [Fact]
    public void ReportsNothingOnACompleteDraftAndFindsWhatIsMissingOnEachStep()
    {
        var d = Complete();
        Assert.True(DraftRules.Complete(d, Departure, Today, Known));

        var blank = DraftRules.Normalize(null, Known);
        Assert.Equal("sailingId", Problems(blank, "sailing").Single().Path);
        Assert.Equal("category", Problems(blank, "room").Single().Path);
        Assert.Equal("fare", Problems(blank, "fare").Single().Path);
        Assert.Contains(Problems(blank, "guests"), p => p.Path == "people.0.firstName" && p.Code == "required");
        Assert.Contains(Problems(blank, "dining"), p => p.Path == "dining" && p.Code == "choose");
        Assert.Equal(4, Problems(blank, "review").Count);
        Assert.Empty(Problems(blank, "pay"));
    }

    [Fact]
    public void ChecksNamesBirthDatesAgesAndContactDetails()
    {
        var d = Complete();
        d.People[0].FirstName = "G3rald";
        d.People[1].Dob = "2027-13-45";
        d.Contact.Email = "nope";
        d.Contact.Phone = "12";
        var codes = Problems(d, "guests").ToDictionary(p => p.Path, p => p.Code);
        Assert.Equal("name", codes["people.0.firstName"]);
        Assert.Equal("date", codes["people.1.dob"]);
        Assert.Equal("email", codes["contact.email"]);
        Assert.Equal("phone", codes["contact.phone"]);

        d = Complete();
        d.People[1].Dob = "2030-01-01";
        Assert.Equal("future", Problems(d, "guests").Single(p => p.Path == "people.1.dob").Code);
    }

    [Fact]
    public void NeedsOneGuest21OrOlderAnAdultToBookAndBabiesOfAtLeastSixMonths()
    {
        var d = Complete();
        d.People = [Person("Kid", "2010-01-01"), Person("Teen", "2012-01-01")];
        Assert.Contains(Problems(d, "guests"), p => p is { Path: "people", Code: "noAdult" });
        Assert.Contains(Problems(d, "guests"), p => p is { Path: "people.0.dob", Code: "leadAge" });

        d = Complete();
        d.People[1].Dob = "2026-10-01";   // 5 months old on 2027-03-21
        Assert.Contains(Problems(d, "guests"), p => p is { Path: "people.1.dob", Code: "tooYoung" });
        d.People[1].Dob = "2026-09-21";   // exactly 6 months
        Assert.DoesNotContain(Problems(d, "guests"), p => p.Path == "people.1.dob");
    }

    [Fact]
    public void RequiresAnExplicitDietaryAnswerForEachGuestWithDetailWhenThereAreNeeds()
    {
        var d = Complete();
        d.People[0].DietaryStatus = "";
        d.People[1].DietaryStatus = "some";
        var codes = Problems(d, "dining").ToDictionary(p => p.Path, p => p.Code);
        Assert.Equal("choose", codes["people.0.dietaryStatus"]);
        Assert.Equal("detail", codes["people.1.dietary"]);
        d.People[1].AllergyNote = "Peanuts";
        Assert.DoesNotContain(Problems(d, "dining"), p => p.Path == "people.1.dietary");
    }

    [Fact]
    public void ARoomStepNeedsANumberWhenPickingAndRespectsCapacity()
    {
        var d = Complete();
        d.CabinMode = "pick";
        Assert.Equal("cabinNumber", Problems(d, "room").Single().Path);
        d.CabinNumber = "8188";
        Assert.Empty(Problems(d, "room"));
        d.Category = "signatureSuite";
        d.Guests = 4;
        Assert.Equal("capacity", Problems(d, "room").Single().Code);
    }

    [Fact]
    public void HidesTheMiddleOfAnAddressOrNumber()
    {
        Assert.Equal("j***@example.com", DraftRules.MaskEmail("jane@example.com"));
        Assert.Equal("***", DraftRules.MaskEmail("nonsense"));
        Assert.Equal("***-0142", DraftRules.MaskPhone("+1 (555) 010-0142"));
    }
}
