namespace Princess.Api.Auth;

/// <summary>A short, human name for a device from its User-Agent text ("Safari on iPhone"). Never the raw string, which is long and tells a guest nothing.</summary>
public static class DeviceLabel
{
    public static string From(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent)) return "Unknown device";
        var ua = userAgent;
        var os = Has(ua, "iPhone") ? "iPhone"
            : Has(ua, "iPad") ? "iPad"
            : Has(ua, "Android") ? "Android"
            : Has(ua, "Windows") ? "Windows"
            : Has(ua, "Mac OS X") || Has(ua, "Macintosh") ? "Mac"
            : Has(ua, "CrOS") ? "Chromebook"
            : Has(ua, "Linux") ? "Linux"
            : null;
        // Order matters: Edge and Opera also say Chrome, and Chrome also says Safari.
        var browser = Has(ua, "Edg/") || Has(ua, "EdgA/") || Has(ua, "EdgiOS/") ? "Edge"
            : Has(ua, "OPR/") || Has(ua, "Opera") ? "Opera"
            : Has(ua, "Firefox/") || Has(ua, "FxiOS/") ? "Firefox"
            : Has(ua, "Chrome/") || Has(ua, "CriOS/") ? "Chrome"
            : Has(ua, "Safari/") ? "Safari"
            : null;
        return (browser, os) switch
        {
            (not null, not null) => $"{browser} on {os}",
            (not null, null) => browser,
            (null, not null) => os,
            _ => "Unknown device",
        };
    }

    private static bool Has(string s, string part) => s.Contains(part, StringComparison.OrdinalIgnoreCase);
}
