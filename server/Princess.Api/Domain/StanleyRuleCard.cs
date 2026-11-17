using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>The classes of work a rule may do. Rung 4 classes may never touch money, another person or a shared or paid item (docs/stanley-actions-and-proactive-plan.md, 23.3).</summary>
public static class StanleyActClass
{
    public const string Notice = "notice", Prepare = "prepare", Act = "act";
    public static readonly string[] All = [Notice, Prepare, Act];
}

/// <summary>
/// The unit of authoring and review for one ability or rule (23.2). A rule is not mergeable without every field and its fixtures: <see cref="StanleyRuleCards.Problems"/> says what is missing.
/// <c>WordingKeys</c> are i18n keys (never prose); <c>Fixtures</c> name scripts in the test harness; <c>PrivacyInputs</c> must each appear in <c>docs/stanley-data-inventory.md</c>.
/// </summary>
public sealed record StanleyRuleCard(
    string Id, string Name, string[] Stages, int Level, int Rung, string Class,
    string AppliesWhen, string Trigger, string Inputs, int FreshnessMinutes, string OutputKind,
    string[] WordingKeys, string[] ClassifierNeeds, int DailyCap, int UndoMinutes, string KillSwitch,
    string[] Metrics, string ExamplePrompt, string[] Fixtures, string[] PrivacyInputs, string Accessibility, string Never);

