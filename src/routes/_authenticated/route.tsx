import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Centralized auth gate for all protected routes.
// Lives client-side because Supabase persists the session in localStorage,
// which the server cannot read. Each child route inherits this gate and does
// not need its own redirect-to-login useEffect.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/auth/login",
        search: { invite: undefined, redirect: location.href } as never,
      });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
