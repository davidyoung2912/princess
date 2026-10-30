using Princess.Api.Data;

namespace Princess.Api.Domain;

/// <summary>"Now" for one person (D4): real time, plus the demo offset only for users flagged <c>IsDemo</c>.</summary>
public interface IUserClock
{
    Task<DateTime> NowAsync(UserRecord user, CancellationToken ct);
}

public sealed class UserClock(IClock clock, IDemoStore demo) : IUserClock
{
    public async Task<DateTime> NowAsync(UserRecord user, CancellationToken ct)
    {
        var now = clock.UtcNow;
        return user.IsDemo ? now.AddSeconds(await demo.GetClockOffsetSecondsAsync(user.Id, ct)) : now;
    }
}
