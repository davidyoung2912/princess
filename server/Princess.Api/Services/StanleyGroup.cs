using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Reminders R8, guardian copies (phase P11 v1). When the booker asks, each child on their account with a port day all-aboard time gets a reminder on the booker's own list, an hour before, labelled with the child's first name.
/// A supervised child receives nothing and is never messaged. No switch is needed because the guardian is the one asking and the result is only their own reminders, which they can remove; it adds no ledger line.
/// </summary>
public sealed class StanleyGroupService(StanleyCheckupService checkup, IChatSafetyStore safety, IStanleyReminderStore reminders, IClock clock, IChatStore chat, IStateStore state, IAccessStore access, IUserStore users)
{
    public async Task<GuardianCopiesDto> GuardianAsync(UserRecord user, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        var notChecked = StanleyGroupRules.NotChecked.ToList();
        var children = (await safety.ListChildrenAsync(user.Id, ct)).Select(k => (k.PublicId, First: k.FirstName)).ToList();
        if (children.Count == 0) return new(false, [], [], [], notChecked, null);
        var (facts, _) = await checkup.FactsAsync(user, ct);
        var names = children.Select(c => c.First).ToList();
        if (facts is null) return new(true, names, [], [], notChecked, null);

        var now = clock.UtcNow;
        var existing = await reminders.ListAsync(user.Id, now.AddDays(-1), ct);
        var have = existing.Where(r => r.State != StanleyReminderRules.StateCancelled && r.AnchorId is not null && r.AnchorId.StartsWith(StanleyGroupRules.Marker, StringComparison.Ordinal))
            .Select(r => r.AnchorId!).ToHashSet(StringComparer.Ordinal);
        var live = existing.Count(r => r.State != StanleyReminderRules.StateCancelled);
        var (add, waiting) = StanleyAutoRules.Plan(StanleyGroupRules.GuardianCandidates(facts, children), have, have.Count, now);

        var made = new List<GuardianCopyDto>();
        foreach (var c in add)
        {
            if (live + made.Count >= StanleyReminderRules.MaxPending) { waiting.Add("Your reminders list is full: " + c.Text); continue; }
            await reminders.AddAsync(new StanleyReminderRow
            {
                PublicId = Guid.NewGuid(), UserId = user.Id, DueAt = c.DueAt, Text = StanleyReminderRules.Clean(c.Text), CreatedAt = now, Kind = StanleyReminderRules.KindClock,
                ZoneId = Itinerary.ShipHomeZone, AnchorType = "guardian", AnchorId = c.Key, State = StanleyReminderRules.StateScheduled,
            }, ct);
            made.Add(new(c.Key, c.Text[..c.Text.IndexOf(':')], StanleyReminderRules.Clean(c.Text), c.DueAt));
        }
        return new(true, names, made, waiting, notChecked, facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }

    /// <summary>
    /// A member's own reminder for a group plan they said Going to (AC-R8-01). The proposal is the plan card the group already has; nothing is set for anyone until that member asks, so there is no copy for a member who has not accepted.
    /// 403 notGoing when the caller has not said Going; 404 for a group or plan they cannot read; 400 time, past or lead; 409 already or tooMany.
    /// </summary>
    public async Task<StanleyGroupRules.MeetingReminderDto> MeetingReminderAsync(UserRecord user, StanleyGroupRules.MeetingReminderRequest? body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        if (body is null) throw ApiException.Invalid("plan");
        var lead = body.LeadMin ?? 30;
        if (lead is < 0 or > StanleyGroupRules.MeetLeadMax) throw ApiException.Invalid("lead");
        var member = await chat.GetMemberAsync(user.Id, body.GroupId, ct) ?? throw ApiException.NotFound();
        if (member.Status != ChatConversationRules.Active || member.Kind is not (ChatConversationRules.Group or ChatHuddleRules.Kind)) throw ApiException.NotFound();
        var plan = (await chat.ListPlansAsync(member.GroupId, ct)).FirstOrDefault(p => p.PublicId == body.PlanId) ?? throw ApiException.NotFound();
        var card = ChatCardRules.Parse(plan.Payload) ?? throw ApiException.NotFound();
        if (!(await chat.ListResponsesAsync([plan.Id], ct)).Any(a => a.UserId == user.Id && a.Choice == ChatPlanningRules.Going)) throw ApiException.Forbidden("notGoing");
        var (facts, _) = await checkup.FactsAsync(user, ct);
        if (facts?.Timeline is null || card.Day is not { } day || day < 1 || day > facts.Timeline.Days.Count || !StanleyReminderRules.TimeOk(card.Time)) throw ApiException.Invalid("time");
        var date = facts.Timeline.Days[day - 1].Date;
        var due = StanleyGroupRules.MeetingDue(date, card.Time, lead, facts.Timeline.ShipZoneOnDate(date)) ?? throw ApiException.Invalid("time");
        var now = clock.UtcNow;
        if (due <= now) throw ApiException.Invalid("past");
        var key = StanleyGroupRules.MeetMarker + plan.PublicId.ToString("N");
        var existing = await reminders.ListAsync(user.Id, now.AddDays(-1), ct);
        if (existing.Any(r => r.State != StanleyReminderRules.StateCancelled && r.AnchorId == key)) throw ApiException.Conflict("already");
        if (existing.Count(r => r.State != StanleyReminderRules.StateCancelled) >= StanleyReminderRules.MaxPending) throw ApiException.Conflict("tooMany");
        var row = new StanleyReminderRow
        {
            PublicId = Guid.NewGuid(), UserId = user.Id, DueAt = due, Text = StanleyGroupRules.MeetingText(card.Title, lead), CreatedAt = now, Kind = StanleyReminderRules.KindClock,
            ZoneId = facts.Timeline.ShipZoneOnDate(date), AnchorType = "meeting", AnchorId = key, State = StanleyReminderRules.StateScheduled,
        };
        await reminders.AddAsync(row, ct);
        return new(row.PublicId.ToString(), row.Text, due);
    }

    // ---- Helper copies (REM-D04) ----

    private async Task<StanleyGroupRules.HelperCopiesDto> ChoiceAsync(UserRecord guest, CancellationToken ct)
    {
        var choice = StanleyGroupRules.ParseChoice((await state.GetAsync(false, guest.Id, StanleyGroupRules.HelperKey, ct))?.Json);
        return new(choice.On, choice.At?.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"), 0, StanleyGroupRules.HelperNotChecked.ToList());
    }

    /// <summary>Whether the guest lets a helper have copies, and since when.</summary>
    public async Task<StanleyGroupRules.HelperCopiesDto> HelperChoiceAsync(UserRecord guest, CancellationToken ct)
    {
        if (guest.IsSupervised) throw ApiException.Forbidden();
        return await ChoiceAsync(guest, ct);
    }

    /// <summary>The guest switches helper copies on or off. It is the guest's own choice, recorded with its time; switching off stops copies at once. 403 for a supervised account.</summary>
    public async Task<StanleyGroupRules.HelperCopiesDto> SetHelperChoiceAsync(UserRecord guest, StanleyGroupRules.HelperCopiesRequest? body, CancellationToken ct)
    {
        if (guest.IsSupervised) throw ApiException.Forbidden();
        if (body?.On is not { } on) throw ApiException.Invalid("on");
        var row = await state.GetAsync(false, guest.Id, StanleyGroupRules.HelperKey, ct);
        await state.SaveAsync(false, guest.Id, StanleyGroupRules.HelperKey, StanleyGroupRules.ChoiceJson(on, clock.UtcNow), row?.Version ?? 0, clock.UtcNow, ct);
        return await ChoiceAsync(guest, ct);
    }

    /// <summary>
    /// The copies due for this helper now (for the push dispatch): for each guest whose live helper link carries the Stanley permission and who switched copies on, the guest's due reminders of the kinds <see cref="StanleyGroupRules.HelperCopy"/> allows,
    /// with the guest's first name in front. Nothing for a supervised helper, a lapsed link, a guest who switched it off, or a private reminder. The reminder's id is the notice key, so each copy goes once.
    /// </summary>
    public async Task<List<StanleyReminderDue>> HelperCopiesDueAsync(UserRecord helper, DateTime now, CancellationToken ct)
    {
        var list = new List<StanleyReminderDue>();
        if (helper.IsSupervised) return list;
        foreach (var g in await access.ListHelpedGuestsAsync(helper.Id, ct))
        {
            var grant = new HelperGrant { Permissions = g.Permissions, Status = "active", ChangedAt = g.ChangedAt };
            if (!StanleyHelperRules.Live(grant, now)) continue;
            if (await users.FindByIdAsync(g.GuestUserId, ct) is not { IsSupervised: false } guest) continue;
            if (!(await ChoiceAsync(guest, ct)).On) continue;
            var due = (await reminders.ListAsync(guest.Id, now.AddHours(-StanleyReminderRules.LateHours), ct))
                .Where(r => r.State != StanleyReminderRules.StateCancelled && StanleyGroupRules.HelperCopy(r.AnchorType, r.AnchorId, r.Private))
                .Select(r => new StanleyReminderDue(r.PublicId, StanleyGroupRules.HelperText(guest.FirstName ?? "", r.Text), TripRules.ToMs(r.DueAt)));
            list.AddRange(StanleyReminderRules.Sendable(due, TripRules.ToMs(now)));
        }
        return list;
    }
}
