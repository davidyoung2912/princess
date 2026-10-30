using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Mirrors <c>src/domain/account.test.ts</c>.</summary>
public class AccountRulesTests
{
    private static readonly DateOnly Today = new(2027, 3, 7);

    [Theory]
    [InlineData("Gerald Whitfield", "Gerald Whitfeld", 60, NameChangeResult.Allowed)]
    [InlineData("Gerald Whitfield", "gerald whitfield", 5, NameChangeResult.Allowed)]
    [InlineData("Gerald Whitfield", "Gerald Whitfeld", 5, NameChangeResult.Late)]
    [InlineData("Gerald Whitfield", "Gerald Whitfeld", 13, NameChangeResult.Late)]
    [InlineData("Gerald Whitfield", "Gerald Whitfeld", 14, NameChangeResult.Allowed)]
    [InlineData("Gerald Whitfield", "Paul Jones", 60, NameChangeResult.Large)]
    public void NameChangeRules(string before, string after, int days, NameChangeResult expected) =>
        Assert.Equal(expected, AccountRules.NameChange(before, after, days));

    [Theory]
    [InlineData("visa", "4242", "09/29", null)]
    [InlineData("visa", "424", "09/29", "last4")]
    [InlineData("visa", "4242", "13/29", "expiry")]
    [InlineData("visa", "4242", "9/29", "expiry")]
    [InlineData("visa", "4242", "02/27", "expired")]
    [InlineData("visa", "4242", "03/27", null)] // good through the end of its month
    [InlineData("diners", "4242", "09/29", "brand")]
    [InlineData("visa", "42a2", "09/29", "last4")]
    public void CardChecks(string brand, string last4, string expiry, string? expected) =>
        Assert.Equal(expected, AccountRules.ValidateCard(brand, last4, expiry, Today));

    private static ProfileInput Good(string email = "gerald@example.com") =>
        new("Gerald", "Whitfield", "1950-01-15", email, "555-0103", "us", [], [], "noPreference", "", new EmergencyInput("Sam Example", "555-0104", "Friend"));

    [Fact]
    public void AGoodProfileHasNoProblems() => Assert.Empty(AccountRules.ValidateProfile(Good(), Today, false));

    [Fact]
    public void ReportsEachProblemByField()
    {
        var bad = Good("nope") with { FirstName = " ", Dob = "2030-01-01", Phone = "abc", Emergency = new EmergencyInput("Sam", "", "Friend") };
        var errors = AccountRules.ValidateProfile(bad, Today, false);
        Assert.Equal("required", errors["firstName"]);
        Assert.Equal("future", errors["dob"]);
        Assert.Equal("email", errors["email"]);
        Assert.Equal("phone", errors["phone"]);
        Assert.Equal("pair", errors["emergencyPhone"]);
    }

    [Fact]
    public void ADateThatDoesNotExistIsADateProblem()
    {
        Assert.Equal("date", AccountRules.ValidateProfile(Good() with { Dob = "2027-02-30" }, Today, false)["dob"]);
        Assert.Equal("required", AccountRules.ValidateProfile(Good() with { Dob = "" }, Today, false)["dob"]);
    }

    [Fact]
    public void ContactDetailsAreOptionalForChildrenOnly()
    {
        Assert.DoesNotContain("email", AccountRules.ValidateProfile(Good("") with { Phone = "" }, Today, child: true));
        Assert.Equal("required", AccountRules.ValidateProfile(Good(""), Today, child: false)["email"]);
    }

    [Theory]
    [InlineData("1950-03-07", "2027-03-07", 77)]
    [InlineData("1950-03-08", "2027-03-07", 76)]
    [InlineData("2018-12-31", "2027-03-21", 8)]
    public void AgeIsWholeYears(string dob, string day, int expected) =>
        Assert.Equal(expected, AccountRules.AgeOn(DateOnly.Parse(dob), DateOnly.Parse(day)));

    [Theory]
    [InlineData("555-0100", true)]
    [InlineData("+1 (555) 010-0100", true)]
    [InlineData("12345", false)]
    [InlineData("call me", false)]
    [InlineData("", false)]
    public void PhoneNumbers(string phone, bool ok) => Assert.Equal(ok, AccountRules.PhoneOk(phone));

    [Fact]
    public void AnyPermissionImpliesViewAndUnknownOnesAreDropped()
    {
        Assert.Equal(["view", "payments"], AccountRules.NormalizePermissions(["payments", "root"]));
        Assert.Empty(AccountRules.NormalizePermissions(null));
        Assert.Equal(["view"], AccountRules.NormalizePermissions(["bogus"]));
    }
}
