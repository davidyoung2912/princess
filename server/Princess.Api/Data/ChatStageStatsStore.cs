using Dapper;
using Princess.Api.Domain;

namespace Princess.Api.Data;

/// <summary>Counts for the staff stage-measures view (docs/chat-features-research.md, 13.6 "Measures"). Aggregates only: nothing here returns a person, a group or a word anyone wrote.</summary>
public interface IChatStageStatsStore
{
    Task<StageCounts> CountsSinceAsync(DateTime since, CancellationToken ct);
}

public sealed class DapperChatStageStatsStore(IDbConnectionFactory db) : IChatStageStatsStore
{
    public async Task<StageCounts> CountsSinceAsync(DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // Huddles that became a party chat are 'group' by then, so a huddle that converted is no longer counted here. The party chat is made the first time anyone on the booking opens chat, so "within 48 hours" runs from then.
        return await c.QuerySingleAsync<StageCounts>(Sql.Cmd("""
            SELECT
              (SELECT COUNT(*) FROM dbo.ChatGroups WHERE Kind = 'huddle' AND CreatedAt >= @since) AS Huddles,
              (SELECT COUNT(*) FROM dbo.ChatGroups g WHERE g.Kind = 'huddle' AND g.CreatedAt >= @since
                  AND EXISTS (SELECT 1 FROM dbo.ChatHuddleShortlist s WHERE s.GroupId = g.Id)
                  AND (SELECT COUNT(*) FROM dbo.ChatGroupMembers m WHERE m.GroupId = g.Id AND m.Status = 'active') >= 2) AS HuddlesShared,
              (SELECT COUNT(*) FROM dbo.ChatGroups WHERE Kind = 'party' AND BookingId IS NOT NULL AND CreatedAt >= @since) AS PartyChats,
              (SELECT COUNT(*) FROM dbo.ChatGroups g WHERE g.Kind = 'party' AND g.BookingId IS NOT NULL AND g.CreatedAt >= @since
                  AND EXISTS (SELECT 1 FROM dbo.ChatMessages m WHERE m.GroupId = g.Id AND m.IsSystem = 0 AND m.FromUserId IS NOT NULL AND m.[At] <= DATEADD(hour, 48, g.CreatedAt))) AS PartyChatsUsed48h,
              (SELECT COUNT(*) FROM dbo.ChatGroups g WHERE g.Kind IN ('party','group','huddle')
                  AND EXISTS (SELECT 1 FROM dbo.ChatMessages m WHERE m.GroupId = g.Id AND m.IsSystem = 0 AND m.[At] >= @since)) AS ActiveGroups,
              (SELECT COUNT(*) FROM dbo.ChatGroups g WHERE g.Kind IN ('party','group','huddle')
                  AND EXISTS (SELECT 1 FROM dbo.ChatMessages m WHERE m.GroupId = g.Id AND m.Kind IN ('poll','plan') AND m.[At] >= @since)) AS ActiveGroupsWithPlan,
              (SELECT COUNT(*) FROM dbo.ChatResponses r JOIN dbo.ChatMessages m ON m.Id = r.MessageId WHERE m.Kind = 'plan' AND r.Choice = 0 AND r.[At] >= @since) AS GoingAnswers,
              (SELECT COUNT(*) FROM dbo.ChatResponses r JOIN dbo.ChatMessages m ON m.Id = r.MessageId WHERE m.Kind = 'plan' AND r.Choice = 0 AND r.AddedToPlan = 1 AND r.[At] >= @since) AS GoingOnProgramme,
              (SELECT COUNT(*) FROM (SELECT DISTINCT GroupId, UserId FROM dbo.ChatStanleyReminders WHERE [At] >= @since) d) AS ReminderPairs,
              (SELECT COUNT(*) FROM (SELECT DISTINCT r.GroupId, r.UserId FROM dbo.ChatStanleyReminders r WHERE r.[At] >= @since) d
                  JOIN dbo.ChatGroupMembers m ON m.GroupId = d.GroupId AND m.UserId = d.UserId WHERE m.RemindersMuted = 1) AS ReminderPairsMuted,
              (SELECT COUNT(*) FROM dbo.ChatMessages WHERE IsSystem = 0 AND [At] >= @since) AS Messages,
              (SELECT COUNT(*) FROM dbo.ChatReports WHERE [At] >= @since) AS Reports,
              (SELECT COUNT(DISTINCT GroupId) FROM dbo.ChatKeeps WHERE KeptAt >= @since) AS KeepsChosen,
              (SELECT COUNT(*) FROM dbo.ChatRecaps WHERE StartedAt >= @since) AS RecapsStarted,
              (SELECT COUNT(*) FROM dbo.ChatRecaps WHERE SharedAt >= @since) AS RecapsShared,
              (SELECT COUNT(*) FROM dbo.ChatMeetUps WHERE CreatedAt >= @since) AS MeetUps,
              (SELECT COUNT(*) FROM dbo.ChatIntroductions WHERE CreatedAt >= @since) AS Introductions,
              (SELECT COUNT(*) FROM (
                   SELECT StartedBy AS UserId FROM dbo.ChatMeetUps WHERE CreatedAt >= @since
                   UNION SELECT UserId FROM dbo.ChatMeetUpAnswers WHERE AnsweredAt >= @since
                   UNION SELECT UserLow FROM dbo.ChatIntroductions WHERE CreatedAt >= @since
                   UNION SELECT UserHigh FROM dbo.ChatIntroductions WHERE CreatedAt >= @since) g) AS HostGuests
            """, new { since }, null, ct));
    }
}
