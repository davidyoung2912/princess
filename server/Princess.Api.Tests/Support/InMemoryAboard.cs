using Princess.Api.Data;
using Princess.Api.Domain;

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

/// <summary>The chat store in memory: conversations of users, their members' places and their messages, with the same access rule as the SQL store (a person reads only conversations they are in).</summary>
public class InMemoryChatStore(InMemoryUserStore users) : IChatStore
{
    private long _next = 1;

    public sealed class Conversation
    {
        public long Id { get; init; }
        public Guid PublicId { get; init; } = Guid.NewGuid();
        public string Kind { get; init; } = "party";
        public string Name { get; init; } = "";
        public bool DirectEnded { get; set; }
        public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
        public long? StanleyUserId { get; init; }
        public List<Member> Members { get; } = [];
    }

    public sealed class Member
    {
        public long UserId { get; init; }
        public string Status { get; set; } = "active";
        public DateTime JoinedAt { get; set; } = DateTime.MinValue;
        public DateTime? LeftAt { get; set; }
        public bool Muted { get; set; }
        public bool NotifyAway { get; set; }
        public string? AwayStatus { get; set; }
        public long? LastRead { get; set; }
    }

    public List<Conversation> Conversations { get; } = [];
    public sealed record Stored(long GroupId, ChatMessageRow Row, Guid? ClientId);

    /// <summary>One reaction per (message id, person), like the real table's key.</summary>
    public Dictionary<(long MessageId, long UserId), string> ReactionsBy { get; } = [];
    public HashSet<(long MessageId, long UserId)> MessageDeliveries { get; } = [];

    public List<Stored> Messages { get; } = [];
    public HashSet<long> Receipts { get; } = [];
    public HashSet<long> Previews { get; } = [];
    public HashSet<(long UserId, long Blocked)> Blocks { get; } = [];
    public List<(long UserId, Guid MessageId, string Reason)> Reports { get; } = [];
    /// <summary>Pairs (either order) with an accepted chat connection, for who may be told when someone leaves or returns to the ship.</summary>
    public HashSet<(long A, long B)> Connected { get; } = [];

    /// <summary>Puts the people in one booking group ("My group").</summary>
    public Conversation Group(params long[] userIds) => Make("party", "My group", userIds);

    /// <summary>A direct chat between two people.</summary>
    public Conversation Direct(long a, long b) => Make("direct", "Direct", [a, b]);

    private Conversation Make(string kind, string name, long[] userIds)
    {
        var c = new Conversation { Id = _next++, Kind = kind, Name = name };
        foreach (var id in userIds) c.Members.Add(new Member { UserId = id });
        Conversations.Add(c);
        return c;
    }

    private Conversation Of(long groupId) => Conversations.First(c => c.Id == groupId);

    private IEnumerable<Conversation> Mine(long userId) => Conversations.Where(c => c.Members.Any(m => m.UserId == userId));

    private bool Readable(Conversation c, Member me, ChatMessageRow m) =>
        ChatConversationRules.CanRead(c.Kind, m.At, me.JoinedAt, me.LeftAt) && !Blocks.Contains((me.UserId, m.FromUserId));

    private (string Persona, string Subtitle)? PersonaOf(Conversation c) =>
        c.Kind != "stanley" ? null : Messages.Where(m => m.GroupId == c.Id && m.Row.Persona is not null).OrderByDescending(m => m.Row.Id).Select(m => ((string, string)?)(m.Row.Persona!, m.Row.Subtitle ?? "")).FirstOrDefault();

    private ChatMemberRow Row(Conversation c, Member me) => new()
    {
        Persona = PersonaOf(c)?.Persona, Subtitle = PersonaOf(c)?.Subtitle,
        GroupId = c.Id, GroupPublicId = c.PublicId, Kind = c.Kind, Name = c.Name, UserId = me.UserId, Status = me.Status, JoinedAt = me.JoinedAt, LeftAt = me.LeftAt,
        Muted = me.Muted, LastReadMessageId = me.LastRead, DirectEnded = c.DirectEnded, CreatedAt = c.CreatedAt,
    };

    private IEnumerable<ChatMessageRow> Visible(Conversation c, Member me) => Messages.Where(m => m.GroupId == c.Id && Readable(c, me, m.Row)).Select(m => m.Row).OrderBy(m => m.Id);

    private int UnreadIn(Conversation c, Member me) => Visible(c, me).Count(m => m.FromUserId != me.UserId && m.Id > (me.LastRead ?? 0));

