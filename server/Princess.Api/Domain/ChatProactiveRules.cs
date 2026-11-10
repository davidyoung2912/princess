using System.Security.Cryptography;
using System.Text;

namespace Princess.Api.Domain;

/// <summary>What the engine knows about a guest's trip when it decides. Trip facts only: nothing a guest said to another guest is ever an input (docs/chat-features-research.md, 7.1 point 3).</summary>
public sealed record MomentFacts(DateTime Now, string Stage, int DaysToDeparture, bool BalanceOwing, DateOnly? FinalDue, int Saved = 0, int CabinViews = 0, bool PriceViewed = false, bool DepositUnpaid = false, int DocumentsMissing = 0, bool CheckinOpen = false, Guid? ShareGroup = null);

/// <summary>A candidate card. <see cref="FactsHash"/> is a hash of what it is about (a due date), so a dismissed card returns only when that changes. <see cref="Class"/> orders them: due, then guide, then suggestion.</summary>
public sealed record Moment(string Key, string Topic, string Class, string Text, string Path, DateTime? ExpiresAt, string FactsHash, string? Subject = null);

/// <summary>What was done with a moment before, as stored (no text).</summary>
public sealed record MomentHistory(string Key, string Topic, DateTime PostedAt, DateTime? ExpiresAt, DateTime? DismissedAt, DateTime? SnoozedUntil, string FactsHash);

/// <summary>The guest's side of the decision: their level and topics, the hours they asked for quiet, and who they are.</summary>
public sealed record MomentContext(string Mode, IReadOnlyCollection<string> TopicsOff, bool Held, bool Supervised);

/// <summary>
/// The proactive engine's pure rules (docs/chat-features-research.md, section 7, phase 6): whether and when a suggestion card may appear in the guest's permanent Stanley chat. Rules decide; a person
/// confirms. The words are templates, so the engine works with the model down. The rules: the guest's mode, no card in quiet hours or do-not-disturb, at most one card open at a time, at most three
/// new suggestions a day (a due-date card is outside that cap), a put-away card stays away unless its facts change, no card for a supervised child, and one card chosen by rank.
/// </summary>
public static class ChatProactiveRules
{
    public const string Lane = "suggestion", KindOf = "moment", KeyPrefix = "moment:";
    public const string ClassDue = "due", ClassGuide = "guide", ClassSuggestion = "suggestion";

    /// <summary>The modes of the existing Stanley level (section 7.2): only what affects the trip; plus suggestions; plus a step-by-step. <c>off</c> posts nothing.</summary>
    public const string ModeOff = "off", ModeTrip = "trip", ModeSuggest = "suggest", ModeGuide = "guide";

    public const int DailyCap = 3;
    public static readonly TimeSpan SnoozeFor = TimeSpan.FromHours(24);

    public const string Payment = "payment", Planning = "planning", Packing = "packing", Steps = "steps", Discovery = "discovery", Travel = "travel";
    /// <summary>The topics a guest can switch off. A due-date card (payment) is on this list too: a guest may not want even that in the thread, and the payment notice and the phone push are unaffected.</summary>
    public static readonly string[] Topics = [Payment, Planning, Packing, Steps, Discovery, Travel];

    /// <summary>The stored level, as a mode. A guest who has not chosen gets the narrowest useful one (section 7.2).</summary>
    public static string ModeOf(string? level) => level switch
    {
        "off" => ModeOff,
        "asked" => ModeTrip,
        "helpful" => ModeSuggest,
        "chatty" => ModeGuide,
        _ => ModeTrip,
    };

    /// <summary>Whether a mode allows a class of card.</summary>
    public static bool ModeAllows(string mode, string cls) => mode switch
    {
        ModeGuide => true,
        ModeSuggest => cls != ClassGuide,
        ModeTrip => cls == ClassDue,
        _ => false,
    };

    public static bool ValidTopics(IEnumerable<string>? topics) => topics is null || topics.All(Topics.Contains);

