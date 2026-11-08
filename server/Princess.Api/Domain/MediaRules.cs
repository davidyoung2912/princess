namespace Princess.Api.Domain;

/// <summary>What the server keeps of a guest's picture, without the bytes.</summary>
public sealed record MediaDto(Guid Id, string Purpose, string Ref, string Kind, string Caption, string ContentType, int Width, int Height, int Bytes, string Status, long At, bool Mine);

/// <summary>The caller's use of their picture allowance.</summary>
public sealed record MediaUsageDto(int Count, long Bytes, int MaxCount, long MaxBytes);

/// <summary>
/// Guest pictures (N7): what is accepted, how it is cleaned and who may see it. Pure, so it is tested without a database.
/// The server is the authority on type, size and metadata. The app also shrinks a picture before it is sent, but that is a courtesy: nothing here trusts it.
/// </summary>
public static class MediaRules
{
    /// <summary>cabin: a stateroom picture for the chooser; book: a picture on a day of the memory book; postcard: a picture on a family-at-home postcard; case: a photo of a lost item or a receipt kept with one of the guest's own cases.</summary>
    public static readonly string[] Purposes = ["cabin", "book", "postcard", "case"];

    /// <summary>What a cabin picture shows: the room, the view, something in the way, noise or the deck above and below.</summary>
    public static readonly string[] CabinKinds = ["room", "view", "obstruction", "noise"];

    public const int MaxBytes = 2_000_000;
    public const int MaxCount = 40;
    public const long MaxTotalBytes = 20_000_000;
    public const int MaxSide = 8000;
    public const long MaxPixels = 25_000_000;
    public const int MaxCaption = 140;
    public const int MaxRef = 40;

    /// <summary>Minutes a cabin picture waits before the simulated moderator answers.</summary>
    public const int ModerationMinutes = 10;

    public static bool KnownPurpose(string? purpose) => Array.IndexOf(Purposes, purpose) >= 0;

