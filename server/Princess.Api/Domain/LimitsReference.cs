namespace Princess.Api.Domain;

/// <summary>The limits, windows, fees and rates the server enforces, as the client reads them (multi-device plan 3, Phase 3 step 6). Each entry is the server's own constant under the client's name, so a screen's limit can never differ from the rule that checks it. <c>Version</c> changes when any value does.</summary>
public sealed record LimitsReferenceDto(string Version, IReadOnlyDictionary<string, object> Values);

public static class LimitsReference
{
    public static readonly IReadOnlyDictionary<string, object> Values = new Dictionary<string, object>
    {
        ["MAX_OPEN_REQUESTS"] = ServiceRules.MaxOpenRequests,
        ["MAX_REPORT_TEXT"] = ServiceRules.MaxReportText,
        ["DAILY_PACKAGE_DRINKS"] = ServiceRules.DailyPackageDrinks,
        ["ALERT_AFTER"] = ServiceRules.AlertAfter,
        ["ALERT_WINDOW_MIN"] = ServiceRules.AlertWindowMin,
        ["STOP_AFTER"] = ServiceRules.StopAfter,
        ["MAX_TABLE"] = ServiceRules.MaxTable,
        ["CASH_DESK_MIN"] = ServiceRules.CashDeskMin,
        ["GRATUITY_REASON_MIN"] = ServiceRules.GratuityReasonMin,
        ["MAX_PARTY_CABINS"] = ServiceRules.MaxPartyCabins,
        ["QUIET_FROM"] = ServiceRules.QuietFrom,
        ["MAX_PHOTO_BYTES"] = ServiceRules.MaxPhotoBytes,
        ["PHOTO_MIN_AGE"] = ServiceRules.PhotoMinAge,
        ["LAST_MINUTE_LEAD_MIN"] = ServiceRules.LastMinuteLeadMin,
        ["CONSENT_CODE_HOURS"] = AheadRules.ConsentCodeHours,
        ["MIN_PAID"] = Pricing.MinPaid,
        ["BID_DECIDED_DAYS"] = AheadRules.BidDecidedDays,
        ["MAX_PICKUPS"] = AheadRules.MaxPickups,
        ["MAX_CLUB_TEXT"] = AheadRules.MaxClubText,
        ["MEDALLION_SHIP_DAYS"] = AheadRules.MedallionShipDays,
        ["MEDALLION_DELIVER_DAYS"] = AheadRules.MedallionDeliverDays,
        ["TAGS_PER_GUEST"] = AheadRules.TagsPerGuest,
        ["TAG_ORDER_DAYS"] = AheadRules.TagOrderDays,
        ["ASSIST_REVIEW_HOURS"] = AheadRules.AssistReviewHours,
        ["ASSIST_DECIDE_HOURS"] = AheadRules.AssistDecideHours,
        ["CASE_TEXT_MAX"] = PostCruiseRules.CaseTextMax,
        ["CASE_PLACE_MAX"] = PostCruiseRules.CasePlaceMax,
        ["CLAIM_MAX"] = PostCruiseRules.ClaimMax,
        ["RECOVERY_CREDIT"] = PostCruiseRules.RecoveryCredit,
        ["REFUND_DAYS"] = PostCruiseRules.RefundDays,
        ["COMMENT_MAX"] = PostCruiseRules.CommentMax,
        ["CREW_MAX"] = PostCruiseRules.CrewMax,
        ["CREW_NAME_MAX"] = PostCruiseRules.CrewNameMax,
        ["FEEDBACK_EDIT_DAYS"] = PostCruiseRules.FeedbackEditDays,
        ["REFERRAL_CREDIT"] = PostCruiseRules.ReferralCredit,
        ["HOLD_DAYS"] = PostCruiseRules.HoldDays,
        ["ONBOARD_DEPOSIT"] = PostCruiseRules.OnboardDeposit,
        ["BOOKING_CREDIT"] = PostCruiseRules.BookingCredit,
        ["REBOOK_GAP_DAYS"] = PostCruiseRules.RebookGapDays,
        ["SELF_ASSIST_FROM"] = DisembarkRules.SelfAssistFrom,
        ["EARLY_FROM"] = DisembarkRules.EarlyFrom,
        ["CLEARANCE_MINUTES"] = DisembarkRules.ClearanceMinutes,
        ["MAX_CARRY_BAGS"] = DisembarkRules.MaxCarryBags,
        ["MAX_BAGS"] = DisembarkRules.MaxBags,
        ["ALLOWANCE_USD"] = DisembarkRules.AllowanceUsd,
        ["GOODS_MAX"] = DisembarkRules.GoodsMax,
        ["CUSTOMS_NOTE_MAX"] = DisembarkRules.CustomsNoteMax,
        ["ONWARD_NOTE_MAX"] = DisembarkRules.OnwardNoteMax,
        ["AIRPORT_MINUTES"] = DisembarkRules.AirportMinutes,
        ["TIGHT_MINUTES"] = DisembarkRules.TightMinutes,
        ["DUE_SOON_MINUTES"] = DisembarkRules.DueSoonMinutes,
        ["FREE_CANCEL_HOURS"] = PolicyRules.FreeCancelHours,
        ["FREE_CANCEL_MIN_DAYS"] = PolicyRules.FreeCancelMinDays,
        ["VOD_CHANNEL"] = TvAndGameRules.VodChannel,
        ["INCLUDED_PLAN"] = WifiRules.IncludedPlan,
        ["INCLUDED_WITH_PREMIER"] = PhotoRules.IncludedWithPremier,
        ["DOWNLOAD_BATCH"] = PhotoRules.DownloadBatch,
        ["REDOWNLOAD_DAYS"] = PhotoRules.RedownloadDays,
        ["ISOLATION_WINDOW_HOURS"] = HealthRules.IsolationWindowHours,
        ["DND_CHECK_HOURS"] = RoomRules.DndCheckHours,
        ["DELIVERY_FEE"] = OrderRules.DeliveryFee,
        ["DRINKING_AGE"] = ServiceRules.DrinkingAge,
        ["SERVICE_RATE"] = OrderRules.ServiceRate,
        ["BREAKFAST_LEAD_MINUTES"] = OrderRules.BreakfastLeadMinutes,
    };

    public static LimitsReferenceDto Get()
    {
        var text = string.Join('|', Values.OrderBy(kv => kv.Key, StringComparer.Ordinal).Select(kv => $"{kv.Key}={Convert.ToString(kv.Value, System.Globalization.CultureInfo.InvariantCulture)}"));
        var version = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(text))).ToLowerInvariant()[..16];
        return new(version, Values);
    }
}
