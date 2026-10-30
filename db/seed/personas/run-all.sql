/*
  Runs every persona seed in order, starting with the reset. Use sqlcmd from the repository root:
      sqlcmd -S <server> -d <database> -b -i db/seed/personas/run-all.sql
*/
:on error exit
:r db/seed/personas/00-reset-personas.sql
:r db/seed/personas/01-users.sql
:r db/seed/personas/02-bookings.sql
:r db/seed/personas/03-journey.sql
