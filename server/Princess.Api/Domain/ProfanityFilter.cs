using System.Globalization;
using System.Text;

namespace Princess.Api.Domain;

/// <summary>
/// The word filter in front of Stanley (docs/stanley-plan.md, S1): swear words, slurs and direct insults, in English and Spanish. If any listed word is in a
/// message, the message is blocked and never reaches a model. Whole words match, so "assist", "cockpit", "Essex" and "class" are fine; a few strong stems also
/// match inside longer words ("motherfucker"), with a short allow-list for innocent words that contain one ("Scunthorpe"). Before matching, the text is
/// folded: lower case, accents removed (not the Spanish ñ), look-alike digits and symbols read as letters (<c>$h1t</c>), stretched letters squeezed
/// (<c>fuuuck</c>), spaced or dotted letters joined (<c>f u c k</c>, <c>f.u.c.k</c>) and star masks filled in (<c>f*ck</c>).
/// <para>
/// Words that are legitimate in cruising are deliberately not listed: "hell" (Hell, Grand Cayman is a real stop), "dyke" (Dutch sea walls), "balls"
/// (masquerade balls), "cono", "concha", "retrasado" (a delayed flight) and medical or anatomical terms. The list is data and meant to be tuned.
/// </para>
/// The matched term is for tests and counters only: it is never shown to the guest, and the message text is never logged.
/// </summary>
public static class ProfanityFilter
{
    /// <summary>Only this much of a message is examined (the concierge already caps a message at 500 characters).</summary>
    public const int MaxLength = 2000;

    public static bool IsBlocked(string? text) => Find(text) is not null;

    /// <summary>The listed term that blocks the message, or null when it is clean.</summary>
    public static string? Find(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var source = text.Length > MaxLength ? text[..MaxLength] : text;
        // Pass 1 keeps symbols as breaks, pass 2 reads look-alike symbols as letters, pass 3 also keeps star masks.
        foreach (var (leet, star) in new[] { (false, false), (true, false), (true, true) })
        {
            var tokens = Fold(source, leet, star).Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (!star)
            {
                var spaced = " " + string.Join(' ', tokens) + " ";
                foreach (var phrase in Phrases) if (spaced.Contains(" " + phrase + " ", StringComparison.Ordinal)) return phrase;
            }
            var run = new StringBuilder();
            foreach (var token in tokens.Append(string.Empty))
            {
                if (token.Length == 1 && token[0] != '*') { run.Append(token); continue; }
                if (run.Length >= 3 && MatchToken(run.ToString()) is { } joined) return joined;
                run.Clear();
                if (token.Length == 0) continue;
                var hit = token.Contains('*') ? MatchStar(token) : MatchToken(token);
                if (hit is not null) return hit;
            }
        }
        return null;
    }

    /// <summary>Lower case letters (a to z and ñ), single spaces, and optionally <c>*</c>; everything else is a break.</summary>
    internal static string Fold(string text, bool leet, bool keepStar)
    {
        var sb = new StringBuilder(text.Length);
        // Look-alike symbols are read as letters inside a chunk with a letter, and look-alike digits inside a chunk with two, so a cabin number such as 455, a
        // gate such as A55 and a price such as A$5 stay what they are. A dollar sign before a digit is a price, not an s.
        var chunks = text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
        foreach (var chunk in chunks)
        {
            var letters = chunk.Count(char.IsAsciiLetter);
            var symbols = leet && letters >= 1;
            var digits = leet && letters >= 2;
            if (sb.Length > 0) sb.Append(' ');
            var folded = chunk.Normalize(NormalizationForm.FormD);
            for (var i = 0; i < folded.Length; i++)
            {
                var raw = folded[i];
                if (CharUnicodeInfo.GetUnicodeCategory(raw) == UnicodeCategory.NonSpacingMark)
                {
                    // n plus a tilde is the Spanish ñ; any other accent is dropped.
                    if (raw == '\u0303' && sb.Length > 0 && sb[^1] == 'n') sb[^1] = 'ñ';
                    continue;
                }
                var c = char.ToLowerInvariant(raw);
                if (c == '$' && i + 1 < folded.Length && char.IsAsciiDigit(folded[i + 1])) c = ' ';
                else if (symbols) c = c switch { '@' => 'a', '$' => 's', '!' => 'i', '+' => 't', _ => c };
                if (digits) c = c switch { '0' => 'o', '1' => 'i', '3' => 'e', '4' => 'a', '5' => 's', '7' => 't', _ => c };
                if ((c >= 'a' && c <= 'z') || c == 'ñ') sb.Append(c);
                else if (c == '*' && keepStar) sb.Append('*');
                else sb.Append(' ');
            }
        }
        return sb.ToString();
    }

    private static string? MatchToken(string token)
    {
        if (Words.Contains(token)) return token;
        var capped = Cap(token, 2);
        if (capped != token && Words.Contains(capped)) return capped;
        // A stretched word ("fuuuck", "fuuck") squeezed to one of each letter; only when the token really has a repeat, so "bobs" is not "boobs".
        var squeezed = Cap(token, 1);
        if (squeezed != token && squeezed.Length >= 3 && Squeezed.TryGetValue(squeezed, out var term)) return term;
        if (Allowed.Contains(token)) return null;
        foreach (var stem in Stems) if (token.Contains(stem, StringComparison.Ordinal)) return stem;
        if (squeezed != token) foreach (var (stem, original) in SqueezedStems) if (squeezed.Contains(stem, StringComparison.Ordinal)) return original;
        return null;
    }

