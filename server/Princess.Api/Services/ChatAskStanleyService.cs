using System.Text.Json.Nodes;
using System.Threading.Channels;
using Microsoft.Extensions.Options;
using Princess.Api.Audit;
using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>One question to Stanley waiting to be answered: who asked, where, and which message holds the question. Plain ids, so it can wait in a queue after the sender's request has finished.</summary>
public sealed record ChatAskJob(long ActorId, long GroupId, Guid GroupPublicId, Guid MessageId, string Kind);

/// <summary>The waiting line between a send and Stanley's answer, so an answer never delays the question's own send. <see cref="TryEnqueue"/> is false only when the line is full; the question then simply stays unanswered.</summary>
public sealed class ChatAskQueue
{
    public const int Capacity = 1_000;
    private readonly Channel<ChatAskJob> channel = Channel.CreateBounded<ChatAskJob>(new BoundedChannelOptions(Capacity) { FullMode = BoundedChannelFullMode.Wait, SingleWriter = false, SingleReader = false });

    public bool TryEnqueue(ChatAskJob job) => channel.Writer.TryWrite(job);

    public ChannelReader<ChatAskJob> Reader => channel.Reader;
}

/// <summary>Works through <see cref="ChatAskQueue"/>, each job in its own scope (the stores are per scope). A failed answer is logged and forgotten: the question stays an ordinary message.</summary>
public sealed class ChatAskWorker(ChatAskQueue queue, IServiceScopeFactory scopes, ILogger<ChatAskWorker> log) : BackgroundService
{
    private const int Readers = 2;

    protected override Task ExecuteAsync(CancellationToken stoppingToken) => Task.WhenAll(Enumerable.Range(0, Readers).Select(_ => ReadAsync(stoppingToken)));

    private async Task ReadAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var job in queue.Reader.ReadAllAsync(stoppingToken))
            {
                try
                {
                    await using var scope = scopes.CreateAsyncScope();
                    await scope.ServiceProvider.GetRequiredService<ChatAskStanleyService>().AnswerAsync(job, stoppingToken);
                }
                catch (Exception e) when (e is not OperationCanceledException)
                {
                    log.LogWarning(e, "Stanley could not answer a question in a chat");
                }
            }
        }
        catch (OperationCanceledException) { /* the server is stopping */ }
    }
}

