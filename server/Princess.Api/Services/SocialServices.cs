using System.Text.Json;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>Cabin parties (ROM-06): invite neighbours by cabin. Ports <c>parties</c> of <c>src/api/aboardMock.ts</c>. Neighbours' answers are made up, the same every time (<c>ServiceRules.Rsvp</c>).</summary>
public sealed class PartyService(ScopeLoader scopes, IAboardStore store)
{
    private async Task<List<PartyDto>> ListAsync(Scope c, CancellationToken ct) =>
        [.. (await store.ListPartiesAsync(c.Booking.BookingId, ct)).OrderBy(p => p.Day).ThenBy(p => p.Time, StringComparer.Ordinal)
            .Select(p => new PartyDto(p.PublicId, p.Title, p.Day, p.Time, [.. p.Invites.Select(i => new InviteDto(i.Cabin, i.Answer))]))];

    public async Task<List<PartyDto>> ListAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ListAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<List<PartyDto>> CreateAsync(UserRecord actor, string? number, CreatePartyRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (Shipboard.AgeOf(c, actor) < ServiceRules.DrinkingAge) throw ApiException.Forbidden("age");
        if (ServiceRules.PartyProblem(body?.Title, body?.Day, body?.Time, body?.Cabins) is { } problem) throw ApiException.Invalid(problem);
        Shipboard.RequireAboard(c);
        if (body!.Day!.Value < Shipboard.DayAt(c, c.Now)) throw ApiException.Conflict("past");
        var title = body.Title!.Trim();
        var party = new PartyRow { Title = title, Day = body.Day.Value, Time = body.Time!, Invites = [.. body.Cabins!.Select(cabin => (cabin, ServiceRules.Rsvp(cabin, title)))] };
        await store.AddPartyAsync(c.Booking.BookingId, party, ct);
        return await ListAsync(c, ct);
    }

    public async Task<List<PartyDto>> CancelAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (!await store.RemovePartyAsync(c.Booking.BookingId, id, ct)) throw ApiException.NotFound();
        return await ListAsync(c, ct);
    }
}

/// <summary>Friends at a group dinner and how the bill is split (DIN-09). Ports <c>groups</c> of <c>src/api/aboardMock.ts</c>. The seats already taken are the guests on the reservation, so a table cannot go over the limit of eight.</summary>
public sealed class GroupTableService(ScopeLoader scopes, IAboardStore store)
{
    private static GroupTableDto View(GroupTableRow t) => new([.. t.Friends.Select(f => new TableFriend(f.Name, f.Cabin))], t.Split);

    private async Task<GroupTableRow> TableAsync(Scope c, Guid reservation, CancellationToken ct) =>
        await store.GetGroupAsync(c.Booking.BookingId, reservation, ct) ?? throw ApiException.NotFound();

    public async Task<GroupTableDto> GetAsync(UserRecord actor, string? number, Guid reservation, CancellationToken ct) =>
        View(await TableAsync(await scopes.LoadAsync(actor, number, write: false, ct), reservation, ct));

    public async Task<GroupTableDto> AddFriendAsync(UserRecord actor, string? number, Guid reservation, AddFriendRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var t = await TableAsync(c, reservation, ct);
        var problem = ServiceRules.FriendProblem(body?.Name, body?.Cabin, [.. t.Friends.Select(f => new TableFriend(f.Name, f.Cabin))], t.PartySize);
        if (problem == "full") throw ApiException.Conflict("full");
        if (problem is not null) throw ApiException.Invalid(problem);
        await store.AddFriendAsync(t.ReservationId, body!.Name!.Trim(), body.Cabin!, ct);
        return View(await TableAsync(c, reservation, ct));
    }

    public async Task<GroupTableDto> RemoveFriendAsync(UserRecord actor, string? number, Guid reservation, int index, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var t = await TableAsync(c, reservation, ct);
        if (index < 0 || index >= t.Friends.Count) throw ApiException.NotFound();
        await store.RemoveFriendAsync(t.ReservationId, t.Friends[index].Seq, ct);
        return View(await TableAsync(c, reservation, ct));
    }

    public async Task<GroupTableDto> SetSplitAsync(UserRecord actor, string? number, Guid reservation, SplitRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var t = await TableAsync(c, reservation, ct);
        if (body?.Split is not ("mine" or "even")) throw ApiException.Invalid("badSplit");
        await store.SetSplitAsync(t.ReservationId, body.Split, ct);
        return View(await TableAsync(c, reservation, ct));
    }
}

/// <summary>The games (ENT-05): what the person found, answered and marked. Ports <c>games</c> of <c>src/api/aboardMock.ts</c>. Progress belongs to the person; any guest on the booking plays.</summary>
public sealed class GameService(ScopeLoader scopes, IAboardStore store)
{
    private async Task<GameStateDto> GetAsync(UserRecord actor, CancellationToken ct) => TvAndGameRules.ParseGame(await store.GetGameAsync(actor.Id, ct));

    private async Task<GameStateDto> SaveAsync(UserRecord actor, GameStateDto g, CancellationToken ct)
    {
        await store.SaveGameAsync(actor.Id, TvAndGameRules.GameJson(g), ct);
        return g;
    }

