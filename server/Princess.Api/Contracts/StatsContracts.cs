namespace Princess.Api.Contracts;

/// <summary>One number or fact on the stats page. <c>Joke</c> marks a made-up one: the screen labels it so nobody mistakes it for data. <c>Route</c> is set when the value is a screen's path, which the screen shows by that screen's title.</summary>
public sealed record StatItem(string Id, string Label, string Value, string? Note, bool Joke, string? Route);

/// <summary>A group of stats about one part of the app. A section with <c>Joke</c> true holds nothing but made-up stats.</summary>
public sealed record StatSection(string Id, string Title, string Blurb, string Icon, bool Joke, List<StatItem> Stats);

/// <summary>Everything the stats page shows. <c>Highlights</c> are the ids of the stats worth leading with.</summary>
public sealed record StatsReport(long GeneratedAt, string Name, string Headline, int RealCount, int JokeCount, List<string> Highlights, List<StatSection> Sections);

/// <summary>What a device saw the guest do since the last report: counters to add (keys of a fixed shape) and the day, as the device saw it (yyyy-MM-dd).</summary>
public sealed record TrackStatsRequest(string? Day, Dictionary<string, long>? Counters);
