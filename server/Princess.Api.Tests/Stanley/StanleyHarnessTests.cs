using Princess.Api.Domain;

namespace Princess.Api.Tests.Stanley;

public class StanleyGoldenTests
{
    public static IEnumerable<object[]> Names => StanleyFixtures.All.Select(s => new object[] { s.Name });

    [Theory, MemberData(nameof(Names))]
    public async Task EveryScriptMatchesItsGolden(string name) => Goldens.Check(await ScriptRunner.RunAsync(StanleyFixtures.Named(name)));

    [Fact]
    public void FixtureNamesAreUniqueAndEveryGoldenHasAScript()
    {
        Assert.Equal(StanleyFixtures.All.Count, StanleyFixtures.All.Select(s => s.Name).Distinct().Count());
        var dir = Path.GetDirectoryName(Goldens.PathFor("x"))!;
        if (!Directory.Exists(dir)) return;
        Assert.All(Directory.GetFiles(dir, "*.json").Select(Path.GetFileNameWithoutExtension), n => Assert.True(StanleyFixtures.Exists(n!), $"golden {n} has no script"));
    }

    [Fact]
    public async Task AStormIsOneRankedSetWithinTheBudget()
    {
        var r = await ScriptRunner.RunAsync(StanleyFixtures.Named("storm"));
        Assert.Equal(1, r.Passes.Single().Summary.Claimed / 30);
        var ordinary = r.Deliveries.Where(d => !d.Critical).ToList();
        Assert.True(ordinary.Count <= 4);
        Assert.Equal(ordinary.OrderBy(d => d.Rank).Select(d => d.Rank), ordinary.Select(d => d.Rank));
    }
}

/// <summary>The invariants of 23.3, read from what the worker really did, over every fixture and over many seeded random scripts.</summary>
public class StanleyInvariantTests
{
    public static IEnumerable<object[]> Names => StanleyFixtures.All.Select(s => new object[] { s.Name });
    public static IEnumerable<object[]> Seeds => Enumerable.Range(1, 150).Select(i => new object[] { i });

    [Theory, MemberData(nameof(Names))]
    public async Task HoldForEveryFixture(string name) => Check(await ScriptRunner.RunAsync(StanleyFixtures.Named(name)));

    [Theory, MemberData(nameof(Seeds))]
    public async Task HoldForRandomScripts(int seed) => Check(await ScriptRunner.RunAsync(Random(seed)));

    private static Script Random(int seed)
    {
        var rng = new System.Random(seed);
        var start = new DateTime(2027, 3, 1, 0, 0, 0, DateTimeKind.Utc);
        var steps = new List<Step>();
        string[] classes = ["plan", "rule", "reminder"];
        var keys = 0;
        for (var minute = 0; minute < 240; minute += rng.Next(1, 12))
        {
            switch (rng.Next(8))
            {
                case 0 or 1 or 2:
                    var key = rng.Next(5) == 0 && keys > 0 ? $"k{rng.Next(keys)}" : $"k{keys++}";   // sometimes a duplicate event
                    steps.Add(new Queue(minute, key, User: rng.Next(1, 4), DueIn: rng.Next(0, 90), Class: classes[rng.Next(3)], Rank: rng.Next(0, 6), Critical: rng.Next(10) == 0,
                        Subject: rng.Next(3) == 0 ? $"B{rng.Next(3)}" : "", Fact: rng.Next(6) == 0 ? $"f{rng.Next(4)}" : ""));
                    break;
                case 3: steps.Add(new Allow(minute, rng.Next(1, 4), new Limits(Budget: rng.Next(0, 5), Quiet: rng.Next(4) == 0, Dnd: rng.Next(5) == 0, Calm: rng.Next(4) == 0, Ship: rng.Next(6) == 0, Gone: rng.Next(20) == 0, Off: rng.Next(6) == 0 ? ["rule"] : null))); break;
                case 4 when keys > 0: steps.Add(new Withdraw(minute, $"k{rng.Next(keys)}")); break;
                case 5: steps.Add(new Outage(minute, rng.Next(3) == 0)); break;
                case 6 when rng.Next(3) == 0: steps.Add(new Restart(minute)); break;
                default: steps.Add(new Run(minute)); break;
            }
        }
        steps.Add(new Outage(240, false));
        for (var i = 0; i < 6; i++) steps.Add(new Run(250 + i * 70));
        return new($"random-{seed}", "random", start, [.. steps], BreakerLimit: rng.Next(2, 30), OffClasses: rng.Next(10) == 0 ? ["reminder"] : null);
    }

    private static void Check(ScriptResult r)
    {
        var why = $" (script {r.Script.Name})";
        var queued = r.Rows.ToDictionary(x => x.IdemKey);

        // One act only: no key is delivered twice, however often it was queued, claimed or restarted.
        var keys = r.Deliveries.SelectMany(d => d.Keys).ToList();
        Assert.True(keys.Count == keys.Distinct().Count(), "an item was delivered twice" + why);

        foreach (var d in r.Deliveries)
        {
            foreach (var k in d.Keys)
            {
                var row = queued[k];
                Assert.True(row.DueAt <= d.At, $"{k} was delivered before it was due" + why);                                       // never early
                Assert.False(r.Withdrawn.TryGetValue(k, out var w) && w <= d.At, $"{k} was delivered after its stop fact went" + why);    // never after the need has gone
                Assert.False((d.Limits.Off ?? []).Contains(row.ClassId), $"{k} was delivered while its class was off for the guest" + why);
                Assert.False(r.Script.OffClasses?.Contains(row.ClassId) ?? false, $"{k} was delivered while its class was off for the operator" + why);
                Assert.False(d.Limits.Gone, $"{k} was delivered to a guest who had gone" + why);
                Assert.Equal(d.User, row.UserId);                                                                                // never to someone else
            }
            if (!d.Critical && d.Rank != StanleyRank.Safety)
            {
                Assert.False(d.Limits.Ship || d.Limits.Dnd || d.Limits.Quiet, "an ordinary card was sent during a ship alert, do-not-disturb or quiet hours" + why);
                Assert.True(d.SentBefore < d.Limits.Budget, "an ordinary card went past the day's budget" + why);
                Assert.Equal(!d.Limits.Calm, d.Push);                                                                           // calm mode: thread only
            }
        }

        // Every item ends somewhere with a reason, and an item that was delivered is closed as done.
        foreach (var row in r.Rows)
        {
            if (keys.Contains(row.IdemKey)) Assert.Equal(StanleyDueState.Done, row.State);
            else if (row.State is StanleyDueState.Held or StanleyDueState.Dropped) Assert.False(string.IsNullOrEmpty(row.Reason), $"{row.IdemKey} was closed with no reason" + why);
            else Assert.NotEqual(StanleyDueState.Done, row.State);
        }
    }
}

