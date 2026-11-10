using Princess.Api.Audit;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Reading someone else's conversation, which only a guardian (for their own supervised child) and staff (for a reported message and a few lines round it) can do (docs/chat-plan.md, 4.6, 4.7 and phase 7).
/// Every such read is written to the audit trail with the reader, the child or conversation and how much was read, never the text. A guardian never sends, marks read or changes anything as the child.
/// A person looking at their own conversation, or the child's guardian answering a request, is not covered here: those go through <see cref="ChatService"/> and <see cref="ChatConnectionService"/>.
/// </summary>
public sealed class ChatSafetyService(IChatSafetyStore safety, IUserStore users, ChatService chat, IAuditLog audit, IClock clock)
{
    private static string Short(string first, string last) => ChatConnectionRules.ShortName(first, last);

    /// <summary>The children the caller supervises. Only who they are: no conversation is read, so nothing is audited. A child, or a booker acting as a child, sees none.</summary>
    public async Task<List<ChatChildDto>> ChildrenAsync(UserRecord actor, CancellationToken ct) =>
        actor.IsSupervised ? [] : [.. (await safety.ListChildrenAsync(actor.Id, ct)).Select(k => new ChatChildDto(k.PublicId, k.FirstName))];

    /// <summary>The child's conversations with their last lines, as the child sees them. Read only and audited. 404 when the caller is not the child's guardian.</summary>
    public async Task<List<ChatConversationDto>> ChildConversationsAsync(UserRecord actor, Guid childId, CancellationToken ct)
    {
        var child = await GuardedChildAsync(actor, childId, ct);
        // Not "ensure": looking must not create a conversation for the child.
        var list = await chat.ConversationsAsync(child, ct, ensureParty: false);
        await LogAsync(actor, "chat.guardian.list", child.PublicId, new { conversations = list.Count }, ct);
        return list;
    }

    private async Task<UserRecord> GuardedChildAsync(UserRecord actor, Guid childId, CancellationToken ct)
    {
        var child = await users.FindByPublicIdAsync(childId, ct);
        if (child is null || !ChatSafetyRules.MayReadAsGuardian(actor.Id, actor.IsSupervised, child.IsSupervised, child.BookerUserId)) throw ApiException.NotFound();
        return child;
    }

    /// <summary>
    /// A page of the child's conversation exactly as the child sees it (their window, their blocks), read only. 404 when the caller is not the child's guardian or the child is not in the conversation:
    /// the same answer either way.
    /// </summary>
    public async Task<ChatThreadDto> ChildThreadAsync(UserRecord actor, Guid childId, Guid conversationId, Guid? before, int? limit, CancellationToken ct)
    {
        var child = await GuardedChildAsync(actor, childId, ct);
        var thread = await chat.ThreadAsync(child, conversationId, before, limit, ct);
        await LogAsync(actor, "chat.guardian.read", child.PublicId, new { conversation = conversationId, messages = thread.Messages.Count }, ct);
        return thread;
    }

    // ---- Staff ----

    public async Task<List<ChatReportDto>> ReportsAsync(UserRecord admin, string? status, CancellationToken ct) =>
        [.. (await safety.ListReportsAsync(ChatSafetyRules.ListStatus(status), ChatSafetyRules.MaxReports, ct)).Select(r => new ChatReportDto(r.PublicId, r.Reason, r.Status, r.Kind, Shipboard.Ms(r.At)))];

    /// <summary>The report with the reported message and <see cref="ChatSafetyRules.ContextLines"/> lines either side, and nothing else. The read is audited.</summary>
    public async Task<ChatCaseDto> CaseAsync(UserRecord admin, Guid reportId, CancellationToken ct)
    {
        var report = await safety.GetReportAsync(reportId, ct) ?? throw ApiException.NotFound();
        var lines = await safety.ListContextAsync(report.MessageId, report.GroupId, ChatSafetyRules.ContextLines, ct);
        await LogAsync(admin, "chat.staff.read", null, new { report = reportId, lines = lines.Count }, ct);
        return new(report.PublicId, report.Reason, report.Status, report.Kind, Shipboard.Ms(report.At),
            [.. lines.Select(l => new ChatCaseLineDto(l.PublicId, l.Id == report.MessageId, Short(l.FirstName, l.LastName), l.Text, l.HasPhoto, Shipboard.Ms(l.At)))]);
    }

    /// <summary>Dismisses a report or removes the message. 400 decision; 404 report; 409 when it was already decided.</summary>
    public async Task ResolveAsync(UserRecord admin, Guid reportId, ChatResolveBody? body, CancellationToken ct)
    {
        var status = ChatSafetyRules.StatusFor(body?.Decision) ?? throw ApiException.Invalid("decision");
        var report = await safety.GetReportAsync(reportId, ct) ?? throw ApiException.NotFound();
        if (!ChatSafetyRules.CanResolve(report.Status) || !await safety.ResolveAsync(report.Id, status, body!.Decision == ChatSafetyRules.Remove, admin.Id, clock.UtcNow, ct)) throw ApiException.Conflict("resolved");
        await LogAsync(admin, "chat.staff.resolve", null, new { report = reportId, decision = body!.Decision }, ct);
    }

    private Task LogAsync(UserRecord reader, string action, Guid? subject, object detail, CancellationToken ct) =>
        audit.RecordAsync(new AuditEntry
        {
            Category = AuditCategory.Domain, Action = action, Outcome = AuditOutcome.Success,
            ActorPublicId = reader.PublicId, ActorRole = reader.Role, SubjectPublicId = subject, Detail = AuditContext.Json(detail),
        }, ct);
}