    /// <summary>A masked word such as <c>f*ck</c> or <c>sh*t</c>: it blocks when a listed word of the same length fits around the stars.</summary>
    private static string? MatchStar(string token)
    {
        var trimmed = token.Trim('*');
        if (trimmed.Length >= 3 && trimmed.Length != token.Length && !trimmed.Contains('*') && MatchToken(trimmed) is { } inner) return inner;
        if (token.Length < 4 || token.Count(c => c != '*') < 2) return null;
        foreach (var word in Words)
            if (word.Length == token.Length && Fits(token, word)) return word;
        return null;
    }

    private static bool Fits(string pattern, string word)
    {
        for (var i = 0; i < pattern.Length; i++)
            if (pattern[i] != '*' && pattern[i] != word[i]) return false;
        return true;
    }

    /// <summary>The string with every run of the same letter cut down to at most <paramref name="max"/> letters.</summary>
    private static string Cap(string s, int max)
    {
        var sb = new StringBuilder(s.Length);
        var count = 0;
        for (var i = 0; i < s.Length; i++)
        {
            count = i > 0 && s[i] == s[i - 1] ? count + 1 : 1;
            if (count <= max) sb.Append(s[i]);
        }
        return sb.ToString();
    }

    private static HashSet<string> Set(string words) => new(words.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries), StringComparer.Ordinal);

    // English: swearing, sexual vulgarity, slurs and direct insults (whole words).
    private const string EnglishWords = """
        fuck fucks fucked fucker fuckers fucking fuckin fuckup fuckwit fuckface fuckhead motherfucker motherfuckers mofo
        shit shits shitty shitting shithead shitheads shite bullshit horseshit dipshit
        bitch bitches bitchy bastard bastards
        ass asses arse arses arsehole arseholes asshole assholes asshat asswipe assclown dumbass jackass
        dick dicks dickhead dickheads cock cocks cocksucker prick pricks
        pussy pussies cunt cunts twat twats tits titty titties
        bollocks bollock bugger buggered bellend bellends tosser tossers wank wanker wankers wanking
        slut sluts slutty whore whores skank skanks
        cum cumshot jizz blowjob blowjobs handjob rimjob dildo dildos porn porno horny jerkoff jackoff
        damn damned dammit goddamn goddamned goddammit godamn crap crappy piss pissed pisses pissing pisser turd turds
        nigger niggers nigga niggas chink chinks gook gooks spic spics kike kikes wetback wetbacks beaner beaners
        tranny trannies shemale fag fags faggot faggots faggy retard retards retarded paki pakis towelhead towelheads
        raghead ragheads darkie darky midget midgets spaz spastic cripple
        idiot idiots moron morons imbecile imbeciles douche douchebag douchebags scumbag scumbags
        wtf stfu gtfo omfg lmfao fml kys
        """;

    // Spanish (accents removed, ñ kept): swearing, vulgarity and insults, including common Latin American forms.
    private const string SpanishWords = """
        puta putas puto putos putada putear hijueputa hijoeputa hijodeputa malparido malparida marica maricon mariconada maricones
        mierda mierdas joder jodete jodido jodida follar folla culo culero culera culiao verga vergas
        chingar chinga chingada chingado chingadera chingados pinche pinches coño coños cojones cojon carajo
        pendejo pendeja pendejos pendejadas cabron cabrona cabrones gilipollas gilipolla zorra zorras
        boludo boluda pelotudo pelotuda huevon hueon mamon mamona mamada mamadas
        conchetumare conchesumadre conchatumadre idiota idiotas imbecil imbeciles hdp ctm ptm
        """;

    private static readonly HashSet<string> Words = Set(EnglishWords + " " + SpanishWords);

    // Words of four or more letters, keyed by their letters squeezed to one of each ("fuk" for "fuck"), to catch stretched spellings.
    private static readonly Dictionary<string, string> Squeezed = BuildSqueezed();

    private static Dictionary<string, string> BuildSqueezed()
    {
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var word in Words)
            if (word.Length >= 4) map.TryAdd(Cap(word, 1), word);
        return map;
    }

    // Strong stems that also block inside a longer word, so "motherfucker" and "bullshitter" cannot slip past. Kept few and safe.
    private static readonly string[] Stems = ["fuck", "cunt", "nigger", "faggot", "asshole", "bitch", "whore", "shit", "cocksuck"];

    private static readonly (string Squeezed, string Original)[] SqueezedStems = Stems.Where(s => s.Length >= 4).Select(s => (Cap(s, 1), s)).Where(p => p.Item1 != p.Item2).ToArray();

    // Innocent words that contain a stem.
    private static readonly HashSet<string> Allowed = Set("scunthorpe scunthorpes shitake shitakes");

    // Phrases of ordinary words that are rude or threatening together.
    private static readonly string[] Phrases =
    [
        "shut up", "screw you", "up yours", "kill yourself", "kill your self", "drop dead", "go die", "suck my",
        "hijo de tu madre", "me cago en", "la puta madre", "vete a la mierda",
    ];
}
