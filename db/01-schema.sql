/*
  Princess database schema (SQL Server / T-SQL). Phase 2 of docs/backend-plan.md.
  Source of truth for the design: docs/backend-data-model.md (section 4 tables, section 2 conventions).

  - Runs top to bottom on an empty database; every table is created only if missing, so a re-run is harmless. It is not
    an upgrade script: a change to a table means resetting the database (db/00-drop-all.sql, then this script and the seeds).
  - Creates no data. Reference data is seeded by db/seed/reference (Phase 3), personas by db/seed/personas (Phase 4).
  - Schemas: ref (reference data), dbo (everything a user owns), demo (clock and scenarios).
  - Run it in the target database (USE <db> first), as a user who may create schemas and tables:
        sqlcmd -S <server> -d <db> -b -i db/01-schema.sql
  - Cascade rule (data model section 2): the owning key (UserId, BookingId, or the parent row) cascades on delete;
    "actor" columns (ByUserId, PlacedByUserId, FromUserId ...) are NO ACTION, because SQL Server rejects tables that
    can be reached by two cascade paths. The retention job therefore deletes a booking before its booker.
  - Reference ids are open string sets (new ports, venues and so on are data, not schema), so ref tables carry no
    CHECK on their Id. Closed unions in the TypeScript (data model D8) are CHECK constraints on the column.
*/
SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;   -- required for filtered indexes
GO

IF SCHEMA_ID(N'ref') IS NULL EXEC (N'CREATE SCHEMA ref');
IF SCHEMA_ID(N'demo') IS NULL EXEC (N'CREATE SCHEMA demo');
GO

/* =====================================================================================================
   4.2 Reference data (ref). String primary keys equal the ids in the TypeScript source.
   ===================================================================================================== */

IF OBJECT_ID(N'ref.Regions', N'U') IS NULL
BEGIN
CREATE TABLE ref.Regions (   -- catalogue (docs/catalogue-plan.md section 3); seeded from db/seed/catalogue
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Regions PRIMARY KEY,
  Name NVARCHAR(80) NOT NULL, SortOrder INT NOT NULL CONSTRAINT DF_Regions_SortOrder DEFAULT 0
);
END

IF OBJECT_ID(N'ref.Ships', N'U') IS NULL
BEGIN
CREATE TABLE ref.Ships (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Ships PRIMARY KEY,
  Name NVARCHAR(80) NOT NULL, Class NVARCHAR(60) NOT NULL,
  Decks INT NOT NULL, Tonnage INT NOT NULL, Capacity INT NOT NULL,
  HomeZone NVARCHAR(40) NOT NULL,
  ProfileJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Ships_ProfileJson DEFAULT N'{}',
  LengthFt INT NULL, BeamFt INT NULL, Crew INT NULL, Staterooms INT NULL, Entered INT NULL,
  Intro NVARCHAR(1000) NOT NULL CONSTRAINT DF_Ships_Intro DEFAULT N'',
  Depth VARCHAR(6) NOT NULL CONSTRAINT DF_Ships_Depth DEFAULT 'aboard',   -- browse = facts and categories only; aboard = decks, cabins, menus, programme
  CONSTRAINT CK_Ships_Depth CHECK (Depth IN ('browse','aboard')),
  CONSTRAINT CK_Ships_ProfileJson CHECK (ISJSON(ProfileJson) = 1),
  CONSTRAINT CK_Ships_Sizes CHECK (Decks > 0 AND Tonnage > 0 AND Capacity > 0)
);
END

IF OBJECT_ID(N'ref.Decks', N'U') IS NULL
BEGIN
CREATE TABLE ref.Decks (
  ShipId NVARCHAR(40) NOT NULL, Number INT NOT NULL,
  Name NVARCHAR(80) NOT NULL, Summary NVARCHAR(500) NOT NULL CONSTRAINT DF_Decks_Summary DEFAULT N'',
  CONSTRAINT PK_Decks PRIMARY KEY (ShipId, Number),
  CONSTRAINT FK_Decks_Ships FOREIGN KEY (ShipId) REFERENCES ref.Ships (Id)
);
END

IF OBJECT_ID(N'ref.CabinCategories', N'U') IS NULL
BEGIN
CREATE TABLE ref.CabinCategories (
  Id NVARCHAR(30) NOT NULL CONSTRAINT PK_CabinCategories PRIMARY KEY,
  Name NVARCHAR(80) NOT NULL, IsSuite BIT NOT NULL CONSTRAINT DF_CabinCategories_IsSuite DEFAULT 0,
  Capacity INT NOT NULL, SizeSqFt INT NOT NULL,
  Description NVARCHAR(1000) NOT NULL CONSTRAINT DF_CabinCategories_Description DEFAULT N'',
  Features NVARCHAR(MAX) NOT NULL CONSTRAINT DF_CabinCategories_Features DEFAULT N'[]',
  SortOrder INT NOT NULL CONSTRAINT DF_CabinCategories_SortOrder DEFAULT 0,
  ShipId NVARCHAR(40) NOT NULL CONSTRAINT DF_CabinCategories_ShipId DEFAULT N'sun-princess',
  CONSTRAINT FK_CabinCategories_Ships FOREIGN KEY (ShipId) REFERENCES ref.Ships (Id),
  CONSTRAINT CK_CabinCategories_Features CHECK (ISJSON(Features) = 1),
  CONSTRAINT CK_CabinCategories_Capacity CHECK (Capacity > 0)
);
END

IF OBJECT_ID(N'ref.MusterStations', N'U') IS NULL
BEGIN
CREATE TABLE ref.MusterStations (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_MusterStations PRIMARY KEY,
  ShipId NVARCHAR(40) NOT NULL, Name NVARCHAR(80) NOT NULL, Place NVARCHAR(120) NOT NULL, Deck INT NOT NULL,
  CONSTRAINT FK_MusterStations_Ships FOREIGN KEY (ShipId) REFERENCES ref.Ships (Id)
);
END

IF OBJECT_ID(N'ref.Cabins', N'U') IS NULL
BEGIN
CREATE TABLE ref.Cabins (
  ShipId NVARCHAR(40) NOT NULL, Number NVARCHAR(8) NOT NULL,
  CategoryId NVARCHAR(30) NOT NULL, Deck INT NOT NULL,
  Section VARCHAR(3) NOT NULL, Side VARCHAR(9) NOT NULL,
  Accessible BIT NOT NULL CONSTRAINT DF_Cabins_Accessible DEFAULT 0, Connecting BIT NOT NULL CONSTRAINT DF_Cabins_Connecting DEFAULT 0,
  MusterStationId NVARCHAR(40) NOT NULL,
  CONSTRAINT PK_Cabins PRIMARY KEY (ShipId, Number),
  CONSTRAINT FK_Cabins_Ships FOREIGN KEY (ShipId) REFERENCES ref.Ships (Id),
  CONSTRAINT FK_Cabins_CabinCategories FOREIGN KEY (CategoryId) REFERENCES ref.CabinCategories (Id),
  CONSTRAINT FK_Cabins_Decks FOREIGN KEY (ShipId, Deck) REFERENCES ref.Decks (ShipId, Number),
  CONSTRAINT FK_Cabins_MusterStations FOREIGN KEY (MusterStationId) REFERENCES ref.MusterStations (Id),
  CONSTRAINT CK_Cabins_Section CHECK (Section IN ('fwd','mid','aft')),
  CONSTRAINT CK_Cabins_Side CHECK (Side IN ('port','starboard'))
);
CREATE INDEX IX_Cabins_ShipId_CategoryId ON ref.Cabins (ShipId, CategoryId);   -- booking.cabins lists free cabins by category
END

IF OBJECT_ID(N'ref.Ports', N'U') IS NULL
BEGIN
CREATE TABLE ref.Ports (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Ports PRIMARY KEY,
  Name NVARCHAR(80) NOT NULL, Country NVARCHAR(80) NOT NULL CONSTRAINT DF_Ports_Country DEFAULT N'',
  TimeZone NVARCHAR(40) NOT NULL, Tender BIT NOT NULL CONSTRAINT DF_Ports_Tender DEFAULT 0,
  EntryNote NVARCHAR(1000) NOT NULL CONSTRAINT DF_Ports_EntryNote DEFAULT N'',
  Contacts NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Ports_Contacts DEFAULT N'[]',
  RegionId NVARCHAR(40) NULL, CountryCode CHAR(2) NULL, Lat DECIMAL(9,6) NULL, Lon DECIMAL(9,6) NULL,
  Currency CHAR(3) NULL, Languages NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Ports_Languages DEFAULT N'[]',
  Tier CHAR(1) NULL, GuideStatus VARCHAR(10) NOT NULL CONSTRAINT DF_Ports_GuideStatus DEFAULT 'none',   -- none | link | short | full
  ArtId NVARCHAR(40) NULL,
  CONSTRAINT FK_Ports_Regions FOREIGN KEY (RegionId) REFERENCES ref.Regions (Id),
  CONSTRAINT CK_Ports_Tier CHECK (Tier IS NULL OR Tier IN ('A','B','C')),
  CONSTRAINT CK_Ports_GuideStatus CHECK (GuideStatus IN ('none','link','short','full')),
  CONSTRAINT CK_Ports_Languages CHECK (ISJSON(Languages) = 1),
  CONSTRAINT CK_Ports_Contacts CHECK (ISJSON(Contacts) = 1)
);
END

IF OBJECT_ID(N'ref.Terminals', N'U') IS NULL
BEGIN
CREATE TABLE ref.Terminals (   -- optional: where the ship berths, per port
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Terminals PRIMARY KEY,
  PortId NVARCHAR(40) NOT NULL, Name NVARCHAR(120) NOT NULL,
  Address NVARCHAR(300) NOT NULL CONSTRAINT DF_Terminals_Address DEFAULT N'', Notes NVARCHAR(1000) NOT NULL CONSTRAINT DF_Terminals_Notes DEFAULT N'',
  CONSTRAINT FK_Terminals_Ports FOREIGN KEY (PortId) REFERENCES ref.Ports (Id)
);
END

IF OBJECT_ID(N'ref.ItineraryPatterns', N'U') IS NULL
BEGIN
CREATE TABLE ref.ItineraryPatterns (   -- a repeating shape: Eastern, Western A, Greek Isles ...
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_ItineraryPatterns PRIMARY KEY,
  Name NVARCHAR(120) NOT NULL, RegionId NVARCHAR(40) NOT NULL, Nights INT NOT NULL,
  StartPortId NVARCHAR(40) NOT NULL, EndPortId NVARCHAR(40) NOT NULL, Description NVARCHAR(1000) NOT NULL CONSTRAINT DF_ItineraryPatterns_Description DEFAULT N'',
  CONSTRAINT FK_ItineraryPatterns_Regions FOREIGN KEY (RegionId) REFERENCES ref.Regions (Id),
  CONSTRAINT FK_ItineraryPatterns_StartPort FOREIGN KEY (StartPortId) REFERENCES ref.Ports (Id),
  CONSTRAINT FK_ItineraryPatterns_EndPort FOREIGN KEY (EndPortId) REFERENCES ref.Ports (Id),
  CONSTRAINT CK_ItineraryPatterns_Nights CHECK (Nights > 0)
);
END

IF OBJECT_ID(N'ref.ItineraryPatternDays', N'U') IS NULL
BEGIN
CREATE TABLE ref.ItineraryPatternDays (
  PatternId NVARCHAR(40) NOT NULL, [Day] INT NOT NULL, PortId NVARCHAR(40) NOT NULL,   -- PortId 'sea' for a sea day
  ArriveLocal TIME(0) NULL, DepartLocal TIME(0) NULL, AllAboardLocal TIME(0) NULL,
  ClockChangeHours INT NULL, ClockChangeAtLocal TIME(0) NULL,
  CONSTRAINT PK_ItineraryPatternDays PRIMARY KEY (PatternId, [Day]),
  CONSTRAINT FK_ItineraryPatternDays_Patterns FOREIGN KEY (PatternId) REFERENCES ref.ItineraryPatterns (Id),
  CONSTRAINT FK_ItineraryPatternDays_Ports FOREIGN KEY (PortId) REFERENCES ref.Ports (Id)
);
END

IF OBJECT_ID(N'ref.Sailings', N'U') IS NULL
BEGIN
CREATE TABLE ref.Sailings (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Sailings PRIMARY KEY,
  ShipId NVARCHAR(40) NOT NULL, Departure DATE NOT NULL, Nights INT NOT NULL,
  IsHoliday BIT NOT NULL CONSTRAINT DF_Sailings_IsHoliday DEFAULT 0, IsReference BIT NOT NULL CONSTRAINT DF_Sailings_IsReference DEFAULT 0,
  Title NVARCHAR(120) NOT NULL,
  BookingOpen BIT NOT NULL CONSTRAINT DF_Sailings_BookingOpen DEFAULT 1,   -- manual close only; "1 day to go" is computed in the API
  PatternId NVARCHAR(40) NULL,   -- the first leg's pattern; NULL for a custom route
  StartPortId NVARCHAR(40) NULL, EndPortId NVARCHAR(40) NULL, LegCount INT NOT NULL CONSTRAINT DF_Sailings_LegCount DEFAULT 1,
  RegionId NVARCHAR(40) NULL,
  DataStatus VARCHAR(8) NOT NULL CONSTRAINT DF_Sailings_DataStatus DEFAULT 'served',   -- served | sample (dates and ports to be confirmed) | verified
  CONSTRAINT FK_Sailings_Ships FOREIGN KEY (ShipId) REFERENCES ref.Ships (Id),
  CONSTRAINT FK_Sailings_Patterns FOREIGN KEY (PatternId) REFERENCES ref.ItineraryPatterns (Id),
  CONSTRAINT FK_Sailings_StartPort FOREIGN KEY (StartPortId) REFERENCES ref.Ports (Id),
  CONSTRAINT FK_Sailings_EndPort FOREIGN KEY (EndPortId) REFERENCES ref.Ports (Id),
  CONSTRAINT FK_Sailings_Regions FOREIGN KEY (RegionId) REFERENCES ref.Regions (Id),
  CONSTRAINT CK_Sailings_DataStatus CHECK (DataStatus IN ('served','sample','verified')),
  CONSTRAINT CK_Sailings_Nights CHECK (Nights > 0 AND LegCount > 0)
);
CREATE INDEX IX_Sailings_Departure ON ref.Sailings (Departure);
-- One ship can offer the same departure as a single leg and as joined legs (7, 14 and 21 nights), so Nights is part of the key.
CREATE UNIQUE INDEX UX_Sailings_ShipId_Departure_Nights ON ref.Sailings (ShipId, Departure, Nights);
CREATE INDEX IX_Sailings_RegionId ON ref.Sailings (RegionId);
END

IF OBJECT_ID(N'ref.ItineraryDays', N'U') IS NULL
BEGIN
CREATE TABLE ref.ItineraryDays (
  SailingId NVARCHAR(40) NOT NULL, [Day] INT NOT NULL, [Date] DATE NOT NULL, PortId NVARCHAR(40) NOT NULL,
  ArriveLocal TIME(0) NULL, DepartLocal TIME(0) NULL, AllAboardLocal TIME(0) NULL,
  ClockChangeHours INT NULL, ClockChangeAtLocal TIME(0) NULL,
  CONSTRAINT PK_ItineraryDays PRIMARY KEY (SailingId, [Day]),
  CONSTRAINT FK_ItineraryDays_Sailings FOREIGN KEY (SailingId) REFERENCES ref.Sailings (Id),
  CONSTRAINT FK_ItineraryDays_Ports FOREIGN KEY (PortId) REFERENCES ref.Ports (Id)
);
CREATE UNIQUE INDEX UX_ItineraryDays_SailingId_Date ON ref.ItineraryDays (SailingId, [Date]);
CREATE INDEX IX_ItineraryDays_PortId ON ref.ItineraryDays (PortId);
END

IF OBJECT_ID(N'ref.SailingLegs', N'U') IS NULL
BEGIN
CREATE TABLE ref.SailingLegs (   -- which pattern each leg of a sailing follows; StartDay is the sailing day the leg begins on
  SailingId NVARCHAR(40) NOT NULL, LegNo INT NOT NULL, PatternId NVARCHAR(40) NOT NULL, StartDay INT NOT NULL,
  CONSTRAINT PK_SailingLegs PRIMARY KEY (SailingId, LegNo),
  CONSTRAINT FK_SailingLegs_Sailings FOREIGN KEY (SailingId) REFERENCES ref.Sailings (Id),
  CONSTRAINT FK_SailingLegs_Patterns FOREIGN KEY (PatternId) REFERENCES ref.ItineraryPatterns (Id),
  CONSTRAINT CK_SailingLegs_Numbers CHECK (LegNo > 0 AND StartDay > 0)
);
END

IF OBJECT_ID(N'ref.SailingFares', N'U') IS NULL
BEGIN
CREATE TABLE ref.SailingFares (   -- price in data: per person per night for two sharing, in cents; replaces the code dictionaries in X0c
  SailingId NVARCHAR(40) NOT NULL, CategoryId NVARCHAR(30) NOT NULL, PerNightCents BIGINT NOT NULL,
  CONSTRAINT PK_SailingFares PRIMARY KEY (SailingId, CategoryId),
  CONSTRAINT FK_SailingFares_Sailings FOREIGN KEY (SailingId) REFERENCES ref.Sailings (Id),
  CONSTRAINT FK_SailingFares_CabinCategories FOREIGN KEY (CategoryId) REFERENCES ref.CabinCategories (Id),
  CONSTRAINT CK_SailingFares_Price CHECK (PerNightCents > 0)
);
END

IF OBJECT_ID(N'ref.DressNights', N'U') IS NULL
BEGIN
CREATE TABLE ref.DressNights (   -- the dinner dress code per sailing day, worked out at seed time from the sailing's length
  SailingId NVARCHAR(40) NOT NULL, [Day] INT NOT NULL, Code VARCHAR(8) NOT NULL,
  CONSTRAINT PK_DressNights PRIMARY KEY (SailingId, [Day]),
  CONSTRAINT FK_DressNights_Sailings FOREIGN KEY (SailingId) REFERENCES ref.Sailings (Id),
  CONSTRAINT CK_DressNights_Code CHECK (Code IN ('casual','smart','elegant'))
);
END

IF OBJECT_ID(N'ref.Venues', N'U') IS NULL
BEGIN
CREATE TABLE ref.Venues (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Venues PRIMARY KEY,
  Kind VARCHAR(10) NOT NULL, Name NVARCHAR(80) NOT NULL, Cuisine NVARCHAR(80) NOT NULL CONSTRAINT DF_Venues_Cuisine DEFAULT N'',
  Deck INT NOT NULL, DressCode VARCHAR(10) NOT NULL CONSTRAINT DF_Venues_DressCode DEFAULT 'casual', Capacity INT NOT NULL,
  Walkin BIT NOT NULL CONSTRAINT DF_Venues_Walkin DEFAULT 0, OpenFrom TIME(0) NOT NULL, OpenTo TIME(0) NOT NULL,
  CoverCents BIGINT NOT NULL CONSTRAINT DF_Venues_CoverCents DEFAULT 0, Description NVARCHAR(1000) NOT NULL CONSTRAINT DF_Venues_Description DEFAULT N'',
  Hours NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Venues_Hours DEFAULT N'{}',
  ShipId NVARCHAR(40) NOT NULL CONSTRAINT DF_Venues_ShipId DEFAULT N'sun-princess',
  CONSTRAINT FK_Venues_Ships FOREIGN KEY (ShipId) REFERENCES ref.Ships (Id),
  CONSTRAINT CK_Venues_Kind CHECK (Kind IN ('main','specialty','casual')),
  CONSTRAINT CK_Venues_DressCode CHECK (DressCode IN ('casual','smart','elegant')),
  CONSTRAINT CK_Venues_Hours CHECK (ISJSON(Hours) = 1),
  CONSTRAINT CK_Venues_Amounts CHECK (Capacity >= 0 AND CoverCents >= 0)
);
END

IF OBJECT_ID(N'ref.MenuItems', N'U') IS NULL
BEGIN
CREATE TABLE ref.MenuItems (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_MenuItems PRIMARY KEY,
  VenueId NVARCHAR(40) NULL, MenuGroup VARCHAR(10) NOT NULL,
  Name NVARCHAR(120) NOT NULL, Description NVARCHAR(500) NOT NULL CONSTRAINT DF_MenuItems_Description DEFAULT N'',
  PriceCents BIGINT NOT NULL CONSTRAINT DF_MenuItems_PriceCents DEFAULT 0,
  Dietary NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MenuItems_Dietary DEFAULT N'[]',
  Orderable BIT NOT NULL CONSTRAINT DF_MenuItems_Orderable DEFAULT 1, Stock INT NULL,
  Alcohol BIT NOT NULL CONSTRAINT DF_MenuItems_Alcohol DEFAULT 0, Packaged BIT NOT NULL CONSTRAINT DF_MenuItems_Packaged DEFAULT 0,   -- Packaged: a drinks package pays for it
  OnMenus NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MenuItems_OnMenus DEFAULT N'[]',   -- which menus carry it: delivery, room
  SubstituteId NVARCHAR(40) NULL,   -- offered in its place when it runs out
  ShipId NVARCHAR(40) NOT NULL CONSTRAINT DF_MenuItems_ShipId DEFAULT N'sun-princess',
  CONSTRAINT FK_MenuItems_Ships FOREIGN KEY (ShipId) REFERENCES ref.Ships (Id),
  CONSTRAINT FK_MenuItems_Venues FOREIGN KEY (VenueId) REFERENCES ref.Venues (Id),
  CONSTRAINT FK_MenuItems_MenuItems_Substitute FOREIGN KEY (SubstituteId) REFERENCES ref.MenuItems (Id),
  CONSTRAINT CK_MenuItems_MenuGroup CHECK (MenuGroup IN ('mains','snacks','desserts','drinks','breakfast')),
  CONSTRAINT CK_MenuItems_Dietary CHECK (ISJSON(Dietary) = 1),
  CONSTRAINT CK_MenuItems_OnMenus CHECK (ISJSON(OnMenus) = 1),
  CONSTRAINT CK_MenuItems_PriceCents CHECK (PriceCents >= 0)
);
CREATE INDEX IX_MenuItems_VenueId ON ref.MenuItems (VenueId);
END

IF OBJECT_ID(N'ref.MenuExtras', N'U') IS NULL
BEGIN
CREATE TABLE ref.MenuExtras (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_MenuExtras PRIMARY KEY,
  ItemId NVARCHAR(40) NOT NULL, Label NVARCHAR(80) NOT NULL, Cents BIGINT NOT NULL CONSTRAINT DF_MenuExtras_Cents DEFAULT 0,
  CONSTRAINT FK_MenuExtras_MenuItems FOREIGN KEY (ItemId) REFERENCES ref.MenuItems (Id),
  CONSTRAINT CK_MenuExtras_Cents CHECK (Cents >= 0)
);
CREATE INDEX IX_MenuExtras_ItemId ON ref.MenuExtras (ItemId);
END

