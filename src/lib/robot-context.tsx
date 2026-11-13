import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery, type RobotSettings } from "@/lib/queries";
import { mergeSignals, robotView, signalsBetween, type RobotView, type ScheduleConfig, type SessionSignal } from "@/lib/robot-schedule";
import { loadHistory, saveHistory } from "@/lib/session-history";

interface RobotState extends RobotView {
  running: boolean;
  maintenance: boolean;
  analysisMs: number;
  isAdmin: boolean;
  /** Signals generated during this login session, newest first. */
  sessionSignals: SessionSignal[];
  toggling: boolean;
  /** Admin only: switches the robot on/off for everyone. */
  toggle: () => void;
}

const RobotCtx = createContext<RobotState | null>(null);

export function RobotProvider({
  userId,
  sessionStart,
  isAdmin,
  children,
}: {
  userId: string;
  sessionStart: number;
  isAdmin: boolean;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery(settingsQuery);
  const [now, setNow] = useState(() => Date.now());
  const [sessionSignals, setSessionSignals] = useState<SessionSignal[]>([]);

  useEffect(() => {
    setSessionSignals(loadHistory(userId, sessionStart));
  }, [userId, sessionStart]);

  const running = !!settings?.running && !!settings.started_at;
  const maintenance = settings?.maintenance ?? false;
  const analysisMs = (settings?.analysis_seconds ?? 15) * 1000;
  const startedAt = settings?.started_at ? Date.parse(settings.started_at) : 0;
  const minConfidence = settings?.min_confidence ?? 70;

  const cfg = useMemo<ScheduleConfig | null>(
    () => (running && !maintenance ? { startedAt, analysisMs, minConfidence } : null),
    [running, maintenance, startedAt, analysisMs, minConfidence],
  );

  useEffect(() => setNow(Date.now()), [cfg]);
  const view = useMemo(() => robotView(cfg, now), [cfg, now]);

  // Re-render exactly when the phase changes.
  useEffect(() => {
    if (!Number.isFinite(view.phaseEnd)) return;
    const t = setTimeout(() => setNow(Date.now()), Math.max(50, view.phaseEnd - Date.now() + 30));
    return () => clearTimeout(t);
  }, [view.phaseEnd]);

  // Record every signal revealed since this login.
  useEffect(() => {
    if (!cfg) return;
    const found = signalsBetween(cfg, Math.max(sessionStart, cfg.startedAt), now);
    if (!found.length) return;
    setSessionSignals((prev) => {
      const next = mergeSignals(prev, found);
      if (next.length === prev.length && next[0]?.key === prev[0]?.key) return prev;
      saveHistory(userId, sessionStart, next);
      return next;
    });
  }, [cfg, now, sessionStart, userId]);

  const mutation = useMutation({
    mutationFn: async (on: boolean) => {
      const patch = {
        running: on,
        started_at: on ? new Date().toISOString() : null,
        ...(on ? { maintenance: false } : {}),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("robot_settings").update(patch).eq("id", 1).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: RobotSettings) => {
      queryClient.setQueryData(settingsQuery.queryKey, data);
      toast.success(data.running ? "Robô ligado para todos os usuários" : "Robô desligado");
    },
    onError: () => toast.error("Não foi possível alterar o robô."),
  });

  const toggle = useCallback(() => {
    if (!isAdmin || mutation.isPending) return;
    mutation.mutate(!running);
  }, [isAdmin, mutation, running]);

  const value = useMemo<RobotState>(
    () => ({ ...view, running, maintenance, analysisMs, isAdmin, sessionSignals, toggling: mutation.isPending, toggle }),
    [view, running, maintenance, analysisMs, isAdmin, sessionSignals, mutation.isPending, toggle],
  );

  return <RobotCtx.Provider value={value}>{children}</RobotCtx.Provider>;
}

export function useRobot() {
  const ctx = useContext(RobotCtx);
  if (!ctx) throw new Error("useRobot must be used inside RobotProvider");
  return ctx;
}
