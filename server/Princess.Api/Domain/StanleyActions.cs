using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>The things Stanley may do for a guest, once they have seen a preview and confirmed it (docs/stanley-gap-analysis-and-plan.md, phase 5). Nothing else, ever.</summary>
public static class StanleyActionKinds
{
    public const string OrderItem = "order_item", AddExcursion = "add_excursion", MoveDinner = "move_dinner", ReserveDinner = "reserve_dinner", DraftCase = "draft_case", PlanChange = "plan_change", RemindMe = "remind_me", CreatePoll = "create_poll", ChangeSeating = "change_seating";
    public static readonly string[] All = [OrderItem, AddExcursion, MoveDinner, ReserveDinner, DraftCase, PlanChange, RemindMe, CreatePoll, ChangeSeating];
    /// <summary>These change only what the device keeps (the day plan, a reminder), so the server prepares, checks and confirms them and the device applies them from the receipt.</summary>
    public static readonly HashSet<string> OnDevice = [PlanChange, RemindMe];
    /// <summary>The kinds the server carries out through the plan, orders, excursion, dining and case services.</summary>
    public static bool OnServer(string kind) => All.Contains(kind) && !OnDevice.Contains(kind);
    /// <summary>A reminder is kept on the device (it shows when the app is open) and also on the server (it reaches the phone as a push alert with the app closed), so it has both.</summary>
    public static readonly HashSet<string> AlsoOnServer = [RemindMe];
    /// <summary>The server has an effect to carry out, undo and settle: every server kind, and a reminder's push.</summary>
    public static bool HasServerEffect(string kind) => OnServer(kind) || AlsoOnServer.Contains(kind);
}

/// <summary>A request turned into a kind and its parameters. Parameters are plain strings from a closed set per kind, so a stored preview is small and can be checked again.</summary>
public sealed record StanleyIntent(string Kind, Dictionary<string, string> Args)
{
    public string Arg(string name) => Args.TryGetValue(name, out var v) ? v : "";
}

/// <summary>
/// A preview and, once confirmed, its receipt: one shape for both. Nothing is done while <c>Status</c> is <c>prepared</c>. <c>Params</c> are the typed intent's plain-string parameters
/// (the device applies a device action from them). <c>OnDevice</c> says the device, not the server, makes the change. <c>Cents</c> is the price, credit or refund to the guest's account (null when there is none).
/// </summary>
public sealed record StanleyActionDto(string Id, string Kind, string Status, string Title, List<string> Lines, List<string> Who, long? Cents, string? Terms, DateTime ExpiresAt, bool OnDevice,
    DateTime? DoneAt, DateTime? UndoUntil, string? Reason, Dictionary<string, string> Params, string? Receipt, string? PreparedBy = null);

/// <summary>One line of the day plan the device shows, sent so the server can name it in a preview: no guest data, only the activity.</summary>
public sealed record StanleyPlanEntry(string Id, string Title, string Start, int Day, bool Listed);

/// <summary>The all-aboard moment a reminder request is based on, as the device knows it (<c>Label</c> says whose clock: ship, local or device time).</summary>
public sealed record StanleyAllAboard(string At, string Label);

/// <summary>What the device adds to a request so the server can resolve a plan change or a reminder: the day plan as listed and the all-aboard time.</summary>
public sealed record StanleyActionContext(List<StanleyPlanEntry>? Plan = null, StanleyAllAboard? AllAboard = null, string? SailingId = null)
{
    public const int MaxPlan = 60;

