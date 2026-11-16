namespace Princess.Api.Contracts;

/// <summary>Puts the guest's favourites in this order (the screen pins the guest has arranged). Keys not in the list keep their place after these.</summary>
public sealed record ReorderFavouritesRequest(List<string>? Keys);
