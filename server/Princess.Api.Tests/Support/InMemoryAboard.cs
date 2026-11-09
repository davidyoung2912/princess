using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

/// <summary>The Phase 10c store in memory. Account lines go through the shipboard store to the on-board folio, so the account reads them back as the database would.</summary>
public sealed class InMemoryAboardStore(InMemoryShipboardStore shipboard, InMemoryPlanStore plan) : IAboardStore
{
    private long _next = 1;

    public List<(long BookingId, SelectionRow Row)> Selections { get; } = [];
    public List<(long BookingId, ServiceRequestRow Row)> Requests { get; } = [];
    public List<(long BookingId, SafetyReportRow Row)> Reports { get; } = [];
    public List<(long UserId, DrinkLogRow Row)> Drinks { get; } = [];
    public List<(long BookingId, TopUpRow Row)> TopUps { get; } = [];
    public Dictionary<long, OnboardAccountRow> Accounts { get; } = [];
    public List<(long BookingId, PartyRow Row)> Parties { get; } = [];
    public Dictionary<long, string> Splits { get; } = [];
    public List<(long ReservationId, int Seq, string Name, string Cabin)> Friends { get; } = [];
    public Dictionary<long, string> Games { get; } = [];
    public Dictionary<long, string> Tvs { get; } = [];
    public Dictionary<(long BookingId, int Day, string Item), bool> Ready { get; } = [];

    public Task<List<SelectionRow>> ListSelectionsAsync(long bookingId, CancellationToken ct) => Task.FromResult(Selections.Where(s => s.BookingId == bookingId).Select(s => s.Row).OrderBy(s => s.Id).ToList());

    public Task<SelectionRow> SaveSelectionAsync(long bookingId, SelectionRow s, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        var i = Selections.FindIndex(x => x.BookingId == bookingId && x.Row.ItemId == s.ItemId && x.Row.Day == s.Day && x.Row.Time == s.Time);
        if (i >= 0)
        {
            s.Id = Selections[i].Row.Id;
            s.PublicId = Selections[i].Row.PublicId;
            Selections[i] = (bookingId, s);
        }
        else
        {
            s.Id = _next++;
            s.PublicId = Guid.NewGuid();
            Selections.Add((bookingId, s));
        }
        shipboard.Replace(bookingId, "selection", s.Id, folio);
        return Task.FromResult(s);
    }

    public Task<bool> RemoveSelectionAsync(long bookingId, Guid publicId, CancellationToken ct)
    {
        var found = Selections.FirstOrDefault(s => s.BookingId == bookingId && s.Row.PublicId == publicId);
        if (found.Row is null) return Task.FromResult(false);
        shipboard.Replace(bookingId, "selection", found.Row.Id, []);
        Selections.Remove(found);
        return Task.FromResult(true);
    }

    public Task<List<ServiceRequestRow>> ListRequestsAsync(long bookingId, CancellationToken ct) => Task.FromResult(Requests.Where(r => r.BookingId == bookingId).Select(r => r.Row).OrderByDescending(r => r.PlacedAt).ToList());

    public Task AddRequestAsync(long bookingId, ServiceRequestRow request, CancellationToken ct)
    {
        request.PublicId = Guid.NewGuid();
        Requests.Add((bookingId, request));
        return Task.CompletedTask;
    }

    public Task<bool> AddRequestEventAsync(long bookingId, Guid publicId, string kind, DateTime at, CancellationToken ct)
    {
        var r = Requests.FirstOrDefault(x => x.BookingId == bookingId && x.Row.PublicId == publicId).Row;
        if (r is null) return Task.FromResult(false);
        r.Events.Add(new ServiceRequestEventRow { Kind = kind, At = at });
        return Task.FromResult(true);
    }

    public Task<bool> CancelRequestAsync(long bookingId, Guid publicId, CancellationToken ct)
    {
        var r = Requests.FirstOrDefault(x => x.BookingId == bookingId && x.Row.PublicId == publicId).Row;
        if (r is null || r.Stage != "received") return Task.FromResult(false);
        r.Stage = "cancelled";
        return Task.FromResult(true);
    }

    public Task<List<SafetyReportRow>> ListReportsAsync(long bookingId, CancellationToken ct) => Task.FromResult(Reports.Where(r => r.BookingId == bookingId).Select(r => r.Row).ToList());

    public Task AddReportAsync(long bookingId, SafetyReportRow report, CancellationToken ct)
    {
        report.PublicId = Guid.NewGuid();
        Reports.Add((bookingId, report));
        return Task.CompletedTask;
    }

    public Task<List<DrinkLogRow>> ListDrinksAsync(long userId, DateTime since, CancellationToken ct) => Task.FromResult(Drinks.Where(d => d.UserId == userId && d.Row.At >= since).Select(d => d.Row).OrderBy(d => d.At).ToList());

    public Task AddDrinkAsync(long userId, string drinkId, DateTime at, CancellationToken ct)
    {
        Drinks.Add((userId, new DrinkLogRow { PublicId = Guid.NewGuid(), DrinkId = drinkId, At = at }));
        return Task.CompletedTask;
    }