IF OBJECT_ID(N'ref.Excursions', N'U') IS NULL
BEGIN
CREATE TABLE ref.Excursions (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Excursions PRIMARY KEY,
  PortId NVARCHAR(40) NOT NULL, Name NVARCHAR(120) NOT NULL, Interest NVARCHAR(30) NOT NULL,
  Activity VARCHAR(10) NOT NULL, AdultCents BIGINT NOT NULL, ChildCents BIGINT NOT NULL,
  MinAge INT NOT NULL CONSTRAINT DF_Excursions_MinAge DEFAULT 0, DurationMin INT NOT NULL,
  StartLocal TIME(0) NOT NULL, BackByLocal TIME(0) NOT NULL, Tender BIT NOT NULL CONSTRAINT DF_Excursions_Tender DEFAULT 0,
  Capacity INT NOT NULL, Meeting NVARCHAR(200) NOT NULL CONSTRAINT DF_Excursions_Meeting DEFAULT N'', Description NVARCHAR(1000) NOT NULL CONSTRAINT DF_Excursions_Description DEFAULT N'',
  Tags NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Excursions_Tags DEFAULT N'[]',
  ShipId NVARCHAR(40) NOT NULL CONSTRAINT DF_Excursions_ShipId DEFAULT N'sun-princess',
  CONSTRAINT FK_Excursions_Ships FOREIGN KEY (ShipId) REFERENCES ref.Ships (Id),
  Rating INT NOT NULL CONSTRAINT DF_Excursions_Rating DEFAULT 0, Reviews INT NOT NULL CONSTRAINT DF_Excursions_Reviews DEFAULT 0,   -- Rating in tenths of a star (47 = 4.7)
  WalkKm DECIMAL(4,1) NULL, Steps BIT NULL, Heat VARCHAR(6) NULL, Shade VARCHAR(6) NULL, Seats BIT NULL, Restrooms BIT NULL, Wet BIT NULL,   -- difficulty on foot (NULL = none authored)
  CONSTRAINT FK_Excursions_Ports FOREIGN KEY (PortId) REFERENCES ref.Ports (Id),
  CONSTRAINT CK_Excursions_Activity CHECK (Activity IN ('easy','moderate','strenuous')),
  CONSTRAINT CK_Excursions_Tags CHECK (ISJSON(Tags) = 1),
  CONSTRAINT CK_Excursions_Amounts CHECK (AdultCents >= 0 AND ChildCents >= 0 AND MinAge >= 0 AND DurationMin > 0 AND Capacity > 0),
  CONSTRAINT CK_Excursions_Rating CHECK (Rating BETWEEN 0 AND 50 AND Reviews >= 0)
);
CREATE INDEX IX_Excursions_PortId ON ref.Excursions (PortId);
END

IF OBJECT_ID(N'ref.ExcursionDepartures', N'U') IS NULL
BEGIN
CREATE TABLE ref.ExcursionDepartures (
  ExcursionId NVARCHAR(40) NOT NULL, SailingId NVARCHAR(40) NOT NULL, [Day] INT NOT NULL, SpotsTotal INT NOT NULL,
  CONSTRAINT PK_ExcursionDepartures PRIMARY KEY (ExcursionId, SailingId, [Day]),
  CONSTRAINT FK_ExcursionDepartures_Excursions FOREIGN KEY (ExcursionId) REFERENCES ref.Excursions (Id),
  CONSTRAINT FK_ExcursionDepartures_ItineraryDays FOREIGN KEY (SailingId, [Day]) REFERENCES ref.ItineraryDays (SailingId, [Day]),
  CONSTRAINT CK_ExcursionDepartures_SpotsTotal CHECK (SpotsTotal >= 0)
);
CREATE INDEX IX_ExcursionDepartures_SailingId_Day ON ref.ExcursionDepartures (SailingId, [Day]);   -- tours running on a day
END

IF OBJECT_ID(N'ref.Events', N'U') IS NULL
BEGIN
CREATE TABLE ref.Events (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Events PRIMARY KEY,
  Kind NVARCHAR(30) NOT NULL, Title NVARCHAR(120) NOT NULL, Place NVARCHAR(40) NOT NULL,
  StartLocal TIME(0) NOT NULL, DurationMin INT NOT NULL,
  AgeGroup VARCHAR(6) NOT NULL CONSTRAINT DF_Events_AgeGroup DEFAULT 'all',
  Interests NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Events_Interests DEFAULT N'[]',
  Ticketed BIT NOT NULL CONSTRAINT DF_Events_Ticketed DEFAULT 0, Seats INT NULL, Deck INT NULL,
  ExtraCents BIGINT NOT NULL CONSTRAINT DF_Events_ExtraCents DEFAULT 0,   -- extra cost per person; 0 is in the fare
  AfterAllAboard BIT NOT NULL CONSTRAINT DF_Events_AfterAllAboard DEFAULT 0,  -- on a port day, listed only once the ship is back aboard
  ShipId NVARCHAR(40) NOT NULL CONSTRAINT DF_Events_ShipId DEFAULT N'sun-princess',
  CONSTRAINT FK_Events_Ships FOREIGN KEY (ShipId) REFERENCES ref.Ships (Id),
  CONSTRAINT CK_Events_AgeGroup CHECK (AgeGroup IN ('all','kids','teens','adults')),
  CONSTRAINT CK_Events_Interests CHECK (ISJSON(Interests) = 1),
  CONSTRAINT CK_Events_Amounts CHECK (DurationMin > 0 AND ExtraCents >= 0)
);
END

IF OBJECT_ID(N'ref.EventDays', N'U') IS NULL
BEGIN
CREATE TABLE ref.EventDays (
  EventId NVARCHAR(40) NOT NULL, SailingId NVARCHAR(40) NOT NULL, [Day] INT NOT NULL,
  StatusOverride NVARCHAR(20) NULL,
  CONSTRAINT PK_EventDays PRIMARY KEY (EventId, SailingId, [Day]),
  CONSTRAINT FK_EventDays_Events FOREIGN KEY (EventId) REFERENCES ref.Events (Id),
  CONSTRAINT FK_EventDays_ItineraryDays FOREIGN KEY (SailingId, [Day]) REFERENCES ref.ItineraryDays (SailingId, [Day])
);
CREATE INDEX IX_EventDays_SailingId_Day ON ref.EventDays (SailingId, [Day]);   -- shows.day
END

IF OBJECT_ID(N'ref.Fares', N'U') IS NULL
BEGIN
CREATE TABLE ref.Fares (
  Id NVARCHAR(30) NOT NULL CONSTRAINT PK_Fares PRIMARY KEY,
  Name NVARCHAR(60) NOT NULL, PerNightCents BIGINT NOT NULL, Tagline NVARCHAR(200) NOT NULL CONSTRAINT DF_Fares_Tagline DEFAULT N'',
  CONSTRAINT CK_Fares_PerNightCents CHECK (PerNightCents >= 0)
);
END

IF OBJECT_ID(N'ref.Promotions', N'U') IS NULL
BEGIN
CREATE TABLE ref.Promotions (
  Id NVARCHAR(30) NOT NULL CONSTRAINT PK_Promotions PRIMARY KEY,
  MinDaysOut INT NOT NULL, CreditCentsStandard BIGINT NOT NULL, CreditCentsSuite BIGINT NOT NULL,
  CONSTRAINT CK_Promotions_Amounts CHECK (MinDaysOut >= 0 AND CreditCentsStandard >= 0 AND CreditCentsSuite >= 0)
);
END

IF OBJECT_ID(N'ref.Packages', N'U') IS NULL
BEGIN
CREATE TABLE ref.Packages (
  Id NVARCHAR(30) NOT NULL CONSTRAINT PK_Packages PRIMARY KEY,
  Name NVARCHAR(80) NOT NULL, Unit VARCHAR(11) NOT NULL, BaseCents BIGINT NOT NULL,
  ChangeOn DATE NULL, ChangesToCents BIGINT NULL, Description NVARCHAR(500) NOT NULL CONSTRAINT DF_Packages_Description DEFAULT N'',
  CONSTRAINT CK_Packages_Unit CHECK (Unit IN ('personNight','person','room')),
  CONSTRAINT CK_Packages_BaseCents CHECK (BaseCents >= 0)
);
END

IF OBJECT_ID(N'ref.AddOns', N'U') IS NULL
BEGIN
CREATE TABLE ref.AddOns (
  Id NVARCHAR(30) NOT NULL CONSTRAINT PK_AddOns PRIMARY KEY,
  Name NVARCHAR(80) NOT NULL, Unit VARCHAR(11) NOT NULL, BaseCents BIGINT NOT NULL,
  ChangeOn DATE NULL, ChangesToCents BIGINT NULL, Description NVARCHAR(500) NOT NULL CONSTRAINT DF_AddOns_Description DEFAULT N'',
  ChangeAtDays INT NULL, ChangeShare INT NULL, MinAge INT NOT NULL CONSTRAINT DF_AddOns_MinAge DEFAULT 0,   -- price moves ChangeShare basis points (+up, -down) from ChangeAtDays before sailing; ChangeOn/ChangesToCents are that rule worked out for the reference sailing
  CONSTRAINT CK_AddOns_Unit CHECK (Unit IN ('personNight','person','room')),
  CONSTRAINT CK_AddOns_BaseCents CHECK (BaseCents >= 0 AND MinAge >= 0)
);
END

IF OBJECT_ID(N'ref.PackageUpgrades', N'U') IS NULL
BEGIN
CREATE TABLE ref.PackageUpgrades (
  ToPackageId NVARCHAR(30) NOT NULL CONSTRAINT PK_PackageUpgrades PRIMARY KEY,
  PriceCents BIGINT NOT NULL, ChangeOn DATE NULL, ChangesToCents BIGINT NULL,
  ChangeAtDays INT NULL, ChangeShare INT NULL,   -- as AddOns; PriceCents is the price from "no package"
  CONSTRAINT FK_PackageUpgrades_Packages FOREIGN KEY (ToPackageId) REFERENCES ref.Packages (Id),
  CONSTRAINT CK_PackageUpgrades_PriceCents CHECK (PriceCents >= 0)
);
END

IF OBJECT_ID(N'ref.Entitlements', N'U') IS NULL
BEGIN
CREATE TABLE ref.Entitlements (
  SourceKind VARCHAR(7) NOT NULL, SourceId NVARCHAR(30) NOT NULL,   -- a loyalty tier or a package id
  DrinkCapUsd INT NOT NULL CONSTRAINT DF_Entitlements_DrinkCapUsd DEFAULT 0, WifiDevices INT NOT NULL CONSTRAINT DF_Entitlements_WifiDevices DEFAULT 0, SpecialtyMeals INT NOT NULL CONSTRAINT DF_Entitlements_SpecialtyMeals DEFAULT 0,
  ExcursionCreditUsd INT NOT NULL CONSTRAINT DF_Entitlements_ExcursionCreditUsd DEFAULT 0, PhotoIncluded BIT NOT NULL CONSTRAINT DF_Entitlements_PhotoIncluded DEFAULT 0, LaundryBags INT NOT NULL CONSTRAINT DF_Entitlements_LaundryBags DEFAULT 0,
  Priority BIT NOT NULL CONSTRAINT DF_Entitlements_Priority DEFAULT 0,
  CONSTRAINT PK_Entitlements PRIMARY KEY (SourceKind, SourceId),
  CONSTRAINT CK_Entitlements_SourceKind CHECK (SourceKind IN ('tier','package'))
);
END

IF OBJECT_ID(N'ref.PhotoCatalogue', N'U') IS NULL
BEGIN
CREATE TABLE ref.PhotoCatalogue (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_PhotoCatalogue PRIMARY KEY,
  [Day] INT NOT NULL, Place NVARCHAR(80) NOT NULL, Caption NVARCHAR(200) NOT NULL CONSTRAINT DF_PhotoCatalogue_Caption DEFAULT N'', Thumb NVARCHAR(200) NOT NULL
);
END

IF OBJECT_ID(N'ref.PhotographerSlots', N'U') IS NULL
BEGIN
CREATE TABLE ref.PhotographerSlots (
  [Day] INT NOT NULL, Place NVARCHAR(80) NOT NULL, StartLocal TIME(0) NOT NULL,
  CONSTRAINT PK_PhotographerSlots PRIMARY KEY ([Day], Place, StartLocal)
);
END

IF OBJECT_ID(N'ref.PhotoOptions', N'U') IS NULL
BEGIN
CREATE TABLE ref.PhotoOptions (
  Id NVARCHAR(30) NOT NULL CONSTRAINT PK_PhotoOptions PRIMARY KEY,
  Cents BIGINT NOT NULL, PhotoCount INT NOT NULL, Description NVARCHAR(200) NOT NULL CONSTRAINT DF_PhotoOptions_Description DEFAULT N'',
  CONSTRAINT CK_PhotoOptions_Amounts CHECK (Cents >= 0 AND PhotoCount >= 0)
);
END

IF OBJECT_ID(N'ref.CrewMembers', N'U') IS NULL
BEGIN
CREATE TABLE ref.CrewMembers (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_CrewMembers PRIMARY KEY,
  ShipId NVARCHAR(40) NOT NULL, Name NVARCHAR(80) NOT NULL, Role VARCHAR(13) NOT NULL,
  CONSTRAINT FK_CrewMembers_Ships FOREIGN KEY (ShipId) REFERENCES ref.Ships (Id),
  CONSTRAINT CK_CrewMembers_Role CHECK (Role IN ('steward','dining','entertainment','guest'))
);
END

IF OBJECT_ID(N'ref.Advisors', N'U') IS NULL
BEGIN
CREATE TABLE ref.Advisors (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Advisors PRIMARY KEY,
  Name NVARCHAR(80) NOT NULL, Agency NVARCHAR(80) NOT NULL CONSTRAINT DF_Advisors_Agency DEFAULT N'', Region NVARCHAR(60) NOT NULL CONSTRAINT DF_Advisors_Region DEFAULT N'',
  Languages NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Advisors_Languages DEFAULT N'[]',
  Speciality VARCHAR(10) NOT NULL, Hours NVARCHAR(120) NOT NULL CONSTRAINT DF_Advisors_Hours DEFAULT N'',
  CONSTRAINT CK_Advisors_Languages CHECK (ISJSON(Languages) = 1),
  CONSTRAINT CK_Advisors_Speciality CHECK (Speciality IN ('family','luxury','accessible','groups','first'))
);
END

IF OBJECT_ID(N'ref.Faqs', N'U') IS NULL
BEGIN
CREATE TABLE ref.Faqs (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Faqs PRIMARY KEY,
  Area NVARCHAR(40) NOT NULL, Title NVARCHAR(200) NOT NULL, Body NVARCHAR(MAX) NOT NULL,
  Locale NVARCHAR(10) NOT NULL CONSTRAINT DF_Faqs_Locale DEFAULT N'en', SortOrder INT NOT NULL CONSTRAINT DF_Faqs_SortOrder DEFAULT 0
);
END

IF OBJECT_ID(N'ref.HelpTopics', N'U') IS NULL
BEGIN
CREATE TABLE ref.HelpTopics (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_HelpTopics PRIMARY KEY,
  Area NVARCHAR(40) NOT NULL, Title NVARCHAR(200) NOT NULL, Body NVARCHAR(MAX) NOT NULL,
  Locale NVARCHAR(10) NOT NULL CONSTRAINT DF_HelpTopics_Locale DEFAULT N'en', SortOrder INT NOT NULL CONSTRAINT DF_HelpTopics_SortOrder DEFAULT 0
);
END

IF OBJECT_ID(N'ref.ContentBlocks', N'U') IS NULL
BEGIN
CREATE TABLE ref.ContentBlocks (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_ContentBlocks PRIMARY KEY,
  Area NVARCHAR(40) NOT NULL, Title NVARCHAR(200) NOT NULL, Body NVARCHAR(MAX) NOT NULL,
  Locale NVARCHAR(10) NOT NULL CONSTRAINT DF_ContentBlocks_Locale DEFAULT N'en', SortOrder INT NOT NULL CONSTRAINT DF_ContentBlocks_SortOrder DEFAULT 0
);
END

IF OBJECT_ID(N'ref.LegalDocs', N'U') IS NULL
BEGIN
CREATE TABLE ref.LegalDocs (
  Id NVARCHAR(30) NOT NULL, Version INT NOT NULL, Title NVARCHAR(200) NOT NULL, Statement NVARCHAR(1000) NOT NULL,
  Body NVARCHAR(MAX) NOT NULL CONSTRAINT DF_LegalDocs_Body DEFAULT N'[]',
  CONSTRAINT PK_LegalDocs PRIMARY KEY (Id, Version),
  CONSTRAINT CK_LegalDocs_Body CHECK (ISJSON(Body) = 1)
);
END

IF OBJECT_ID(N'ref.ServiceItems', N'U') IS NULL
BEGIN
CREATE TABLE ref.ServiceItems (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_ServiceItems PRIMARY KEY,
  ItemGroup VARCHAR(12) NOT NULL, EtaMin INT NOT NULL, MaxQty INT NOT NULL CONSTRAINT DF_ServiceItems_MaxQty DEFAULT 1,
  CONSTRAINT CK_ServiceItems_Group CHECK (ItemGroup IN ('housekeeping','maintenance'))
);
END

IF OBJECT_ID(N'ref.Drinks', N'U') IS NULL
BEGIN
CREATE TABLE ref.Drinks (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Drinks PRIMARY KEY,
  Cents BIGINT NOT NULL, Alcohol BIT NOT NULL CONSTRAINT DF_Drinks_Alcohol DEFAULT 0,
  CONSTRAINT CK_Drinks_Cents CHECK (Cents >= 0)
);
END

IF OBJECT_ID(N'ref.Clubs', N'U') IS NULL
BEGIN
CREATE TABLE ref.Clubs (
  Id NVARCHAR(30) NOT NULL CONSTRAINT PK_Clubs PRIMARY KEY,
  Name NVARCHAR(80) NOT NULL, MinAge INT NOT NULL, MaxAge INT NOT NULL, Deck INT NOT NULL,
  OpenFrom TIME(0) NOT NULL, OpenTo TIME(0) NOT NULL,
  CONSTRAINT CK_Clubs_Ages CHECK (MinAge <= MaxAge)
);
END

IF OBJECT_ID(N'ref.TravelWindows', N'U') IS NULL
BEGIN
CREATE TABLE ref.TravelWindows (
  Id NVARCHAR(30) NOT NULL CONSTRAINT PK_TravelWindows PRIMARY KEY,
  StartLocal TIME(0) NOT NULL, EndLocal TIME(0) NOT NULL, Priority BIT NOT NULL CONSTRAINT DF_TravelWindows_Priority DEFAULT 0
);
END

IF OBJECT_ID(N'ref.NightChecklistItems', N'U') IS NULL
BEGIN
CREATE TABLE ref.NightChecklistItems (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_NightChecklistItems PRIMARY KEY,
  Label NVARCHAR(200) NOT NULL, SortOrder INT NOT NULL CONSTRAINT DF_NightChecklistItems_SortOrder DEFAULT 0
);
END

IF OBJECT_ID(N'ref.PackingItems', N'U') IS NULL
BEGIN
CREATE TABLE ref.PackingItems (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_PackingItems PRIMARY KEY,
  Label NVARCHAR(200) NOT NULL,
  RuleJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_PackingItems_RuleJson DEFAULT N'{}',
  CONSTRAINT CK_PackingItems_RuleJson CHECK (ISJSON(RuleJson) = 1)
);
END

IF OBJECT_ID(N'ref.ChecklistItems', N'U') IS NULL
BEGIN
CREATE TABLE ref.ChecklistItems (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_ChecklistItems PRIMARY KEY,
  Phase NVARCHAR(30) NOT NULL, DueDaysBefore INT NOT NULL, Label NVARCHAR(200) NOT NULL
);
END

IF OBJECT_ID(N'ref.DeskSlots', N'U') IS NULL
BEGIN
CREATE TABLE ref.DeskSlots (
  [At] DATETIME2(0) NOT NULL CONSTRAINT PK_DeskSlots PRIMARY KEY,
  Capacity INT NOT NULL CONSTRAINT DF_DeskSlots_Capacity DEFAULT 1
);
END
GO

