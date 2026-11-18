using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The Journey Guide for the signed-in guest (docs/next-steps-guidance-plan.md): gathers the facts the stage, the trip, the checklist and the booking draft already hold and hands them to
/// <see cref="GuideRules"/>. It holds no rules of its own and stores nothing.
/// </summary>
public sealed class GuideService(ContextService context, ICurrentUser me, TripService trips, PlanService plan, ITripStore tripStore, IOnboardStore onboard, IInboxStore inbox, IBookingStore bookings, IUserClock clock, IStateStore state, CheckinService checkin, DisembarkService disembark)
{
    public async Task<GuideView> GetAsync(CancellationToken ct)
    {
        var user = await me.LoadAsync(ct);
        var ctx = await context.GetAsync(ct);
        var now = await clock.NowAsync(user, ct);
        var today = TripRules.Today(now);

        var saved = (await inbox.ListFavouritesAsync(user.Id, ct)).Count(k => k.StartsWith("sailing:", StringComparison.Ordinal));
        var draft = await bookings.GetDraftAsync(user.Id, ct);
        var feedback = (await inbox.ListFeedbackAsync(user.Id, ct)).Count > 0;

        GuideTrip? trip = null;
        var lastFullDay = false;
        if (ctx.Booking is not null || ctx.Stage is not (StageRules.Dream or StageRules.Discover or StageRules.Book))
            (trip, lastFullDay) = await TripFactsAsync(user, ctx, now, today, ct);

        var facts = new GuideFacts(ctx.Stage, today, saved, draft is null ? null : new GuideDraft(draft.Id, !string.IsNullOrEmpty(draft.CategoryId)), trip, lastFullDay, feedback, await ChoicesAsync(user.Id, ct), await FitAsync(user.Id, ct));
        return GuideRules.Build(facts);
    }

    /// <summary>The guest's own put-aside choices (the <c>guideChoices</c> document); an unreadable one counts as none.</summary>
    private async Task<GuideChoices> ChoicesAsync(long userId, CancellationToken ct)
    {
        var row = await state.GetAsync(false, userId, "guideChoices", ct);
        if (row is null) return GuideChoices.None;
        try { return GuideRules.ReadChoices(System.Text.Json.Nodes.JsonNode.Parse(row.Json) as System.Text.Json.Nodes.JsonObject); }
        catch (System.Text.Json.JsonException) { return GuideChoices.None; }
    }

    /// <summary>The guest's answers to "make this plan fit me" (the <c>guideFit</c> document); an unreadable one counts as none.</summary>
    private async Task<GuideFit> FitAsync(long userId, CancellationToken ct)
    {
        var row = await state.GetAsync(false, userId, "guideFit", ct);
        if (row is null) return GuideFit.None;
        try { return GuideRules.ReadFit(System.Text.Json.Nodes.JsonNode.Parse(row.Json) as System.Text.Json.Nodes.JsonObject); }
        catch (System.Text.Json.JsonException) { return GuideFit.None; }
    }

    private async Task<(GuideTrip?, bool)> TripFactsAsync(UserRecord user, ContextDto ctx, DateTime now, DateOnly today, CancellationToken ct)
    {
        var all = (await trips.ListAsync(user, ct)).Upcoming;
        var view = all.FirstOrDefault(x => x.Kind == "current") ?? all.FirstOrDefault();
        if (view is null) return (null, false);

        var checklist = new Dictionary<string, GuideCheck>();
        if (view.Kind != "linked")
        {
            try
            {
                foreach (var e in (await plan.ChecklistAsync(user, view.Number, ct)).Entries)
                    checklist[e.Id] = new GuideCheck(e.State == "done", DateOnly.ParseExact(e.Due, "yyyy-MM-dd"));
            }
            catch (ApiException) { /* no plan for this booking: the guide falls back to the trip's own facts */ }
        }

        var booking = (await tripStore.ListForUserAsync(user.Id, ct)).FirstOrDefault(b => b.Number == view.Number);
        var musterDone = false;
        var lastFull = false;
        if (booking is not null && ctx.Stage is StageRules.Embark or StageRules.Sea or StageRules.Port or StageRules.Disembark)
        {
            musterDone = (await onboard.ListMusterAsync(booking.BookingId, ct)).ContainsKey(user.Id);
            if (ctx.Stage == StageRules.Sea)
            {
                var timeline = TimelineBook.For(booking.SailingId, DateOnly.FromDateTime(booking.Departure));
                lastFull = Itinerary.LocalAt(now, timeline.ShipZoneAt(now)).Item1.AddDays(1) == timeline.Days[^1].Date;
            }
        }

        var departure = DateOnly.ParseExact(view.Departure[..10], "yyyy-MM-dd");
        var docsOk = view.Documents is null || (view.Documents.Missing == 0 && view.Documents.PassportProblems == 0);
        var opens = departure.AddDays(-TripRules.CheckinOpenDaysBefore);
        return (new GuideTrip(view.Number, departure, view.Kind == "linked", view.Payment == "paid", DateOnly.ParseExact(view.Plan.FinalDue, "yyyy-MM-dd"), docsOk, view.Checkin.State, opens, musterDone, checklist, view.Documents?.Guests ?? 0, view.Documents?.Ready ?? 0, view.Documents?.Children ?? 0, await CanPrefillAsync(user, view, ct), await CanDraftCustomsAsync(user, view, ctx.Stage, ct), await CanPlanExcursionAsync(user, view, ctx.Stage, ct), await CanBookDinnerAsync(user, view, ctx.Stage, ct)), lastFull);
    }

    /// <summary>True when check-in is open and there is something Stanley could fill in. Any refusal (not open, not an adult guest, an agent booking) is simply no.</summary>
    private async Task<bool> CanPrefillAsync(UserRecord user, TripViewDto view, CancellationToken ct)
    {
        if (view.Kind == "linked" || view.Checkin.State != "open") return false;
        try { return (await checkin.PrefillPlanAsync(user, view.Number, ct)).Count > 0; }
        catch (ApiException) { return false; }
    }

    /// <summary>True on the disembark stage when there are shop purchases to draft a customs declaration from. Any refusal is simply no.</summary>
    private async Task<bool> CanDraftCustomsAsync(UserRecord user, TripViewDto view, string stage, CancellationToken ct)
    {
        if (view.Kind == "linked" || stage != StageRules.Disembark) return false;
        try { return await disembark.CustomsDraftPlanAsync(user, view.Number, ct) is not null; }
        catch (ApiException) { return false; }
    }

    /// <summary>True on a port day when there is a tour Stanley could put in the cart. Any refusal is simply no.</summary>
    private async Task<bool> CanPlanExcursionAsync(UserRecord user, TripViewDto view, string stage, CancellationToken ct)
    {
        if (view.Kind == "linked" || stage != StageRules.Port) return false;
        try { return await plan.ExcursionPlanAsync(user, view.Number, ct) is not null; }
        catch (ApiException) { return false; }
    }

    /// <summary>True on a sea day when Stanley could book tonight's main dining table. Any refusal is simply no.</summary>
    private async Task<bool> CanBookDinnerAsync(UserRecord user, TripViewDto view, string stage, CancellationToken ct)
    {
        if (view.Kind == "linked" || stage != StageRules.Sea) return false;
        try
        {
            var usual = StanleyAutoRules.ParseStanding((await state.GetAsync(false, user.Id, StanleyAutoRules.StandingKey, ct))?.Json).UsualDinner;
            return await plan.DinnerTonightAsync(user, view.Number, usual, null, ct) is not null;
        }
        catch (ApiException) { return false; }
    }
}
