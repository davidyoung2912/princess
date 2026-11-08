using Microsoft.Extensions.Configuration;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;
using Princess.Api.Tests.Support;
using Xunit;

namespace Princess.Api.Tests;

/// <summary>Guest pictures (N7): the rules that decide what is accepted, what is removed and who may see it.</summary>
public class MediaRulesTests
{
    private static byte[] Seg(byte marker, params byte[] body) => [0xFF, marker, (byte)((body.Length + 2) >> 8), (byte)(body.Length + 2), .. body];

    /// <summary>A tiny JPEG: JFIF, an EXIF block with a place in it, a comment, the size, one scan and the end.</summary>
    public static byte[] Jpeg(int width = 640, int height = 480, bool exif = true)
    {
        var sof = Seg(0xC0, 8, (byte)(height >> 8), (byte)height, (byte)(width >> 8), (byte)width, 1, 1, 0x11, 0);
        var scan = Seg(0xDA, 1, 1, 0, 0, 0x3F, 0).Concat(new byte[] { 0x12, 0x34, 0xFF, 0x00, 0x56 }).ToArray();
        var parts = new List<byte[]> { new byte[] { 0xFF, 0xD8 }, Seg(0xE0, (byte)'J', (byte)'F', (byte)'I', (byte)'F', 0) };
        if (exif) { parts.Add(Seg(0xE1, "Exif\0\0GPS 36.1N 115.1W"u8.ToArray())); parts.Add(Seg(0xFE, "taken by Ana"u8.ToArray())); }
        parts.Add(sof);
        parts.Add(scan);
        parts.Add(new byte[] { 0xFF, 0xD9 });
        return [.. parts.SelectMany(p => p)];
    }

    private static byte[] Chunk(string name, byte[] data) => [(byte)(data.Length >> 24), (byte)(data.Length >> 16), (byte)(data.Length >> 8), (byte)data.Length, .. System.Text.Encoding.ASCII.GetBytes(name), .. data, 0, 0, 0, 0];

    public static byte[] Png(int width = 64, int height = 32, bool text = true)
    {
        byte[] ihdr = [(byte)(width >> 24), (byte)(width >> 16), (byte)(width >> 8), (byte)width, (byte)(height >> 24), (byte)(height >> 16), (byte)(height >> 8), (byte)height, 8, 2, 0, 0, 0];
        var parts = new List<byte[]> { new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, Chunk("IHDR", ihdr) };
        if (text) { parts.Add(Chunk("eXIf", "GPS 36.1N"u8.ToArray())); parts.Add(Chunk("tEXt", "Author\0Ana"u8.ToArray())); }
        parts.Add(Chunk("IDAT", [1, 2, 3, 4]));
        parts.Add(Chunk("IEND", Array.Empty<byte>()));
        return [.. parts.SelectMany(p => p)];
    }

    private static bool Has(byte[] haystack, string needle) => haystack.AsSpan().IndexOf(System.Text.Encoding.ASCII.GetBytes(needle)) >= 0;

    [Fact]
    public void TheTypeIsReadFromTheBytesNotFromWhatTheCallerSays()
    {
        Assert.Equal("image/jpeg", MediaRules.Sniff(Jpeg()));
        Assert.Equal("image/png", MediaRules.Sniff(Png()));
        Assert.Null(MediaRules.Sniff("<svg onload=alert(1)>"u8));
        Assert.Null(MediaRules.Sniff("GIF89a"u8));
        Assert.Null(MediaRules.Sniff([]));
    }

    [Fact]
    public void AJpegLosesItsExifAndCommentsButKeepsItsPicture()
    {
        Assert.True(MediaRules.TryClean(Jpeg(), "image/jpeg", out var clean, out var w, out var h));
        Assert.Equal((640, 480), (w, h));
        Assert.False(Has(clean, "GPS"));
        Assert.False(Has(clean, "Exif"));
        Assert.False(Has(clean, "Ana"));
        Assert.True(Has(clean, "JFIF"));
        Assert.True(clean.Length < Jpeg().Length);
        // The scan, with its escaped FF00, is copied untouched.
        Assert.Equal(new byte[] { 0x12, 0x34, 0xFF, 0x00, 0x56, 0xFF, 0xD9 }, clean[^7..]);
        Assert.Equal("image/jpeg", MediaRules.Sniff(clean));
    }

    [Fact]
    public void ACleanJpegComesOutTheSame()
    {
        var plain = Jpeg(exif: false);
        Assert.True(MediaRules.TryClean(plain, "image/jpeg", out var clean, out _, out _));
        Assert.Equal(plain, clean);
    }