    public Task EnsureStanleyAsync(long userId, string welcome, DateTime now, CancellationToken ct)
    {
        if (Conversations.Any(c => c.StanleyUserId == userId)) return Task.CompletedTask;
        var c = new Conversation { Id = _next++, Kind = "stanley", Name = StanleyPersonaRules.Name, StanleyUserId = userId };
        c.Members.Add(new Member { UserId = userId, JoinedAt = now });
        Conversations.Add(c);
        Messages.Add(new Stored(c.Id, new ChatMessageRow { Id = _next++, PublicId = Guid.NewGuid(), FromUserId = 0, Text = welcome, At = now, Persona = StanleyPersonaRules.Company, Subtitle = StanleyPersonaRules.CompanyName }, null));
        return Task.CompletedTask;
    }

    public Task<(string Voice, string Subtitle)?> LastStanleyPersonaAsync(long userId, CancellationToken ct) =>
        Task.FromResult(Conversations.FirstOrDefault(c => c.StanleyUserId == userId) is { } c ? PersonaOf(c) : null);

    public Task AddStanleyLineAsync(long userId, string text, string voice, string subtitle, DateTime at, CancellationToken ct)
    {
        if (Conversations.FirstOrDefault(c => c.StanleyUserId == userId) is not { } c || PersonaOf(c) is { } last && last.Persona == voice && last.Subtitle == subtitle) return Task.CompletedTask;
        Messages.Add(new Stored(c.Id, new ChatMessageRow { Id = _next++, PublicId = Guid.NewGuid(), FromUserId = 0, Text = text, At = at, IsSystem = true, Persona = voice, Subtitle = subtitle }, null));
        return Task.CompletedTask;
    }

    public List<(long UserId, string Key, string Kind, string Lane, string Event, DateTime At)> Deliveries { get; } = [];

    public Task LogNoticeDeliveryAsync(long userId, string noticeKey, string kind, string lane, string evt, DateTime at, CancellationToken ct)
    {
        if (!Deliveries.Any(d => d.UserId == userId && d.Key == noticeKey && d.Event == evt)) Deliveries.Add((userId, noticeKey, kind, lane, evt, at));
        return Task.CompletedTask;
    }

    public Task<List<NoticeDeliveryCount>> NoticeDeliverySummaryAsync(DateTime since, CancellationToken ct) =>
        Task.FromResult(Deliveries.Where(d => d.At >= since).GroupBy(d => (d.Kind, d.Lane, d.Event)).Select(g => new NoticeDeliveryCount(g.Key.Kind, g.Key.Lane, g.Key.Event, g.Count())).ToList());

    public virtual Task<bool> AddStanleyNoticeAsync(long userId, StanleyNotice n, string voice, string subtitle, DateTime at, CancellationToken ct)
    {
        if (Conversations.FirstOrDefault(c => c.StanleyUserId == userId) is not { } c) return Task.FromResult(false);
        if (Messages.Any(m => m.GroupId == c.Id && m.Row.NoticeKey == n.Key)) return Task.FromResult(false);
        if (n.SupersedeKey is not null)
            foreach (var old in Messages.Where(m => m.GroupId == c.Id && m.Row.SupersedeKey == n.SupersedeKey && m.Row.SupersededAt is null)) old.Row.SupersededAt = at;
        Messages.Add(new Stored(c.Id, new ChatMessageRow
        {
            Id = _next++, PublicId = Guid.NewGuid(), FromUserId = 0, Text = n.Text, At = at, Persona = voice, Subtitle = subtitle, Urgency = n.Urgency,
            NoticeKey = n.Key, Lane = n.Lane, NoticeKind = n.Kind, NoticePath = n.Path, SupersedeKey = n.SupersedeKey, ExpiresAt = n.ExpiresAt, NoticeSubject = n.Subject,
        }, null));
        return Task.FromResult(true);
    }

    public Task EnsurePartyAsync(long userId, CancellationToken ct)
    {
        if (!Mine(userId).Any(c => c.Kind == "party")) Group(userId);
        return Task.CompletedTask;
    }

