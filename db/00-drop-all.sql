/*
  Drops every table created by db/01-schema.sql, and the ref and demo schemas. For TEST databases only: it destroys all
  data, reference and user alike. Tables are listed by name, so anything else in the database is left alone.

  It refuses to run unless you say so:
      sqlcmd -S <server> -d <db> -b -v ConfirmDrop=YES -i db/00-drop-all.sql
  (In SSMS or Azure Data Studio, enable SQLCMD mode and put  :setvar ConfirmDrop YES  on the first line.)
  Then run db/01-schema.sql to start again.
*/
SET NOCOUNT ON;
GO

IF N'$(ConfirmDrop)' <> N'YES'
BEGIN
  RAISERROR (N'Refusing to drop anything: pass -v ConfirmDrop=YES to confirm.', 16, 1);
  SET NOEXEC ON;   -- skips every later batch
END
GO

DECLARE @tables TABLE (SchemaName sysname NOT NULL, TableName sysname NOT NULL);
INSERT INTO @tables (SchemaName, TableName) VALUES
  (N'ref', N'Ships'),
  (N'ref', N'Decks'),
  (N'ref', N'CabinCategories'),
  (N'ref', N'MusterStations'),
  (N'ref', N'Cabins'),
  (N'ref', N'Ports'),
  (N'ref', N'Sailings'),
  (N'ref', N'ItineraryDays'),
  (N'ref', N'Venues'),
  (N'ref', N'MenuItems'),
  (N'ref', N'MenuExtras'),
  (N'ref', N'Excursions'),
  (N'ref', N'ExcursionDepartures'),
  (N'ref', N'Events'),
  (N'ref', N'EventDays'),
  (N'ref', N'Fares'),
  (N'ref', N'Promotions'),
  (N'ref', N'Packages'),
  (N'ref', N'AddOns'),
  (N'ref', N'PackageUpgrades'),
  (N'ref', N'Entitlements'),
  (N'ref', N'PhotoCatalogue'),
  (N'ref', N'PhotographerSlots'),
  (N'ref', N'PhotoOptions'),
  (N'ref', N'CrewMembers'),
  (N'ref', N'Advisors'),
  (N'ref', N'Faqs'),
  (N'ref', N'HelpTopics'),
  (N'ref', N'ContentBlocks'),
  (N'ref', N'LegalDocs'),
  (N'ref', N'ServiceItems'),
  (N'ref', N'Drinks'),
  (N'ref', N'Clubs'),
  (N'ref', N'TravelWindows'),
  (N'ref', N'NightChecklistItems'),
  (N'ref', N'PackingItems'),
  (N'ref', N'ChecklistItems'),
  (N'ref', N'DeskSlots'),
  (N'dbo', N'Users'),
  (N'dbo', N'Profiles'),
  (N'dbo', N'ProfileTags'),
  (N'dbo', N'RefreshTokens'),
  (N'dbo', N'HelperLinks'),
  (N'dbo', N'HistoryEntries'),
  (N'dbo', N'SavedCards'),
  (N'dbo', N'Notices'),
  (N'dbo', N'NotificationPrefs'),
  (N'dbo', N'ConsentChoices'),
  (N'dbo', N'AccessLog'),
  (N'dbo', N'RetentionRuns'),
  (N'dbo', N'SupportTickets'),
  (N'dbo', N'Favourites'),
  (N'demo', N'DemoState'),
  (N'dbo', N'Bookings'),
  (N'dbo', N'BookingGuests'),
  (N'dbo', N'BookingGuestDetails'),
  (N'dbo', N'BookingGuestTags'),
  (N'dbo', N'BookingDrafts'),
  (N'dbo', N'QuoteLocks'),
  (N'dbo', N'Payments'),
  (N'dbo', N'PaymentParts'),
  (N'dbo', N'IdempotencyKeys'),
  (N'dbo', N'Acceptances'),
  (N'dbo', N'NotificationsSent'),
  (N'dbo', N'ResumeLinks'),
  (N'dbo', N'PastTrips'),
  (N'dbo', N'PastTripDocs'),
  (N'dbo', N'Loyalty'),
  (N'dbo', N'FutureCruiseCredits'),
  (N'dbo', N'Referrals'),
  (N'dbo', N'LinkedBookings'),
  (N'dbo', N'GuestDocuments'),
  (N'dbo', N'TourBookings'),
  (N'dbo', N'TourBookingGuests'),
  (N'dbo', N'TourCartLines'),
  (N'dbo', N'TourCartGuests'),
  (N'dbo', N'DiningReservations'),
  (N'dbo', N'DiningReservationGuests'),
  (N'dbo', N'GroupTableFriends'),
  (N'dbo', N'Waitlists'),
  (N'dbo', N'WaitlistGuests'),
  (N'dbo', N'Queues'),
  (N'dbo', N'Purchases'),
  (N'dbo', N'PurchaseGuests'),
  (N'dbo', N'ChecklistTicks'),
  (N'dbo', N'PackingTicks'),
  (N'dbo', N'PrepTicks'),
  (N'dbo', N'ReadyTicks'),
  (N'dbo', N'NightTicks'),
  (N'dbo', N'TravelPlans'),
  (N'dbo', N'AssistanceRequests'),
  (N'dbo', N'AdvisorRequests'),
  (N'dbo', N'MarketingConsents'),
  (N'dbo', N'UpgradeBids'),
  (N'dbo', N'ClubRegistrations'),
  (N'dbo', N'Medallions'),
  (N'dbo', N'MedallionGuests'),
  (N'dbo', N'BagTagOrders'),
  (N'dbo', N'FixCases'),
  (N'dbo', N'AssistCases'),
  (N'dbo', N'CheckinGuests'),
  (N'dbo', N'CheckinBooking'),
  (N'dbo', N'BoardingPasses'),
  (N'dbo', N'EmbarkProgress'),
  (N'dbo', N'EmbarkTicks'),
  (N'dbo', N'MusterConfirmations'),
  (N'dbo', N'PlanEvents'),
  (N'dbo', N'ShowTickets'),
  (N'dbo', N'ShowTicketGuests'),
  (N'dbo', N'Orders'),
  (N'dbo', N'OrderLines'),
  (N'dbo', N'ChatGroups'),
  (N'dbo', N'ChatGroupMembers'),
  (N'dbo', N'ChatMessages'),
  (N'dbo', N'ChatReads'),
  (N'dbo', N'ChatBlocks'),
  (N'dbo', N'ChatReports'),
  (N'dbo', N'UserPrefs'),
  (N'dbo', N'ServiceThreads'),
  (N'dbo', N'ServiceMessages'),
  (N'dbo', N'FamilyZones'),
  (N'dbo', N'KidClubCheckins'),
  (N'dbo', N'KidSightings'),
  (N'dbo', N'FamilyLog'),
  (N'dbo', N'ReunionPlans'),
  (N'dbo', N'HealthReports'),
  (N'dbo', N'HealthReportGuests'),
  (N'dbo', N'HealthRequests'),
  (N'dbo', N'RoomSettings'),
  (N'dbo', N'PhotoSelections'),
  (N'dbo', N'PhotoPurchases'),
  (N'dbo', N'PhotoPurchaseItems'),
  (N'dbo', N'LaundryRequests'),
  (N'dbo', N'WifiDevices'),
  (N'dbo', N'Budgets'),
  (N'dbo', N'UpdateAcks'),
  (N'dbo', N'ServiceRequests'),
  (N'dbo', N'SafetyReports'),
  (N'dbo', N'DrinkLogs'),
  (N'dbo', N'TopUps'),
  (N'dbo', N'OnboardAccount'),
  (N'dbo', N'Parties'),
  (N'dbo', N'PartyInvites'),
  (N'dbo', N'GameProgress'),
  (N'dbo', N'TvState'),
  (N'dbo', N'Selections'),
  (N'dbo', N'FolioLines'),
  (N'dbo', N'Feedback'),
  (N'dbo', N'DisembarkChoices'),
  (N'dbo', N'DisembarkBags'),
  (N'dbo', N'Customs'),
  (N'dbo', N'OnwardPlans'),
  (N'dbo', N'FinalBill'),
  (N'dbo', N'Cases'),
  (N'dbo', N'PostFeedback'),
  (N'dbo', N'RebookHolds'),
  (N'dbo', N'DeskAppointments');

DECLARE @sql NVARCHAR(MAX) = N'';

-- Foreign keys first, so the tables can go in any order.
SELECT @sql += N'ALTER TABLE ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';' + NCHAR(10)
FROM sys.foreign_keys AS fk
JOIN sys.tables AS t ON t.object_id = fk.parent_object_id
JOIN sys.schemas AS s ON s.schema_id = t.schema_id
JOIN @tables AS x ON x.SchemaName = s.name AND x.TableName = t.name;
EXEC sys.sp_executesql @sql;

SET @sql = N'';
SELECT @sql += N'DROP TABLE ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) + N';' + NCHAR(10)
FROM sys.tables AS t
JOIN sys.schemas AS s ON s.schema_id = t.schema_id
JOIN @tables AS x ON x.SchemaName = s.name AND x.TableName = t.name;
EXEC sys.sp_executesql @sql;
GO

-- The schemas go only if nothing else lives in them.
IF SCHEMA_ID(N'ref') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.objects WHERE schema_id = SCHEMA_ID(N'ref')) DROP SCHEMA ref;
IF SCHEMA_ID(N'demo') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.objects WHERE schema_id = SCHEMA_ID(N'demo')) DROP SCHEMA demo;
GO

SET NOEXEC OFF;
GO