/// <summary>The registry and the checks. Each later phase adds one card per rule to <see cref="All"/>; the harness test then holds them to the format.</summary>
public static class StanleyRuleCards
{
    public static readonly IReadOnlyList<StanleyRuleCard> All =
    [
        Check("CHK-01", "Trip check-up", ["manage", "prebook", "travel"], "A booking is linked", "documents, payment and check-in state of the booking", "the guest saves a document, pays or finishes check-in, and the finding goes",
            "Check my trip for problems", ["journey-solo", "journey-family"], ["document status per traveller", "payment state and due date", "check-in window"]),
        Check("CHK-02", "Plan lint", ["prebook", "embark", "sea", "port"], "A tour or dinner is booked", "booked tours and dinners against the sailing's arrival, all aboard and dinner times", "the guest moves or removes the tour or dinner, and the finding goes",
            "Does my plan clash with anything?", ["tour-cancelled", "journey-family"], ["booked tours and dinners", "sailing days and all-aboard times"]),
        Check("CHK-08", "Deadline radar", [], "A booking is linked", "final payment, check-in opening and closing, and documents still missing", "the date passes or the guest does what it asks",
            "What dates can cost me something?", ["journey-solo"], ["payment due date", "check-in window", "document status per traveller"]),
        Check("CHK-04", "Bill watch", ["sea", "port", "disembark"], "A sailing is under way", "posted and pending charges, package cover and excursion credit left", "the guest asks about the charge or it is put right on the bill",
            "Is anything wrong on my bill?", ["journey-solo"], ["onboard bill lines", "package cover", "excursion credit left"]),
        Check("VAL-01", "Included-value finder", ["sea", "port"], "A package or credit is held", "included specialty dinners and Wi-Fi still unused", "the guest uses it or the days run out",
            "What does my package include that I have not used?", ["journey-solo"], ["package balances"]),
        Check("CHK-05", "Forgot something?", ["prebook", "travel"], "Sailing within two weeks", "elegant nights, tender ports and the season at the departure date", "the guest sails",
            "Have I forgotten anything to pack?", ["journey-solo"], ["sailing days and ports"]),
        Check("ACT-01", "Bundles", ["sea", "port"], "A sailing day is open", "booked tours and dinners, the day's events and the all-aboard time", "the guest does each step on its own screen",
            "Plan my evening", ["journey-solo", "journey-family"], ["booked tours and dinners", "sailing days and all-aboard times"]),
        Check("ACT-02", "Trip checklist concierge", ["manage", "prebook", "travel"], "A booking is linked", "check-in steps per traveller, booked dinners and tours", "the guest finishes the step on its screen",
            "What do I still need to do?", ["journey-solo", "journey-family"], ["check-in progress per traveller", "booked tours and dinners"]),
        Check("ACT-04", "Smart defaults", ["prebook", "sea"], "The guest has told Stanley a preference", "the guest's own remembered dinner preference", "the guest sets the choice on the screen or forgets the item",
            "Book my dinner the way I like it", ["journey-solo"], ["remembered preferences"]),
        Check("CHK-03", "Missed-ship guard", ["port"], "The guest said they are ashore or leaving on a port day", "the guest's own away status, the chosen head-back buffer, all-aboard and tender or pier", "the guest is back aboard or all aboard has passed and the missed-ship steps are shown",
            "How long have I got before the ship leaves?", ["tender-delayed"], ["away status for today's port", "sailing days and all-aboard times"]),
        Check("CHK-07", "Group gaps", ["prebook", "sea", "port"], "The party has an open poll", "who has not answered each open poll of the booking, as a count", "everyone has answered or the poll closes",
            "Who has not answered our poll?", ["journey-family"], ["open polls and answer counts"]),
        Check("SR-4.5", "What to expect", ["manage", "prebook"], "The sailing is within sixty days", "days to sail, the next payment or check-in date, and how many dinners and tours are booked", "the guest sails",
            "What should I expect before I sail?", ["journey-solo"], ["payment due date", "check-in window", "booked tours and dinners"]),
        Check("SR-5.4", "Dinner for everyone", ["prebook"], "Three or more adults sail and no dinner poll is open", "how many adults are on the booking and the open polls", "a dinner poll exists or the guest sails",
            "Can we pick a dinner night together?", ["journey-family"], ["open polls and answer counts"]),
        Check("SR-6.1", "Check-in open", ["prebook"], "Online check-in is open", "the check-in state and when it closes", "check-in is done or closed",
            "Is check-in open?", ["journey-solo"], ["check-in window"]),
        Check("SR-6.6", "Phone and money", ["prebook"], "The guest sails within three days", "days to sail", "the guest sails",
            "What should I set up on my phone and card?", ["journey-solo"], ["sailing dates"]),
        Check("SR-7.2", "Muster", ["board"], "It is the day of sailing", "the sailing date", "the day of sailing ends",
            "Where do I go for muster?", ["journey-solo"], ["sailing dates"]),
        Check("SR-10.1", "Bag night", ["disembark"], "It is the last evening of the voyage", "the sailing date and the number of nights", "the ship gets in",
            "What do I do about my bags tonight?", ["journey-solo"], ["sailing dates"]),
        Check("SR-10.2", "Final bill", ["disembark"], "It is the last evening of the voyage", "the sailing date and the number of nights", "the ship gets in",
            "Is my final bill right?", ["journey-solo"], ["sailing dates"]),
        Check("SR-10.4", "Tips explained", ["disembark"], "It is the last evening of the voyage", "the sailing date and the number of nights", "the ship gets in",
            "What are the tips and can I change them?", ["journey-solo"], ["sailing dates"]),
        Check("SR-10.3", "Customs form", ["disembark"], "It is the last evening of the voyage", "the sailing date and the number of nights", "the ship gets in",
            "Is my customs form ready?", ["journey-solo"], ["sailing dates"]),
        Check("SR-10.6", "Leave nothing behind", ["disembark"], "It is the morning the ship gets in", "the sailing date and the number of nights", "the day ends",
            "What should I check before I leave the cabin?", ["journey-solo"], ["sailing dates"]),
        Check("SR-F.1", "Kids club ready", ["prebook"], "A child of club age is on the booking and sailing is within two weeks", "the sailing date and the ages on the booking", "the guest sails",
            "Is the kids club something we should plan for?", ["journey-family"], ["sailing dates", "traveller ages"]),
        Check("SR-F.4", "Everyone's muster", ["board"], "It is the day of sailing and a traveller is under 18", "the sailing date and the ages on the booking", "the day of sailing ends",
            "Where does everyone go for muster?", ["journey-family"], ["sailing dates", "traveller ages"]),
        Check("SR-F.5", "Find my family", ["sea"], "The ship is sailing and a traveller is under 18", "the sailing date, the nights and the ages on the booking", "the cruise ends",
            "Where should we meet if we get separated?", ["journey-family"], ["sailing dates", "traveller ages"]),
        Check("SR-11.1", "Keep your memories", ["disembark"], "It is the day the ship gets in", "the sailing date and the number of nights", "the day ends",
            "Where do my photos and notes from the trip go?", ["journey-solo"], ["sailing dates"]),
        Check("SR-11.2", "Tell us how it went", ["disembark"], "It is the day the ship gets in", "the sailing date and the number of nights", "the day ends",
            "Where do I give feedback on the trip?", ["journey-solo"], ["sailing dates"]),
        Check("SR-11.5", "Loyalty explained", ["disembark"], "It is the day the ship gets in", "the sailing date and the number of nights", "the day ends",
            "What did this voyage count for in loyalty?", ["journey-solo"], ["sailing dates"]),
        Check("SR-11.3", "Keep my chats", ["disembark"], "It is the day the ship gets in", "the sailing date and the number of nights", "the day ends",
            "Can I keep my chats?", ["journey-solo"], ["sailing dates"]),
        Check("SR-11.4", "Next voyage", ["disembark"], "It is the day the ship gets in", "the sailing date and the number of nights", "the day ends",
            "Where could I sail next?", ["journey-solo"], ["sailing dates"]),
        Check("SR-11.6", "Expense export", ["disembark"], "It is the day the ship gets in", "the sailing date and the number of nights", "the day ends",
            "Can I save my charges?", ["journey-solo"], ["sailing dates"]),
        Check("SR-1.1", "Your shortlist", ["dream"], "The guest has no trip still to sail", "whether the guest has a confirmed trip still to sail", "the guest books a trip",
            "Can you keep a shortlist for me?", ["journey-solo"], ["sailing dates"]),
        Check("SR-1.2", "When two picks disagree", ["dream"], "The guest has no trip still to sail", "whether the guest has a confirmed trip still to sail", "the guest books a trip",
            "What if we cannot agree on a sailing?", ["journey-solo"], ["sailing dates"]),
        Check("SR-1.3", "Keep an eye on a price", ["dream"], "The guest has no trip still to sail", "whether the guest has a confirmed trip still to sail", "the guest books a trip",
            "Will the price of this sailing change?", ["journey-solo"], ["sailing dates"]),
        Check("SR-2.1", "Find a cabin like this", ["discover"], "The guest has no trip still to sail", "whether the guest has a confirmed trip still to sail", "the guest books a trip",
            "Can I compare cabins side by side?", ["journey-solo"], ["sailing dates"]),
        Check("SR-2.4", "Decide with the facts", ["discover"], "The guest has no trip still to sail", "whether the guest has a confirmed trip still to sail", "the guest books a trip",
            "What should I know before I choose?", ["journey-solo"], ["sailing dates"]),
        Check("SR-2.5", "Does a package pay?", ["discover"], "The guest has no trip still to sail", "whether the guest has a confirmed trip still to sail", "the guest books a trip",
            "Would a package pay for me?", ["journey-solo"], ["sailing dates"]),
        Check("SR-3.4", "Share the cost", ["book"], "The guest has no trip still to sail", "whether the guest has a confirmed trip still to sail", "the guest books a trip",
            "Can we split the cost?", ["journey-solo"], ["sailing dates"]),
        Check("SR-3.3", "What if plans change?", ["book"], "The guest has no trip still to sail", "whether the guest has a confirmed trip still to sail", "the guest books a trip",
            "What happens if I cancel?", ["journey-solo"], ["sailing dates"]),
        Check("SR-3.5", "Deposits and balances", ["book"], "The guest has no trip still to sail", "whether the guest has a confirmed trip still to sail", "the guest books a trip",
            "When is my deposit due?", ["journey-solo"], ["sailing dates"]),
        Check("ACT-03", "Drafts for approval", ["sea", "port"], "A sailing day is open", "the bundle for the day and the all-aboard time", "the guest copies the note or closes it",
            "Draft a note to my party", ["journey-solo"], ["booked tours and dinners", "sailing days and all-aboard times"]),
        Check("TRUST-05", "Trip so far", ["sea", "port", "disembark"], "Stanley has done something for the guest", "counts of what Stanley did and what the guest undid, from the ledger", "the guest closes it; it keeps no score",
            "What have you done for me so far?", ["journey-solo"], ["Stanley ledger counts"]),
        Check("TRUST-03", "Level suggestion", ["sea", "port"], "Three yeses with no undo, or two undos, of one kind", "counts of confirmed and undone acts of one kind, from the ledger", "the guest opens the screen or ignores it; nothing changes either way",
            "Should you do more of this for me?", ["journey-solo"], ["Stanley ledger counts"]),
        Rule("RUL-01", "Replace a cancelled or moved tour", StanleyTrigger.Change, "A tour is booked and a change is on record for its day", "booked tours, the change list and places left on same-day tours", "Your tour is cancelled. Find me a replacement.",
            ["tour-cancelled"], ["booked tours and dinners", "change list for the trip", "places left on tours"], "CL-05"),
        Rule("RUL-02", "Keep my dinner time", StanleyTrigger.Change, "A dinner is booked and the programme changes that day", "booked dinners, the change list and the time the guest chose", "Keep my dinner at 8:00 if the show moves.",
            ["journey-solo"], ["booked tours and dinners", "change list for the trip"], "CL-05"),
        Rule("RUL-05", "Table watch", StanleyTrigger.Inventory, "The guest named a restaurant and a night", "tables left at the named restaurant, now and at the last look", "Tell me if a table opens on Thursday.",
            ["journey-solo"], ["tables and places left", "the watch the guest made"], "CL-07"),
        Rule("VAL-03", "Space watch", StanleyTrigger.Inventory, "The guest named a tour", "places left on the named tour, now and at the last look", "Tell me if this excursion gets space.",
            ["journey-solo"], ["tables and places left", "the watch the guest made"], "CL-07"),
        Check("RUL-03", "Check-in opens", ["manage", "prebook"], "A booking is linked", "the check-in state and opening time", "check-in is finished or the guest removes the rule",
            "Tell me when check-in opens.", ["journey-solo"], ["check-in window"]),
        Check("RUL-04", "Tender delay", ["port"], "A tender port is on the sailing", "tender changes on record", "the port day passes or the guest removes the rule",
            "Tell me if tenders are delayed.", ["tender-delayed"], ["change list for the trip"]),
        Check("RUL-06", "Formal clothes reminder", ["sea", "port"], "The guest named a formal night", "the day the guest named and today's day number", "the night passes or the guest removes the rule",
            "Remind me to set out my formal clothes.", ["journey-solo"], ["the rule the guest made"]),
        Check("TRUST-02", "Practice mode", ["sea", "port"], "A rule is switched to practice", "what the rule would have offered, listed and not offered", "the guest graduates the rule or removes it",
            "Show me what you would do.", ["journey-solo"], ["the rule the guest made"]),
        Check("TRUST-04", "Control in plain words", [], "The guest types a sentence in the control box", "the sentence, read against six fixed controls and not kept", "the guest confirms or closes it",
            "Be more careful.", ["journey-solo"], ["the sentence, read once and not kept"]),
        new("AUT-02", "Deadline reminders", ["manage", "prebook"], 4, 4, StanleyActClass.Act,
            "The guest has switched on setting their reminders (CL-08) at level 4 and the trip has a date that can cost something", StanleyTrigger.State,
            "check-in opening and the final payment date and state of the booking", 15, "a reminder on the guest's own list with a receipt",
            ["auto.AUT-02.title", "auto.AUT-02.detail"], [], 30, 120, "Stanley:Switches:Authority", ["reminders set", "reminders removed within two hours", "reminders removed later"],
            "Set my deadline reminders.", ["journey-solo"], ["payment due date", "check-in window"],
            "A plain list, one line per reminder with its time in words; every undo a button with words; no colour-only meaning",
            "Never recurs, never sets a reminder that is not tied to a date on the trip, never pays or books anything and never messages anyone. It sets at most 30 per trip, works only while permission row CL-08 is on, and every reminder it sets can be removed from Did or from the reminders list."),
    ];