    [Fact]
    public void APngKeepsOnlyTheChunksThatDrawIt()
    {
        Assert.True(MediaRules.TryClean(Png(), "image/png", out var clean, out var w, out var h));
        Assert.Equal((64, 32), (w, h));
        Assert.False(Has(clean, "eXIf"));
        Assert.False(Has(clean, "tEXt"));
        Assert.True(Has(clean, "IDAT"));
        Assert.True(Has(clean, "IEND"));
        Assert.Equal(Png(text: false), clean);
    }

    [Fact]
    public void BrokenAndHugePicturesAreRefused()
    {
        var jpeg = Jpeg();
        Assert.False(MediaRules.TryClean(jpeg[..^2], "image/jpeg", out _, out _, out _));                  // no end marker
        Assert.False(MediaRules.TryClean(jpeg[..40], "image/jpeg", out _, out _, out _));                  // cut short
        Assert.False(MediaRules.TryClean([0xFF, 0xD8, 0xFF, 0xD9], "image/jpeg", out _, out _, out _));    // no size
        var png = Png();
        Assert.False(MediaRules.TryClean(png[..^12], "image/png", out _, out _, out _));                    // no IEND
        Assert.False(MediaRules.TryClean(png[..20], "image/png", out _, out _, out _));
        Assert.False(MediaRules.TryClean(Jpeg(9000, 100), "image/jpeg", out _, out _, out _));              // a side over 8000
        Assert.False(MediaRules.TryClean(Jpeg(6000, 6000), "image/jpeg", out _, out _, out _));             // 36 million pixels
        Assert.False(MediaRules.TryClean(Png(100000, 100000), "image/png", out _, out _, out _));
        Assert.True(MediaRules.TryClean(Jpeg(5000, 5000), "image/jpeg", out _, out _, out _));              // 25 million is allowed
    }

    [Fact]
    public void ACaptionWithContactDetailsIsRefused()
    {
        Assert.True(MediaRules.ValidCaption("  Our balcony on deck 9 ", out var clean));
        Assert.Equal("Our balcony on deck 9", clean);
        Assert.False(MediaRules.ValidCaption("write to me at ana@example.com", out _));
        Assert.False(MediaRules.ValidCaption("see https://example.com", out _));
        Assert.False(MediaRules.ValidCaption("call 555 123 4567", out _));
        Assert.False(MediaRules.ValidCaption(new string('a', MediaRules.MaxCaption + 1), out _));
        Assert.True(MediaRules.ValidCaption(null, out var none));
        Assert.Equal("", none);
    }

    [Theory]
    [InlineData("cabin", "balcony", true)]
    [InlineData("cabin", "", false)]
    [InlineData("cabin", "deck 9", false)]
    [InlineData("book", "3", true)]
    [InlineData("book", "cover", true)]
    [InlineData("book", "9", false)]
    [InlineData("book", "03", false)]
    [InlineData("postcard", "", true)]
    [InlineData("postcard", "1", false)]
    [InlineData("case", "LI-PC2-0001", true)]
    [InlineData("case", "", false)]
    [InlineData("case", "a b", false)]
    [InlineData("album", "x", false)]
    public void TheReferenceMustFitThePurpose(string purpose, string reference, bool ok) => Assert.Equal(ok, MediaRules.ValidRef(purpose, reference, out _));

    [Fact]
    public void OnlyCabinPicturesHaveAKind()
    {
        Assert.True(MediaRules.ValidKind("cabin", "obstruction", out _));
        Assert.False(MediaRules.ValidKind("cabin", "", out _));
        Assert.False(MediaRules.ValidKind("cabin", "selfie", out _));
        Assert.True(MediaRules.ValidKind("book", "", out _));
        Assert.False(MediaRules.ValidKind("book", "view", out _));
    }

    [Fact]
    public void ACabinPictureIsApprovedAfterTheWaitAndARejectionStays()
    {
        var t = new DateTime(2027, 1, 1, 12, 0, 0, DateTimeKind.Utc);
        Assert.Equal("pending", MediaRules.EffectiveStatus("pending", t, t.AddMinutes(MediaRules.ModerationMinutes - 1)));
        Assert.Equal("approved", MediaRules.EffectiveStatus("pending", t, t.AddMinutes(MediaRules.ModerationMinutes)));
        Assert.Equal("rejected", MediaRules.EffectiveStatus("rejected", t, t.AddDays(30)));
        Assert.Equal("approved", MediaRules.EffectiveStatus("approved", t, t));
    }

