using System.Threading.Channels;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>What to tell people about one stored message. Plain ids and the stored row, so it can wait in a queue after the sender's request has finished.</summary>
/// <param name="Kind">The conversation's kind: a channel or room is never bridged to text, whatever its size.</param>
public sealed record ChatFanoutJob(long ActorId, long GroupId, Guid GroupPublicId, ChatMessageRow Message, string Kind = "");

/// <summary>
/// The waiting line between a send and the notices it causes. A send stores the message, answers the sender and joins the line, so how long it takes does not depend on how many people are in
/// the conversation, on the SMS bridge or on the push provider. <see cref="TryEnqueue"/> is false only when the line is full; the caller then does the work itself.
/// </summary>
public sealed class ChatFanoutQueue
{
    public const int Capacity = 10_000;
    private readonly Channel<ChatFanoutJob> channel = Channel.CreateBounded<ChatFanoutJob>(new BoundedChannelOptions(Capacity) { FullMode = BoundedChannelFullMode.Wait, SingleWriter = false, SingleReader = false });

    public bool TryEnqueue(ChatFanoutJob job) => channel.Writer.TryWrite(job);

    public ChannelReader<ChatFanoutJob> Reader => channel.Reader;
}

/// <summary>
/// Tells every other active member who has not blocked the sender (<see cref="IChatStore.ListRecipientsAsync"/>), then the people ashore who chose the text bridge. A failed notice never fails a send:
/// the message is stored and shows in every member's app, only the alert is lost.
/// </summary>
public sealed class ChatFanout(IChatStore store, ChatNotifier notifier, ChatSmsService sms, ILogger<ChatFanout> log)
{
    public async Task RunAsync(ChatFanoutJob job, CancellationToken ct)
    {
        try
        {
            var members = await store.ListMembersAsync(job.GroupId, ct);
            var from = members.FirstOrDefault(p => p.UserId == job.ActorId) is { } me ? ChatConnectionRules.ShortName(me.FirstName, me.LastName) : "Guest";
            var recipients = await store.ListRecipientsAsync(job.GroupId, job.ActorId, ct);
            // Each recipient is independent (a lookup and a nudge), so a large group is told together rather than one after another.
            // A mention breaks through a mute and through mentions-only (never through do-not-disturb, which the notifier applies); a member on mentions-only hears nothing else.
            await Task.WhenAll(recipients.Select(r =>
            {
                var mentioned = job.Message.Mentions.Contains(r.UserId);
                return notifier.MessageAsync(r.UserId, job.GroupPublicId, job.Message.PublicId, from, job.Message.Text, r.ShowPreview, !ChatCardRules.AlertsRecipient(r.Muted, r.MentionsOnly, mentioned), ct, job.Message.Urgency, job.ActorId, mentioned);
            }));
            // A channel or room has hundreds of members and the text bridge is for people ashore in a small chat: it is never used here.
            if (!ChatRoomRules.IsRoomKind(job.Kind)) await sms.MessageAsync(job.GroupId, from, job.Message, recipients, ct);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning(e, "Chat notices for a message could not all be sent");
        }
    }
}

/// <summary>Works through <see cref="ChatFanoutQueue"/> with a few readers, each job in its own scope (the stores are per scope).</summary>
public sealed class ChatFanoutService(ChatFanoutQueue queue, IServiceScopeFactory scopes) : BackgroundService
{
    private const int Readers = 4;

    protected override Task ExecuteAsync(CancellationToken stoppingToken) => Task.WhenAll(Enumerable.Range(0, Readers).Select(_ => ReadAsync(stoppingToken)));

    private async Task ReadAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var job in queue.Reader.ReadAllAsync(stoppingToken))
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<ChatFanout>().RunAsync(job, stoppingToken);
            }
        }
        catch (OperationCanceledException) { /* the server is stopping */ }
    }
}
