namespace Princess.Api.Domain;

/// <summary>
/// A special-diet or allergy request attached to a dining reservation (DIN-110..112, 119..120). The guest sends it; the dining operation answers.
/// An unreviewed request is never shown as approved: it stays <c>received</c> or <c>review</c> until the galley side has answered.
/// </summary>
public static class DietaryRules
{
    public const string Allergy = "allergy";
    public const string Diet = "diet";
    public const string Other = "other";
    public static readonly IReadOnlyList<string> Kinds = [Allergy, Diet, Other];

    public const string Received = "received";
    public const string Review = "review";
    public const string Confirmed = "confirmed";
    /// <summary>Staff need to speak with the guest before service.</summary>
    public const string Contact = "contact";
    public const string Unable = "unable";

    public const int MaxNote = 300;

    /// <summary>The restaurant has the request in hand from this long after it was sent.</summary>
    public static readonly TimeSpan ReviewAfter = TimeSpan.FromMinutes(2);

    /// <summary>The galley side has answered from this long after it was sent.</summary>
    public static readonly TimeSpan AnswerAfter = TimeSpan.FromMinutes(10);

    public static bool KindOk(string? kind) => kind is not null && Kinds.Contains(kind);

    /// <summary>The note, trimmed and cut to length.</summary>
    public static string CleanNote(string? note) => note is null ? "" : note.Trim() is var t && t.Length > MaxNote ? t[..MaxNote] : note.Trim();

    /// <summary>A request needs words: an allergy or another need must say what it is; a diet may be named by the note alone, so it too needs one.</summary>
    public static bool NoteOk(string? note) => CleanNote(note).Length > 0;

    /// <summary>
    /// What the galley says, by how long ago the request was sent. This is the simulated side: a real dining system replaces <c>DiningGalley</c> behind <c>IDiningGalley</c>.
    /// An allergy or a need that is not a plain diet always needs a word with staff first; a plain diet is confirmed, except where the ship cannot meet it (kosher).
    /// </summary>
    public static string StatusAt(string kind, string note, DateTime sentAt, DateTime now)
    {
        var age = now - sentAt;
        if (age < ReviewAfter) return Received;
        if (age < AnswerAfter) return Review;
        if (kind != Diet) return Contact;
        return note.Contains("kosher", StringComparison.OrdinalIgnoreCase) ? Unable : Confirmed;
    }
}
