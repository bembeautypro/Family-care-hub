
-- Fix mutable search_path
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Revoke execute from public/anon/authenticated on internal trigger functions
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.handle_new_user() from public;

-- Helper RLS functions: intentionally executable by authenticated (used inside policies).
-- Revoke from anon (no anonymous access needed).
revoke execute on function public.is_family_member(uuid) from public;
revoke execute on function public.has_family_role(uuid, text[]) from public;
revoke execute on function public.get_solo_admin_families(uuid) from public;

grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.has_family_role(uuid, text[]) to authenticated;
grant execute on function public.get_solo_admin_families(uuid) to authenticated;
