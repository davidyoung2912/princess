namespace Princess.Api.Domain;

/// <summary>The one source of "now" (D4). Demo users get an offset from <c>demo.DemoState</c> in a later phase; tests pin it.</summary>
public interface IClock
{
    DateTime UtcNow { get; }
}

public sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
