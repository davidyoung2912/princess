using Princess.Api.Domain;

namespace Princess.Api.Tests;

public class DocumentRulesTests
{
    private static readonly DateOnly Return = new(2027, 3, 28);

    private static DocumentRules.Held Held(params (string doc, string? expires)[] docs)
    {
        var h = new DocumentRules.Held();
        foreach (var (doc, expires) in docs) h[doc] = expires;
        return h;
    }

    [Fact]
    public void ForeignCitizensNeedAPassport()
    {
        var r = DocumentRules.RequirementsFor("other", 40);
        Assert.Equal(["passport", "insurance"], r.Select(x => x.Id));
        Assert.Equal("required", r[0].Level);
    }

    [Fact]
    public void UsAdultsNeedProofOfCitizenshipAndPhotoId()
    {
        var ids = DocumentRules.RequirementsFor("us", 16).Select(x => x.Id);
        Assert.Equal(["proofOfCitizenship", "photoId", "passport", "insurance"], ids);
    }

    [Fact]
    public void UsChildrenUnderSixteenNeedNoPhotoId() =>
        Assert.DoesNotContain("photoId", DocumentRules.RequirementsFor("us", 15).Select(x => x.Id));

    [Theory]
    [InlineData("2027-09-28", "ok")]       // six months past 28 March is 28 September
    [InlineData("2027-09-27", "tooSoon")]
    [InlineData("2027-08-14", "tooSoon")]  // Gerald's passport: after the return, but not by six months
    [InlineData("2027-03-27", "expired")]
    public void PassportMustLastSixMonthsPastTheReturn(string expires, string expected) =>
        Assert.Equal(expected, DocumentRules.DocStatus("passport", Held(("passport", expires)), Return));

    [Fact]
    public void OtherDatedDocumentsOnlyNeedToCoverTheReturn()
    {
        Assert.Equal("ok", DocumentRules.DocStatus("photoId", Held(("photoId", "2027-03-28")), Return));
        Assert.Equal("expired", DocumentRules.DocStatus("photoId", Held(("photoId", "2027-03-27")), Return));
    }

    [Fact]
    public void ABirthCertificateHasNoExpiry() =>
        Assert.Equal("ok", DocumentRules.DocStatus("birthCertificate", Held(("birthCertificate", null)), Return));

    [Fact]
    public void ADatedDocumentWithoutADateIsAProblemNotMissing()
    {
        var r = DocumentRules.CheckRequirement(new("photoId", "required", ["photoId"]), Held(("photoId", null)), Return);
        Assert.Equal("problem", r.Status);
        Assert.Equal("noExpiry", r.Problem);
    }

    [Fact]
    public void AnyAcceptedDocumentMeetsARequirement()
    {
        var r = DocumentRules.CheckRequirement(new("proofOfCitizenship", "required", ["passport", "birthCertificate"]), Held(("birthCertificate", null)), Return);
        Assert.Equal("ready", r.Status);
        Assert.Equal("birthCertificate", r.UsedDoc);
    }

    [Fact]
    public void BlockingCountsOnlyRequiredItemsThatAreNotReady()
    {
        var docs = DocumentRules.ForGuest("us", 40, Held(("passport", "2027-08-14")), Return);
        // The proof and photo ID are met by the passport only if it is in date; it is too soon, so both are blocking. Insurance (optional) is not.
        Assert.Equal(2, docs.Blocking);
        Assert.False(docs.Ready);
        Assert.True(DocumentRules.PassportProblem(docs));
    }

    [Fact]
    public void AGuestWithGoodDocumentsIsReady()
    {
        var docs = DocumentRules.ForGuest("us", 40, Held(("passport", "2031-05-01")), Return);
        Assert.True(docs.Ready);
        Assert.Equal(0, docs.Blocking);
        Assert.False(DocumentRules.PassportProblem(docs));
    }

    [Fact]
    public void NothingHeldMeansEveryRequiredItemIsMissing()
    {
        var docs = DocumentRules.ForGuest("us", 40, Held(), Return);
        Assert.Equal(2, docs.Blocking);
        Assert.All(docs.Results.Where(r => r.Requirement.Level == "required"), r => Assert.Equal("missing", r.Status));
    }
}