    /// <summary>What the device sent, trimmed to sizes and shapes the rules accept: at most 60 entries, short ids and titles, times as HH:MM. Anything else is dropped, never repaired.</summary>
    public StanleyActionContext Clean(string? sailingId)
    {
        static string Cut(string? s, int max) { var t = (s ?? "").Trim(); return t.Length > max ? t[..max] : t; }
        static bool Time(string? s) => s is not null && System.Text.RegularExpressions.Regex.IsMatch(s, @"^([01]\d|2[0-3]):[0-5]\d$");
        var plan = (Plan ?? []).Where(p => p is not null && (p.Id ?? "").Length is > 0 and <= 60 && (p.Title ?? "").Length > 0 && Time(p.Start) && p.Day is >= 1 and <= 30)
            .Take(MaxPlan).Select(p => new StanleyPlanEntry(Cut(p.Id, 60), Cut(p.Title, 80), p.Start, p.Day, p.Listed)).ToList();
        var aboard = AllAboard is { } a && Time(a.At) ? new StanleyAllAboard(a.At, Cut(a.Label, 30)) : null;
        return new StanleyActionContext(plan, aboard, sailingId);
    }
}

/// <summary>An intent, or the question that has to be answered before there is one. Never both.</summary>
public sealed record IntentResult(StanleyIntent? Intent, string? Clarify)
{
    public static IntentResult Of(StanleyIntent intent) => new(intent, null);
    public static IntentResult Ask(string question) => new(null, question);
}

/// <summary>
/// Reading a request into a typed intent, from the model's tool call (<see cref="Validate"/>) or from the words (<see cref="Parse"/>, used when no model can be called), plus the things Stanley never does.
/// An unknown or incomplete request is a clarifying question, never a guess. Pure, so it is tested in a node-free environment.
/// </summary>
public static partial class StanleyIntents
{
    public const int MaxText = 300;
    /// <summary>The longest message read as a request to change something.</summary>
    public const int MaxRequest = 200;
    /// <summary>Stanley drafts only the cases that need no bill line or amount; a billing query or a claim is opened on its own screen.</summary>
    public static readonly string[] CaseKinds = ["lostItem", "complaint"];

    // ---- what Stanley never does ----------------------------------------------------------------------------------------------------

    /// <summary>A command, not a question: an optional "please" or "I want to", then the verb. "Can I pay with a card?" is a question and goes on to the answer routes.</summary>
    private const string Lead = @"^\s*(please\s+|can you\s+|could you\s+|would you\s+|will you\s+|i (want|need|would like) to\s+|i'd like to\s+|go ahead and\s+)?";

    [GeneratedRegex(Lead + @"(pay|settle|charge|buy)\b", RegexOptions.IgnoreCase)]
    private static partial Regex PayWords();
    [GeneratedRegex(Lead + @"(cancel|abandon|call off)\b.{0,20}\b(booking|cruise|holiday|trip|voyage|sailing)\b", RegexOptions.IgnoreCase)]
    private static partial Regex CancelBookingWords();
    [GeneratedRegex(Lead + @"(change|swap|switch|upgrade|downgrade|move)\b.{0,20}\b(cabin|stateroom|room category|cabin category|my room)\b", RegexOptions.IgnoreCase)]
    private static partial Regex CabinWords();
    [GeneratedRegex(Lead + @"(share|send|give|email|text|post)\b.{0,40}\b(passport|documents?|details|data|card number|address|phone number|booking number|info)\b", RegexOptions.IgnoreCase)]
    private static partial Regex ShareWords();

    /// <summary>The reason Stanley will not do what was asked, when it is on the never list: pay, cancel a booking, change a cabin, share data. Null for everything else.</summary>
    public static string? Refusal(string message)
    {
        if (PayWords().IsMatch(message)) return "pay";
        if (CancelBookingWords().IsMatch(message)) return "cancelBooking";
        if (CabinWords().IsMatch(message)) return "cabin";
        if (ShareWords().IsMatch(message)) return "share";
        return null;
    }

    /// <summary>The words for a refusal, with where the guest can do it themselves.</summary>
    public static (string Text, string Label, string Path) RefusalText(string reason) => reason switch
    {
        "pay" => ("I can't take a payment or pay a bill for you. You can do it yourself on the Bill screen, or ask a person at Guest Services.", "Bill", "/me/bill"),
        "cancelBooking" => ("I can't cancel a booking. Open the booking to see what cancelling would cost and do it there, or ask a person at Guest Services.", "My trips", "/me/trips"),
        "cabin" => ("I can't change a cabin. Ask a person at Guest Services, who can check what is available and what it would cost.", "My trips", "/me/trips"),
        _ => ("I can't share your documents or details with anyone. You can choose what to share, and with whom, on the Privacy screen.", "Privacy", "/me/privacy"),
    };

