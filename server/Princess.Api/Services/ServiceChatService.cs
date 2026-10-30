using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Guest Services chat (MSG-02, SUP-08): five channels per booking with a visible reply time. Ports <c>createServiceApi</c> in <c>src/api/onboardMock.ts</c>.
/// Crew replies are simulated (<c>ICrewResponder</c> in the data model): nothing is stored for them; a reply is made up on read once its time has come, so a slow-chat scenario just moves the time.
/// Any guest on the booking reads; an adult guest writes.
/// </summary>
public sealed class ServiceChatService(ScopeLoader scopes, IOnboardStore store, IInboxStore inbox, IDemoStore demo)
{
    private static long Ms(DateTime utc) => TripRules.ToMs(utc);

    private async Task<bool> SlowAsync(UserRecord actor, CancellationToken ct) => actor.IsDemo && (await demo.GetScenariosAsync(actor.Id, ct)).Contains("chatSlow");

    private static ServiceChannel Need(string? id) => ServiceChatRules.ById(id) ?? throw ApiException.Invalid("channel");

    /// <summary>The conversation as the guest sees it: what they wrote, each first reply that is due, and the phone call if one was asked for.</summary>
    private static ServiceThreadDto ThreadOf(ServiceChannel channel, ServiceThreadRow? row, DateTime now, bool slow)
    {
        var messages = new List<ServiceMessageDto>();
        DateTime? openFrom = null;
        var window = TimeSpan.FromMinutes(ServiceChatRules.Expected(channel, slow) * 3);
        foreach (var m in (row?.Messages ?? []).OrderBy(m => m.At).ThenBy(m => m.Id))
        {
            messages.Add(new ServiceMessageDto($"m{m.Id}", "me", null, m.Text, Ms(m.At)));
            if (openFrom is null || m.At > openFrom + window)
            {
                openFrom = m.At;
                var at = ServiceChatRules.ReplyAt(channel, m.At, slow);
                if (at <= now) messages.Add(new ServiceMessageDto($"reply-m{m.Id}", "crew", channel.Crew, ServiceChatRules.CrewReply(channel.Id), Ms(at)));
            }
        }
        if (row is { EscalatedAt: { } esc, EscalatedPhone: { } phone } && esc <= now)
            messages.Add(new ServiceMessageDto($"call-{channel.Id}", "crew", channel.Crew, $"We will phone you on {phone}. You can also dial Guest Services from any ship phone.", Ms(esc) + 1));
        var state = openFrom is null ? null : ServiceChatRules.StateOf(channel, openFrom.Value, now, slow, row?.EscalatedAt is { } e && e >= openFrom ? e : null);
        return new ServiceThreadDto(channel.Id, [.. messages.OrderBy(m => m.At)], state, slow);
    }

    public async Task<List<ServiceChannelDto>> ChannelsAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        var slow = await SlowAsync(actor, ct);
        var threads = await store.ListThreadsAsync(c.Booking.BookingId, ct);
        return [.. ServiceChatRules.Channels.Select(ch => new ServiceChannelDto(
            ch.Id, ServiceChatRules.Expected(ch, slow), slow, ThreadOf(ch, threads.FirstOrDefault(t => t.Channel == ch.Id), c.Now, slow).State?.Status == "waiting"))];
    }

    private async Task<ServiceThreadDto> ReadAsync(Scope c, ServiceChannel channel, CancellationToken ct) =>
        ThreadOf(channel, (await store.ListThreadsAsync(c.Booking.BookingId, ct)).FirstOrDefault(t => t.Channel == channel.Id), c.Now, await SlowAsync(c.Actor, ct));

    public async Task<ServiceThreadDto> ThreadAsync(UserRecord actor, string? number, string? channel, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        return await ReadAsync(c, Need(channel), ct);
    }

    public async Task<ServiceThreadDto> SendAsync(UserRecord actor, string? number, string? channel, ServiceSendRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var ch = Need(channel);
        var text = ServiceChatRules.Clean(body?.Text);
        if (text.Length == 0) throw ApiException.Invalid("text");
        await store.AddServiceMessageAsync(c.Booking.BookingId, ch.Id, text, c.Now, ct);
        return await ReadAsync(c, ch, ct);
    }

    public async Task<ServiceThreadDto> EscalateAsync(UserRecord actor, string? number, string? channel, ServiceEscalateRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var ch = Need(channel);
        var phone = body?.Phone?.Trim() ?? "";
        if (!AccountRules.PhoneOk(phone)) throw ApiException.Invalid("phone");
        await inbox.AddTicketAsync(actor.Id, "callback", phone, c.Now, ct);
        await store.EscalateAsync(c.Booking.BookingId, ch.Id, phone, c.Now, ct);
        return await ReadAsync(c, ch, ct);
    }
}
