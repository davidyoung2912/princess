namespace Princess.Api.Data;

public sealed class SelectionRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string ItemId { get; set; } = "";
    /// <summary>0 for items with no day (shop goods).</summary>
    public int Day { get; set; }
    /// <summary>"HH:mm" ship time, or "" for items with no time.</summary>
    public string Time { get; set; } = "";
    public int Qty { get; set; }
    public long TotalCents { get; set; }
    public DateTime At { get; set; }
}

public sealed class ServiceRequestRow
{
    public Guid PublicId { get; set; }
    public string ItemId { get; set; } = "";
    public int Qty { get; set; }
    public string Note { get; set; } = "";
    public DateTime PlacedAt { get; set; }
    /// <summary><c>received</c> until the guest cancels it (<c>cancelled</c>); the rest of the stages are worked out from the clock.</summary>
    public string Stage { get; set; } = "received";
    /// <summary>Escalations, confirmations and reopens, oldest first. A reopen never removes the earlier ones.</summary>
    public List<ServiceRequestEventRow> Events { get; set; } = [];
}

public sealed class ServiceRequestEventRow
{
    /// <summary><c>escalated</c>, <c>confirmed</c> or <c>reopened</c>.</summary>
    public string Kind { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class SafetyReportRow
{
    public Guid PublicId { get; set; }
    public string Kind { get; set; } = "";
    public string Place { get; set; } = "";
    public string Note { get; set; } = "";
    public bool Anonymous { get; set; }
    public string Reference { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class DrinkLogRow
{
    public Guid PublicId { get; set; }
    public string DrinkId { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class TopUpRow
{
    public Guid PublicId { get; set; }
    public int Dollars { get; set; }
    public string Source { get; set; } = "card";
    public DateTime At { get; set; }
    public DateTime? SettledAt { get; set; }
    public string Reference { get; set; } = "";
}

/// <summary>The booking's on-board account settings. The PIN is kept as a salted PBKDF2 hash.</summary>
public sealed class OnboardAccountRow
{
    public byte[]? PinHash { get; set; }
    public byte[]? PinSalt { get; set; }
    public int PinFails { get; set; }
    public string GratuityChoice { get; set; } = "standard";
    public string? GratuityReason { get; set; }
    public DateTime? GratuityPaidAt { get; set; }
    public string DisplayCurrency { get; set; } = "USD";
    public bool Exists { get; set; }
}

public sealed class PartyRow
{
    public Guid PublicId { get; set; }
    public string Title { get; set; } = "";
    public int Day { get; set; }
    public string Time { get; set; } = "";
    public List<(string Cabin, string Answer)> Invites { get; set; } = [];
}

/// <summary>A group dining table: the friends on it, how the bill is split and how many of the booking are seated.</summary>
public sealed class GroupTableRow
{
    public long ReservationId { get; set; }
    public string Split { get; set; } = "mine";
    public int PartySize { get; set; }
    public List<(int Seq, string Name, string Cabin)> Friends { get; set; } = [];
}

/// <summary>Someone who shares a conversation with the person: the public id and short name the screens use, and whether they show read receipts.</summary>
public sealed class ChatPeerRow
{
    public long UserId { get; set; }
    public Guid PublicId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public bool ReceiptsOn { get; set; }
    /// <summary>active, left or removed. The people shown as "in" a conversation are the active ones; the others are kept so earlier messages still have a name.</summary>
    public string Status { get; set; } = "active";
    /// <summary>A supervised child's account: a guardian can read the conversations they are in.</summary>
    public bool IsSupervised { get; set; }
    /// <summary>The booker of a supervised child (their guardian); null for anyone else.</summary>
    public long? BookerUserId { get; set; }
}

public sealed class ChatMessageRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long FromUserId { get; set; }
    public string Text { get; set; } = "";
    public string? Photo { get; set; }
    public DateTime At { get; set; }
    /// <summary>A line about the group ("Sam left the group"), not something a person said: shown in the thread, never counted as unread.</summary>
    public bool IsSystem { get; set; }
    /// <summary>It came in by text from a guest ashore (docs/chat-plan.md, phase 6).</summary>
    public bool ViaSms { get; set; }
    /// <summary>normal, important or urgent (<see cref="Domain.ChatUrgencyRules"/>).</summary>
    public string Urgency { get; set; } = "normal";
    /// <summary>The people who have read it.</summary>
    public List<long> SeenBy { get; set; } = [];
    /// <summary>The people who have acknowledged it (urgent messages only).</summary>
    public List<long> AckedBy { get; set; } = [];
}

/// <summary>The person's own place in one conversation: the access check every read and write goes through (docs/chat-plan.md, 4.1).</summary>
public class ChatMemberRow
{
    public long GroupId { get; set; }
    public Guid GroupPublicId { get; set; }
    public string Kind { get; set; } = "party";
    public string Name { get; set; } = "";
    public long UserId { get; set; }
    public string Status { get; set; } = "active";
    public DateTime JoinedAt { get; set; }
    public DateTime? LeftAt { get; set; }
    public bool Muted { get; set; }
    public long? LastReadMessageId { get; set; }
    /// <summary>A direct chat whose connection has ended: readable, but sending is closed.</summary>
    public bool DirectEnded { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>A conversation in the person's list: their place in it, its last visible message and how many they have not read.</summary>
public sealed class ChatConversationRow : ChatMemberRow
{
    public long? LastMessageId { get; set; }
    public long? LastFromUserId { get; set; }
    public string? LastText { get; set; }
    public bool LastPhoto { get; set; }
    public DateTime? LastAt { get; set; }
    public int Unread { get; set; }
}

/// <summary>Someone who should hear about a new message: an active member other than the sender who has not blocked the sender.</summary>
public sealed class ChatRecipientRow
{
    public long UserId { get; set; }
    public bool Muted { get; set; }
    /// <summary>The recipient allows message text on their lock screen (off unless they turned it on).</summary>
    public bool ShowPreview { get; set; }
}

/// <summary>A message stored by <see cref="IChatStore.AddMessageAsync"/>. <c>Created</c> is false when the same <c>clientId</c> had been sent before and the stored message came back.</summary>
public sealed record ChatSentRow(ChatMessageRow Row, bool Created);

/// <summary>Phase 10c store: on-board bookings, requests, reports, drinks, money, parties, group tables, games, the TV, last-minute tours and port readiness. Writes that put something on the account take the lines in the same transaction and replace every line of that source.</summary>
public interface IAboardStore
{
    Task<List<SelectionRow>> ListSelectionsAsync(long bookingId, CancellationToken ct);
    /// <summary>Adds the selection, or replaces the quantity of the one for the same item, day and time; the account lines replace the old.</summary>
    Task<SelectionRow> SaveSelectionAsync(long bookingId, SelectionRow selection, IReadOnlyList<FolioWrite> folio, CancellationToken ct);
    Task<bool> RemoveSelectionAsync(long bookingId, Guid publicId, CancellationToken ct);

    Task<List<ServiceRequestRow>> ListRequestsAsync(long bookingId, CancellationToken ct);
    Task AddRequestAsync(long bookingId, ServiceRequestRow request, CancellationToken ct);
    Task<bool> CancelRequestAsync(long bookingId, Guid publicId, CancellationToken ct);
    /// <summary>Records an escalation, closure confirmation or reopen on the booking's request; false when it is not theirs.</summary>
    Task<bool> AddRequestEventAsync(long bookingId, Guid publicId, string kind, DateTime at, CancellationToken ct);

    Task<List<SafetyReportRow>> ListReportsAsync(long bookingId, CancellationToken ct);
    Task AddReportAsync(long bookingId, SafetyReportRow report, CancellationToken ct);

    /// <summary>The person's drinks since the moment given.</summary>
    Task<List<DrinkLogRow>> ListDrinksAsync(long userId, DateTime since, CancellationToken ct);
    Task AddDrinkAsync(long userId, string drinkId, DateTime at, CancellationToken ct);
    Task<bool> RemoveDrinkAsync(long userId, Guid publicId, CancellationToken ct);

    Task<List<TopUpRow>> ListTopUpsAsync(long bookingId, CancellationToken ct);
    /// <summary>Adds a top-up and its credit on the account (dated at the moment the desk settles it).</summary>
    Task AddTopUpAsync(long bookingId, TopUpRow topUp, IReadOnlyList<FolioWrite> folio, CancellationToken ct);
    Task<OnboardAccountRow> GetAccountAsync(long bookingId, CancellationToken ct);
    Task SetPinAsync(long bookingId, byte[] hash, byte[] salt, CancellationToken ct);
    /// <summary>Counts a wrong PIN and returns the number of misses so far.</summary>
    Task<int> RecordPinFailAsync(long bookingId, CancellationToken ct);
    Task ResetPinFailsAsync(long bookingId, CancellationToken ct);
    Task SaveGratuityAsync(long bookingId, string choice, string reason, DateTime at, IReadOnlyList<FolioWrite> folio, CancellationToken ct);
    Task SetCurrencyAsync(long bookingId, string code, CancellationToken ct);

    Task<List<PartyRow>> ListPartiesAsync(long bookingId, CancellationToken ct);
    Task AddPartyAsync(long bookingId, PartyRow party, CancellationToken ct);
    Task<bool> RemovePartyAsync(long bookingId, Guid publicId, CancellationToken ct);

    /// <summary>The table for one of the booking's dining reservations (still booked), else null.</summary>
    Task<GroupTableRow?> GetGroupAsync(long bookingId, Guid reservationPublicId, CancellationToken ct);
    Task AddFriendAsync(long reservationId, string name, string cabin, CancellationToken ct);
    Task RemoveFriendAsync(long reservationId, int seq, CancellationToken ct);
    Task SetSplitAsync(long reservationId, string split, CancellationToken ct);

    Task<string?> GetGameAsync(long userId, CancellationToken ct);
    Task SaveGameAsync(long userId, string json, CancellationToken ct);

    Task<string?> GetTvAsync(long bookingId, CancellationToken ct);
    Task SaveTvAsync(long bookingId, string json, CancellationToken ct);

    Task<HashSet<string>> GetReadyAsync(long bookingId, int day, CancellationToken ct);
    Task SetReadyAsync(long bookingId, int day, string itemId, bool done, DateTime at, CancellationToken ct);

    /// <summary>Books a last-minute tour (<c>Source = onboard</c>) and puts it on the account in one go.</summary>
    Task BookLastMinuteAsync(long bookingId, NewTour tour, IReadOnlyList<FolioWrite> folio, DateTime at, CancellationToken ct);
}

/// <summary>
/// Conversations and their messages (docs/chat-plan.md, phase 4), and the safeguards of MSG-05. Every read and write is for one conversation and goes through <see cref="GetMemberAsync"/>:
/// there is no query that spans conversations except the list and the unread counts, which return numbers and ids only.
/// </summary>
public interface IChatStore
{
    /// <summary>Makes the booking's "My group" for a person who has none, so there is always one conversation to open.</summary>
    Task EnsurePartyAsync(long userId, CancellationToken ct);
    /// <summary>The person's active conversations, newest activity first, each with its last visible message and unread count.</summary>
    Task<List<ChatConversationRow>> ListConversationsAsync(long userId, CancellationToken ct);
    /// <summary>The person's place in one conversation, or null when they are not (or never were) a member. The check behind every other call.</summary>
    Task<ChatMemberRow?> GetMemberAsync(long userId, Guid conversationId, CancellationToken ct);
    /// <summary>Everyone who is, or was, in the conversation, with names and receipt choice.</summary>
    Task<List<ChatPeerRow>> ListMembersAsync(long groupId, CancellationToken ct);
    /// <summary>Everyone who shares any conversation with the person, the person excluded (for blocking and read receipts).</summary>
    Task<List<ChatPeerRow>> ListPeersAsync(long userId, CancellationToken ct);
    /// <summary>
    /// A page of messages in arrival order, oldest first: the newest <paramref name="limit"/> before the message <paramref name="before"/> (or the latest). Only messages in the member's window
    /// (from when they joined to when they left; the booking's group shows all) and not from someone the member blocked. One extra message is read so the caller can tell there is more.
    /// </summary>
    Task<List<ChatMessageRow>> ListMessagesAsync(long groupId, long userId, Guid? before, int limit, CancellationToken ct);
    /// <summary>Stores a message in the conversation. With a <paramref name="clientId"/> a repeat returns the stored message and creates nothing.</summary>
    Task<ChatSentRow> AddMessageAsync(long groupId, long userId, string text, string? photo, Guid? clientId, DateTime at, CancellationToken ct, bool viaSms = false, string urgency = "normal");
    /// <summary>The members to tell about a message from <paramref name="senderId"/>: active, not the sender, and not having blocked the sender.</summary>
    Task<List<ChatRecipientRow>> ListRecipientsAsync(long groupId, long senderId, CancellationToken ct);
    /// <summary>Marks everything in the conversation read for the person; with <paramref name="receipts"/> also records who read each message.</summary>
    Task MarkReadAsync(long groupId, long userId, bool receipts, DateTime at, CancellationToken ct);
    Task SetMutedAsync(long groupId, long userId, bool on, CancellationToken ct);
    /// <summary>One message the person may read in the conversation (their window, not from someone they blocked), or null.</summary>
    Task<ChatMessageRow?> FindMessageAsync(long groupId, long userId, Guid messagePublicId, CancellationToken ct);
    /// <summary>Records that the person acknowledged the message; false when they already had (nothing changes).</summary>
    Task<bool> AddAckAsync(long messageId, long userId, DateTime at, CancellationToken ct);
    /// <summary>The urgent messages from others that the person may read and has not acknowledged, as (conversation id, message id), for the badge and the pinned state.</summary>
    Task<List<(Guid ConversationId, Guid MessageId)>> ListUnackedUrgentAsync(long userId, CancellationToken ct);
    /// <summary>Unread messages over every conversation, for the tab badge.</summary>
    Task<int> UnreadTotalAsync(long userId, CancellationToken ct);
    Task<bool> GetReceiptsAsync(long userId, CancellationToken ct);
    Task SetReceiptsAsync(long userId, bool on, CancellationToken ct);
    Task<List<long>> ListBlocksAsync(long userId, CancellationToken ct);
    Task SetBlockAsync(long userId, long blockedUserId, bool on, CancellationToken ct);
    /// <summary>Records a report about a message in a conversation the person is in; false if there is no such message.</summary>
    Task<bool> AddReportAsync(long userId, Guid messagePublicId, string reason, DateTime at, CancellationToken ct);
}