    // ---- the model's typed intent -----------------------------------------------------------------------------------------------------

    /// <summary>The <c>propose_action</c> tool the model is offered: one typed intent. It only asks for a preview; nothing is done until the guest confirms.</summary>
    public const string ToolName = "propose_action";

    public static readonly string ToolJson = """
        {"name":"propose_action","description":"Ask for a preview of one change the guest wants made to their trip. Nothing happens until the guest presses Confirm. Use it only for these kinds: order_item (a stateroom item such as towels, with item and qty), add_excursion (put a shore excursion in the cart, with excursionId), move_dinner (move the guest's dinner reservation, with day and time), reserve_dinner (book a main dining table, with day, time and who: all, me or a first name), draft_case (a service case for Guest Services: kind lostItem (with place) or complaint, with summary), plan_change (move, drop or add a day-plan item: op, itemId, and to for a move), remind_me (a reminder: at as HH:MM and text), create_poll (a group poll for the booking: question, options as two to six short choices, and days open 1, 3 or 7), change_seating (the booking's dining plan: plan early, late or anytime; only the person who booked). You can never pay, cancel a booking, change a cabin or share data. If a detail is missing, ask the guest instead of guessing.","input_schema":{"type":"object","properties":{"kind":{"type":"string","enum":["order_item","add_excursion","move_dinner","reserve_dinner","draft_case","plan_change","remind_me","create_poll","change_seating"]},"item":{"type":"string"},"qty":{"type":"integer"},"excursionId":{"type":"string"},"who":{"type":"string","description":"me, all, or a first name of someone on the booking"},"day":{"type":"integer"},"time":{"type":"string","description":"HH:MM, 24 hour"},"caseKind":{"type":"string","enum":["lostItem","complaint"]},"summary":{"type":"string"},"place":{"type":"string"},"op":{"type":"string","enum":["move","drop","add"]},"itemId":{"type":"string"},"to":{"type":"string","description":"HH:MM, 24 hour"},"at":{"type":"string","description":"HH:MM, 24 hour"},"text":{"type":"string"},"question":{"type":"string"},"options":{"type":"array","items":{"type":"string"}},"days":{"type":"integer"},"plan":{"type":"string","enum":["early","late","anytime"]}},"required":["kind"]}}
        """;

    /// <summary>The tool list with <see cref="ToolName"/> added, for a request that may prepare an action.</summary>
    public static string WithTool(string toolsJson)
    {
        var tools = JsonNode.Parse(toolsJson) as JsonArray ?? new JsonArray();
        tools.Add(JsonNode.Parse(ToolJson));
        return tools.ToJsonString();
    }

    /// <summary>The line added to the model's instructions when it may propose an action.</summary>
    public const string Instructions =
        "You can prepare a change for the guest with the propose_action tool. It only shows the guest a preview with a Confirm button: never say a change is done, only that it is ready for them to check and confirm. " +
        "Use it only when the guest clearly asks for one of its kinds, and ask a short question instead when a detail is missing. You can never pay, cancel a booking, change a cabin or share data; say so plainly.";

    private static string Clean(string? s, int max = MaxText)
    {
        var t = Regex.Replace((s ?? "").Replace('\n', ' ').Replace('\r', ' '), @"\s+", " ").Trim();
        return t.Length > max ? t[..max] : t;
    }

    private static string Hm(string? s) => s is not null && Regex.IsMatch(s.Trim(), @"^([01]\d|2[0-3]):[0-5]\d$") ? s.Trim() : "";