    public Task<bool> RemoveDrinkAsync(long userId, Guid publicId, CancellationToken ct) => Task.FromResult(Drinks.RemoveAll(d => d.UserId == userId && d.Row.PublicId == publicId) > 0);

    public Task<List<TopUpRow>> ListTopUpsAsync(long bookingId, CancellationToken ct) => Task.FromResult(TopUps.Where(t => t.BookingId == bookingId).Select(t => t.Row).ToList());

    public Task AddTopUpAsync(long bookingId, TopUpRow topUp, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        topUp.PublicId = Guid.NewGuid();
        TopUps.Add((bookingId, topUp));
        shipboard.Replace(bookingId, "topup", _next++, folio);
        return Task.CompletedTask;
    }

    private OnboardAccountRow Account(long bookingId)
    {
        if (!Accounts.TryGetValue(bookingId, out var a)) Accounts[bookingId] = a = new OnboardAccountRow { Exists = true };
        return a;
    }

    public Task<OnboardAccountRow> GetAccountAsync(long bookingId, CancellationToken ct) => Task.FromResult(Accounts.TryGetValue(bookingId, out var a) ? a : new OnboardAccountRow());

    public Task SetPinAsync(long bookingId, byte[] hash, byte[] salt, CancellationToken ct)
    {
        var a = Account(bookingId);
        (a.PinHash, a.PinSalt, a.PinFails) = (hash, salt, 0);
        return Task.CompletedTask;
    }

    public Task<int> RecordPinFailAsync(long bookingId, CancellationToken ct) => Task.FromResult(++Account(bookingId).PinFails);

    public Task ResetPinFailsAsync(long bookingId, CancellationToken ct)
    {
        Account(bookingId).PinFails = 0;
        return Task.CompletedTask;
    }

    public Task SaveGratuityAsync(long bookingId, string choice, string reason, DateTime at, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        var a = Account(bookingId);
        (a.GratuityChoice, a.GratuityReason, a.GratuityPaidAt) = (choice, reason, choice == "prepaid" ? at : null);
        shipboard.Replace(bookingId, "gratuity", bookingId, folio);
        return Task.CompletedTask;
    }

    public Task SetCurrencyAsync(long bookingId, string code, CancellationToken ct)
    {
        Account(bookingId).DisplayCurrency = code;
        return Task.CompletedTask;
    }

    public Task<List<PartyRow>> ListPartiesAsync(long bookingId, CancellationToken ct) => Task.FromResult(Parties.Where(p => p.BookingId == bookingId).Select(p => p.Row).ToList());

    public Task AddPartyAsync(long bookingId, PartyRow party, CancellationToken ct)
    {
        party.PublicId = Guid.NewGuid();
        Parties.Add((bookingId, party));
        return Task.CompletedTask;
    }

    public Task<bool> RemovePartyAsync(long bookingId, Guid publicId, CancellationToken ct) => Task.FromResult(Parties.RemoveAll(p => p.BookingId == bookingId && p.Row.PublicId == publicId) > 0);

    public Task<GroupTableRow?> GetGroupAsync(long bookingId, Guid reservationPublicId, CancellationToken ct)
    {
        var t = plan.Tables.FirstOrDefault(x => x.BookingId == bookingId && x.Row.PublicId == reservationPublicId && x.Status != "cancelled").Row;
        if (t is null) return Task.FromResult<GroupTableRow?>(null);
        return Task.FromResult<GroupTableRow?>(new GroupTableRow
        {
            ReservationId = t.Id, Split = Splits.GetValueOrDefault(t.Id, "mine"), PartySize = t.GuestIds.Count,
            Friends = [.. Friends.Where(f => f.ReservationId == t.Id).OrderBy(f => f.Seq).Select(f => (f.Seq, f.Name, f.Cabin))],
        });
    }

    public Task AddFriendAsync(long reservationId, string name, string cabin, CancellationToken ct)
    {
        Friends.Add((reservationId, Friends.Where(f => f.ReservationId == reservationId).Select(f => f.Seq).DefaultIfEmpty(0).Max() + 1, name, cabin));
        return Task.CompletedTask;
    }

    public Task RemoveFriendAsync(long reservationId, int seq, CancellationToken ct)
    {
        Friends.RemoveAll(f => f.ReservationId == reservationId && f.Seq == seq);
        return Task.CompletedTask;
    }

    public Task SetSplitAsync(long reservationId, string split, CancellationToken ct)
    {
        Splits[reservationId] = split;
        return Task.CompletedTask;
    }

    public Task<string?> GetGameAsync(long userId, CancellationToken ct) => Task.FromResult(Games.GetValueOrDefault(userId));

    public Task SaveGameAsync(long userId, string json, CancellationToken ct)
    {
        Games[userId] = json;
        return Task.CompletedTask;
    }

    public Task<string?> GetTvAsync(long bookingId, CancellationToken ct) => Task.FromResult(Tvs.GetValueOrDefault(bookingId));