    [Fact]
    public void OnlyTheOwnerSeesAPictureUnlessItIsAnApprovedCabinPictureAndSharingIsOn()
    {
        Assert.True(MediaRules.MayView(1, 1, "book", "approved", false));
        Assert.False(MediaRules.MayView(1, 2, "book", "approved", true));
        Assert.False(MediaRules.MayView(1, 2, "postcard", "approved", true));
        Assert.False(MediaRules.MayView(1, 2, "cabin", "approved", false));
        Assert.False(MediaRules.MayView(1, 2, "cabin", "pending", true));
        Assert.True(MediaRules.MayView(1, 2, "cabin", "approved", true));
    }

    [Fact]
    public void TheLimitsAreTheOnesTheDocumentationStates()
    {
        Assert.Equal(2_000_000, MediaRules.MaxBytes);
        Assert.Equal(40, MediaRules.MaxCount);
        Assert.Equal(20_000_000, MediaRules.MaxTotalBytes);
        Assert.Equal(8000, MediaRules.MaxSide);
        Assert.Equal(25_000_000, MediaRules.MaxPixels);
        Assert.Equal(10, MediaRules.ModerationMinutes);
    }
}

public class MediaServiceTests
{
    private sealed class FixedClock(DateTime now) : IUserClock
    {
        public DateTime Now { get; set; } = now;
        public Task<DateTime> NowAsync(UserRecord user, CancellationToken ct) => Task.FromResult(Now);
    }

    private static readonly DateTime Start = new(2027, 3, 21, 12, 0, 0, DateTimeKind.Utc);
    private static readonly UserRecord Ana = new() { Id = 1, PublicId = Guid.NewGuid(), FirstName = "Ana" };
    private static readonly UserRecord Ben = new() { Id = 2, PublicId = Guid.NewGuid(), FirstName = "Ben" };

    private static (MediaService Svc, InMemoryMediaStore Store, FixedClock Clock) Make(bool showOthers = false)
    {
        var store = new InMemoryMediaStore();
        var clock = new FixedClock(Start);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Media:ShowOthers"] = showOthers ? "true" : "false" }).Build();
        return (new MediaService(store, clock, new SimMediaScanner(), config), store, clock);
    }

    private static Task<MediaDto> Cabin(MediaService s, UserRecord u, string caption = "Our room", byte[]? body = null) =>
        s.UploadAsync(u, "cabin", "balcony", "room", caption, body ?? MediaRulesTests.Jpeg(), default);

    [Fact]
    public async Task AnUploadIsCleanedBeforeItIsKept()
    {
        var (svc, store, _) = Make();
        var dto = await Cabin(svc, Ana);
        Assert.Equal("image/jpeg", dto.ContentType);
        Assert.Equal((640, 480), (dto.Width, dto.Height));
        Assert.Equal("pending", dto.Status);
        Assert.True(dto.Mine);
        var kept = Assert.Single(store.Items).Data;
        Assert.DoesNotContain("GPS", System.Text.Encoding.ASCII.GetString(kept));
    }

    [Fact]
    public async Task BookAndPostcardPicturesAreNotHeldForModeration()
    {
        var (svc, _, _) = Make();
        Assert.Equal("approved", (await svc.UploadAsync(Ana, "book", "3", null, "Day 3", MediaRulesTests.Png(), default)).Status);
        Assert.Equal("approved", (await svc.UploadAsync(Ana, "postcard", "", null, null, MediaRulesTests.Png(), default)).Status);
    }

    [Theory]
    [InlineData("album", "", "", "", "badPurpose")]
    [InlineData("cabin", "balcony", "room", "mail me@x.com", "badCaption")]
    [InlineData("cabin", "", "room", "", "badRef")]
    [InlineData("cabin", "balcony", "selfie", "", "badKind")]
    public async Task BadDetailsAreRefusedWithTheirCode(string purpose, string reference, string kind, string caption, string code)
    {
        var (svc, store, _) = Make();
        var e = await Assert.ThrowsAsync<ApiException>(() => svc.UploadAsync(Ana, purpose, reference, kind, caption, MediaRulesTests.Jpeg(), default));
        Assert.Equal(code, e.Title);
        Assert.Empty(store.Items);
    }

