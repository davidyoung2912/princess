using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// What a guest can share into a chat (docs/chat-features-research.md, phase 3). The list is built from the guest's own current or next confirmed booking (the same one Stanley reads), and a card
/// is rebuilt from that data when it is sent: the client names a <c>ref</c> from the list and never supplies the words, so a card cannot say more than the server knows to be true and carries no price, folio line, cabin or booking number.
/// A place card names a place from the ship profile.
/// </summary>
public sealed class ChatShareService(ITripStore trips, IPlanStore plan, IUserClock clock, IOnboardStore? onboard = null)
{
    private const string BookingRef = "booking";

    private async Task<BookingRow?> CurrentAsync(UserRecord actor, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(await clock.NowAsync(actor, ct));
        return (await trips.ListForUserAsync(actor.Id, ct))
            .Where(b => b.Status == "confirmed" && DateOnly.FromDateTime(b.Departure).AddDays(b.Nights) >= today).OrderBy(b => b.Departure).FirstOrDefault();
    }

    /// <summary>Today's cruise day for the guest's current booking, in ship time (0 when there is none or the ship has not sailed). Used to repeat the check behind a shared Stanley card.</summary>
    public async Task<int> CruiseDayAsync(UserRecord actor, DateTime now, CancellationToken ct) =>
        await CurrentAsync(actor, ct) is { } booking ? FolioRules.CruiseDay(TimelineBook.For(booking.SailingId, DateOnly.FromDateTime(booking.Departure)), now) : 0;

    /// <summary>The sailing of the guest's current booking, or null: used to show a hand-over's sender only to a guest on the same sailing.</summary>
    public async Task<string?> SailingOfAsync(UserRecord actor, CancellationToken ct) => (await CurrentAsync(actor, ct))?.SailingId;

    /// <summary>Phase B5: the number of days of the guest's current sailing (0 without one), for a time poll's slots.</summary>
    public async Task<int> SailingDaysAsync(UserRecord actor, CancellationToken ct) =>
        await CurrentAsync(actor, ct) is { } booking ? TimelineBook.For(booking.SailingId, DateOnly.FromDateTime(booking.Departure)).Days.Count : 0;

    /// <summary>Phase B5: the indexes of the slots that overlap something on the guest's own programme. Computed for the reader only; the poll never stores or shows anyone's clashes to others.</summary>
    public async Task<List<int>> SlotClashesAsync(UserRecord actor, IReadOnlyList<string> slots, CancellationToken ct)
    {
        var result = new List<int>();
        if (onboard is null || await CurrentAsync(actor, ct) is not { } booking) return result;
        var busy = new List<(int, string, int)>();
        foreach (var row in await onboard.ListPlanAsync(actor.Id, booking.SailingId, ct))
            if (ProgramRules.ById(row.EventId, AboardPlans.ShipOfSailing(booking.SailingId)) is { } ev) busy.Add((row.Day, ev.Start, ev.Minutes));
        for (var i = 0; i < slots.Count; i++) if (ChatPlanningRules.SlotClashes(slots[i], busy)) result.Add(i);
        return result;
    }

    private static string Clock(TimeOnly t) => t.ToString("HH:mm");

    /// <summary>The booking's own things the guest can send, with a ref for each, and the named places a meeting point can be dropped at.</summary>
    public async Task<ChatShareableListDto> ListAsync(UserRecord actor, CancellationToken ct)
    {
        var places = ShipReference.Get().Places.Select(p => new ChatPlaceDto(p.Id, p.Name, p.Deck, p.Section)).OrderBy(p => p.Name, StringComparer.Ordinal).ToList();
        var items = new List<ChatShareableDto>();
        if (await CurrentAsync(actor, ct) is { } booking)
        {
            foreach (var (id, card) in await CardsAsync(booking, ct)) items.Add(new ChatShareableDto(id, card.Type, card.Title, card.Subtitle, card.Day, card.Time));
        }
        return new(items, places, await EventsAsync(actor, ct));
    }