    public Task<List<ChatConversationRow>> ListConversationsAsync(long userId, CancellationToken ct) =>
        Task.FromResult(Mine(userId).Select(c => (C: c, Me: c.Members.First(m => m.UserId == userId))).Where(x => x.Me.Status == "active").Select(x =>
        {
            var last = Visible(x.C, x.Me).Where(m => x.C.Kind != "stanley" || !m.IsSystem).LastOrDefault();
            var r = new ChatConversationRow
            {
                GroupId = x.C.Id, GroupPublicId = x.C.PublicId, Kind = x.C.Kind, Name = x.C.Name, UserId = userId, Status = x.Me.Status, JoinedAt = x.Me.JoinedAt, LeftAt = x.Me.LeftAt,
                Muted = x.Me.Muted, NotifyAway = x.Me.NotifyAway, LastReadMessageId = x.Me.LastRead, DirectEnded = x.C.DirectEnded, CreatedAt = x.C.CreatedAt, Unread = UnreadIn(x.C, x.Me),
                Persona = PersonaOf(x.C)?.Persona, Subtitle = PersonaOf(x.C)?.Subtitle,
            };
            if (last is not null) { r.LastMessageId = last.Id; r.LastFromUserId = last.FromUserId; r.LastText = last.Text; r.LastPhoto = last.Photo is not null; r.LastUrgency = last.Urgency; r.LastAt = last.At; }
            return r;
        }).OrderBy(r => r.Kind == "stanley" ? 0 : 1).ThenByDescending(r => r.LastAt ?? r.CreatedAt).ThenByDescending(r => r.GroupId).ToList());

    public Task<ChatMemberRow?> GetMemberAsync(long userId, Guid conversationId, CancellationToken ct) =>
        Task.FromResult(Conversations.FirstOrDefault(c => c.PublicId == conversationId) is { } c && c.Members.FirstOrDefault(m => m.UserId == userId) is { } me ? Row(c, me) : null);

    private ChatPeerRow Peer(long id)
    {
        var u = users.Users.First(u => u.Id == id);
        return new ChatPeerRow { UserId = id, PublicId = u.PublicId, FirstName = u.FirstName ?? "", LastName = u.LastName ?? "", ReceiptsOn = Receipts.Contains(id), IsSupervised = u.IsSupervised, BookerUserId = u.BookerUserId };
    }

    public Task<List<ChatPeerRow>> ListMembersAsync(long groupId, CancellationToken ct) => Task.FromResult(Of(groupId).Members.Select(m => Peer(m.UserId)).ToList());

    public Task<Dictionary<long, List<ChatPeerRow>>> ListMembersForAsync(IReadOnlyCollection<long> groupIds, CancellationToken ct) =>
        Task.FromResult(groupIds.ToDictionary(id => id, id => Of(id).Members.Select(m => { var p = Peer(m.UserId); p.GroupId = id; p.Status = m.Status; return p; }).ToList()));

    public Task<List<ChatPeerRow>> ListPeersAsync(long userId, CancellationToken ct) =>
        Task.FromResult(Mine(userId).SelectMany(c => c.Members).Select(m => m.UserId).Where(id => id != userId).Distinct().Select(Peer).ToList());

    public Task<List<ChatMessageRow>> ListMessagesAsync(long groupId, long userId, Guid? before, int limit, CancellationToken ct)
    {
        var c = Of(groupId);
        var me = c.Members.First(m => m.UserId == userId);
        var all = Visible(c, me).ToList();
        if (before is { } b) all = all.Where(m => m.Id < (Messages.FirstOrDefault(x => x.Row.PublicId == b && x.GroupId == groupId)?.Row.Id ?? long.MaxValue)).ToList();
        // Like the real store: a page says there is a photo but does not carry it.
        return Task.FromResult(all.TakeLast(limit + 1).Select(m => new ChatMessageRow
        {
            Id = m.Id, PublicId = m.PublicId, FromUserId = m.FromUserId, Text = m.Text, HasPhoto = m.Photo is not null, At = m.At, IsSystem = m.IsSystem, ViaSms = m.ViaSms, Urgency = m.Urgency,
            SeenBy = m.SeenBy, AckedBy = m.AckedBy, Persona = m.Persona, Subtitle = m.Subtitle, ReplyToId = m.ReplyToId,
            // Like the real store: the quote is the original only when this reader may read it.
            Reply = m.ReplyToId is { } r && Visible(c, me).FirstOrDefault(x => x.Id == r) is { } q ? new ChatQuoteRow { Id = q.Id, PublicId = q.PublicId, FromUserId = q.FromUserId, Text = q.Text, HasPhoto = q.Photo is not null, IsSystem = q.IsSystem } : null,
            Reactions = [.. ReactionsBy.Where(x => x.Key.MessageId == m.Id).Select(x => new ChatReactionRow(m.Id, x.Key.UserId, x.Value))],
            DeliveredBy = [.. MessageDeliveries.Where(x => x.MessageId == m.Id).Select(x => x.UserId)],
            Lane = m.Lane, NoticeKind = m.NoticeKind, NoticePath = m.NoticePath, ExpiresAt = m.ExpiresAt, SupersededAt = m.SupersededAt,
        }).ToList());
    }