    /// <summary>A short, stable hash of the facts a moment is about. Not secret; it only notices change.</summary>
    public static string Hash(string facts) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(facts)))[..12];

    /// <summary>
    /// What could be said now. A fixed first catalogue (the stage catalogue of phase 7 adds to it): the final payment, a prompt to plan ahead, packing, and a gentle next step.
    /// No moment carries a price, a cabin or a payment detail: the card opens the screen that has them.
    /// </summary>
    public static List<Moment> Candidates(MomentFacts f)
    {
        var list = new List<Moment>();
        var today = DateOnly.FromDateTime(f.Now);
        list.AddRange(BeforeBooking(f));
        list.AddRange(ManageToBoarding(f));
        if (f.BalanceOwing && f.FinalDue is { } due && (due.DayNumber - today.DayNumber) is >= 0 and <= 14 && f.Stage is StageRules.Manage or StageRules.Prebook or StageRules.GetToShip)
        {
            var days = due.DayNumber - today.DayNumber;
            var text = days == 0 ? "Your final payment is due today" : days == 1 ? "Your final payment is due tomorrow" : $"Your final payment is due in {days} days";
            list.Add(new("finalPayment", Payment, ClassDue, $"{text}\nOpen Payments to see what is owing.", "/me/payments", due.ToDateTime(TimeOnly.MaxValue), Hash(due.ToString("yyyy-MM-dd"))));
        }
        if (f.Stage == StageRules.Prebook && f.DaysToDeparture is >= 2 and <= StageRules.PrebookDaysBefore)
            list.Add(new("planAhead", Planning, ClassSuggestion, "Plan your days before you sail\nExcursions and dinners are easier to get now than on board.", "/plan/ahead", f.Now.AddDays(3), Hash("planAhead")));
        if (f.Stage is StageRules.Prebook or StageRules.GetToShip && f.DaysToDeparture is >= 1 and <= 7)
            list.Add(new("packing", Packing, ClassSuggestion, "Start your packing list\nA list for your sailing is ready when you are.", "/plan/packing", f.Now.AddDays(3), Hash("packing")));
        if (f.Stage is StageRules.Manage or StageRules.Prebook)
            list.Add(new($"steps{f.Stage}", Steps, ClassGuide, "Your next steps\nHome shows the three things to do at this stage.", "/home", f.Now.AddDays(2), Hash(f.Stage)));
        return list;
    }

    /// <summary>
    /// Phase 7a (stages Dream, Discover and Book; docs/chat-features-research.md, 7.6): moments for a guest who has not yet paid in full. The triggers are the trip facts the server already holds: saved sailings,
    /// the guest's own price and cabin views, and an unpaid deposit. Each card opens a screen that already exists and carries no price, cabin or amount.
    /// </summary>
    public static List<Moment> BeforeBooking(MomentFacts f)
    {
        var list = new List<Moment>();
        if (f.Stage == StageRules.Dream && f.Saved == 0)
            list.Add(new("dream.first-look", Discovery, ClassGuide, "Tell me what you are hoping for\nI can find sailings that fit.", "/home/ask", f.Now.AddDays(7), Hash("dream.first-look")));
        if (f.Stage is StageRules.Dream or StageRules.Discover && f.Saved >= 2)
            list.Add(new("dream.compare", Discovery, ClassSuggestion, "Compare your saved trips\nSee two sailings side by side.", "/home/saved/compare", f.Now.AddDays(3), Hash($"compare{f.Saved}")));
        if (f.Stage == StageRules.Discover && f.CabinViews >= 3)
            list.Add(new("discover.cabin-help", Discovery, ClassSuggestion, "Help choosing a cabin type\nThe cabin chooser compares them for you.", "/home/cabins", f.Now.AddDays(3), Hash("discover.cabin-help")));
        if (f.Stage == StageRules.Discover && f.PriceViewed)
            list.Add(new("discover.true-cost", Discovery, ClassSuggestion, "The whole cost of a trip\nSee the total including gratuities and extras.", "/home/cruise/cost", f.Now.AddDays(2), Hash("discover.true-cost")));
        if (f.DepositUnpaid)
            list.Add(new("book.pay-deposit", Payment, ClassDue, "Your deposit is still to pay\nOpen Payments to see what is owing.", "/me/payments", f.Now.AddDays(3), Hash("book.pay-deposit")));
        return list;
    }

    /// <summary>
    /// Phase 7b (stages Manage, Prebook and Get to the ship; 7.6): documents still missing, and check-in open. Both mirror a notice the thread already carries (the thread notice stays the source of truth; the card
    /// is a quiet second pointer). Neither names a document, a traveller or a number.
    /// </summary>
    public static List<Moment> ManageToBoarding(MomentFacts f)
    {
        var list = new List<Moment>();
        if (f.DocumentsMissing > 0 && f.Stage is StageRules.Manage or StageRules.Prebook or StageRules.GetToShip)
            list.Add(new("manage.documents", Travel, ClassDue, "Some travel documents are still needed\nOpen Documents to see who still needs to add theirs.", "/me/documents", f.Now.AddDays(3), Hash($"documents{f.DocumentsMissing}")));
        if (f.CheckinOpen && f.Stage == StageRules.GetToShip)
            list.Add(new("getship.checkin-open", Travel, ClassDue, "Online check-in is open\nCheck in to get your boarding pass.", "/home/check-in", f.Now.AddDays(2), Hash("getship.checkin-open")));
        if (f.ShareGroup is { } group && f.Stage is StageRules.Manage or StageRules.Prebook or StageRules.GetToShip)
            list.Add(new(ChatGroupMomentRules.GroupPollKey, Planning, ClassSuggestion, ChatGroupMomentRules.OfferText, ChatGroupMomentRules.GroupPath(group), f.Now.AddDays(3), Hash(group.ToString("N")), group.ToString()));
        return list;
    }

    /// <summary>The order cards are chosen in: due first, then a guide step, then a suggestion; a stable tie-break on the key.</summary>
    private static int Rank(Moment m) => m.Class switch { ClassDue => 0, ClassGuide => 1, _ => 2 };

    /// <summary>Whether a posted card still counts as on screen: not put away, not snoozed, not expired.</summary>
    public static bool OnScreen(MomentHistory h, DateTime now) => h.DismissedAt is null && h.SnoozedUntil is null && (h.ExpiresAt is null || h.ExpiresAt > now);

    /// <summary>
    /// The one card to post, or null. Filters by mode, topics, supervised, quiet hours and do-not-disturb; stops while a card is open; counts the day's suggestions; and skips a moment already put
    /// away for the same facts, one still snoozed or one already on screen. A snooze that has ended lets the same moment return.
    /// </summary>
    public static Moment? Choose(IReadOnlyList<Moment> candidates, IReadOnlyList<MomentHistory> history, MomentContext ctx, DateTime now)
    {
        if (ctx.Supervised || ctx.Held || ctx.Mode == ModeOff) return null;
        if (history.Any(h => OnScreen(h, now))) return null;
        var postedToday = history.Count(h => h.PostedAt.Date == now.Date && h.Topic != Payment);
        foreach (var m in candidates.OrderBy(Rank).ThenBy(m => m.Key, StringComparer.Ordinal))
        {
            if (!ModeAllows(ctx.Mode, m.Class) || ctx.TopicsOff.Contains(m.Topic)) continue;
            if (m.Class != ClassDue && postedToday >= DailyCap) continue;
            if (m.ExpiresAt is { } e && e <= now) continue;
            var before = history.FirstOrDefault(h => h.Key == m.Key);
            if (before is null) return m;
            if (before.DismissedAt is not null) { if (before.FactsHash != m.FactsHash) return m; continue; }   // "Don't show again" holds until the facts change
            if (before.SnoozedUntil is { } until) { if (until <= now) return m; continue; }                        // a snooze that has ended lets it return
            if (before.ExpiresAt is { } ex && ex <= now && before.FactsHash != m.FactsHash) return m;             // it ran out; only changed facts bring it back
        }
        return null;
    }

    /// <summary>The thread message for a moment. One per moment and day, so a snoozed card that returns is a new message.</summary>
    public static StanleyNotice ToNotice(Moment m, DateTime now) =>
        new($"{KeyPrefix}{m.Key}:{now:yyyyMMdd}", Lane, KindOf, m.Path, m.Text, $"{KeyPrefix}{m.Key}", m.ExpiresAt, ChatUrgencyRules.Normal, m.Subject);

    /// <summary>The moment key out of a card's notice key (<c>moment:finalPayment:20261110</c>), or null when it is not a card.</summary>
    public static string? KeyOf(string? noticeKey)
    {
        if (noticeKey is null || !noticeKey.StartsWith(KeyPrefix, StringComparison.Ordinal)) return null;
        var rest = noticeKey[KeyPrefix.Length..];
        var i = rest.LastIndexOf(':');
        return i > 0 ? rest[..i] : null;
    }

    /// <summary>A phone alert for a card says only this: never a price, a cabin or a due amount. By default a card sends none (a quiet badge only); the text is here so a test pins it.</summary>
    public const string PushText = "Stanley has a suggestion";

    public const string Snooze = "snooze", Dismiss = "dismiss";
    public static bool ValidAction(string? a) => a is Snooze or Dismiss;
}