    /// <summary>The events a plan can be made of: each programme event and each Explorer event on each day the guest's own sailing runs it, by day and time. Empty without a current booking.</summary>
    private async Task<List<ChatPlannableDto>> EventsAsync(UserRecord actor, CancellationToken ct)
    {
        var list = new List<ChatPlannableDto>();
        if (await CurrentAsync(actor, ct) is not { } booking) return list;
        var ship = AboardPlans.ShipOfSailing(booking.SailingId);
        var timeline = TimelineBook.For(booking.SailingId, DateOnly.FromDateTime(booking.Departure));
        var explorer = ExplorerCatalogue.Of(ship);
        for (var day = 1; day <= timeline.Days.Count && day <= Itinerary.MaxDay; day++)
        {
            var dayList = ProgramRules.On(timeline, day, false, [], ship)
                .Select(e => new ChatPlannableDto(ChatPlanningRules.PlanRef(e.Id, day), e.Title, day, e.Start, ProgramRules.PlaceName(e.PlaceId) is { Length: > 0 } place ? place : null)).ToList();
            foreach (var e in ExplorerRules.EventsOn(explorer, timeline, day, false, []))
                dayList.Add(new ChatPlannableDto(ChatPlanningRules.PlanRef(e.Id, day), e.Title, day, e.Start, explorer.Venues.FirstOrDefault(v => v.Id == e.VenueId)?.Title));
            // Excursions on a port day and dinners on a dinner day: asked and answered like any plan, but booked by each person on the normal screen.
            foreach (var x in ExcursionRules.Catalogue.Where(x => timeline.Days.Any(d => d.Day == day && d.Port == x.Port && d.Arrive is not null)))
                dayList.Add(new ChatPlannableDto(ChatPlanningRules.PlanRef(ChatPlanningRules.TourEventId(x.Id), day), x.Name, day, x.Start, Itinerary.PortOf(x.Port)?.Name));
            if (DiningRules.IsDinnerDay(timeline, day))
                foreach (var v in ShipDining.VenuesOf(ship).Where(v => !v.WalkIn))
                    dayList.Add(new ChatPlannableDto(ChatPlanningRules.PlanRef(ChatPlanningRules.DinnerEventId(v.Id, DefaultDinnerTime), day), DinnerTitle(v), day, DefaultDinnerTime, v.Deck));
            list.AddRange(dayList.OrderBy(x => x.Time, StringComparer.Ordinal));
        }
        return list;
    }

    /// <summary>An event a plan can be made of, from the daily programme or from one of the Explorers (both go in the same plan): its title, start, the words for its place and the screen it opens, and the kinds of day it runs.</summary>
    private sealed record Plannable(string Id, string Title, string Start, string? Place, string[] When, string? Path);

    private const string DefaultDinnerTime = "19:00";

    private static string DinnerTitle(Venue v) => $"Dinner at {v.Name}";

    /// <summary>
    /// An excursion or a dinner that a plan can ask the group about. It has no programme times of its own (<c>When</c> is empty): <see cref="ProgrammeSailingAsync"/> checks the day against the itinerary instead, and answering never books anything.
    /// </summary>
    private static Plannable? BookedPlanOn(string? shipId, string eventId)
    {
        if (ChatPlanningRules.ParseTourEvent(eventId) is { } tourId && ExcursionRules.ById(tourId) is { } tour)
            return new(eventId, tour.Name, tour.Start, tour.Meeting, [], ChatCardRules.PathOf(ChatCardRules.Excursion));
        if (ChatPlanningRules.ParseDinnerEvent(eventId) is { } dinner && ShipDining.VenueOn(shipId, dinner.VenueId) is { WalkIn: false } venue && DiningRules.DinnerTimes.Contains(dinner.Time))
            return new(eventId, DinnerTitle(venue), dinner.Time, venue.Deck, [], ChatCardRules.PathOf(ChatCardRules.Dining));
        return null;
    }

    private static Plannable? PlannableOn(string? shipId, string eventId)
    {
        if (ChatPlanningRules.IsBookingPlan(eventId)) return BookedPlanOn(shipId, eventId);
        if (ProgramRules.ById(eventId, shipId) is { } ev)
            return new(ev.Id, ev.Title, ev.Start, ProgramRules.PlaceName(ev.PlaceId) is { Length: > 0 } place ? place : null, ev.When, null);
        if (ExplorerCatalogue.EventOn(shipId, eventId) is { } x && ExplorerCatalogue.VenueOn(shipId, x.VenueId) is { } venue)
            return new(x.Id, x.Title, x.Start, venue.Title, x.When, ExplorerCatalogue.VenuePath(venue));
        return null;
    }

    /// <summary>
    /// The sailing whose programme (or Explorers) the event can go on for this guest on this day, or null: no current booking, an event their ship does not run, or a day it does not run. A plan is made, and answered Going, only where this is not null.
    /// </summary>
    public async Task<string?> ProgrammeSailingAsync(UserRecord actor, string eventId, int day, CancellationToken ct)
    {
        if (await CurrentAsync(actor, ct) is not { } booking) return null;
        if (PlannableOn(AboardPlans.ShipOfSailing(booking.SailingId), eventId) is not { } ev) return null;
        var timeline = TimelineBook.For(booking.SailingId, DateOnly.FromDateTime(booking.Departure));
        if (day < 1 || day > timeline.Days.Count) return null;
        if (ChatPlanningRules.ParseTourEvent(eventId) is { } tourId) return ExcursionRules.ById(tourId) is { } tour && timeline.Days.Any(d => d.Day == day && d.Port == tour.Port && d.Arrive is not null) ? booking.SailingId : null;
        if (ChatPlanningRules.IsBookingPlan(eventId)) return DiningRules.IsDinnerDay(timeline, day) ? booking.SailingId : null;
        return DayKinds.Runs(timeline, day, ev.When) ? booking.SailingId : null;
    }