    /// <summary>
    /// Checks the model's tool input against the schema and the closed lists. A kind that is not on the list, an item or tour that does not exist, a time that is not a time, or a missing detail is a clarifying
    /// question; an unknown kind is refused outright. Nothing the model writes reaches a service except through these checks.
    /// </summary>
    public static IntentResult Validate(JsonObject input, StanleyActionContext ctx)
    {
        var kind = input["kind"]?.GetValue<string>() ?? "";
        if (!StanleyActionKinds.All.Contains(kind)) return IntentResult.Ask("I can't do that from here. I can order a stateroom item, add an excursion to your cart, book or move a dinner, change your dining seating, draft a service case, change your day plan, set a reminder or start a group poll.");
        string S(string name) => input[name] is JsonValue v && v.TryGetValue<string>(out var s) ? s : "";
        int N(string name) => input[name] is JsonValue v ? (v.TryGetValue<int>(out var n) ? n : v.TryGetValue<string>(out var t) && int.TryParse(t, out var m) ? m : 0) : 0;
        var who = Clean(S("who"), 40);
        switch (kind)
        {
            case StanleyActionKinds.OrderItem:
            {
                var item = ServiceRules.RequestItemById(S("item"));
                if (item is null) return IntentResult.Ask("Which item would you like? I can send " + string.Join(", ", ServiceRules.RequestItems.Select(i => i.Id)) + ".");
                var qty = Math.Min(Math.Max(1, N("qty")), item.MaxQty);
                return IntentResult.Of(new StanleyIntent(kind, new() { ["item"] = item.Id, ["qty"] = qty.ToString() }));
            }
            case StanleyActionKinds.AddExcursion:
            {
                var x = ExcursionRules.ById(S("excursionId"));
                if (x is null) return IntentResult.Ask("Which excursion do you mean? Open Excursions to see them, or give me its name.");
                return IntentResult.Of(new StanleyIntent(kind, new() { ["excursionId"] = x.Id, ["who"] = who.Length == 0 ? "me" : who }));
            }
            case StanleyActionKinds.MoveDinner:
            {
                var time = Hm(S("time"));
                if (!DiningRules.DinnerTimes.Contains(time)) return IntentResult.Ask("What time would you like? Dinner is at " + string.Join(", ", DiningRules.DinnerTimes) + ".");
                var args = new Dictionary<string, string> { ["time"] = time };
                if (N("day") > 0) args["day"] = N("day").ToString();
                return IntentResult.Of(new StanleyIntent(kind, args));
            }
            case StanleyActionKinds.ReserveDinner:
            {
                var time = Hm(S("time"));
                if (!DiningRules.DinnerTimes.Contains(time)) return IntentResult.Ask("What time would you like? Dinner is at " + string.Join(", ", DiningRules.DinnerTimes) + ".");
                if (N("day") < 1) return IntentResult.Ask("Which night? For example: book dinner on night 3 at 7pm.");
                return IntentResult.Of(new StanleyIntent(kind, new() { ["time"] = time, ["day"] = N("day").ToString(), ["who"] = who.Length == 0 ? "all" : who }));
            }
            case StanleyActionKinds.DraftCase:
            {
                var ck = S("caseKind");
                var summary = Clean(S("summary"), 400);
                if (!CaseKinds.Contains(ck)) return IntentResult.Ask("What is it about: a lost item or a complaint? A bill query or a claim is opened from the Account screen.");
                if (summary.Length < 10) return IntentResult.Ask("Tell me a little more, in a sentence or two, so Guest Services can act on it.");
                var place = Clean(S("place"), 80);
                if (ck == "lostItem" && place.Length == 0) return IntentResult.Ask("Where did you last have it?");
                return IntentResult.Of(new StanleyIntent(kind, new() { ["caseKind"] = ck, ["summary"] = summary, ["place"] = place }));
            }
            case StanleyActionKinds.PlanChange:
            {
                var op = S("op");
                if (op is not ("move" or "drop" or "add")) return IntentResult.Ask("Do you want to move it, drop it or add it?");
                var entry = (ctx.Plan ?? []).FirstOrDefault(p => p.Id == S("itemId") && p.Listed == (op != "add"));
                if (entry is null) return IntentResult.Ask(op == "add" ? "I can't find that in what is on offer today. Which activity do you mean?" : "I can't find that in your plan. Which item do you mean?");
                var to = Hm(S("to"));
                if (op == "move" && to.Length == 0) return IntentResult.Ask("What time should it move to?");
                var args = new Dictionary<string, string> { ["op"] = op, ["itemId"] = entry.Id, ["day"] = entry.Day.ToString() };
                if (op == "move") args["to"] = to;
                return IntentResult.Of(new StanleyIntent(kind, args));
            }
            case StanleyActionKinds.CreatePoll:
            {
                var options = input["options"] is JsonArray arr ? arr.Select(x => x is JsonValue v && v.TryGetValue<string>(out var s) ? s : "").ToList() : [.. S("options").Split('|', StringSplitOptions.RemoveEmptyEntries)];
                var req = new StanleyPollRequest(Clean(S("question"), StanleyPollRules.QuestionMax + 40), options, N("days") == 0 ? 3 : N("days"));
                return PollIntent(req);
            }
            case StanleyActionKinds.ChangeSeating:
            {
                var plan = DiningPlanRules.FromWords(S("plan"));
                if (plan is null) return IntentResult.Ask("Which seating would you like: early, late or anytime dining?");
                return IntentResult.Of(new StanleyIntent(kind, new() { ["plan"] = plan }));
            }
            default:
            {
                var at = Hm(S("at"));
                var text = Clean(S("text"), 80);
                if (at.Length == 0) return IntentResult.Ask("What time should I remind you?");
                if (text.Length == 0) text = "Reminder";
                return IntentResult.Of(new StanleyIntent(kind, new() { ["at"] = at, ["text"] = text }));
            }
        }
    }