    public Task<ChatSentRow> AddMessageAsync(long groupId, long userId, string text, string? photo, Guid? clientId, DateTime at, CancellationToken ct, bool viaSms = false, string urgency = "normal", long? replyToId = null)
    {
        if (clientId is not null && Messages.FirstOrDefault(m => m.GroupId == groupId && m.Row.FromUserId == userId && m.ClientId == clientId) is { } again)
            return Task.FromResult(new ChatSentRow(again.Row, false));
        var row = new ChatMessageRow { Id = _next++, PublicId = Guid.NewGuid(), FromUserId = userId, Text = text, Photo = photo, At = at, ViaSms = viaSms, Urgency = urgency, ReplyToId = replyToId };
        Messages.Add(new Stored(groupId, row, clientId));
        return Task.FromResult(new ChatSentRow(row, true));
    }

    public Task<List<ChatRecipientRow>> ListRecipientsAsync(long groupId, long senderId, CancellationToken ct) =>
        Task.FromResult(Of(groupId).Members.Where(m => m.Status == "active" && m.UserId != senderId && !Blocks.Contains((m.UserId, senderId)))
            .Select(m => new ChatRecipientRow { UserId = m.UserId, Muted = m.Muted, ShowPreview = Previews.Contains(m.UserId) }).ToList());

    public Task MarkReadAsync(long groupId, long userId, bool receipts, DateTime at, CancellationToken ct)
    {
        var c = Of(groupId);
        var me = c.Members.First(m => m.UserId == userId);
        var latest = Messages.Where(m => m.GroupId == groupId).Select(m => m.Row.Id).DefaultIfEmpty(0).Max();
        if (latest > (me.LastRead ?? 0)) me.LastRead = latest;
        if (receipts)
            foreach (var m in Visible(c, me).Where(m => m.FromUserId != userId && !m.SeenBy.Contains(userId))) m.SeenBy.Add(userId);
        return Task.CompletedTask;
    }

    public Task SetMutedAsync(long groupId, long userId, bool on, CancellationToken ct)
    {
        Of(groupId).Members.First(m => m.UserId == userId).Muted = on;
        return Task.CompletedTask;
    }

    public Task SetNotifyAwayAsync(long groupId, long userId, bool on, CancellationToken ct)
    {
        Of(groupId).Members.First(m => m.UserId == userId).NotifyAway = on;
        return Task.CompletedTask;
    }

    public Task<List<ChatAwayClaimRow>> ClaimAwayAsync(long userId, string status, CancellationToken ct)
    {
        var claims = new List<ChatAwayClaimRow>();
        foreach (var c in Mine(userId))
        {
            var me = c.Members.First(m => m.UserId == userId);
            if (me.Status != "active" || me.AwayStatus == status || c.Kind == "stanley") continue;
            claims.Add(new ChatAwayClaimRow { GroupId = c.Id, Previous = me.AwayStatus, NotifyAway = me.NotifyAway });
            me.AwayStatus = status;
        }
        return Task.FromResult(claims);
    }

    public Task<List<ChatAwayRecipientRow>> ListAwayRecipientsAsync(long userId, IReadOnlyCollection<long> groupIds, CancellationToken ct) =>
        Task.FromResult(Conversations.Where(c => groupIds.Contains(c.Id)).SelectMany(c => c.Members.Where(m => m.Status == "active" && m.UserId != userId
                && (Connected.Contains((userId, m.UserId)) || Connected.Contains((m.UserId, userId))) && !Blocks.Contains((m.UserId, userId)) && !Blocks.Contains((userId, m.UserId)))
            .Select(m => new ChatAwayRecipientRow { GroupId = c.Id, GroupPublicId = c.PublicId, UserId = m.UserId, Muted = m.Muted })).ToList());

    public Task AddSystemLineAsync(long groupId, long userId, string text, DateTime at, CancellationToken ct)
    {
        Messages.Add(new Stored(groupId, new ChatMessageRow { Id = _next++, PublicId = Guid.NewGuid(), FromUserId = userId, Text = text, At = at, IsSystem = true }, null));
        return Task.CompletedTask;
    }

