namespace Princess.Api.Domain;

/// <summary>Thank-yous and celebration messages (small delights D6-7 and D6-8). Plain text only; nothing here rates, scores or tips.</summary>
public static class SeaRules
{
    public const int MaxTeam = 40;
    public const int MaxThanks = 300;
    public const int MaxThanksPerBooking = 30;
    public const int MaxWish = 240;
    public const int MaxWishesPerPersonPerCelebration = 6;

    /// <summary>The text with its spaces collapsed, or null when it is empty or longer than <paramref name="max"/>.</summary>
    public static string? Clean(string? text, int max)
    {
        var t = string.Join(' ', (text ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return t.Length >= 1 && t.Length <= max ? t : null;
    }

    public static string? CleanTeam(string? team) => Clean(team, MaxTeam);
    public static string? CleanThanks(string? text) => Clean(text, MaxThanks);
    public static string? CleanWish(string? text) => Clean(text, MaxWish);
}
