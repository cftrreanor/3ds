-- The pilot ends January 1, 2027 for everyone. Pilot accounts still on the
-- old default end (June 30, 2027, the end of the school year) move to the new
-- date; a date set by hand for one account is left as it is. Trials aren't
-- part of the pilot and keep their own dates.
update public.organizations
   set free_until = date '2027-01-01'
 where subscription_status = 'comped'
   and free_until = date '2027-06-30';
