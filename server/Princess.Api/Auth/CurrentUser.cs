using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Auth;

public interface ICurrentUser
{
    /// <summary>The signed-in person; on a view-as token this is the supervised child, so child restrictions apply (D13).</summary>
    Guid PublicId { get; }
    /// <summary>The booker behind a view-as token, otherwise null.</summary>
    Guid? ActorPublicId { get; }
    Task<UserRecord> LoadAsync(CancellationToken ct);
}

public sealed class CurrentUser(IHttpContextAccessor http, IUserStore users) : ICurrentUser
{
    private UserRecord? _loaded;

    public Guid PublicId => Guid.TryParse(http.HttpContext?.User.FindFirst(Claims.Subject)?.Value, out var id) ? id : throw ApiException.Unauthenticated();

    public Guid? ActorPublicId => Guid.TryParse(http.HttpContext?.User.FindFirst(Claims.Actor)?.Value, out var id) ? id : null;

    public async Task<UserRecord> LoadAsync(CancellationToken ct) =>
        _loaded ??= await users.FindByPublicIdAsync(PublicId, ct) ?? throw ApiException.Unauthenticated();
}
