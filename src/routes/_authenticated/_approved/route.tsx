import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bacbo/BottomNav";
import { RobotProvider } from "@/lib/robot-context";
import { avatarUrlQuery } from "@/lib/avatar";

export const Route = createFileRoute("/_authenticated/_approved")({
  beforeLoad: async ({ context }) => {
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", context.user.id).maybeSingle();
    if (!profile || profile.status !== "approved") {
      // /auth signs the session out when it receives a status notice.
      throw redirect({ to: "/auth", search: { status: profile && profile.status !== "approved" ? profile.status : "pending" } });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    // Warm the profile photo so it appears instantly on the Perfil page.
    if (profile.avatar_url) await context.queryClient.ensureQueryData(avatarUrlQuery(profile.avatar_url)).catch(() => null);
    return { profile, isAdmin: !!isAdmin };
  },
  component: ApprovedLayout,
});

function ApprovedLayout() {
  const { profile, isAdmin, user } = Route.useRouteContext();
  const { pathname } = useLocation();
  const sessionStart = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
  return (
    <RobotProvider userId={profile.id} sessionStart={sessionStart} isAdmin={isAdmin}>
      <div className="relative z-10 mx-auto min-h-screen max-w-md px-3.5 pb-28 pt-3 sm:px-4 sm:pt-4 md:max-w-2xl md:pb-32 lg:max-w-5xl lg:px-6">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.div>
      </div>
      <BottomNav />
    </RobotProvider>
  );
}
