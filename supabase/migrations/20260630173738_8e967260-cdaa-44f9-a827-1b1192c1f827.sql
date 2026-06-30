CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.purge_old_access_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.access_logs
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_access_logs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_old_access_logs() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_access_logs() TO service_role;