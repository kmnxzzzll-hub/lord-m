import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Ban, Check, Power, RotateCcw, ShieldCheck, Users, Wrench, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/bacbo/Avatar";
import { allProfilesQuery, settingsQuery, type Profile } from "@/lib/queries";
import { useRobot } from "@/lib/robot-context";
import { cn } from "@/lib/utils";

type Status = Database["public"]["Enums"]["account_status"];

export const Route = createFileRoute("/_authenticated/_approved/admin")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/robos" });
  },
  head: () => ({
    meta: [
      { title: "Painel Admin — Bac Bo Live" },
      { name: "description", content: "Gerencie cadastros, acessos e calibragem do robô Bac Bo Live." },
      { property: "og:title", content: "Painel Admin — Bac Bo Live" },
      { property: "og:description", content: "Área administrativa do robô Bac Bo Live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Tab = "pending" | "users" | "robot";

function AdminPage() {
  const { profile: me } = Route.useRouteContext();
  const [tab, setTab] = useState<Tab>("pending");
  const { data: profiles = [], isLoading } = useQuery(allProfilesQuery);
  const queryClient = useQueryClient();

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: allProfilesQuery.queryKey });
      const prev = queryClient.getQueryData(allProfilesQuery.queryKey);
      queryClient.setQueryData(allProfilesQuery.queryKey, (old: Profile[] = []) => old.map((p) => (p.id === id ? { ...p, status } : p)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(allProfilesQuery.queryKey, ctx.prev);
      toast.error("Não foi possível atualizar o acesso.");
    },
    onSuccess: (_d, { status }) => {
      const msg: Record<Status, string> = {
        approved: "Acesso liberado",
        rejected: "Cadastro recusado",
        blocked: "Acesso bloqueado",
        pending: "Movido para pendentes",
      };
      toast.success(msg[status]);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: allProfilesQuery.queryKey }),
  });

  const pending = profiles.filter((p) => p.status === "pending");
  const others = profiles.filter((p) => p.status !== "pending");

  return (
    <div className="space-y-4 pt-2">
      <header className="flex items-center gap-3">
        <Link to="/perfil" className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Painel do Administrador</h1>
          <p className="text-xs text-muted-foreground">Acessos e calibragem do robô</p>
        </div>
      </header>

      <div className="glass grid grid-cols-3 gap-1 rounded-2xl p-1">
        {(
          [
            ["pending", `Pendentes${pending.length ? ` (${pending.length})` : ""}`],
            ["users", "Usuários"],
            ["robot", "Robô"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className="relative rounded-xl py-2.5 text-sm font-semibold">
            {tab === k && <motion.span layoutId="admin-tab" className="absolute inset-0 rounded-xl bg-secondary ring-1 ring-border" />}
            <span className={cn("relative", tab === k ? "text-foreground" : "text-muted-foreground")}>{label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {tab === "pending" && (
            <List loading={isLoading} empty="Nenhum cadastro aguardando aprovação.">
              {pending.map((p) => (
                <UserRow key={p.id} p={p}>
                  <IconBtn tone="success" label="Aprovar" onClick={() => setStatus.mutate({ id: p.id, status: "approved" })}>
                    <Check className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn tone="danger" label="Recusar" onClick={() => setStatus.mutate({ id: p.id, status: "rejected" })}>
                    <X className="h-4 w-4" />
                  </IconBtn>
                </UserRow>
              ))}
            </List>
          )}
          {tab === "users" && (
            <List loading={isLoading} empty="Nenhum usuário ainda.">
              {others.map((p) => (
                <UserRow key={p.id} p={p} badge={p.status}>
                  {p.id === me.id ? (
                    <span className="text-[11px] text-muted-foreground">Você</span>
                  ) : p.status === "approved" ? (
                    <IconBtn tone="danger" label="Bloquear" onClick={() => setStatus.mutate({ id: p.id, status: "blocked" })}>
                      <Ban className="h-4 w-4" />
                    </IconBtn>
                  ) : (
                    <IconBtn tone="success" label="Reativar" onClick={() => setStatus.mutate({ id: p.id, status: "approved" })}>
                      <RotateCcw className="h-4 w-4" />
                    </IconBtn>
                  )}
                </UserRow>
              ))}
            </List>
          )}
          {tab === "robot" && <RobotControls />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function List({ loading, empty, children }: { loading: boolean; empty: string; children: ReactNode[] }) {
  if (loading) return <div className="glass h-24 animate-pulse rounded-2xl" />;
  if (children.length === 0)
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <Users className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      </div>
    );
  return <ul className="space-y-2">{children}</ul>;
}

const BADGE: Record<Status, string> = {
  approved: "border-success/30 bg-success/10 text-success",
  pending: "border-tie/30 bg-tie/10 text-tie",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  blocked: "border-destructive/30 bg-destructive/10 text-destructive",
};
const BADGE_LABEL: Record<Status, string> = { approved: "Ativo", pending: "Pendente", rejected: "Recusado", blocked: "Bloqueado" };

function UserRow({ p, badge, children }: { p: Profile; badge?: Status; children: ReactNode }) {
  return (
    <motion.li layout className="glass flex items-center gap-3 rounded-2xl p-3">
      <Avatar value={p.avatar_url} name={p.name} className="h-10 w-10 shrink-0" textClass="text-sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{p.name || "Sem nome"}</p>
          {badge && <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", BADGE[badge])}>{BADGE_LABEL[badge]}</span>}
        </div>
        <p className="truncate text-xs text-muted-foreground">{p.email}</p>
      </div>
      <div className="flex items-center gap-1.5">{children}</div>
    </motion.li>
  );
}

function IconBtn({ tone, label, onClick, children }: { tone: "success" | "danger"; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold",
        tone === "success" ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {children}
      <span>{label}</span>
    </motion.button>
  );
}

function RobotControls() {
  const queryClient = useQueryClient();
  const robot = useRobot();
  const { data: settings } = useQuery(settingsQuery);
  const [minConfidence, setMinConfidence] = useState(70);
  const [seconds, setSeconds] = useState(15);
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setMinConfidence(settings.min_confidence);
    setSeconds(settings.analysis_seconds);
    setMaintenance(settings.maintenance);
  }, [settings]);

  const save = useMutation({
    mutationFn: async (patch: { min_confidence?: number; analysis_seconds?: number; maintenance?: boolean }) => {
      const now = new Date().toISOString();
      // Restart the shared schedule so every user switches to the new timing together.
      const restart = settings?.running && (patch.min_confidence !== undefined || patch.analysis_seconds !== undefined);
      const { error } = await supabase
        .from("robot_settings")
        .update({ ...patch, ...(restart ? { started_at: now } : {}), updated_at: now })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Robô atualizado");
      queryClient.invalidateQueries({ queryKey: settingsQuery.queryKey });
    },
    onError: () => toast.error("Não foi possível salvar."),
  });

  return (
    <div className="space-y-3">
      <div className="glass flex items-center gap-3 rounded-2xl p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-success/30 bg-success/10 text-success">
          <Power className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Robô ligado</p>
          <p className="text-xs text-muted-foreground">Só você liga o robô. Desligado, ninguém recebe sinais.</p>
        </div>
        <Switch checked={robot.running} disabled={robot.toggling} onCheckedChange={() => robot.toggle()} />
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Força mínima do padrão</p>
            <p className="text-xs text-muted-foreground">Só confirma entrada quando o padrão atinge este nível</p>
          </div>
          <span className="font-display text-2xl font-extrabold text-success">{minConfidence}%</span>
        </div>
        <Slider className="mt-4" min={50} max={90} step={1} value={[minConfidence]} onValueChange={([v]) => setMinConfidence(v ?? 70)} />
        <p className="mt-3 text-[11px] text-muted-foreground">
          Mais alto = menos sinais e mais seletivos.
        </p>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Tempo da análise</p>
            <p className="text-xs text-muted-foreground">Duração da análise antes de gerar o sinal</p>
          </div>
          <span className="font-display text-2xl font-extrabold">{seconds}s</span>
        </div>
        <Slider className="mt-4" min={5} max={60} step={1} value={[seconds]} onValueChange={([v]) => setSeconds(v ?? 15)} />
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        disabled={save.isPending}
        onClick={() => save.mutate({ min_confidence: minConfidence, analysis_seconds: seconds })}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-success/90 to-success font-semibold text-background disabled:opacity-60"
      >
        <ShieldCheck className="h-4 w-4" /> Salvar calibragem
      </motion.button>

      <div className="glass flex items-center gap-3 rounded-2xl p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-tie/30 bg-tie/10 text-tie">
          <Wrench className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Modo manutenção</p>
          <p className="text-xs text-muted-foreground">Pausa o robô para todos os usuários</p>
        </div>
        <Switch
          checked={maintenance}
          onCheckedChange={(v) => {
            setMaintenance(v);
            save.mutate({ maintenance: v });
          }}
        />
      </div>
    </div>
  );
}
