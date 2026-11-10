namespace Princess.Api.Domain;

/// <summary>A notice as it is written into the guest's Stanley thread (docs/chat-features-research.md, section 15.4). One per <see cref="Key"/>; a newer one with the same <see cref="SupersedeKey"/> replaces the older.</summary>
public sealed record StanleyNotice(string Key, string Lane, string Kind, string Path, string Text, string? SupersedeKey, DateTime? ExpiresAt, string Urgency, string? Subject = null);

/// <summary>
/// The notice relay's pure rules (phase 0b): which lane a push notice belongs to, how long it stays useful, what it supersedes and the words of the thread message. The delivery path
/// (the thread first, the phone push always, and the push alone when writing to the thread fails) is in <see cref="Services.StanleyNoticeRelay"/> and <see cref="Services.PushService"/>.
/// </summary>
public static class StanleyNoticeRules
{
    /// <summary>The events of the delivery log (docs/chat-features-research.md, 15.8): written to the thread, written only to the phone because the thread failed, and the guest's Got it.</summary>
    public const string EventPosted = "posted", EventFailOpen = "failOpen", EventAcked = "acked";

    public const string Critical = "critical", Important = "important", Reminder = "reminder", Info = "info";
    public static readonly string[] Lanes = [Critical, Important, Reminder, Info];

    /// <summary>
    /// The notice kinds allowed to bypass quiet hours, calm mode and the budget: safety, and deadlines that decide whether the guest makes the trip. This list is under change control:
    /// a test fails when a built notice bypasses with a kind that is not here.
    /// </summary>
    public static readonly string[] BypassKinds = ["allAboard", "backAboard", "disruption", "payment", "travel", "scheduleChange", "muster"];

    /// <summary>Kinds that need action soon without being safety: they are Important when they do not bypass.</summary>
    private static readonly string[] ImportantKinds = ["allAboard", "backAboard", "disruption", "payment", "travel", "reservation", "case", "helper", "documents", "checkin", "service", "muster"];

    public static string LaneOf(PushNotice n) =>
        n.Kind == OfferKind ? Info   // an offer is never critical and never important, whatever it claims
        : n.Bypass ? Critical
        : ImportantKinds.Contains(n.Kind) ? Important
        : n.Kind == "reminder" ? Reminder
        : Info;

    // ---- Phase 0d: supervised accounts, the guardian's copy, kill switches and offers ----

    /// <summary>The kind of a commercial message. It is its own opt-in category and is built by no rule today; the gate below is what any future offer must pass.</summary>
    public const string OfferKind = "offer";

    /// <summary>The kind of a critical notice copied into a guardian's thread about their child.</summary>
    public const string ChildCopyKind = "childNotice";

    /// <summary>What a supervised account is told, in the notices' own scripted wording: the muster drill, all-aboard, schedule and check-in. No payment, trip-planning, case, reminder or offer notice.</summary>
    public static readonly string[] ChildKinds = ["muster", "allAboard", "backAboard", "scheduleChange", "disruption", "checkin", "checkinSoon", "documents"];

    /// <summary>The notices a supervised account's thread may carry. Everything else is for the guardian, who is told through their own account.</summary>
    public static bool ChildMayReceive(PushNotice n) => n.Kind != OfferKind && ChildKinds.Contains(n.Kind);

    /// <summary>
    /// An offer reaches a thread only when the guest opted in to offers, no serious case is open, the account is not supervised, and the offer does not try to bypass quiet hours. A required notice
    /// is never an offer, so this gate never holds one back.
    /// </summary>
    public static bool OfferAllowed(PushNotice n, bool optedIn, bool seriousCaseOpen, bool supervised) =>
        n.Kind != OfferKind || (optedIn && !seriousCaseOpen && !supervised && !n.Bypass);

    /// <summary>
    /// The guardian's copy of a child's critical notice, labelled with the child's first name. Only the critical lane is copied; the copy has its own key (one per child and occasion), carries no
    /// action (the guardian cannot confirm the child's muster from their own station) and names the child in words. Null for any other lane.
    /// </summary>
    public static StanleyNotice? ForGuardian(StanleyNotice n, string childFirstName, long childId)
    {
        if (n.Lane != Critical) return null;
        var name = string.IsNullOrWhiteSpace(childFirstName) ? "Your child" : childFirstName.Trim();
        var text = $"For {name}: {n.Text}";
        return n with
        {
            Key = $"child:{childId}:{n.Key}", Kind = ChildCopyKind, Path = "/home", Text = text.Length > 1000 ? text[..1000] : text,
            SupersedeKey = n.SupersedeKey is null ? null : $"child:{childId}:{n.SupersedeKey}", Subject = null,
        };
    }

    /// <summary>
    /// A switch that stops one lane being written to threads (docs/chat-features-research.md, 15.8, point 9). Safe default: every lane is on. The phone push is decided elsewhere and is never held
    /// by this, so switching the critical lane off in the thread leaves the direct push in place.
    /// </summary>
    public static bool LaneOn(string lane, bool critical, bool important, bool reminder, bool info) => lane switch
    {
        Critical => critical, Important => important, Reminder => reminder, _ => info,
    };

