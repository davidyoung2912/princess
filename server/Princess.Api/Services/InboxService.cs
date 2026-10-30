using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public sealed partial class InboxService(IInboxStore inbox, TripService trips, IUserClock clock)
{
    public const string GuestServicesNumber = "555-0100";
    public const string EmergencyNumber = "555-0111";
    public static readonly string[] FeedbackKinds = ["bug", "idea", "praise"];

    [GeneratedRegex(@"^[A-Za-z][A-Za-z0-9]*:[^\s]{1,70}$")]
    private static partial Regex FavouriteKey();

    public static ContactsDto Contacts() => new(GuestServicesNumber, EmergencyNumber);

    // ---- Notifications ----

    public async Task<NotificationsDto> NotificationsAsync(UserRecord actor, CancellationToken ct)
    {
        var now = await clock.NowAsync(actor, ct);
        var read = await inbox.ReadNoticeKindsAsync(actor.Id, ct);
        var notices = new List<NoticeDto>();
        // Notices come from the trip the app opens on, so they can never disagree with it.
        if (await trips.CurrentAsync(actor, now, ct) is { } current)
        {
            var trip = await trips.BuildAsync(current, current: true, now, ct);
            var built = NotificationRules.BuildNotices(new NotificationRules.NoticeInput(
                trip.Payment, trip.Plan.FinalDue, trip.Documents?.Missing ?? 0, trip.Documents?.PassportProblems ?? 0, trip.Checkin.State,
                TripRules.Today(DateTimeOffset.FromUnixTimeMilliseconds(trip.Checkin.OpensAt).UtcDateTime).ToString("yyyy-MM-dd")));
            notices = built.Select(n => new NoticeDto(n.Id, n.Category, n.Params, read.Contains(n.Id))).ToList();
        }
        return new NotificationsDto(notices, await PrefsAsync(actor.Id, ct));
    }

    private async Task<JsonObject> PrefsAsync(long userId, CancellationToken ct)
    {
        JsonNode? stored = null;
        if (await inbox.GetPrefsJsonAsync(userId, ct) is { } json)
        {
            try { stored = JsonNode.Parse(json); } catch (System.Text.Json.JsonException) { }
        }
        return NotificationRules.NormalizePrefs(stored);
    }

    public async Task MarkReadAsync(UserRecord actor, MarkReadRequest req, CancellationToken ct)
    {
        var ids = (req.Ids ?? []).Where(NotificationRules.NoticeIds.Contains).Distinct().ToList();
        await inbox.MarkNoticesReadAsync(actor.Id, ids, await clock.NowAsync(actor, ct), ct);
    }

    public async Task<JsonObject> SavePrefsAsync(UserRecord actor, JsonNode? body, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var next = NotificationRules.NormalizePrefs(body);
        await inbox.SavePrefsJsonAsync(actor.Id, next.ToJsonString(), await clock.NowAsync(actor, ct), ct);
        return next;
    }

    // ---- Support ----

    public async Task<List<TicketDto>> TicketsAsync(UserRecord actor, CancellationToken ct)
    {
        var now = await clock.NowAsync(actor, ct);
        return (await inbox.ListTicketsAsync(actor.Id, ct)).Select(t => Ticket(t, now)).ToList();
    }

    public async Task<TicketDto> CreateTicketAsync(UserRecord actor, CreateTicketRequest req, CancellationToken ct)
    {
        string kind, detail;
        switch (req.Kind)
        {
            case "callback":
                if (!AccountRules.PhoneOk(req.Phone)) throw ApiException.Invalid("phone");
                (kind, detail) = ("callback", req.Phone!.Trim());
                break;
            case "email":
                if (string.IsNullOrWhiteSpace(req.Message)) throw ApiException.Invalid("message");
                (kind, detail) = ("email", AccountRules.Trunc(req.Message.Trim(), 1000));
                break;
            default:
                throw ApiException.Invalid("kind");
        }
        var now = await clock.NowAsync(actor, ct);
        return Ticket(await inbox.AddTicketAsync(actor.Id, kind, detail, now, ct), now);
    }

    private static TicketDto Ticket(TicketRow t, DateTime now) =>
        new(t.PublicId, t.Kind, TripRules.ToMs(t.At), NotificationRules.TicketStatus(t.At, now, t.Status), t.Detail);

    // ---- Feedback ----

    public async Task<List<FeedbackRowDto>> FeedbackAsync(UserRecord actor, CancellationToken ct) =>
        (await inbox.ListFeedbackAsync(actor.Id, ct)).Select(Row).ToList();

    public async Task<List<FeedbackRowDto>> SendFeedbackAsync(UserRecord actor, SendFeedbackRequest req, CancellationToken ct)
    {
        var text = req.Text?.Trim() ?? "";
        if (req.Kind is null || !FeedbackKinds.Contains(req.Kind) || text.Length is < 5 or > 1000) throw ApiException.Invalid();
        if (req.Screenshot is { } shot && (shot.Length > 2_000_000 || !shot.StartsWith("data:image/", StringComparison.Ordinal))) throw ApiException.Invalid("screenshot");
        var log = (req.Log ?? []).Take(20).Select(l => AccountRules.Trunc(l, 300)).ToArray();
        await inbox.AddFeedbackAsync(actor.Id, new FeedbackRecord
        {
            PublicId = Guid.NewGuid(),
            Kind = req.Kind,
            Text = text,
            LogJson = System.Text.Json.JsonSerializer.Serialize(log),
            Screenshot = req.Screenshot,
            Reference = "FB-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
            At = await clock.NowAsync(actor, ct),
        }, ct);
        return await FeedbackAsync(actor, ct);
    }

    private static FeedbackRowDto Row(FeedbackRecord f) => new(
        f.PublicId, f.Kind, f.Text, TripRules.ToMs(f.At), System.Text.Json.JsonSerializer.Deserialize<string[]>(f.LogJson) ?? [], f.Reference, f.Screenshot is not null);

    // ---- Favourites ----

    public Task<List<string>> FavouritesAsync(UserRecord actor, CancellationToken ct) => inbox.ListFavouritesAsync(actor.Id, ct);

    public Task<List<string>> ToggleFavouriteAsync(UserRecord actor, ToggleFavouriteRequest req, CancellationToken ct)
    {
        var key = req.Key?.Trim() ?? "";
        if (key.Length > 80 || !FavouriteKey().IsMatch(key)) throw ApiException.Invalid("key");
        return inbox.ToggleFavouriteAsync(actor.Id, key, ct);
    }
}
