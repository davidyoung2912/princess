using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Tests.Support;

public sealed class InMemoryStaffTicketStore : IStaffTicketStore
{
    public List<(long User, StaffTicketDto Ticket, bool Cancelled)> Rows { get; } = [];

    public Task AddAsync(long userId, StaffTicketDto ticket, CancellationToken ct)
    {
        Rows.Add((userId, ticket, false));
        return Task.CompletedTask;
    }

    public Task<List<StaffTicketDto>> ListAsync(long userId, long sinceMs, CancellationToken ct) =>
        Task.FromResult(Rows.Where(r => r.User == userId && !r.Cancelled && r.Ticket.At >= sinceMs).Select(r => r.Ticket).OrderByDescending(t => t.At).ToList());

    public Task<bool> CancelAsync(long userId, Guid id, DateTime now, CancellationToken ct)
    {
        var i = Rows.FindIndex(r => r.User == userId && r.Ticket.Id == id && !r.Cancelled);
        if (i < 0) return Task.FromResult(false);
        Rows[i] = Rows[i] with { Cancelled = true };
        return Task.FromResult(true);
    }
}
