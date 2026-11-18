using Princess.Api.Services;

namespace Princess.Api.Domain;

/// <summary>One thing Stanley can do, as the app lists it (docs/stanley-actions-and-proactive-plan.md, phase P0). <c>Group</c> is answer, do, watch or value; <c>Rung</c> is 0 (tells), 1 (notices) or 2 (prepares, the guest confirms);
/// <c>State</c> is available or needsBooking (it works on a booking the guest has not linked yet).</summary>
public sealed record StanleyCapabilityDto(string Id, string Group, string Title, string Summary, string Example, List<string> Stages, int Rung, string AppliesWhen, string State);

/// <summary>The headings of the catalogue, in the order shown.</summary>
public sealed record StanleyCapabilityGroupDto(string Id, string Title, string Intro);

/// <summary>The catalogue for one guest: <c>GET /me/stanley/capabilities</c>.</summary>
public sealed record StanleyCapabilitiesDto(List<StanleyCapabilityGroupDto> Groups, List<StanleyCapabilityDto> Items);

/// <summary>An ability before it is shaped for a guest. <c>Switch</c> names the operator switch that hides it (null: always listed); <c>Stages</c> empty means every stage.</summary>
public sealed record StanleyCapability(string Id, string Group, string Title, string Summary, string Example, int Rung, bool NeedsBooking, string? Switch, string[] Stages);

/// <summary>
/// What Stanley can do today, in one place, so a new ability appears in the app without a front-end change. Only abilities that exist are listed (rung 0 to 2); standing rules and acts without a tap are not offered
/// until they are built. Pure, so it is unit tested. Every <c>Example</c> is a sentence Stanley really handles: a test sends each through the word filter and the safety screen.
/// </summary>
public static class StanleyCapabilityCatalogue
{
    public const string Answer = "answer", Do = "do", Watch = "watch", Value = "value";

    public static readonly IReadOnlyList<StanleyCapabilityGroupDto> Groups =
    [
        new(Answer, "I answer", "Ask me about your ship, the ports, your plans and your bill, in plain words."),
        new(Do, "I do things for you, with your OK", "I always show you first, and nothing happens until you say yes. You can undo most things."),
        new(Watch, "I give you heads-ups", "I tell you when something changes and what it means, and remind you before a deadline."),
        new(Value, "I help you get more from your trip", "I find what you have already paid for and help you plan what you will enjoy."),
    ];

    private static readonly string[] Before = ["dream", "discover", "book"];
    private static readonly string[] Plan = ["manage", "prebook", "getToShip"];
    private static readonly string[] Aboard = ["embark", "sea", "port", "disembark"];

    public static readonly IReadOnlyList<StanleyCapability> All =
    [
        new("ask-ship", Answer, "Your ship and the ports", "Facts about the ship, the route, each port and the shore.", "What time must I be back in Cozumel?", 0, false, "Resolver", []),
        new("ask-trip", Answer, "Your own trip", "Your booking, your plan, your checklist and what is next, as a card that says where it came from.", "What is next on my checklist?", 0, true, "Resolver", []),
        new("ask-bill", Answer, "Your bill", "What a charge is, what you have spent and what is left of an allowance.", "What have I spent so far?", 0, true, "Money", []),
        new("ask-before", Answer, "Choosing a cruise", "Sailings, cabins and costs for someone still deciding.", "Which sailing suits a relaxed week?", 0, false, "Resolver", Before),
        new("do-plan", Do, "Plan your day", "I build a day or a week from your pace and interests, with walk times, and add it after your yes.", "Plan my evening", 2, true, "Actions", Plan.Concat(Aboard).ToArray()),
        new("do-dinner", Do, "Book or move a dinner", "I prepare the booking and show you the table and time first.", "Book a table for two tomorrow evening", 2, true, "Actions", Plan.Concat(Aboard).ToArray()),
        new("do-excursion", Do, "Add an excursion", "I put a tour in your cart after you have seen the price and the time.", "Add a snorkelling tour to my plan", 2, true, "Actions", Plan.Concat(Aboard).ToArray()),
        new("do-remind", Do, "Set a reminder", "A reminder at the time you say, for anything in your plan.", "Remind me to be back on the ship an hour early", 2, true, "Actions", []),
        new("do-poll", Do, "Ask your group to choose", "I start a poll for your party and show you the answers.", "Ask everyone where we should eat on sea day", 2, true, "Actions", []),
        new("do-case", Do, "Pass it to a person", "For a lost item or a complaint I write the case for you to check, and show who has it and when to expect news.", "I lost my sunglasses on the ship", 2, true, "Handoff", Aboard),
        new("watch-changes", Watch, "What changed and what it means", "When a time moves or a port changes, I say what it means for your day.", "What did I miss?", 1, true, "Changes", []),
        new("watch-checklist", Watch, "What to do next", "The next step for your stage, with a reminder in time.", "What should I do next?", 1, true, "Resolver", Plan),
        new("watch-seas", Watch, "Rough seas tip", "A quiet tip when the sea is going to be rough.", "Will the sea be rough tomorrow?", 1, true, "Changes", Aboard),
        new("value-included", Value, "What you already have", "What your package includes and what you have not used yet.", "What is included for me?", 0, true, "Money", []),
        new("value-compare", Value, "Compare your options", "Tours, sailings or cabins side by side, with the trade-offs.", "Compare my two excursions", 0, false, "Resolver", []),
        new("value-memory", Value, "Remember what you like", "Your pace and interests, which you can see and forget at any time.", "I prefer a relaxed pace", 0, false, null, []),
    ];

    /// <summary>The catalogue for one guest. An ability whose operator switch is off is left out; one that needs a booking is shown with state needsBooking until one is linked; a supervised account is shown only the abilities that tell or notice (a child account cannot prepare or confirm).</summary>
    public static StanleyCapabilitiesDto For(StanleySwitches switches, bool hasBooking, bool supervised)
    {
        var items = new List<StanleyCapabilityDto>();
        foreach (var c in All)
        {
            if (c.Switch is not null && !IsOn(switches, c.Switch)) continue;
            if (supervised && c.Rung >= 2) continue;
            var state = c.NeedsBooking && !hasBooking ? "needsBooking" : "available";
            items.Add(new StanleyCapabilityDto(c.Id, c.Group, c.Title, c.Summary, c.Example, [.. c.Stages], c.Rung, c.NeedsBooking ? "booking" : "always", state));
        }
        return new StanleyCapabilitiesDto([.. Groups], items);
    }

    private static bool IsOn(StanleySwitches s, string name) => name switch
    {
        "Resolver" => s.Resolver,
        "Money" => s.Resolver && s.Money,
        "Actions" => s.Actions,
        "Handoff" => s.Handoff,
        "Changes" => s.Changes,
        _ => true,
    };
}
