using Dapper;

namespace Princess.Api.Data;

public sealed class DapperStatsStore(IDbConnectionFactory db) : IStatsStore
{
    // Every fact is one scalar sub-select, so the whole page costs one round trip. A name ending in _at is a date; the rest are whole numbers.
    // Money is in cents and distances in tenths of a kilometre; StatsRules turns them into words. "Your bookings" are the ones the guest is on or paid for.
    private const string Numbers = """
        DECLARE @bk TABLE (Id BIGINT NOT NULL PRIMARY KEY);
        INSERT @bk (Id) SELECT BookingId FROM dbo.BookingGuests WHERE UserId = @id UNION SELECT Id FROM dbo.Bookings WHERE BookerUserId = @id;
        SELECT
          (SELECT CreatedAt FROM dbo.Users WHERE Id = @id) AS created_at,
          -- sign-ins and security
          (SELECT COUNT(*) FROM dbo.AuditEvents WHERE Action = N'auth.login' AND Outcome = 'success' AND (ActorPublicId = @pid OR SubjectPublicId = @pid)) AS logins,
          (SELECT COUNT(*) FROM dbo.AuditEvents WHERE Action = N'auth.login' AND Outcome <> 'success' AND (ActorPublicId = @pid OR SubjectPublicId = @pid)) AS login_fails,
          (SELECT MIN([At]) FROM dbo.AuditEvents WHERE Action = N'auth.login' AND Outcome = 'success' AND (ActorPublicId = @pid OR SubjectPublicId = @pid)) AS first_login_at,
          (SELECT COUNT(DISTINCT FamilyId) FROM dbo.RefreshTokens WHERE UserId = @id) AS devices,
          (SELECT COUNT(DISTINCT UserAgent) FROM dbo.RefreshTokens WHERE UserId = @id AND UserAgent IS NOT NULL) AS browsers,
          (SELECT COUNT(*) FROM dbo.AuditEvents WHERE Category = 'request' AND Outcome = 'success' AND ActorPublicId = @pid) AS changes,
          (SELECT COUNT(*) FROM dbo.AuditEvents WHERE Outcome IN ('denied', 'error') AND ActorPublicId = @pid) AS bumps,
          -- chat
          (SELECT COUNT(*) FROM dbo.ChatMessages WHERE FromUserId = @id) AS msgs,
          (SELECT ISNULL(SUM(CAST(LEN([Text]) AS BIGINT)), 0) FROM dbo.ChatMessages WHERE FromUserId = @id) AS chars,
          (SELECT ISNULL(SUM(CAST(LEN(LTRIM(RTRIM([Text]))) - LEN(REPLACE(LTRIM(RTRIM([Text])), N' ', N'')) + 1 AS BIGINT)), 0) FROM dbo.ChatMessages WHERE FromUserId = @id AND LEN(LTRIM(RTRIM([Text]))) > 0) AS words,
          (SELECT ISNULL(MAX(LEN([Text])), 0) FROM dbo.ChatMessages WHERE FromUserId = @id) AS longest_msg,
          (SELECT COUNT(*) FROM dbo.ChatMessages WHERE FromUserId = @id AND [Text] LIKE N'%?%') AS questions,
          (SELECT COUNT(*) FROM dbo.ChatMessages WHERE FromUserId = @id AND [Text] LIKE N'%!%') AS bangs,
          (SELECT COUNT(*) FROM dbo.ChatMessages WHERE FromUserId = @id AND ([Text] LIKE N'%haha%' OR [Text] LIKE N'%lol%')) AS laughs,
          (SELECT COUNT(*) FROM dbo.ChatMessages WHERE FromUserId = @id AND [Text] LIKE N'%thank%') AS thanks_said,
          (SELECT COUNT(*) FROM dbo.ChatMessagePhotos p JOIN dbo.ChatMessages m ON m.Id = p.MessageId WHERE m.FromUserId = @id)
            + (SELECT COUNT(*) FROM dbo.ChatMessages WHERE FromUserId = @id AND Photo IS NOT NULL) AS chat_photos,
          (SELECT COUNT(DISTINCT CAST([At] AS DATE)) FROM dbo.ChatMessages WHERE FromUserId = @id) AS chat_days,
          (SELECT COUNT(*) FROM dbo.ChatGroupMembers WHERE UserId = @id) AS groups,
          (SELECT COUNT(*) FROM dbo.ChatConnections WHERE Status = 'accepted' AND (RequesterId = @id OR TargetId = @id)) AS connections,
          (SELECT COUNT(*) FROM dbo.ChatReactions WHERE UserId = @id) AS reacts_given,
          (SELECT COUNT(*) FROM dbo.ChatReactions r JOIN dbo.ChatMessages m ON m.Id = r.MessageId WHERE m.FromUserId = @id AND r.UserId <> @id) AS reacts_got,
          (SELECT COUNT(*) FROM dbo.ChatMentions WHERE UserId = @id) AS mentions,
          (SELECT COUNT(*) FROM dbo.ChatPins p JOIN dbo.ChatMessages m ON m.Id = p.MessageId WHERE m.FromUserId = @id) AS pinned,
          -- Stanley
          (SELECT COUNT(*) FROM dbo.ConciergeUses WHERE UserId = @id) AS asks,
          (SELECT COUNT(*) FROM dbo.StanleyActions WHERE UserId = @id) AS stanley_actions,
          (SELECT COUNT(*) FROM dbo.StanleyReminders WHERE UserId = @id) AS reminders,
          -- dining and drinks
          (SELECT COUNT(*) FROM dbo.DiningReservationGuests g JOIN dbo.DiningReservations r ON r.Id = g.ReservationId WHERE g.UserId = @id AND r.Status <> 'cancelled') AS dinners,
          (SELECT COUNT(DISTINCT r.VenueId) FROM dbo.DiningReservationGuests g JOIN dbo.DiningReservations r ON r.Id = g.ReservationId WHERE g.UserId = @id AND r.Status <> 'cancelled') AS venues,
          (SELECT COUNT(*) FROM dbo.DiningReservationGuests g JOIN dbo.DiningReservations r ON r.Id = g.ReservationId JOIN ref.Venues v ON v.Id = r.VenueId WHERE g.UserId = @id AND r.Status <> 'cancelled' AND v.Kind = 'specialty') AS specialty,
          (SELECT ISNULL(SUM(r.ChargeCents), 0) FROM dbo.DiningReservationGuests g JOIN dbo.DiningReservations r ON r.Id = g.ReservationId WHERE g.UserId = @id AND r.Status <> 'cancelled') AS cover_cents,
          (SELECT ISNULL(MIN(DATEDIFF(MINUTE, CAST('00:00' AS TIME), r.TimeLocal)), -1) FROM dbo.DiningReservationGuests g JOIN dbo.DiningReservations r ON r.Id = g.ReservationId WHERE g.UserId = @id AND r.Status <> 'cancelled') AS dinner_earliest,
          (SELECT ISNULL(MAX(DATEDIFF(MINUTE, CAST('00:00' AS TIME), r.TimeLocal)), -1) FROM dbo.DiningReservationGuests g JOIN dbo.DiningReservations r ON r.Id = g.ReservationId WHERE g.UserId = @id AND r.Status <> 'cancelled') AS dinner_latest,
          (SELECT COUNT(*) FROM dbo.Orders WHERE PlacedByUserId = @id AND Stage <> 'cancelled') AS orders,
          (SELECT COUNT(*) FROM dbo.Orders WHERE PlacedByUserId = @id AND Stage <> 'cancelled' AND Kind IN ('room', 'breakfast')) AS room_orders,
          (SELECT ISNULL(SUM(CAST(l.Qty AS BIGINT)), 0) FROM dbo.OrderLines l JOIN dbo.Orders o ON o.Id = l.OrderId WHERE o.PlacedByUserId = @id AND o.Stage <> 'cancelled') AS order_items,
          (SELECT ISNULL(SUM(TipCents), 0) FROM dbo.Orders WHERE PlacedByUserId = @id AND Stage <> 'cancelled') AS tip_cents,
          (SELECT COUNT(*) FROM dbo.DrinkLogs WHERE UserId = @id) AS drinks,
          (SELECT COUNT(DISTINCT DrinkId) FROM dbo.DrinkLogs WHERE UserId = @id) AS drink_kinds,
          -- shows and events
          (SELECT COUNT(*) FROM dbo.ShowTicketGuests g JOIN dbo.ShowTickets s ON s.Id = g.ShowTicketId WHERE g.UserId = @id AND s.Status <> 'cancelled') AS shows,
          (SELECT COUNT(*) FROM dbo.PlanEvents WHERE UserId = @id) AS plan_events,
          (SELECT ISNULL(SUM(CAST(e.DurationMin AS BIGINT)), 0) FROM dbo.PlanEvents p JOIN ref.Events e ON e.Id = p.EventId WHERE p.UserId = @id) AS event_minutes,
          (SELECT ISNULL(MAX(e.DurationMin), 0) FROM dbo.PlanEvents p JOIN ref.Events e ON e.Id = p.EventId WHERE p.UserId = @id) AS longest_event,
          (SELECT COUNT(DISTINCT e.Kind) FROM dbo.PlanEvents p JOIN ref.Events e ON e.Id = p.EventId WHERE p.UserId = @id) AS event_kinds,
          -- ports and excursions
          (SELECT COUNT(*) FROM dbo.TourBookingGuests g JOIN dbo.TourBookings t ON t.Id = g.TourBookingId WHERE g.UserId = @id AND t.Status = 'booked') AS tours,
          (SELECT COUNT(DISTINCT x.PortId) FROM dbo.TourBookingGuests g JOIN dbo.TourBookings t ON t.Id = g.TourBookingId JOIN ref.Excursions x ON x.Id = t.ExcursionId WHERE g.UserId = @id AND t.Status = 'booked') AS tour_ports,
          (SELECT ISNULL(SUM(CAST(x.DurationMin AS BIGINT)), 0) FROM dbo.TourBookingGuests g JOIN dbo.TourBookings t ON t.Id = g.TourBookingId JOIN ref.Excursions x ON x.Id = t.ExcursionId WHERE g.UserId = @id AND t.Status = 'booked') AS tour_minutes,
          (SELECT ISNULL(SUM(CAST(ISNULL(x.WalkKm, 0) * 10 AS BIGINT)), 0) FROM dbo.TourBookingGuests g JOIN dbo.TourBookings t ON t.Id = g.TourBookingId JOIN ref.Excursions x ON x.Id = t.ExcursionId WHERE g.UserId = @id AND t.Status = 'booked') AS tour_walk_tenths,
          (SELECT ISNULL(SUM(t.TotalCents), 0) FROM dbo.TourBookingGuests g JOIN dbo.TourBookings t ON t.Id = g.TourBookingId WHERE g.UserId = @id AND t.Status = 'booked') AS tour_cents,
          (SELECT COUNT(*) FROM dbo.TourBookingGuests g JOIN dbo.TourBookings t ON t.Id = g.TourBookingId JOIN ref.Excursions x ON x.Id = t.ExcursionId WHERE g.UserId = @id AND t.Status = 'booked' AND x.Tender = 1) AS tours_tender,
          -- spa
          (SELECT COUNT(*) FROM dbo.SpaAppointmentGuests g JOIN dbo.SpaAppointments a ON a.Id = g.AppointmentId WHERE g.UserId = @id AND a.Status = 'booked') AS spa,
          (SELECT ISNULL(SUM(CAST(a.Minutes AS BIGINT)), 0) FROM dbo.SpaAppointmentGuests g JOIN dbo.SpaAppointments a ON a.Id = g.AppointmentId WHERE g.UserId = @id AND a.Status = 'booked') AS spa_minutes,
          (SELECT ISNULL(SUM(a.PriceCents), 0) FROM dbo.SpaAppointmentGuests g JOIN dbo.SpaAppointments a ON a.Id = g.AppointmentId WHERE g.UserId = @id AND a.Status = 'booked') AS spa_cents,
          (SELECT COUNT(DISTINCT a.TreatmentId) FROM dbo.SpaAppointmentGuests g JOIN dbo.SpaAppointments a ON a.Id = g.AppointmentId WHERE g.UserId = @id AND a.Status = 'booked') AS spa_kinds,
          -- onboard account
          (SELECT COUNT(*) FROM dbo.FolioLines WHERE UserId = @id AND Cents > 0) AS folio_lines,
          (SELECT ISNULL(SUM(Cents), 0) FROM dbo.FolioLines WHERE UserId = @id AND Cents > 0) AS folio_cents,
          (SELECT ISNULL(MAX(Cents), 0) FROM dbo.FolioLines WHERE UserId = @id AND Cents > 0) AS folio_max,
          (SELECT ISNULL(SUM(-Cents), 0) FROM dbo.FolioLines WHERE UserId = @id AND Cents < 0) AS folio_credit_cents,
          (SELECT COUNT(DISTINCT [Day]) FROM dbo.FolioLines WHERE UserId = @id AND Cents > 0) AS folio_days,
          -- voyages
          (SELECT COUNT(*) FROM dbo.Bookings b WHERE b.Id IN (SELECT Id FROM @bk) AND b.Status = 'confirmed') AS bookings,
          (SELECT ISNULL(SUM(CAST(s.Nights AS BIGINT)), 0) FROM dbo.Bookings b JOIN ref.Sailings s ON s.Id = b.SailingId WHERE b.Id IN (SELECT Id FROM @bk) AND b.Status = 'confirmed') AS nights,
          (SELECT ISNULL(MAX(s.Nights), 0) FROM dbo.Bookings b JOIN ref.Sailings s ON s.Id = b.SailingId WHERE b.Id IN (SELECT Id FROM @bk) AND b.Status = 'confirmed') AS longest_trip,
          (SELECT COUNT(DISTINCT s.ShipId) FROM dbo.Bookings b JOIN ref.Sailings s ON s.Id = b.SailingId WHERE b.Id IN (SELECT Id FROM @bk) AND b.Status = 'confirmed') AS ships,
          (SELECT COUNT(DISTINCT d.PortId) FROM dbo.Bookings b JOIN ref.ItineraryDays d ON d.SailingId = b.SailingId WHERE b.Id IN (SELECT Id FROM @bk) AND b.Status = 'confirmed') AS ports,
          (SELECT COUNT(DISTINCT p.Country) FROM dbo.Bookings b JOIN ref.ItineraryDays d ON d.SailingId = b.SailingId JOIN ref.Ports p ON p.Id = d.PortId WHERE b.Id IN (SELECT Id FROM @bk) AND b.Status = 'confirmed') AS countries,
          (SELECT MIN(s.Departure) FROM dbo.Bookings b JOIN ref.Sailings s ON s.Id = b.SailingId WHERE b.Id IN (SELECT Id FROM @bk) AND b.Status = 'confirmed' AND s.Departure >= @today) AS next_departure_at,
          (SELECT MAX(s.Departure) FROM dbo.Bookings b JOIN ref.Sailings s ON s.Id = b.SailingId WHERE b.Id IN (SELECT Id FROM @bk) AND b.Status = 'confirmed' AND s.Departure < @today) AS last_trip_at,
          (SELECT COUNT(*) FROM dbo.PastTrips WHERE UserId = @id AND Cancelled = 0) AS past_trips,
          (SELECT ISNULL(SUM(CAST(Nights AS BIGINT)), 0) FROM dbo.PastTrips WHERE UserId = @id AND Cancelled = 0) AS past_nights,
          (SELECT MIN(Departure) FROM dbo.PastTrips WHERE UserId = @id AND Cancelled = 0) AS first_past_trip_at,
          (SELECT COUNT(DISTINCT UserId) FROM dbo.BookingGuests WHERE BookingId IN (SELECT Id FROM @bk) AND UserId <> @id) AS companions,
          -- getting ready
          (SELECT COUNT(*) FROM dbo.ChecklistTicks WHERE BookingId IN (SELECT Id FROM @bk) AND Done = 1) AS checklist,
          (SELECT COUNT(*) FROM dbo.PackingTicks WHERE TickedBy = @id AND Done = 1) AS packed,
          (SELECT COUNT(*) FROM dbo.Favourites WHERE UserId = @id) AS favourites,
          (SELECT COUNT(*) FROM dbo.Celebrations WHERE BookingId IN (SELECT Id FROM @bk)) AS celebrations,
          (SELECT COUNT(*) FROM dbo.Feedback WHERE UserId = @id) AS feedback,
          (SELECT COUNT(*) FROM dbo.Thanks WHERE UserId = @id) AS thanks_sent,
          (SELECT COUNT(*) FROM dbo.GuestMedia WHERE UserId = @id) AS uploads,
          (SELECT COUNT(*) FROM dbo.PhotoAlbum WHERE UserId = @id) AS album,
          (SELECT COUNT(*) FROM dbo.HistoryEntries WHERE ByUserId = @id) AS profile_edits,
          (SELECT COUNT(*) FROM dbo.FamilyLinks WHERE UserId = @id AND RevokedAt IS NULL) AS family_links,
          -- around the ship
          (SELECT COUNT(*) FROM dbo.ServiceRequests WHERE BookingId IN (SELECT Id FROM @bk)) AS requests,
          (SELECT COUNT(*) FROM dbo.LaundryRequests WHERE BookingId IN (SELECT Id FROM @bk)) AS laundry,
          (SELECT ISNULL(SUM(CAST(Qty AS BIGINT)), 0) FROM dbo.LaundryRequests WHERE BookingId IN (SELECT Id FROM @bk)) AS laundry_items,
          (SELECT COUNT(*) FROM dbo.WifiDevices WHERE BookingId IN (SELECT Id FROM @bk)) AS wifi_devices,
          (SELECT ISNULL(SUM(UsedMb), 0) FROM dbo.WifiDevices WHERE BookingId IN (SELECT Id FROM @bk)) AS wifi_mb,
          (SELECT COUNT(*) FROM dbo.PhotoPurchases WHERE BookingId IN (SELECT Id FROM @bk)) AS photo_packs
        """;

