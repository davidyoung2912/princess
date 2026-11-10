using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// What a guest can share into a chat (docs/chat-features-research.md, phase 3). The list is built from the guest's own current or next confirmed booking (the same one Stanley reads), and a card
/// is rebuilt from that data when it is sent: the client names a <c>ref</c> from the list and never supplies the words, so a card cannot say more than the server knows to be true and carries no price, folio line, cabin or booking number.
/// A place card names a place from the ship profile.
/// </summary>
public sealed class ChatShareService(ITripStore trips, IPlanStore plan, IUserClock clock)
{
    private const string BookingRef = "booking";

    private async Task<BookingRow?> CurrentAsync(UserRecord actor, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(await clock.NowAsync(actor, ct));
        return (await trips.ListForUserAsync(actor.Id, ct))
            .Where(b => b.Status == "confirmed" && DateOnly.FromDateTime(b.Departure).AddDays(b.Nights) >= today).OrderBy(b => b.Departure).FirstOrDefault();
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
        return new(items, places);
    }

    /// <summary>Every card the booking can make, keyed by its ref: the booking itself, each booked excursion and dinner, and each port day.</summary>
    private async Task<List<(string Ref, ChatCard Card)>> CardsAsync(BookingRow booking, CancellationToken ct)
    {
        var list = new List<(string, ChatCard)> { (BookingRef, new ChatCard(ChatCardRules.Booking, booking.SailingTitle, $"{booking.ShipName}, {booking.Nights} nights", Path: ChatCardRules.PathOf(ChatCardRules.Booking))) };
        foreach (var t in (await plan.ListToursAsync(booking.BookingId, ct)).Where(x => x.Status == "booked"))
            if (ExcursionRules.ById(t.ExcursionId) is { } e)
                list.Add(($"{ChatCardRules.Excursion}:{t.PublicId}", new ChatCard(ChatCardRules.Excursion, e.Name, Itinerary.PortOf(e.Port)?.Name, t.Day, e.Start, e.Meeting, ChatCardRules.PathOf(ChatCardRules.Excursion))));
        foreach (var t in await plan.ListTablesAsync(booking.BookingId, ct))
        {
            var venue = DiningRules.VenueById(t.VenueId);
            list.Add(($"{ChatCardRules.Dining}:{t.PublicId}", new ChatCard(ChatCardRules.Dining, venue?.Name ?? "Dinner", venue?.Cuisine, t.Day, t.Time, venue?.Deck, ChatCardRules.PathOf(ChatCardRules.Dining))));
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
        if (string.IsNullOrWhiteSpace(shareRef) || await CurrentAsync(actor, ct) is not { } booking) throw ApiException.Invalid("shareRef");
        var found = (await CardsAsync(booking, ct)).FirstOrDefault(c => c.Ref == shareRef);
        return found.Card ?? throw ApiException.Invalid("shareRef");
    }

    /// <summary>A "Meet me here" card for a named place on the ship, good for <see cref="ChatCardRules.PlaceLife"/> from <paramref name="now"/>. 400 <c>place</c> for a place the ship profile does not name.</summary>
    public static ChatCard Place(string? placeId, string? note, DateTime now)
    {
        var place = ShipReference.Get().Places.FirstOrDefault(p => p.Id == placeId) ?? throw ApiException.Invalid("place");
        return new ChatCard(ChatCardRules.PlaceType, place.Name, $"Deck {place.Deck}, {place.Section}", Place: place.Name, ExpiresAt: Shipboard.Ms(ChatCardRules.PlaceExpiry(now)), Note: ChatCardRules.CleanNote(note));
    }
}