    public Task SaveTvAsync(long bookingId, string json, CancellationToken ct)
    {
        Tvs[bookingId] = json;
        return Task.CompletedTask;
    }

    public Task<HashSet<string>> GetReadyAsync(long bookingId, int day, CancellationToken ct) =>
        Task.FromResult(Ready.Where(r => r.Key.BookingId == bookingId && r.Key.Day == day && r.Value).Select(r => r.Key.Item).ToHashSet());

    public Task SetReadyAsync(long bookingId, int day, string itemId, bool done, DateTime at, CancellationToken ct)
    {
        Ready[(bookingId, day, itemId)] = done;
        return Task.CompletedTask;
    }

    public Task BookLastMinuteAsync(long bookingId, NewTour tour, IReadOnlyList<FolioWrite> folio, DateTime at, CancellationToken ct)
    {
        var row = new TourRow
        {
            Id = _next++ + 5000, PublicId = Guid.NewGuid(), ExcursionId = tour.ExcursionId, Day = tour.Day, TotalCents = tour.TotalCents, At = at, GuestIds = [.. tour.GuestIds], Methods = ["Onboard account"],
        };
        plan.Tours.Add((bookingId, row));
        shipboard.Replace(bookingId, "tour", row.Id, folio);
        return Task.CompletedTask;
    }
}

/// <summary>The chat store in memory: groups of users and their messages.</summary>
public sealed class InMemoryChatStore(InMemoryUserStore users) : IChatStore
{
    private long _next = 1;

    public List<(long Id, HashSet<long> Members)> Groups { get; } = [];
    public List<(long GroupId, ChatMessageRow Row)> Messages { get; } = [];
    public HashSet<long> Receipts { get; } = [];
    public HashSet<(long UserId, long Blocked)> Blocks { get; } = [];
    public List<(long UserId, Guid MessageId, string Reason)> Reports { get; } = [];

    /// <summary>Puts the people in one group.</summary>
    public void Group(params long[] userIds) => Groups.Add((_next++, [.. userIds]));

    private IEnumerable<long> GroupsOf(long userId) => Groups.Where(g => g.Members.Contains(userId)).Select(g => g.Id);

    public Task<List<ChatPeerRow>> ListPeersAsync(long userId, CancellationToken ct) =>
        Task.FromResult(Groups.Where(g => g.Members.Contains(userId)).SelectMany(g => g.Members).Where(id => id != userId).Distinct()
            .Select(id => new ChatPeerRow { UserId = id, PublicId = users.Users.First(u => u.Id == id).PublicId, ReceiptsOn = Receipts.Contains(id) }).ToList());

    public Task<List<ChatMessageRow>> ListMessagesAsync(long userId, CancellationToken ct)
    {
        var mine = GroupsOf(userId).ToHashSet();
        return Task.FromResult(Messages.Where(m => mine.Contains(m.GroupId)).Select(m => m.Row).OrderBy(m => m.At).ThenBy(m => m.Id).ToList());
    }

    public Task<ChatMessageRow> AddMessageAsync(long userId, string text, string? photo, DateTime at, CancellationToken ct)
    {
        var group = GroupsOf(userId).Cast<long?>().FirstOrDefault();
        if (group is null)
        {
            Group(userId);
            group = Groups[^1].Id;
        }
        var row = new ChatMessageRow { Id = _next++, PublicId = Guid.NewGuid(), FromUserId = userId, Text = text, Photo = photo, At = at };
        Messages.Add((group.Value, row));
        return Task.FromResult(row);
    }

    public Task<bool> GetReceiptsAsync(long userId, CancellationToken ct) => Task.FromResult(Receipts.Contains(userId));

    public Task SetReceiptsAsync(long userId, bool on, CancellationToken ct)
    {
        if (on) Receipts.Add(userId);
        else Receipts.Remove(userId);
        return Task.CompletedTask;
    }

    public Task MarkSeenAsync(long userId, DateTime at, CancellationToken ct)
    {
        var mine = GroupsOf(userId).ToHashSet();
        foreach (var m in Messages.Where(m => mine.Contains(m.GroupId) && m.Row.FromUserId != userId && !m.Row.SeenBy.Contains(userId))) m.Row.SeenBy.Add(userId);
        return Task.CompletedTask;
    }

    public Task<List<long>> ListBlocksAsync(long userId, CancellationToken ct) => Task.FromResult(Blocks.Where(b => b.UserId == userId).Select(b => b.Blocked).ToList());

    public Task SetBlockAsync(long userId, long blockedUserId, bool on, CancellationToken ct)
    {
        if (on) Blocks.Add((userId, blockedUserId));
        else Blocks.Remove((userId, blockedUserId));
        return Task.CompletedTask;
    }

    public Task<bool> AddReportAsync(long userId, Guid messagePublicId, string reason, DateTime at, CancellationToken ct)
    {
        var mine = GroupsOf(userId).ToHashSet();
        if (!Messages.Any(m => m.Row.PublicId == messagePublicId && mine.Contains(m.GroupId))) return Task.FromResult(false);
        Reports.Add((userId, messagePublicId, reason));
        return Task.FromResult(true);
    }
}
