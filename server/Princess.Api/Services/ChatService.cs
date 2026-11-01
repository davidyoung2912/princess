using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The group chat (MSG-01) and its safeguards (MSG-05). Ports <c>messages</c> of <c>src/api/mock.ts</c> and <c>chat</c> of <c>src/api/aboardMock.ts</c>.
/// Chat belongs to the person, not a booking: they see the messages of every group they are in (<c>ChatGroupMembers</c>). Groups are set up by the persona scripts or staff; a person in none who sends a message gets a group of their own.
/// A message from someone the reader has blocked is left out. Read receipts show only when both the sender and the reader have them on. Under-18s cannot pass on phone numbers or links, and cannot send photos.
/// </summary>
public sealed class ChatService(IChatStore store, IAccountStore accounts, IUserClock userClock)
{
    private static string Describe(string? text) => (text ?? "").Trim();

    public async Task<List<ChatMessageDto>> ListAsync(UserRecord actor, CancellationToken ct)
    {
        var peers = (await store.ListPeersAsync(actor.Id, ct)).ToDictionary(p => p.UserId);
        var hidden = (await store.ListBlocksAsync(actor.Id, ct)).ToHashSet();
        var mine = await store.GetReceiptsAsync(actor.Id, ct);
        var messages = await store.ListMessagesAsync(actor.Id, ct);
        var publicOf = (long id) => id == actor.Id ? actor.PublicId : peers.TryGetValue(id, out var p) ? p.PublicId : (Guid?)null;
        var receiptsOf = (long id) => id == actor.Id ? mine : peers.TryGetValue(id, out var p) && p.ReceiptsOn;
        var list = new List<ChatMessageDto>();
        foreach (var m in messages.Where(m => !hidden.Contains(m.FromUserId)))
        {
            if (publicOf(m.FromUserId) is not { } from) continue;
            var seen = receiptsOf(m.FromUserId) ? m.SeenBy.Where(id => id != m.FromUserId && receiptsOf(id)).Select(publicOf).OfType<Guid>().ToList() : null;
            list.Add(new ChatMessageDto(m.PublicId, from, m.Text, Shipboard.Ms(m.At), m.Photo, seen));
        }
        return list;
    }

    public async Task<ChatMessageDto> SendAsync(UserRecord actor, SendChatRequest? body, CancellationToken ct)
    {
        var text = Describe(body?.Text);
        if (text.Length == 0 || text.Length > 2000) throw ApiException.Invalid("text");
        if (ServiceRules.ChildSafeProblem(text, await AgeAsync(actor, ct)) is { } problem) throw ApiException.Invalid(problem);
        var m = await store.AddMessageAsync(actor.Id, text, null, await userClock.NowAsync(actor, ct), ct);
        return new ChatMessageDto(m.PublicId, actor.PublicId, m.Text, Shipboard.Ms(m.At));
    }

    public Task<bool> ReceiptsAsync(UserRecord actor, CancellationToken ct) => store.GetReceiptsAsync(actor.Id, ct);

    public async Task<bool> SetReceiptsAsync(UserRecord actor, ChatReceiptsRequest? body, CancellationToken ct)
    {
        await store.SetReceiptsAsync(actor.Id, body?.On == true, ct);
        return body?.On == true;
    }

    /// <summary>Marks the chat read now; only recorded when the person has receipts on.</summary>
    public async Task MarkSeenAsync(UserRecord actor, CancellationToken ct)
    {
        if (await store.GetReceiptsAsync(actor.Id, ct)) await store.MarkSeenAsync(actor.Id, await userClock.NowAsync(actor, ct), ct);
    }

    public async Task<List<Guid>> BlockedAsync(UserRecord actor, CancellationToken ct)
    {
        var peers = (await store.ListPeersAsync(actor.Id, ct)).ToDictionary(p => p.UserId);
        return [.. (await store.ListBlocksAsync(actor.Id, ct)).Select(id => peers.TryGetValue(id, out var p) ? p.PublicId : (Guid?)null).OfType<Guid>()];
    }

    public async Task<List<Guid>> BlockAsync(UserRecord actor, Guid id, ChatBlockRequest? body, CancellationToken ct)
    {
        var peer = (await store.ListPeersAsync(actor.Id, ct)).FirstOrDefault(p => p.PublicId == id) ?? throw ApiException.Invalid("notInChat");
        await store.SetBlockAsync(actor.Id, peer.UserId, body?.On != false, ct);
        return await BlockedAsync(actor, ct);
    }

    public async Task ReportAsync(UserRecord actor, ChatReportRequest? body, CancellationToken ct)
    {
        if (body?.Reason is null || !ServiceRules.ReportReasons.Contains(body.Reason)) throw ApiException.Invalid("badReason");
        if (!await store.AddReportAsync(actor.Id, body.MessageId, body.Reason, await userClock.NowAsync(actor, ct), ct)) throw ApiException.NotFound();
    }

    public async Task SendPhotoAsync(UserRecord actor, ChatPhotoRequest? body, CancellationToken ct)
    {
        var age = await AgeAsync(actor, ct);
        var problem = ServiceRules.PhotoProblem(body?.Type, body?.Bytes ?? 0, age);
        if (problem == "age") throw ApiException.Forbidden("age");
        if (problem is not null) throw ApiException.Invalid(problem);
        if (body!.DataUrl is not { } url || !url.StartsWith($"data:{body.Type};base64,", StringComparison.Ordinal) || url.Length > ServiceRules.MaxPhotoDataUrl) throw ApiException.Invalid("size");
        var caption = Describe(body.Caption);
        if (caption.Length > 200) caption = caption[..200];
        if (ServiceRules.ChildSafeProblem(caption, age) is { } bad) throw ApiException.Invalid(bad);
        await store.AddMessageAsync(actor.Id, caption, url, await userClock.NowAsync(actor, ct), ct);
    }

    /// <summary>The person's age today from their profile; someone with no date of birth on file counts as a child while their account is supervised, else an adult.</summary>
    private async Task<int> AgeAsync(UserRecord actor, CancellationToken ct) =>
        await accounts.GetProfileAsync(actor.Id, ct) is { } p ? AccountRules.AgeOn(DateOnly.FromDateTime(p.Dob), TripRules.Today(await userClock.NowAsync(actor, ct))) : actor.IsSupervised ? 0 : 18;
}