/// <summary>
/// Asking Stanley in a conversation (docs/chat-stanley-plan.md, 3.5). The question was stored and sent as an ordinary message; this answers it. His answer is a message with no sender that everyone in the conversation sees, so:
/// it is built from the question and the last five messages the asker may read, with no tool over anyone's booking (a question about one gets "ask me privately"); an emergency, medical, legal or person question is answered to
/// the asker alone, in their own Stanley chat, and the group sees only "Stanley sent Sam some help"; it goes through the word filter, the topic check and the model budget like his other answers; and a cooldown (3 answers in 10 minutes)
/// stops a flood. Off in his own chat, a channel or room, a conversation with a supervised child in it, and where the creator turned him off. Any failure leaves the question as an ordinary message, with at most one short line saying so.
/// </summary>
public sealed class ChatAskStanleyService(IChatStore store, IChatStanleyStore uses, IUserStore users, IUserClock clock, IConciergeModel model, IConciergeLimiter limiter, IOptions<StanleyOptions> options,
    ChatFanout fanout, ChatNotifier notifier, ChatTypingTracker typing, StanleyThreadService stanleyThread, IAuditLog audit)
{
    private static string ShortName(ChatPeerRow p) => ChatConnectionRules.ShortName(p.FirstName, p.LastName);

    private static string TextOf(JsonObject body) =>
        string.Concat((body["content"] as JsonArray ?? []).OfType<JsonObject>().Where(b => b["type"]?.GetValue<string>() == "text").Select(b => b["text"]?.GetValue<string>())).Trim();

    private static JsonArray One(string text) => [new JsonObject { ["role"] = "user", ["content"] = text }];

    /// <summary>A short status line in the conversation (never unread, never announced).</summary>
    private Task LineAsync(long groupId, string text, DateTime at, CancellationToken ct) => store.AddGroupStanleyMessageAsync(groupId, text, true, at, ct);

    /// <summary>"Stanley is thinking": he shows as typing to the other members until his answer arrives (or the line expires).</summary>
    private async Task ThinkingAsync(ChatAskJob job, CancellationToken ct)
    {
        if (!typing.Touch(job.GroupId, 0, DateTime.UtcNow)) return;
        var recipients = (await store.ListRecipientsAsync(job.GroupId, 0, ct)).Where(r => r.Typing && !r.StanleyMuted);
        await Task.WhenAll(recipients.Select(r => notifier.ThreadChangedAsync(r.UserId, job.GroupPublicId, "typing", ct)));
    }

    public async Task AnswerAsync(ChatAskJob job, CancellationToken ct)
    {
        var o = options.Value;
        if (!o.Switches.ChatAsk) return;
        var actor = await users.FindByIdAsync(job.ActorId, ct);
        if (actor is null || actor.IsSupervised) return;
        var member = await store.GetMemberAsync(actor.Id, job.GroupPublicId, ct);
        if (member is null || member.Status != ChatConversationRules.Active || ChatConversationRules.IsClosed(member.Kind, member.Status, member.DirectEnded)) return;
        var people = await store.ListMembersAsync(member.GroupId, ct);
        var off = await uses.IsOffAsync(member.GroupId, ct);
        var now = await clock.NowAsync(actor, ct);
        var reason = ChatStanleyRules.Unavailable(member.Kind, people.Any(p => p.Status == ChatConversationRules.Active && p.IsSupervised), off);
        if (reason == ChatStanleyRules.SwitchedOff) { await LineAsync(member.GroupId, ChatAskStanleyRules.TurnedOff, now, ct); return; }
        if (reason is not null) return;   // his own chat, a channel or room, a child in the conversation: he says nothing at all

        var readable = await store.ListMessagesAsync(member.GroupId, actor.Id, null, 60, ct);
        var asked = readable.FirstOrDefault(r => r.PublicId == job.MessageId);
        if (asked is null || asked.DeletedAt is not null || asked.FromUserId != actor.Id || asked.Kind != "text") return;
        var question = ChatAskStanleyRules.QuestionOf(asked.Text);
        if (question is null) { await LineAsync(member.GroupId, ChatAskStanleyRules.NoQuestion, now, ct); return; }
        var name = people.FirstOrDefault(p => p.UserId == actor.Id) is { } me ? ShortName(me) : "a guest";

        // A safety question is never answered into the group: the asker alone gets the wording, in their own chat with Stanley.
        if (ConciergeRules.Screen(question) is { } handoff)
        {
            await stanleyThread.EnsureAsync(actor, ct);
            var notice = new StanleyNotice($"chatask:{job.MessageId:N}", StanleyNoticeRules.Info, "chatHelp", "/chat", ChatAskStanleyRules.HandoffText(handoff), null, null, "normal");
            await store.AddStanleyNoticeAsync(actor.Id, notice, StanleyPersonaRules.Company, StanleyPersonaRules.CompanyName, now, ct);
            await LineAsync(member.GroupId, ChatAskStanleyRules.SafetyLine(name), now, ct);
            await RecordAsync(job, "handoff", ct);
            return;
        }
        if (ChatAskStanleyRules.OverCooldown(await uses.CountAnswersAsync(member.GroupId, now - ChatAskStanleyRules.CooldownWindow, ct))) { await LineAsync(member.GroupId, ChatAskStanleyRules.Busy, now, ct); return; }

        await ThinkingAsync(job, ct);
        string? text;
        var route = "scripted";
        if (ChatAskStanleyRules.NeedsBooking(question)) { text = ChatAskStanleyRules.BookingOnly; route = "private"; }
        else if (model.Available && o.Switches.Model)
        {
            route = "claude";
            try { text = await ModelAnswerAsync(actor, member, readable, asked, name, question, now, ct); }
            catch (ConciergeModelException) { text = null; }
        }
        else text = StanleyRules.LooksOnTopic(question) ? StanleyRules.ScriptedAnswerFor(question) : ChatAskStanleyRules.OffTopic;

        typing.Clear(member.GroupId, 0);
        var clean = ChatAskStanleyRules.Clean(text);
        if (clean is null) { await LineAsync(member.GroupId, ChatAskStanleyRules.CannotAnswer, now, ct); await RecordAsync(job, "failed", ct); return; }
        var row = await store.AddGroupStanleyMessageAsync(member.GroupId, clean, false, now, ct);
        await fanout.RunAsync(new ChatFanoutJob(0, member.GroupId, member.GroupPublicId, row, member.Kind), ct);
        await RecordAsync(job, route, ct);
    }

    /// <summary>The topic check on the small tier, then the answer. Null when the question is off topic (the answer is then the polite redirect). A budget that is spent, or a model that fails, throws <see cref="ConciergeModelException"/>.</summary>
    private async Task<string?> ModelAnswerAsync(UserRecord actor, ChatMemberRow member, List<ChatMessageRow> readable, ChatMessageRow asked, string name, string question, DateTime now, CancellationToken ct)
    {
        var o = options.Value;
        var meter = new ModelMeter(model, c => limiter.TryTakeAsync(actor.Id, DateTime.UtcNow, o.DailyCeiling, TimeSpan.FromDays(1), c), o.ChatCalls);
        var turns = StanleyRules.Usable([new ConciergeMessageDto("user", question, 0)]);
        if (turns is null) return ChatAskStanleyRules.OffTopic;
        var topic = await meter.CallAsync(StanleyRules.TopicSystem, StanleyService.NoTools, One(StanleyRules.TopicMessages(turns)[0].Text), ModelTier.Small, ct);
        if (!StanleyRules.ReadTopic(TextOf(topic))) return ChatAskStanleyRules.OffTopic;
        var people = await store.ListMembersAsync(member.GroupId, ct);
        var byId = people.ToDictionary(p => p.UserId);
        var context = ChatAskStanleyRules.Context(readable, asked.Id, member.Kind, member.JoinedAt, member.LeftAt, now)
            .Select(r => (r.FromUserId == actor.Id ? name : byId.TryGetValue(r.FromUserId, out var p) ? ShortName(p) : "Someone", r.Text)).ToList();
        var answer = await meter.CallAsync(StanleyRules.AnswerSystemFor(null) + ChatAskStanleyRules.GroupSystem, StanleyService.NoTools, One(ChatAskStanleyRules.UserTurn(context, name, question)), ModelTier.Default, ct);
        var text = TextOf(answer);
        return text.Length == 0 ? throw new ConciergeModelException("bad", "An empty answer.") : text;
    }

    /// <summary>Audited as counts only: where, and which route answered. Never the question or the answer.</summary>
    private Task RecordAsync(ChatAskJob job, string route, CancellationToken ct) =>
        audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "chat.askStanley", Outcome = AuditOutcome.Success, Target = "conversation:" + job.GroupPublicId, Detail = route }, ct);
}