    /// <summary>The cleaned caption, or false when it has a link, an address or a phone number (a caption is shown to other people).</summary>
    public static bool ValidCaption(string? text, out string clean)
    {
        clean = new string((text ?? "").Where(c => !char.IsControl(c)).ToArray()).Trim();
        return clean.Length <= MaxCaption && !System.Text.RegularExpressions.Regex.IsMatch(clean, @"@|https?:|www\.|(\d[\s.\-]?){7,}", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }

    /// <summary>
    /// The reference a picture is kept under: a stateroom category for <c>cabin</c> (letters only), a cruise day 1 to 8 or <c>cover</c> for <c>book</c>, nothing for <c>postcard</c>, and a case number (letters, digits and dashes) for <c>case</c>.
    /// False when it does not fit the purpose.
    /// </summary>
    public static bool ValidRef(string purpose, string? reference, out string clean)
    {
        clean = (reference ?? "").Trim();
        return purpose switch
        {
            "cabin" => clean.Length is > 0 and <= MaxRef && clean.All(char.IsAsciiLetter),
            "book" => clean == "cover" || (int.TryParse(clean, out var day) && day is >= 1 and <= Itinerary.MaxDay && clean == day.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            "postcard" => clean.Length == 0,
            "case" => clean.Length is > 0 and <= MaxRef && clean.All(c => char.IsAsciiLetterOrDigit(c) || c == '-'),
            _ => false,
        };
    }

    /// <summary>The kind: one of <see cref="CabinKinds"/> for a cabin picture, empty for the others.</summary>
    public static bool ValidKind(string purpose, string? kind, out string clean)
    {
        clean = (kind ?? "").Trim();
        return purpose == "cabin" ? Array.IndexOf(CabinKinds, clean) >= 0 : clean.Length == 0;
    }

    /// <summary>The type the bytes really are (<c>image/jpeg</c> or <c>image/png</c>), whatever the caller said they were; null for anything else.</summary>
    public static string? Sniff(ReadOnlySpan<byte> b)
    {
        if (b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return "image/jpeg";
        if (b.Length >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47 && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) return "image/png";
        return null;
    }

    /// <summary>
    /// Rewrites the picture without anything that is not the picture: for a JPEG, the EXIF block (place, time, camera), comments and the other application blocks
    /// except JFIF, the colour profile and Adobe's colour flag; for a PNG, every chunk but the ones that draw it. Reads the size too.
    /// False when the file is cut short, has no size or is too large in pixels (a small file can hold a very large picture).
    /// </summary>
    public static bool TryClean(byte[] input, string type, out byte[] clean, out int width, out int height)
    {
        clean = [];
        width = height = 0;
        var ok = type == "image/jpeg" ? CleanJpeg(input, out clean, out width, out height) : type == "image/png" && CleanPng(input, out clean, out width, out height);
        return ok && width is > 0 and <= MaxSide && height is > 0 and <= MaxSide && (long)width * height <= MaxPixels;
    }

    private static bool IsSof(byte m) => m is >= 0xC0 and <= 0xCF && m is not (0xC4 or 0xC8 or 0xCC);

    private static bool CleanJpeg(byte[] b, out byte[] clean, out int width, out int height)
    {
        clean = [];
        width = height = 0;
        if (b.Length < 4 || b[0] != 0xFF || b[1] != 0xD8) return false;
        var o = new MemoryStream(b.Length);
        o.Write(b, 0, 2);
        var i = 2;
        var sawSize = false;
        while (i + 1 < b.Length)
        {
            if (b[i] != 0xFF) return false;
            while (i + 1 < b.Length && b[i + 1] == 0xFF) i++;   // fill bytes
            if (i + 1 >= b.Length) return false;
            var m = b[i + 1];
            if (m is 0x01 or (>= 0xD0 and <= 0xD7)) { o.Write(b, i, 2); i += 2; continue; }
            if (m == 0xD9) { o.Write(b, i, 2); clean = o.ToArray(); return sawSize; }
            if (i + 3 >= b.Length) return false;
            var len = (b[i + 2] << 8) | b[i + 3];
            if (len < 2 || i + 2 + len > b.Length) return false;
            if (IsSof(m))
            {
                if (len < 8) return false;
                height = (b[i + 5] << 8) | b[i + 6];
                width = (b[i + 7] << 8) | b[i + 8];
                sawSize = true;
            }
            if (m == 0xDA)
            {
                // The scan: everything from here to the end is picture data, copied as it is.
                o.Write(b, i, b.Length - i);
                clean = o.ToArray();
                return sawSize && b[^2] == 0xFF && b[^1] == 0xD9;
            }
            // Dropped: EXIF and XMP (E1), the other application blocks (E3 to ED, EF) and comments (FE). Kept: JFIF (E0), the colour profile (E2) and Adobe's colour flag (EE).
            var drop = m is 0xE1 or (>= 0xE3 and <= 0xED) or 0xEF or 0xFE;
            if (!drop) o.Write(b, i, 2 + len);
            i += 2 + len;
        }
        return false;
    }

    private static readonly HashSet<string> KeptChunks = ["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB"];

    private static bool CleanPng(byte[] b, out byte[] clean, out int width, out int height)
    {
        clean = [];
        width = height = 0;
        if (b.Length < 8 + 25) return false;
        var o = new MemoryStream(b.Length);
        o.Write(b, 0, 8);
        var i = 8;
        var first = true;
        var sawEnd = false;
        var sawData = false;
        while (i + 12 <= b.Length)
        {
            var len = (long)((uint)(b[i] << 24 | b[i + 1] << 16 | b[i + 2] << 8 | b[i + 3]));
            if (len > b.Length - i - 12) return false;
            var name = System.Text.Encoding.ASCII.GetString(b, i + 4, 4);
            if (first)
            {
                if (name != "IHDR" || len != 13) return false;
                width = (b[i + 8] << 24) | (b[i + 9] << 16) | (b[i + 10] << 8) | b[i + 11];
                height = (b[i + 12] << 24) | (b[i + 13] << 16) | (b[i + 14] << 8) | b[i + 15];
                if (width <= 0 || height <= 0) return false;
                first = false;
            }
            var total = (int)len + 12;
            if (KeptChunks.Contains(name)) o.Write(b, i, total);
            if (name == "IDAT") sawData = true;
            i += total;
            if (name == "IEND") { sawEnd = true; break; }
        }
        if (!sawEnd || !sawData) return false;
        clean = o.ToArray();
        return true;
    }

    /// <summary>
    /// What the simulated moderator has decided for a cabin picture: <c>pending</c> for its first minutes, then <c>approved</c>. Nothing else is decided here, because a caption
    /// with contact details is refused before the picture is kept. A real moderator replaces this and may also say <c>rejected</c>, which is stored and never changes back.
    /// </summary>
    public static string EffectiveStatus(string stored, DateTime createdAt, DateTime now) =>
        stored != "pending" ? stored : now - createdAt >= TimeSpan.FromMinutes(ModerationMinutes) ? "approved" : "pending";

    /// <summary>Whether <paramref name="viewerId"/> may fetch the bytes: the owner always; anyone else only a cabin picture that is approved and only while showing other guests' pictures is switched on.</summary>
    public static bool MayView(long ownerId, long viewerId, string purpose, string effectiveStatus, bool showOthers) =>
        ownerId == viewerId || (showOthers && purpose == "cabin" && effectiveStatus == "approved");
}