    [Fact]
    public async Task BadFilesAreRefusedWithTheirCode()
    {
        var (svc, store, _) = Make();
        async Task<string> Code(byte[] body) => (await Assert.ThrowsAsync<ApiException>(() => Cabin(svc, Ana, body: body))).Title;
        Assert.Equal("empty", await Code([]));
        Assert.Equal("size", await Code(new byte[MediaRules.MaxBytes + 1]));
        Assert.Equal("type", await Code("<html></html>"u8.ToArray()));
        Assert.Equal("unreadable", await Code(MediaRulesTests.Jpeg()[..30]));
        // The scanner's test string, hidden in a comment-free place: inside the scan data.
        var infected = MediaRulesTests.Jpeg(exif: false).ToList();
        infected.InsertRange(infected.Count - 2, System.Text.Encoding.ASCII.GetBytes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"));
        Assert.Equal("scan", await Code([.. infected]));
        Assert.Empty(store.Items);
    }

    [Fact]
    public async Task AChildCannotKeepPictures()
    {
        var (svc, store, _) = Make();
        var child = new UserRecord { Id = 3, PublicId = Guid.NewGuid(), IsSupervised = true };
        var e = await Assert.ThrowsAsync<ApiException>(() => Cabin(svc, child));
        Assert.Equal(403, e.Status);
        Assert.Empty(store.Items);
    }

    [Fact]
    public async Task TheAllowanceIsEnforced()
    {
        var (svc, store, _) = Make();
        for (var i = 0; i < MediaRules.MaxCount; i++) await svc.UploadAsync(Ana, "postcard", "", null, null, MediaRulesTests.Png(), default);
        var e = await Assert.ThrowsAsync<ApiException>(() => svc.UploadAsync(Ana, "postcard", "", null, null, MediaRulesTests.Png(), default));
        Assert.Equal("full", e.Title);
        Assert.Equal(MediaRules.MaxCount, store.Items.Count);
        var usage = await svc.UsageAsync(Ana, default);
        Assert.Equal(MediaRules.MaxCount, usage.Count);
        // Someone else's allowance is their own.
        await svc.UploadAsync(Ben, "postcard", "", null, null, MediaRulesTests.Png(), default);
    }

    [Fact]
    public async Task OtherGuestsSeeNothingByDefaultAndApprovedCabinPicturesWhenSharingIsOn()
    {
        var (off, store, clock) = Make();
        var mine = await Cabin(off, Ana);
        Assert.Empty(await off.CabinAsync(Ben, "balcony", default));
        Assert.Single(await off.CabinAsync(Ana, "balcony", default));
        await Assert.ThrowsAsync<ApiException>(() => off.OpenAsync(Ben, mine.Id, default));
        Assert.Equal("image/jpeg", (await off.OpenAsync(Ana, mine.Id, default)).ContentType);

        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Media:ShowOthers"] = "true" }).Build();
        var on = new MediaService(store, clock, new SimMediaScanner(), config);
        Assert.Empty(await on.CabinAsync(Ben, "balcony", default));          // still waiting for the moderator
        clock.Now = Start.AddMinutes(MediaRules.ModerationMinutes);
        var seen = Assert.Single(await on.CabinAsync(Ben, "balcony", default));
        Assert.False(seen.Mine);
        Assert.Equal("approved", seen.Status);
        Assert.Equal("image/jpeg", (await on.OpenAsync(Ben, mine.Id, default)).ContentType);
        Assert.Empty(await on.CabinAsync(Ben, "interior", default));          // another room type
    }

    [Fact]
    public async Task BookPicturesStayWithTheirOwnerEvenWhenSharingIsOn()
    {
        var (_, store, clock) = Make();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Media:ShowOthers"] = "true" }).Build();
        var on = new MediaService(store, clock, new SimMediaScanner(), config);
        var book = await on.UploadAsync(Ana, "book", "2", null, "", MediaRulesTests.Png(), default);
        await Assert.ThrowsAsync<ApiException>(() => on.OpenAsync(Ben, book.Id, default));
        Assert.Empty(await on.MineAsync(Ben, "book", default));
        Assert.Single(await on.MineAsync(Ana, "book", default));
    }

    [Fact]
    public async Task OnlyTheOwnerCanDelete()
    {
        var (svc, store, _) = Make();
        var dto = await Cabin(svc, Ana);
        await Assert.ThrowsAsync<ApiException>(() => svc.DeleteAsync(Ben, dto.Id, default));
        Assert.Single(store.Items);
        await svc.DeleteAsync(Ana, dto.Id, default);
        Assert.Empty(store.Items);
        await Assert.ThrowsAsync<ApiException>(() => svc.DeleteAsync(Ana, dto.Id, default));
    }
}
