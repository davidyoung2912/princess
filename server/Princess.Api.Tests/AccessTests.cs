using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

public class AccessTests
{
    private readonly InMemoryAccessStore _store = new();
    private readonly AccessService _access;
    private readonly UserRecord _adult = new() { Id = 1, PublicId = Guid.NewGuid() };
    private readonly UserRecord _other = new() { Id = 2, PublicId = Guid.NewGuid() };
    private readonly UserRecord _child = new() { Id = 3, PublicId = Guid.NewGuid(), IsSupervised = true, BookerUserId = 1 };

    public AccessTests()
    {
        _access = new AccessService(_store);
        var booking = new BookingMembership { BookingId = 10, Number = "PC163342", BookerUserId = 1 };
        _store.Members.Add((1, booking));
        _store.Members.Add((3, booking));
        _store.Members.Add((2, new BookingMembership { BookingId = 11, Number = "PC179254", BookerUserId = 2 }));
    }

    [Theory]
    [InlineData("pc163342", "PC163342")]
    [InlineData(" PC-1633 42 ", "PC163342")]
    [InlineData("pc16334", null)]
    [InlineData("PC1633421", null)]
    [InlineData("PC16334!", null)]
    [InlineData(null, null)]
    public void NormalizesBookingNumbers(string? input, string? expected) =>
        Assert.Equal(expected, AccessRules.NormalizeBookingNumber(input));

    [Fact]
    public async Task MemberGetsTheBooking() =>
        Assert.Equal(10, (await _access.RequireMemberAsync(_adult, "pc-163342", default)).BookingId);

    [Theory]
    [InlineData("PC179254")] // exists, but not theirs
    [InlineData("PC000000")] // does not exist
    [InlineData("nonsense")]
    public async Task NonMemberAndMissingBookingLookIdentical(string number)
    {
        var e = await Assert.ThrowsAsync<ApiException>(() => _access.RequireMemberAsync(_adult, number, default));
        Assert.Equal((ApiErrorCode.NotFound, 404), (e.Code, e.Status));
    }

    [Fact]
    public async Task SupervisedChildIsMemberButNotAdult()
    {
        await _access.RequireMemberAsync(_child, "PC163342", default);
        var e = await Assert.ThrowsAsync<ApiException>(() => _access.RequireAdultMemberAsync(_child, "PC163342", default));
        Assert.Equal((ApiErrorCode.Forbidden, "supervised"), (e.Code, e.Title));
    }

    [Fact]
    public async Task OnlyTheBookerPassesBookerOnly()
    {
        var guest = new UserRecord { Id = 4, PublicId = Guid.NewGuid() };
        _store.Members.Add((4, new BookingMembership { BookingId = 10, Number = "PC163342", BookerUserId = 1 }));
        await _access.RequireBookerAsync(_adult, "PC163342", default);
        var e = await Assert.ThrowsAsync<ApiException>(() => _access.RequireBookerAsync(guest, "PC163342", default));
        Assert.Equal(403, e.Status);
    }

    [Fact]
    public void ParentRuleNeedsTheRealBooker()
    {
        AccessService.RequireParentOf(_adult, _child);
        Assert.Equal(403, Assert.Throws<ApiException>(() => AccessService.RequireParentOf(_other, _child)).Status);
        Assert.Equal(403, Assert.Throws<ApiException>(() => AccessService.RequireParentOf(_adult, _other)).Status);
        // A child cannot act as anyone's parent, even if the ids line up.
        var odd = new UserRecord { Id = 1, IsSupervised = true };
        Assert.Equal(403, Assert.Throws<ApiException>(() => AccessService.RequireParentOf(odd, _child)).Status);
    }

    [Theory]
    [InlineData("view,documents", "active", HelperPermission.Documents, true)]
    [InlineData("view,documents", "active", HelperPermission.Payments, false)]
    [InlineData("documents,payments", "active", HelperPermission.Documents, false)] // no view
    [InlineData("view, payments", "active", HelperPermission.Payments, true)]
    [InlineData("view,documents,payments,profile", "revoked", HelperPermission.Profile, false)]
    [InlineData("view,documents,payments,profile", "requested", HelperPermission.Profile, false)]
    public void HelperPermissionRules(string permissions, string status, HelperPermission needed, bool allowed) =>
        Assert.Equal(allowed, AccessRules.HelperAllows(new HelperGrant { Permissions = permissions, Status = status }, needed));

    [Fact]
    public void NoGrantMeansNoAccess() => Assert.False(AccessRules.HelperAllows(null, HelperPermission.Documents));

    [Fact]
    public async Task SelfOrHelper()
    {
        await _access.RequireSelfOrHelperAsync(_adult, _adult, HelperPermission.Documents, default);

        var e = await Assert.ThrowsAsync<ApiException>(() => _access.RequireSelfOrHelperAsync(_other, _adult, HelperPermission.Documents, default));
        Assert.Equal(403, e.Status);

        _store.Helpers.Add((2, 1, new HelperGrant { Permissions = "view,documents", Status = "active" }));
        await _access.RequireSelfOrHelperAsync(_other, _adult, HelperPermission.Documents, default);
        await Assert.ThrowsAsync<ApiException>(() => _access.RequireSelfOrHelperAsync(_other, _adult, HelperPermission.Payments, default));
    }
}
