using System.Security.Cryptography;
using System.Text;

namespace Princess.Api.Domain;

/// <summary>One person in a huddle, for the conversion: whether they are on the booking and whether they agreed to carry the history over.</summary>
public sealed record HuddleMember(long UserId, bool OnBooking, bool AgreedToCarry);

/// <summary>Where each member goes when the huddle becomes a party chat: <c>Party</c> (on the booking), <c>Stay</c> (not on it: the huddle carries on as an ordinary group), and who of the party may read the old history.</summary>
public sealed record HuddleConversion(IReadOnlyList<long> Party, IReadOnlyList<long> Stay, IReadOnlyList<long> HistoryCarried);

/// <summary>
/// The trip huddle's pure rules (docs/chat-features-research.md, phase 15): a small private chat started around a shortlist, before anyone has booked. Adults only (18+, never a supervised account), joined only by an invite
/// link the creator shares themselves, up to twelve people, no photos, no money in it, deleted after 60 days of silence. A link is a random token stored only as a hash, lasts seven days, can be revoked or refreshed, and a wrong,
/// expired or revoked one all fail the same way, so nothing can be learned from the error. A link shows who is in (first name and last initial) and nothing else before joining. No release without the privacy review (14.3).
/// </summary>
public static class ChatHuddleRules
{
    /// <summary>The conversation kind (<c>ChatGroups.Kind</c>).</summary>
    public const string Kind = "huddle";

    public const int AdultAge = 18, MaxMembers = 12, MaxHuddlesPerGuest = 3, MaxOpenPerCreator = 1, InvitesPerDay = 10, LinkDays = 7, MaxShortlist = 12, MaxShortlistNote = 140;
    public const int DeleteAfterDays = 60, WarnAfterDays = 50;

    /// <summary>Refusals. <c>invalidLink</c> is the only answer to a wrong, expired or revoked link.</summary>
    public const string Supervised = "supervised", Underage = "underage", NeedAge = "needAge", Full = "full", TooMany = "tooMany", OpenAlready = "openAlready", Limit = "limit", InvalidLink = "invalidLink", AlreadyIn = "alreadyIn", NotAllowed = "notAllowed";

    /// <summary>The public cards a shortlist may hold. A card carries a public catalogue fact and its "as of" time, never a personal money figure.</summary>
    public const string Sailing = "sailing", CabinType = "cabinType", Port = "port", CostBreakdown = "costBreakdown";
    public static readonly string[] CardKinds = [Sailing, CabinType, Port, CostBreakdown];

    /// <summary>Field names a shortlist card must never carry: whatever a person has paid, owes, holds or has saved is private (no cost split, no "who pays what").</summary>
    public static readonly string[] PersonalMoneyFields = ["paid", "balance", "deposit", "owed", "owes", "split", "share", "spend", "folio", "credit", "payment", "cardNumber", "accountNumber", "bookingNumber", "cabinNumber", "passport"];

    // ---- Who ----

    /// <summary>Whether a person may start a huddle: an adult (18+), not a supervised account, with none open already and fewer than three in all. No booking is needed.</summary>
    public static string? StartRefusal(bool supervised, int? age, int openAsCreator, int huddlesIn) =>
        supervised ? Supervised : age is null ? NeedAge : age < AdultAge ? Underage : openAsCreator >= MaxOpenPerCreator ? OpenAlready : huddlesIn >= MaxHuddlesPerGuest ? TooMany : null;

    /// <summary>
    /// Whether a person may join: signed in (the caller), an adult who has confirmed their age, not supervised, not already in, room for them (twelve including the creator) and fewer than three huddles of their own.
    /// An age that is unknown is a refusal (<c>needAge</c>), never a pass, so nobody joins anonymously or without saying.
    /// </summary>
    public static string? JoinRefusal(bool supervised, int? age, bool alreadyIn, int activeMembers, int huddlesIn) =>
        supervised ? Supervised : age is null ? NeedAge : age < AdultAge ? Underage : alreadyIn ? AlreadyIn : activeMembers >= MaxMembers ? Full : huddlesIn >= MaxHuddlesPerGuest ? TooMany : null;

    public static bool Fits(int activeMembers, int adding) => activeMembers + adding <= MaxMembers;

    /// <summary>Age in whole years on a day.</summary>
    public static int AgeOn(DateOnly born, DateOnly day) => day.Year - born.Year - (day.Month < born.Month || (day.Month == born.Month && day.Day < born.Day) ? 1 : 0);

    // ---- The link ----

