/*
  Runs every reference seed in order. Use sqlcmd (the :r command is a sqlcmd feature); from the repository root:
      sqlcmd -S <server> -d <database> -b -i db/seed/reference/run-all.sql
  In SSMS, turn on SQLCMD Mode (Query menu) first, or run the nine numbered files one at a time.
*/
:on error exit
:r db/seed/reference/01-ship.sql
:r db/seed/reference/02-itinerary.sql
:r db/seed/reference/03-dining.sql
:r db/seed/reference/04-excursions.sql
:r db/seed/reference/05-programme.sql
:r db/seed/reference/06-pricing.sql
:r db/seed/reference/07-photos-people.sql
:r db/seed/reference/08-content.sql
:r db/seed/reference/09-lists.sql