    /// <summary>
    /// A plan card for an event on a day (<paramref name="shareRef"/> is <c>eventId:day</c>; a programme event from the plannable list, or an Explorer event from its venue page), built from the ship's own data: its title, day, time and place, and a short note.
    /// An Explorer event's card opens its venue page. 400 <c>shareRef</c> when the guest's own sailing does not run it that day.
    /// </summary>
    public async Task<ChatCard> PlanAsync(UserRecord actor, string? shareRef, string? note, CancellationToken ct)
    {
        var (eventId, day) = ChatPlanningRules.ParsePlanRef(shareRef) ?? throw ApiException.Invalid("shareRef");
        if (await ProgrammeSailingAsync(actor, eventId, day, ct) is not { } sailing) throw ApiException.Invalid("shareRef");
        var ev = PlannableOn(AboardPlans.ShipOfSailing(sailing), eventId)!;
        return new ChatCard(ChatCardRules.Plan, ev.Title, null, day, ev.Start, ev.Place, Path: ev.Path, Note: ChatCardRules.CleanNote(note), EventId: ev.Id);
    }

    /// <summary>A venue card for a place in one of the Explorers on the guest's own ship: its name, kind and deck, opening its venue page. 400 <c>shareRef</c> for a venue the guest's ship does not have or when there is no current booking.</summary>
    private async Task<ChatCard> VenueCardAsync(UserRecord actor, string venueId, CancellationToken ct)
    {
        if (await CurrentAsync(actor, ct) is not { } booking || ExplorerCatalogue.VenueOn(AboardPlans.ShipOfSailing(booking.SailingId), venueId) is not { } venue) throw ApiException.Invalid("shareRef");
        return new ChatCard(ChatCardRules.Venue, venue.Title, venue.Short, Place: venue.DeckLabel, Path: ExplorerCatalogue.VenuePath(venue));
    }

    private static readonly Dictionary<string, string> MealWords = new() { ["breakfast"] = "Breakfast", ["brunch"] = "Brunch", ["lunch"] = "Lunch", ["tea"] = "Afternoon tea", ["dinner"] = "Dinner", ["allDay"] = "All-day" };

    /// <summary>A menu card for a meal a restaurant on the guest's own ship serves: the restaurant's name and "Dinner menu", opening its venue page. 400 <c>shareRef</c> for a restaurant or meal the ship does not have, or when there is no current booking.</summary>
    private async Task<ChatCard> MenuCardAsync(UserRecord actor, string venueId, string meal, CancellationToken ct)
    {
        if (await CurrentAsync(actor, ct) is not { } booking) throw ApiException.Invalid("shareRef");
        var ship = AboardPlans.ShipOfSailing(booking.SailingId);
        if (ExplorerCatalogue.VenueOn(ship, venueId) is not { } venue || !MealWords.TryGetValue(meal, out var words) || !ExplorerCatalogue.Of(ship).Menus.Any(m => m.VenueId == venue.Id && m.Meal == meal)) throw ApiException.Invalid("shareRef");
        return new ChatCard(ChatCardRules.Menu, venue.Title, $"{words} menu", Place: venue.DeckLabel, Path: ExplorerCatalogue.VenuePath(venue));
    }

    /// <summary>Every card the booking can make, keyed by its ref: the booking itself, each booked excursion and dinner, and each port day.</summary>
    private async Task<List<(string Ref, ChatCard Card)>> CardsAsync(BookingRow booking, CancellationToken ct)
    {
        var list = new List<(string, ChatCard)> { (BookingRef, new ChatCard(ChatCardRules.Booking, booking.SailingTitle, $"{booking.ShipName}, {booking.Nights} nights", Path: ChatCardRules.PathOf(ChatCardRules.Booking))) };
        foreach (var t in (await plan.ListToursAsync(booking.BookingId, ct)).Where(x => x.Status == "booked"))
            if (ExcursionRules.ById(t.ExcursionId) is { } e)
                list.Add(($"{ChatCardRules.Excursion}:{t.PublicId}", new ChatCard(ChatCardRules.Excursion, e.Name, Itinerary.PortOf(e.Port)?.Name, t.Day, e.Start, e.Meeting, ChatCardRules.PathOf(ChatCardRules.Excursion), Ref: t.PublicId)));
        foreach (var t in await plan.ListTablesAsync(booking.BookingId, ct))
        {
            var venue = DiningRules.VenueById(t.VenueId);
            list.Add(($"{ChatCardRules.Dining}:{t.PublicId}", new ChatCard(ChatCardRules.Dining, venue?.Name ?? "Dinner", venue?.Cuisine, t.Day, t.Time, venue?.Deck, ChatCardRules.PathOf(ChatCardRules.Dining), Ref: t.PublicId)));
        }
        var timeline = TimelineBook.For(booking.SailingId, DateOnly.FromDateTime(booking.Departure));
        foreach (var d in timeline.Days.Where(d => d.Arrive is not null && Itinerary.PortOf(d.Port) is not null))
        {
            var port = Itinerary.PortOf(d.Port)!;
            list.Add(($"{ChatCardRules.PortDay}:{d.Day}", new ChatCard(ChatCardRules.PortDay, port.Name, d.AllAboard is { } back ? $"All aboard {Clock(back)}" : null, d.Day, Clock(d.Arrive!.Value), Path: ChatCardRules.PathOf(ChatCardRules.PortDay, port.Id))));
        }
        return list;
    }