    /// <summary>A poll request as an intent, or the question that has to be answered first.</summary>
    private static IntentResult PollIntent(StanleyPollRequest req)
    {
        var (problem, question, options, days) = StanleyPollRules.Clean(req);
        return problem switch
        {
            null => IntentResult.Of(new StanleyIntent(StanleyActionKinds.CreatePoll, new() { ["question"] = question, ["options"] = string.Join("|", options.Select(o => o.Label)), ["days"] = days.ToString() })),
            "question" => IntentResult.Ask("What should the poll ask? For example: poll the group: snorkel or beach club?"),
            "days" => IntentResult.Ask("How long should it stay open: 1, 3 or 7 days?"),
            _ => IntentResult.Ask("What are the choices? Give me two to six short ones, for example: poll the group: snorkel or beach club?"),
        };
    }

    // ---- the words, when no model can be called ---------------------------------------------------------------------------------------

    private static readonly Dictionary<string, string[]> ItemWords = new()
    {
        ["towels"] = ["towel", "towels"], ["pillows"] = ["pillow", "pillows"], ["bedding"] = ["blanket", "blankets", "bedding", "sheets", "duvet"],
        ["toiletries"] = ["toiletries", "shampoo", "soap", "conditioner"], ["ice"] = ["ice"], ["turndown"] = ["turndown"],
        ["light"] = ["bulb", "lamp"], ["aircon"] = ["aircon", "air-con", "airconditioning"], ["plumbing"] = ["toilet", "sink", "shower", "plumbing", "leak"], ["tv"] = ["tv", "television", "remote"],
    };
    private static readonly Dictionary<string, int> Numbers = new() { ["a"] = 1, ["an"] = 1, ["one"] = 1, ["two"] = 2, ["three"] = 3, ["four"] = 4 };
    private static readonly HashSet<string> Filler = ["the", "a", "an", "to", "my", "in", "on", "of", "by", "day", "pass", "and", "for", "at", "me", "cart", "trip", "tour", "excursion"];
    private static readonly string[] Wants = ["need", "request", "bring", "send", "get", "want", "have", "more", "extra", "please", "fix", "broken"];

    private static List<string> Words(string q, string pattern = @"[^a-z0-9-]+") => [.. Regex.Split(q.ToLowerInvariant(), pattern).Where(w => w.Length > 0)];
    private static List<string> Tokens(string s) => [.. Regex.Split(s.ToLowerInvariant(), @"[^a-z0-9]+").Where(w => w.Length > 2 && !Filler.Contains(w))];

