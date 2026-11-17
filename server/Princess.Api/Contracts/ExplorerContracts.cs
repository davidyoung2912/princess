namespace Princess.Api.Contracts;

/// <summary>Puts the guest's favourites in this order (the screen pins the guest has arranged). Keys not in the list keep their place after these.</summary>
public sealed record ReorderFavouritesRequest(List<string>? Keys);

/// <summary>One saved item of the shortlist with its name. <c>Kind</c> is venue, treatment, event or tour; <c>Explorer</c> is the Explorer it belongs to; <c>VenueId</c> is the place it is at (none for a tour); <c>ShipId</c> is the ship it is on (none for a tour).</summary>
public sealed record SavedItemView(string Key, string Kind, string Title, string Explorer, string ItemId, string? VenueId, string? ShipId);