    /// <summary>How long a message stays actionable. A muster or all-aboard prompt is stale within hours; a payment reminder lasts days; information does not expire.</summary>
    public static DateTime? ExpiryOf(string lane, DateTime now) => lane switch
    {
        Critical => now.AddHours(6),
        Important => now.AddHours(48),
        Reminder => now.AddHours(24),
        _ => null,
    };

    /// <summary>The same occasion with new facts (the all-aboard time moved) shares a tag; a notice with no tag supersedes nothing.</summary>
    public static string? SupersedeKeyOf(PushNotice n) => string.IsNullOrWhiteSpace(n.Tag) ? null : $"{n.Kind}:{n.Tag}";

    /// <summary>Critical and important messages ask for Got it, through the existing urgency flag, so the acknowledgement store and the urgent style are the ones chat already has.</summary>
    public static string UrgencyOf(string lane) => lane switch { Critical => ChatUrgencyRules.Urgent, Important => ChatUrgencyRules.Important, _ => ChatUrgencyRules.Normal };

    /// <summary>The thread message for a notice: title, then body. The notice passed in has already been through <see cref="PushRules.Redact"/> only for the lock screen; the thread shows the full text.</summary>
    public static StanleyNotice Build(PushNotice n, DateTime now)
    {
        var lane = LaneOf(n);
        // The thread is already Stanley's: the "Stanley: " the phone needs on a lock screen would only repeat his name.
        var title = n.Title.StartsWith("Stanley: ", StringComparison.Ordinal) ? n.Title["Stanley: ".Length..] : n.Title;
        var text = string.IsNullOrWhiteSpace(n.Body) ? title : $"{title}\n{n.Body}";
        return new(n.Key, lane, n.Kind, n.Path, text.Length > 1000 ? text[..1000] : text, SupersedeKeyOf(n), ExpiryOf(lane, now), UrgencyOf(lane),
            n.Params.TryGetValue("card", out var card) && card is string cs && cs.Length is > 0 and <= 120 ? cs : null);
    }

    /// <summary>Whether a message can still be acted on: not replaced, not past its expiry.</summary>
    public static bool Active(DateTime? expiresAt, bool superseded, DateTime now) => !superseded && (expiresAt is null || expiresAt > now);

    /// <summary>What the notices that only ever lived on screen are built from (phase 0b). Everything here is already known to the server.</summary>
    public sealed record ScreenInput(
        DateTime Now, DateTime? DrillAt, bool MusterDone, int DocumentsMissing, int PassportProblems, string CheckinState, string CheckinOpens, IReadOnlyList<Guid> AnsweredTickets);

    public const int MusterOpensMinutes = 60, MusterClosesHours = 18;

    /// <summary>
    /// The notices the app showed only on screen (the muster drill, documents, check-in and Guest Services answers), as thread-only notices: they are never sent to a phone, which already hears of
    /// payments, flights and changes through <see cref="PushRules.Build"/>. Each has a stable key, so the occasion is posted once; the facts stay on their own screens.
    /// </summary>
    public static List<PushNotice> ScreenNotices(ScreenInput i)
    {
        var list = new List<PushNotice>();
        if (i.DrillAt is { } drill && !i.MusterDone && i.Now >= drill.AddMinutes(-MusterOpensMinutes) && i.Now <= drill.AddHours(MusterClosesHours))
            list.Add(new($"muster:{drill:yyyyMMdd}", "muster", "critical", true, 100, "/ship/muster", "Safety drill: confirm your muster station",
                "Everyone on board must attend the safety drill. Open Muster to see your station and confirm you have been.", new() { ["drill"] = drill.ToString("o") }));
        if (i.PassportProblems > 0)
            list.Add(new($"passportProblem:{i.PassportProblems}", "documents", "documents", false, 70, "/me/documents", "A passport needs attention",
                i.PassportProblems == 1 ? "One passport on your booking has a problem. Open Documents to fix it." : $"{i.PassportProblems} passports on your booking have a problem. Open Documents to fix them.", new() { ["count"] = i.PassportProblems }));
        if (i.DocumentsMissing > 0)
            list.Add(new($"documentsMissing:{i.DocumentsMissing}", "documents", "documents", false, 60, "/me/documents", "Travel documents are missing",
                i.DocumentsMissing == 1 ? "One travel document is still missing. Open Documents to add it." : $"{i.DocumentsMissing} travel documents are still missing. Open Documents to add them.", new() { ["count"] = i.DocumentsMissing }));
        if (i.CheckinState == "open")
            list.Add(new($"checkinOpen:{i.CheckinOpens}", "checkin", "checkin", false, 65, "/home/check-in", "Online check-in is open", "Check in now to get your boarding pass.", new() { ["date"] = i.CheckinOpens }));
        else if (i.CheckinState != "done")
            list.Add(new($"checkinOpens:{i.CheckinOpens}", "checkinSoon", "checkin", false, 20, "/home/check-in", "Online check-in opens soon", $"Check-in opens on {i.CheckinOpens}.", new() { ["date"] = i.CheckinOpens }));
        foreach (var id in i.AnsweredTickets)
            list.Add(new($"ticket:{id:N}", "service", "checkin", false, 60, "/me/help", "Guest Services has answered", "Your request has been answered. Open Help to read the reply.", new() { ["ticket"] = id.ToString("N") }));
        return list;
    }