    /// <summary>"8", "8pm", "7:30" or "20:00" as HH:MM. A bare number from 1 to 9 is the evening, as dinner is. Null when it is not a time.</summary>
    public static string? ParseTime(string text)
    {
        var m = Regex.Match(text, @"\b(\d{1,2})(?::(\d\d))?\s*(am|pm)?\b", RegexOptions.IgnoreCase);
        if (!m.Success) return null;
        var h = int.Parse(m.Groups[1].Value);
        var min = m.Groups[2].Success ? int.Parse(m.Groups[2].Value) : 0;
        var ap = m.Groups[3].Success ? m.Groups[3].Value.ToLowerInvariant() : "";
        if (ap == "pm" && h < 12) h += 12;
        if (ap == "am" && h == 12) h = 0;
        if (ap.Length == 0 && h is >= 1 and <= 9) h += 12;
        return h > 23 || min > 59 ? null : $"{h:00}:{min:00}";
    }

    /// <summary>The first thing in the words that is a time after "to", "at" or "for"; the whole text when there is no such word.</summary>
    private static string? TimeIn(string q)
    {
        var m = Regex.Match(q, @"\b(to|at|for)\b(?<rest>.*)$", RegexOptions.IgnoreCase);
        return ParseTime(m.Success ? m.Groups["rest"].Value : q);
    }