    public async Task<GameStateDto> GetAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        await scopes.LoadAsync(actor, number, write: false, ct);
        return await GetAsync(actor, ct);
    }

    public async Task<GameStateDto> FindAsync(UserRecord actor, string? number, string clue, OnRequest? body, CancellationToken ct)
    {
        await scopes.LoadAsync(actor, number, write: false, ct);
        if (!TvAndGameRules.HuntClues.Contains(clue)) throw ApiException.Invalid("badClue");
        var g = await GetAsync(actor, ct);
        return await SaveAsync(actor, g with { Found = body?.On == false ? [.. g.Found.Where(x => x != clue)] : [.. g.Found.Append(clue).Distinct()] }, ct);
    }

    public async Task<GameStateDto> AnswerAsync(UserRecord actor, string? number, string question, AnswerRequest? body, CancellationToken ct)
    {
        await scopes.LoadAsync(actor, number, write: false, ct);
        if (!TvAndGameRules.Trivia.TryGetValue(question, out var options) || body is null || body.Option < 0 || body.Option >= options) throw ApiException.Invalid("badAnswer");
        var g = await GetAsync(actor, ct);
        if (g.Answers.ContainsKey(question)) throw ApiException.Conflict("answered");
        return await SaveAsync(actor, g with { Answers = new Dictionary<string, int>(g.Answers) { [question] = body.Option } }, ct);
    }

    public async Task<GameStateDto> MarkAsync(UserRecord actor, string? number, int n, OnRequest? body, CancellationToken ct)
    {
        await scopes.LoadAsync(actor, number, write: false, ct);
        if (n < 1 || n > 75) throw ApiException.Invalid("badNumber");
        var g = await GetAsync(actor, ct);
        return await SaveAsync(actor, g with { Marked = body?.On == false ? [.. g.Marked.Where(x => x != n)] : [.. g.Marked.Append(n).Distinct()] }, ct);
    }
}

/// <summary>The in-room TV (ENT-06): power, channel, volume, casting and video on demand, kept for the booking. Ports <c>tv</c> of <c>src/api/aboardMock.ts</c>. An adult guest changes it; a title above the guest's age is refused.</summary>
public sealed class TvService(ScopeLoader scopes, IAboardStore store)
{
    private async Task<TvState> GetAsync(Scope c, CancellationToken ct) => TvAndGameRules.ParseTv(await store.GetTvAsync(c.Booking.BookingId, ct));

    public async Task<TvState> GetAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await GetAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<TvState> SetAsync(UserRecord actor, string? number, TvPatchRequest? patch, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        patch ??= new TvPatchRequest();
        var now = await GetAsync(c, ct);
        if (patch.Channel is { } ch && !TvAndGameRules.ChannelKnown(ch)) throw ApiException.Invalid("badChannel");
        if (patch.Volume is { } v && (v < 0 || v > 100)) throw ApiException.Invalid("badVolume");
        var next = now with { Channel = patch.Channel ?? now.Channel, Volume = patch.Volume ?? now.Volume, Muted = patch.Muted ?? now.Muted, On = patch.On ?? now.On };
        switch (patch.Casting.ValueKind)
        {
            case JsonValueKind.Undefined: break;
            case JsonValueKind.Null: next = next with { Casting = null }; break;
            case JsonValueKind.String when TvAndGameRules.DeviceNameOk(patch.Casting.GetString()!): next = next with { Casting = patch.Casting.GetString() }; break;
            default: throw ApiException.Invalid("badDevice");
        }
        switch (patch.Vod.ValueKind)
        {
            case JsonValueKind.Undefined: break;
            case JsonValueKind.Null: next = next with { Vod = null }; break;
            case JsonValueKind.String:
                var id = patch.Vod.GetString()!;
                if (!TvAndGameRules.VodRatings.TryGetValue(id, out var rating)) throw ApiException.Invalid("badTitle");
                if (!TvAndGameRules.TitleAllowed(rating, Shipboard.AgeOf(c, actor))) throw ApiException.Forbidden("age");
                next = next with { Vod = id, Channel = TvAndGameRules.VodChannel, On = true };
                break;
            default: throw ApiException.Invalid("badTitle");
        }
        await store.SaveTvAsync(c.Booking.BookingId, TvAndGameRules.TvJson(next), ct);
        return next;
    }
}

/// <summary>"Ready for port" ticks for today (POR-13), kept for the booking. Ports <c>ready</c> of <c>src/api/aboardMock.ts</c>; the list resets each cruise day.</summary>
public sealed class ReadyService(ScopeLoader scopes, IAboardStore store)
{
    private async Task<List<string>> ListAsync(Scope c, CancellationToken ct) =>
        [.. ServiceRules.PortReady.Select(r => r.Id).Where((await store.GetReadyAsync(c.Booking.BookingId, Shipboard.DayAt(c, c.Now), ct)).Contains)];

    public async Task<List<string>> GetAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ListAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<List<string>> SetAsync(UserRecord actor, string? number, string id, ReadyRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        if (!ServiceRules.ReadyKnown(id)) throw ApiException.Invalid("badItem");
        await store.SetReadyAsync(c.Booking.BookingId, Shipboard.DayAt(c, c.Now), id, body?.On != false, c.Now, ct);
        return await ListAsync(c, ct);
    }
}