    /// <summary>A rung 3 rule: it lines something up and asks for the guest's yes; it never books, holds or messages anyone, and works only while its permission row is on.</summary>
    private static StanleyRuleCard Rule(string id, string name, string trigger, string appliesWhen, string inputs, string prompt, string[] fixtures, string[] privacy, string row) =>
        new(id, name, ["sea", "port"], 3, 3, StanleyActClass.Prepare, appliesWhen, trigger, inputs, 15, "a prepared item with a screen to open",
            [$"standing.{id}.title", $"standing.{id}.detail"], [], 5, 1, "Stanley:Switches:Tools", ["items prepared", "items opened", "rules removed"], prompt, fixtures, privacy,
            "A plain list, one heading per item, every action a link with words; no colour-only meaning", $"Never books, pays, cancels, holds a table or place, or messages anyone. It works only while permission row {row} is on and stops when the guest removes the rule.");

    /// <summary>A rung 1 notice: answers when asked, never changes anything, and its fix is only a screen to open.</summary>
    private static StanleyRuleCard Check(string id, string name, string[] stages, string appliesWhen, string inputs, string stops, string prompt, string[] fixtures, string[] privacy) =>
        new(id, name, stages, 2, 1, StanleyActClass.Notice, appliesWhen, StanleyTrigger.State, inputs, 15, "list of findings with a screen to open for each",
            [$"checkup.{id}.title", $"checkup.{id}.detail"], [], 4, 1, "Stanley:Switches:Tools", ["findings per check-up", "fixes opened", "false alarms reported"], prompt, fixtures, privacy,
            "A plain list, one heading per finding, every action a link with words; no colour-only meaning", $"Never changes a booking, document, payment or plan, and never calls a document official. It stops when {stops}.");