    /// <summary>The card for a ref from <see cref="ListAsync"/>, rebuilt from the guest's own booking. 400 <c>shareRef</c> for anything that is not theirs, not booked any more, or not a ref.</summary>
    public async Task<ChatCard> CardAsync(UserRecord actor, string? shareRef, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(shareRef)) throw ApiException.Invalid("shareRef");
        if (ChatCardRules.ParseVenueRef(shareRef) is { } venueId) return await VenueCardAsync(actor, venueId, ct);
        if (ChatCardRules.ParseMenuRef(shareRef) is { } menu) return await MenuCardAsync(actor, menu.VenueId, menu.Meal, ct);
        if (await CurrentAsync(actor, ct) is not { } booking) throw ApiException.Invalid("shareRef");
        var found = (await CardsAsync(booking, ct)).FirstOrDefault(c => c.Ref == shareRef);
        return found.Card ?? throw ApiException.Invalid("shareRef");
    }

    /// <summary>
    /// A bundle (docs/chat-bundles-plan.md, phase B1) for a ref: a venue or a menu from the guest's own ship, rebuilt here from the ship's data and carrying only a title, subtitle, place and screen. The sender supplies the ref and a short note, never the words.
    /// 400 <c>shareRef</c> for a ref of no known type, a venue or meal the ship does not have, or when there is no current booking.
    /// </summary>
    public async Task<ChatBundle> BundleAsync(UserRecord actor, string? shareRef, string? note, CancellationToken ct)
    {
        var type = ChatBundleRules.TypeOfRef(shareRef) ?? throw ApiException.Invalid("shareRef");
        var card = type == ChatBundleRules.Venue && ChatCardRules.ParseVenueRef(shareRef) is { } venueId ? await VenueCardAsync(actor, venueId, ct)
            : type == ChatBundleRules.Menu && ChatCardRules.ParseMenuRef(shareRef) is { } menu ? await MenuCardAsync(actor, menu.VenueId, menu.Meal, ct)
            : type == ChatBundleRules.Event && ChatBundleRules.PlanRefOf(shareRef) is { } planRef && ChatPlanningRules.ParsePlanRef(planRef) is not null ? await PlanAsync(actor, planRef, null, ct)
            : throw ApiException.Invalid("shareRef");
        if (type == ChatBundleRules.Event) type = ChatBundleRules.TypeOfEvent(ChatPlanningRules.ParsePlanRef(ChatBundleRules.PlanRefOf(shareRef))!.Value.EventId);
        return ChatBundleRules.FromCard(type, shareRef!, card, note);
    }

    /// <summary>Which of the cards' sources are still booked, in one query; a card whose source was cancelled after it was sent reads "No longer available".</summary>
    public Task<HashSet<Guid>> StillBookedAsync(IEnumerable<ChatCard?> cards, CancellationToken ct) => plan.ListStillBookedAsync([.. ChatCardRules.SourceIds(cards)], ct);

    /// <summary>A "Meet me here" card for a named place on the ship, good for <see cref="ChatCardRules.PlaceLife"/> from <paramref name="now"/>. 400 <c>place</c> for a place the ship profile does not name.</summary>
    public static ChatCard Place(string? placeId, string? note, DateTime now)
    {
        var place = ShipReference.Get().Places.FirstOrDefault(p => p.Id == placeId) ?? throw ApiException.Invalid("place");
        return new ChatCard(ChatCardRules.PlaceType, place.Name, $"Deck {place.Deck}, {place.Section}", Place: place.Name, ExpiresAt: Shipboard.Ms(ChatCardRules.PlaceExpiry(now)), Note: ChatCardRules.CleanNote(note));
    }
}
