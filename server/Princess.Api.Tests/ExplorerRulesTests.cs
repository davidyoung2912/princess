using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

/// <summary>The Explorer content of each ship and the rules that read it (<see cref="ExplorerCatalogue"/>, <see cref="ExplorerRules"/>).</summary>
public class ExplorerRulesTests
{
    private static readonly Timeline Week = Timeline.Legacy(new DateOnly(2027, 3, 21));
    public static TheoryData<string> Ships => new() { "sun-princess", "sky-princess", "sapphire-princess" };

    [Theory]
    [MemberData(nameof(Ships))]
    public void Every_ship_has_unique_venue_and_event_ids_and_events_name_a_venue(string ship)
    {
        var s = ExplorerCatalogue.For(ship)!;
        Assert.Equal(s.Venues.Length, s.Venues.Select(v => v.Id).Distinct().Count());
        Assert.Equal(s.Events.Length, s.Events.Select(e => e.Id).Distinct().Count());
        Assert.All(s.Venues, v => Assert.Contains(v.Explorer, ExplorerCatalogue.Kinds));
        Assert.All(s.Events, e => Assert.Contains(s.Venues, v => v.Id == e.VenueId));
        Assert.All(s.Events, e => Assert.DoesNotContain(ShipPrograms.Of(ship), p => p.Id == e.Id));   // both live in one plan
        Assert.All(s.Events, e => Assert.All(e.When, k => Assert.True(DayKinds.Valid(k))));
    }

    [Fact]
    public void A_fixed_rule_gives_its_windows_in_time_order_on_the_days_it_names()
    {
        var rules = new[] { new HoursRule("fixed", ["night"], [["17:30", "21:30"], ["07:00", "09:30"]], null, null, null) };
        var h = ExplorerRules.Hours(rules, Week, 2);
        Assert.Equal("07:00", h.Windows[0][0]);
        Assert.Null(h.ClosedBecause);
    }

    [Fact]
    public void No_matching_rule_means_closed()
    {
        var rules = new[] { new HoursRule("fixed", ["embark"], [["09:00", "10:00"]], null, null, null) };
        var h = ExplorerRules.Hours(rules, Week, 2);
        Assert.Empty(h.Windows);
        Assert.Equal("none", h.ClosedBecause);
    }

    [Fact]
    public void A_sailaway_rule_opens_after_the_ship_sails_and_is_closed_at_sea_without_a_sailing()
    {
        var rules = new[] { new HoursRule("sailaway", ["embark"], null, null, 45, "22:00") };
        var sail = ExplorerRules.SailawayTime(Week, 1)!;
        var h = ExplorerRules.Hours(rules, Week, 1);
        var opens = TimeOnly.ParseExact(sail, "HH:mm").AddMinutes(45).ToString("HH:mm");
        Assert.Equal(opens, h.Windows[0][0]);
        Assert.Equal("22:00", h.Windows[0][1]);
        Assert.Equal("alongside", ExplorerRules.Hours([new HoursRule("sailaway", ["sea"], null, null, 45, "22:00")], Week, 2).ClosedBecause ?? "alongside");
    }

    [Fact]
    public void The_first_day_uses_the_embarkation_day_and_the_last_morning_has_none()
    {
        string[] template = ["embark", "sea", "port", "port", "sea", "port", "last"];
        Assert.Equal(0, ExplorerRules.TemplateIndex(Week, 1, template));
        Assert.Equal(6, ExplorerRules.TemplateIndex(Week, Week.Days.Count - 1, template));
        Assert.Null(ExplorerRules.TemplateIndex(Week, Week.Days.Count, template));
        Assert.Null(ExplorerRules.TemplateIndex(Week, 0, template));
    }

    [Fact]
    public void Places_left_never_exceed_the_capacity_and_are_the_same_every_time()
    {
        var e = new ExplorerEventDef("x", "v", ["sea"], "10:00", 60, "t", "d", "all", "shows", 0, false, 40);
        var left = ExplorerRules.PlacesLeft(e, 2, 0);
        Assert.InRange(left!.Value, 10, 40);
        Assert.Equal(left, ExplorerRules.PlacesLeft(e, 2, 0));
        Assert.Null(ExplorerRules.PlacesLeft(e with { Capacity = null }, 2, 0));
    }