    // ---- Phase 0c: the delivery log's counts ----

    public const int DefaultStatsHours = 24, MaxStatsHours = 720;

    /// <summary>The window asked for, in hours: the default when none is given, and never outside 1 to 720.</summary>
    public static int StatsWindowHours(int? hours) => hours is null ? DefaultStatsHours : Math.Clamp(hours.Value, 1, MaxStatsHours);

    // ---- Phase 0c: actions and replies ----

    /// <summary>The replies a notice offers as chips. Remind me later is never offered for a critical notice: safety is not put off.</summary>
    public const string ReplyWhy = "why", ReplyWhat = "what", ReplyLater = "later";
    public const int LaterMinutes = 60;

    public static IReadOnlyList<string> RepliesOf(string lane) => lane switch
    {
        Critical => [ReplyWhy, ReplyWhat],
        Info => [ReplyWhy],
        _ => [ReplyWhy, ReplyWhat, ReplyLater],
    };

    /// <summary>
    /// The things a guest can do from the thread, by id. The front end turns an id into a button: <c>confirmMuster</c> calls the muster service the muster screen calls; the rest open the screen that
    /// already does the job (check in, pay, boarding pass), so the thread never has a second way to change anything. A notice that is expired or replaced offers none.
    /// </summary>
    public static IReadOnlyList<string> ActionsOf(string kind) => kind switch
    {
        "muster" => ["confirmMuster"],
        "checkin" => ["checkIn"],
        "payment" => ["pay"],
        "travel" => ["boardingPass"],
        "scheduleChange" => ["addToPlan"],
        _ => [],
    };

    /// <summary>The action that shows the change engine's card for this notice, with its options (move dinner, add to plan) each prepared and confirmed on the card's own Confirm. Offered only when the notice names its card.</summary>
    public const string ReviewChange = "reviewChange";

    public static IReadOnlyList<string> ActionsFor(string kind, string? subject, bool expired, bool superseded)
    {
        if (expired || superseded) return [];
        return kind is "reservation" or "change" && !string.IsNullOrEmpty(subject) ? [ReviewChange] : ActionsOf(kind);
    }

    private static string WhyOf(string kind) => kind switch
    {
        "muster" => "Everyone on board must attend the safety drill, so I tell each guest until they have confirmed.",
        "allAboard" or "backAboard" => "The ship sails at the all-aboard time, so I tell you before it.",
        "disruption" => "Something changed on your trip that affects you.",
        "payment" => "A payment on your booking needs attention before its due date.",
        "travel" => "Your flight changed or is coming up.",
        "scheduleChange" => "Something in your plan moved.",
        ChildCopyKind => "You are the guardian of a child on your booking, so I copy their safety notices to you.",
        "documents" or "passportProblem" => "Your travel documents must be complete before you board.",
        "checkin" or "checkinSoon" => "Online check-in has a window, and you need it for your boarding pass.",
        "service" => "Guest Services answered a request you made.",
        "reminder" => "You asked me to remind you.",
        _ => "This is an automatic notice about your trip.",
    };

    private static string WhatOf(string kind) => kind switch
    {
        "muster" => "Go to your muster station and confirm that you have been, or tap Confirm in this message.",
        "allAboard" or "backAboard" => "Be back on board before the all-aboard time.",
        "payment" => "Open Payments and check the instalment.",
        "travel" => "Open the travel screen to see your flight and boarding pass.",
        "scheduleChange" => "Open your plan to see what moved and whether to keep it.",
        "documents" or "passportProblem" => "Open Documents and add or fix what is missing.",
        "checkin" => "Check in now to get your boarding pass.",
        "service" => "Open Help to read the reply.",
        ChildCopyKind => "Make sure the child has seen it and knows where to be.",
        _ => "Nothing is needed unless the message asks for something.",
    };

    /// <summary>
    /// The answer to "Why?" or "What should I do?": built from the notice's own kind and state, never from the chat history. A notice that is no longer current says so instead of repeating
    /// an instruction that could be wrong now. Null for a reply that is not one of these (Remind me later is handled by the service).
    /// </summary>
    public static string? AnswerTo(string reply, string kind, bool expired, bool superseded)
    {
        if (reply is not (ReplyWhy or ReplyWhat)) return null;
        if (superseded) return "A newer message replaced this one. Please follow that one.";
        if (reply == ReplyWhy) return WhyOf(kind);
        return expired ? "This is no longer needed." : WhatOf(kind);
    }
}
