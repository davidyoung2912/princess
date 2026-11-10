using Princess.Api.Audit;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Search and export of the caller's own chats (docs/chat-features-research.md, phase 9). Both read through the same window and block rule as the thread, so a person never finds or saves
/// a message they could not already read. Neither covers Stanley's chat, a channel or a room. An export is audited without any text.
/// </summary>
public sealed class ChatSearchService(IChatStore store, IUserClock clock, IAuditLog audit)
{
    private static string ShortName(ChatPeerRow p) => ChatConnectionRules.ShortName(p.FirstName, p.LastName);

    public async Task<ChatSearchResultDto> SearchAsync(UserRecord actor, string? query, Guid? conversationId, Guid? before, int? limit, CancellationToken ct)
    {
        var clean = ChatSearchRules.CleanQuery(query) ?? throw ApiException.Invalid("query");
        if (conversationId is { } one)
        {
            var member = await store.GetMemberAsync(actor.Id, one, ct) ?? throw ApiException.NotFound();
            if (!ChatSearchRules.Searchable(member.Kind)) return new([], false);
        }
        var size = ChatSearchRules.ClampPage(limit);
        var rows = await store.SearchMessagesAsync(actor.Id, conversationId, ChatSearchRules.LikePattern(clean), before, size, ct);
        var more = rows.Count > size;
        if (more) rows.RemoveAt(rows.Count - 1);   // the extra, oldest one was only read to know there is more
        var people = rows.Count == 0 ? new Dictionary<long, List<ChatPeerRow>>() : await store.ListMembersForAsync([.. rows.Select(r => r.GroupId).Distinct()], ct);
        string NameOf(ChatSearchRow r) => r.FromUserId == actor.Id ? "" : people.TryGetValue(r.GroupId, out var list) && list.FirstOrDefault(p => p.UserId == r.FromUserId) is { } p ? ShortName(p) : "";
        var hits = rows.Select(r => new ChatSearchHitDto(r.GroupPublicId, r.PublicId, NameOf(r), r.FromUserId == actor.Id, ChatSearchRules.Snippet(r.Text, clean), Shipboard.Ms(r.At))).ToList();
        return new(hits, more, more && rows.Count > 0 ? rows[^1].PublicId : null);
    }

    public async Task<ChatExportDto> ExportAsync(UserRecord actor, Guid conversationId, CancellationToken ct)
    {
        var member = await store.GetMemberAsync(actor.Id, conversationId, ct) ?? throw ApiException.NotFound();
        if (!ChatSearchRules.Searchable(member.Kind)) throw ApiException.Forbidden("notExportable");
        var people = await store.ListMembersAsync(member.GroupId, ct);
        var others = people.Where(p => p.UserId != actor.Id && p.Status == ChatConversationRules.Active).Select(ShortName).ToList();
        var rows = await store.ListForExportAsync(member.GroupId, actor.Id, ChatSearchRules.MaxExport + 1, ct);
        var truncated = rows.Count > ChatSearchRules.MaxExport;
        if (truncated) rows.RemoveAt(0);   // the extra, oldest one was only read to know it was cut
        var byId = people.ToDictionary(p => p.UserId);
        var lines = rows.Select(r => new ChatExportLineDto(r.FromUserId == actor.Id ? "You" : byId.TryGetValue(r.FromUserId, out var p) ? ShortName(p) : "", Shipboard.Ms(r.At), r.Text, r.HasPhoto, r.IsSystem)).ToList();
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "chat.export", Outcome = AuditOutcome.Success, Target = "conversation:" + conversationId, Detail = lines.Count + " lines" }, ct);
        return new(ChatConversationRules.DisplayName(member.Kind, member.Name, others), Shipboard.Ms(await clock.NowAsync(actor, ct)), lines, truncated);
    }
}
