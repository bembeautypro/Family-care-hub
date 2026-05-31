
-- handle_new_user is only ever invoked by the auth.users trigger; nobody should call it.
revoke execute on function public.handle_new_user() from anon, authenticated;

-- Helpers used by RLS: anon never needs them. authenticated MUST keep execute (used inside policies).
revoke execute on function public.is_family_member(uuid) from anon;
revoke execute on function public.has_family_role(uuid, text[]) from anon;
revoke execute on function public.get_solo_admin_families(uuid) from anon;
