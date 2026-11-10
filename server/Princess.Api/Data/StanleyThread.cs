using System.Data.Common;
using Dapper;
using Princess.Api.Domain;

namespace Princess.Api.Data;

/// <summary>
/// The SQL that makes a guest's permanent Stanley chat (docs/chat-features-research.md, section 15.9). One statement path is shared by registration (inside the account's own transaction)
/// and the repeatable backfill, so the two cannot drift. It creates nothing when the account already has a thread.
/// </summary>
public static class StanleyThread
{
    /// <summary>Makes the conversation, the guest as its only member and the welcome message, unless one exists. A stage is not known at this point, so the first voice is the company's.</summary>
    public static async Task EnsureAsync(DbConnection c, DbTransaction tx, long userId, string welcome, DateTime now, CancellationToken ct)
    {
        var has = await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatGroups WHERE StanleyUserId = @userId", new { userId }, tx, ct));
        if (has > 0) return;
        var group = await c.ExecuteScalarAsync<long>(Sql.Cmd(
            "INSERT INTO dbo.ChatGroups (Name, Kind, StanleyUserId) OUTPUT INSERTED.Id VALUES (@name, 'stanley', @userId)", new { name = StanleyPersonaRules.Name, userId }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatGroupMembers (GroupId, UserId, JoinedAt) VALUES (@group, @userId, @now)", new { group, userId, now }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd(
            "INSERT INTO dbo.ChatMessages (GroupId, FromUserId, [Text], IsSystem, [At], Persona, Subtitle) VALUES (@group, NULL, @welcome, 0, @now, @voice, @subtitle)",
            new { group, welcome, now, voice = StanleyPersonaRules.Company, subtitle = StanleyPersonaRules.CompanyName }, tx, ct));
    }
}