/* =====================================================================================================
   4.1 Identity (dbo, plus demo.DemoState)
   ===================================================================================================== */

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Users (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Users_PublicId DEFAULT NEWID() CONSTRAINT UX_Users_PublicId UNIQUE,
  Slug NVARCHAR(30) NULL,                       -- seed personas only: gerald, maya ...
  AccountNumber CHAR(10) NOT NULL,
  Email NVARCHAR(254) NULL,
  PasswordHash NVARCHAR(200) NULL,              -- pbkdf2$iter$salt$hash (D12)
  Role VARCHAR(5) NOT NULL CONSTRAINT DF_Users_Role DEFAULT 'guest',
  IsDemo BIT NOT NULL CONSTRAINT DF_Users_IsDemo DEFAULT 0,
  IsSupervised BIT NOT NULL CONSTRAINT DF_Users_IsSupervised DEFAULT 0,
  BookerUserId BIGINT NULL,
  Tier VARCHAR(8) NOT NULL CONSTRAINT DF_Users_Tier DEFAULT 'none',
  Sanctuary BIT NOT NULL CONSTRAINT DF_Users_Sanctuary DEFAULT 0,
  [TextSize] NVARCHAR(12) NOT NULL CONSTRAINT DF_Users_TextSize DEFAULT N'standard',
  PhoneZone NVARCHAR(40) NOT NULL CONSTRAINT DF_Users_PhoneZone DEFAULT N'America/Chicago',
  Currency CHAR(3) NOT NULL CONSTRAINT DF_Users_Currency DEFAULT 'USD',
  Locale NVARCHAR(10) NOT NULL CONSTRAINT DF_Users_Locale DEFAULT N'en',
  LockedUntil DATETIME2(0) NULL,
  FailedLogins INT NOT NULL CONSTRAINT DF_Users_FailedLogins DEFAULT 0,
  LastLoginAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME(),
  RowVersion ROWVERSION NOT NULL,
  CONSTRAINT UX_Users_AccountNumber UNIQUE (AccountNumber),
  CONSTRAINT FK_Users_Users_Booker FOREIGN KEY (BookerUserId) REFERENCES dbo.Users (Id),
  CONSTRAINT CK_Users_AccountNumber CHECK (AccountNumber LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  CONSTRAINT CK_Users_Role CHECK (Role IN ('guest','staff','admin')),
  CONSTRAINT CK_Users_Tier CHECK (Tier IN ('none','gold','ruby','platinum','elite')),
  CONSTRAINT CK_Users_Supervised CHECK (IsSupervised = 0 OR (BookerUserId IS NOT NULL AND PasswordHash IS NULL)),
  CONSTRAINT CK_Users_Password CHECK (IsSupervised = 1 OR IsDemo = 1 OR PasswordHash IS NOT NULL),
  CONSTRAINT CK_Users_Currency CHECK (Currency LIKE '[A-Z][A-Z][A-Z]')
);
CREATE UNIQUE INDEX UX_Users_Email ON dbo.Users (Email) WHERE Email IS NOT NULL;
CREATE UNIQUE INDEX UX_Users_Slug ON dbo.Users (Slug) WHERE Slug IS NOT NULL;
CREATE INDEX IX_Users_BookerUserId ON dbo.Users (BookerUserId) WHERE BookerUserId IS NOT NULL;
END

IF OBJECT_ID(N'dbo.Profiles', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Profiles (
  UserId BIGINT NOT NULL CONSTRAINT PK_Profiles PRIMARY KEY,
  FirstName NVARCHAR(60) NOT NULL, LastName NVARCHAR(60) NOT NULL, Dob DATE NOT NULL,
  Phone NVARCHAR(30) NULL,
  Citizenship VARCHAR(5) NOT NULL CONSTRAINT DF_Profiles_Citizenship DEFAULT 'us',
  Bedding VARCHAR(12) NOT NULL CONSTRAINT DF_Profiles_Bedding DEFAULT 'noPreference',
  SpecialRequests NVARCHAR(500) NOT NULL CONSTRAINT DF_Profiles_SpecialRequests DEFAULT N'',
  EmergencyName NVARCHAR(80) NOT NULL CONSTRAINT DF_Profiles_EmergencyName DEFAULT N'', EmergencyPhone NVARCHAR(30) NOT NULL CONSTRAINT DF_Profiles_EmergencyPhone DEFAULT N'',
  EmergencyRelationship NVARCHAR(40) NOT NULL CONSTRAINT DF_Profiles_EmergencyRelationship DEFAULT N'',
  Street NVARCHAR(120) NULL, City NVARCHAR(80) NULL, Region NVARCHAR(80) NULL, Postcode NVARCHAR(20) NULL, Country NVARCHAR(80) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Profiles_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Profiles_UpdatedAt DEFAULT SYSUTCDATETIME(),
  RowVersion ROWVERSION NOT NULL,
  CONSTRAINT FK_Profiles_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_Profiles_Citizenship CHECK (Citizenship IN ('us','other')),
  CONSTRAINT CK_Profiles_Bedding CHECK (Bedding IN ('queen','twin','noPreference'))
);
END

IF OBJECT_ID(N'dbo.ProfileTags', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ProfileTags (
  UserId BIGINT NOT NULL, Kind VARCHAR(7) NOT NULL, Code NVARCHAR(20) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ProfileTags_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_ProfileTags PRIMARY KEY (UserId, Kind, Code),
  CONSTRAINT FK_ProfileTags_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_ProfileTags_Kind CHECK (Kind IN ('dietary','need'))
);
END

IF OBJECT_ID(N'dbo.RefreshTokens', N'U') IS NULL
BEGIN
CREATE TABLE dbo.RefreshTokens (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RefreshTokens PRIMARY KEY,
  UserId BIGINT NOT NULL, FamilyId BIGINT NOT NULL,
  TokenHash BINARY(32) NOT NULL,
  ExpiresAt DATETIME2(0) NOT NULL, UsedAt DATETIME2(0) NULL, RevokedAt DATETIME2(0) NULL,
  ReplacedById BIGINT NULL,
  UserAgent NVARCHAR(200) NULL, Ip VARCHAR(45) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_RefreshTokens_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UX_RefreshTokens_TokenHash UNIQUE (TokenHash),
  CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_RefreshTokens_RefreshTokens_Replaced FOREIGN KEY (ReplacedById) REFERENCES dbo.RefreshTokens (Id)
);
CREATE INDEX IX_RefreshTokens_UserId_FamilyId ON dbo.RefreshTokens (UserId, FamilyId);
CREATE INDEX IX_RefreshTokens_ExpiresAt ON dbo.RefreshTokens (ExpiresAt);   -- expiry sweep
CREATE INDEX IX_RefreshTokens_ReplacedById ON dbo.RefreshTokens (ReplacedById) WHERE ReplacedById IS NOT NULL;
END

IF OBJECT_ID(N'dbo.AuthChallenges', N'U') IS NULL
BEGIN
CREATE TABLE dbo.AuthChallenges (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuthChallenges PRIMARY KEY,
  UserId BIGINT NOT NULL,
  Purpose VARCHAR(5) NOT NULL,
  CodeHash BINARY(32) NOT NULL,                 -- SHA-256 of purpose:userId:code; the code itself is never stored
  Attempts INT NOT NULL CONSTRAINT DF_AuthChallenges_Attempts DEFAULT 0,
  ExpiresAt DATETIME2(0) NOT NULL, UsedAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AuthChallenges_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_AuthChallenges_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_AuthChallenges_Purpose CHECK (Purpose IN ('reset','magic'))
);
CREATE INDEX IX_AuthChallenges_UserId_Purpose ON dbo.AuthChallenges (UserId, Purpose, CreatedAt DESC);
CREATE INDEX IX_AuthChallenges_ExpiresAt ON dbo.AuthChallenges (ExpiresAt);   -- expiry sweep
END

IF OBJECT_ID(N'dbo.Outbox', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Outbox (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Outbox PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Outbox_PublicId DEFAULT NEWID() CONSTRAINT UX_Outbox_PublicId UNIQUE,
  UserId BIGINT NULL,                           -- no FK: the record of a message outlives the account it went to
  Channel VARCHAR(5) NOT NULL,
  Category VARCHAR(10) NOT NULL,
  ToAddress NVARCHAR(254) NOT NULL,
  Subject NVARCHAR(150) NOT NULL,
  Body NVARCHAR(1000) NOT NULL,
  Status VARCHAR(7) NOT NULL CONSTRAINT DF_Outbox_Status DEFAULT 'queued',
  SentAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Outbox_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_Outbox_Channel CHECK (Channel IN ('email','sms','push')),
  CONSTRAINT CK_Outbox_Status CHECK (Status IN ('queued','sent','failed'))
);
CREATE INDEX IX_Outbox_Status_CreatedAt ON dbo.Outbox (Status, CreatedAt);
END

IF OBJECT_ID(N'dbo.HelperLinks', N'U') IS NULL
BEGIN
CREATE TABLE dbo.HelperLinks (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HelperLinks PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_HelperLinks_PublicId DEFAULT NEWID() CONSTRAINT UX_HelperLinks_PublicId UNIQUE,
  GuestUserId BIGINT NOT NULL,
  HelperName NVARCHAR(80) NOT NULL,
  HelperUserId BIGINT NULL,
  Relationship NVARCHAR(40) NOT NULL,
  Permissions NVARCHAR(60) NOT NULL,            -- csv of view, documents, payments, profile
  Status VARCHAR(9) NOT NULL CONSTRAINT DF_HelperLinks_Status DEFAULT 'requested',
  ChangedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HelperLinks_ChangedAt DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HelperLinks_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HelperLinks_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_HelperLinks_Users_Guest FOREIGN KEY (GuestUserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_HelperLinks_Users_Helper FOREIGN KEY (HelperUserId) REFERENCES dbo.Users (Id),
  CONSTRAINT CK_HelperLinks_Status CHECK (Status IN ('requested','active','revoked')),
  CONSTRAINT CK_HelperLinks_Permissions CHECK (Status <> 'active' OR Permissions LIKE '%view%')
);
CREATE UNIQUE INDEX UX_HelperLinks_GuestUserId_Live ON dbo.HelperLinks (GuestUserId) WHERE Status <> 'revoked';
CREATE INDEX IX_HelperLinks_HelperUserId ON dbo.HelperLinks (HelperUserId) WHERE HelperUserId IS NOT NULL;   -- helper authorisation lookup
END

IF OBJECT_ID(N'dbo.HistoryEntries', N'U') IS NULL
BEGIN
CREATE TABLE dbo.HistoryEntries (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HistoryEntries PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_HistoryEntries_PublicId DEFAULT NEWID() CONSTRAINT UX_HistoryEntries_PublicId UNIQUE,
  UserId BIGINT NOT NULL, ByUserId BIGINT NOT NULL,
  What VARCHAR(13) NOT NULL, Detail NVARCHAR(300) NOT NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_HistoryEntries_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HistoryEntries_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_HistoryEntries_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_HistoryEntries_Users_By FOREIGN KEY (ByUserId) REFERENCES dbo.Users (Id),
  CONSTRAINT CK_HistoryEntries_What CHECK (What IN ('profile','documents','payment','card','helper','trip','notifications','booking','tour','dining','purchase','assistance','travel','checkin'))
);
CREATE INDEX IX_HistoryEntries_UserId_At ON dbo.HistoryEntries (UserId, [At] DESC);
CREATE INDEX IX_HistoryEntries_ByUserId ON dbo.HistoryEntries (ByUserId);
END

IF OBJECT_ID(N'dbo.SavedCards', N'U') IS NULL
BEGIN
CREATE TABLE dbo.SavedCards (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SavedCards PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_SavedCards_PublicId DEFAULT NEWID() CONSTRAINT UX_SavedCards_PublicId UNIQUE,
  UserId BIGINT NOT NULL,
  Brand VARCHAR(10) NOT NULL, Last4 CHAR(4) NOT NULL, Expiry CHAR(5) NOT NULL,   -- MM/YY; no full number is ever stored
  IsDefault BIT NOT NULL CONSTRAINT DF_SavedCards_IsDefault DEFAULT 0,
  GatewayToken NVARCHAR(100) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SavedCards_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_SavedCards_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_SavedCards_Brand CHECK (Brand IN ('visa','mastercard','amex','discover')),
  CONSTRAINT CK_SavedCards_Last4 CHECK (Last4 LIKE '[0-9][0-9][0-9][0-9]'),
  CONSTRAINT CK_SavedCards_Expiry CHECK (Expiry LIKE '[0-1][0-9]/[0-9][0-9]')
);
CREATE INDEX IX_SavedCards_UserId ON dbo.SavedCards (UserId);
CREATE UNIQUE INDEX UX_SavedCards_UserId_Default ON dbo.SavedCards (UserId) WHERE IsDefault = 1;
END

IF OBJECT_ID(N'dbo.Notices', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Notices (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Notices PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Notices_PublicId DEFAULT NEWID() CONSTRAINT UX_Notices_PublicId UNIQUE,
  UserId BIGINT NOT NULL,
  Kind NVARCHAR(30) NOT NULL, Severity VARCHAR(9) NOT NULL CONSTRAINT DF_Notices_Severity DEFAULT 'info',
  Title NVARCHAR(120) NOT NULL, Body NVARCHAR(1000) NOT NULL, LinkRoute NVARCHAR(120) NULL,
  ReadAt DATETIME2(0) NULL, [At] DATETIME2(0) NOT NULL CONSTRAINT DF_Notices_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Notices_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Notices_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_Notices_Severity CHECK (Severity IN ('info','important','urgent'))
);
CREATE INDEX IX_Notices_UserId_At ON dbo.Notices (UserId, [At] DESC);
END

IF OBJECT_ID(N'dbo.PushSubscriptions', N'U') IS NULL
BEGIN
CREATE TABLE dbo.PushSubscriptions (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PushSubscriptions PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_PushSubscriptions_PublicId DEFAULT NEWID() CONSTRAINT UX_PushSubscriptions_PublicId UNIQUE,
  UserId BIGINT NOT NULL,
  Endpoint NVARCHAR(450) NOT NULL, P256dh NVARCHAR(200) NOT NULL, Auth NVARCHAR(200) NOT NULL,
  Budget TINYINT NOT NULL CONSTRAINT DF_PushSubscriptions_Budget DEFAULT 3, Calm BIT NOT NULL CONSTRAINT DF_PushSubscriptions_Calm DEFAULT 0,
  Watch NVARCHAR(900) NOT NULL CONSTRAINT DF_PushSubscriptions_Watch DEFAULT N'',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PushSubscriptions_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PushSubscriptions_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_PushSubscriptions_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT UX_PushSubscriptions_Endpoint UNIQUE (Endpoint),
  CONSTRAINT CK_PushSubscriptions_Budget CHECK (Budget IN (0,1,3,5))
);
CREATE INDEX IX_PushSubscriptions_UserId ON dbo.PushSubscriptions (UserId);
END

IF OBJECT_ID(N'dbo.PushDeliveries', N'U') IS NULL
BEGIN
CREATE TABLE dbo.PushDeliveries (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PushDeliveries PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_PushDeliveries_PublicId DEFAULT NEWID() CONSTRAINT UX_PushDeliveries_PublicId UNIQUE,
  UserId BIGINT NOT NULL,
  NoticeKey NVARCHAR(120) NOT NULL, Kind NVARCHAR(20) NOT NULL, Bypass BIT NOT NULL,
  Outcome VARCHAR(4) NOT NULL, Reason VARCHAR(12) NULL, Devices TINYINT NOT NULL CONSTRAINT DF_PushDeliveries_Devices DEFAULT 0,
  Params NVARCHAR(500) NOT NULL CONSTRAINT DF_PushDeliveries_Params DEFAULT N'{}',
  ReadAt DATETIME2(0) NULL,
  [At] DATETIME2(0) NOT NULL, CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PushDeliveries_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_PushDeliveries_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_PushDeliveries_Outcome CHECK (Outcome IN ('sent','held'))
);
CREATE INDEX IX_PushDeliveries_UserId_At ON dbo.PushDeliveries (UserId, [At] DESC);
END

IF OBJECT_ID(N'dbo.CalendarFeeds', N'U') IS NULL
BEGIN
CREATE TABLE dbo.CalendarFeeds (
  UserId BIGINT NOT NULL CONSTRAINT PK_CalendarFeeds PRIMARY KEY,
  TokenHash CHAR(64) NOT NULL CONSTRAINT UX_CalendarFeeds_TokenHash UNIQUE,
  CreatedAt DATETIME2(0) NOT NULL,
  CONSTRAINT FK_CalendarFeeds_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
);
END

IF OBJECT_ID(N'dbo.NotificationPrefs', N'U') IS NULL
BEGIN
CREATE TABLE dbo.NotificationPrefs (
  UserId BIGINT NOT NULL CONSTRAINT PK_NotificationPrefs PRIMARY KEY,
  Prefs NVARCHAR(MAX) NOT NULL CONSTRAINT DF_NotificationPrefs_Prefs DEFAULT N'{}',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_NotificationPrefs_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_NotificationPrefs_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_NotificationPrefs_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_NotificationPrefs_Prefs CHECK (ISJSON(Prefs) = 1)
);
END

IF OBJECT_ID(N'dbo.ConsentChoices', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ConsentChoices (
  UserId BIGINT NOT NULL, ConsentId NVARCHAR(30) NOT NULL, IsOn BIT NOT NULL,
  ChangedByUserId BIGINT NOT NULL, [At] DATETIME2(0) NOT NULL CONSTRAINT DF_ConsentChoices_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ConsentChoices_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_ConsentChoices PRIMARY KEY (UserId, ConsentId),
  CONSTRAINT FK_ConsentChoices_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_ConsentChoices_Users_ChangedBy FOREIGN KEY (ChangedByUserId) REFERENCES dbo.Users (Id)
);
CREATE INDEX IX_ConsentChoices_ChangedByUserId ON dbo.ConsentChoices (ChangedByUserId);
END

IF OBJECT_ID(N'dbo.AccessLog', N'U') IS NULL
BEGIN
CREATE TABLE dbo.AccessLog (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AccessLog PRIMARY KEY,
  UserId BIGINT NOT NULL,                       -- whose data was accessed
  Actor NVARCHAR(80) NOT NULL, Purpose NVARCHAR(120) NOT NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_AccessLog_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AccessLog_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_AccessLog_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
);
CREATE INDEX IX_AccessLog_UserId_At ON dbo.AccessLog (UserId, [At] DESC);
END

-- The audit trail: who did what, when, from where, and how it ended. Append-only, and deliberately no foreign keys, so a row outlives
-- the account or booking it describes. Actor and subject are the users' PublicIds. Bodies are never stored (passwords, card numbers).
IF OBJECT_ID(N'dbo.AuditEvents', N'U') IS NULL
BEGIN
CREATE TABLE dbo.AuditEvents (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuditEvents PRIMARY KEY,
  EventId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_AuditEvents_EventId DEFAULT NEWID() CONSTRAINT UX_AuditEvents_EventId UNIQUE,
  [At] DATETIME2(3) NOT NULL CONSTRAINT DF_AuditEvents_At DEFAULT SYSUTCDATETIME(),   -- real time, never the demo clock
  Category VARCHAR(10) NOT NULL,                -- auth | request | domain | error | system
  Action NVARCHAR(120) NOT NULL,                -- 'auth.login', 'POST /api/v1/bookings/{number}/cancel', 'history.dining'
  Outcome VARCHAR(8) NOT NULL,                  -- success | failure | denied | error
  ActorPublicId UNIQUEIDENTIFIER NULL,          -- who did it (the booker on a view-as token); null when nobody was signed in
  ActorRole VARCHAR(10) NOT NULL CONSTRAINT DF_AuditEvents_ActorRole DEFAULT 'anonymous',   -- anonymous | guest | staff | admin | system
  SubjectPublicId UNIQUEIDENTIFIER NULL,        -- whose account or data it was done to or for
  Target NVARCHAR(200) NULL,                    -- the thing acted on: route values, booking number
  HttpMethod VARCHAR(7) NULL, Route NVARCHAR(200) NULL, StatusCode SMALLINT NULL, DurationMs INT NULL,
  ErrorCode VARCHAR(20) NULL,                   -- the API error code (invalid, forbidden, conflict, server ...)
  ErrorType NVARCHAR(120) NULL, ErrorMessage NVARCHAR(400) NULL, ErrorDetail NVARCHAR(2000) NULL,   -- an unhandled exception: type, message, top of the stack
  Detail NVARCHAR(1000) NULL,                   -- JSON: reason, counts, what changed (no secrets)
  CorrelationId VARCHAR(64) NULL,               -- the request's trace id; also in the problem-details body and X-Request-Id
  Ip VARCHAR(45) NULL, UserAgent NVARCHAR(200) NULL,
  CONSTRAINT CK_AuditEvents_Category CHECK (Category IN ('auth','request','domain','error','system')),
  CONSTRAINT CK_AuditEvents_Outcome CHECK (Outcome IN ('success','failure','denied','error'))
);
CREATE INDEX IX_AuditEvents_At ON dbo.AuditEvents ([At] DESC);
CREATE INDEX IX_AuditEvents_Actor_At ON dbo.AuditEvents (ActorPublicId, [At] DESC) WHERE ActorPublicId IS NOT NULL;
CREATE INDEX IX_AuditEvents_Subject_At ON dbo.AuditEvents (SubjectPublicId, [At] DESC) WHERE SubjectPublicId IS NOT NULL;
CREATE INDEX IX_AuditEvents_Action_At ON dbo.AuditEvents (Action, [At] DESC);
CREATE INDEX IX_AuditEvents_Outcome_At ON dbo.AuditEvents (Outcome, [At] DESC) WHERE Outcome <> 'success';
CREATE INDEX IX_AuditEvents_Correlation ON dbo.AuditEvents (CorrelationId) WHERE CorrelationId IS NOT NULL;
END

-- Append-only: nothing edits or deletes an audit row. (An approved archive job can disable this trigger for its run.)
IF OBJECT_ID(N'dbo.TR_AuditEvents_AppendOnly', N'TR') IS NULL
EXEC(N'CREATE TRIGGER dbo.TR_AuditEvents_AppendOnly ON dbo.AuditEvents INSTEAD OF UPDATE, DELETE AS
BEGIN
  THROW 51000, N''dbo.AuditEvents is append-only.'', 1;
END');

IF OBJECT_ID(N'dbo.RetentionRuns', N'U') IS NULL
BEGIN
CREATE TABLE dbo.RetentionRuns (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RetentionRuns PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_RetentionRuns_PublicId DEFAULT NEWID() CONSTRAINT UX_RetentionRuns_PublicId UNIQUE,
  UserId BIGINT NOT NULL,                       -- no FK: the run record must outlive the hard delete it describes
  RuleName NVARCHAR(30) NOT NULL, Kinds NVARCHAR(200) NOT NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_RetentionRuns_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_RetentionRuns_CreatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_RetentionRuns_UserId ON dbo.RetentionRuns (UserId);
END

IF OBJECT_ID(N'dbo.SupportTickets', N'U') IS NULL
BEGIN
CREATE TABLE dbo.SupportTickets (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SupportTickets PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_SupportTickets_PublicId DEFAULT NEWID() CONSTRAINT UX_SupportTickets_PublicId UNIQUE,
  UserId BIGINT NOT NULL,
  Kind VARCHAR(8) NOT NULL, Status VARCHAR(10) NOT NULL CONSTRAINT DF_SupportTickets_Status DEFAULT 'open',
  Detail NVARCHAR(1000) NOT NULL, [At] DATETIME2(0) NOT NULL CONSTRAINT DF_SupportTickets_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SupportTickets_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SupportTickets_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_SupportTickets_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_SupportTickets_Kind CHECK (Kind IN ('callback','email')),
  CONSTRAINT CK_SupportTickets_Status CHECK (Status IN ('open','inProgress','done'))
);
CREATE INDEX IX_SupportTickets_UserId ON dbo.SupportTickets (UserId);
END

IF OBJECT_ID(N'dbo.Favourites', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Favourites (
  UserId BIGINT NOT NULL, ItemKey NVARCHAR(80) NOT NULL, Position INT NOT NULL CONSTRAINT DF_Favourites_Position DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Favourites_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Favourites PRIMARY KEY (UserId, ItemKey),
  CONSTRAINT FK_Favourites_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
);
END

IF OBJECT_ID(N'dbo.JourneyEvents', N'U') IS NULL
BEGIN
CREATE TABLE dbo.JourneyEvents (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_JourneyEvents PRIMARY KEY,
  UserId BIGINT NOT NULL,
  Kind VARCHAR(20) NOT NULL,                    -- what the guest did: lookCloser, priceView, cabinView, sharedAccepted, planImported, atTerminal
  SailingId NVARCHAR(40) NULL,
  [At] DATETIME2(0) NOT NULL,                   -- the guest's "now" (the demo clock for a demo account), so the stage and the clock agree
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_JourneyEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_JourneyEvents_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_JourneyEvents_Sailings FOREIGN KEY (SailingId) REFERENCES ref.Sailings (Id),
  CONSTRAINT CK_JourneyEvents_Kind CHECK (Kind IN ('lookCloser','priceView','cabinView','sharedAccepted','planImported','atTerminal'))
);
CREATE INDEX IX_JourneyEvents_UserId_At ON dbo.JourneyEvents (UserId, [At] DESC);   -- the stage engine reads a person's latest events
END

IF OBJECT_ID(N'dbo.UserState', N'U') IS NULL
BEGIN
CREATE TABLE dbo.UserState (
  UserId BIGINT NOT NULL, StateKey VARCHAR(30) NOT NULL,
  Json NVARCHAR(MAX) NOT NULL, Version INT NOT NULL CONSTRAINT DF_UserState_Version DEFAULT 1,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserState_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserState_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_UserState PRIMARY KEY (UserId, StateKey),
  CONSTRAINT FK_UserState_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_UserState_Json CHECK (ISJSON(Json) = 1)
);
END

IF OBJECT_ID(N'dbo.FamilyLinks', N'U') IS NULL
BEGIN
CREATE TABLE dbo.FamilyLinks (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FamilyLinks PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_FamilyLinks_PublicId DEFAULT NEWID() CONSTRAINT UX_FamilyLinks_PublicId UNIQUE,
  UserId BIGINT NOT NULL,
  ExpiresAt DATETIME2(0) NOT NULL,
  RevokedAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_FamilyLinks_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_FamilyLinks_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
);
CREATE INDEX IX_FamilyLinks_UserId ON dbo.FamilyLinks (UserId);
END

IF OBJECT_ID(N'dbo.StaffTickets', N'U') IS NULL
BEGIN
CREATE TABLE dbo.StaffTickets (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_StaffTickets PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_StaffTickets_PublicId DEFAULT NEWID() CONSTRAINT UX_StaffTickets_PublicId UNIQUE,
  UserId BIGINT NOT NULL,
  Kind VARCHAR(10) NOT NULL,
  Reason VARCHAR(10) NOT NULL CONSTRAINT DF_StaffTickets_Reason DEFAULT '',
  RequestedAtMs BIGINT NOT NULL,
  Position INT NOT NULL,
  ReadyAtMs BIGINT NOT NULL,
  Source VARCHAR(10) NOT NULL,
  CancelledAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_StaffTickets_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_StaffTickets_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_StaffTickets_Kind CHECK (Kind IN ('callback','caregiver','kit'))
);
CREATE INDEX IX_StaffTickets_UserId_RequestedAtMs ON dbo.StaffTickets (UserId, RequestedAtMs);
END

IF OBJECT_ID(N'dbo.ConciergeUses', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ConciergeUses (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ConciergeUses PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ConciergeUses_PublicId DEFAULT NEWID() CONSTRAINT UX_ConciergeUses_PublicId UNIQUE,
  UserId BIGINT NOT NULL,
  UsedAt DATETIME2(0) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ConciergeUses_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ConciergeUses_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
);
CREATE INDEX IX_ConciergeUses_UserId_UsedAt ON dbo.ConciergeUses (UserId, UsedAt);
END

IF OBJECT_ID(N'dbo.GuestMedia', N'U') IS NULL
BEGIN
CREATE TABLE dbo.GuestMedia (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_GuestMedia PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_GuestMedia_PublicId DEFAULT NEWID() CONSTRAINT UX_GuestMedia_PublicId UNIQUE,
  UserId BIGINT NOT NULL,
  Purpose VARCHAR(10) NOT NULL,
  Reference VARCHAR(40) NOT NULL CONSTRAINT DF_GuestMedia_Reference DEFAULT '',
  Kind VARCHAR(12) NOT NULL CONSTRAINT DF_GuestMedia_Kind DEFAULT '',
  Caption NVARCHAR(140) NOT NULL CONSTRAINT DF_GuestMedia_Caption DEFAULT N'',
  ContentType VARCHAR(12) NOT NULL,
  Width INT NOT NULL,
  Height INT NOT NULL,
  ByteCount INT NOT NULL,
  Status VARCHAR(10) NOT NULL CONSTRAINT DF_GuestMedia_Status DEFAULT 'pending',
  Data VARBINARY(MAX) NOT NULL,   -- the cleaned picture (no EXIF); blob storage is a later option behind IMediaStore
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_GuestMedia_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_GuestMedia_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_GuestMedia_Purpose CHECK (Purpose IN ('cabin','book','postcard')),
  CONSTRAINT CK_GuestMedia_ContentType CHECK (ContentType IN ('image/jpeg','image/png')),
  CONSTRAINT CK_GuestMedia_Status CHECK (Status IN ('pending','approved','rejected')),
  CONSTRAINT CK_GuestMedia_Size CHECK (Width > 0 AND Height > 0 AND ByteCount > 0)
);
CREATE INDEX IX_GuestMedia_UserId_Purpose ON dbo.GuestMedia (UserId, Purpose);
CREATE INDEX IX_GuestMedia_Purpose_Reference ON dbo.GuestMedia (Purpose, Reference, Status);
END

IF OBJECT_ID(N'dbo.FamilyPostcards', N'U') IS NULL
BEGIN
CREATE TABLE dbo.FamilyPostcards (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FamilyPostcards PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_FamilyPostcards_PublicId DEFAULT NEWID() CONSTRAINT UX_FamilyPostcards_PublicId UNIQUE,
  UserId BIGINT NOT NULL,
  Kind VARCHAR(10) NOT NULL,
  Note NVARCHAR(140) NOT NULL CONSTRAINT DF_FamilyPostcards_Note DEFAULT N'',
  SentAt DATETIME2(0) NOT NULL,
  MediaId UNIQUEIDENTIFIER NULL,   -- the guest's picture on the card (GuestMedia.PublicId); no foreign key (it would be a second cascade path from Users), so DapperMediaStore.DeleteAsync clears it
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_FamilyPostcards_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_FamilyPostcards_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_FamilyPostcards_Kind CHECK (Kind IN ('ok','sea','port','late','love'))
);
CREATE INDEX IX_FamilyPostcards_UserId_SentAt ON dbo.FamilyPostcards (UserId, SentAt);
END

IF OBJECT_ID(N'demo.DemoState', N'U') IS NULL
BEGIN
CREATE TABLE demo.DemoState (
  UserId BIGINT NOT NULL CONSTRAINT PK_DemoState PRIMARY KEY,
  ClockOffsetSeconds BIGINT NOT NULL CONSTRAINT DF_DemoState_ClockOffsetSeconds DEFAULT 0,
  ClockSpeed INT NOT NULL CONSTRAINT DF_DemoState_ClockSpeed DEFAULT 1,
  SailingId NVARCHAR(40) NULL, PhoneZone NVARCHAR(40) NULL,
  ActiveScenarios NVARCHAR(MAX) NOT NULL CONSTRAINT DF_DemoState_ActiveScenarios DEFAULT N'[]',
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DemoState_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_DemoState_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_DemoState_ActiveScenarios CHECK (ISJSON(ActiveScenarios) = 1),
  CONSTRAINT CK_DemoState_ClockSpeed CHECK (ClockSpeed >= 1),
  CONSTRAINT FK_DemoState_Sailings FOREIGN KEY (SailingId) REFERENCES ref.Sailings (Id)
);
END
GO

/* =====================================================================================================
   4.3 Bookings and money (dbo)
   ===================================================================================================== */

IF OBJECT_ID(N'dbo.Bookings', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Bookings (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Bookings PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Bookings_PublicId DEFAULT NEWID() CONSTRAINT UX_Bookings_PublicId UNIQUE,
  Number CHAR(8) NOT NULL,
  Kind VARCHAR(6) NOT NULL CONSTRAINT DF_Bookings_Kind DEFAULT 'direct',
  AgentName NVARCHAR(80) NULL,
  BookerUserId BIGINT NOT NULL,
  SailingId NVARCHAR(40) NOT NULL,
  CategoryId NVARCHAR(30) NOT NULL,
  CabinNumber NVARCHAR(8) NULL,                 -- null = guaranteed cabin; the ship comes from the sailing, so no FK to ref.Cabins
  FareId NVARCHAR(30) NOT NULL,
  Status VARCHAR(9) NOT NULL CONSTRAINT DF_Bookings_Status DEFAULT 'confirmed',
  Dining VARCHAR(7) NOT NULL CONSTRAINT DF_Bookings_Dining DEFAULT 'anytime',
  Occasion VARCHAR(11) NOT NULL CONSTRAINT DF_Bookings_Occasion DEFAULT 'none',
  TotalCents BIGINT NOT NULL, DepositCents BIGINT NOT NULL,
  FinalDueDate DATE NOT NULL,
  FinalPaymentDays INT NOT NULL CONSTRAINT DF_Bookings_FinalPaymentDays DEFAULT 90,
  LoyaltyNumber CHAR(9) NULL,
  DiscountCents BIGINT NOT NULL CONSTRAINT DF_Bookings_DiscountCents DEFAULT 0, CreditUsedCents BIGINT NOT NULL CONSTRAINT DF_Bookings_CreditUsedCents DEFAULT 0,
  DraftId NVARCHAR(40) NULL,                    -- the draft this came from; no FK, the draft is discarded after booking
  ContactEmail NVARCHAR(254) NULL, ContactPhone NVARCHAR(30) NULL,
  ConfirmedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Bookings_ConfirmedAt DEFAULT SYSUTCDATETIME(),
  CancelledAt DATETIME2(0) NULL, CancelFeeCents BIGINT NULL, CancelRefundCents BIGINT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Bookings_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Bookings_UpdatedAt DEFAULT SYSUTCDATETIME(),
  RowVersion ROWVERSION NOT NULL,
  CONSTRAINT UX_Bookings_Number UNIQUE (Number),
  CONSTRAINT FK_Bookings_Users_Booker FOREIGN KEY (BookerUserId) REFERENCES dbo.Users (Id),
  CONSTRAINT FK_Bookings_Sailings FOREIGN KEY (SailingId) REFERENCES ref.Sailings (Id),
  CONSTRAINT FK_Bookings_CabinCategories FOREIGN KEY (CategoryId) REFERENCES ref.CabinCategories (Id),
  CONSTRAINT FK_Bookings_Fares FOREIGN KEY (FareId) REFERENCES ref.Fares (Id),
  CONSTRAINT CK_Bookings_Number CHECK (Number NOT LIKE '%[^A-Za-z0-9]%'),
  CONSTRAINT CK_Bookings_Kind CHECK (Kind IN ('direct','agent')),
  CONSTRAINT CK_Bookings_Status CHECK (Status IN ('confirmed','cancelled')),
  CONSTRAINT CK_Bookings_Dining CHECK (Dining IN ('anytime','early','late')),
  CONSTRAINT CK_Bookings_Occasion CHECK (Occasion IN ('none','birthday','anniversary','honeymoon','other')),
  CONSTRAINT CK_Bookings_Deposit CHECK (DepositCents <= TotalCents),
  CONSTRAINT CK_Bookings_Cancelled CHECK (Status <> 'cancelled' OR CancelledAt IS NOT NULL),
  CONSTRAINT UX_Bookings_Id_SailingId UNIQUE (Id, SailingId),
  CONSTRAINT CK_Bookings_Amounts CHECK (TotalCents >= 0 AND DepositCents >= 0 AND DiscountCents >= 0 AND CreditUsedCents >= 0)
);
CREATE UNIQUE INDEX UX_Bookings_DraftId ON dbo.Bookings (DraftId) WHERE DraftId IS NOT NULL;   -- booking is idempotent per draft (D11)
CREATE INDEX IX_Bookings_BookerUserId ON dbo.Bookings (BookerUserId);
CREATE INDEX IX_Bookings_SailingId ON dbo.Bookings (SailingId);
CREATE UNIQUE INDEX UX_Bookings_SailingId_CabinNumber ON dbo.Bookings (SailingId, CabinNumber) WHERE CabinNumber IS NOT NULL AND Status = 'confirmed';   -- one booking per cabin per sailing; also the free-cabin lookup
CREATE INDEX IX_Bookings_FinalDueDate ON dbo.Bookings (FinalDueDate) WHERE Status = 'confirmed';   -- balance-due reminders
END

IF OBJECT_ID(N'dbo.BookingGuests', N'U') IS NULL
BEGIN
CREATE TABLE dbo.BookingGuests (
  BookingId BIGINT NOT NULL, UserId BIGINT NOT NULL,
  Seq INT NOT NULL, IsLead BIT NOT NULL CONSTRAINT DF_BookingGuests_IsLead DEFAULT 0, Printed NVARCHAR(80) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BookingGuests_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_BookingGuests PRIMARY KEY (BookingId, UserId),
  CONSTRAINT UX_BookingGuests_BookingId_Seq UNIQUE (BookingId, Seq),
  CONSTRAINT FK_BookingGuests_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_BookingGuests_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
);
CREATE INDEX IX_BookingGuests_UserId ON dbo.BookingGuests (UserId);   -- "my bookings" and every membership check
END

IF OBJECT_ID(N'dbo.BookingGuestDetails', N'U') IS NULL
BEGIN
CREATE TABLE dbo.BookingGuestDetails (
  BookingId BIGINT NOT NULL, Seq INT NOT NULL,
  UserId BIGINT NULL,
  FirstName NVARCHAR(60) NOT NULL, LastName NVARCHAR(60) NOT NULL, Dob DATE NOT NULL,
  Gender CHAR(1) NOT NULL, Citizenship VARCHAR(5) NOT NULL CONSTRAINT DF_BookingGuestDetails_Citizenship DEFAULT 'us',
  DietaryStatus VARCHAR(4) NOT NULL CONSTRAINT DF_BookingGuestDetails_DietaryStatus DEFAULT 'none', AllergyNote NVARCHAR(300) NOT NULL CONSTRAINT DF_BookingGuestDetails_AllergyNote DEFAULT N'',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BookingGuestDetails_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BookingGuestDetails_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_BookingGuestDetails PRIMARY KEY (BookingId, Seq),
  CONSTRAINT FK_BookingGuestDetails_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_BookingGuestDetails_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id),
  CONSTRAINT CK_BookingGuestDetails_Gender CHECK (Gender IN ('F','M','X')),
  CONSTRAINT CK_BookingGuestDetails_Citizenship CHECK (Citizenship IN ('us','other')),
  CONSTRAINT CK_BookingGuestDetails_DietaryStatus CHECK (DietaryStatus IN ('none','some'))
);
CREATE INDEX IX_BookingGuestDetails_UserId ON dbo.BookingGuestDetails (UserId) WHERE UserId IS NOT NULL;
END

IF OBJECT_ID(N'dbo.BookingGuestTags', N'U') IS NULL
BEGIN
CREATE TABLE dbo.BookingGuestTags (
  BookingId BIGINT NOT NULL, Seq INT NOT NULL, Kind VARCHAR(7) NOT NULL, Code NVARCHAR(20) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BookingGuestTags_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_BookingGuestTags PRIMARY KEY (BookingId, Seq, Kind, Code),
  CONSTRAINT FK_BookingGuestTags_BookingGuestDetails FOREIGN KEY (BookingId, Seq) REFERENCES dbo.BookingGuestDetails (BookingId, Seq) ON DELETE CASCADE,
  CONSTRAINT CK_BookingGuestTags_Kind CHECK (Kind IN ('dietary','need'))
);
END

IF OBJECT_ID(N'dbo.BookingDrafts', N'U') IS NULL
BEGIN
CREATE TABLE dbo.BookingDrafts (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_BookingDrafts PRIMARY KEY,   -- random and unguessable: it is the resume link secret
  UserId BIGINT NOT NULL,
  SailingId NVARCHAR(40) NULL, CategoryId NVARCHAR(30) NULL,
  Guests INT NOT NULL CONSTRAINT DF_BookingDrafts_Guests DEFAULT 1,
  CabinMode VARCHAR(10) NOT NULL CONSTRAINT DF_BookingDrafts_CabinMode DEFAULT 'guaranteed', CabinNumber NVARCHAR(8) NULL,
  FareId NVARCHAR(30) NULL, Dining VARCHAR(7) NULL, Occasion VARCHAR(11) NOT NULL CONSTRAINT DF_BookingDrafts_Occasion DEFAULT 'none',
  LoyaltyNumber CHAR(9) NULL, UseCredit BIT NOT NULL CONSTRAINT DF_BookingDrafts_UseCredit DEFAULT 0,
  Accepted NVARCHAR(MAX) NOT NULL CONSTRAINT DF_BookingDrafts_Accepted DEFAULT N'{}',
  People NVARCHAR(MAX) NOT NULL CONSTRAINT DF_BookingDrafts_People DEFAULT N'[]',
  Contact NVARCHAR(MAX) NOT NULL CONSTRAINT DF_BookingDrafts_Contact DEFAULT N'{}',
  Step NVARCHAR(10) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BookingDrafts_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BookingDrafts_UpdatedAt DEFAULT SYSUTCDATETIME(),
  RowVersion ROWVERSION NOT NULL,
  CONSTRAINT UX_BookingDrafts_UserId UNIQUE (UserId),   -- one live draft per user
  CONSTRAINT FK_BookingDrafts_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_BookingDrafts_Sailings FOREIGN KEY (SailingId) REFERENCES ref.Sailings (Id),
  CONSTRAINT FK_BookingDrafts_CabinCategories FOREIGN KEY (CategoryId) REFERENCES ref.CabinCategories (Id),
  CONSTRAINT FK_BookingDrafts_Fares FOREIGN KEY (FareId) REFERENCES ref.Fares (Id),
  CONSTRAINT CK_BookingDrafts_Guests CHECK (Guests >= 1),
  CONSTRAINT CK_BookingDrafts_CabinMode CHECK (CabinMode IN ('guaranteed','pick')),
  CONSTRAINT CK_BookingDrafts_Dining CHECK (Dining IS NULL OR Dining IN ('anytime','early','late')),
  CONSTRAINT CK_BookingDrafts_Occasion CHECK (Occasion IN ('none','birthday','anniversary','honeymoon','other')),
  CONSTRAINT CK_BookingDrafts_Accepted CHECK (ISJSON(Accepted) = 1),
  CONSTRAINT CK_BookingDrafts_People CHECK (ISJSON(People) = 1),
  CONSTRAINT CK_BookingDrafts_Contact CHECK (ISJSON(Contact) = 1)
);
CREATE INDEX IX_BookingDrafts_UpdatedAt ON dbo.BookingDrafts (UpdatedAt);   -- abandoned-draft sweep
END

IF OBJECT_ID(N'dbo.QuoteLocks', N'U') IS NULL
BEGIN
CREATE TABLE dbo.QuoteLocks (
  DraftId NVARCHAR(40) NOT NULL CONSTRAINT PK_QuoteLocks PRIMARY KEY,
  LockedUntil DATETIME2(0) NOT NULL, TotalCents BIGINT NOT NULL,
  QuoteJson NVARCHAR(MAX) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_QuoteLocks_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_QuoteLocks_BookingDrafts FOREIGN KEY (DraftId) REFERENCES dbo.BookingDrafts (Id) ON DELETE CASCADE,
  CONSTRAINT CK_QuoteLocks_QuoteJson CHECK (ISJSON(QuoteJson) = 1)
);
CREATE INDEX IX_QuoteLocks_LockedUntil ON dbo.QuoteLocks (LockedUntil);   -- expiry sweep
END

IF OBJECT_ID(N'dbo.Payments', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Payments (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Payments PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Payments_PublicId DEFAULT NEWID() CONSTRAINT UX_Payments_PublicId UNIQUE,
  BookingId BIGINT NOT NULL,
  UserId BIGINT NOT NULL,                       -- who paid
  Label VARCHAR(8) NOT NULL,
  AmountCents BIGINT NOT NULL,                  -- negative = refund
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_Payments_At DEFAULT SYSUTCDATETIME(),
  Reference NVARCHAR(40) NOT NULL,
  Status VARCHAR(8) NOT NULL CONSTRAINT DF_Payments_Status DEFAULT 'captured',
  RelatedType NVARCHAR(20) NULL, RelatedId BIGINT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Payments_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Payments_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_Payments_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id),
  CONSTRAINT CK_Payments_Label CHECK (Label IN ('deposit','full','balance','refund','tour','purchase','photo','upgrade','checkin')),
  CONSTRAINT CK_Payments_Status CHECK (Status IN ('captured','declined','refunded')),
  CONSTRAINT CK_Payments_Sign CHECK ((Label = 'refund' AND AmountCents <= 0) OR (Label <> 'refund' AND AmountCents >= 0))
);
CREATE INDEX IX_Payments_BookingId_At ON dbo.Payments (BookingId, [At]);
CREATE INDEX IX_Payments_UserId ON dbo.Payments (UserId);
END

IF OBJECT_ID(N'dbo.PaymentParts', N'U') IS NULL
BEGIN
CREATE TABLE dbo.PaymentParts (
  PaymentId BIGINT NOT NULL, Seq INT NOT NULL,
  Method VARCHAR(6) NOT NULL,
  CardId BIGINT NULL,                           -- no FK: removing a saved card must not touch receipts; brand and last four are snapshotted
  CardBrand VARCHAR(10) NULL, Last4 CHAR(4) NULL,
  Cents BIGINT NOT NULL, ChallengeUsed BIT NOT NULL CONSTRAINT DF_PaymentParts_ChallengeUsed DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PaymentParts_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_PaymentParts PRIMARY KEY (PaymentId, Seq),
  CONSTRAINT FK_PaymentParts_Payments FOREIGN KEY (PaymentId) REFERENCES dbo.Payments (Id) ON DELETE CASCADE,
  CONSTRAINT CK_PaymentParts_Method CHECK (Method IN ('card','wallet')),
  CONSTRAINT CK_PaymentParts_Seq CHECK (Seq BETWEEN 1 AND 2),   -- checkParts: at most two parts
  CONSTRAINT CK_PaymentParts_CardBrand CHECK (CardBrand IS NULL OR CardBrand IN ('visa','mastercard','amex','discover')),
  CONSTRAINT CK_PaymentParts_Cents CHECK (Cents >= 0)
);
END

IF OBJECT_ID(N'dbo.IdempotencyKeys', N'U') IS NULL
BEGIN
CREATE TABLE dbo.IdempotencyKeys (
  RequestKey NVARCHAR(80) NOT NULL CONSTRAINT PK_IdempotencyKeys PRIMARY KEY,
  UserId BIGINT NOT NULL, Route NVARCHAR(80) NOT NULL, ResponseHash NVARCHAR(100) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_IdempotencyKeys_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_IdempotencyKeys_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
);
CREATE INDEX IX_IdempotencyKeys_CreatedAt ON dbo.IdempotencyKeys (CreatedAt);   -- expiry sweep
END

IF OBJECT_ID(N'dbo.Acceptances', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Acceptances (
  BookingId BIGINT NOT NULL, LegalId NVARCHAR(30) NOT NULL, Version INT NOT NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_Acceptances_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Acceptances_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Acceptances PRIMARY KEY (BookingId, LegalId),
  CONSTRAINT FK_Acceptances_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_Acceptances_LegalDocs FOREIGN KEY (LegalId, Version) REFERENCES ref.LegalDocs (Id, Version)
);
END

IF OBJECT_ID(N'dbo.NotificationsSent', N'U') IS NULL
BEGIN
CREATE TABLE dbo.NotificationsSent (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_NotificationsSent PRIMARY KEY,
  BookingId BIGINT NOT NULL, Via VARCHAR(5) NOT NULL, ToMasked NVARCHAR(80) NOT NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_NotificationsSent_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_NotificationsSent_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_NotificationsSent_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_NotificationsSent_Via CHECK (Via IN ('email','sms'))
);
CREATE INDEX IX_NotificationsSent_BookingId ON dbo.NotificationsSent (BookingId);
END

IF OBJECT_ID(N'dbo.ResumeLinks', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ResumeLinks (
  LinkToken CHAR(32) NOT NULL CONSTRAINT PK_ResumeLinks PRIMARY KEY,
  DraftId NVARCHAR(40) NOT NULL, Via VARCHAR(5) NOT NULL, ToMasked NVARCHAR(80) NOT NULL,
  SentAt DATETIME2(0) NOT NULL CONSTRAINT DF_ResumeLinks_SentAt DEFAULT SYSUTCDATETIME(), ExpiresAt DATETIME2(0) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ResumeLinks_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ResumeLinks_BookingDrafts FOREIGN KEY (DraftId) REFERENCES dbo.BookingDrafts (Id) ON DELETE CASCADE,
  CONSTRAINT CK_ResumeLinks_Via CHECK (Via IN ('email','sms'))
);
CREATE INDEX IX_ResumeLinks_DraftId ON dbo.ResumeLinks (DraftId);
CREATE INDEX IX_ResumeLinks_ExpiresAt ON dbo.ResumeLinks (ExpiresAt);   -- expiry sweep
END

IF OBJECT_ID(N'dbo.PastTrips', N'U') IS NULL
BEGIN
CREATE TABLE dbo.PastTrips (
  Id NVARCHAR(40) NOT NULL CONSTRAINT PK_PastTrips PRIMARY KEY,
  UserId BIGINT NOT NULL,
  Title NVARCHAR(120) NOT NULL, Ship NVARCHAR(80) NOT NULL, Departure DATE NOT NULL, Nights INT NOT NULL,
  Cancelled BIT NOT NULL CONSTRAINT DF_PastTrips_Cancelled DEFAULT 0, FareCents BIGINT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PastTrips_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_PastTrips_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
);
CREATE INDEX IX_PastTrips_UserId ON dbo.PastTrips (UserId);
END

IF OBJECT_ID(N'dbo.PastTripDocs', N'U') IS NULL
BEGIN
CREATE TABLE dbo.PastTripDocs (
  PastTripId NVARCHAR(40) NOT NULL, Doc VARCHAR(18) NOT NULL, Ready BIT NOT NULL CONSTRAINT DF_PastTripDocs_Ready DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PastTripDocs_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_PastTripDocs PRIMARY KEY (PastTripId, Doc),
  CONSTRAINT FK_PastTripDocs_PastTrips FOREIGN KEY (PastTripId) REFERENCES dbo.PastTrips (Id) ON DELETE CASCADE,
  CONSTRAINT CK_PastTripDocs_Doc CHECK (Doc IN ('fareReceipt','folioStatement','gratuityStatement','taxSummary'))
);
END

IF OBJECT_ID(N'dbo.PastTripPorts', N'U') IS NULL
BEGIN
-- The ports of call of a past cruise, in order, with where each is (degrees), for the guest's "where I have sailed" map.
CREATE TABLE dbo.PastTripPorts (
  PastTripId NVARCHAR(40) NOT NULL, Seq INT NOT NULL, Code NVARCHAR(40) NOT NULL, Name NVARCHAR(80) NOT NULL,
  Lat DECIMAL(7,4) NOT NULL, Lon DECIMAL(8,4) NOT NULL,
  CONSTRAINT PK_PastTripPorts PRIMARY KEY (PastTripId, Seq),
  CONSTRAINT FK_PastTripPorts_PastTrips FOREIGN KEY (PastTripId) REFERENCES dbo.PastTrips (Id) ON DELETE CASCADE,
  CONSTRAINT CK_PastTripPorts_Lat CHECK (Lat BETWEEN -90 AND 90), CONSTRAINT CK_PastTripPorts_Lon CHECK (Lon BETWEEN -180 AND 180)
);
END

IF OBJECT_ID(N'dbo.Loyalty', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Loyalty (
  UserId BIGINT NOT NULL CONSTRAINT PK_Loyalty PRIMARY KEY,
  Number CHAR(9) NOT NULL,                      -- the tier itself lives on Users.Tier
  DaysCounted INT NOT NULL CONSTRAINT DF_Loyalty_DaysCounted DEFAULT 0, ReferralCode NVARCHAR(12) NULL, ReferralCreditCents BIGINT NOT NULL CONSTRAINT DF_Loyalty_ReferralCreditCents DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Loyalty_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Loyalty_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UX_Loyalty_Number UNIQUE (Number),
  CONSTRAINT FK_Loyalty_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX UX_Loyalty_ReferralCode ON dbo.Loyalty (ReferralCode) WHERE ReferralCode IS NOT NULL;
END

IF OBJECT_ID(N'dbo.FutureCruiseCredits', N'U') IS NULL
BEGIN
CREATE TABLE dbo.FutureCruiseCredits (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FutureCruiseCredits PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_FutureCruiseCredits_PublicId DEFAULT NEWID() CONSTRAINT UX_FutureCruiseCredits_PublicId UNIQUE,
  UserId BIGINT NOT NULL,
  OriginalCents BIGINT NOT NULL, RemainingCents BIGINT NOT NULL, ExpiresOn DATE NOT NULL, Source NVARCHAR(40) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_FutureCruiseCredits_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_FutureCruiseCredits_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_FutureCruiseCredits_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_FutureCruiseCredits_Remaining CHECK (RemainingCents BETWEEN 0 AND OriginalCents)
);
CREATE INDEX IX_FutureCruiseCredits_UserId ON dbo.FutureCruiseCredits (UserId);
END

IF OBJECT_ID(N'dbo.Referrals', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Referrals (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Referrals PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Referrals_PublicId DEFAULT NEWID() CONSTRAINT UX_Referrals_PublicId UNIQUE,
  UserId BIGINT NOT NULL,                       -- the referrer
  FriendName NVARCHAR(80) NOT NULL, State VARCHAR(7) NOT NULL CONSTRAINT DF_Referrals_State DEFAULT 'invited',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Referrals_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Referrals_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Referrals_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_Referrals_State CHECK (State IN ('invited','booked','sailed'))
);
CREATE INDEX IX_Referrals_UserId ON dbo.Referrals (UserId);
END

IF OBJECT_ID(N'dbo.LinkedBookings', N'U') IS NULL
BEGIN
CREATE TABLE dbo.LinkedBookings (
  UserId BIGINT NOT NULL, BookingId BIGINT NOT NULL,
  LinkedAt DATETIME2(0) NOT NULL CONSTRAINT DF_LinkedBookings_LinkedAt DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_LinkedBookings_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_LinkedBookings PRIMARY KEY (UserId, BookingId),
  CONSTRAINT FK_LinkedBookings_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_LinkedBookings_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE
);
END
GO

/* =====================================================================================================
   4.4 Documents
   ===================================================================================================== */

IF OBJECT_ID(N'dbo.GuestDocuments', N'U') IS NULL
BEGIN
CREATE TABLE dbo.GuestDocuments (
  UserId BIGINT NOT NULL, Doc VARCHAR(16) NOT NULL, Expires DATE NULL,   -- document numbers are never stored
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_GuestDocuments_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_GuestDocuments_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_GuestDocuments PRIMARY KEY (UserId, Doc),
  CONSTRAINT FK_GuestDocuments_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_GuestDocuments_Doc CHECK (Doc IN ('passport','birthCertificate','photoId','insurance')),
  CONSTRAINT CK_GuestDocuments_Expires CHECK (Expires IS NULL OR Doc <> 'birthCertificate')
);
END
GO

/* =====================================================================================================
   4.5 Pre-cruise (dbo)
   ===================================================================================================== */

IF OBJECT_ID(N'dbo.TourBookings', N'U') IS NULL
BEGIN
CREATE TABLE dbo.TourBookings (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TourBookings PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TourBookings_PublicId DEFAULT NEWID() CONSTRAINT UX_TourBookings_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, SailingId NVARCHAR(40) NOT NULL, ExcursionId NVARCHAR(40) NOT NULL, [Day] INT NOT NULL,
  Source VARCHAR(7) NOT NULL CONSTRAINT DF_TourBookings_Source DEFAULT 'pre',     -- 'onboard' = last-minute tours (charged to FolioLines)
  TotalCents BIGINT NOT NULL, CreditCents BIGINT NOT NULL CONSTRAINT DF_TourBookings_CreditCents DEFAULT 0,
  Status VARCHAR(9) NOT NULL CONSTRAINT DF_TourBookings_Status DEFAULT 'booked',
  CancelFeeCents BIGINT NULL, CancelRefundCents BIGINT NULL,
  PaymentId BIGINT NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_TourBookings_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_TourBookings_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_TourBookings_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_TourBookings_Bookings FOREIGN KEY (BookingId, SailingId) REFERENCES dbo.Bookings (Id, SailingId) ON DELETE CASCADE,
  CONSTRAINT FK_TourBookings_ItineraryDays FOREIGN KEY (SailingId, [Day]) REFERENCES ref.ItineraryDays (SailingId, [Day]),
  CONSTRAINT FK_TourBookings_Excursions FOREIGN KEY (ExcursionId) REFERENCES ref.Excursions (Id),
  CONSTRAINT FK_TourBookings_Payments FOREIGN KEY (PaymentId) REFERENCES dbo.Payments (Id),
  CONSTRAINT CK_TourBookings_Source CHECK (Source IN ('pre','onboard')),
  CONSTRAINT CK_TourBookings_Status CHECK (Status IN ('booked','cancelled')),
  CONSTRAINT UX_TourBookings_Id_BookingId UNIQUE (Id, BookingId)
);
CREATE INDEX IX_TourBookings_BookingId ON dbo.TourBookings (BookingId);
CREATE INDEX IX_TourBookings_ExcursionId_Day ON dbo.TourBookings (ExcursionId, [Day]) INCLUDE (Status);   -- counting spots left
CREATE INDEX IX_TourBookings_PaymentId ON dbo.TourBookings (PaymentId) WHERE PaymentId IS NOT NULL;
END

IF OBJECT_ID(N'dbo.TourBookingGuests', N'U') IS NULL
BEGIN
CREATE TABLE dbo.TourBookingGuests (
  TourBookingId BIGINT NOT NULL, BookingId BIGINT NOT NULL, UserId BIGINT NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_TourBookingGuests_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_TourBookingGuests PRIMARY KEY (TourBookingId, UserId),
  CONSTRAINT FK_TourBookingGuests_TourBookings FOREIGN KEY (TourBookingId, BookingId) REFERENCES dbo.TourBookings (Id, BookingId) ON DELETE CASCADE,
  CONSTRAINT FK_TourBookingGuests_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_TourBookingGuests_BookingGuests FOREIGN KEY (BookingId, UserId) REFERENCES dbo.BookingGuests (BookingId, UserId)
);
CREATE INDEX IX_TourBookingGuests_UserId_BookingId ON dbo.TourBookingGuests (UserId, BookingId);   -- both foreign keys on the person
END

IF OBJECT_ID(N'dbo.TourCartLines', N'U') IS NULL
BEGIN
CREATE TABLE dbo.TourCartLines (
  BookingId BIGINT NOT NULL, ExcursionId NVARCHAR(40) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_TourCartLines_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_TourCartLines PRIMARY KEY (BookingId, ExcursionId),
  CONSTRAINT FK_TourCartLines_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_TourCartLines_Excursions FOREIGN KEY (ExcursionId) REFERENCES ref.Excursions (Id)
);
END

IF OBJECT_ID(N'dbo.TourCartGuests', N'U') IS NULL
BEGIN
CREATE TABLE dbo.TourCartGuests (
  BookingId BIGINT NOT NULL, ExcursionId NVARCHAR(40) NOT NULL, UserId BIGINT NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_TourCartGuests_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_TourCartGuests PRIMARY KEY (BookingId, ExcursionId, UserId),
  CONSTRAINT FK_TourCartGuests_TourCartLines FOREIGN KEY (BookingId, ExcursionId) REFERENCES dbo.TourCartLines (BookingId, ExcursionId) ON DELETE CASCADE,
  CONSTRAINT FK_TourCartGuests_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_TourCartGuests_BookingGuests FOREIGN KEY (BookingId, UserId) REFERENCES dbo.BookingGuests (BookingId, UserId)
);
CREATE INDEX IX_TourCartGuests_UserId_BookingId ON dbo.TourCartGuests (UserId, BookingId);
END

IF OBJECT_ID(N'dbo.DiningReservations', N'U') IS NULL
BEGIN
CREATE TABLE dbo.DiningReservations (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DiningReservations PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_DiningReservations_PublicId DEFAULT NEWID() CONSTRAINT UX_DiningReservations_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, SailingId NVARCHAR(40) NOT NULL, VenueId NVARCHAR(40) NOT NULL, [Day] INT NOT NULL, TimeLocal TIME(0) NOT NULL,
  Note NVARCHAR(300) NOT NULL CONSTRAINT DF_DiningReservations_Note DEFAULT N'', ChargeCents BIGINT NOT NULL CONSTRAINT DF_DiningReservations_ChargeCents DEFAULT 0,
  LateMinutes INT NOT NULL CONSTRAINT DF_DiningReservations_LateMinutes DEFAULT 0, ReminderOn DATE NULL,
  Status VARCHAR(9) NOT NULL CONSTRAINT DF_DiningReservations_Status DEFAULT 'booked',
  GroupSplit VARCHAR(4) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DiningReservations_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DiningReservations_UpdatedAt DEFAULT SYSUTCDATETIME(),
  RowVersion ROWVERSION NOT NULL,
  CONSTRAINT FK_DiningReservations_Bookings FOREIGN KEY (BookingId, SailingId) REFERENCES dbo.Bookings (Id, SailingId) ON DELETE CASCADE,
  CONSTRAINT FK_DiningReservations_ItineraryDays FOREIGN KEY (SailingId, [Day]) REFERENCES ref.ItineraryDays (SailingId, [Day]),
  CONSTRAINT FK_DiningReservations_Venues FOREIGN KEY (VenueId) REFERENCES ref.Venues (Id),
  CONSTRAINT CK_DiningReservations_Status CHECK (Status IN ('booked','cancelled','moved')),
  CONSTRAINT CK_DiningReservations_GroupSplit CHECK (GroupSplit IS NULL OR GroupSplit IN ('mine','even')),
  CONSTRAINT UX_DiningReservations_Id_BookingId UNIQUE (Id, BookingId)
);
CREATE INDEX IX_DiningReservations_BookingId ON dbo.DiningReservations (BookingId);
CREATE INDEX IX_DiningReservations_VenueId_Day_TimeLocal ON dbo.DiningReservations (VenueId, [Day], TimeLocal) INCLUDE (Status);   -- slot capacity
END

IF OBJECT_ID(N'dbo.DiningReservationGuests', N'U') IS NULL
BEGIN
CREATE TABLE dbo.DiningReservationGuests (
  ReservationId BIGINT NOT NULL, BookingId BIGINT NOT NULL, UserId BIGINT NOT NULL, Covered BIT NOT NULL CONSTRAINT DF_DiningReservationGuests_Covered DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DiningReservationGuests_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_DiningReservationGuests PRIMARY KEY (ReservationId, UserId),
  CONSTRAINT FK_DiningReservationGuests_DiningReservations FOREIGN KEY (ReservationId, BookingId) REFERENCES dbo.DiningReservations (Id, BookingId) ON DELETE CASCADE,
  CONSTRAINT FK_DiningReservationGuests_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_DiningReservationGuests_BookingGuests FOREIGN KEY (BookingId, UserId) REFERENCES dbo.BookingGuests (BookingId, UserId)
);
CREATE INDEX IX_DiningReservationGuests_UserId_BookingId ON dbo.DiningReservationGuests (UserId, BookingId);   -- both foreign keys on the person
END

IF OBJECT_ID(N'dbo.GroupTableFriends', N'U') IS NULL
BEGIN
CREATE TABLE dbo.GroupTableFriends (
  ReservationId BIGINT NOT NULL, Seq INT NOT NULL, Name NVARCHAR(80) NOT NULL, Cabin NVARCHAR(8) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_GroupTableFriends_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_GroupTableFriends PRIMARY KEY (ReservationId, Seq),
  CONSTRAINT FK_GroupTableFriends_DiningReservations FOREIGN KEY (ReservationId) REFERENCES dbo.DiningReservations (Id) ON DELETE CASCADE
);
END

IF OBJECT_ID(N'dbo.Waitlists', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Waitlists (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Waitlists PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Waitlists_PublicId DEFAULT NEWID() CONSTRAINT UX_Waitlists_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, VenueId NVARCHAR(40) NOT NULL, [Day] INT NOT NULL, TimeLocal TIME(0) NOT NULL,
  Stage VARCHAR(7) NOT NULL CONSTRAINT DF_Waitlists_Stage DEFAULT 'waiting', Position INT NOT NULL CONSTRAINT DF_Waitlists_Position DEFAULT 1,
  OfferAt DATETIME2(0) NULL, ExpiresAt DATETIME2(0) NULL, Auto BIT NOT NULL CONSTRAINT DF_Waitlists_Auto DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Waitlists_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Waitlists_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Waitlists_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_Waitlists_Venues FOREIGN KEY (VenueId) REFERENCES ref.Venues (Id),
  CONSTRAINT CK_Waitlists_Stage CHECK (Stage IN ('waiting','offered','expired','booked')),
  CONSTRAINT UX_Waitlists_Id_BookingId UNIQUE (Id, BookingId),
  CONSTRAINT CK_Waitlists_Position CHECK (Position >= 1)
);
CREATE INDEX IX_Waitlists_BookingId ON dbo.Waitlists (BookingId);
CREATE INDEX IX_Waitlists_VenueId_Day_TimeLocal ON dbo.Waitlists (VenueId, [Day], TimeLocal) INCLUDE (Stage, Position);
END

IF OBJECT_ID(N'dbo.WaitlistGuests', N'U') IS NULL
BEGIN
CREATE TABLE dbo.WaitlistGuests (
  WaitlistId BIGINT NOT NULL, BookingId BIGINT NOT NULL, UserId BIGINT NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_WaitlistGuests_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_WaitlistGuests PRIMARY KEY (WaitlistId, UserId),
  CONSTRAINT FK_WaitlistGuests_Waitlists FOREIGN KEY (WaitlistId, BookingId) REFERENCES dbo.Waitlists (Id, BookingId) ON DELETE CASCADE,
  CONSTRAINT FK_WaitlistGuests_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_WaitlistGuests_BookingGuests FOREIGN KEY (BookingId, UserId) REFERENCES dbo.BookingGuests (BookingId, UserId)
);
CREATE INDEX IX_WaitlistGuests_UserId_BookingId ON dbo.WaitlistGuests (UserId, BookingId);   -- both foreign keys on the person
END

IF OBJECT_ID(N'dbo.Queues', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Queues (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Queues PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Queues_PublicId DEFAULT NEWID() CONSTRAINT UX_Queues_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, VenueId NVARCHAR(40) NOT NULL,
  JoinedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Queues_JoinedAt DEFAULT SYSUTCDATETIME(),
  Stage VARCHAR(7) NOT NULL CONSTRAINT DF_Queues_Stage DEFAULT 'waiting', Position INT NOT NULL CONSTRAINT DF_Queues_Position DEFAULT 1,
  ReadyAt DATETIME2(0) NULL, ExpiresAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Queues_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Queues_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Queues_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_Queues_Venues FOREIGN KEY (VenueId) REFERENCES ref.Venues (Id),
  CONSTRAINT CK_Queues_Stage CHECK (Stage IN ('waiting','ready','expired','left')),
  CONSTRAINT CK_Queues_Position CHECK (Position >= 1)
);
CREATE INDEX IX_Queues_BookingId ON dbo.Queues (BookingId);
CREATE INDEX IX_Queues_VenueId_Stage ON dbo.Queues (VenueId, Stage) INCLUDE (Position);
END

IF OBJECT_ID(N'dbo.Purchases', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Purchases (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Purchases PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Purchases_PublicId DEFAULT NEWID() CONSTRAINT UX_Purchases_PublicId UNIQUE,
  BookingId BIGINT NOT NULL,
  Kind VARCHAR(7) NOT NULL, ItemId NVARCHAR(30) NOT NULL,   -- an ref.AddOns id or a ref.Packages id, by Kind
  Units INT NOT NULL, UnitCents BIGINT NOT NULL, TotalCents BIGINT NOT NULL,
  Status VARCHAR(9) NOT NULL CONSTRAINT DF_Purchases_Status DEFAULT 'active', CreditedCents BIGINT NOT NULL CONSTRAINT DF_Purchases_CreditedCents DEFAULT 0,
  PaymentId BIGINT NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_Purchases_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Purchases_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Purchases_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Purchases_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_Purchases_Payments FOREIGN KEY (PaymentId) REFERENCES dbo.Payments (Id),
  CONSTRAINT CK_Purchases_Kind CHECK (Kind IN ('addOn','upgrade')),
  CONSTRAINT CK_Purchases_Status CHECK (Status IN ('active','cancelled')),
  CONSTRAINT CK_Purchases_Units CHECK (Units > 0),
  CONSTRAINT UX_Purchases_Id_BookingId UNIQUE (Id, BookingId),
  CONSTRAINT CK_Purchases_Amounts CHECK (UnitCents >= 0 AND TotalCents >= 0 AND CreditedCents >= 0)
);
CREATE INDEX IX_Purchases_BookingId ON dbo.Purchases (BookingId);
CREATE INDEX IX_Purchases_PaymentId ON dbo.Purchases (PaymentId) WHERE PaymentId IS NOT NULL;
END

IF OBJECT_ID(N'dbo.PurchaseGuests', N'U') IS NULL
BEGIN
CREATE TABLE dbo.PurchaseGuests (
  PurchaseId BIGINT NOT NULL, BookingId BIGINT NOT NULL, UserId BIGINT NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PurchaseGuests_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_PurchaseGuests PRIMARY KEY (PurchaseId, UserId),
  CONSTRAINT FK_PurchaseGuests_Purchases FOREIGN KEY (PurchaseId, BookingId) REFERENCES dbo.Purchases (Id, BookingId) ON DELETE CASCADE,
  CONSTRAINT FK_PurchaseGuests_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_PurchaseGuests_BookingGuests FOREIGN KEY (BookingId, UserId) REFERENCES dbo.BookingGuests (BookingId, UserId)
);
CREATE INDEX IX_PurchaseGuests_UserId_BookingId ON dbo.PurchaseGuests (UserId, BookingId);   -- both foreign keys on the person
END

IF OBJECT_ID(N'dbo.ChecklistTicks', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ChecklistTicks (
  BookingId BIGINT NOT NULL, ItemId NVARCHAR(40) NOT NULL, Done BIT NOT NULL CONSTRAINT DF_ChecklistTicks_Done DEFAULT 1,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_ChecklistTicks_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ChecklistTicks_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_ChecklistTicks PRIMARY KEY (BookingId, ItemId),
  CONSTRAINT FK_ChecklistTicks_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_ChecklistTicks_ChecklistItems FOREIGN KEY (ItemId) REFERENCES ref.ChecklistItems (Id)
);
END

IF OBJECT_ID(N'dbo.PackingTicks', N'U') IS NULL
BEGIN
CREATE TABLE dbo.PackingTicks (
  BookingId BIGINT NOT NULL, ItemId NVARCHAR(40) NOT NULL, Done BIT NOT NULL CONSTRAINT DF_PackingTicks_Done DEFAULT 1,
  TickedBy BIGINT NULL,   -- the guest who last ticked or unticked it, so the list can say who
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_PackingTicks_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PackingTicks_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_PackingTicks PRIMARY KEY (BookingId, ItemId),
  CONSTRAINT FK_PackingTicks_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_PackingTicks_PackingItems FOREIGN KEY (ItemId) REFERENCES ref.PackingItems (Id)
);
END

IF COL_LENGTH(N'dbo.PackingTicks', N'TickedBy') IS NULL ALTER TABLE dbo.PackingTicks ADD TickedBy BIGINT NULL;

IF OBJECT_ID(N'dbo.PrepTicks', N'U') IS NULL
BEGIN
CREATE TABLE dbo.PrepTicks (
  BookingId BIGINT NOT NULL, ItemId NVARCHAR(40) NOT NULL, Done BIT NOT NULL CONSTRAINT DF_PrepTicks_Done DEFAULT 1,   -- item ids come from code, so no FK
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_PrepTicks_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PrepTicks_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_PrepTicks PRIMARY KEY (BookingId, ItemId),
  CONSTRAINT FK_PrepTicks_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE
);
END

IF OBJECT_ID(N'dbo.ReadyTicks', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ReadyTicks (
  BookingId BIGINT NOT NULL, [Day] INT NOT NULL, ItemId NVARCHAR(40) NOT NULL, Done BIT NOT NULL CONSTRAINT DF_ReadyTicks_Done DEFAULT 1,   -- resets daily; ids from code
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_ReadyTicks_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ReadyTicks_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_ReadyTicks PRIMARY KEY (BookingId, [Day], ItemId),
  CONSTRAINT FK_ReadyTicks_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE
);
END

IF OBJECT_ID(N'dbo.NightTicks', N'U') IS NULL
BEGIN
CREATE TABLE dbo.NightTicks (
  BookingId BIGINT NOT NULL, ItemId NVARCHAR(40) NOT NULL, Done BIT NOT NULL CONSTRAINT DF_NightTicks_Done DEFAULT 1,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_NightTicks_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_NightTicks_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_NightTicks PRIMARY KEY (BookingId, ItemId),
  CONSTRAINT FK_NightTicks_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_NightTicks_NightChecklistItems FOREIGN KEY (ItemId) REFERENCES ref.NightChecklistItems (Id)
);
END

IF OBJECT_ID(N'dbo.TravelPlans', N'U') IS NULL
BEGIN
CREATE TABLE dbo.TravelPlans (
  BookingId BIGINT NOT NULL CONSTRAINT PK_TravelPlans PRIMARY KEY,
  ArrivalMode NVARCHAR(20) NOT NULL, ArrivalDate DATE NULL, ArrivalWindowId NVARCHAR(30) NULL, FlightNo NVARCHAR(12) NULL,
  Details NVARCHAR(MAX) NOT NULL CONSTRAINT DF_TravelPlans_Details DEFAULT N'{}',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_TravelPlans_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_TravelPlans_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_TravelPlans_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_TravelPlans_TravelWindows FOREIGN KEY (ArrivalWindowId) REFERENCES ref.TravelWindows (Id),
  CONSTRAINT CK_TravelPlans_Details CHECK (ISJSON(Details) = 1)
);
END

IF OBJECT_ID(N'dbo.AssistanceRequests', N'U') IS NULL
BEGIN
CREATE TABLE dbo.AssistanceRequests (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AssistanceRequests PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_AssistanceRequests_PublicId DEFAULT NEWID() CONSTRAINT UX_AssistanceRequests_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, GuestUserId BIGINT NOT NULL,
  Kind NVARCHAR(20) NOT NULL, Note NVARCHAR(500) NOT NULL CONSTRAINT DF_AssistanceRequests_Note DEFAULT N'',
  Status VARCHAR(9) NOT NULL CONSTRAINT DF_AssistanceRequests_Status DEFAULT 'received',
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_AssistanceRequests_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AssistanceRequests_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AssistanceRequests_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_AssistanceRequests_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_AssistanceRequests_Users_Guest FOREIGN KEY (GuestUserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_AssistanceRequests_Status CHECK (Status IN ('received','confirmed','declined','cancelled'))
);
CREATE INDEX IX_AssistanceRequests_BookingId ON dbo.AssistanceRequests (BookingId);
CREATE INDEX IX_AssistanceRequests_GuestUserId ON dbo.AssistanceRequests (GuestUserId);
END
GO

/* =====================================================================================================
   4.6 Ahead (dbo)
   ===================================================================================================== */

IF OBJECT_ID(N'dbo.AdvisorRequests', N'U') IS NULL
BEGIN
CREATE TABLE dbo.AdvisorRequests (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AdvisorRequests PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_AdvisorRequests_PublicId DEFAULT NEWID() CONSTRAINT UX_AdvisorRequests_PublicId UNIQUE,
  UserId BIGINT NOT NULL, AdvisorId NVARCHAR(40) NOT NULL,
  Way VARCHAR(8) NOT NULL, Phone NVARCHAR(30) NULL, Question NVARCHAR(1000) NOT NULL,
  Reply NVARCHAR(MAX) NULL, CallbackBy DATETIME2(0) NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_AdvisorRequests_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AdvisorRequests_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AdvisorRequests_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_AdvisorRequests_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_AdvisorRequests_Advisors FOREIGN KEY (AdvisorId) REFERENCES ref.Advisors (Id),
  CONSTRAINT CK_AdvisorRequests_Way CHECK (Way IN ('callback','chat'))
);
CREATE INDEX IX_AdvisorRequests_UserId ON dbo.AdvisorRequests (UserId);
END

IF OBJECT_ID(N'dbo.MarketingConsents', N'U') IS NULL
BEGIN
CREATE TABLE dbo.MarketingConsents (
  UserId BIGINT NOT NULL, Channel VARCHAR(5) NOT NULL,
  Contact NVARCHAR(254) NOT NULL, Region VARCHAR(2) NOT NULL,
  State VARCHAR(9) NOT NULL CONSTRAINT DF_MarketingConsents_State DEFAULT 'pending', CodeHash BINARY(32) NULL,
  AskedAt DATETIME2(0) NOT NULL CONSTRAINT DF_MarketingConsents_AskedAt DEFAULT SYSUTCDATETIME(), ConfirmedAt DATETIME2(0) NULL, ExpiresAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_MarketingConsents_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_MarketingConsents_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_MarketingConsents PRIMARY KEY (UserId, Channel),
  CONSTRAINT FK_MarketingConsents_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_MarketingConsents_Channel CHECK (Channel IN ('email','sms')),
  CONSTRAINT CK_MarketingConsents_Region CHECK (Region IN ('us','ca','uk','eu','au')),
  CONSTRAINT CK_MarketingConsents_State CHECK (State IN ('pending','confirmed','expired','withdrawn'))
);
END

IF OBJECT_ID(N'dbo.UpgradeBids', N'U') IS NULL
BEGIN
CREATE TABLE dbo.UpgradeBids (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UpgradeBids PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_UpgradeBids_PublicId DEFAULT NEWID() CONSTRAINT UX_UpgradeBids_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, CategoryId NVARCHAR(30) NOT NULL, Cents BIGINT NOT NULL,
  Status VARCHAR(9) NOT NULL CONSTRAINT DF_UpgradeBids_Status DEFAULT 'open', BuyNow BIT NOT NULL CONSTRAINT DF_UpgradeBids_BuyNow DEFAULT 0,
  DecidedAt DATETIME2(0) NULL, [At] DATETIME2(0) NOT NULL CONSTRAINT DF_UpgradeBids_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UpgradeBids_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UpgradeBids_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_UpgradeBids_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_UpgradeBids_CabinCategories FOREIGN KEY (CategoryId) REFERENCES ref.CabinCategories (Id),
  CONSTRAINT CK_UpgradeBids_Status CHECK (Status IN ('open','accepted','declined','withdrawn')),
  CONSTRAINT CK_UpgradeBids_Cents CHECK (Cents > 0)
);
CREATE INDEX IX_UpgradeBids_BookingId ON dbo.UpgradeBids (BookingId);
CREATE UNIQUE INDEX UX_UpgradeBids_BookingId_CategoryId_Open ON dbo.UpgradeBids (BookingId, CategoryId) WHERE Status = 'open';
END

IF OBJECT_ID(N'dbo.ClubRegistrations', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ClubRegistrations (
  ChildUserId BIGINT NOT NULL, BookingId BIGINT NOT NULL, ClubId NVARCHAR(30) NOT NULL,
  EmergencyName NVARCHAR(80) NOT NULL, EmergencyPhone NVARCHAR(30) NOT NULL,
  Pickups NVARCHAR(MAX) NOT NULL CONSTRAINT DF_ClubRegistrations_Pickups DEFAULT N'[]',
  Allergies NVARCHAR(300) NOT NULL CONSTRAINT DF_ClubRegistrations_Allergies DEFAULT N'', Notes NVARCHAR(500) NOT NULL CONSTRAINT DF_ClubRegistrations_Notes DEFAULT N'',
  SignOutAlone BIT NOT NULL CONSTRAINT DF_ClubRegistrations_SignOutAlone DEFAULT 0, Photos BIT NOT NULL CONSTRAINT DF_ClubRegistrations_Photos DEFAULT 0,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_ClubRegistrations_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ClubRegistrations_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ClubRegistrations_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_ClubRegistrations PRIMARY KEY (ChildUserId, BookingId),
  CONSTRAINT FK_ClubRegistrations_Users_Child FOREIGN KEY (ChildUserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_ClubRegistrations_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_ClubRegistrations_Clubs FOREIGN KEY (ClubId) REFERENCES ref.Clubs (Id),
  CONSTRAINT CK_ClubRegistrations_Pickups CHECK (ISJSON(Pickups) = 1),
  CONSTRAINT FK_ClubRegistrations_BookingGuests FOREIGN KEY (BookingId, ChildUserId) REFERENCES dbo.BookingGuests (BookingId, UserId)
);
CREATE INDEX IX_ClubRegistrations_BookingId_ChildUserId ON dbo.ClubRegistrations (BookingId, ChildUserId);
END

IF OBJECT_ID(N'dbo.Medallions', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Medallions (
  BookingId BIGINT NOT NULL CONSTRAINT PK_Medallions PRIMARY KEY,
  Stage VARCHAR(9) NOT NULL CONSTRAINT DF_Medallions_Stage DEFAULT 'preparing',
  ActivatedAt DATETIME2(0) NULL, LostAt DATETIME2(0) NULL, TrackingNumber NVARCHAR(30) NULL,
  Address NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Medallions_Address DEFAULT N'{}',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Medallions_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Medallions_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Medallions_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_Medallions_Stage CHECK (Stage IN ('preparing','shipped','delivered','collect')),
  CONSTRAINT CK_Medallions_Address CHECK (ISJSON(Address) = 1)
);
END

IF OBJECT_ID(N'dbo.MedallionGuests', N'U') IS NULL
BEGIN
CREATE TABLE dbo.MedallionGuests (
  BookingId BIGINT NOT NULL, UserId BIGINT NOT NULL, Serial NVARCHAR(16) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_MedallionGuests_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_MedallionGuests PRIMARY KEY (BookingId, UserId),
  CONSTRAINT FK_MedallionGuests_Medallions FOREIGN KEY (BookingId) REFERENCES dbo.Medallions (BookingId) ON DELETE CASCADE,
  CONSTRAINT FK_MedallionGuests_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_MedallionGuests_BookingGuests FOREIGN KEY (BookingId, UserId) REFERENCES dbo.BookingGuests (BookingId, UserId)
);
CREATE INDEX IX_MedallionGuests_UserId_BookingId ON dbo.MedallionGuests (UserId, BookingId);
END

IF OBJECT_ID(N'dbo.BagTagOrders', N'U') IS NULL
BEGIN
CREATE TABLE dbo.BagTagOrders (
  BookingId BIGINT NOT NULL CONSTRAINT PK_BagTagOrders PRIMARY KEY,
  Way VARCHAR(5) NOT NULL, OrderedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BagTagOrders_OrderedAt DEFAULT SYSUTCDATETIME(), HandedOverAt DATETIME2(0) NULL,
  Stage VARCHAR(10) NOT NULL CONSTRAINT DF_BagTagOrders_Stage DEFAULT 'none',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BagTagOrders_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BagTagOrders_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_BagTagOrders_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_BagTagOrders_Way CHECK (Way IN ('print','etag','order')),
  CONSTRAINT CK_BagTagOrders_Stage CHECK (Stage IN ('none','atHome','handedOver','onShip','inCorridor','delivered'))
);
END

IF OBJECT_ID(N'dbo.FixCases', N'U') IS NULL
BEGIN
CREATE TABLE dbo.FixCases (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FixCases PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_FixCases_PublicId DEFAULT NEWID() CONSTRAINT UX_FixCases_PublicId UNIQUE,
  UserId BIGINT NOT NULL,
  Flow NVARCHAR(20) NOT NULL, Note NVARCHAR(500) NOT NULL CONSTRAINT DF_FixCases_Note DEFAULT N'', Stage NVARCHAR(20) NOT NULL CONSTRAINT DF_FixCases_Stage DEFAULT N'received',
  Reference NVARCHAR(16) NOT NULL, ContactBy DATETIME2(0) NOT NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_FixCases_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_FixCases_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_FixCases_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_FixCases_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
);
CREATE INDEX IX_FixCases_UserId ON dbo.FixCases (UserId);
END

IF OBJECT_ID(N'dbo.AssistCases', N'U') IS NULL
BEGIN
CREATE TABLE dbo.AssistCases (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AssistCases PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_AssistCases_PublicId DEFAULT NEWID() CONSTRAINT UX_AssistCases_PublicId UNIQUE,
  UserId BIGINT NOT NULL, BookingId BIGINT NULL,
  Kind VARCHAR(15) NOT NULL, Phone NVARCHAR(30) NULL, Note NVARCHAR(1000) NOT NULL CONSTRAINT DF_AssistCases_Note DEFAULT N'',
  Stage VARCHAR(9) NOT NULL CONSTRAINT DF_AssistCases_Stage DEFAULT 'received', Reference NVARCHAR(16) NOT NULL,
  FeeCents BIGINT NULL, RefundCents BIGINT NULL, CreditCents BIGINT NULL, Choice VARCHAR(6) NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_AssistCases_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AssistCases_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AssistCases_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_AssistCases_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_AssistCases_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_AssistCases_Kind CHECK (Kind IN ('assistedBooking','bereavement','medical')),
  CONSTRAINT CK_AssistCases_Stage CHECK (Stage IN ('received','reviewing','decided')),
  CONSTRAINT CK_AssistCases_Choice CHECK (Choice IS NULL OR Choice IN ('refund','credit'))
);
CREATE INDEX IX_AssistCases_UserId ON dbo.AssistCases (UserId);
CREATE INDEX IX_AssistCases_BookingId ON dbo.AssistCases (BookingId) WHERE BookingId IS NOT NULL;
END
GO

/* =====================================================================================================
   4.7 Check-in and boarding (dbo)
   Per-person rows reference BookingGuests(BookingId, UserId), so the person must be on the booking, and a
   delete of the booking or of the user reaches the row by exactly one cascade path.
   ===================================================================================================== */

IF OBJECT_ID(N'dbo.CheckinGuests', N'U') IS NULL
BEGIN
CREATE TABLE dbo.CheckinGuests (
  BookingId BIGINT NOT NULL, UserId BIGINT NOT NULL, Step VARCHAR(9) NOT NULL,
  DoneAt DATETIME2(0) NOT NULL CONSTRAINT DF_CheckinGuests_DoneAt DEFAULT SYSUTCDATETIME(),
  Data NVARCHAR(MAX) NOT NULL CONSTRAINT DF_CheckinGuests_Data DEFAULT N'{}',   -- per-step payload; the photo itself is never kept
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CheckinGuests_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CheckinGuests_UpdatedAt DEFAULT SYSUTCDATETIME(),
  RowVersion ROWVERSION NOT NULL,
  CONSTRAINT PK_CheckinGuests PRIMARY KEY (BookingId, UserId, Step),
  CONSTRAINT FK_CheckinGuests_BookingGuests FOREIGN KEY (BookingId, UserId) REFERENCES dbo.BookingGuests (BookingId, UserId) ON DELETE CASCADE,
  CONSTRAINT CK_CheckinGuests_Step CHECK (Step IN ('confirm','document','photo','emergency','contract','health')),
  CONSTRAINT CK_CheckinGuests_Data CHECK (ISJSON(Data) = 1)
);
END

IF OBJECT_ID(N'dbo.CheckinBooking', N'U') IS NULL
BEGIN
CREATE TABLE dbo.CheckinBooking (
  BookingId BIGINT NOT NULL CONSTRAINT PK_CheckinBooking PRIMARY KEY,
  PaymentCardId BIGINT NULL,                    -- no FK, as PaymentParts.CardId
  PaymentLabel NVARCHAR(60) NULL, PaymentAt DATETIME2(0) NULL,
  ArrivalWindowId NVARCHAR(30) NULL, ArrivalAt DATETIME2(0) NULL, FinishedAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CheckinBooking_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CheckinBooking_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_CheckinBooking_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_CheckinBooking_TravelWindows FOREIGN KEY (ArrivalWindowId) REFERENCES ref.TravelWindows (Id)
);
END

IF OBJECT_ID(N'dbo.BoardingPasses', N'U') IS NULL
BEGIN
CREATE TABLE dbo.BoardingPasses (
  BookingId BIGINT NOT NULL, UserId BIGINT NOT NULL, Seq INT NOT NULL,
  Code NVARCHAR(200) NOT NULL,                  -- signed PassData v1 payload, re-verifiable
  InWallet BIT NOT NULL CONSTRAINT DF_BoardingPasses_InWallet DEFAULT 0, IssuedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BoardingPasses_IssuedAt DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BoardingPasses_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_BoardingPasses PRIMARY KEY (BookingId, UserId),
  CONSTRAINT UX_BoardingPasses_Code UNIQUE (Code),
  CONSTRAINT FK_BoardingPasses_BookingGuests FOREIGN KEY (BookingId, UserId) REFERENCES dbo.BookingGuests (BookingId, UserId) ON DELETE CASCADE
);
END

IF OBJECT_ID(N'dbo.EmbarkProgress', N'U') IS NULL
BEGIN
CREATE TABLE dbo.EmbarkProgress (
  BookingId BIGINT NOT NULL CONSTRAINT PK_EmbarkProgress PRIMARY KEY,
  LuggageStatus VARCHAR(10) NOT NULL CONSTRAINT DF_EmbarkProgress_LuggageStatus DEFAULT 'notDropped', LuggageDroppedAt DATETIME2(0) NULL,
  Terminal NVARCHAR(60) NOT NULL CONSTRAINT DF_EmbarkProgress_Terminal DEFAULT N'',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_EmbarkProgress_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_EmbarkProgress_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_EmbarkProgress_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_EmbarkProgress_LuggageStatus CHECK (LuggageStatus IN ('notDropped','dropped','delivered'))
);
END

IF OBJECT_ID(N'dbo.EmbarkTicks', N'U') IS NULL
BEGIN
CREATE TABLE dbo.EmbarkTicks (
  BookingId BIGINT NOT NULL, Kind VARCHAR(9) NOT NULL, ItemId NVARCHAR(30) NOT NULL, Done BIT NOT NULL CONSTRAINT DF_EmbarkTicks_Done DEFAULT 1,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_EmbarkTicks_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_EmbarkTicks PRIMARY KEY (BookingId, Kind, ItemId),
  CONSTRAINT FK_EmbarkTicks_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_EmbarkTicks_Kind CHECK (Kind IN ('companion','carryOn'))
);
END

IF OBJECT_ID(N'dbo.MusterConfirmations', N'U') IS NULL
BEGIN
CREATE TABLE dbo.MusterConfirmations (
  BookingId BIGINT NOT NULL, UserId BIGINT NOT NULL,
  ConfirmedAt DATETIME2(0) NOT NULL CONSTRAINT DF_MusterConfirmations_ConfirmedAt DEFAULT SYSUTCDATETIME(), ByUserId BIGINT NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_MusterConfirmations_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_MusterConfirmations PRIMARY KEY (BookingId, UserId),
  CONSTRAINT FK_MusterConfirmations_BookingGuests FOREIGN KEY (BookingId, UserId) REFERENCES dbo.BookingGuests (BookingId, UserId) ON DELETE CASCADE,
  CONSTRAINT FK_MusterConfirmations_Users_By FOREIGN KEY (ByUserId) REFERENCES dbo.Users (Id)
);
CREATE INDEX IX_MusterConfirmations_ByUserId ON dbo.MusterConfirmations (ByUserId);
END
GO

/* =====================================================================================================
   4.8 On board (dbo)
   ===================================================================================================== */

IF OBJECT_ID(N'dbo.PlanEvents', N'U') IS NULL
BEGIN
CREATE TABLE dbo.PlanEvents (
  UserId BIGINT NOT NULL, SailingId NVARCHAR(40) NOT NULL, EventId NVARCHAR(40) NOT NULL, [Day] INT NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PlanEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_PlanEvents PRIMARY KEY (UserId, SailingId, EventId, [Day]),
  CONSTRAINT FK_PlanEvents_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_PlanEvents_EventDays FOREIGN KEY (EventId, SailingId, [Day]) REFERENCES ref.EventDays (EventId, SailingId, [Day])
);
END

IF OBJECT_ID(N'dbo.ShowTickets', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ShowTickets (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ShowTickets PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ShowTickets_PublicId DEFAULT NEWID() CONSTRAINT UX_ShowTickets_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, SailingId NVARCHAR(40) NOT NULL, EventId NVARCHAR(40) NOT NULL, [Day] INT NOT NULL,
  Status VARCHAR(9) NOT NULL CONSTRAINT DF_ShowTickets_Status DEFAULT 'on', [At] DATETIME2(0) NOT NULL CONSTRAINT DF_ShowTickets_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ShowTickets_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ShowTickets_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ShowTickets_Bookings FOREIGN KEY (BookingId, SailingId) REFERENCES dbo.Bookings (Id, SailingId) ON DELETE CASCADE,
  CONSTRAINT FK_ShowTickets_ItineraryDays FOREIGN KEY (SailingId, [Day]) REFERENCES ref.ItineraryDays (SailingId, [Day]),
  CONSTRAINT FK_ShowTickets_Events FOREIGN KEY (EventId) REFERENCES ref.Events (Id),
  CONSTRAINT CK_ShowTickets_Status CHECK (Status IN ('on','moved','cancelled')),
  CONSTRAINT UX_ShowTickets_Id_BookingId UNIQUE (Id, BookingId)
);
CREATE INDEX IX_ShowTickets_BookingId ON dbo.ShowTickets (BookingId);
CREATE INDEX IX_ShowTickets_EventId_Day ON dbo.ShowTickets (EventId, [Day]) INCLUDE (Status);   -- seats left (soldOut)
END

IF OBJECT_ID(N'dbo.ShowTicketGuests', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ShowTicketGuests (
  ShowTicketId BIGINT NOT NULL, BookingId BIGINT NOT NULL, UserId BIGINT NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ShowTicketGuests_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_ShowTicketGuests PRIMARY KEY (ShowTicketId, UserId),
  CONSTRAINT FK_ShowTicketGuests_ShowTickets FOREIGN KEY (ShowTicketId, BookingId) REFERENCES dbo.ShowTickets (Id, BookingId) ON DELETE CASCADE,
  CONSTRAINT FK_ShowTicketGuests_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_ShowTicketGuests_BookingGuests FOREIGN KEY (BookingId, UserId) REFERENCES dbo.BookingGuests (BookingId, UserId)
);
CREATE INDEX IX_ShowTicketGuests_UserId_BookingId ON dbo.ShowTicketGuests (UserId, BookingId);   -- both foreign keys on the person
END

IF OBJECT_ID(N'dbo.Orders', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Orders (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Orders PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Orders_PublicId DEFAULT NEWID() CONSTRAINT UX_Orders_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, PlacedByUserId BIGINT NOT NULL,
  Kind VARCHAR(9) NOT NULL,
  PlacedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_PlacedAt DEFAULT SYSUTCDATETIME(), DeliverAt DATETIME2(0) NULL,
  LocationKind VARCHAR(5) NOT NULL CONSTRAINT DF_Orders_LocationKind DEFAULT 'cabin', LocationRef NVARCHAR(80) NULL,
  TipCents BIGINT NOT NULL CONSTRAINT DF_Orders_TipCents DEFAULT 0, FeeCents BIGINT NOT NULL CONSTRAINT DF_Orders_FeeCents DEFAULT 0, ServiceCents BIGINT NOT NULL CONSTRAINT DF_Orders_ServiceCents DEFAULT 0,
  TotalCents BIGINT NOT NULL CONSTRAINT DF_Orders_TotalCents DEFAULT 0, CoveredCents BIGINT NOT NULL CONSTRAINT DF_Orders_CoveredCents DEFAULT 0, RefundCents BIGINT NOT NULL CONSTRAINT DF_Orders_RefundCents DEFAULT 0,
  Stage VARCHAR(11) NOT NULL CONSTRAINT DF_Orders_Stage DEFAULT 'received',   -- derived on read from timestamps and the clock; stored lazily
  EtaAt DATETIME2(0) NULL, Contacted INT NOT NULL CONSTRAINT DF_Orders_Contacted DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_UpdatedAt DEFAULT SYSUTCDATETIME(),
  RowVersion ROWVERSION NOT NULL,
  CONSTRAINT FK_Orders_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_Orders_Users_PlacedBy FOREIGN KEY (PlacedByUserId) REFERENCES dbo.Users (Id),
  CONSTRAINT CK_Orders_Kind CHECK (Kind IN ('delivery','room','breakfast')),
  CONSTRAINT CK_Orders_LocationKind CHECK (LocationKind IN ('cabin','zone','other')),
  CONSTRAINT CK_Orders_Stage CHECK (Stage IN ('scheduled','received','preparing','needsChoice','onTheWay','delivered','cancelled')),
  CONSTRAINT UX_Orders_Id_BookingId UNIQUE (Id, BookingId),
  CONSTRAINT CK_Orders_Amounts CHECK (TipCents >= 0 AND FeeCents >= 0 AND ServiceCents >= 0 AND TotalCents >= 0 AND CoveredCents >= 0 AND RefundCents >= 0)
);
CREATE INDEX IX_Orders_BookingId_PlacedAt ON dbo.Orders (BookingId, PlacedAt DESC);
CREATE INDEX IX_Orders_PlacedByUserId ON dbo.Orders (PlacedByUserId);
END

IF OBJECT_ID(N'dbo.OrderLines', N'U') IS NULL
BEGIN
CREATE TABLE dbo.OrderLines (
  OrderId BIGINT NOT NULL, BookingId BIGINT NOT NULL, Seq INT NOT NULL,
  ItemId NVARCHAR(40) NOT NULL, Qty INT NOT NULL CONSTRAINT DF_OrderLines_Qty DEFAULT 1, GuestUserId BIGINT NOT NULL,
  Extras NVARCHAR(200) NULL,                    -- csv of MenuExtras ids
  Note NVARCHAR(200) NULL, UnitCents BIGINT NOT NULL, Choice VARCHAR(10) NULL, Unavailable BIT NOT NULL CONSTRAINT DF_OrderLines_Unavailable DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OrderLines_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_OrderLines PRIMARY KEY (OrderId, Seq),
  CONSTRAINT FK_OrderLines_Orders FOREIGN KEY (OrderId, BookingId) REFERENCES dbo.Orders (Id, BookingId) ON DELETE CASCADE,
  CONSTRAINT FK_OrderLines_MenuItems FOREIGN KEY (ItemId) REFERENCES ref.MenuItems (Id),
  CONSTRAINT FK_OrderLines_BookingGuests FOREIGN KEY (BookingId, GuestUserId) REFERENCES dbo.BookingGuests (BookingId, UserId),
  CONSTRAINT CK_OrderLines_Qty CHECK (Qty > 0),
  CONSTRAINT CK_OrderLines_Choice CHECK (Choice IS NULL OR Choice IN ('substitute','remove'))
);
CREATE INDEX IX_OrderLines_GuestUserId_BookingId ON dbo.OrderLines (GuestUserId, BookingId);
END

IF OBJECT_ID(N'dbo.ChatGroups', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ChatGroups (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ChatGroups PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ChatGroups_PublicId DEFAULT NEWID() CONSTRAINT UX_ChatGroups_PublicId UNIQUE,
  Name NVARCHAR(80) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ChatGroups_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ChatGroups_UpdatedAt DEFAULT SYSUTCDATETIME()
);
END

IF OBJECT_ID(N'dbo.ChatGroupMembers', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ChatGroupMembers (
  GroupId BIGINT NOT NULL, UserId BIGINT NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ChatGroupMembers_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_ChatGroupMembers PRIMARY KEY (GroupId, UserId),
  CONSTRAINT FK_ChatGroupMembers_ChatGroups FOREIGN KEY (GroupId) REFERENCES dbo.ChatGroups (Id) ON DELETE CASCADE,
  CONSTRAINT FK_ChatGroupMembers_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
);
CREATE INDEX IX_ChatGroupMembers_UserId ON dbo.ChatGroupMembers (UserId);   -- which groups can I see
END

IF OBJECT_ID(N'dbo.ChatMessages', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ChatMessages (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ChatMessages PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ChatMessages_PublicId DEFAULT NEWID() CONSTRAINT UX_ChatMessages_PublicId UNIQUE,
  GroupId BIGINT NOT NULL, FromUserId BIGINT NOT NULL,
  [Text] NVARCHAR(2000) NOT NULL CONSTRAINT DF_ChatMessages_Text DEFAULT N'',
  Photo NVARCHAR(MAX) NULL,                     -- data URL, capped by the API (decision 5: blob storage is a later option)
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_ChatMessages_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ChatMessages_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ChatMessages_ChatGroups FOREIGN KEY (GroupId) REFERENCES dbo.ChatGroups (Id) ON DELETE CASCADE,
  CONSTRAINT FK_ChatMessages_Users_From FOREIGN KEY (FromUserId) REFERENCES dbo.Users (Id)
);
CREATE INDEX IX_ChatMessages_GroupId_At ON dbo.ChatMessages (GroupId, [At]);
CREATE INDEX IX_ChatMessages_FromUserId ON dbo.ChatMessages (FromUserId);
END

IF OBJECT_ID(N'dbo.ChatReads', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ChatReads (
  MessageId BIGINT NOT NULL, UserId BIGINT NOT NULL, SeenAt DATETIME2(0) NOT NULL CONSTRAINT DF_ChatReads_SeenAt DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ChatReads_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_ChatReads PRIMARY KEY (MessageId, UserId),
  CONSTRAINT FK_ChatReads_ChatMessages FOREIGN KEY (MessageId) REFERENCES dbo.ChatMessages (Id) ON DELETE CASCADE,
  CONSTRAINT FK_ChatReads_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
);
CREATE INDEX IX_ChatReads_UserId ON dbo.ChatReads (UserId);
END

IF OBJECT_ID(N'dbo.ChatBlocks', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ChatBlocks (
  UserId BIGINT NOT NULL, BlockedUserId BIGINT NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ChatBlocks_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_ChatBlocks PRIMARY KEY (UserId, BlockedUserId),
  CONSTRAINT FK_ChatBlocks_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_ChatBlocks_Users_Blocked FOREIGN KEY (BlockedUserId) REFERENCES dbo.Users (Id),
  CONSTRAINT CK_ChatBlocks_Self CHECK (UserId <> BlockedUserId)
);
CREATE INDEX IX_ChatBlocks_BlockedUserId ON dbo.ChatBlocks (BlockedUserId);
END

IF OBJECT_ID(N'dbo.ChatReports', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ChatReports (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ChatReports PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ChatReports_PublicId DEFAULT NEWID() CONSTRAINT UX_ChatReports_PublicId UNIQUE,
  MessageId BIGINT NOT NULL, ByUserId BIGINT NOT NULL, Reason NVARCHAR(300) NOT NULL CONSTRAINT DF_ChatReports_Reason DEFAULT N'',
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_ChatReports_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ChatReports_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ChatReports_ChatMessages FOREIGN KEY (MessageId) REFERENCES dbo.ChatMessages (Id) ON DELETE CASCADE,
  CONSTRAINT FK_ChatReports_Users_By FOREIGN KEY (ByUserId) REFERENCES dbo.Users (Id)
);
CREATE INDEX IX_ChatReports_MessageId ON dbo.ChatReports (MessageId);
CREATE INDEX IX_ChatReports_ByUserId ON dbo.ChatReports (ByUserId);
END

IF OBJECT_ID(N'dbo.UserPrefs', N'U') IS NULL
BEGIN
CREATE TABLE dbo.UserPrefs (
  UserId BIGINT NOT NULL CONSTRAINT PK_UserPrefs PRIMARY KEY,
  ReceiptsOn BIT NOT NULL CONSTRAINT DF_UserPrefs_ReceiptsOn DEFAULT 0,
  Json NVARCHAR(MAX) NOT NULL CONSTRAINT DF_UserPrefs_Json DEFAULT N'{}',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserPrefs_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserPrefs_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_UserPrefs_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_UserPrefs_Json CHECK (ISJSON(Json) = 1)
);
END

IF OBJECT_ID(N'dbo.ServiceThreads', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ServiceThreads (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ServiceThreads PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ServiceThreads_PublicId DEFAULT NEWID() CONSTRAINT UX_ServiceThreads_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, Channel NVARCHAR(20) NOT NULL, State NVARCHAR(20) NULL,
  EscalatedPhone NVARCHAR(30) NULL, EscalatedAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ServiceThreads_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ServiceThreads_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ServiceThreads_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT UX_ServiceThreads_BookingId_Channel UNIQUE (BookingId, Channel)
);
END

IF OBJECT_ID(N'dbo.ServiceMessages', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ServiceMessages (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ServiceMessages PRIMARY KEY,
  ThreadId BIGINT NOT NULL, FromRole VARCHAR(4) NOT NULL, CrewName NVARCHAR(60) NULL,
  [Text] NVARCHAR(2000) NOT NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_ServiceMessages_At DEFAULT SYSUTCDATETIME(),   -- may be in the future: the mocked crew reply "arrives" on read
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ServiceMessages_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ServiceMessages_ServiceThreads FOREIGN KEY (ThreadId) REFERENCES dbo.ServiceThreads (Id) ON DELETE CASCADE,
  CONSTRAINT CK_ServiceMessages_FromRole CHECK (FromRole IN ('me','crew'))
);
CREATE INDEX IX_ServiceMessages_ThreadId_At ON dbo.ServiceMessages (ThreadId, [At]);
END

IF OBJECT_ID(N'dbo.FamilyZones', N'U') IS NULL
BEGIN
CREATE TABLE dbo.FamilyZones (
  ChildUserId BIGINT NOT NULL, BookingId BIGINT NOT NULL,
  ZoneIds NVARCHAR(MAX) NOT NULL CONSTRAINT DF_FamilyZones_ZoneIds DEFAULT N'[]',
  Auth NVARCHAR(MAX) NOT NULL CONSTRAINT DF_FamilyZones_Auth DEFAULT N'{}',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_FamilyZones_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_FamilyZones_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_FamilyZones PRIMARY KEY (ChildUserId, BookingId),
  CONSTRAINT FK_FamilyZones_Users_Child FOREIGN KEY (ChildUserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_FamilyZones_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_FamilyZones_ZoneIds CHECK (ISJSON(ZoneIds) = 1),
  CONSTRAINT CK_FamilyZones_Auth CHECK (ISJSON(Auth) = 1),
  CONSTRAINT FK_FamilyZones_BookingGuests FOREIGN KEY (BookingId, ChildUserId) REFERENCES dbo.BookingGuests (BookingId, UserId)
);
CREATE INDEX IX_FamilyZones_BookingId_ChildUserId ON dbo.FamilyZones (BookingId, ChildUserId);
END

IF OBJECT_ID(N'dbo.KidClubCheckins', N'U') IS NULL
BEGIN
CREATE TABLE dbo.KidClubCheckins (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_KidClubCheckins PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_KidClubCheckins_PublicId DEFAULT NEWID() CONSTRAINT UX_KidClubCheckins_PublicId UNIQUE,
  ChildUserId BIGINT NOT NULL, ClubId NVARCHAR(30) NOT NULL,
  InAt DATETIME2(0) NOT NULL CONSTRAINT DF_KidClubCheckins_InAt DEFAULT SYSUTCDATETIME(), OutAt DATETIME2(0) NULL,
  ByUserId BIGINT NOT NULL, OutByUserId BIGINT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_KidClubCheckins_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_KidClubCheckins_Users_Child FOREIGN KEY (ChildUserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_KidClubCheckins_Clubs FOREIGN KEY (ClubId) REFERENCES ref.Clubs (Id),
  CONSTRAINT FK_KidClubCheckins_Users_By FOREIGN KEY (ByUserId) REFERENCES dbo.Users (Id),
  CONSTRAINT FK_KidClubCheckins_Users_OutBy FOREIGN KEY (OutByUserId) REFERENCES dbo.Users (Id),
  CONSTRAINT CK_KidClubCheckins_Out CHECK ((OutAt IS NULL AND OutByUserId IS NULL) OR (OutAt IS NOT NULL AND OutByUserId IS NOT NULL AND OutAt >= InAt))
);
CREATE INDEX IX_KidClubCheckins_ChildUserId_InAt ON dbo.KidClubCheckins (ChildUserId, InAt DESC);
CREATE INDEX IX_KidClubCheckins_ByUserId ON dbo.KidClubCheckins (ByUserId);
CREATE INDEX IX_KidClubCheckins_OutByUserId ON dbo.KidClubCheckins (OutByUserId) WHERE OutByUserId IS NOT NULL;
END

IF OBJECT_ID(N'dbo.KidSightings', N'U') IS NULL
BEGIN
CREATE TABLE dbo.KidSightings (
  ChildUserId BIGINT NOT NULL CONSTRAINT PK_KidSightings PRIMARY KEY,   -- the latest sighting only; it drives kidStatus
  PlaceId NVARCHAR(40) NOT NULL, Source VARCHAR(4) NOT NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_KidSightings_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_KidSightings_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_KidSightings_Users_Child FOREIGN KEY (ChildUserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_KidSightings_Source CHECK (Source IN ('club','band'))
);
END

IF OBJECT_ID(N'dbo.FamilyLog', N'U') IS NULL
BEGIN
CREATE TABLE dbo.FamilyLog (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FamilyLog PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_FamilyLog_PublicId DEFAULT NEWID() CONSTRAINT UX_FamilyLog_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, [At] DATETIME2(0) NOT NULL CONSTRAINT DF_FamilyLog_At DEFAULT SYSUTCDATETIME(), [Text] NVARCHAR(500) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_FamilyLog_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_FamilyLog_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE
);
CREATE INDEX IX_FamilyLog_BookingId_At ON dbo.FamilyLog (BookingId, [At]);
END

IF OBJECT_ID(N'dbo.ReunionPlans', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ReunionPlans (
  BookingId BIGINT NOT NULL CONSTRAINT PK_ReunionPlans PRIMARY KEY,
  PlaceId NVARCHAR(40) NOT NULL, BackupId NVARCHAR(40) NULL, Note NVARCHAR(300) NOT NULL CONSTRAINT DF_ReunionPlans_Note DEFAULT N'',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ReunionPlans_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ReunionPlans_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ReunionPlans_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE
);
END

IF OBJECT_ID(N'dbo.HealthReports', N'U') IS NULL
BEGIN
CREATE TABLE dbo.HealthReports (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HealthReports PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_HealthReports_PublicId DEFAULT NEWID() CONSTRAINT UX_HealthReports_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, ByUserId BIGINT NOT NULL,
  Symptoms NVARCHAR(MAX) NOT NULL CONSTRAINT DF_HealthReports_Symptoms DEFAULT N'[]',
  StartedHoursAgo INT NOT NULL CONSTRAINT DF_HealthReports_StartedHoursAgo DEFAULT 0, [At] DATETIME2(0) NOT NULL CONSTRAINT DF_HealthReports_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HealthReports_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_HealthReports_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_HealthReports_Users_By FOREIGN KEY (ByUserId) REFERENCES dbo.Users (Id),
  CONSTRAINT CK_HealthReports_Symptoms CHECK (ISJSON(Symptoms) = 1),
  CONSTRAINT UX_HealthReports_Id_BookingId UNIQUE (Id, BookingId)
);
CREATE INDEX IX_HealthReports_BookingId ON dbo.HealthReports (BookingId);
CREATE INDEX IX_HealthReports_ByUserId ON dbo.HealthReports (ByUserId);
END

IF OBJECT_ID(N'dbo.HealthReportGuests', N'U') IS NULL
BEGIN
CREATE TABLE dbo.HealthReportGuests (
  ReportId BIGINT NOT NULL, BookingId BIGINT NOT NULL, UserId BIGINT NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HealthReportGuests_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_HealthReportGuests PRIMARY KEY (ReportId, UserId),
  CONSTRAINT FK_HealthReportGuests_HealthReports FOREIGN KEY (ReportId, BookingId) REFERENCES dbo.HealthReports (Id, BookingId) ON DELETE CASCADE,
  CONSTRAINT FK_HealthReportGuests_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_HealthReportGuests_BookingGuests FOREIGN KEY (BookingId, UserId) REFERENCES dbo.BookingGuests (BookingId, UserId)
);
CREATE INDEX IX_HealthReportGuests_UserId_BookingId ON dbo.HealthReportGuests (UserId, BookingId);   -- both foreign keys on the person
END

IF OBJECT_ID(N'dbo.HealthRequests', N'U') IS NULL
BEGIN
CREATE TABLE dbo.HealthRequests (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HealthRequests PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_HealthRequests_PublicId DEFAULT NEWID() CONSTRAINT UX_HealthRequests_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, Kind NVARCHAR(30) NOT NULL, Note NVARCHAR(500) NOT NULL CONSTRAINT DF_HealthRequests_Note DEFAULT N'',
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_HealthRequests_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HealthRequests_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_HealthRequests_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE
);
CREATE INDEX IX_HealthRequests_BookingId ON dbo.HealthRequests (BookingId);
END

IF OBJECT_ID(N'dbo.RoomSettings', N'U') IS NULL
BEGIN
CREATE TABLE dbo.RoomSettings (
  BookingId BIGINT NOT NULL CONSTRAINT PK_RoomSettings PRIMARY KEY,
  Housekeeping NVARCHAR(MAX) NOT NULL CONSTRAINT DF_RoomSettings_Housekeeping DEFAULT N'{}',
  Devices NVARCHAR(MAX) NOT NULL CONSTRAINT DF_RoomSettings_Devices DEFAULT N'{}',
  DndSince DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_RoomSettings_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_RoomSettings_UpdatedAt DEFAULT SYSUTCDATETIME(),
  RowVersion ROWVERSION NOT NULL,
  CONSTRAINT FK_RoomSettings_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_RoomSettings_Housekeeping CHECK (ISJSON(Housekeeping) = 1),
  CONSTRAINT CK_RoomSettings_Devices CHECK (ISJSON(Devices) = 1)
);
END

IF OBJECT_ID(N'dbo.PhotoSelections', N'U') IS NULL
BEGIN
CREATE TABLE dbo.PhotoSelections (
  UserId BIGINT NOT NULL, PhotoId NVARCHAR(40) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PhotoSelections_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_PhotoSelections PRIMARY KEY (UserId, PhotoId),
  CONSTRAINT FK_PhotoSelections_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_PhotoSelections_PhotoCatalogue FOREIGN KEY (PhotoId) REFERENCES ref.PhotoCatalogue (Id)
);
END

IF OBJECT_ID(N'dbo.PhotoPurchases', N'U') IS NULL
BEGIN
CREATE TABLE dbo.PhotoPurchases (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PhotoPurchases PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_PhotoPurchases_PublicId DEFAULT NEWID() CONSTRAINT UX_PhotoPurchases_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, OptionId NVARCHAR(30) NOT NULL,
  PaidCents BIGINT NOT NULL CONSTRAINT DF_PhotoPurchases_PaidCents DEFAULT 0, SavedCents BIGINT NOT NULL CONSTRAINT DF_PhotoPurchases_SavedCents DEFAULT 0, Verified BIT NOT NULL CONSTRAINT DF_PhotoPurchases_Verified DEFAULT 0,
  Until DATETIME2(0) NOT NULL, [At] DATETIME2(0) NOT NULL CONSTRAINT DF_PhotoPurchases_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PhotoPurchases_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_PhotoPurchases_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_PhotoPurchases_PhotoOptions FOREIGN KEY (OptionId) REFERENCES ref.PhotoOptions (Id),
  CONSTRAINT CK_PhotoPurchases_Amounts CHECK (PaidCents >= 0 AND SavedCents >= 0)
);
CREATE INDEX IX_PhotoPurchases_BookingId ON dbo.PhotoPurchases (BookingId);
END

IF OBJECT_ID(N'dbo.PhotoPurchaseItems', N'U') IS NULL
BEGIN
CREATE TABLE dbo.PhotoPurchaseItems (
  PurchaseId BIGINT NOT NULL, PhotoId NVARCHAR(40) NOT NULL, Downloaded BIT NOT NULL CONSTRAINT DF_PhotoPurchaseItems_Downloaded DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PhotoPurchaseItems_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_PhotoPurchaseItems PRIMARY KEY (PurchaseId, PhotoId),
  CONSTRAINT FK_PhotoPurchaseItems_PhotoPurchases FOREIGN KEY (PurchaseId) REFERENCES dbo.PhotoPurchases (Id) ON DELETE CASCADE,
  CONSTRAINT FK_PhotoPurchaseItems_PhotoCatalogue FOREIGN KEY (PhotoId) REFERENCES ref.PhotoCatalogue (Id)
);
END

IF OBJECT_ID(N'dbo.LaundryRequests', N'U') IS NULL
BEGIN
CREATE TABLE dbo.LaundryRequests (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LaundryRequests PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_LaundryRequests_PublicId DEFAULT NEWID() CONSTRAINT UX_LaundryRequests_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, Service NVARCHAR(30) NOT NULL, Qty INT NOT NULL CONSTRAINT DF_LaundryRequests_Qty DEFAULT 1,
  PickupAt DATETIME2(0) NOT NULL, ReturnAt DATETIME2(0) NOT NULL,
  Stage NVARCHAR(20) NOT NULL CONSTRAINT DF_LaundryRequests_Stage DEFAULT N'received',   -- derived on read from the timestamps
  TotalCents BIGINT NOT NULL CONSTRAINT DF_LaundryRequests_TotalCents DEFAULT 0, FreeCents BIGINT NOT NULL CONSTRAINT DF_LaundryRequests_FreeCents DEFAULT 0, Note NVARCHAR(300) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_LaundryRequests_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_LaundryRequests_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_LaundryRequests_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_LaundryRequests_Qty CHECK (Qty > 0 AND TotalCents >= 0 AND FreeCents >= 0),
  CONSTRAINT CK_LaundryRequests_Window CHECK (PickupAt < ReturnAt)
);
CREATE INDEX IX_LaundryRequests_BookingId ON dbo.LaundryRequests (BookingId);
END

IF OBJECT_ID(N'dbo.WifiDevices', N'U') IS NULL
BEGIN
CREATE TABLE dbo.WifiDevices (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_WifiDevices PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_WifiDevices_PublicId DEFAULT NEWID() CONSTRAINT UX_WifiDevices_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, Name NVARCHAR(60) NOT NULL, PlanCode NVARCHAR(30) NOT NULL,
  Days INT NOT NULL CONSTRAINT DF_WifiDevices_Days DEFAULT 1, ExpiresAt DATETIME2(0) NOT NULL, UsedMb BIGINT NOT NULL CONSTRAINT DF_WifiDevices_UsedMb DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_WifiDevices_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_WifiDevices_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_WifiDevices_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE
);
CREATE INDEX IX_WifiDevices_BookingId ON dbo.WifiDevices (BookingId);
END

IF OBJECT_ID(N'dbo.Budgets', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Budgets (
  BookingId BIGINT NOT NULL CONSTRAINT PK_Budgets PRIMARY KEY,
  Json NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Budgets_Json DEFAULT N'{}',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Budgets_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Budgets_UpdatedAt DEFAULT SYSUTCDATETIME(),
  RowVersion ROWVERSION NOT NULL,
  CONSTRAINT FK_Budgets_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_Budgets_Json CHECK (ISJSON(Json) = 1)
);
END

IF OBJECT_ID(N'dbo.BookingState', N'U') IS NULL
BEGIN
CREATE TABLE dbo.BookingState (
  BookingId BIGINT NOT NULL, StateKey VARCHAR(30) NOT NULL,
  Json NVARCHAR(MAX) NOT NULL, Version INT NOT NULL CONSTRAINT DF_BookingState_Version DEFAULT 1,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BookingState_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BookingState_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_BookingState PRIMARY KEY (BookingId, StateKey),
  CONSTRAINT FK_BookingState_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_BookingState_Json CHECK (ISJSON(Json) = 1)
);
END

IF OBJECT_ID(N'dbo.PortRows', N'U') IS NULL
BEGIN
CREATE TABLE dbo.PortRows (
  BookingId BIGINT NOT NULL, Kind VARCHAR(12) NOT NULL, RowKey VARCHAR(90) NOT NULL,
  Json NVARCHAR(2000) NULL, [At] BIGINT NOT NULL, Deleted BIT NOT NULL CONSTRAINT DF_PortRows_Deleted DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PortRows_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PortRows_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_PortRows PRIMARY KEY (BookingId, Kind, RowKey),
  CONSTRAINT FK_PortRows_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_PortRows_Json CHECK (Json IS NULL OR ISJSON(Json) = 1),
  CONSTRAINT CK_PortRows_Kind CHECK (Kind IN ('presence','plan','planB','setting','meet','meetState','party','item','poll','vote','idea','heart'))
);
END

IF OBJECT_ID(N'dbo.ShareLinks', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ShareLinks (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ShareLinks PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT UX_ShareLinks_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, UserId BIGINT NOT NULL,
  Kind VARCHAR(9) NOT NULL, Label NVARCHAR(40) NOT NULL,
  TokenHash CHAR(64) NOT NULL CONSTRAINT UX_ShareLinks_TokenHash UNIQUE,
  ExpiresAt DATETIME2(0) NOT NULL, LastCheckInAt DATETIME2(0) NULL, Note NVARCHAR(200) NOT NULL CONSTRAINT DF_ShareLinks_Note DEFAULT N'',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ShareLinks_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ShareLinks_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_ShareLinks_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id),
  CONSTRAINT CK_ShareLinks_Kind CHECK (Kind IN ('caregiver','advisor'))
);
CREATE INDEX IX_ShareLinks_BookingId_UserId ON dbo.ShareLinks (BookingId, UserId);
END

IF OBJECT_ID(N'dbo.UpdateAcks', N'U') IS NULL
BEGIN
CREATE TABLE dbo.UpdateAcks (
  UserId BIGINT NOT NULL, ScenarioId NVARCHAR(30) NOT NULL, OptionCode NVARCHAR(30) NOT NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_UpdateAcks_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UpdateAcks_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_UpdateAcks PRIMARY KEY (UserId, ScenarioId),
  CONSTRAINT FK_UpdateAcks_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
);
END

IF OBJECT_ID(N'dbo.ServiceRequests', N'U') IS NULL
BEGIN
CREATE TABLE dbo.ServiceRequests (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ServiceRequests PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ServiceRequests_PublicId DEFAULT NEWID() CONSTRAINT UX_ServiceRequests_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, ItemId NVARCHAR(40) NOT NULL, Qty INT NOT NULL CONSTRAINT DF_ServiceRequests_Qty DEFAULT 1, Note NVARCHAR(300) NULL,
  PlacedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ServiceRequests_PlacedAt DEFAULT SYSUTCDATETIME(), EtaAt DATETIME2(0) NULL,
  Stage VARCHAR(9) NOT NULL CONSTRAINT DF_ServiceRequests_Stage DEFAULT 'received',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ServiceRequests_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ServiceRequests_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ServiceRequests_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_ServiceRequests_ServiceItems FOREIGN KEY (ItemId) REFERENCES ref.ServiceItems (Id),
  CONSTRAINT CK_ServiceRequests_Stage CHECK (Stage IN ('received','onTheWay','done','cancelled')),
  CONSTRAINT CK_ServiceRequests_Qty CHECK (Qty > 0)
);
CREATE INDEX IX_ServiceRequests_BookingId ON dbo.ServiceRequests (BookingId);
END

IF OBJECT_ID(N'dbo.SafetyReports', N'U') IS NULL
BEGIN
CREATE TABLE dbo.SafetyReports (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SafetyReports PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_SafetyReports_PublicId DEFAULT NEWID() CONSTRAINT UX_SafetyReports_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, Kind NVARCHAR(30) NOT NULL, Place NVARCHAR(80) NULL, Note NVARCHAR(1000) NOT NULL CONSTRAINT DF_SafetyReports_Note DEFAULT N'',
  Anonymous BIT NOT NULL CONSTRAINT DF_SafetyReports_Anonymous DEFAULT 0, Reference NVARCHAR(16) NOT NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_SafetyReports_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SafetyReports_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_SafetyReports_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE
);
CREATE INDEX IX_SafetyReports_BookingId ON dbo.SafetyReports (BookingId);
END

IF OBJECT_ID(N'dbo.DrinkLogs', N'U') IS NULL
BEGIN
CREATE TABLE dbo.DrinkLogs (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DrinkLogs PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_DrinkLogs_PublicId DEFAULT NEWID() CONSTRAINT UX_DrinkLogs_PublicId UNIQUE,
  UserId BIGINT NOT NULL, DrinkId NVARCHAR(40) NOT NULL, [At] DATETIME2(0) NOT NULL CONSTRAINT DF_DrinkLogs_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DrinkLogs_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_DrinkLogs_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_DrinkLogs_Drinks FOREIGN KEY (DrinkId) REFERENCES ref.Drinks (Id)
);
CREATE INDEX IX_DrinkLogs_UserId_At ON dbo.DrinkLogs (UserId, [At]);   -- drink cap per day
END

IF OBJECT_ID(N'dbo.TopUps', N'U') IS NULL
BEGIN
CREATE TABLE dbo.TopUps (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TopUps PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TopUps_PublicId DEFAULT NEWID() CONSTRAINT UX_TopUps_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, Dollars INT NOT NULL, Source VARCHAR(4) NOT NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_TopUps_At DEFAULT SYSUTCDATETIME(), SettledAt DATETIME2(0) NULL, Reference NVARCHAR(16) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_TopUps_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_TopUps_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_TopUps_Source CHECK (Source IN ('card','cash')),
  CONSTRAINT CK_TopUps_Dollars CHECK (Dollars > 0)
);
CREATE INDEX IX_TopUps_BookingId ON dbo.TopUps (BookingId);
END

IF OBJECT_ID(N'dbo.OnboardAccount', N'U') IS NULL
BEGIN
CREATE TABLE dbo.OnboardAccount (
  BookingId BIGINT NOT NULL CONSTRAINT PK_OnboardAccount PRIMARY KEY,
  PinHash BINARY(32) NULL, PinSalt BINARY(16) NULL, PinFails INT NOT NULL CONSTRAINT DF_OnboardAccount_PinFails DEFAULT 0,
  GratuityChoice VARCHAR(8) NOT NULL CONSTRAINT DF_OnboardAccount_GratuityChoice DEFAULT 'standard', GratuityReason NVARCHAR(300) NULL, GratuityPaidAt DATETIME2(0) NULL,
  DisplayCurrency CHAR(3) NOT NULL CONSTRAINT DF_OnboardAccount_DisplayCurrency DEFAULT 'USD',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OnboardAccount_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OnboardAccount_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_OnboardAccount_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_OnboardAccount_GratuityChoice CHECK (GratuityChoice IN ('standard','prepaid','removal')),
  CONSTRAINT CK_OnboardAccount_DisplayCurrency CHECK (DisplayCurrency LIKE '[A-Z][A-Z][A-Z]')
);
END

IF OBJECT_ID(N'dbo.Parties', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Parties (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Parties PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Parties_PublicId DEFAULT NEWID() CONSTRAINT UX_Parties_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, Title NVARCHAR(120) NOT NULL, [Day] INT NOT NULL, TimeLocal TIME(0) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Parties_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Parties_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Parties_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE
);
CREATE INDEX IX_Parties_BookingId ON dbo.Parties (BookingId);
END

IF OBJECT_ID(N'dbo.PartyInvites', N'U') IS NULL
BEGIN
CREATE TABLE dbo.PartyInvites (
  PartyId BIGINT NOT NULL, Cabin NVARCHAR(8) NOT NULL, Answer VARCHAR(5) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PartyInvites_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_PartyInvites PRIMARY KEY (PartyId, Cabin),
  CONSTRAINT FK_PartyInvites_Parties FOREIGN KEY (PartyId) REFERENCES dbo.Parties (Id) ON DELETE CASCADE,
  CONSTRAINT CK_PartyInvites_Answer CHECK (Answer IN ('yes','maybe','no'))
);
END

IF OBJECT_ID(N'dbo.GameProgress', N'U') IS NULL
BEGIN
CREATE TABLE dbo.GameProgress (
  UserId BIGINT NOT NULL CONSTRAINT PK_GameProgress PRIMARY KEY,
  State NVARCHAR(MAX) NOT NULL CONSTRAINT DF_GameProgress_State DEFAULT N'{}',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_GameProgress_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_GameProgress_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_GameProgress_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_GameProgress_State CHECK (ISJSON(State) = 1)
);
END

IF OBJECT_ID(N'dbo.TvState', N'U') IS NULL
BEGIN
CREATE TABLE dbo.TvState (
  BookingId BIGINT NOT NULL CONSTRAINT PK_TvState PRIMARY KEY,
  State NVARCHAR(MAX) NOT NULL CONSTRAINT DF_TvState_State DEFAULT N'{}',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_TvState_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_TvState_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_TvState_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_TvState_State CHECK (ISJSON(State) = 1)
);
END

IF OBJECT_ID(N'dbo.Selections', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Selections (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Selections PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Selections_PublicId DEFAULT NEWID() CONSTRAINT UX_Selections_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, ItemId NVARCHAR(40) NOT NULL, [Day] INT NOT NULL, [Time] TIME(0) NULL,
  Qty INT NOT NULL CONSTRAINT DF_Selections_Qty DEFAULT 1, TotalCents BIGINT NOT NULL CONSTRAINT DF_Selections_TotalCents DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Selections_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Selections_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Selections_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_Selections_Amounts CHECK (Qty > 0 AND TotalCents >= 0)
);
CREATE INDEX IX_Selections_BookingId ON dbo.Selections (BookingId);
END

IF OBJECT_ID(N'dbo.FolioLines', N'U') IS NULL
BEGIN
CREATE TABLE dbo.FolioLines (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FolioLines PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_FolioLines_PublicId DEFAULT NEWID() CONSTRAINT UX_FolioLines_PublicId UNIQUE,
  BookingId BIGINT NOT NULL, UserId BIGINT NULL, [Day] INT NOT NULL,
  Category NVARCHAR(30) NOT NULL, Description NVARCHAR(200) NOT NULL,
  Cents BIGINT NOT NULL,                        -- negative = credit
  CoveredBy VARCHAR(7) NULL, SourceType NVARCHAR(20) NOT NULL, SourceId BIGINT NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_FolioLines_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_FolioLines_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_FolioLines_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_FolioLines_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id),
  CONSTRAINT CK_FolioLines_CoveredBy CHECK (CoveredBy IS NULL OR CoveredBy IN ('package','fare','credit'))
);
CREATE INDEX IX_FolioLines_BookingId_Day ON dbo.FolioLines (BookingId, [Day]);
CREATE INDEX IX_FolioLines_UserId ON dbo.FolioLines (UserId) WHERE UserId IS NOT NULL;
END

IF OBJECT_ID(N'dbo.Feedback', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Feedback (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Feedback PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Feedback_PublicId DEFAULT NEWID() CONSTRAINT UX_Feedback_PublicId UNIQUE,
  UserId BIGINT NOT NULL, Kind VARCHAR(6) NOT NULL, [Text] NVARCHAR(1000) NOT NULL,
  [Log] NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Feedback_Log DEFAULT N'[]',
  Screenshot NVARCHAR(MAX) NULL, Reference NVARCHAR(16) NOT NULL,
  [At] DATETIME2(0) NOT NULL CONSTRAINT DF_Feedback_At DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Feedback_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Feedback_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT CK_Feedback_Kind CHECK (Kind IN ('bug','idea','praise')),
  CONSTRAINT CK_Feedback_Log CHECK (ISJSON([Log]) = 1)
);
CREATE INDEX IX_Feedback_UserId ON dbo.Feedback (UserId);
END
GO

/* =====================================================================================================
   4.9 After the cruise (dbo)
   ===================================================================================================== */

IF OBJECT_ID(N'dbo.DisembarkChoices', N'U') IS NULL
BEGIN
CREATE TABLE dbo.DisembarkChoices (
  BookingId BIGINT NOT NULL CONSTRAINT PK_DisembarkChoices PRIMARY KEY,
  OptionCode VARCHAR(12) NOT NULL, TagsOn BIT NOT NULL CONSTRAINT DF_DisembarkChoices_TagsOn DEFAULT 0,
  DecidedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DisembarkChoices_DecidedAt DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DisembarkChoices_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DisembarkChoices_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_DisembarkChoices_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_DisembarkChoices_OptionCode CHECK (OptionCode IN ('tagged','selfAssist','earlyWalkOff'))
);
END

IF OBJECT_ID(N'dbo.DisembarkBags', N'U') IS NULL
BEGIN
CREATE TABLE dbo.DisembarkBags (
  BookingId BIGINT NOT NULL, UserId BIGINT NOT NULL, Bags INT NOT NULL CONSTRAINT DF_DisembarkBags_Bags DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DisembarkBags_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DisembarkBags_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_DisembarkBags PRIMARY KEY (BookingId, UserId),
  CONSTRAINT FK_DisembarkBags_BookingGuests FOREIGN KEY (BookingId, UserId) REFERENCES dbo.BookingGuests (BookingId, UserId) ON DELETE CASCADE,
  CONSTRAINT CK_DisembarkBags_Bags CHECK (Bags >= 0)
);
END

IF OBJECT_ID(N'dbo.Celebrations', N'U') IS NULL
BEGIN
-- Birthdays and anniversaries the guests told the ship about for a booking. Only the month and day are kept, never a year or a birth date.
CREATE TABLE dbo.Celebrations (
  BookingId BIGINT NOT NULL, ClientId NVARCHAR(40) NOT NULL,
  Label NVARCHAR(40) NOT NULL, [Month] TINYINT NOT NULL, [Day] TINYINT NOT NULL, Surprise BIT NOT NULL CONSTRAINT DF_Celebrations_Surprise DEFAULT 0,
  ToldAt DATETIME2(0) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Celebrations_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Celebrations_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Celebrations PRIMARY KEY (BookingId, ClientId),
  CONSTRAINT FK_Celebrations_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_Celebrations_Month CHECK ([Month] BETWEEN 1 AND 12),
  CONSTRAINT CK_Celebrations_Day CHECK ([Day] BETWEEN 1 AND 31)
);
END

IF OBJECT_ID(N'dbo.Thanks', N'U') IS NULL
BEGIN
-- A thank-you a guest left for a team on a booking (small delights D6-7). No rating and no tip; Team is the venue or crew team named.
CREATE TABLE dbo.Thanks (
  Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Thanks_Id DEFAULT NEWID(),
  BookingId BIGINT NOT NULL, UserId BIGINT NOT NULL,
  Team NVARCHAR(40) NOT NULL, Body NVARCHAR(300) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Thanks_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Thanks PRIMARY KEY (Id),
  CONSTRAINT FK_Thanks_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_Thanks_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id)
);
CREATE INDEX IX_Thanks_Booking ON dbo.Thanks (BookingId, CreatedAt);
END

IF OBJECT_ID(N'dbo.CelebrationWishes', N'U') IS NULL
BEGIN
-- A message added to a celebration by someone on the booking (small delights D6-8). Author is the first name of whoever wrote it.
CREATE TABLE dbo.CelebrationWishes (
  Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_CelebrationWishes_Id DEFAULT NEWID(),
  BookingId BIGINT NOT NULL, CelebrationClientId NVARCHAR(40) NOT NULL, UserId BIGINT NOT NULL,
  Author NVARCHAR(60) NOT NULL, Body NVARCHAR(240) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CelebrationWishes_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_CelebrationWishes PRIMARY KEY (Id),
  CONSTRAINT FK_CelebrationWishes_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_CelebrationWishes_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id)
);
CREATE INDEX IX_CelebrationWishes_Booking ON dbo.CelebrationWishes (BookingId, CelebrationClientId, CreatedAt);
END

IF OBJECT_ID(N'dbo.Customs', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Customs (
  BookingId BIGINT NOT NULL CONSTRAINT PK_Customs PRIMARY KEY,
  Declaration NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Customs_Declaration DEFAULT N'{}',
  SubmittedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Customs_SubmittedAt DEFAULT SYSUTCDATETIME(),
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Customs_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Customs_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Customs_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_Customs_Declaration CHECK (ISJSON(Declaration) = 1)
);
END

IF OBJECT_ID(N'dbo.OnwardPlans', N'U') IS NULL
BEGIN
CREATE TABLE dbo.OnwardPlans (
  BookingId BIGINT NOT NULL CONSTRAINT PK_OnwardPlans PRIMARY KEY,
  Mode NVARCHAR(20) NOT NULL, FlightAtLocal TIME(0) NULL, Flight NVARCHAR(12) NULL, Note NVARCHAR(300) NOT NULL CONSTRAINT DF_OnwardPlans_Note DEFAULT N'',
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OnwardPlans_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OnwardPlans_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_OnwardPlans_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE
);
END

IF OBJECT_ID(N'dbo.FinalBill', N'U') IS NULL
BEGIN
CREATE TABLE dbo.FinalBill (
  BookingId BIGINT NOT NULL CONSTRAINT PK_FinalBill PRIMARY KEY,
  TipKeepPercent INT NOT NULL CONSTRAINT DF_FinalBill_TipKeepPercent DEFAULT 100, EmailedAt DATETIME2(0) NULL, EmailedTo NVARCHAR(254) NULL, SettledAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_FinalBill_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_FinalBill_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_FinalBill_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_FinalBill_TipKeepPercent CHECK (TipKeepPercent BETWEEN 0 AND 100)
);
END

IF OBJECT_ID(N'dbo.Cases', N'U') IS NULL
BEGIN
CREATE TABLE dbo.Cases (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Cases PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Cases_PublicId DEFAULT NEWID() CONSTRAINT UX_Cases_PublicId UNIQUE,
  UserId BIGINT NOT NULL, BookingId BIGINT NOT NULL,
  Kind VARCHAR(9) NOT NULL,
  Number NVARCHAR(12) NOT NULL,
  Summary NVARCHAR(500) NOT NULL, Place NVARCHAR(80) NULL, Cents BIGINT NULL,
  LineId NVARCHAR(40) NULL,                     -- the disputed folio line, for Kind = 'billing'
  Stage VARCHAR(9) NOT NULL CONSTRAINT DF_Cases_Stage DEFAULT 'received', Outcome NVARCHAR(20) NULL,
  OpenedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Cases_OpenedAt DEFAULT SYSUTCDATETIME(), DueAt DATETIME2(0) NULL, WithdrawnAt DATETIME2(0) NULL,
  RefundCents BIGINT NULL, RefundSentAt DATETIME2(0) NULL, FromFeedback BIT NOT NULL CONSTRAINT DF_Cases_FromFeedback DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Cases_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Cases_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UX_Cases_Number UNIQUE (Number),
  CONSTRAINT FK_Cases_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_Cases_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_Cases_Kind CHECK (Kind IN ('lostItem','billing','claim','complaint','recovery')),
  CONSTRAINT CK_Cases_Stage CHECK (Stage IN ('received','inReview','resolved','withdrawn'))
);
CREATE INDEX IX_Cases_BookingId ON dbo.Cases (BookingId);
CREATE INDEX IX_Cases_UserId ON dbo.Cases (UserId);
END

IF OBJECT_ID(N'dbo.PostFeedback', N'U') IS NULL
BEGIN
CREATE TABLE dbo.PostFeedback (
  BookingId BIGINT NOT NULL CONSTRAINT PK_PostFeedback PRIMARY KEY,
  Json NVARCHAR(MAX) NOT NULL CONSTRAINT DF_PostFeedback_Json DEFAULT N'{}',
  SubmittedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PostFeedback_SubmittedAt DEFAULT SYSUTCDATETIME(), EditUntil DATETIME2(0) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PostFeedback_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PostFeedback_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_PostFeedback_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT CK_PostFeedback_Json CHECK (ISJSON(Json) = 1)
);
END

IF OBJECT_ID(N'dbo.RebookHolds', N'U') IS NULL
BEGIN
CREATE TABLE dbo.RebookHolds (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RebookHolds PRIMARY KEY,
  PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_RebookHolds_PublicId DEFAULT NEWID() CONSTRAINT UX_RebookHolds_PublicId UNIQUE,
  UserId BIGINT NOT NULL, BookingId BIGINT NOT NULL, SailingId NVARCHAR(40) NOT NULL, CategoryId NVARCHAR(30) NOT NULL,
  Guests INT NOT NULL CONSTRAINT DF_RebookHolds_Guests DEFAULT 1,
  TotalCents BIGINT NOT NULL, DepositCents BIGINT NOT NULL, CreditCents BIGINT NOT NULL CONSTRAINT DF_RebookHolds_CreditCents DEFAULT 0, FccAppliedCents BIGINT NOT NULL CONSTRAINT DF_RebookHolds_FccAppliedCents DEFAULT 0,
  Onboard BIT NOT NULL CONSTRAINT DF_RebookHolds_Onboard DEFAULT 0, PlacedAt DATETIME2(0) NOT NULL CONSTRAINT DF_RebookHolds_PlacedAt DEFAULT SYSUTCDATETIME(), ExpiresAt DATETIME2(0) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_RebookHolds_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_RebookHolds_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_RebookHolds_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  CONSTRAINT FK_RebookHolds_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_RebookHolds_Sailings FOREIGN KEY (SailingId) REFERENCES ref.Sailings (Id),
  CONSTRAINT FK_RebookHolds_CabinCategories FOREIGN KEY (CategoryId) REFERENCES ref.CabinCategories (Id),
  CONSTRAINT CK_RebookHolds_Amounts CHECK (Guests >= 1 AND TotalCents >= 0 AND DepositCents >= 0 AND CreditCents >= 0 AND FccAppliedCents >= 0)
);
CREATE INDEX IX_RebookHolds_UserId ON dbo.RebookHolds (UserId);
CREATE INDEX IX_RebookHolds_BookingId ON dbo.RebookHolds (BookingId);
END

IF OBJECT_ID(N'dbo.DeskAppointments', N'U') IS NULL
BEGIN
CREATE TABLE dbo.DeskAppointments (
  BookingId BIGINT NOT NULL CONSTRAINT PK_DeskAppointments PRIMARY KEY,
  [At] DATETIME2(0) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DeskAppointments_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DeskAppointments_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_DeskAppointments_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (Id) ON DELETE CASCADE,
  CONSTRAINT FK_DeskAppointments_DeskSlots FOREIGN KEY ([At]) REFERENCES ref.DeskSlots ([At])
);
CREATE INDEX IX_DeskAppointments_At ON dbo.DeskAppointments ([At]);   -- slot capacity count
END
GO