    /// <summary>
    /// Reads a request such as "I need two more towels", "add the reef snorkel to my cart", "move dinner to 8pm", "skip bingo" or "remind me at 4:15 to be back" into an intent, or says what is missing.
    /// Null when the words are not a request to change anything, so the question goes on to the answer routes. The never list is checked by the caller first.
    /// </summary>
    public static IntentResult? Parse(string message, StanleyActionContext ctx)
    {
        var q = message.Trim();
        // A request is a short plain sentence. Text with markup in it, or a long pasted passage (a port description, a menu), is never read as a command.
        if (q.Length > MaxRequest || q.IndexOfAny(['<', '>', '[', ']', '{', '}']) >= 0) return null;
        var w = Words(q);
        if (w.Count == 0) return null;
        var lower = q.ToLowerInvariant();

        // A reminder.
        if (Regex.IsMatch(lower, @"\bremind me\b|\bset (a|an) (reminder|alarm)\b"))
        {
            var at = TimeIn(Regex.Replace(lower, @"\b(remind me|set (a|an) (reminder|alarm))\b", " "));
            if (at is null) return IntentResult.Ask("What time should I remind you?");
            var what = Regex.Match(lower, @"\b(?:to|that)\s+(?<t>(?!\d).+)$");
            var text = what.Success ? Clean(what.Groups["t"].Value, 80) : "Reminder";
            return IntentResult.Of(new StanleyIntent(StanleyActionKinds.RemindMe, new() { ["at"] = at, ["text"] = text.Length == 0 ? "Reminder" : text }));
        }

        // A group poll: "poll the group: snorkel or beach?".
        if (StanleyPollRules.FromWords(q) is { } poll) return PollIntent(poll);

        // The dining plan: "change my dining time to late seating", "switch to anytime dining". A fixed seating is a plan for the whole cruise, not a table for one night.
        if (Regex.IsMatch(lower, @"\b(change|switch|move|put|swap|want|like)\b") && Regex.IsMatch(lower, @"\b(early|late|anytime|any time|flexible)\s+(seating|sitting|dining)\b|\b(seating|sitting)\b.{0,15}\b(early|late)\b|\bto (early|late|anytime)\b.{0,12}\b(seating|sitting|dining)\b"))
        {
            var seating = Regex.Match(lower, @"\b(early|late|anytime|any time|flexible)\b").Value;
            return IntentResult.Of(new StanleyIntent(StanleyActionKinds.ChangeSeating, new() { ["plan"] = DiningPlanRules.FromWords(seating) ?? "anytime" }));
        }

        // Booking a table: "book dinner on night 3 at 7pm". Moving a table is read below.
        if (Regex.IsMatch(lower, @"\b(book|reserve|make)\b") && Regex.IsMatch(lower, @"\b(dinner|table|reservation)\b") && !Regex.IsMatch(lower, @"\b(move|change|shift|push|cancel)\b"))
        {
            var nightMatch = Regex.Match(lower, @"\b(?:night|day)\s+(?<n>\d{1,2})\b");
            var at = TimeIn(Regex.Replace(lower, @"\b(?:night|day)\s+\d{1,2}\b", " "));
            if (at is null || !DiningRules.DinnerTimes.Contains(at)) return IntentResult.Ask("What time would you like dinner? It is at " + string.Join(", ", DiningRules.DinnerTimes) + ".");
            if (!nightMatch.Success) return IntentResult.Ask("Which night? For example: book dinner on night 3 at 7pm.");
            return IntentResult.Of(new StanleyIntent(StanleyActionKinds.ReserveDinner, new() { ["time"] = at, ["day"] = nightMatch.Groups["n"].Value, ["who"] = "all" }));
        }

        // A stateroom item: needs a wanting word and one of the items.
        if (w.Any(x => Wants.Contains(x)))
        {
            var hit = ServiceRules.RequestItems.FirstOrDefault(r => ItemWords.TryGetValue(r.Id, out var words) && words.Any(k => w.Contains(k)));
            if (hit is not null)
            {
                var n = w.Select(x => Numbers.TryGetValue(x, out var v) ? v : (x.Length == 1 && char.IsDigit(x[0]) ? x[0] - '0' : 0)).FirstOrDefault(x => x > 0);
                var qty = Math.Min(Math.Max(1, n == 0 ? 1 : n), hit.MaxQty);
                return IntentResult.Of(new StanleyIntent(StanleyActionKinds.OrderItem, new() { ["item"] = hit.Id, ["qty"] = qty.ToString() }));
            }
        }

        // An excursion for the cart.
        var plainWords = Words(q, @"[^a-z0-9]+");
        if (plainWords.Any(x => x is "add" or "book" or "put" or "reserve")
            && (plainWords.Contains("cart") || plainWords.Contains("excursion") || plainWords.Contains("tour") || ExcursionRules.Catalogue.Any(e => lower.Contains(e.Name.ToLowerInvariant()))))
        {
            var asked = new HashSet<string>(Tokens(q));
            var scored = ExcursionRules.Catalogue.Select(e => (e, hits: Tokens(e.Name).Count(asked.Contains), len: Tokens(e.Name).Count))
                .Where(x => x.hits >= 2 || (x.hits >= 1 && x.len == 1)).OrderByDescending(x => x.hits).ToList();
            if (scored.Count > 0 && (scored.Count == 1 || scored[0].hits != scored[1].hits))
                return IntentResult.Of(new StanleyIntent(StanleyActionKinds.AddExcursion, new() { ["excursionId"] = scored[0].e.Id, ["who"] = "me" }));
            if (scored.Count > 1 || plainWords.Contains("cart") || plainWords.Contains("excursion"))
                return IntentResult.Ask("Which excursion do you mean? Give me its full name, or open Excursions to see them.");
        }

        var moves = Regex.IsMatch(lower, @"\b(move|change|shift|push)\b");
        var drops = Regex.IsMatch(lower, @"\b(skip|drop|cancel|remove)\b");
        var adds = Regex.IsMatch(lower, @"\badd\b");
        if (!moves && !drops && !adds) return null;

        // A dinner reservation.
        if (moves && Regex.IsMatch(lower, @"\b(dinner|table|reservation|dining)\b"))
        {
            var to = TimeIn(lower);
            if (to is null || !DiningRules.DinnerTimes.Contains(to)) return IntentResult.Ask("What time would you like dinner? It is at " + string.Join(", ", DiningRules.DinnerTimes) + ".");
            return IntentResult.Of(new StanleyIntent(StanleyActionKinds.MoveDinner, new() { ["time"] = to }));
        }

        // A day-plan item, by the plan the device sent.
        var plan = ctx.Plan ?? [];
        if (plan.Count == 0) return null;
        var op = moves ? "move" : drops ? "drop" : "add";
        var pool = plan.Where(p => p.Listed == (op != "add")).ToList();
        var named = pool.Where(p => lower.Contains(p.Title.ToLowerInvariant())).ToList();
        if (named.Count != 1) return named.Count > 1 ? IntentResult.Ask("Which one do you mean?") : null;
        var entry = named[0];
        if (op == "move")
        {
            var to = TimeIn(lower);
            if (to is null) return IntentResult.Ask("What time should it move to?");
            return IntentResult.Of(new StanleyIntent(StanleyActionKinds.PlanChange, new() { ["op"] = op, ["itemId"] = entry.Id, ["day"] = entry.Day.ToString(), ["to"] = to }));
        }
        return IntentResult.Of(new StanleyIntent(StanleyActionKinds.PlanChange, new() { ["op"] = op, ["itemId"] = entry.Id, ["day"] = entry.Day.ToString() }));
    }
}

