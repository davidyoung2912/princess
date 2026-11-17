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
    public static readonly IReadOnlyList<StanleyRuleCard> All = [];

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
