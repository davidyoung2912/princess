using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public sealed class AccountService(
    AccessService access, SubjectAccess subjects, IAccountStore accounts, ITripStore trips, IUserClock clock)
{
    private static DateOnly D(DateTime d) => DateOnly.FromDateTime(d);

    public static string FullName(GuestRow g) => $"{g.FirstName} {g.LastName}".Trim();

    public async Task<List<PartyMemberDto>> PartyAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var m = await access.RequireMemberAsync(actor, number, ct);
        var booking = await trips.GetAsync(m.BookingId, ct) ?? throw ApiException.NotFound();
        var departure = D(booking.Departure);
        return (await accounts.GetPartyAsync(m.BookingId, ct))
            .Select(g => new PartyMemberDto(g.PublicId, FullName(g), AccountRules.AgeOn(D(g.Dob), departure), g.IsSupervised))
            .ToList();
    }

    public async Task<ProfileViewDto> ProfileAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var s = await subjects.ResolveAsync(actor, id, HelperPermission.Profile, write: false, ct);
        return await ViewAsync(actor, s, ct);
    }

    public async Task<ProfileViewDto> SaveProfileAsync(UserRecord actor, Guid id, ProfileInput input, CancellationToken ct)
    {
        var s = await subjects.ResolveAsync(actor, id, HelperPermission.Profile, write: true, ct);
        var now = await clock.NowAsync(actor, ct);
        var today = TripRules.Today(now);
        var child = s.Target.IsSupervised;

        if (AccountRules.ValidateProfile(input, today, child).Count > 0) throw ApiException.Invalid();
        var before = await accounts.GetProfileAsync(s.Target.Id, ct) ?? throw ApiException.NotFound();

        var next = new ProfileRecord
        {
            UserId = s.Target.Id,
            FirstName = AccountRules.Trunc(input.FirstName?.Trim(), 60),
            LastName = AccountRules.Trunc(input.LastName?.Trim(), 60),
            Dob = DateOnly.ParseExact(input.Dob!, "yyyy-MM-dd").ToDateTime(TimeOnly.MinValue),
            Email = AccountRules.Trunc(input.Email?.Trim(), 120),
            Phone = AccountRules.Trunc(input.Phone?.Trim(), 30),
            Citizenship = input.Citizenship == "other" ? "other" : "us",
            Bedding = input.Bedding is not null && AccountRules.Bedding.Contains(input.Bedding) ? input.Bedding : before.Bedding,
            SpecialRequests = AccountRules.Trunc(input.SpecialRequests, 500),
            // MNG-16: which saved preferences stay out of later bookings. Left alone when the request does not say.
            KeepOut = input.KeepOut is null ? before.KeepOut : string.Join(',', AccountRules.KeepOutGroups.Where(input.KeepOut.Contains)),
            EmergencyName = AccountRules.Trunc(input.Emergency?.Name?.Trim(), 80),
            EmergencyPhone = AccountRules.Trunc(input.Emergency?.Phone?.Trim(), 30),
            EmergencyRelationship = AccountRules.Trunc(input.Emergency?.Relationship?.Trim(), 40),
            Dietary = Pick(AccountRules.Dietary, input.Dietary),
            Needs = Pick(AccountRules.Needs, input.Needs),
        };

        // The name rules need the booking's departure; a person with no booking has nothing to protect.
        var days = DaysToDeparture(s.Booking, today);
        var rule = AccountRules.NameChange($"{before.FirstName} {before.LastName}", $"{next.FirstName} {next.LastName}", days);
        if (rule != NameChangeResult.Allowed) throw ApiException.Conflict(rule == NameChangeResult.Late ? "late" : "large");

        // The email is the sign-in name, so only the person themself changes it; a booker or helper editing someone else leaves it alone.
        var self = actor.Id == s.Target.Id && !s.Target.IsSupervised;
        await accounts.SaveProfileAsync(next, updateEmail: self, now, ct);
        await accounts.AddHistoryAsync(s.Target.Id, actor.Id, "profile", $"{next.FirstName} {next.LastName}".Trim(), now, ct);
        return await ViewAsync(actor, s, ct);
    }

    private async Task<ProfileViewDto> ViewAsync(UserRecord actor, Subject s, CancellationToken ct)
    {
        var p = await accounts.GetProfileAsync(s.Target.Id, ct) ?? throw ApiException.NotFound();
        var today = TripRules.Today(await clock.NowAsync(actor, ct));
        var canEdit = await CanEditAsync(actor, s);
        return new ProfileViewDto(ToDto(p), s.Target.PublicId, canEdit, DaysToDeparture(s.Booking, today));
    }

    private Task<bool> CanEditAsync(UserRecord actor, Subject s) =>
        Task.FromResult(!actor.IsSupervised && (actor.Id == s.Target.Id || s.Target.BookerUserId == actor.Id || s.Booking?.BookerUserId == actor.Id || s.ViaHelper));

    public const int NoBookingDays = 9999;

    public static int DaysToDeparture(SharedBooking? b, DateOnly today) => b is null ? NoBookingDays : TripRules.DaysBetween(today, D(b.Departure));

    public static ProfileDto ToDto(ProfileRecord p) => new(
        p.FirstName, p.LastName, D(p.Dob).ToString("yyyy-MM-dd"), p.Email ?? "", p.Phone ?? "", p.Citizenship,
        p.Dietary.ToArray(), p.Needs.ToArray(), p.Bedding, p.SpecialRequests, new EmergencyDto(p.EmergencyName, p.EmergencyPhone, p.EmergencyRelationship),
        p.KeepOut.Split(',', StringSplitOptions.RemoveEmptyEntries));

    private static List<string> Pick(string[] known, string[]? given) => (given ?? []).Where(known.Contains).Distinct().ToList();

    // ---- Helper ----

    public async Task<HelperDto?> HelperAsync(UserRecord actor, CancellationToken ct) =>
        ToDto(await accounts.GetHelperAsync(actor.Id, ct), await clock.NowAsync(actor, ct));

    public async Task<HelperDto> SaveHelperAsync(UserRecord actor, SaveHelperRequest req, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var name = req.Name?.Trim() ?? "";
        if (name.Length == 0 || req.Status is null || !AccountRules.HelperStatuses.Contains(req.Status)) throw ApiException.Invalid();
        var permissions = AccountRules.NormalizePermissions(req.Permissions);
        // An active helper with nothing granted would be a helper who can see nothing; the database refuses it too.
        if (req.Status == "active" && permissions.Length == 0) throw ApiException.Invalid("permissions");
        var now = await clock.NowAsync(actor, ct);
        var saved = await accounts.UpsertHelperAsync(actor.Id, AccountRules.Trunc(name, 80), AccountRules.Trunc(req.Relationship?.Trim(), 40), string.Join(',', permissions), req.Status, NewInviteCode(), now.AddDays(InviteDays), now, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "helper", $"{saved.Name}: {saved.Status}", now, ct);
        return ToDto(saved, now)!;
    }

    /// <summary>How long a code works (BM13).</summary>
    public const int InviteDays = 7;

    // Eight characters without 0/O/1/I/L, so a code read aloud or off a screen is hard to mistype.
    private const string CodeAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

    public static string NewInviteCode() => string.Create(8, 0, (span, _) =>
    {
        for (var i = 0; i < span.Length; i++) span[i] = CodeAlphabet[System.Security.Cryptography.RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
    });

    /// <summary>Upper case with spaces and dashes removed, so "abcd-2345" and "ABCD2345" are the same code.</summary>
    public static string NormalizeInviteCode(string? raw) => new((raw ?? "").Where(char.IsLetterOrDigit).Select(char.ToUpperInvariant).ToArray());

    /// <summary>The helper, signed in as themself, accepts a guest's code: the grant is tied to their account and the code is spent.</summary>
    public async Task<AcceptedHelperDto> AcceptHelperInviteAsync(UserRecord actor, AcceptHelperRequest req, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var code = NormalizeInviteCode(req.Code);
        if (code.Length != 8) throw ApiException.Invalid("code");
        var now = await clock.NowAsync(actor, ct);
        var link = await accounts.AcceptHelperInviteAsync(actor.Id, code, now, ct) ?? throw ApiException.NotFound();
        var guest = await accounts.GetProfileAsync(link.GuestUserId, ct);
        var guestName = $"{guest?.FirstName} {guest?.LastName}".Trim();
        await accounts.AddHistoryAsync(link.GuestUserId, actor.Id, "helper", $"{link.Name}: linked", now, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "helper", $"Helping {guestName}", now, ct);
        return new AcceptedHelperDto(guestName, link.Relationship);
    }

    /// <summary>A new code for a helper who has not accepted yet; the old one stops working at once (BM14).</summary>
    public async Task<HelperDto> RenewHelperCodeAsync(UserRecord actor, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var now = await clock.NowAsync(actor, ct);
        var renewed = await accounts.RenewHelperCodeAsync(actor.Id, NewInviteCode(), now.AddDays(InviteDays), now, ct);
        if (renewed is null)
        {
            // Nothing to renew: either no helper at all, or the helper already accepted.
            var current = await accounts.GetHelperAsync(actor.Id, ct);
            if (current is { Status: not "revoked", HelperUserId: not null }) throw ApiException.Conflict("linked");
            throw ApiException.NotFound();
        }
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "helper", $"{renewed.Name}: new code", now, ct);
        return ToDto(renewed, now)!;
    }

    public async Task<HelperDto> RevokeHelperAsync(UserRecord actor, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var now = await clock.NowAsync(actor, ct);
        var revoked = await accounts.RevokeHelperAsync(actor.Id, now, ct) ?? throw ApiException.NotFound();
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "helper", $"{revoked.Name}: revoked", now, ct);
        return ToDto(revoked, now)!;
    }

    /// <summary>An expired code is not shown (BM13); <c>InviteExpires</c> stays so the screen can say it ran out.</summary>
    private static HelperDto? ToDto(HelperRecord? h, DateTime now) => h is null ? null : new(
        h.Name, h.Relationship, h.Permissions.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries), h.Status, TripRules.ToMs(h.ChangedAt), h.HelperUserId is not null, h.InviteExpiresAt > now ? h.InviteCode : null, h.InviteExpiresAt is { } e ? TripRules.ToMs(e) : null);

    public async Task<List<HistoryEntryDto>> HistoryAsync(UserRecord actor, CancellationToken ct) =>
        (await accounts.ListHistoryAsync(actor.Id, ct)).Select(h => new HistoryEntryDto(h.PublicId, TripRules.ToMs(h.At), h.By, h.What, h.Detail)).ToList();
}