    /// <summary>A new link token: 32 random bytes, URL-safe. Shown once; only <see cref="HashOf"/> is stored.</summary>
    public static string NewToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    /// <summary>The stored form of a token: SHA-256, hex. Not reversible, so the database never holds a working link.</summary>
    public static string HashOf(string? token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token ?? "")));

    public static DateTime ExpiresAt(DateTime now) => now.AddDays(LinkDays);

    /// <summary>
    /// Whether a link may be used: it exists, was not revoked or replaced, and has not passed its time. The answer for every failure is <see cref="InvalidLink"/>, the same words, so a wrong token and a revoked one look alike.
    /// </summary>
    public static string? LinkRefusal(bool found, DateTime? expiresAt, DateTime? revokedAt, DateTime now) =>
        !found || revokedAt is not null || expiresAt is null || expiresAt <= now ? InvalidLink : null;

    /// <summary>Whether the creator may make another link today (ten a day; refreshing counts).</summary>
    public static bool MayMakeLink(int madeToday) => madeToday < InvitesPerDay;

    /// <summary>What someone sees on a link before they accept: who is already in, as first name and last initial, in joining order, and how many seats are left. Never a message, a card, a name of the huddle's topic or a booking.</summary>
    public sealed record Preview(IReadOnlyList<string> Members, int SeatsLeft);

    public static Preview PreviewOf(IEnumerable<(string? First, string? Last)> members)
    {
        var names = members.Select(m => ChatConnectionRules.ShortName(m.First, m.Last)).ToList();
        return new(names, Math.Max(0, MaxMembers - names.Count));
    }

    // ---- The thread ----

    /// <summary>The huddle has no photos and no SMS bridge in version one.</summary>
    public static bool AllowsPhotos => false;
    public static bool AllowsSms => false;

    /// <summary>What Stanley may do in a huddle: R1 ship, port and catalogue facts only, R4 make a poll, R5 poll tallies and a compromise, R9 drafting. No personal money, no spend, no booking tools; he is allowed because everyone is an adult.</summary>
    public static readonly string[] StanleyRoles = ["R1", "R4", "R5", "R9"];
    public static bool StanleyMay(string role) => StanleyRoles.Contains(role);

    // ---- The shortlist ----

    /// <summary>
    /// Whether a card may go on the shortlist: a known kind, a title, an "as of" time, no more than the limit already on it, and no field that names a person's own money or a booking, cabin or document number.
    /// Fares are public catalogue facts and allowed; who pays what is not.
    /// </summary>
    public static string? CardRefusal(string? kind, string? title, bool hasAsOf, IEnumerable<string> fieldNames, int onShortlist)
    {
        if (kind is null || !CardKinds.Contains(kind)) return NotAllowed;
        if (string.IsNullOrWhiteSpace(title) || !hasAsOf) return NotAllowed;
        if (onShortlist >= MaxShortlist) return Full;
        return fieldNames.Any(f => PersonalMoneyFields.Any(p => f.Contains(p, StringComparison.OrdinalIgnoreCase))) ? NotAllowed : null;
    }

    // ---- When someone books ----

    /// <summary>
    /// "Make this the party chat": members on the booking go to the booking's party chat, the rest stay in the huddle, which becomes an ordinary group. A person on the booking sees the huddle history only if they said OK to carry it over,
    /// and only what they could already read (their own window), so nobody gains a view of what was said before they joined.
    /// </summary>
    public static HuddleConversion ToPartyChat(IReadOnlyList<HuddleMember> members) => new(
        [.. members.Where(m => m.OnBooking).Select(m => m.UserId)],
        [.. members.Where(m => !m.OnBooking).Select(m => m.UserId)],
        [.. members.Where(m => m.OnBooking && m.AgreedToCarry).Select(m => m.UserId)]);

    /// <summary>
    /// The history is copied into the party chat only when every member going there said OK, and only from the moment the last of them joined the huddle: the party chat shows everyone the same thing, so a message is carried only if
    /// each of them could already read it. Words from anyone who is not going to the party chat are never copied.
    /// </summary>
    public static bool CarriesHistory(HuddleConversion c) => c.Party.Count > 0 && c.HistoryCarried.Count == c.Party.Count;

    public static DateTime CarryFrom(IEnumerable<DateTime> joinedAt) => joinedAt.Max();

    /// <summary>The huddle carries on as an ordinary group only while someone who is not on the booking is still in it; otherwise it is deleted and the party chat is all there is.</summary>
    public static bool KeepsGroup(HuddleConversion c) => c.Stay.Count > 0;

    public const string NotBooker = "booker", NoBooking = "noBooking";

    /// <summary>Only the booker may offer it, and only for a booking that has at least one huddle member on it.</summary>
    public static bool MayConvert(bool isBooker, IReadOnlyList<HuddleMember> members) => isBooker && members.Any(m => m.OnBooking);

    // ---- Retention ----

    public const string KeepStage = "keep", WarnStage = "warn", DeleteStage = "delete";

    /// <summary>A huddle with no message for 60 days is deleted, with a warning from 50 days. Silence counts from the last message, or from the day it was made when nobody has spoken.</summary>
    public static string Stage(DateTime lastActivity, DateTime now)
    {
        var quiet = (now - lastActivity).TotalDays;
        return quiet >= DeleteAfterDays ? DeleteStage : quiet >= WarnAfterDays ? WarnStage : KeepStage;
    }

    public static DateTime DeleteOn(DateTime lastActivity) => lastActivity.AddDays(DeleteAfterDays);
}