public class StanleyRuleCardTests
{
    private static StanleyRuleCard Good() => new("rule-demo", "Demo", ["sea"], 3, 3, StanleyActClass.Prepare, "A booking is linked", StanleyTrigger.Time, "plan items", 60, "card",
        ["stanley.rule.demo.title"], [], 2, 0, "Rules", ["delivered", "undone"], "Remind me an hour before", ["journey-solo"], ["Plan"], "Card has a text label and a button", "Never sends a message to another person");

    [Fact]
    public void AWellFormedCardHasNoProblems() => Assert.Empty(StanleyRuleCards.Problems(Good()));

    [Theory]
    [InlineData("id")] [InlineData("name")] [InlineData("appliesWhen")] [InlineData("trigger")] [InlineData("inputs")] [InlineData("outputKind")] [InlineData("killSwitch")]
    [InlineData("examplePrompt")] [InlineData("accessibility")] [InlineData("never")] [InlineData("wordingKeys")] [InlineData("metrics")] [InlineData("fixtures")] [InlineData("privacyInputs")]
    public void ACardWithAMissingFieldIsNotMergeable(string field)
    {
        var c = field switch
        {
            "id" => Good() with { Id = "" }, "name" => Good() with { Name = " " }, "appliesWhen" => Good() with { AppliesWhen = "" }, "trigger" => Good() with { Trigger = "" },
            "inputs" => Good() with { Inputs = "" }, "outputKind" => Good() with { OutputKind = "" }, "killSwitch" => Good() with { KillSwitch = "" },
            "examplePrompt" => Good() with { ExamplePrompt = "" }, "accessibility" => Good() with { Accessibility = "" }, "never" => Good() with { Never = "" },
            "wordingKeys" => Good() with { WordingKeys = [] }, "metrics" => Good() with { Metrics = [] }, "fixtures" => Good() with { Fixtures = [] }, _ => Good() with { PrivacyInputs = [] },
        };
        Assert.Contains(StanleyRuleCards.Problems(c), p => p.StartsWith(field));
    }

    [Fact]
    public void TheRulesOfTheLadderAreEnforced()
    {
        Assert.NotEmpty(StanleyRuleCards.Problems(Good() with { Class = StanleyActClass.Act, Rung = 3, UndoMinutes = 120 }));        // an act is rung 4
        Assert.NotEmpty(StanleyRuleCards.Problems(Good() with { Class = StanleyActClass.Act, Rung = 4, Level = 4, UndoMinutes = 0 })); // an act can be undone
        Assert.NotEmpty(StanleyRuleCards.Problems(Good() with { Rung = 4, Level = 3 }));
        Assert.NotEmpty(StanleyRuleCards.Problems(Good() with { Level = 1 }));
        Assert.Empty(StanleyRuleCards.Problems(Good() with { Class = StanleyActClass.Act, Rung = 4, Level = 4, UndoMinutes = 120 }));
    }

    [Fact]
    public void TheWordAIIsRefusedInGuestFacingTextAndWordingKeysAreKeys()
    {
        Assert.NotEmpty(StanleyRuleCards.Problems(Good() with { Name = "AI helper" }));
        Assert.NotEmpty(StanleyRuleCards.Problems(Good() with { ExamplePrompt = "Ask the artificial intelligence" }));
        Assert.Empty(StanleyRuleCards.Problems(Good() with { Name = "Maintain a plan" }));   // "AI" inside a word is fine
        Assert.NotEmpty(StanleyRuleCards.Problems(Good() with { WordingKeys = ["Some prose here"] }));
    }

    [Fact]
    public void EveryRegisteredCardMeetsTheFormatWithRealFixturesAndInventoriedInputs()
    {
        Assert.Equal(StanleyRuleCards.All.Count, StanleyRuleCards.All.Select(c => c.Id).Distinct().Count());
        var inventory = File.ReadAllText(InventoryPath());
        foreach (var c in StanleyRuleCards.All)
        {
            Assert.True(StanleyRuleCards.Problems(c).Count == 0, $"{c.Id}: {string.Join("; ", StanleyRuleCards.Problems(c))}");
            foreach (var f in c.Fixtures) Assert.True(StanleyFixtures.Exists(f), $"{c.Id} names a fixture that does not exist: {f}");
            foreach (var i in c.PrivacyInputs) Assert.Contains(i, inventory, StringComparison.OrdinalIgnoreCase);
        }
    }

    private static string InventoryPath([System.Runtime.CompilerServices.CallerFilePath] string here = "") =>
        Path.GetFullPath(Path.Combine(Path.GetDirectoryName(here)!, "..", "..", "..", "docs", "stanley-data-inventory.md"));
}