/// <summary>Rules for who may act for whom, and for how long a preview lives. Pure.</summary>
public static class StanleyActionRules
{
    /// <summary>A preview is good for ten minutes, then the guest has to ask again so the price and availability shown are current.</summary>
    public const int PreviewMinutes = 10;
    /// <summary>The same two hours the plan changes and requests already allow.</summary>
    public const int UndoMinutes = 120;
    /// <summary>A confirm that began and never finished is checked against what exists before it is tried again, once it is this old.</summary>
    public const int StaleSeconds = 90;

    /// <summary>A guest acts for themselves, or for another traveller only as the person who booked them. A helper never confirms: the helper path (<see cref="StanleyHelperRules"/>) only prepares a preview that belongs to the guest.</summary>
    public static bool MayActFor(long actorId, long bookerUserId, long travellerUserId) => actorId == travellerUserId || actorId == bookerUserId;

    /// <summary>What a stateroom item is called in a preview.</summary>
    public static string ItemLabel(string id) => id switch
    {
        "towels" => "Towels", "pillows" => "Pillows", "bedding" => "Blankets and bedding", "toiletries" => "Toiletries", "ice" => "Ice", "turndown" => "Turndown service",
        "light" => "Light bulb repair", "aircon" => "Air conditioning check", "plumbing" => "Plumbing repair", "tv" => "TV or remote repair", _ => id,
    };

    public static string Fingerprint(string facts)
    {
        var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(facts));
        return Convert.ToHexString(hash)[..16].ToLowerInvariant();
    }

    public static bool KeyOk(string? key) => key is { Length: >= 8 and <= 64 } && key.All(c => char.IsLetterOrDigit(c) || c is '-' or '_');
}


/// <summary>The words for why Stanley could not prepare an action. Closed set; anything else gets the general line.</summary>
public static class StanleyActionText
{
    public const string Ready = "I can do that. Check the details, then confirm. Nothing happens until you do.";

    public static string Problem(string code) => code switch
    {
        "off" => "Changes through me are switched off right now. You can make this one on its own screen.",
        "forbidden" => "A child account can't make changes. Please ask a parent or guardian.",
        "full" => "That time is full. Tell me another time and I will check again.",
        "unchanged" => "Your dinner is already at that time.",
        "clash" => "Someone in the group already has a table at that time.",
        "fixedSeating" => "Your main dinner is a fixed seating, so I can't book another main dining table.",
        "notOpen" => "Dining reservations are not open for this booking yet.",
        "age" => "A table needs an adult in the group.",
        "partySize" => "That is more people than one table takes.",
        "closed" => "That time has already passed.",
        "slot" => "That isn't a time I can book dinner for.",
        "whichDinner" => "You have more than one dinner booked. Tell me the night, for example: move my dinner on night 3 to 8pm.",
        "noDinner" => "I can't see a dinner reservation coming up.",
        "notInPlan" => "I can't find that in your plan.",
        "guests" => "I can only act for you, or for people you booked.",
        "duplicate" => "That is already done or already asked for.",
        "whichTrip" => "Open the trip you mean on the My trips screen, then ask me again.",
        _ => "I can't do that right now. You can try it on its own screen.",
    };
}
