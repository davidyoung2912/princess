namespace Princess.Api.Contracts;

/// <summary>The <c>limit</c> query parameter of a list that is the caller's own and grows with use: newest first, 100 unless asked, never more than <see cref="Max"/>.</summary>
public static class ListLimit
{
    public const int Default = 100;
    public const int Max = 200;

    public static int Clamp(int? limit) => Math.Clamp(limit ?? Default, 1, Max);
}
