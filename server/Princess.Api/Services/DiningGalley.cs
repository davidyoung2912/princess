using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>What the dining operation has said about one request.</summary>
public sealed record GalleyAnswer(string Status);

/// <summary>
/// The galley's side of a dietary request (DIN-112, 120): has the venue received it, is it being reviewed, is it confirmed, can it not be met, do staff need to speak with the guest.
/// A real dining system replaces <see cref="DiningGalley"/> behind this interface by registration, with no change to the service or the front end.
/// </summary>
public interface IDiningGalley
{
    GalleyAnswer Answer(DietaryRequestRow request, DateTime now);
}

/// <summary>The simulated galley: answers by how long ago the request was sent (<see cref="DietaryRules.StatusAt"/>).</summary>
public sealed class DiningGalley : IDiningGalley
{
    public GalleyAnswer Answer(DietaryRequestRow request, DateTime now) => new(DietaryRules.StatusAt(request.Kind, request.Note, request.SentAt, now));
}
