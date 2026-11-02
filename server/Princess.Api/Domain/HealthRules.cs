namespace Princess.Api.Domain;

/// <summary>
/// Health on board (SAF-03), ported from <c>src/domain/health.ts</c>: Medical Center hours, reporting illness early, and requests for seasickness help, medicine and device power.
/// Figures and wording are authored concept values.
/// </summary>
public static class HealthRules
{
    public static readonly string[] Symptoms = ["vomiting", "diarrhoea", "fever", "cough", "other"];

    /// <summary>The symptoms that mean staying in the stateroom and telling the Medical Center at once.</summary>
    public static readonly string[] Gastro = ["vomiting", "diarrhoea"];

    public static readonly string[] RequestKinds = ["seasick", "medication", "devicePower", "textHelp"];

    /// <summary>
    /// Checks a request: a known kind, a note within the limit, and a note at all for <c>textHelp</c>, the written message to Guest Services for a guest who cannot speak or hear
    /// (N5.6). Returns the problem title, or null. This is not an alarm: the screens say so and point to the alarm, the cabin phone and the nearest crew member first.
    /// </summary>
    public static string? RequestProblem(string? kind, string? note)
    {
        if (kind is null || !RequestKinds.Contains(kind)) return "badKind";
        var text = (note ?? "").Trim();
        if (text.Length > NoteMax) return "badNote";
        if (kind == "textHelp" && text.Length == 0) return "badNote";
        return null;
    }

    /// <summary>How long the isolation meal arrangement lasts from the report.</summary>
    public const int IsolationWindowHours = 72;

    /// <summary>How long a guest with stomach symptoms is asked to stay in the cabin once they feel better (guidance shown on the health screens).</summary>
    public const int IsolateHours = 24;

    public const int NoteMax = 300;

    private static readonly Dictionary<string, (string Open, string Close)[]> MedicalHours = new()
    {
        ["sea"] = [("08:00", "12:00"), ("15:00", "19:00")],
        ["port"] = [("08:00", "10:00"), ("17:30", "19:30")],
    };

    private static int Mins(string t) => int.Parse(t[..2]) * 60 + int.Parse(t[3..]);

    public static bool Isolating(IEnumerable<DateTime> reportedAt, DateTime now) =>
        reportedAt.Any(at => at <= now && now - at < TimeSpan.FromHours(IsolationWindowHours));

    public static bool MedicalOpen(string day, string time) => MedicalHours[day].Any(h => Mins(time) >= Mins(h.Open) && Mins(time) < Mins(h.Close));

    /// <summary>When the Medical Center next opens today, or null if it has finished for the day.</summary>
    public static string? NextOpening(string day, string time) => MedicalHours[day].Select(h => h.Open).FirstOrDefault(o => Mins(o) > Mins(time));

    /// <summary>Checks a report; <paramref name="startedHoursAgo"/> is how long ago the first symptom began (0 to 96).</summary>
    public static string? ReportProblem(int guests, IReadOnlyCollection<string>? symptoms, int? startedHoursAgo)
    {
        if (guests == 0) return "noGuest";
        if (symptoms is null || symptoms.Count == 0) return "noSymptoms";
        if (!symptoms.All(Symptoms.Contains)) return "badSymptom";
        if (startedHoursAgo is null or < 0 or > 96) return "badStart";
        return null;
    }
}