    // The favourites: one word each, from the most common row. Several statements, one round trip.
    private const string Tops = """
        SELECT TOP 1 Emoji FROM dbo.ChatReactions WHERE UserId = @id GROUP BY Emoji ORDER BY COUNT(*) DESC, Emoji;
        SELECT TOP 1 g.Name FROM dbo.ChatMessages m JOIN dbo.ChatGroups g ON g.Id = m.GroupId WHERE m.FromUserId = @id GROUP BY g.Name ORDER BY COUNT(*) DESC, g.Name;
        SELECT TOP 1 v.Name FROM dbo.DiningReservationGuests g JOIN dbo.DiningReservations r ON r.Id = g.ReservationId JOIN ref.Venues v ON v.Id = r.VenueId WHERE g.UserId = @id AND r.Status <> 'cancelled' GROUP BY v.Name ORDER BY COUNT(*) DESC, v.Name;
        SELECT TOP 1 m.Name FROM dbo.OrderLines l JOIN dbo.Orders o ON o.Id = l.OrderId JOIN ref.MenuItems m ON m.Id = l.ItemId WHERE o.PlacedByUserId = @id AND o.Stage <> 'cancelled' GROUP BY m.Name ORDER BY SUM(l.Qty) DESC, m.Name;
        SELECT TOP 1 DrinkId FROM dbo.DrinkLogs WHERE UserId = @id GROUP BY DrinkId ORDER BY COUNT(*) DESC, DrinkId;
        SELECT TOP 1 e.Kind FROM dbo.PlanEvents p JOIN ref.Events e ON e.Id = p.EventId WHERE p.UserId = @id GROUP BY e.Kind ORDER BY COUNT(*) DESC, e.Kind;
        SELECT TOP 1 p.Name FROM dbo.TourBookingGuests g JOIN dbo.TourBookings t ON t.Id = g.TourBookingId JOIN ref.Excursions x ON x.Id = t.ExcursionId JOIN ref.Ports p ON p.Id = x.PortId WHERE g.UserId = @id AND t.Status = 'booked' GROUP BY p.Name ORDER BY COUNT(*) DESC, p.Name;
        SELECT TOP 1 Category FROM dbo.FolioLines WHERE UserId = @id AND Cents > 0 GROUP BY Category ORDER BY SUM(Cents) DESC, Category;
        SELECT TOP 1 x.Name FROM dbo.TourBookingGuests g JOIN dbo.TourBookings t ON t.Id = g.TourBookingId JOIN ref.Excursions x ON x.Id = t.ExcursionId WHERE g.UserId = @id AND t.Status = 'booked' GROUP BY x.Name ORDER BY COUNT(*) DESC, x.Name;
        """;