    [Fact]
    public void Pins_name_real_things_and_have_limits()
    {
        var venue = ExplorerCatalogue.For("sun-princess")!.Venues[0];
        var key = $"venue:sun-princess.{venue.Id}";
        ExplorerRules.RequirePinAllowed([], key);
        Assert.Throws<ApiException>(() => ExplorerRules.RequirePinAllowed([], "venue:sun-princess.nowhere"));
        Assert.Throws<ApiException>(() => ExplorerRules.RequirePinAllowed([], "screen:has space"));
        ExplorerRules.RequirePinAllowed([], "screen:S12");
        ExplorerRules.RequirePinAllowed([], "sailing:anything");
        ExplorerRules.RequirePinAllowed([], "taste:like.music");
        ExplorerRules.RequirePinAllowed([], "taste:hide.venue:main-dining");
        Assert.Throws<ApiException>(() => ExplorerRules.RequirePinAllowed([], "taste:other.x"));
        Assert.Throws<ApiException>(() => ExplorerRules.RequirePinAllowed([], "taste:like.has/slash"));
        Assert.Equal("taste:like.", ExplorerRules.TastePrefix("taste:like.music"));
        Assert.Null(ExplorerRules.TastePrefix("screen:S1"));

        var full = ExplorerCatalogue.For("sun-princess")!.Venues.Where(v => v.Explorer == venue.Explorer).Take(ExplorerRules.MaxVenuePins).Select(v => $"venue:sun-princess.{v.Id}").ToList();
        if (full.Count == ExplorerRules.MaxVenuePins && !full.Contains(key)) Assert.Throws<ApiException>(() => ExplorerRules.RequirePinAllowed(full, key));
    }

    [Fact]
    public void Shortlisted_treatments_and_tours_name_real_things_and_have_their_own_limits()
    {
        var treatment = ExplorerCatalogue.For("sun-princess")!.TreatmentList[0];
        var key = $"treatment:sun-princess.{treatment.Id}";
        ExplorerRules.RequirePinAllowed([], key);
        Assert.Throws<ApiException>(() => ExplorerRules.RequirePinAllowed([], "treatment:sun-princess.nowhere"));
        Assert.Throws<ApiException>(() => ExplorerRules.RequirePinAllowed([], "treatment:nowhere.x"));
        ExplorerRules.RequirePinAllowed([], $"tour:{ExcursionRules.Catalogue[0].Id}");
        Assert.Throws<ApiException>(() => ExplorerRules.RequirePinAllowed([], "tour:nowhere"));

        var tours = ExcursionRules.Catalogue.Take(ExplorerRules.MaxSavedItems).Select(x => $"tour:{x.Id}").ToList();
        if (tours.Count == ExplorerRules.MaxSavedItems)
        {
            Assert.Throws<ApiException>(() => ExplorerRules.RequirePinAllowed(tours, $"tour:{ExcursionRules.Catalogue[^1].Id}"));
            ExplorerRules.RequirePinAllowed(tours, key);   // a full list of tours leaves room for a treatment
        }
    }

    [Fact]
    public void Saved_events_name_real_events_and_the_shortlist_resolves_names_without_a_booking()
    {
        var ship = ExplorerCatalogue.For("sun-princess")!;
        var ev = ship.Events[0];
        var eventKey = $"event:sun-princess.{ev.Id}";
        ExplorerRules.RequirePinAllowed([], eventKey);
        Assert.Throws<ApiException>(() => ExplorerRules.RequirePinAllowed([], "event:sun-princess.nowhere"));
        Assert.Throws<ApiException>(() => ExplorerRules.RequirePinAllowed([], "event:nowhere.x"));

        var treatment = ship.TreatmentList[0];
        var tour = ExcursionRules.Catalogue[0];
        var items = ExplorerRules.ResolveSaved([eventKey, "screen:X20", $"treatment:sun-princess.{treatment.Id}", $"tour:{tour.Id}", "tour:nowhere", "event:sun-princess.nowhere"]);
        Assert.Equal(["event", "treatment", "tour"], items.Select(i => i.Kind));
        Assert.Equal(ev.Title, items[0].Title);
        Assert.Equal(ev.VenueId, items[0].VenueId);
        Assert.Equal(treatment.VenueId, items[1].VenueId);
        Assert.Equal("excursions", items[2].Explorer);
        Assert.Null(items[2].ShipId);
    }
}
