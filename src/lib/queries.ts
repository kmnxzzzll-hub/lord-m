import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type RobotSettings = Database["public"]["Tables"]["robot_settings"]["Row"];

export const settingsQuery = queryOptions({
  queryKey: ["robot_settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("robot_settings").select("*").eq("id", 1).single();
    if (error) throw error;
    return data;
  },
  // Users pick up the admin switching the robot on/off within a few seconds.
  refetchInterval: 4_000,
});

export const allProfilesQuery = queryOptions({
  queryKey: ["admin", "profiles"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});
