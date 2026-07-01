REVOKE EXECUTE ON FUNCTION public.get_solo_admin_families(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_solo_admin_families(uuid) TO service_role;