    private static readonly Regex AiWord = new(@"\bAI\b|artificial intelligence", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    /// <summary>What is wrong with a card, in plain words. Empty means it meets the format.</summary>
    public static IReadOnlyList<string> Problems(StanleyRuleCard c)
    {
        var p = new List<string>();
        void Need(string field, string? value) { if (string.IsNullOrWhiteSpace(value)) p.Add($"{field} is empty"); }
        void NeedAll(string field, string[]? values) { if (values is not { Length: > 0 } || values.Any(string.IsNullOrWhiteSpace)) p.Add($"{field} needs at least one entry and no blanks"); }

        Need("id", c.Id); Need("name", c.Name); Need("appliesWhen", c.AppliesWhen); Need("trigger", c.Trigger); Need("inputs", c.Inputs);
        Need("outputKind", c.OutputKind); Need("killSwitch", c.KillSwitch); Need("examplePrompt", c.ExamplePrompt); Need("accessibility", c.Accessibility); Need("never", c.Never);
        NeedAll("wordingKeys", c.WordingKeys); NeedAll("metrics", c.Metrics); NeedAll("fixtures", c.Fixtures); NeedAll("privacyInputs", c.PrivacyInputs);
        if (c.Stages is null) p.Add("stages is missing (empty means every stage)");
        if (c.ClassifierNeeds is null) p.Add("classifierNeeds is missing (empty means none)");
        if (c.Level is < 2 or > 4) p.Add("level must be 2 to 4");
        if (c.Rung is < 1 or > 4) p.Add("rung must be 1 to 4");
        if (!StanleyActClass.All.Contains(c.Class)) p.Add("class must be notice, prepare or act");
        if (!StanleyTrigger.All.Contains(c.Trigger)) p.Add("trigger must be time, change, inventory or state");
        if (c.FreshnessMinutes <= 0) p.Add("freshnessMinutes must be positive");
        if (c.DailyCap <= 0) p.Add("dailyCap must be positive");
        if (c.Class == StanleyActClass.Act && c.UndoMinutes <= 0) p.Add("an act needs an undo window");
        if (c.Class == StanleyActClass.Act && c.Rung < 4) p.Add("an act is rung 4");
        if (c.Rung == 4 && c.Level < 4) p.Add("rung 4 needs level 4");
        if (c.Rung == 3 && c.Level < 3) p.Add("rung 3 needs level 3");
        foreach (var text in new[] { c.Name, c.AppliesWhen, c.ExamplePrompt, c.Never }) if (text is not null && AiWord.IsMatch(text)) p.Add("the word AI must not appear in guest-facing text");
        foreach (var key in c.WordingKeys ?? []) if (key is not null && key.Contains(' ')) p.Add($"wording key \"{key}\" must be a key, not prose");
        return p;
    }
}