    private static readonly string[] TopKeys = ["emoji", "room", "venue", "dish", "drink", "event_kind", "port", "spend_category", "tour"];

    public async Task<StatsRaw> LoadAsync(long userId, Guid publicId, DateTime utcNow, CancellationToken ct)
    {
        var raw = new StatsRaw();
        await using var c = await db.OpenAsync(ct);
        var args = new { id = userId, pid = publicId, today = utcNow.Date };

        var row = (IDictionary<string, object?>)await c.QuerySingleAsync(Sql.Cmd(Numbers, args, null, ct));
        foreach (var (key, value) in row)
        {
            if (value is DateTime stamp) { raw.D[key] = stamp; continue; }
            if (value is null) continue;
            raw.N[key] = Convert.ToInt64(value, System.Globalization.CultureInfo.InvariantCulture);
        }

        using (var tops = await c.QueryMultipleAsync(Sql.Cmd(Tops, args, null, ct)))
        {
            foreach (var key in TopKeys)
            {
                var word = await tops.ReadFirstOrDefaultAsync<string>();
                if (!string.IsNullOrWhiteSpace(word)) raw.T[key] = word;
            }
        }

        foreach (var r in await c.QueryAsync<(string Key, long Value)>(Sql.Cmd("SELECT CounterKey, [Value] FROM dbo.UserCounters WHERE UserId = @id", args, null, ct)))
            raw.Counters[r.Key] = r.Value;
        foreach (var r in await c.QueryAsync<(DateTime Day, int Seconds, int Views, int Opens)>(Sql.Cmd("SELECT [Day], Seconds, Views, Opens FROM dbo.UserDays WHERE UserId = @id ORDER BY [Day]", args, null, ct)))
            raw.Days.Add(new StatsDay(DateOnly.FromDateTime(r.Day), r.Seconds, r.Views, r.Opens));
        return raw;
    }

