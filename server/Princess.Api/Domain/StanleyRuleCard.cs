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
        Check("ACT-03", "Drafts for approval", ["sea", "port"], "A sailing day is open", "the bundle for the day and the all-aboard time", "the guest copies the note or closes it",
            "Draft a note to my party", ["journey-solo"], ["booked tours and dinners", "sailing days and all-aboard times"]),
        Check("TRUST-05", "Trip so far", ["sea", "port", "disembark"], "Stanley has done something for the guest", "counts of what Stanley did and what the guest undid, from the ledger", "the guest closes it; it keeps no score",
            "What have you done for me so far?", ["journey-solo"], ["Stanley ledger counts"]),
        Check("TRUST-03", "Level suggestion", ["sea", "port"], "Three yeses with no undo, or two undos, of one kind", "counts of confirmed and undone acts of one kind, from the ledger", "the guest opens the screen or ignores it; nothing changes either way",
            "Should you do more of this for me?", ["journey-solo"], ["Stanley ledger counts"]),
    ];

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