    public Task<ChatMessageRow?> FindMessageAsync(long groupId, long userId, Guid messagePublicId, CancellationToken ct)
    {
        var c = Of(groupId);
        var me = c.Members.First(m => m.UserId == userId);
        return Task.FromResult(Visible(c, me).FirstOrDefault(m => m.PublicId == messagePublicId));
    }

    public Task<bool> AddDeliveryAsync(Guid messagePublicId, long userId, DateTime at, CancellationToken ct)
    {
        var m = Messages.FirstOrDefault(x => x.Row.PublicId == messagePublicId)?.Row;
        return Task.FromResult(m is { IsSystem: false } && m.FromUserId != 0 && m.FromUserId != userId && MessageDeliveries.Add((m.Id, userId)));
    }

    public Task<string?> GetReactionAsync(long messageId, long userId, CancellationToken ct) =>
        Task.FromResult(ReactionsBy.TryGetValue((messageId, userId), out var e) ? e : null);

    public Task SetReactionAsync(long messageId, long userId, string? emoji, DateTime at, CancellationToken ct)
    {
        if (emoji is null) ReactionsBy.Remove((messageId, userId)); else ReactionsBy[(messageId, userId)] = emoji;
        return Task.CompletedTask;
    }

    public Task<List<ChatReactionRow>> ListReactionsAsync(long messageId, CancellationToken ct) =>
        Task.FromResult(ReactionsBy.Where(x => x.Key.MessageId == messageId).Select(x => new ChatReactionRow(messageId, x.Key.UserId, x.Value)).ToList());

    public Task<List<long>> MarkDeliveredAsync(long groupId, long userId, DateTime at, CancellationToken ct)
    {
        var c = Of(groupId);
        var me = c.Members.First(m => m.UserId == userId);
        var senders = new HashSet<long>();
        foreach (var m in Visible(c, me).Where(m => !m.IsSystem && m.FromUserId != 0 && m.FromUserId != userId))
            if (MessageDeliveries.Add((m.Id, userId))) senders.Add(m.FromUserId);
        return Task.FromResult(senders.ToList());
    }

    public Task<int> CountSentAsync(long userId, string urgency, DateTime since, CancellationToken ct) =>
        Task.FromResult(Messages.Count(m => m.Row.FromUserId == userId && m.Row.Urgency == urgency && m.Row.At >= since));

    public Task<bool> AddAckAsync(long messageId, long userId, DateTime at, CancellationToken ct)
    {
        var row = Messages.First(m => m.Row.Id == messageId).Row;
        if (row.AckedBy.Contains(userId)) return Task.FromResult(false);
        row.AckedBy.Add(userId);
        return Task.FromResult(true);
    }

    public Task<List<(Guid ConversationId, Guid MessageId)>> ListUnackedUrgentAsync(long userId, CancellationToken ct) =>
        Task.FromResult(Mine(userId).Select(c => (C: c, Me: c.Members.First(m => m.UserId == userId))).Where(x => x.Me.Status == "active")
            .SelectMany(x => Visible(x.C, x.Me).Where(m => m.Urgency == "urgent" && !m.IsSystem && m.FromUserId != userId && !m.AckedBy.Contains(userId)).Select(m => (x.C.PublicId, m.PublicId))).ToList());

    public Task<int> UnreadTotalAsync(long userId, CancellationToken ct) =>
        Task.FromResult(Mine(userId).Select(c => (C: c, Me: c.Members.First(m => m.UserId == userId))).Where(x => x.Me.Status == "active").Sum(x => UnreadIn(x.C, x.Me)));

    public Task<bool> GetReceiptsAsync(long userId, CancellationToken ct) => Task.FromResult(Receipts.Contains(userId));

    public Task SetReceiptsAsync(long userId, bool on, CancellationToken ct)
    {
        if (on) Receipts.Add(userId);
        else Receipts.Remove(userId);
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
        var found = Messages.FirstOrDefault(m => m.Row.PublicId == messagePublicId);
        if (found is null || Of(found.GroupId).Members.FirstOrDefault(m => m.UserId == userId) is not { } me || !Readable(Of(found.GroupId), me, found.Row)) return Task.FromResult(false);
        Reports.Add((userId, messagePublicId, reason));
        return Task.FromResult(true);
    }
}