    public async Task<HashSet<string>> CounterKeysAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<string>(Sql.Cmd("SELECT CounterKey FROM dbo.UserCounters WHERE UserId = @userId", new { userId }, null, ct))).ToHashSet(StringComparer.Ordinal);
    }

    public async Task AddAsync(long userId, DateOnly day, IReadOnlyDictionary<string, long> counters, int seconds, int views, int opens, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        const string counter = """
            MERGE dbo.UserCounters WITH (HOLDLOCK) AS t USING (SELECT @userId AS UserId, @key AS CounterKey) AS s ON t.UserId = s.UserId AND t.CounterKey = s.CounterKey
            WHEN MATCHED THEN UPDATE SET [Value] = t.[Value] + @value, UpdatedAt = @now
            WHEN NOT MATCHED THEN INSERT (UserId, CounterKey, [Value], UpdatedAt) VALUES (@userId, @key, @value, @now);
            """;
        foreach (var (key, value) in counters)
            await c.ExecuteAsync(Sql.Cmd(counter, new { userId, key, value, now }, null, ct));
        if (seconds > 0 || views > 0 || opens > 0)
        {
            const string dayRow = """
                MERGE dbo.UserDays WITH (HOLDLOCK) AS t USING (SELECT @userId AS UserId, @day AS [Day]) AS s ON t.UserId = s.UserId AND t.[Day] = s.[Day]
                WHEN MATCHED THEN UPDATE SET Seconds = t.Seconds + @seconds, Views = t.Views + @views, Opens = t.Opens + @opens
                WHEN NOT MATCHED THEN INSERT (UserId, [Day], Seconds, Views, Opens) VALUES (@userId, @day, @seconds, @views, @opens);
                """;
            await c.ExecuteAsync(Sql.Cmd(dayRow, new { userId, day = day.ToDateTime(TimeOnly.MinValue), seconds, views, opens }, null, ct));
        }
    }
}
