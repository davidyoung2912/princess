using Princess.Api.Domain;

namespace Princess.Api.Tests.Stanley;

/// <summary>The fixture scripts: the three test-plan journeys and the scenario fixtures from 23.1. Later phases add scripts here; each rule card names the ones it must pass.</summary>
public static class StanleyFixtures
{
    private static readonly DateTime Sea = new(2027, 3, 1, 14, 0, 0, DateTimeKind.Utc);
    private const int Safety = StanleyRank.Safety, Money = StanleyRank.Money, Ship = StanleyRank.MissedShip, Problem = StanleyRank.PlanProblem, Convenience = StanleyRank.Convenience, Suggestion = StanleyRank.Suggestion;

    public static readonly IReadOnlyList<Script> All =
    [
        new("journey-solo", "A solo cruiser: three items through the day, delivered as each comes due and not before.", Sea,
        [
            new Queue(0, "dinner-reminder", DueIn: 120), new Queue(0, "tour-reminder", DueIn: 30, Rank: Problem), new Queue(0, "tip", DueIn: 60, Rank: Suggestion),
            new Run(10), new Run(40), new Run(70), new Run(130), new Run(140),
        ]),
        new("journey-family", "A family of four on one booking: five items about the same booking become one card, and the other adult has their own limits.", Sea,
        [
            new Allow(0, 2, new Limits(Budget: 2, Calm: true)),
            new Queue(0, "kids-club", Subject: "B1"), new Queue(0, "dinner", Subject: "B1"), new Queue(0, "tour", Subject: "B1", Rank: Problem), new Queue(0, "show", Subject: "B1"), new Queue(0, "tender", Subject: "B1", Rank: Ship),
            new Queue(0, "mom-spa", User: 2), new Queue(0, "mom-dinner", User: 2, Subject: "B2"),
            new Run(1),
        ]),
        new("journey-friends", "Two friends: one has do-not-disturb on, so ordinary items for them are held and the critical one still arrives.", Sea,
        [
            new Allow(0, 2, new Limits(Dnd: true)),
            new Queue(0, "poll-result", User: 1), new Queue(0, "poll-result-2", User: 2), new Queue(0, "all-aboard", User: 2, Rank: Ship, Critical: true),
            new Run(1),
        ]),
        new("tour-cancelled", "The operator cancels a tour: the rule and the check-up both notice, so it is one card, ranked above the convenience item.", Sea,
        [
            new Queue(0, "rule:tour-9", Rank: Convenience, Fact: "tour:9"), new Queue(0, "checkup:tour-9", Rank: Problem, Fact: "tour:9"), new Queue(0, "lunch-tip", Rank: Suggestion),
            new Run(1),
        ]),
        new("tender-delayed", "A tender delay and a ship alert: ordinary items wait and are not sent later; the missed-ship item is critical and goes.", Sea,
        [
            new Allow(0, 1, new Limits(Ship: true)),
            new Queue(0, "dinner-tip"), new Queue(0, "tender-delay", Rank: Ship, Critical: true), new Queue(0, "shop-tip", Rank: Suggestion),
            new Run(1),
        ]),
        new("show-moved", "A show moves: the reminder anchored to the old time is withdrawn before it is due, so nothing is sent for the old time.", Sea,
        [
            new Queue(0, "show-old-time", DueIn: 60), new Queue(0, "show-new-time", DueIn: 120),
            new Withdraw(30, "show-old-time"),
            new Run(61), new Run(121),
        ]),
        new("duplicate-folio-charge", "The same charge reaches us twice (the same event key) and from two sources (the same fact): one card.", Sea,
        [
            new Queue(0, "folio:77", Rank: Money, Fact: "charge:77"), new Queue(1, "folio:77", Rank: Money, Fact: "charge:77"), new Queue(1, "email:77", Rank: Money, Fact: "charge:77"),
            new Run(2), new Run(3),
        ]),
        new("flight-cancelled", "A flight is cancelled in the middle of the night: a safety-ranked item ignores quiet hours, the rest is held.", Sea,
        [
            new Allow(0, 1, new Limits(Quiet: true)),
            new Queue(0, "flight-cancelled", Rank: Safety), new Queue(0, "breakfast-tip", Rank: Suggestion),
            new Run(1),
        ]),
        new("provider-outage", "The delivery provider is down: the item is put back, not lost, retried after five minutes, and sent once when it recovers.", Sea,
        [
            new Outage(0, true), new Queue(0, "dinner"),
            new Run(1), new Run(3), new Run(7), new Outage(8, false), new Run(9), new Run(20),
        ]),
        new("storm", "Thirty events inside a minute: three bookings, mixed ranks, a budget of four. One ranked set of cards, the rest held for the budget.", Sea,
        [
            ..Enumerable.Range(0, 30).Select(i => (Step)new Queue(0, $"e{i:00}", Subject: $"B{i % 3}", Rank: i % 6)),
            new Allow(0, 1, new Limits(Budget: 4)),
            new Run(1),
        ]),
        new("restart-mid-run", "The server restarts between passes: nothing already sent is sent again, and what was waiting is still delivered.", Sea,
        [
            new Queue(0, "a", DueIn: 0), new Queue(0, "b", DueIn: 30),
            new Run(1), new Restart(2), new Run(3), new Restart(31), new Run(32), new Run(33),
        ]),
        new("clock-jump-back", "The clock jumps back an hour: an item that was already sent is not sent again, and one not yet due waits for its time.", Sea,
        [
            new Queue(0, "done", DueIn: 0), new Queue(0, "later", DueIn: 90),
            new Run(60), new Run(10), new Run(95),
        ]),
        new("quiet-hours-edge", "An item due a minute before quiet hours ends is held; the same item due a minute after is sent.", Sea,
        [
            new Allow(0, 1, new Limits(Quiet: true)),
            new Queue(0, "before-edge", DueIn: 59), new Queue(0, "after-edge", DueIn: 61),
            new Run(59),
            new Allow(60, 1, new Limits()),
            new Run(61),
        ]),
        new("daylight-saving-day", "The scheduler works in UTC, so the day the home clocks change makes no difference to when things come due.", new DateTime(2027, 3, 14, 9, 30, 0, DateTimeKind.Utc),
        [
            new Queue(0, "before-change", DueIn: 20), new Queue(0, "after-change", DueIn: 50),
            new Run(21), new Run(51),
        ]),
        new("runaway-class", "A class sends more than its limit: it pauses itself, its items wait until the pause ends, and then they are sent.", Sea,
        [
            ..Enumerable.Range(0, 5).Select(i => (Step)new Queue(0, $"r{i}", Class: "rule")),
            new Run(1), new Run(30), new Run(70),
        ], BreakerLimit: 2),
        new("operator-kill-switch", "An operator switches a class off: its items are dropped and nothing is sent, while other classes carry on.", Sea,
        [
            new Queue(0, "rule-item", Class: "rule"), new Queue(0, "plan-item", Class: "plan"),
            new Run(1),
        ], OffClasses: ["rule"]),
        new("guest-leaves", "A guest's account is removed after items are queued: the items are dropped and nothing is sent.", Sea,
        [
            new Queue(0, "x", User: 9), new Allow(1, 9, new Limits(Gone: true)), new Run(2),
        ]),
    ];

    public static Script Named(string name) => All.Single(s => s.Name == name);
    public static bool Exists(string name) => All.Any(s => s.Name == name);
}
